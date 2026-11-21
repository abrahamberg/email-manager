import type { Decision, EmailRef } from "@email-manager/shared";
import { createApp } from "../../src/http/app";
import { createStore, type Db } from "../../src/store";
import { staticFixture } from "./helpers";

const email: EmailRef = {
  id: "m1", from: { name: "News", address: "news@x.com" }, subject: "Hi", receivedAt: "2026-11-20T10:00:00.000Z",
  snippet: "s", category: "newsletter",
};
const base = { email, matter: "m", need: "n", why: "w" };

export const DECISIONS: Decision[] = [
  { ...base, id: "d-reply", kind: "reply", draft: "ok", confidence: 0.9 },
  { ...base, id: "d-choice", kind: "choice", question: "q", options: [{ label: "A" }, { label: "B" }] as never, recommended: 0 },
  { ...base, id: "d-task", kind: "task", title: "Pay", due: "Fri" },
  { ...base, id: "d-rule", kind: "ruleProposal", ruleId: "r1" },
  { ...base, id: "d-snooze", kind: "reply", draft: "ok", confidence: 0.9 },
  { ...base, id: "d-dismiss", kind: "reply", draft: "ok", confidence: 0.9 },
];

export async function seed(db: Db) {
  const s = createStore(db);
  await s.areas.save({ id: "a1", shortName: "Home", kind: "home", name: "Home", summary: "", people: [] });
  await s.facts.save({ id: "f1", areaId: "a1", kind: "date", title: "t", detail: "d" } as never);
  await s.embeddings.save("fact", "f1", [0.1, 0.2]);
  await s.messages.save({
    messageId: "m1", uid: 7, fromAddress: "news@x.com", fromName: "News", subject: "Hi",
    receivedAt: email.receivedAt, category: "newsletter", compactText: "",
  } as never);
  await s.outcomes.record({
    messageId: "m1", uid: 7, outcome: "digest", signal: "headers", reason: "r", dryRun: false, at: email.receivedAt,
  } as never);
  await s.quickChecks.create({ id: "q1", messageId: "m1", question: "ok?" });
  await s.rules.save({ rule: { id: "r1", source: "ai", when: [{ field: "from", operator: "is", value: "a@x" }], then: { kind: "digest" }, priority: 0, status: "proposed" } });
  await s.tasks.create({ id: "t1", title: "x", owner: "me", messageId: "m1" });
  await s.streams.save({ id: "s1", name: "n", areaId: "a1", emailId: "m1", period: "p", total: 1, rest: "", picks: [{ id: "i1", title: "t", facts: [], why: "w" }] });
  for (const d of DECISIONS) await s.decisions.add(d);
  return s;
}

export function seededApp(db: Db) {
  return createApp({
    allowedEmails: ["owner@example.com"], runs: { recent: async () => [] }, staticDir: staticFixture(),
    api: {
      db,
      ask: {
        facts: { list: async () => [] }, messages: { get: async () => undefined },
        decisions: { pending: async () => [] }, search: { search: async () => [] },
      },
    },
  });
}

export const send = (app: ReturnType<typeof seededApp>) => (method: string, path: string, body?: unknown) =>
  app.request(path, {
    method, headers: { "X-Auth-Request-Email": "owner@example.com", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
