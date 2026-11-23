// Composition root for the HTTP server: the public API + panel and the internal run trigger.
import { serve, type ServerType } from "@hono/node-server";
import { loadConfig, type Config } from "./config";
import { createApp } from "./http/app";
import { backgroundRunner, createInternalApp } from "./http/internalApp";
import { loadInstanceKeys, type InstanceKeys } from "./keys/instanceKeys";
import { mailboxService } from "./mailboxes/service";
import { localEmbedder } from "./search/localEmbedder";
import { vectorSearch } from "./search/vectorSearch";
import { createStore, migrate, postgresDb, type Db, type Store } from "./store";
import { buildRunDeps } from "./wiring/buildRunDeps";
import { everyMinutes } from "./wiring/schedule";
import { connectDeps, setupDeps, type PanelMailDeps } from "./wiring/setupDeps";

function askDeps(store: Store) {
  const { facts, messages, decisions, embeddings } = store;
  return { facts, messages, decisions, search: vectorSearch(embeddings, localEmbedder()) };
}

function panelApp(config: Config, db: Db, store: Store, keys: InstanceKeys) {
  const mail: PanelMailDeps = {
    service: mailboxService(store.mailboxes, store.tokens, keys.encryptionKey),
    tokens: store.tokens,
    encryptionKey: keys.encryptionKey,
    publicUrl: config.PUBLIC_URL,
  };
  return createApp({
    allowedEmails: config.ALLOWED_EMAILS,
    runs: store.runs,
    connect: connectDeps(mail),
    setup: setupDeps(mail),
    staticDir: config.STATIC_DIR,
    api: { db, ask: askDeps(store) },
  });
}

// A worker holding the lock migrates in its own prepare step, so skipping here is safe.
async function migrateUnlessRunning(db: Db, store: Store): Promise<void> {
  const migrated = await store.runLock.tryRun(async () => (await migrate(db), true));
  if (!migrated) console.log("server: a run holds the lock; it applies migrations");
}

const closeServer = (server: ServerType) =>
  new Promise<void>((done) => server.close(() => done()));

async function main(): Promise<void> {
  const config = loadConfig();
  const keys = await loadInstanceKeys(config);
  const db = postgresDb(config.DATABASE_URL);
  const store = createStore(db);
  await migrateUnlessRunning(db, store);

  const runner = backgroundRunner(
    () => buildRunDeps(config, db, store, keys),
    (result) => result && console.log(`server: run mailboxes=${result.mailboxes} fetched=${result.run.fetched} aborted=${result.aborted}`),
  );
  const internal = createInternalApp({ token: keys.internalToken, trigger: runner.trigger });
  const servers = [
    serve({ fetch: panelApp(config, db, store, keys).fetch, port: config.PORT }),
    serve({ fetch: internal.fetch, port: config.INTERNAL_PORT }),
  ];
  const stopSchedule = everyMinutes(config.RUN_INTERVAL_MINUTES, runner.trigger);
  console.log(`server: listening on ${config.PORT} (internal ${config.INTERNAL_PORT})`);

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    stopSchedule();
    await Promise.all(servers.map(closeServer));
    await runner.idle();
    await db.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err: unknown) => {
  console.error(`server: failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
