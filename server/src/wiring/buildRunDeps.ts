// Composition root for a mailbox run, shared by the worker and the server's run trigger.
import type { Config } from "../config";
import { DEFAULT_SETTINGS } from "../life/buildAppData";
import type { LifeDeps } from "../pipeline/lifeDeps";
import type { RunDeps } from "../pipeline/runMailbox";
import type { Embedder, SpamCheck } from "../ports";
import { localEmbedder } from "../search/localEmbedder";
import { rspamdCheck } from "../spam/rspamdCheck";
import { migrate, type Db, type Store } from "../store";
import { aiFromConfig } from "./aiFromConfig";
import { mailAuthFromConfig } from "./mailAuthFromConfig";
import { mailboxFromConfig } from "./mailboxFromConfig";
import { tokenStoreAdapter } from "./tokenStoreAdapter";

// Without Rspamd, isSpam still applies the DMARC check from headers.
const noSpamEngine: SpamCheck = { check: async () => undefined };

export interface RunOverrides {
  embedder?: Embedder;
}

export function buildRunDeps(config: Config, db: Db, store: Store, over: RunOverrides = {}): RunDeps {
  const auth = mailAuthFromConfig(config, tokenStoreAdapter(store.tokens));
  const ai = aiFromConfig(config, store.runs.costSince);
  return {
    lock: store.runLock,
    mailbox: mailboxFromConfig(config, auth),
    cursor: store.cursor,
    outcomes: store.outcomes,
    pendingActions: store.pendingActions,
    rules: store.rules,
    senders: store.senders,
    spamCheck: config.RSPAMD_URL ? rspamdCheck(config.RSPAMD_URL) : noSpamEngine,
    runs: store.runs,
    clock: { now: () => new Date() },
    dryRun: config.DRY_RUN,
    pausedInPanel: async () => (await store.settings.get())?.dryRun === true,
    classifier: ai.classifier,
    aiCostUsd: ai.costUsd,
    life: lifeDeps(config, store, ai, over.embedder ?? localEmbedder()),
    prepare: async () => {
      await migrate(db);
    },
  };
}

function lifeDeps(config: Config, store: Store, ai: ReturnType<typeof aiFromConfig>, embedder: Embedder): LifeDeps {
  const address = config.IMAP_USER ?? config.ALLOWED_EMAILS[0] ?? "";
  return {
    store,
    embedder,
    extract: ai.extract,
    drafter: ai.drafter,
    writeWhy: ai.writeWhy,
    user: { address, name: address.split("@")[0] ?? "" },
    defaults: { ...DEFAULT_SETTINGS, dryRun: config.DRY_RUN, aiDailyBudgetUsd: config.AI_DAILY_BUDGET_USD },
  };
}
