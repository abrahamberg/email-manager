import { describe, expect, it } from "vitest";
import { MAX_TEXT, compactEmail } from "../../src/ai/compactEmail";
import type { Email } from "../../src/mail/Email";

const mail = (text: string): Email => ({
  uid: 1,
  messageId: "<1@x>",
  threadId: "<1@x>",
  from: { name: "Alice", address: "alice@example.com" },
  to: [{ address: "me@example.com" }],
  cc: [],
  subject: "  Contract\n  question ",
  date: "2026-01-01T00:00:00Z",
  headers: { "x-secret": "no" },
  text,
  links: [],
  hasAttachments: false,
});

describe("compactEmail", () => {
  it("keeps from, subject and date", () => {
    expect(compactEmail(mail("Hi"))).toEqual({
      from: "Alice <alice@example.com>",
      subject: "Contract question",
      date: "2026-01-01T00:00:00Z",
      text: "Hi",
    });
  });

  it.each([
    ["quoted reply", "Can you sign it?\n\nOn Mon, Jan 1, 2026 at 9:00 Bob wrote:\n> old stuff", "Can you sign it?"],
    ["> lines", "Yes.\n> earlier\n> more", "Yes."],
    ["outlook block", "Done.\n________________\nFrom: Bob\nSent: Monday", "Done."],
    ["signature", "See you.\n-- \nAlice\n+1 555 0100", "See you."],
    ["mobile footer", "Ok\n\nSent from my iPhone", "Ok"],
    ["tracking link", "Read https://t.example.com/c/abc?utm_source=x&id=123 now", "Read [link: t.example.com] now"],
    ["invisible chars", "Hello​‌­ world", "Hello world"],
    ["whitespace", "a   b\t c\n\n\n\n\nd", "a b c\n\nd"],
  ])("strips %s", (_, text, expected) => {
    expect(compactEmail(mail(text)).text).toBe(expected);
  });

  it("caps the text length", () => {
    const text = compactEmail(mail("word ".repeat(2000))).text;
    expect(text.length).toBeLessThanOrEqual(MAX_TEXT);
    expect(text.endsWith("…")).toBe(true);
  });
});
