export type OAuthProviderId = "office365" | "gmail";

export interface OAuthProvider {
  id: OAuthProviderId;
  imap: { host: string; port: number };
  smtp: { host: string; port: number; secure: boolean };
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  /** Mail scopes only, plus what is needed to learn the account address. */
  scopes: string[];
  extraAuthorizeParams: Record<string, string>;
  /** Why: Microsoft wants the scopes again on refresh; Google does not. */
  scopeOnRefresh: boolean;
}

export type OAuthProviders = Record<OAuthProviderId, OAuthProvider>;

/** Why: a single-tenant Entra app must sign in at its own tenant; "common" rejects it. */
export function oauthProviders(microsoftTenant = "common"): OAuthProviders {
  const ms = `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant)}/oauth2/v2.0`;
  return {
    office365: {
      id: "office365",
      imap: { host: "outlook.office365.com", port: 993 },
      smtp: { host: "smtp.office365.com", port: 587, secure: false },
      authorizeUrl: `${ms}/authorize`,
      tokenUrl: `${ms}/token`,
      scopes: [
        "https://outlook.office.com/IMAP.AccessAsUser.All",
        "https://outlook.office.com/SMTP.Send",
        "offline_access",
        "openid",
        "email",
      ],
      extraAuthorizeParams: {},
      scopeOnRefresh: true,
    },
    gmail: {
      id: "gmail",
      imap: { host: "imap.gmail.com", port: 993 },
      smtp: { host: "smtp.gmail.com", port: 465, secure: true },
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scopes: ["https://mail.google.com/", "openid", "email"],
      extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
      scopeOnRefresh: false,
    },
  };
}

export const providers = oauthProviders();

export function isProviderId(value: string): value is OAuthProviderId {
  return Object.hasOwn(providers, value);
}
