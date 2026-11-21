import type { MailboxState } from "../ports";

/** How far back to look when the server reset its UIDs (UIDVALIDITY changed). */
export const RESYNC_WINDOW = 200;

/** The UID after which to fetch: fetchSince is exclusive. */
export function startAfter(state: MailboxState, cursor: MailboxState | undefined): number {
  if (cursor && cursor.uidValidity === state.uidValidity) return Math.max(0, cursor.uidNext - 1);
  return Math.max(0, state.uidNext - 1 - RESYNC_WINDOW);
}
