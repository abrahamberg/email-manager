import { Hono } from "hono";
import { buildAppData } from "../../life/buildAppData";
import type { Db } from "../../store/db";

export function todayRoutes(db: Db): Hono {
  return new Hono().get("/today", async (c) => c.json(await buildAppData(db)));
}
