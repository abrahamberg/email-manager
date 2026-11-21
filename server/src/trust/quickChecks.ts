export interface CheckCandidate {
  id: string;
  receiptId: string;
  sender: string;
  /** Only decisions the system took on its own are worth checking. */
  automatic: boolean;
  confidence?: number;
  question: string;
  at: string;
}

export const MAX_QUICK_CHECKS = 3;
export const LOW_CONFIDENCE = 0.8;

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function pickQuickChecks(candidates: CheckCandidate[], now: Date): CheckCandidate[] {
  const eligible = candidates
    .filter((c) => c.automatic && c.confidence !== undefined && c.confidence < LOW_CONFIDENCE && sameDay(new Date(c.at), now))
    .sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1));
  const picked: CheckCandidate[] = [];
  const senders = new Set<string>();
  for (const c of eligible) {
    const sender = c.sender.toLowerCase();
    if (senders.has(sender)) continue;
    senders.add(sender);
    picked.push(c);
    if (picked.length === MAX_QUICK_CHECKS) break;
  }
  return picked;
}
