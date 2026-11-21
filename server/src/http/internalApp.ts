import { timingSafeEqual, createHash } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";
import type { RunDeps, RunResult } from "../pipeline/runMailbox";
import { runMailbox } from "../pipeline/runMailbox";
import { onError, requestId, type RequestIdEnv } from "./errors";

/** Resolves true once a run holds the lock (it continues in the background), false when one is in progress. */
export type RunTrigger = () => Promise<boolean>;

export interface InternalDeps {
  token: string;
  trigger: RunTrigger;
}

/** Served on INTERNAL_PORT only, which the ingress never exposes. */
export function createInternalApp(deps: InternalDeps): Hono<RequestIdEnv> {
  const app = new Hono<RequestIdEnv>();
  app.use(requestId);
  app.onError(onError);
  app.use("/internal/*", requireBearer(deps.token));
  app.post("/internal/runs", async (c) =>
    (await deps.trigger()) ? c.json({ status: "started" }, 202) : c.json({ error: "run_in_progress" }, 409),
  );
  return app;
}

export function requireBearer(token: string): MiddlewareHandler {
  const expected = digest(token);
  return async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    // Comparing fixed-length digests keeps the check constant-time regardless of input length.
    if (!given || !timingSafeEqual(digest(given), expected)) return c.json({ error: "unauthorized" }, 401);
    await next();
  };
}

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Starts runMailbox in the background and reports whether it got the lock. */
export function backgroundRunner(
  buildDeps: () => RunDeps,
  onDone: (result: RunResult | undefined) => void = () => {},
): { trigger: RunTrigger; idle: () => Promise<void> } {
  let current: Promise<void> | undefined;
  const trigger: RunTrigger = () => {
    if (current) return Promise.resolve(false);
    return new Promise<boolean>((started) => {
      const deps = buildDeps();
      const lock = { tryRun: <T>(work: () => Promise<T>) => deps.lock.tryRun(() => (started(true), work())) };
      current = runMailbox({ ...deps, lock })
        .then(onDone, (err: unknown) => console.error(`run: failed: ${err instanceof Error ? err.name : "error"}`))
        .finally(() => {
          started(false);
          current = undefined;
        });
    });
  };
  return { trigger, idle: async () => current };
}
