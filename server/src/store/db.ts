import postgres from "postgres";

/** The only database surface repos see, so tests run on PGlite and production on Postgres. */
export interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs SQL without parameters; may hold several statements (migrations). */
  exec(sql: string): Promise<void>;
  transaction<T>(work: (tx: Db) => Promise<T>): Promise<T>;
  /** Runs work only if no other holder has `key`; undefined when someone does. */
  withLock<T>(key: number, work: () => Promise<T>): Promise<T | undefined>;
  close(): Promise<void>;
}

type Sql = postgres.Sql | postgres.TransactionSql;

/**
 * Why: repos pass already-stringified JSON for `$n::jsonb`. The driver would stringify the
 * string again and store a JSON scalar, which later fails in jsonb_array_elements and friends.
 * PGlite does not do this, so tests alone would not catch it.
 */
export function jsonParam(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

const JSON_TYPES = { json: { to: 114, from: [114, 3802], serialize: jsonParam, parse: (text: string): unknown => JSON.parse(text) } };

function wrapPostgres(sql: Sql): Omit<Db, "transaction" | "withLock" | "close"> {
  return {
    query: async <T>(text: string, params: unknown[] = []) =>
      (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[],
    exec: async (text: string) => {
      await sql.unsafe(text);
    },
  };
}

function noNested(): never {
  throw new Error("nested transactions and locks are not supported");
}

export function postgresDb(url: string): Db {
  const sql = postgres(url, { max: 5, onnotice: () => {}, types: JSON_TYPES });
  return {
    ...wrapPostgres(sql),
    transaction: (work) =>
      sql.begin((tx) =>
        work({ ...wrapPostgres(tx), transaction: noNested, withLock: noNested, close: noNested }),
      ) as never,
    // Session-level advisory lock on one reserved connection, so lock and unlock share a session.
    withLock: async (key, work) => {
      const conn = await sql.reserve();
      try {
        const [row] = await conn.unsafe("SELECT pg_try_advisory_lock($1) AS ok", [key]);
        if (!row?.ok) return undefined;
        try {
          return await work();
        } finally {
          await conn.unsafe("SELECT pg_advisory_unlock($1)", [key]);
        }
      } finally {
        conn.release();
      }
    },
    close: () => sql.end(),
  };
}
