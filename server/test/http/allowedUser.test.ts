import { describe, expect, it } from "vitest";
import { isAllowed } from "../../src/http/auth";

const allowed = new Set(["me@example.com", "@example.org"]);

describe("isAllowed", () => {
  it.each([
    ["me@example.com", true],
    ["you@example.com", false],
    ["alex@example.org", true],
    ["alex@sub.example.org", false],
    ["alex@example.org.evil.test", false],
    ["a@b@example.org", false],
    ["@example.org", false],
    ["example.org", false],
  ])("%s → %s", (email, expected) => {
    expect(isAllowed(allowed, email)).toBe(expected);
  });
});
