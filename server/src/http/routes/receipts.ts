import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../store/db";
import { findReceipt, markUndone, queueMoveToInbox } from "../queries/receipts";
import { badRequest, done, Id, notFound, parseBody } from "./validate";

const Empty = z.object({}).strict();
const Teach = z.object({ always: z.boolean() }).strict();

export function receiptRoutes(db: Db): Hono {
  const app = new Hono();

  app.post("/receipts/:id/undo", async (c) => {
    if (!(await parseBody(c, Empty))) return badRequest(c);
    const receipt = await findReceipt(db, Id(c));
    if (!receipt) return notFound(c);
    await markUndone(db, Id(c));
    await queueMoveToInbox(db, receipt);
    return done(c);
  });

  app.post("/receipts/:id/teach", async (c) => {
    const body = await parseBody(c, Teach);
    if (!body) return badRequest(c);
    const receipt = await findReceipt(db, Id(c));
    if (!receipt) return notFound(c);
    // "Never do that" also reverses this one; "always" only records the lesson.
    await markUndone(db, Id(c), body.always ? "always" : "never");
    if (!body.always) await queueMoveToInbox(db, receipt);
    return done(c);
  });

  return app;
}
