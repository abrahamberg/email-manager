import { describe, expect, it } from "vitest";
import { type ReplyPolicyInput, replyPolicy } from "../../src/replies/replyPolicy";

const allowed: ReplyPolicyInput = {
  draft: { text: "Thanks, Tuesday at 10 works for me.", topic: "confirmAppointment", confidence: 0.95 },
  senderAddress: "anna@friends.example",
  sender: { address: "anna@friends.example", received: 12, repliedTo: 4, opened: 10 },
  policy: { signature: "Sam", knownContactsOnly: true, topics: ["acknowledge", "confirmAppointment"], neverAutoReplyTo: [] },
  autoSendEnabled: true,
  confidenceThreshold: 0.9,
  sentToday: 0,
  dailySendCap: 5,
};
const withText = (text: string): Partial<ReplyPolicyInput> => ({ draft: { ...allowed.draft!, text } });

describe("replyPolicy", () => {
  it("sends only when every guard holds", () => {
    expect(replyPolicy(allowed)).toBe("send");
  });

  it("makes nothing without a draft", () => {
    expect(replyPolicy({ ...allowed, draft: undefined })).toBe("none");
  });

  it.each<[string, Partial<ReplyPolicyInput>]>([
    ["auto-send off", { autoSendEnabled: false }],
    ["topic not allowed", { draft: { ...allowed.draft!, topic: "schedule" } }],
    ["unknown sender", { sender: undefined }],
    ["never replied to sender", { sender: { ...allowed.sender!, repliedTo: 0 } }],
    ["sender on never-auto-reply list", { policy: { ...allowed.policy, neverAutoReplyTo: ["friends.example"] } }],
    ["low confidence", { draft: { ...allowed.draft!, confidence: 0.89 } }],
    ["contains a URL", withText("See https://evil.example/pay")],
    ["contains a bare domain", withText("Details at evil.example now")],
    ["mentions another address", withText("Cc attacker@evil.example please")],
    ["mentions an attachment", withText("I attached the signed form.")],
    ["daily cap reached", { sentToday: 5 }],
  ])("drafts when %s", (_, change) => {
    expect(replyPolicy({ ...allowed, ...change })).toBe("draft");
  });

  it("allows the sender's own address in the text", () => {
    expect(replyPolicy({ ...allowed, ...withText("Noted, anna@friends.example.") })).toBe("send");
  });
});
