import type { Email } from "../mail/Email";
import type { SenderStats } from "../ports";
import { bulkSignals } from "./bulkHeaders";
import { isNearDuplicate, simhash, words } from "./simhash";

export interface LowValueVerdict {
  lowValue: boolean;
  reason: string;
}

/** Short texts hash alike by chance, so they never count as repeats. */
const MIN_WORDS_FOR_DUPLICATE = 8;

const keep = (reason: string): LowValueVerdict => ({ lowValue: false, reason });
const low = (reason: string): LowValueVerdict => ({ lowValue: true, reason });

function isRepeat(email: Email, recentHashes: bigint[]): boolean {
  if (words(email.text).length < MIN_WORDS_FOR_DUPLICATE) return false;
  const hash = simhash(email.text);
  return recentHashes.some((h) => isNearDuplicate(hash, h));
}

export function isLowValue(
  email: Email,
  sender: SenderStats | undefined,
  recentHashes: bigint[],
): LowValueVerdict {
  if ((sender?.repliedTo ?? 0) > 0) return keep("You have replied to this sender before.");

  const bulk = bulkSignals(email);
  if (bulk.isBulk) {
    return low(`Bulk mail (${bulk.reasons.join(", ")}) from a sender you never reply to.`);
  }
  if (isRepeat(email, recentHashes)) return low("Nearly identical to a recent message from this sender.");
  return keep("Looks like personal mail.");
}
