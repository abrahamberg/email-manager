import { Hono } from "hono";
import { z } from "zod";
import type { Store } from "../../store";
import type { Db } from "../../store/db";
import { pickExists } from "../queries/misc";
import { badRequest, done, Id, notFound, parseBody } from "./validate";

const Body = z.object({ streamId: z.string().min(1), feedback: z.enum(["more", "less"]) }).strict();

export function pickRoutes(store: Store, db: Db): Hono {
  return new Hono().post("/picks/:id/feedback", async (c) => {
    const body = await parseBody(c, Body);
    if (!body) return badRequest(c);
    if (!(await pickExists(db, body.streamId, Id(c)))) return notFound(c);
    await store.streams.setFeedback(Id(c), body.feedback);
    return done(c);
  });
}
