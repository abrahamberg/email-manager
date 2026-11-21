import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import type { Store } from "../../store";
import { badRequest, done, Id, notFound, parseBody } from "./validate";

const Note = z.object({ note: z.string().max(2000) }).strict();
const Add = z.object({ name: z.string().trim().min(1).max(80), note: z.string().max(2000) }).strict();

export function areaRoutes(store: Store): Hono {
  const app = new Hono();

  app.post("/areas/:id/note", async (c) => {
    const body = await parseBody(c, Note);
    if (!body) return badRequest(c);
    const area = await store.areas.get(Id(c));
    if (!area) return notFound(c);
    await store.areas.save({ ...area, note: body.note.trim() || undefined });
    return done(c);
  });

  app.post("/areas", async (c) => {
    const body = await parseBody(c, Add);
    if (!body) return badRequest(c);
    await store.areas.save({
      id: `a-${randomUUID()}`, kind: "other", name: body.name, shortName: body.name,
      summary: "New. I'll group matching mail here from the next run.", note: body.note.trim() || undefined, people: [],
    });
    return done(c);
  });

  return app;
}
