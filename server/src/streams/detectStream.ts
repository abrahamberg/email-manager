import type { Email } from "../mail/Email";
import { bulkSignals } from "../lowValue/bulkHeaders";

export const MIN_MESSAGES = 3;

// Looser than the low-value check: "jobs-noreply" counts too.
const NOREPLY = /no-?reply/i;

export interface SenderStats {
  /** Messages seen from this sender, this one included. */
  messages: number;
}

export interface StreamId {
  streamKey: string;
  name: string;
}

/** A stream is a bulk sender with a list id or a noreply address that keeps writing. */
export function detectStream(
  email: Pick<Email, "headers" | "from">,
  senderStats: SenderStats,
): StreamId | undefined {
  if (senderStats.messages < MIN_MESSAGES) return undefined;
  const signals = bulkSignals(email);
  const noreply = NOREPLY.test(email.from.address.split("@")[0] ?? "");
  if (!signals.listId && !noreply) return undefined;
  const address = email.from.address.toLowerCase();
  return {
    streamKey: signals.listId ?? address,
    name: email.from.name?.trim() || signals.listId || address,
  };
}
