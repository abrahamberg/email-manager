import { describe, expect, it } from "vitest";
import { isAllowed } from "../../src/http/auth";

const allowed = new Set(["me@example.com", "@qodoxo.com"]);

describe("isAllowed", () => {
  it.each([
    ["me@example.com", true],
    ["you@example.com", false],
    ["daniel@qodoxo.com", true],
    ["daniel@sub.qodoxo.com", false],
    ["daniel@qodoxo.com.evil.test", false],
    ["a@b@qodoxo.com", false],
    ["@qodoxo.com", false],
    ["qodoxo.com", false],
  ])("%s → %s", (email, expected) => {
    expect(isAllowed(allowed, email)).toBe(expected);
  });
});
