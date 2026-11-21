// Composition root for the HTTP server: the public API + panel and the internal run trigger.
import { serve, type ServerType } from "@hono/node-server";
import { loadConfig, type Config } from "./config";
import { createApp } from "./http/app";
import { backgroundRunner, createInternalApp } from "./http/internalApp";
import type { ConnectDeps } from "./http/routes/connect";
import type { RunDeps } from "./pipeline/runMailbox";
import type { SpamCheck } from "./ports";
import { rspamdCheck } from "./spam/rspamdCheck";
import { createStore, migrate, postgresDb, type Db, type Store } from "./store";
import { mailAuthFromConfig } from "./wiring/mailAuthFromConfig";
import { mailboxFromConfig } from "./wiring/mailboxFromConfig";
import { tokenStoreAdapter } from "./wiring/tokenStoreAdapter";

const STATIC_DIR = process.env.STATIC_DIR ?? "/app/public";
const noSpamEngine: SpamCheck = { check: async () => undefined };

// Mirrors buildRunDeps in worker.ts, which can't be imported because it runs on load.
function runDeps(config: Config, db: Db, store: Store): RunDeps {
  const auth = mailAuthFromConfig(config, tokenStoreAdapter(store.tokens));
  return {
    lock: store.runLock,
    mailbox: mailboxFromConfig(config, auth),
    cursor: store.cursor,
    outcomes: store.outcomes,
    rules: store.rules,
    senders: store.senders,
    spamCheck: config.RSPAMD_URL ? rspamdCheck(config.RSPAMD_URL) : noSpamEngine,
    runs: store.runs,
    clock: { now: () => new Date() },
    dryRun: config.DRY_RUN,
    prepare: async () => {
      await migrate(db);
    },
  };
}

function connectDeps(config: Config, store: Store): ConnectDeps | undefined {
  const { PUBLIC_URL, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } = config;
  if (config.MAIL_PROVIDER === "imap" || !PUBLIC_URL || !OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET || !TOKEN_ENCRYPTION_KEY) {
    return undefined;
  }
  return {
    publicUrl: PUBLIC_URL,
    clientId: OAUTH_CLIENT_ID,
    clientSecret: OAUTH_CLIENT_SECRET,
    encryptionKey: Buffer.from(TOKEN_ENCRYPTION_KEY, "base64"),
    tokenStore: tokenStoreAdapter(store.tokens),
  };
}

const closeServer = (server: ServerType) =>
  new Promise<void>((done) => server.close(() => done()));

async function main(): Promise<void> {
  const config = loadConfig();
  const db = postgresDb(config.DATABASE_URL);
  const store = createStore(db);
  // A worker holding the lock migrates in its own prepare step, so skipping here is safe.
  const migrated = await store.runLock.tryRun(async () => (await migrate(db), true));
  if (!migrated) console.log("server: a run holds the lock; it applies migrations");

  const runner = backgroundRunner(
    () => runDeps(config, db, store),
    (result) => result && console.log(`server: run fetched=${result.run.fetched} aborted=${result.aborted}`),
  );
  const app = createApp({
    allowedEmails: config.ALLOWED_EMAILS,
    runs: store.runs,
    connect: connectDeps(config, store),
    staticDir: STATIC_DIR,
  });
  const internal = createInternalApp({ token: config.INTERNAL_TOKEN, trigger: runner.trigger });
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
