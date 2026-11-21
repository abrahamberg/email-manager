import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { CompactEmail } from "../ports";
import { type Budget, type TokenUsage, NO_USAGE, estimateCost } from "./budget";
import { userTurn } from "./untrusted";

export type Send = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

export function anthropicSend(client: Anthropic = new Anthropic()): Send {
  return (params) => client.messages.create(params);
}

export interface CallInput<S extends z.ZodType> {
  model: string;
  system: string;
  /** Trusted instructions for this call; the email goes in as quoted data. */
  user: { task: string; email: CompactEmail };
  schema: S;
  maxTokens: number;
  budget: Budget;
  send: Send;
}

export type FailReason = "budget" | "api_error" | "refusal" | "truncated" | "invalid_output";

interface Spend {
  usage: TokenUsage;
  costUsd: number;
}

export type CallResult<T> = ({ ok: true; value: T } | { ok: false; reason: FailReason; detail?: string }) & Spend;

function usageOf(u: Anthropic.Usage): TokenUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
  };
}

function request<S extends z.ZodType>(input: CallInput<S>): Anthropic.MessageCreateParamsNonStreaming {
  const { type, schema } = zodOutputFormat(input.schema);
  return {
    model: input.model,
    max_tokens: input.maxTokens,
    // Sampling params are rejected by the current API version; low effort keeps output terse and cheap.
    output_config: { effort: "low", format: { type, schema } },
    system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userTurn(input.user.task, input.user.email) }],
  };
}

function parseOutput<S extends z.ZodType>(message: Anthropic.Message, schema: S): { value: z.infer<S> } | undefined {
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? { value: result.data } : undefined;
  } catch {
    return undefined;
  }
}

/** One structured model call. Never throws: any failure is `ok: false` and callers keep the email. */
export async function structuredCall<S extends z.ZodType>(input: CallInput<S>): Promise<CallResult<z.infer<S>>> {
  if (!(await input.budget.allows())) return { ok: false, reason: "budget", usage: NO_USAGE, costUsd: 0 };

  let message: Anthropic.Message;
  try {
    message = await input.send(request(input));
  } catch (error) {
    const detail = error instanceof Anthropic.APIError ? `status ${error.status}` : "request failed";
    return { ok: false, reason: "api_error", detail, usage: NO_USAGE, costUsd: 0 };
  }

  const usage = usageOf(message.usage);
  const costUsd = estimateCost(input.model, usage);
  input.budget.record(costUsd);
  const spend = { usage, costUsd };

  if (message.stop_reason === "refusal") return { ok: false, reason: "refusal", ...spend };
  if (message.stop_reason === "max_tokens") return { ok: false, reason: "truncated", ...spend };
  const parsed = parseOutput(message, input.schema);
  if (!parsed) return { ok: false, reason: "invalid_output", ...spend };
  return { ok: true, value: parsed.value, ...spend };
}
