import type { ReplyPolicy, ReplyTopic } from "@email-manager/shared";
import type { SenderStats } from "../ports";

export type ReplyDecision = "send" | "draft" | "none";

export interface ReplyPolicyInput {
  draft?: { text: string; topic: ReplyTopic; confidence: number };
  senderAddress: string;
  sender?: SenderStats;
  policy: ReplyPolicy;
  /** Off in v1: Settings has no switch yet, so callers pass false until one exists. */
  autoSendEnabled: boolean;
  confidenceThreshold: number;
  sentToday: number;
  dailySendCap: number;
}

// Deliberately broad: anything that looks like a domain sends the reply to drafts.
const URL_RE = /[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/i;
const EMAIL_RE = /[^\s<>()"',;:]+@[^\s<>()"',;:]+\.[a-z]{2,}/gi;
const ATTACHMENT_RE = /\b(attach(?:ed|ment|ments|ing)?|enclosed|bifogad|bilaga)\b/i;

const lower = (s: string) => s.trim().toLowerCase();

export function hasUrl(text: string): boolean {
  return URL_RE.test(text.replace(EMAIL_RE, ""));
}

export function mentionsOtherAddress(text: string, sender: string): boolean {
  return (text.match(EMAIL_RE) ?? []).some((a) => lower(a) !== lower(sender));
}

export const mentionsAttachment = (text: string) => ATTACHMENT_RE.test(text);

function blocked(policy: ReplyPolicy, address: string): boolean {
  const a = lower(address);
  return policy.neverAutoReplyTo.some((p) => {
    const q = lower(p);
    return q === a || (q.startsWith("@") ? a.endsWith(q) : a.endsWith(`@${q}`));
  });
}

function safeContent(text: string, sender: string): boolean {
  return !hasUrl(text) && !mentionsOtherAddress(text, sender) && !mentionsAttachment(text);
}

/** Pure. "send" only when every guard holds; anything doubtful is a draft for the user to review. */
export function replyPolicy(input: ReplyPolicyInput): ReplyDecision {
  const { draft, policy } = input;
  if (!draft) return "none";
  const mayAutoSend =
    input.autoSendEnabled &&
    policy.topics.includes(draft.topic) &&
    (input.sender?.repliedTo ?? 0) > 0 &&
    !blocked(policy, input.senderAddress) &&
    draft.confidence >= input.confidenceThreshold &&
    safeContent(draft.text, input.senderAddress) &&
    input.sentToday < input.dailySendCap;
  return mayAutoSend ? "send" : "draft";
}
