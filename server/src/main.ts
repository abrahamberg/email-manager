// Composition root for the HTTP server: the public API + panel and the internal run trigger.
import { serve, type ServerType } from "@hono/node-server";
import { loadConfig } from "./config";
import { createApp } from "./http/app";
import { backgroundRunner, createInternalApp } from "./http/internalApp";
import { loadInstanceKeys } from "./keys/instanceKeys";
import { mailboxService } from "./mailboxes/service";
import { createStore, migrate, postgresDb, type Store } from "./store";
import { buildRunDeps } from "./wiring/buildRunDeps";
import { localEmbedder } from "./search/localEmbedder";
import { vectorSearch } from "./search/vectorSearch";
import { connectDeps, setupDeps, type PanelMailDeps } from "./wiring/setupDeps";

const STATIC_DIR = process.env.STATIC_DIR ?? "/app/public";

function askDeps(store: Store) {
  const { facts, messages, decisions, embeddings } = store;
  return { facts, messages, decisions, search: vectorSearch(embeddings, localEmbedder()) };
}

const closeServer = (server: ServerType) =>
  new Promise<void>((done) => server.close(() => done()));

async function main(): Promise<void> {
  const config = loadConfig();
  const keys = await loadInstanceKeys(config);
  const db = postgresDb(config.DATABASE_URL);
  const store = createStore(db);
  // A worker holding the lock migrates in its own prepare step, so skipping here is safe.
  const migrated = await store.runLock.tryRun(async () => (await migrate(db), true));
  if (!migrated) console.log("server: a run holds the lock; it applies migrations");

  const runner = backgroundRunner(
    () => buildRunDeps(config, db, store, keys),
    (result) => result && console.log(`server: run mailboxes=${result.mailboxes} fetched=${result.run.fetched} aborted=${result.aborted}`),
  );
  const mail: PanelMailDeps = {
    service: mailboxService(store.mailboxes, store.tokens, keys.encryptionKey),
    tokens: store.tokens,
    encryptionKey: keys.encryptionKey,
    publicUrl: config.PUBLIC_URL,
  };
  const app = createApp({
    allowedEmails: config.ALLOWED_EMAILS,
    runs: store.runs,
    connect: connectDeps(mail),
    setup: setupDeps(mail),
    staticDir: STATIC_DIR,
    api: { db, ask: askDeps(store) },
  });
  const internal = createInternalApp({ token: keys.internalToken, trigger: runner.trigger });
  const servers = [
    serve({ fetch: app.fetch, port: config.PORT }),
    serve({ fetch: internal.fetch, port: config.INTERNAL_PORT }),
  ];
  console.log(`server: listening on ${config.PORT} (internal ${config.INTERNAL_PORT})`);

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
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
