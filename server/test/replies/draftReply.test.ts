import { describe, expect, it } from "vitest";
import { CLOSE_TAG, OPEN_TAG } from "../../src/ai/untrusted";
import { aiDrafter } from "../../src/replies/draftReply";
import { DRAFT_SYSTEM } from "../../src/replies/prompts";
import type { CompactEmail } from "../../src/ports";
import { budget, replying } from "./helpers";

const email: CompactEmail = { from: "Anna <anna@friends.example>", subject: "Tuesday?", date: "2026-11-20T09:00:00Z", text: "Does Tuesday at 10 work?" };
const context = { userName: "Sam", areaNote: "Prefer mornings" };
const draft = (send: ReturnType<typeof replying>, b = budget()) => aiDrafter({ send, budget: b, model: "draft-model" }).draftReply(email, context);

describe("aiDrafter", () => {
  it("returns text, topic and clamped confidence", async () => {
    const send = replying({ text: " Tuesday at 10 works. ", topic: "confirmAppointment", confidence: 1.4 });
    expect(await draft(send)).toEqual({ text: "Tuesday at 10 works.", topic: "confirmAppointment", confidence: 1 });
  });

  it("puts the rules in the system prompt and the email inside the untrusted block", async () => {
    const send = replying({ text: "Ok", topic: "acknowledge", confidence: 0.5 });
    await draft(send);
    const params = send.mock.calls[0]![0];
    expect((params.system as { text: string }[])[0]!.text).toBe(DRAFT_SYSTEM);
    const user = params.messages[0]!.content as string;
    expect(user.indexOf("Prefer mornings")).toBeLessThan(user.indexOf(OPEN_TAG));
    expect(user).toContain(CLOSE_TAG);
    expect(params.tools).toBeUndefined();
  });

  it.each([
    ["invalid json", replying("not json")],
    ["schema mismatch", replying({ text: "x", topic: "wireMoney", confidence: 1 })],
    ["empty text", replying({ text: "  ", topic: "acknowledge", confidence: 1 })],
    ["truncated", replying({ text: "x", topic: "acknowledge", confidence: 1 }, "max_tokens")],
    ["refusal", replying({ text: "x", topic: "acknowledge", confidence: 1 }, "refusal")],
  ])("returns undefined on %s", async (_, send) => {
    expect(await draft(send)).toBeUndefined();
  });

  it("returns undefined when the API throws or the budget is spent", async () => {
    const failing = replying({});
    failing.mockRejectedValueOnce(new Error("down"));
    expect(await draft(failing)).toBeUndefined();
    const unused = replying({ text: "x", topic: "acknowledge", confidence: 1 });
    expect(await draft(unused, budget(0))).toBeUndefined();
    expect(unused).not.toHaveBeenCalled();
  });
});
