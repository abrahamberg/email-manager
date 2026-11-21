import type { Config } from "../config";
import { oauthAuth } from "../mail/auth/oauthAuth";
import { passwordAuth } from "../mail/auth/passwordAuth";
import type { TokenStore } from "../mail/auth/tokenStore";
import type { MailAuth } from "../ports";

/** Generic IMAP signs in with a password; Office 365 and Gmail with the stored OAuth grant. */
export function mailAuthFromConfig(config: Config, tokenStore: TokenStore): MailAuth {
  if (config.MAIL_PROVIDER === "imap") return passwordAuth(required(config.IMAP_USER), required(config.IMAP_PASSWORD));
  return oauthAuth(
    config.MAIL_PROVIDER,
    required(config.OAUTH_CLIENT_ID),
    required(config.OAUTH_CLIENT_SECRET),
    tokenStore,
    required(config.TOKEN_ENCRYPTION_KEY),
  );
}

// loadConfig already enforces these per provider; this only narrows the type.
export function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("missing mail configuration");
  return value;
}
