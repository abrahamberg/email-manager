import { z } from "zod";
import { ModelApiError, type ModelReply, type ModelRequest, type Send } from "./client";

const API_URL = "https://api.openai.com/v1/responses";

const contentPart = z.object({ type: z.string(), text: z.string().optional(), refusal: z.string().optional() });

const responseSchema = z.object({
  status: z.string(),
  incomplete_details: z.object({ reason: z.string().optional() }).nullish(),
  output: z.array(z.object({ type: z.string(), content: z.array(contentPart).optional() })),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    input_tokens_details: z.object({ cached_tokens: z.number().optional() }).nullish(),
  }),
});

type OpenAiResponse = z.infer<typeof responseSchema>;

function body(req: ModelRequest) {
  return {
    model: req.model,
    instructions: req.system,
    input: [{ role: "user", content: req.user }],
    max_output_tokens: req.maxTokens,
    // Classification and short drafts need no thinking; reasoning tokens would eat the output cap.
    reasoning: { effort: "none" },
    store: false,
    text: { format: { type: "json_schema", name: req.schemaName, schema: req.jsonSchema, strict: false } },
  };
}

const parts = (r: OpenAiResponse) => r.output.flatMap((o) => (o.type === "message" ? o.content ?? [] : []));

function stopOf(r: OpenAiResponse): ModelReply["stop"] {
  if (parts(r).some((p) => p.type === "refusal")) return "refusal";
  if (r.status === "incomplete") return r.incomplete_details?.reason === "content_filter" ? "refusal" : "truncated";
  return "end";
}

export function toReply(r: OpenAiResponse): ModelReply {
  const cached = r.usage.input_tokens_details?.cached_tokens ?? 0;
  return {
    text: parts(r).flatMap((p) => (p.type === "output_text" && p.text ? [p.text] : [])).join(""),
    stop: stopOf(r),
    usage: {
      inputTokens: r.usage.input_tokens - cached,
      outputTokens: r.usage.output_tokens,
      cacheWriteTokens: 0,
      cacheReadTokens: cached,
    },
  };
}

/** The OpenAI Responses API behind the provider-neutral Send. */
export function openaiSend(apiKey: string, fetchFn: typeof fetch = fetch): Send {
  return async (req) => {
    const res = await fetchFn(API_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body(req)),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new ModelApiError(res.status);
    return toReply(responseSchema.parse(await res.json()));
  };
}
