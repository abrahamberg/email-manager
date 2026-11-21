import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db } from "./db";

type Conn = PGlite | Transaction;

function wrap(conn: Conn): Pick<Db, "query" | "exec"> {
  return {
    query: async <T>(text: string, params: unknown[] = []) =>
      (await conn.query<T>(text, params as unknown[])).rows,
    exec: async (text: string) => {
      await conn.exec(text);
    },
  };
}

function noNested(): never {
  throw new Error("nested transactions and locks are not supported");
}

/**
 * In-process database for tests. PGlite is one session, where advisory locks
 * are re-entrant, so the lock is an in-memory set instead.
 */
export function pgliteDb(): Db {
  const pg = new PGlite();
  const held = new Set<number>();
  return {
    ...wrap(pg),
    transaction: (work) =>
      pg.transaction((tx) => work({ ...wrap(tx), transaction: noNested, withLock: noNested, close: noNested })),
    withLock: async (key, work) => {
      if (held.has(key)) return undefined;
      held.add(key);
      try {
        return await work();
      } finally {
        held.delete(key);
      }
    },
    close: () => pg.close(),
  };
}
