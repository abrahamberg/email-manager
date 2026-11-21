import { describe, expect, it } from "vitest";
import type { Email } from "../src/mail/Email";
import type { SenderStats } from "../src/ports";
import { isLowValue } from "../src/lowValue/isLowValue";
import { simhash } from "../src/lowValue/simhash";

const text = "Your weekly report is ready. Visits were 120 this week and sales were 14 across all channels today.";

function mail(over: Partial<Email> = {}): Email {
  return {
    uid: 1,
    messageId: "<1@x>",
    threadId: "<1@x>",
    from: { address: "alice@example.com" },
    to: [{ address: "me@example.com" }],
    cc: [],
    subject: "Hello",
    date: "2026-01-01T00:00:00Z",
    headers: {},
    text: "Hi, can you send me the contract before Thursday? Thanks for your help with this.",
    links: [],
    hasAttachments: false,
    ...over,
  };
}

const stats = (repliedTo: number): SenderStats => ({ address: "alice@example.com", received: 5, repliedTo, opened: 0 });
const newsletter = { "list-unsubscribe": "<mailto:u@x.com>" };

describe("isLowValue", () => {
  const rows: [string, Email, SenderStats | undefined, bigint[], boolean][] = [
    ["bulk, unknown sender", mail({ headers: newsletter }), undefined, [], true],
    ["bulk, never replied", mail({ headers: newsletter }), stats(0), [], true],
    ["bulk, replied before", mail({ headers: newsletter }), stats(2), [], false],
    ["noreply sender", mail({ from: { address: "noreply@x.com" } }), stats(0), [], true],
    ["personal mail", mail(), stats(0), [], false],
    ["personal mail, no history", mail(), undefined, [], false],
    ["near-duplicate", mail({ text }), stats(0), [simhash(text.replace("120", "77"))], true],
    ["duplicate but replied before", mail({ text }), stats(1), [simhash(text)], false],
    ["different text", mail({ text }), stats(0), [simhash(mail().text)], false],
    ["short text is never a repeat", mail({ text: "ok thanks" }), stats(0), [simhash("ok thanks")], false],
  ];

  it.each(rows)("%s", (_n, email, sender, hashes, expected) => {
    const v = isLowValue(email, sender, hashes);
    expect(v.lowValue).toBe(expected);
    expect(v.reason.length).toBeGreaterThan(0);
  });
});
