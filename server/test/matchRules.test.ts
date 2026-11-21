import { describe, expect, it } from "vitest";
import type { Email } from "../src/mail/Email.js";
import type { Rule } from "../src/rules/Rule.js";
import { matchRules } from "../src/rules/matchRules.js";

const now = new Date("2026-11-21T08:00:00Z");
const email: Email = {
  uid: 1, messageId: "m1", threadId: "m1",
  from: { name: "Weekly Byte", address: "byte@substack.com" },
  to: [], cc: [], subject: "Issue #212: Rust in the kernel", date: "2026-11-21T07:00:00Z",
  headers: { "list-id": "<byte.substack.com>" }, text: "This week: Rust", links: [], hasAttachments: false,
};

function rule(id: string, when: Rule["when"], extra: Partial<Rule> = {}): Rule {
  return { id, source: "user", when, then: { kind: "digest" }, priority: 0, status: "active", ...extra };
}
const fromSub = [{ field: "from", operator: "endsWith", value: "@Substack.com" }] as Rule["when"];

describe("matchRules", () => {
  it("matches when every condition holds, ignoring case", () => {
    const r = rule("a", [...fromSub, { field: "subject", operator: "contains", value: "rust" }]);
    expect(matchRules(email, [r], now)).toBe(r);
  });
  it("fails when one condition does not hold", () => {
    const r = rule("a", [...fromSub, { field: "subject", operator: "contains", value: "python" }]);
    expect(matchRules(email, [r], now)).toBeUndefined();
  });
  it("matches sender name, body, category and list id", () => {
    const r = rule("a", [
      { field: "from", operator: "is", value: "weekly byte" },
      { field: "body", operator: "contains", value: "THIS WEEK" },
      { field: "category", operator: "is", value: "newsletter" },
      { field: "listId", operator: "contains", value: "byte.substack" },
    ]);
    expect(matchRules(email, [r], now, "newsletter")).toBe(r);
    expect(matchRules(email, [r], now)).toBeUndefined();
  });
  it("ignores proposed, disabled and expired rules", () => {
    const rules = [
      rule("p", fromSub, { status: "proposed" }),
      rule("d", fromSub, { status: "disabled" }),
      rule("x", fromSub, { expiresAt: "2026-11-21T07:59:59Z" }),
    ];
    expect(matchRules(email, rules, now)).toBeUndefined();
    const live = rule("l", fromSub, { expiresAt: "2026-11-22T00:00:00Z" });
    expect(matchRules(email, [...rules, live], now)).toBe(live);
  });
  it("prefers priority, then user > feed > ai, then list order", () => {
    const low = rule("low", fromSub, { priority: 1 });
    const high = rule("high", fromSub, { priority: 5, source: "ai" });
    expect(matchRules(email, [low, high], now)).toBe(high);
    const ai = rule("ai", fromSub, { source: "ai" });
    const feed = rule("feed", fromSub, { source: "feed" });
    const user = rule("user", fromSub);
    expect(matchRules(email, [ai, feed, user], now)).toBe(user);
    expect(matchRules(email, [ai, feed], now)).toBe(feed);
    const user2 = rule("user2", fromSub);
    expect(matchRules(email, [user, user2], now)).toBe(user);
  });
});
