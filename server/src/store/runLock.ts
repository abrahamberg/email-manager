import type { RunLock } from "../ports";
import type { Db } from "./db";

// Arbitrary constant shared by every worker pod: one pipeline run at a time.
export const PIPELINE_LOCK_KEY = 7_400_001;

export function runLock(db: Db, key = PIPELINE_LOCK_KEY): RunLock {
  return { tryRun: (work) => db.withLock(key, work) };
}
