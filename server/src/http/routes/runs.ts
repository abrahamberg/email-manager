import type { Run } from "@email-manager/shared";
import { Hono } from "hono";

export interface RunHistory {
  recent(limit: number): Promise<Run[]>;
}

const RECENT_RUNS = 50;

export function runsRoutes(runs: RunHistory): Hono {
  return new Hono().get("/api/runs", async (c) => c.json(await runs.recent(RECENT_RUNS)));
}
