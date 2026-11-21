import { ReconnectNeededError } from "../mail/auth/tokenEndpoint.js";
import type { ReadOnlyMailbox } from "./readOnly.js";

export type FailureCode = "login_failed" | "reconnect_needed" | "unreachable";
export type ConnectionResult = { ok: true } | { ok: false; error: FailureCode };

/** Why: server error text can carry host details, so only a code leaves this function. */
export function failureCode(err: unknown): FailureCode {
  if (err instanceof ReconnectNeededError) return "reconnect_needed";
  if (typeof err === "object" && err !== null && (err as { authenticationFailed?: unknown }).authenticationFailed === true) {
    return "login_failed";
  }
  return "unreachable";
}

export async function checkConnection(mailbox: ReadOnlyMailbox): Promise<ConnectionResult> {
  try {
    await mailbox.open();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: failureCode(err) };
  } finally {
    await mailbox.close().catch(() => undefined);
  }
}
