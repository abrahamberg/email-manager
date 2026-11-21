import type { Email } from "../mail/Email";
import type { CompactEmail, Mailbox, SenderStats, Triage } from "../ports";
import { buildDraft } from "../replies/buildDraft";
import { replyPolicy } from "../replies/replyPolicy";
import type { LifeRun } from "./lifeDeps";

/** Below this the policy never sends, whatever else holds. */
export const SEND_CONFIDENCE = 0.85;

export interface DraftDeps {
  life: LifeRun;
  mailbox: Mailbox;
  sender: SenderStats | undefined;
  dryRun: boolean;
  now: Date;
}

/** Drafts only: v1 never sends, so the policy's answer is at most "draft". */
export async function draftIfNeeded(email: Email, compact: CompactEmail, triage: Triage, deps: DraftDeps) {
  const { life } = deps;
  if (!triage.needsReply || !life.drafter) return undefined;
  const area = triage.areaId ? (await life.areas()).find((a) => a.id === triage.areaId) : undefined;
  const draft = await life.drafter.draftReply(compact, { userName: life.user.name, areaNote: area?.note });
  const settings = await life.settings();
  const verdict = replyPolicy({
    draft, senderAddress: email.from.address, sender: deps.sender, policy: settings.replies,
    autoSendEnabled: false, confidenceThreshold: SEND_CONFIDENCE, sentToday: 0, dailySendCap: settings.dailySendCap,
  });
  if (!draft || verdict === "none") return undefined;
  const rfc822 = buildDraft(email, draft, life.user.address, deps.now);
  if (rfc822 && !deps.dryRun) await deps.mailbox.appendDraft(rfc822);
  return { text: draft.text, confidence: draft.confidence };
}
