import { Hono } from "hono";
import { z } from "zod";
import type { Category, CategoryPolicy, Rule, RuleFeed } from "@email-manager/shared";

/** What the router needs from storage; the real store adapts to this. */
export interface DelegationStore {
  policies(): Promise<CategoryPolicy[]>;
  rules(): Promise<Rule[]>;
  feeds(): Promise<RuleFeed[]>;
  setRuleStatus(id: string, status: Rule["status"]): Promise<boolean>;
  setPolicyLevel(category: Category, level: CategoryPolicy["level"]): Promise<boolean>;
  answerQuickCheck(id: string, correct: boolean): Promise<boolean>;
}

const StatusBody = z.object({ status: z.enum(["active", "proposed", "disabled"]) });
const LevelBody = z.object({ level: z.enum(["watch", "suggest", "act", "quiet"]) });
const AnswerBody = z.object({ correct: z.boolean() });

async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | undefined> {
  const body = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : undefined;
}

export function delegationRoutes(store: DelegationStore): Hono {
  const app = new Hono();
  const bad = (c: { json: (b: unknown, s: 400) => Response }) => c.json({ error: "Invalid body" }, 400);
  const missing = (c: { json: (b: unknown, s: 404) => Response }) => c.json({ error: "Not found" }, 404);

  app.get("/delegation", async (c) => {
    const [policies, rules, feeds] = await Promise.all([store.policies(), store.rules(), store.feeds()]);
    return c.json({ policies, rules, feeds });
  });

  app.post("/rules/:id/status", async (c) => {
    const body = await parseBody(c.req.raw, StatusBody);
    if (!body) return bad(c);
    return (await store.setRuleStatus(c.req.param("id"), body.status)) ? c.json({ ok: true }) : missing(c);
  });

  app.post("/policies/:category/level", async (c) => {
    const body = await parseBody(c.req.raw, LevelBody);
    if (!body) return bad(c);
    const ok = await store.setPolicyLevel(c.req.param("category") as Category, body.level);
    return ok ? c.json({ ok: true }) : missing(c);
  });

  app.post("/quick-checks/:id", async (c) => {
    const body = await parseBody(c.req.raw, AnswerBody);
    if (!body) return bad(c);
    return (await store.answerQuickCheck(c.req.param("id"), body.correct)) ? c.json({ ok: true }) : missing(c);
  });

  return app;
}
