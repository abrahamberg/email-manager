import { beforeAll, describe, expect, it } from "vitest";
import type { CategoryPolicy } from "@email-manager/shared";
import { proposeRule } from "../../src/trust/proposeRule.js";
import { suggestAutonomy } from "../../src/trust/autonomy.js";
import { autonomySuggestions, tallyByCategory, withAccuracy } from "../../src/trust/accuracy.js";
import { pickQuickChecks, type CheckCandidate } from "../../src/trust/quickChecks.js";
import { delegationRoutes } from "../../src/http/routes/delegation.js";
import { createStore } from "../../src/store/index.js";
import { useFreshDb } from "../store/freshDb.js";

const replied = new Set(["boss@corp.com"]);
const base = { id: "r1", source: "ai", when: [{ field: "from", operator: "contains", value: "news@shop.com" }], then: { kind: "digest" } };
const withThen = (kind: string, extra: object = {}) => ({ ...base, then: { kind, ...extra } });

describe("proposeRule safety", () => {
  const cases: [string, object, boolean, boolean][] = [
    ["digest auto", base, true, true],
    ["label auto", withThen("label", { label: "x" }), true, true],
    ["digest, setting off", base, false, false],
    ["junk never", withThen("junk"), true, false],
    ["alwaysShow never", withThen("alwaysShow"), true, false],
    ["task never", withThen("task"), true, false],
    ["archive never", withThen("archive"), true, false],
    ["ai on replied sender", { ...base, when: [{ field: "from", operator: "endsWith", value: "corp.com" }] }, true, false],
    ["user rule on replied sender", { ...base, source: "user", when: [{ field: "from", operator: "is", value: "boss@corp.com" }] }, true, true],
  ];
  it.each(cases)("%s", (_n, s, auto, activated) => {
    const r = proposeRule({ ...s, status: "active" }, [], { autoActivate: auto, repliedSenders: replied });
    expect(r.kind).toBe("saved");
    if (r.kind === "saved") {
      expect(r.activated).toBe(activated);
      expect(r.rule.status).toBe(activated ? "active" : "proposed");
    }
  });

  it("rejects invalid and delete actions", () => {
    expect(proposeRule(withThen("delete"), [], { autoActivate: true, repliedSenders: replied }).kind).toBe("invalid");
    expect(proposeRule(null, [], { autoActivate: true, repliedSenders: replied }).kind).toBe("invalid");
  });

  it("dedupes identical when/then", () => {
    const first = proposeRule(base, [], { autoActivate: false, repliedSenders: replied });
    if (first.kind !== "saved") throw new Error("expected saved");
    const second = proposeRule({ ...base, id: "r2" }, [first.rule], { autoActivate: false, repliedSenders: replied });
    expect(second.kind).toBe("duplicate");
  });
});

const policy = (o: Partial<CategoryPolicy>): CategoryPolicy =>
  ({ category: "newsletter", label: "Newsletters", level: "suggest", correct: 0, checked: 0, sendsMail: false, ...o });

describe("autonomy parity with web", () => {
  it("matches web cases", () => {
    expect(suggestAutonomy(policy({}))).toBeUndefined();
    expect(suggestAutonomy(policy({ correct: 40, checked: 40 }))).toBe("act");
    expect(suggestAutonomy(policy({ correct: 5, checked: 5 }))).toBeUndefined();
    expect(suggestAutonomy(policy({ sendsMail: true, correct: 100, checked: 100 }))).toBeUndefined();
    expect(suggestAutonomy(policy({ level: "act", correct: 7, checked: 10 }))).toBe("suggest");
    expect(suggestAutonomy(policy({ level: "watch", correct: 1, checked: 10 }))).toBeUndefined();
  });

  it("computes accuracy from answers and suggests", () => {
    const answers = Array.from({ length: 20 }, () => ({ category: "newsletter" as const, correct: true }));
    expect(tallyByCategory(answers).get("newsletter")).toEqual({ correct: 20, checked: 20 });
    const ps = withAccuracy([policy({}), policy({ category: "receipt" })], answers);
    expect(autonomySuggestions(ps)).toEqual([{ category: "newsletter", from: "suggest", to: "act" }]);
  });
});

