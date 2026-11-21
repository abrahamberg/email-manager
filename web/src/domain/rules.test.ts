import { describe, expect, it } from "vitest";
import type { EmailRef } from "./types";
import { describeRule, isComplete, ruleMatches } from "./rules";

const email: EmailRef = {
  id: "e1",
  from: { name: "Weekly Byte", address: "byte@substack.com" },
  subject: "Issue #212: Rust in the kernel",
  receivedAt: "2026-11-21T07:00:00Z",
  snippet: "This week: Rust",
  category: "newsletter",
};

describe("ruleMatches", () => {
  it("matches when every condition holds, ignoring case", () => {
    expect(ruleMatches([
      { field: "from", operator: "endsWith", value: "@Substack.com" },
      { field: "subject", operator: "contains", value: "rust" },
    ], email)).toBe(true);
  });

  it("fails when one condition does not hold", () => {
    expect(ruleMatches([
      { field: "from", operator: "endsWith", value: "@substack.com" },
      { field: "subject", operator: "contains", value: "python" },
    ], email)).toBe(false);
  });

  it("never matches without conditions", () => {
    expect(ruleMatches([], email)).toBe(false);
  });
});

describe("isComplete", () => {
  it("needs a value in every condition", () => {
    expect(isComplete([{ field: "from", operator: "is", value: " " }])).toBe(false);
  });
});

describe("describeRule", () => {
  it("writes the rule as a plain sentence", () => {
    expect(describeRule([{ field: "from", operator: "endsWith", value: "@substack.com" }], { kind: "label", label: "Reading" }))
      .toBe("When sender ends with “@substack.com”: label it “Reading” and archive");
  });
});
