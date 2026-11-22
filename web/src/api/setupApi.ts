import { mockSetupApi } from "./mockSetup";

export type OAuthProvider = "office365" | "gmail";
export type MailProvider = OAuthProvider | "imap";

export interface ImapDetails {
  host: string;
  port: number;
  user: string;
  password: string;
}

/** A saved mailbox as the server shows it: secrets never come back, only whether one is saved. */
export interface MailboxView {
  id: string;
  label: string;
  provider: MailProvider;
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  smtpHost?: string;
  smtpPort?: number;
  oauthClientId?: string;
  hasClientSecret: boolean;
  hasPassword: boolean;
  enabled: boolean;
  connected: boolean;
}

/** Secrets are write-only: leave them out on an edit to keep the saved one. */
export type MailboxInput =
  | { provider: "imap"; label: string; host: string; port: number; user: string; password?: string; smtpHost?: string; smtpPort?: number; enabled: boolean }
  | { provider: OAuthProvider; label: string; clientId: string; clientSecret?: string; enabled: boolean };

/** An unsaved IMAP login to try, or a saved mailbox of any provider. */
export type SetupTarget = ({ provider: "imap" } & ImapDetails) | { mailboxId: string };

export interface SetupStatus {
  oauthEnabled: boolean;
}

export type FailureCode = "login_failed" | "reconnect_needed" | "unreachable" | "not_found";
export type SaveError = "secret_required" | "provider_fixed" | "invalid" | "not_found";

export interface LearnSummary {
  daysRead: number;
  emailsRead: number;
  distinctSenders: number;
  newsletters: number;
}

export type TestResult = { ok: true; note?: string } | { ok: false; error: FailureCode };
export type LearnResult = { ok: true; summary: LearnSummary; note?: string } | { ok: false; error: FailureCode };
export type SaveResult = { ok: true; mailbox: MailboxView } | { ok: false; error: SaveError };

export interface SetupApi {
  status(): Promise<SetupStatus>;
  mailboxes(): Promise<MailboxView[]>;
  /** Adds a mailbox, or edits the one with `id`. */
  saveMailbox(input: MailboxInput, id?: string): Promise<SaveResult>;
  removeMailbox(id: string): Promise<void>;
  test(target: SetupTarget): Promise<TestResult>;
  // Read-only on the server: it counts mail and changes nothing.
  learn(target: SetupTarget): Promise<LearnResult>;
}

type Fetch = typeof fetch;

const SAVE_ERRORS: Record<number, SaveError> = { 400: "invalid", 404: "not_found" };

export function createSetupApi(fetchFn: Fetch = (...args) => fetch(...args)): SetupApi {
  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    return fetchFn(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await call(method, path, body);
    if (res.status === 404) return { ok: false, error: "not_found" } as T;
    if (!res.ok) throw new Error(`${method} ${path} failed with status ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    status: () => json("GET", "/api/setup/status"),
    mailboxes: () => json("GET", "/api/setup/mailboxes"),
    async saveMailbox(input, id) {
      const res = await call(id ? "PUT" : "POST", id ? `/api/setup/mailboxes/${encodeURIComponent(id)}` : "/api/setup/mailboxes", input);
      if (res.ok) return { ok: true, mailbox: (await res.json()) as MailboxView };
      if (res.status === 422) return { ok: false, error: ((await res.json()) as { error: SaveError }).error };
      const error = SAVE_ERRORS[res.status];
      if (error) return { ok: false, error };
      throw new Error(`saving the mailbox failed with status ${res.status}`);
    },
    async removeMailbox(id) {
      const res = await call("DELETE", `/api/setup/mailboxes/${encodeURIComponent(id)}`);
      if (!res.ok && res.status !== 404) throw new Error(`removing the mailbox failed with status ${res.status}`);
    },
    test: (target) => json("POST", "/api/setup/test", target),
    learn: (target) => json("POST", "/api/setup/learn", target),
  };
}

export { mockSetupApi };

const ERROR_TEXT: Record<FailureCode, string> = {
  login_failed: "The server refused the sign-in. Check the user name and password.",
  reconnect_needed: "Sign in again with the Sign in button.",
  unreachable: "Could not reach the server. Check the host.",
  not_found: "This mailbox is not saved any more.",
};

const SAVE_TEXT: Record<SaveError, string> = {
  secret_required: "Enter the password or client secret: it is needed for a new mailbox, host, user or client ID.",
  provider_fixed: "The provider of a saved mailbox cannot change. Add a new mailbox instead.",
  invalid: "Check the fields. Hosts must be public names, IMAP uses port 993 and SMTP 465 or 587.",
  not_found: "This mailbox was removed.",
};

export const failureText = (code: FailureCode) => ERROR_TEXT[code];
export const saveErrorText = (code: SaveError) => SAVE_TEXT[code];
