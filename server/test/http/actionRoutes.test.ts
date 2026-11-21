import { beforeAll, describe, expect, it } from "vitest";
import { routeFor } from "../../../web/src/api/actionRoutes";
import type { Action } from "../../../web/src/state/actions";
import { useFreshDb } from "../store/freshDb";
import { seed, seededApp, send } from "./seed";

const getDb = useFreshDb();
let call: ReturnType<typeof send>;
beforeAll(async () => {
  await seed(getDb());
  call = send(seededApp(getDb()));
});

const rule = { when: [{ field: "from", operator: "is", value: "a@x" }] as never, then: { kind: "digest" } as never };

const ACTIONS: Action[] = [
  { type: "decision/accept", id: "d-reply" },
  { type: "decision/dismiss", id: "d-dismiss" },
  { type: "decision/snooze", id: "d-snooze" },
  { type: "decision/restoreSnoozed" },
  { type: "quickCheck/answer", id: "q1", correct: true },
  { type: "receipt/undo", id: "rc-m1-digest" },
  { type: "receipt/teach", id: "rc-m1-digest", always: true },
  { type: "digest/setState", id: "dg-news@x.com", state: "muted" },
  { type: "digest/unsubscribeCategory", category: "newsletter" },
  { type: "task/toggle", id: "t1" },
  { type: "policy/setLevel", category: "newsletter", level: "act" },
  { type: "policy/applyPreset", preset: "balanced" },
  { type: "rule/setStatus", id: "r1", status: "active" },
  { type: "rule/save", ...rule },
  { type: "settings/update", patch: { dryRun: true } },
  { type: "pick/feedback", streamId: "s1", itemId: "i1", feedback: "less" },
  { type: "fact/forget", id: "f1" },
  { type: "area/setNote", id: "a1", note: "n" },
  { type: "area/add", name: "Garden", note: "" },
];

describe("every web action route is mounted", () => {
  it("covers the whole action table", () => {
    expect(new Set(ACTIONS.map((a) => a.type)).size).toBe(19);
  });
  it.each(ACTIONS.map((a) => [a.type, a] as const))("%s", async (_t, action) => {
    const { method, path, body } = routeFor(action);
    const res = await call(method, path, body);
    expect(res.status).toBe(204);
  });
});
