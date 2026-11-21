import type { Email } from "../mail/Email";
import type { Classifier, CompactEmail } from "../ports";
import { keepInInbox, type Decision } from "./outcomes";

const MAX_TEXT_CHARS = 4000;

export function compactEmail(email: Email): CompactEmail {
  return { from: email.from.address, subject: email.subject, date: email.date, text: email.text.slice(0, MAX_TEXT_CHARS) };
}

/**
 * Phase 2 hook: the only place the model is asked. For now the triage is
 * recorded as the reason and the message stays in the inbox.
 */
export async function triageWithAi(email: Email, classifier: Classifier): Promise<Decision> {
  const triage = await classifier.triage(compactEmail(email), { areas: [] });
  return keepInInbox("ai", triage.why, triage.confidence);
}
