import { describe, expect, it } from "vitest";
import { dailyBudget, estimateCost } from "../../src/ai/budget";
import { aiModels } from "../../src/ai/models";

describe("dailyBudget", () => {
  it("seeds from spentToday and refuses once the limit is reached", async () => {
    const b = dailyBudget({ limitUsd: 0.5, spentToday: async () => 0.4 });
    expect(await b.allows()).toBe(true);
    b.record(0.1);
    expect(await b.allows()).toBe(false);
  });

  it("reseeds on a new day", async () => {
    let now = new Date("2026-11-20T23:59:00Z");
    let seeded = 0;
    const b = dailyBudget({ limitUsd: 1, spentToday: async () => (seeded++ === 0 ? 1 : 0), now: () => now });
    expect(await b.allows()).toBe(false);
    now = new Date("2026-11-21T00:01:00Z");
    expect(await b.allows()).toBe(true);
  });
});

describe("estimateCost", () => {
  it("prices unknown models at the dearest rate", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
    expect(estimateCost("unknown-model", usage)).toBeGreaterThan(estimateCost(aiModels({}).draft, usage));
  });
});