describe("pickQuickChecks", () => {
  const now = new Date("2026-11-21T15:00:00");
  const c = (id: string, sender: string, confidence: number | undefined, over: Partial<CheckCandidate> = {}): CheckCandidate =>
    ({ id, receiptId: id, sender, automatic: true, confidence, question: "?", at: "2026-11-21T10:00:00", ...over });

  it("picks most uncertain, max 3, one per sender", () => {
    const picked = pickQuickChecks(
      [c("a", "x@a.com", 0.6), c("b", "X@a.com", 0.5), c("c", "y@a.com", 0.7), c("d", "z@a.com", 0.4), c("e", "w@a.com", 0.75)],
      now,
    );
    expect(picked.map((p) => p.id)).toEqual(["d", "b", "c"]);
  });

  it("skips old, confident, manual and unscored", () => {
    const picked = pickQuickChecks(
      [c("a", "a@a", 0.3, { at: "2026-11-20T10:00:00" }), c("b", "b@a", 0.95), c("c", "c@a", 0.3, { automatic: false }), c("d", "d@a", undefined)],
      now,
    );
    expect(picked).toEqual([]);
  });
});

describe("delegation router", () => {
  const getDb = useFreshDb();
  const post = (path: string, body: unknown) =>
    delegationRoutes(createStore(getDb())).request(path, {
      method: "POST", headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeAll(async () => {
    const s = createStore(getDb());
    await s.rules.save({ rule: { id: "r1", source: "user", when: [{ field: "from", operator: "is", value: "a@x" }], then: { kind: "digest" }, priority: 0, status: "proposed" } });
    await s.messages.save({ messageId: "m1", uid: 1, fromAddress: "a@x", subject: "s", receivedAt: "2026-11-21T09:00:00Z", category: "newsletter", compactText: "" });
    await s.outcomes.record({ messageId: "m1", uid: 1, outcome: "digest", signal: "rule", reason: "list", dryRun: false, at: "2026-11-21T09:00:00Z" });
    await s.quickChecks.create({ id: "q1", messageId: "m1", question: "Right?" });
  });

  it("returns the summary", async () => {
    const res = await delegationRoutes(createStore(getDb())).request("/delegation");
    const body = (await res.json()) as { policies: unknown[]; rules: { id: string; text: string }[]; feeds: unknown[] };
    expect(body.policies).toHaveLength(7);
    expect(body.rules.map((r) => r.id)).toEqual(["r1"]);
    expect(body.rules[0]?.text).toBe("When sender is “a@x”: move to the digest");
    expect(body.feeds).toEqual([]);
  });

  it("validates bodies", async () => {
    expect((await post("/rules/r1/status", { status: "deleted" })).status).toBe(400);
    expect((await post("/rules/r1/status", "not json")).status).toBe(400);
    expect((await post("/policies/newsletter/level", { level: "loud" })).status).toBe(400);
    expect((await post("/quick-checks/q1", { correct: "yes" })).status).toBe(400);
  });

  it("accepts good bodies and 404s unknown ids", async () => {
    expect((await post("/rules/r1/status", { status: "active" })).status).toBe(200);
    expect((await post("/rules/zz/status", { status: "active" })).status).toBe(404);
    expect((await post("/policies/newsletter/level", { level: "act" })).status).toBe(200);
    expect((await post("/policies/nonsense/level", { level: "act" })).status).toBe(404);
    expect((await post("/quick-checks/q1", { correct: true })).status).toBe(200);
    expect((await post("/quick-checks/q1", { correct: true })).status).toBe(404);
    const p = (await createStore(getDb()).policies.list()).find((x) => x.category === "newsletter");
    expect(p).toMatchObject({ level: "act", correct: 1, checked: 1 });
  });
});
