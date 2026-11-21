import type { Email } from "../mail/Email";
import type { SpamCheck } from "../ports";
import { looksSpoofed, parseAuthResults } from "./authResults";

export interface SpamDecision {
  spam: boolean;
  reason: string;
  score?: number;
}

export async function isSpam(email: Email, raw: Uint8Array, spamCheck: SpamCheck): Promise<SpamDecision> {
  const verdict = await spamCheck.check(raw);
  if (verdict?.isSpam) {
    const top = verdict.symbols.slice(0, 3).join(", ");
    const score = Number(verdict.score.toFixed(1));
    return { spam: true, score, reason: `Rspamd score ${score}${top ? ` (${top})` : ""}` };
  }
  const score = verdict?.score;
  if (looksSpoofed(parseAuthResults(email.headers))) return { spam: true, reason: "DMARC failed", score };
  return { spam: false, reason: "No spam signals", score };
}
