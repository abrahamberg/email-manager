import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import type { Store } from "../../store";
import { Action, Condition } from "../../rules/Rule";
import { describeRule } from "../../rules/describeRule";
import { proposeRule } from "../../trust/proposeRule";
import { badRequest, done, notFound, parseBody } from "./validate";

const Save = z.object({ id: z.string().min(1).max(100).optional(), when: z.array(Condition).min(1), then: Action }).strict();

/** The status route lives in delegation.ts. A saved user rule goes live at once. */
export function ruleRoutes(store: Store): Hono {
  return new Hono().post("/rules", async (c) => {
    const body = await parseBody(c, Save);
    if (!body) return badRequest(c);
    const id = body.id ?? `u-${randomUUID()}`;
    if (body.id && !(await store.rules.listShared()).some((r) => r.id === id)) return notFound(c);
    const others = (await store.rules.activeRules()).filter((r) => r.id !== id);
    const proposal = proposeRule(
      { id, source: "user", when: body.when, then: body.then, priority: 0 },
      others, { autoActivate: false, repliedSenders: new Set() },
    );
    if (proposal.kind === "invalid") return badRequest(c);
    if (proposal.kind === "saved") {
      await store.rules.save({ rule: { ...proposal.rule, status: "active" }, text: describeRule(body.when, body.then) });
    }
    return done(c);
  });
}
