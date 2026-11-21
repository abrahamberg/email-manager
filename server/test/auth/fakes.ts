import { randomBytes } from "node:crypto";
import type { TokenStore } from "../../src/mail/auth/tokenStore.js";

export const key = randomBytes(32).toString("base64");

export function memoryTokenStore(): TokenStore & { saved: { blob: string; expiresAt: string }[]; blob?: string } {
  const store = {
    saved: [] as { blob: string; expiresAt: string }[],
    blob: undefined as string | undefined,
    async load() {
      return store.blob;
    },
    async save(_p: string, blob: string, expiresAt: string) {
      store.blob = blob;
      store.saved.push({ blob, expiresAt });
    },
  };
  return store;
}

export interface FakeCall {
  url: string;
  form: URLSearchParams;
}

export function fakeTokenEndpoint(responses: { status?: number; body: unknown }[]) {
  const calls: FakeCall[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), form: new URLSearchParams(String(init?.body ?? "")) });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as typeof fetch;
  return { impl, calls };
}

export function fakeIdToken(claims: object): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "none" })}.${part(claims)}.sig`;
}
