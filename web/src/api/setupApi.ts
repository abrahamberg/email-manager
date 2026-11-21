export type OAuthProvider = "office365" | "gmail";
export type SetupChoice = OAuthProvider | "imap";

export interface ImapDetails {
  host: string;
  port: number;
  user: string;
  password: string;
}

export type SetupTarget = { provider: "imap" } & ImapDetails | { provider: OAuthProvider };

export interface SetupStatus {
  oauthEnabled: boolean;
  connected: Record<OAuthProvider, boolean>;
}

export type FailureCode = "login_failed" | "reconnect_needed" | "unreachable" | "not_configured";

export interface LearnSummary {
  daysRead: number;
  emailsRead: number;
  distinctSenders: number;
  newsletters: number;
}

export type TestResult = { ok: true; note?: string } | { ok: false; error: FailureCode };
export type LearnResult = { ok: true; summary: LearnSummary; note?: string } | { ok: false; error: FailureCode };

export interface SetupApi {
  status(): Promise<SetupStatus>;
  test(target: SetupTarget): Promise<TestResult>;
  // Read-only on the server: it counts mail and changes nothing.
  learn(target: SetupTarget): Promise<LearnResult>;
}

type Fetch = typeof fetch;

export function createSetupApi(fetchFn: Fetch = (...args) => fetch(...args)): SetupApi {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchFn(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 409) return { ok: false, error: "not_configured" } as T;
    if (!res.ok) throw new Error(`${method} ${path} failed with status ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    status: () => call("GET", "/api/setup/status"),
    test: (target) => call("POST", "/api/setup/test", target),
    learn: (target) => call("POST", "/api/setup/learn", target),
  };
}

export const mockSetupApi: SetupApi = {
  async status() {
    return { oauthEnabled: true, connected: { office365: false, gmail: false } };
  },
  async test(target) {
    return target.provider === "imap" ? { ok: true, note: IMAP_NOTE } : { ok: true };
  },
  async learn() {
    return { ok: true, summary: { daysRead: 30, emailsRead: 1284, distinctSenders: 212, newsletters: 96 } };
  },
};

const IMAP_NOTE = "The password was used for this check only and was not saved. Runs use the password in the deployment secret.";

const ERROR_TEXT: Record<FailureCode, string> = {
  login_failed: "The server refused the sign-in. Check the user name and password.",
  reconnect_needed: "Sign in again with the button above.",
  unreachable: "Could not reach the server. Check the host.",
  not_configured: "This sign-in is not set up on this deployment.",
};

export const failureText = (code: FailureCode) => ERROR_TEXT[code];
