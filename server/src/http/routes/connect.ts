import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { accountEmail } from "../../mail/auth/accountEmail.js";
import { randomToken, s256Challenge } from "../../mail/auth/pkce.js";
import { isProviderId, providers as defaultProviders, type OAuthProvider, type OAuthProviderId, type OAuthProviders } from "../../mail/auth/providers.js";
import { requestToken, type FetchLike } from "../../mail/auth/tokenEndpoint.js";
import { sealGrant, type TokenStore } from "../../mail/auth/tokenStore.js";

/** The saved OAuth app and grant store of one mailbox. */
export interface MailboxClient {
  provider: OAuthProviderId;
  clientId: string;
  clientSecret: string;
  tokenStore: TokenStore;
}

export interface ConnectDeps {
  publicUrl: string;
  /** Undefined unless the mailbox exists, uses OAuth, and has its client id and secret saved. */
  client(mailboxId: string): Promise<MailboxClient | undefined>;
  encryptionKey: string | Buffer;
  providers?: OAuthProviders;
  fetchImpl?: FetchLike;
}

const COOKIE = "oauth_flow";
const FLOW_TTL_SECONDS = 600;
// "~" is in neither base64url nor a mailbox id, so the state splits back into both.
const STATE_SEP = "~";

export function connectRoutes(deps: ConnectDeps): Hono {
  const app = new Hono();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const providers = deps.providers ?? defaultProviders;
  const secret = cookieSecret(deps.encryptionKey);
  const base = deps.publicUrl.replace(/\/+$/, "");
  const redirectUri = (p: OAuthProvider) => `${base}/api/connect/${p.id}/callback`;
  const cookieOpts = (p: OAuthProvider) => ({
    path: `/api/connect/${p.id}`,
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "Lax" as const,
    maxAge: FLOW_TTL_SECONDS,
  });

  const clientFor = async (mailboxId: string, provider: OAuthProviderId) => {
    const client = mailboxId ? await deps.client(mailboxId) : undefined;
    return client?.provider === provider ? client : undefined;
  };

  app.get("/api/connect/:provider/start", async (c) => {
    const id = c.req.param("provider");
    if (!isProviderId(id)) return c.text("Unknown provider", 404);
    const provider = providers[id];
    const mailboxId = c.req.query("mailbox") ?? "";
    const client = await clientFor(mailboxId, id);
    if (!client) return c.text("Save this mailbox with its client ID and secret first", 409);
    // Why: the redirect URI is fixed per provider, so the mailbox rides in the signed state.
    const state = `${mailboxId}${STATE_SEP}${randomToken()}`;
    const verifier = randomToken(48);
    await setSignedCookie(c, COOKIE, `${state}.${verifier}`, secret, cookieOpts(provider));
    return c.redirect(authorizeUrl(provider, client.clientId, redirectUri(provider), state, verifier));
  });

  app.get("/api/connect/:provider/callback", async (c) => {
    const id = c.req.param("provider");
    if (!isProviderId(id)) return c.text("Unknown provider", 404);
    const provider = providers[id];
    const flow = await getSignedCookie(c, secret, COOKIE);
    deleteCookie(c, COOKIE, { path: cookieOpts(provider).path });
    const [expected, verifier] = typeof flow === "string" ? flow.split(".") : [];
    const state = c.req.query("state");
    if (!expected || !verifier || !state || state !== expected) return c.text("Sign-in expired or state mismatch", 400);
    const code = c.req.query("code");
    if (!code) return c.text("Sign-in was cancelled", 400);
    const client = await clientFor(state.split(STATE_SEP)[0] ?? "", id);
    if (!client) return c.text("This mailbox was removed or changed during sign-in", 409);

    const token = await requestToken(
      provider,
      { clientId: client.clientId, clientSecret: client.clientSecret },
      { grant_type: "authorization_code", code, redirect_uri: redirectUri(provider), code_verifier: verifier },
      fetchImpl,
    );
    if (!token.refresh_token) return c.text("Provider did not grant offline access", 502);
    const user = await accountEmail(provider, token, fetchImpl);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
    await client.tokenStore.save(sealGrant({ user, refreshToken: token.refresh_token }, deps.encryptionKey), expiresAt);
    return c.redirect("/#setup");
  });

  return app;
}

export function authorizeUrl(
  provider: OAuthProvider,
  clientId: string,
  redirectUri: string,
  state: string,
  verifier: string,
): string {
  const url = new URL(provider.authorizeUrl);
  const params = {
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: provider.scopes.join(" "),
    state,
    code_challenge: s256Challenge(verifier),
    code_challenge_method: "S256",
    ...provider.extraAuthorizeParams,
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Why: a separate key for cookie signing, so the token key is never used for two jobs directly. */
function cookieSecret(key: string | Buffer): string {
  const raw = typeof key === "string" ? Buffer.from(key, "base64") : key;
  return createHmac("sha256", raw).update("oauth-flow-cookie").digest("base64");
}
