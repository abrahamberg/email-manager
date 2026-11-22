import type { Db } from "./db";
import { areaRepo } from "./areas";
import { briefingRepo } from "./briefings";
import { cursorRepo } from "./cursor";
import { decisionRepo } from "./decisions";
import { embeddingRepo } from "./embeddings";
import { factRepo } from "./facts";
import { mailboxRepo } from "./mailboxes";
import { matterRepo } from "./matters";
import { messageRepo } from "./messages";
import { outcomeRepo } from "./outcomes";
import { pendingActionRepo } from "./pendingActions";
import { policyRepo } from "./policies";
import { quickCheckRepo } from "./quickChecks";
import { ruleRepo } from "./rules";
import { runLock } from "./runLock";
import { runRepo } from "./runs";
import { senderRepo } from "./senders";
import { settingsRepo } from "./settings";
import { streamRepo } from "./streams";
import { taskRepo } from "./tasks";
import { tokenRepo } from "./tokens";

export type { Db } from "./db";
export { postgresDb } from "./db";
export { migrate } from "./migrate";

export function createStore(db: Db) {
  return {
    areas: areaRepo(db),
    briefings: briefingRepo(db),
    cursorFor: (mailboxId: string) => cursorRepo(db, mailboxId),
    decisions: decisionRepo(db),
    embeddings: embeddingRepo(db),
    facts: factRepo(db),
    mailboxes: mailboxRepo(db),
    matters: matterRepo(db),
    messages: messageRepo(db),
    outcomes: outcomeRepo(db),
    pendingActionsFor: (mailboxId: string) => pendingActionRepo(db, mailboxId),
    policies: policyRepo(db),
    quickChecks: quickCheckRepo(db),
    rules: ruleRepo(db),
    runLock: runLock(db),
    runs: runRepo(db),
    senders: senderRepo(db),
    settings: settingsRepo(db),
    streams: streamRepo(db),
    tasks: taskRepo(db),
    tokens: tokenRepo(db),
  };
}

export type Store = ReturnType<typeof createStore>;
