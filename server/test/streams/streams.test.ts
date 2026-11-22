import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { dailyBudget } from "../../src/ai/budget";
import type { ModelReply, Send } from "../../src/ai/client";
import { parseEmail } from "../../src/mail/parseEmail";
import type { Embedder } from "../../src/ports";
import { detectStream } from "../../src/streams/detectStream";
import { matchInterests } from "../../src/streams/matchInterests";
import { aiExtract } from "../../src/streams/parsers/aiExtract";
import { parseJobAlert } from "../../src/streams/parsers/jobAlert";
import { splitItems } from "../../src/streams/splitItems";

const load = (n: string) => parseEmail(1, readFileSync(new URL(`../fixtures/${n}.eml`, import.meta.url)));
const budget = () => dailyBudget({ limitUsd: 1, spentToday: async () => 0 });

const recorded = (items: unknown[]): ModelReply => ({
  text: JSON.stringify({ items }),
  stop: "end",
  usage: { inputTokens: 300, outputTokens: 80, cacheWriteTokens: 0, cacheReadTokens: 0 },
});

describe("detectStream", () => {
  it("needs a bulk list/noreply sender and 3 messages", async () => {
    const job = await load("job-alert");
    expect(detectStream(job, { messages: 2 })).toBeUndefined();
    expect(detectStream(job, { messages: 3 })).toEqual({ streamKey: "jobs-noreply@linkedin.example", name: "LinkedIn Jobs" });
    const nl = await load("newsletter-with-list-unsubscribe");
    expect(detectStream(nl, { messages: 9 })).toBeUndefined();
    const listed = { ...nl, headers: { ...nl.headers, "list-id": "Digest <digest.example>" } };
    expect(detectStream(listed, { messages: 3 })?.streamKey).toBe("digest.example");
  });
});

describe("splitItems", () => {
  it("parses the job alert without calling the model", async () => {
    const extract = vi.fn(async () => []);
    const items = await splitItems(await load("job-alert"), extract);
    expect(extract).not.toHaveBeenCalled();
    expect(items).toHaveLength(8);
    expect(items[0]).toMatchObject({ title: "Engineer at Acme", url: "https://jobs.linkedin.example/view/1" });
    expect(items.every((i) => i.facts.length <= 3)).toBe(true);
  });

  it("reads place and tech from the lines after a job", async () => {
    const e = { ...(await load("job-alert")), links: [], text: "Frontend dev at Acme\nStockholm, Sweden\nReact TypeScript\nSRE at Beta\nRemote" };
    expect(parseJobAlert(e)).toEqual([
      { title: "Frontend dev at Acme", facts: ["Acme", "Stockholm, Sweden", "react"] },
      { title: "SRE at Beta", facts: ["Beta", "Remote"] },
    ]);
  });

  it("falls back to the extractor for other mail", async () => {
    const extract = vi.fn(async () => [{ title: "A", facts: [] }]);
    expect(await splitItems(await load("newsletter-with-list-unsubscribe"), extract)).toEqual([{ title: "A", facts: [] }]);
  });
});

describe("aiExtract", () => {
  const run = async (message: ModelReply) => {
    const send = vi.fn<Send>(async () => message);
    const items = await aiExtract(await load("newsletter-with-list-unsubscribe"), { send, budget: budget(), model: "m" });
    return { send, items };
  };

  it("validates, caps items and facts, wraps the email as untrusted", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ title: `T${i}`, facts: ["a", "b", "c", "d"], closes: "2026-12-01" }));
    const { send, items } = await run(recorded(many));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].user).toContain("<untrusted_email>");
    expect(items).toHaveLength(20);
    expect(items[0]).toEqual({ title: "T0", facts: ["a", "b", "c"], closes: "2026-12-01" });
  });

  it("returns nothing on invalid output", async () => {
    expect((await run(recorded([{ nope: 1 }]))).items).toEqual([]);
  });
});

describe("matchInterests", () => {
  const axes: Record<string, number[]> = { frontend: [1, 0, 0], crypto: [0, 1, 0], backend: [0, 0, 1] };
  const embedder: Embedder = {
    embed: async (texts) => texts.map((t) => {
      const v = [0, 0, 0];
      for (const [k, a] of Object.entries(axes)) if (t.toLowerCase().includes(k)) a.forEach((x, i) => (v[i]! += x));
      return v.some(Boolean) ? v : [0.1, 0.1, 0.1];
    }),
  };
  const interest = (liked: string[] = [], disliked: string[] = []) => ({ areaId: "job", text: "backend roles", feedback: { liked, disliked } });
  const items = [
    { title: "Backend at Acme", facts: ["Stockholm"] },
    { title: "Frontend at Beta", facts: ["react"] },
    { title: "Crypto frontend at Gamma", facts: [] },
    { title: "Crypto exchange", facts: [] },
  ];

  it("picks above threshold with area and interest text, summarises the rest", async () => {
    const r = await matchInterests(items, [interest()], embedder);
    expect(r.picks).toHaveLength(1);
    expect(r.picks[0]).toMatchObject({ areaId: "job", interest: "backend roles", item: items[0] });
    expect(r.picks[0]!.score).toBeCloseTo(1);
    expect(r.rest).toMatch(/^mostly crypto/);
  });

  it("feedback shifts the score", async () => {
    const liked = await matchInterests(items, [interest(["frontend like"])], embedder);
    const disliked = await matchInterests(items, [interest([], ["backend dislike"])], embedder);
    expect(liked.picks[0]!.score).toBeCloseTo(1);
    expect(disliked.picks[0]!.score).toBeCloseTo(1 - 0.15);
  });

  it("caps picks at five", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ title: `Backend ${i}`, facts: [] }));
    expect((await matchInterests(many, [interest()], embedder)).picks).toHaveLength(5);
  });
});
