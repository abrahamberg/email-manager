import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../store/db";
import { digestGroupExists, setDigestState, unsubscribeCategory } from "../queries/misc";
import { badRequest, done, Id, notFound, parseBody } from "./validate";
import { CATEGORIES } from "./enums";

const State = z.object({ state: z.enum(["normal", "muted", "unsubscribed", "promoted"]) }).strict();
const Unsub = z.object({ category: z.enum(CATEGORIES) }).strict();

export function digestRoutes(db: Db): Hono {
  const app = new Hono();

  // Registered before /digest/:id so "unsubscribe" is not read as a group id.
  app.post("/digest/unsubscribe", async (c) => {
    const body = await parseBody(c, Unsub);
    if (!body) return badRequest(c);
    await unsubscribeCategory(db, body.category);
    return done(c);
  });

  app.post("/digest/:id", async (c) => {
    const body = await parseBody(c, State);
    if (!body) return badRequest(c);
    if (!(await digestGroupExists(db, Id(c)))) return notFound(c);
    await setDigestState(db, Id(c), body.state);
    return done(c);
  });

  return app;
}
