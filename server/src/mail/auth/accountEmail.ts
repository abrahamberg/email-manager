import { z } from "zod";
import type { OAuthProvider } from "./providers.js";
import type { FetchLike, TokenResponse } from "./tokenEndpoint.js";

const claimsSchema = z.object({ email: z.string().optional(), preferred_username: z.string().optional() });

/** Why: the id_token comes straight from the token endpoint over TLS, so its signature need not be checked. */
export async function accountEmail(
  provider: OAuthProvider,
  token: TokenResponse,
  fetchImpl: FetchLike,
): Promise<string> {
  const fromIdToken = token.id_token ? emailFromClaims(decodeJwtPayload(token.id_token)) : undefined;
  if (fromIdToken) return fromIdToken;
  if (provider.userinfoUrl) {
    const res = await fetchImpl(provider.userinfoUrl, { headers: { authorization: `Bearer ${token.access_token}` } });
    const fromUserinfo = res.ok ? emailFromClaims(await res.json()) : undefined;
    if (fromUserinfo) return fromUserinfo;
  }
  throw new Error(`${provider.id} did not say which account signed in`);
}

function decodeJwtPayload(jwt: string): unknown {
  const part = jwt.split(".")[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function emailFromClaims(claims: unknown): string | undefined {
  const parsed = claimsSchema.safeParse(claims);
  if (!parsed.success) return undefined;
  const value = parsed.data.email ?? parsed.data.preferred_username;
  return value?.includes("@") ? value.toLowerCase() : undefined;
}
