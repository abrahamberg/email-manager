import { Hono } from "hono";
import { z } from "zod";
import type { Store } from "../../store";

const StatusBody = z.object({ status: z.enum(["active", "proposed", "disabled"]) });
const LevelBody = z.object({ level: z.enum(["watch", "suggest", "act", "quiet"]) });
const AnswerBody = z.object({ correct: z.boolean() });

async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | undefined> {
  const body = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : undefined;
}

export function delegationRoutes(store: Store): Hono {
  const app = new Hono();
  const bad = (c: { json: (b: unknown, s: 400) => Response }) => c.json({ error: "bad_request" }, 400);
  const missing = (c: { json: (b: unknown, s: 404) => Response }) => c.json({ error: "not_found" }, 404);

  app.get("/delegation", async (c) => {
    const [policies, rules, feeds] = await Promise.all([
      store.policies.list(), store.rules.listShared(), store.rules.feeds(),
    ]);
    return c.json({ policies, rules, feeds });
  });

  app.post("/rules/:id/status", async (c) => {
    const body = await parseBody(c.req.raw, StatusBody);
    if (!body) return bad(c);
    return (await store.rules.setStatus(c.req.param("id"), body.status)) ? c.body(null, 204) : missing(c);
  });

  app.post("/policies/:category/level", async (c) => {
    const body = await parseBody(c.req.raw, LevelBody);
    if (!body) return bad(c);
    const ok = await store.policies.setLevel(c.req.param("category"), body.level);
    return ok ? c.body(null, 204) : missing(c);
  });

  app.post("/quick-checks/:id", async (c) => {
    const body = await parseBody(c.req.raw, AnswerBody);
    if (!body) return bad(c);
    const answered = await store.quickChecks.answer(c.req.param("id"), body.correct);
    if (!answered) return missing(c);
    if (answered.category) await store.policies.recordAnswer(answered.category, body.correct);
    return c.body(null, 204);
  });

  return app;
}
