import { z } from "zod";
import type { CompactEmail } from "../ports";
import { type Budget, type TokenUsage, NO_USAGE, estimateCost } from "./budget";
import { userTurn } from "./untrusted";

/** What every model provider is asked: no tools, one user turn, JSON matching `jsonSchema`. */
export interface ModelRequest {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}

export interface ModelReply {
  text: string;
  stop: "end" | "truncated" | "refusal";
  usage: TokenUsage;
}

export type Send = (request: ModelRequest) => Promise<ModelReply>;

/** Thrown by a Send adapter when the provider answers with an HTTP error. */
export class ModelApiError extends Error {
  constructor(readonly status: number) {
    super(`model API status ${status}`);
  }
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

function request<S extends z.ZodType>(input: CallInput<S>): ModelRequest {
  return {
    model: input.model,
    system: input.system,
    user: userTurn(input.user.task, input.user.email),
    maxTokens: input.maxTokens,
    schemaName: "result",
    jsonSchema: z.toJSONSchema(input.schema) as Record<string, unknown>,
  };
}

function parseOutput<S extends z.ZodType>(text: string, schema: S): { value: z.infer<S> } | undefined {
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

  let reply: ModelReply;
  try {
    reply = await input.send(request(input));
  } catch (error) {
    const detail = error instanceof ModelApiError ? `status ${error.status}` : "request failed";
    return { ok: false, reason: "api_error", detail, usage: NO_USAGE, costUsd: 0 };
  }

  const costUsd = estimateCost(input.model, reply.usage);
  input.budget.record(costUsd);
  const spend = { usage: reply.usage, costUsd };

  if (reply.stop !== "end") return { ok: false, reason: reply.stop, ...spend };
  const parsed = parseOutput(reply.text, input.schema);
  if (!parsed) return { ok: false, reason: "invalid_output", ...spend };
  return { ok: true, value: parsed.value, ...spend };
}
