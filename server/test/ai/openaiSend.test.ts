import { describe, expect, it, vi } from "vitest";
import { ModelApiError, type ModelRequest } from "../../src/ai/client";
import { openaiSend } from "../../src/ai/openaiSend";

const req: ModelRequest = {
  model: "gpt-6-luna", system: "Classify.", user: "<untrusted_email>x</untrusted_email>",
  maxTokens: 256, schemaName: "result", jsonSchema: { type: "object" },
};

const usage = { input_tokens: 1400, output_tokens: 50, input_tokens_details: { cached_tokens: 1000 } };
const message = (content: unknown[]) => ({ type: "message", content });

function respond(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe("openaiSend", () => {
  it("sends instructions apart from the user turn, no tools, json_schema format, not stored", async () => {
    const fetchFn = respond({ status: "completed", output: [message([{ type: "output_text", text: "{}" }])], usage });
    await openaiSend("sk-test", fetchFn)(req);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      model: "gpt-6-luna", instructions: "Classify.", max_output_tokens: 256, store: false,
      input: [{ role: "user", content: req.user }],
      text: { format: { type: "json_schema", name: "result", schema: { type: "object" } } },
    });
    expect(body.tools).toBeUndefined();
  });

  it.each([
    ["completed", { status: "completed", output: [{ type: "reasoning" }, message([{ type: "output_text", text: '{"a":1}' }])] }, "end", '{"a":1}'],
    ["truncated", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }, "truncated", ""],
    ["filtered", { status: "incomplete", incomplete_details: { reason: "content_filter" }, output: [] }, "refusal", ""],
    ["refusal", { status: "completed", output: [message([{ type: "refusal", refusal: "no" }])] }, "refusal", ""],
  ])("maps a %s response", async (_n, body, stop, text) => {
    const reply = await openaiSend("k", respond({ ...body, usage }))(req);
    expect(reply).toEqual({ text, stop, usage: { inputTokens: 400, outputTokens: 50, cacheWriteTokens: 0, cacheReadTokens: 1000 } });
  });

  it("throws ModelApiError with the status and nothing from the body", async () => {
    const err = await openaiSend("k", respond({ error: { message: "secret detail" } }, 429))(req).catch((e) => e);
    expect(err).toBeInstanceOf(ModelApiError);
    expect(err.status).toBe(429);
    expect(String(err.message)).not.toContain("secret");
  });

  it("rejects a malformed response body", async () => {
    await expect(openaiSend("k", respond({ nope: true }))(req)).rejects.toThrow();
  });
});
