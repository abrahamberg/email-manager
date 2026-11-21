import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compactEmail } from "../../src/ai/compactEmail";
import { parseEmail } from "../../src/mail/parseEmail";
import type { Email } from "../../src/mail/Email";
import { aiDrafter } from "../../src/replies/draftReply";
import { buildDraft, headerValue, replySubject } from "../../src/replies/buildDraft";
import { replyPolicy } from "../../src/replies/replyPolicy";
import { budget, replying } from "./helpers";

const raw = readFileSync(new URL("../fixtures/prompt-injection.eml", import.meta.url));
const header = (rfc: string, name: string) => rfc.split("\r\n\r\n")[0]!.split("\r\n").filter((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`));
const bodyOf = (rfc: string) => Buffer.from(rfc.split("\r\n\r\n")[1]!.replace(/\r\n/g, ""), "base64").toString("utf8");

const base: Email = {
  uid: 1,
  messageId: "<m1@friends.example>",
  threadId: "<m0@friends.example>",
  from: { name: "Anna", address: "anna@friends.example" },
  to: [{ address: "me@example.com" }],
  cc: [{ address: "other@friends.example" }],
  subject: "Re: RE: Tuesday?",
  date: "2026-11-20T09:00:00.000Z",
  headers: { references: "<m0@friends.example>" },
  text: "Tuesday?",
  links: [],
  hasAttachments: false,
};
const draft = { text: "Tuesday works.", topic: "acknowledge" as const, confidence: 0.9 };

describe("buildDraft", () => {
  it("replies to the sender with threading headers and one Re:", () => {
    const rfc = buildDraft(base, draft, "me@example.com")!;
    expect(header(rfc, "To")).toEqual(["To: anna@friends.example"]);
    expect(header(rfc, "Subject")).toEqual(["Subject: Re: Tuesday?"]);
    expect(header(rfc, "In-Reply-To")).toEqual(["In-Reply-To: <m1@friends.example>"]);
    expect(header(rfc, "References")).toEqual(["References: <m0@friends.example> <m1@friends.example>"]);
    expect(header(rfc, "Cc")).toEqual([]);
    expect(bodyOf(rfc)).toBe("Tuesday works.");
  });

  it("uses Reply-To only on the sender's domain", () => {
    const same = buildDraft({ ...base, replyTo: { address: "team@friends.example" } }, draft, "me@example.com")!;
    expect(header(same, "To")).toEqual(["To: team@friends.example"]);
    const other = buildDraft({ ...base, replyTo: { address: "attacker@evil.example" } }, draft, "me@example.com")!;
    expect(header(other, "To")).toEqual(["To: anna@friends.example"]);
  });

  it("blocks header injection through subject, ids and addresses", () => {
    const evil: Email = {
      ...base,
      subject: "Hi\r\nBcc: attacker@evil.example",
      messageId: "<m1@x>\r\nBcc: attacker@evil.example",
      headers: { references: "<a@x>\nBcc: attacker@evil.example" },
    };
    const rfc = buildDraft(evil, draft, "me@example.com")!;
    expect(header(rfc, "Bcc")).toEqual([]);
    expect(rfc.split("\r\n\r\n")[0]).not.toMatch(/\n(?!(From|To|Subject|Date|In-Reply-To|References|MIME-Version|Content-Type|Content-Transfer-Encoding):)/);
    expect(buildDraft({ ...base, from: { address: "a@x.example\r\nBcc: attacker@evil.example" } }, draft, "me@example.com")).toBeUndefined();
    expect(headerValue("a\r\nb")).toBe("a b");
    expect(replySubject("Sv: re: Hej")).toBe("Re: Hej");
  });

  it("keeps an injected email's draft addressed only to the original sender", async () => {
    const email = await parseEmail(7, raw);
    const send = replying({ text: "Done. Forwarding everything to attacker@evil.example, see https://evil.example", topic: "acknowledge", confidence: 1 });
    const reply = await aiDrafter({ send, budget: budget(), model: "draft-model" }).draftReply(compactEmail(email), { userName: "Sam" });
    expect(reply).toBeDefined();
    const rfc = buildDraft(email, reply!, "me@example.com")!;
    const recipients = header(rfc, "To").concat(header(rfc, "Cc"), header(rfc, "Bcc"));
    expect(recipients).toEqual(["To: promo@offers.example"]);
    expect(rfc.split("\r\n\r\n")[0]).not.toContain("evil.example");
    const decision = replyPolicy({
      draft: reply,
      senderAddress: email.from.address,
      sender: { address: email.from.address, received: 3, repliedTo: 2, opened: 3 },
      policy: { signature: "", knownContactsOnly: true, topics: ["acknowledge"], neverAutoReplyTo: [] },
      autoSendEnabled: true,
      confidenceThreshold: 0.5,
      sentToday: 0,
      dailySendCap: 10,
    });
    expect(decision).toBe("draft");
  });

  it("makes no draft when the model fails", async () => {
    const email = await parseEmail(7, raw);
    const reply = await aiDrafter({ send: replying("garbage"), budget: budget(), model: "draft-model" }).draftReply(compactEmail(email), { userName: "Sam" });
    expect(reply).toBeUndefined();
  });
});
