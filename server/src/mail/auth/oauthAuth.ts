import type { MailAuth, MailCredentials } from "../../ports.js";
import { providers, type OAuthProviderId } from "./providers.js";
import { requestToken, ReconnectNeededError, type FetchLike } from "./tokenEndpoint.js";
import { openGrant, sealGrant, type StoredGrant, type TokenStore } from "./tokenStore.js";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export function oauthAuth(
  providerId: OAuthProviderId,
  clientId: string,
  clientSecret: string,
  tokenStore: TokenStore,
  encryptionKey: string | Buffer,
  fetchImpl: FetchLike = fetch,
  clock: () => number = Date.now,
): MailAuth {
  const provider = providers[providerId];
  let cached: (CachedToken & { user: string }) | undefined;
  let inflight: Promise<MailCredentials> | undefined;

  async function refresh(): Promise<MailCredentials> {
    const grant = await loadGrant();
    const params: Record<string, string> = { grant_type: "refresh_token", refresh_token: grant.refreshToken };
    if (provider.scopeOnRefresh) params.scope = provider.scopes.join(" ");
    const token = await requestToken(provider, { clientId, clientSecret }, params, fetchImpl);
    const expiresAt = clock() + token.expires_in * 1000;
    if (token.refresh_token && token.refresh_token !== grant.refreshToken) {
      const rotated: StoredGrant = { user: grant.user, refreshToken: token.refresh_token };
      await tokenStore.save(sealGrant(rotated, encryptionKey), new Date(expiresAt).toISOString());
    }
    cached = { user: grant.user, accessToken: token.access_token, expiresAt };
    return { kind: "oauth", user: grant.user, accessToken: token.access_token };
  }

  async function loadGrant(): Promise<StoredGrant> {
    const blob = await tokenStore.load();
    if (!blob) throw new ReconnectNeededError(providerId);
    return openGrant(blob, encryptionKey);
  }

  return {
    async credentials() {
      if (cached && cached.expiresAt - clock() > REFRESH_MARGIN_MS) {
        return { kind: "oauth", user: cached.user, accessToken: cached.accessToken };
      }
      inflight ??= refresh().finally(() => (inflight = undefined));
      return inflight;
    },
  };
}
