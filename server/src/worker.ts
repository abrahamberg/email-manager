// Entry for the scheduled run (CronJob).
import { loadConfig } from "./config";
import { loadInstanceKeys } from "./keys/instanceKeys";
import { runMailbox } from "./pipeline/runMailbox";
import { createStore, postgresDb } from "./store";
import { buildRunDeps } from "./wiring/buildRunDeps";

export async function runWorker(): Promise<number> {
  const config = loadConfig();
  const keys = await loadInstanceKeys(config);
  const db = postgresDb(config.DATABASE_URL);
  try {
    const result = await runMailbox(buildRunDeps(config, db, createStore(db), keys));
    if (!result) {
      console.log("worker: another run holds the lock; nothing to do");
      return 0;
    }
    if (result.mailboxes === 0 && !result.aborted) {
      console.log("worker: no mailboxes set up yet; open Set up in the panel");
      return 0;
    }
    const { run } = result;
    console.log(`worker: mailboxes=${result.mailboxes} fetched=${run.fetched} logic=${run.handledByLogic} ai=${run.sentToAi} dryRun=${config.DRY_RUN}`);
    if (run.error) console.error(`worker: run finished with errors: ${run.error}`);
    return result.aborted ? 1 : 0;
  } finally {
    await db.close();
  }
}

const isEntry = import.meta.url === `file://${process.argv[1]}` || /worker\.(js|mjs)$/.test(process.argv[1] ?? "");

if (isEntry) {
  runWorker().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(`worker: failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    },
  );
}
