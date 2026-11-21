import { z } from "zod";
import type { OAuthProvider } from "./providers.js";

export type FetchLike = typeof fetch;

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().optional(),
});
export type TokenResponse = z.infer<typeof tokenSchema>;

export class ReconnectNeededError extends Error {
  constructor(provider: string) {
    super(`${provider} sign-in was revoked or expired: reconnect needed in Set up`);
    this.name = "ReconnectNeededError";
  }
}

export interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

export async function requestToken(
  provider: OAuthProvider,
  client: ClientCredentials,
  params: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<TokenResponse> {
  const body = new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret, ...params });
  const res = await fetchImpl(provider.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw tokenError(provider, res.status, json);
  return tokenSchema.parse(json);
}

function tokenError(provider: OAuthProvider, status: number, json: unknown): Error {
  const code = z.object({ error: z.string() }).safeParse(json);
  if (code.success && code.data.error === "invalid_grant") return new ReconnectNeededError(provider.id);
  return new Error(`${provider.id} token endpoint failed (${status}${code.success ? ` ${code.data.error}` : ""})`);
}
