// Composition root for the scheduled run: the only file that picks concrete adapters for it.
import { loadConfig, type Config } from "./config";
import type { SpamCheck } from "./ports";
import { runMailbox, type RunDeps } from "./pipeline/runMailbox";
import { rspamdCheck } from "./spam/rspamdCheck";
import { createStore, migrate, postgresDb, type Db } from "./store";
import { mailAuthFromConfig } from "./wiring/mailAuthFromConfig";
import { mailboxFromConfig } from "./wiring/mailboxFromConfig";
import { tokenStoreAdapter } from "./wiring/tokenStoreAdapter";

// Without Rspamd, isSpam still applies the DMARC check from headers.
const noSpamEngine: SpamCheck = { check: async () => undefined };

export function buildRunDeps(config: Config, db: Db): RunDeps {
  const store = createStore(db);
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

export async function main(): Promise<number> {
  const config = loadConfig();
  const db = postgresDb(config.DATABASE_URL);
  try {
    const result = await runMailbox(buildRunDeps(config, db));
    if (!result) {
      console.log("worker: another run holds the lock; nothing to do");
      return 0;
    }
    const { run } = result;
    console.log(`worker: fetched=${run.fetched} logic=${run.handledByLogic} ai=${run.sentToAi} dryRun=${config.DRY_RUN}`);
    if (run.error) console.error(`worker: run finished with errors: ${run.error}`);
    return result.aborted ? 1 : 0;
  } finally {
    await db.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`worker: failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
