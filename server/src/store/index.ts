import type { Db } from "./db";
import { areaRepo } from "./areas";
import { cursorRepo } from "./cursor";
import { decisionRepo } from "./decisions";
import { embeddingRepo } from "./embeddings";
import { factRepo } from "./facts";
import { matterRepo } from "./matters";
import { messageRepo } from "./messages";
import { outcomeRepo } from "./outcomes";
import { ruleRepo } from "./rules";
import { runLock } from "./runLock";
import { runRepo } from "./runs";
import { senderRepo } from "./senders";
import { settingsRepo } from "./settings";
import { streamRepo } from "./streams";
import { tokenRepo } from "./tokens";

export type { Db } from "./db";
export { postgresDb } from "./db";
export { migrate } from "./migrate";

export function createStore(db: Db) {
  return {
    areas: areaRepo(db),
    cursor: cursorRepo(db),
    decisions: decisionRepo(db),
    embeddings: embeddingRepo(db),
    facts: factRepo(db),
    matters: matterRepo(db),
    messages: messageRepo(db),
    outcomes: outcomeRepo(db),
    rules: ruleRepo(db),
    runLock: runLock(db),
    runs: runRepo(db),
    senders: senderRepo(db),
    settings: settingsRepo(db),
    streams: streamRepo(db),
    tokens: tokenRepo(db),
  };
}

export type Store = ReturnType<typeof createStore>;
