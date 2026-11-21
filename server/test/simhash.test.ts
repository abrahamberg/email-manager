import { describe, expect, it } from "vitest";
import { hammingDistance, isNearDuplicate, simhash } from "../src/lowValue/simhash";

const report = "Your weekly report is ready. Visits were 120 this week and sales were 14 across all channels today.";

describe("simhash", () => {
  it.each([
    ["identical", report, report, true],
    ["only numbers differ", report, report.replace("120", "987").replace("14", "55"), true],
    ["unrelated", report, "Hi, are we still meeting for lunch on Thursday to discuss the contract renewal terms?", false],
  ])("%s", (_n, a, b, expected) => {
    expect(isNearDuplicate(simhash(a), simhash(b))).toBe(expected);
  });

  it.each([
    [0n, 0n, 0],
    [0b1011n, 0b0001n, 2],
    [(1n << 64n) - 1n, 0n, 64],
  ])("hammingDistance(%s, %s) = %s", (a, b, d) => {
    expect(hammingDistance(a, b)).toBe(d);
  });

  it("honours maxDistance", () => {
    expect(isNearDuplicate(0n, 0b111n, 2)).toBe(false);
    expect(isNearDuplicate(0n, 0b111n, 3)).toBe(true);
  });

  it("fits in 64 bits", () => {
    expect(simhash(report) < 1n << 64n).toBe(true);
  });
});
