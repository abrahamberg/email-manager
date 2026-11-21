import type Anthropic from "@anthropic-ai/sdk";
import { vi } from "vitest";
import { dailyBudget } from "../../src/ai/budget";
import type { Send } from "../../src/ai/client";

export function modelReply(json: unknown, stop: Anthropic.Message["stop_reason"] = "end_turn"): Anthropic.Message {
  return {
    id: "msg_fixture_draft",
    type: "message",
    role: "assistant",
    model: "draft-model",
    content: [{ type: "text", text: typeof json === "string" ? json : JSON.stringify(json), citations: null }],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 400, output_tokens: 60, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

export const replying = (json: unknown, stop?: Anthropic.Message["stop_reason"]) => vi.fn<Send>(async () => modelReply(json, stop));
export const budget = (limitUsd = 1) => dailyBudget({ limitUsd, spentToday: async () => 0 });
