import { z } from "zod";
import type { ReplyTopic } from "@email-manager/shared";
import type { Draft, Drafter } from "../ports";
import type { Budget } from "../ai/budget";
import { type Send, structuredCall } from "../ai/client";
import { DRAFT_SYSTEM, REPLY_TOPICS, draftTask } from "./prompts";

export const draftSchema = z.object({
  text: z.string(),
  confidence: z.number(),
  topic: z.enum(REPLY_TOPICS),
});

export interface ReplyDraft extends Draft {
  topic: ReplyTopic;
}

export interface DraftContext {
  userName: string;
  areaNote?: string;
}


export interface DrafterDeps {
  send: Send;
  budget: Budget;
  model: string;
}

const MAX_TOKENS = 800;
const MAX_TEXT = 2000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function aiDrafter({ send, budget, model }: DrafterDeps): Drafter {
  return {
    async draftReply(email, context) {
      const result = await structuredCall({
        model,
        system: DRAFT_SYSTEM,
        user: { task: draftTask(context), email },
        schema: draftSchema,
        maxTokens: MAX_TOKENS,
        budget,
        send,
      });
      if (!result.ok) return undefined;
      const text = result.value.text.trim().slice(0, MAX_TEXT);
      if (!text) return undefined;
      return { text, topic: result.value.topic, confidence: clamp01(result.value.confidence) };
    },
  };
}
