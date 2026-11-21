import { Hono } from "hono";
import { z } from "zod";
import type { Decision } from "@email-manager/shared";
import type { Store } from "../../store";
import { badRequest, done, Id, notFound, parseBody } from "./validate";

const Edit = z.object({
  text: z.string().max(5000).optional(),
  optionIndex: z.number().int().min(0).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  due: z.string().max(40).optional(),
}).strict();

const DAY_MS = 24 * 3600 * 1000;
const FAR_FUTURE = "9999-12-31T00:00:00.000Z";

/** Accepting a reply never sends mail in v1: the draft stays in Drafts. */
async function accept(store: Store, d: Decision, edit: z.infer<typeof Edit>): Promise<string | undefined> {
  switch (d.kind) {
    case "reply":
    case "followUp":
      return "accepted";
    case "choice": {
      const option = d.options[edit.optionIndex ?? d.recommended];
      if (!option) return undefined;
      return `chose: ${option.label}`;
    }
    case "task":
      await store.tasks.create({
        id: `t-${d.id}`, title: edit.title ?? d.title, owner: "me", messageId: d.email.id, due: edit.due ?? d.due,
      });
      return "task created";
    case "ruleProposal":
      await store.rules.setStatus(d.ruleId, "active");
      return "rule activated";
  }
}

export function decisionRoutes(store: Store): Hono {
  const app = new Hono();

  app.post("/decisions/restore", async (c) => {
    await store.decisions.wake(FAR_FUTURE);
    return done(c);
  });

  app.post("/decisions/:id/accept", async (c) => {
    const edit = await parseBody(c, Edit);
    if (!edit) return badRequest(c);
    const d = await store.decisions.get(Id(c));
    if (!d) return notFound(c);
    const resolution = await accept(store, d, edit);
    if (resolution === undefined) return badRequest(c);
    await store.decisions.resolve(d.id, "done", resolution);
    return done(c);
  });

  app.post("/decisions/:id/dismiss", async (c) => {
    if (!(await parseBody(c, z.object({}).strict()))) return badRequest(c);
    const d = await store.decisions.get(Id(c));
    if (!d) return notFound(c);
    if (d.kind === "ruleProposal") await store.rules.setStatus(d.ruleId, "disabled");
    await store.decisions.resolve(d.id, "dismissed");
    return done(c);
  });

  app.post("/decisions/:id/snooze", async (c) => {
    if (!(await parseBody(c, z.object({}).strict()))) return badRequest(c);
    if (!(await store.decisions.get(Id(c)))) return notFound(c);
    await store.decisions.snooze(Id(c), new Date(Date.now() + DAY_MS).toISOString());
    return done(c);
  });

  return app;
}
