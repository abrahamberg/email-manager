import { vi } from "vitest";
import { dailyBudget } from "../../src/ai/budget";
import type { ModelReply, Send } from "../../src/ai/client";

export function modelReply(json: unknown, stop: ModelReply["stop"] = "end"): ModelReply {
  return {
    text: typeof json === "string" ? json : JSON.stringify(json),
    stop,
    usage: { inputTokens: 400, outputTokens: 60, cacheWriteTokens: 0, cacheReadTokens: 0 },
  };
}

export const replying = (json: unknown, stop?: ModelReply["stop"]) => vi.fn<Send>(async () => modelReply(json, stop));
export const budget = (limitUsd = 1) => dailyBudget({ limitUsd, spentToday: async () => 0 });
