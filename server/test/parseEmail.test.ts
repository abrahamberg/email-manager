import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEmail } from "../src/mail/parseEmail.js";

const load = (n: string) => parseEmail(1, readFileSync(new URL(`./fixtures/${n}.eml`, import.meta.url)));

describe("parseEmail fixtures", () => {
  it.each([
    ["newsletter-with-list-unsubscribe", "<nl-1@digest.example>", 2],
    ["job-alert", "<job-1@linkedin.example>", 8],
    ["receipt", "<rcpt-1@store.example>", 1],
    ["html-only", "<html-1@shop.example>", 1],
    ["spoofed-sender", "<spoof-1@mail.evil.example>", 1],
    ["school-parents-group", "<sch-1@school.example>", 1],
    ["spam-like", "<spam-1@lottery-win.example>", 1],
    ["with-attachment", "<att-1@partner.example>", 0],
  ])("%s: id, thread root, link count", async (name, id, links) => {
    const e = await load(name);
    expect(e.messageId).toBe(id);
    expect(e.threadId).toBe(id);
    expect(e.links).toHaveLength(links);
    expect(e.date).toMatch(/^\d{4}-/);
  });

  it("uses first References id as thread", async () => {
    const e = await load("meeting-invite");
    expect(e.threadId).toBe("<inv-1@work.example>");
    expect(e.cc[0]!.address).toBe("team@work.example");
    expect(e.links).toEqual(["https://meet.work.example/planning"]);
  });

  it("lower-cases headers", async () => {
    const e = await load("newsletter-with-list-unsubscribe");
    expect(e.headers["list-unsubscribe"]).toContain("https://digest.example/unsub");
    expect(e.headers["precedence"]).toBe("bulk");
  });

  it("keeps auth results and reply-to", async () => {
    const e = await load("spoofed-sender");
    expect(e.headers["authentication-results"]).toMatch(/spf=fail.*dkim=fail.*dmarc=fail/);
    expect(e.replyTo?.address).toBe("help@scam.example");
  });

  it("converts html-only to text", async () => {
    const e = await load("html-only");
    expect(e.text).toContain("Hello");
    expect(e.text).not.toContain("<p>");
  });

  it("decodes latin1", async () => {
    const e = await load("latin1-encoded");
    expect(e.subject).toBe("Café demain ?");
    expect(e.from.name).toBe("André Dupont");
    expect(e.text).toContain("café à 8h, ça va");
  });

  it("flags attachments", async () => {
    expect((await load("with-attachment")).hasAttachments).toBe(true);
    expect((await load("receipt")).hasAttachments).toBe(false);
  });

  it("keeps injection text as plain data", async () => {
    const e = await load("prompt-injection");
    expect(e.text).toContain("attacker@evil.example");
    expect(e.to.map((a) => a.address)).toEqual(["me@example.com"]);
  });
});

describe("parseEmail edge cases", () => {
  const raw = (s: string) => new TextEncoder().encode(s.replace(/\n/g, "\r\n"));

  it("generates a stable message id when missing", async () => {
    const src = raw("From: a@example.com\nSubject: Hi\nDate: Mon, 03 Nov 2025 08:00:00 +0000\n\nbody");
    const a = await parseEmail(1, src);
    const b = await parseEmail(2, src);
    expect(a.messageId).toBe(b.messageId);
    expect(a.messageId).toMatch(/^<generated-[0-9a-f]{32}@/);
  });

  it("falls back to In-Reply-To then caps text", async () => {
    const src = raw(`From: a@example.com\nMessage-ID: <x@example.com>\nIn-Reply-To: <p@example.com>\nContent-Type: text/plain\n\n${"a".repeat(30000)}`);
    const e = await parseEmail(1, src);
    expect(e.threadId).toBe("<p@example.com>");
    expect(e.text).toHaveLength(20000);
  });

  it("caps links at 50 and joins repeated headers", async () => {
    const urls = Array.from({ length: 60 }, (_, i) => `https://example.com/${i}`).join(" ");
    const src = raw(`From: a@example.com\nMessage-ID: <y@example.com>\nReceived: one\nReceived: two\nContent-Type: text/plain\n\n${urls}`);
    const e = await parseEmail(1, src);
    expect(e.links).toHaveLength(50);
    expect(e.headers["received"]).toBe("one\ntwo");
  });
});
