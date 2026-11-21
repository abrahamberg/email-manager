import { describe, expect, it } from "vitest";
import { Rule } from "../src/rules/Rule";

describe("Rule schema", () => {
  const valid = { id: "r1", source: "ai", when: [{ field: "from", operator: "endsWith", value: "@x.com" }], then: { kind: "digest" }, status: "proposed" };

  it("accepts a valid rule and defaults priority", () => {
    expect(Rule.parse(valid).priority).toBe(0);
  });

  it("rejects an action that would delete mail", () => {
    expect(Rule.safeParse({ ...valid, then: { kind: "delete" } }).success).toBe(false);
  });

  it("rejects a rule with no conditions", () => {
    expect(Rule.safeParse({ ...valid, when: [] }).success).toBe(false);
  });
});
