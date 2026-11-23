import { describe, expect, it } from "vitest";
import { oauthAuth } from "../../src/mail/auth/oauthAuth.js";
import { oauthProvider } from "../../src/mail/auth/providers.js";
import { ReconnectNeededError } from "../../src/mail/auth/tokenEndpoint.js";
import { openGrant, sealGrant } from "../../src/mail/auth/tokenStore.js";
import { fakeTokenEndpoint, key, memoryTokenStore } from "./fakes.js";

function setup(responses: { status?: number; body: unknown }[], provider = oauthProvider("office365")) {
  const store = memoryTokenStore();
  store.blob = sealGrant({ user: "me@corp.example", refreshToken: "rt-1" }, key);
  const endpoint = fakeTokenEndpoint(responses);
  let now = 1_000_000;
  const clock = { now: () => now, advance: (ms: number) => (now += ms) };
  const auth = oauthAuth(provider, "cid", "secret", store, key, endpoint.impl, clock.now);
  return { store, endpoint, clock, auth };
}

describe("oauthAuth", () => {
  it("refreshes when no access token is cached and reuses it while fresh", async () => {
    const { auth, endpoint, clock } = setup([{ body: { access_token: "at-1", expires_in: 3600 } }]);
    expect(await auth.credentials()).toEqual({ kind: "oauth", user: "me@corp.example", accessToken: "at-1" });
    clock.advance(50 * 60 * 1000);
    expect(await auth.credentials()).toMatchObject({ accessToken: "at-1" });
    expect(endpoint.calls).toHaveLength(1);
    const form = endpoint.calls[0]!.form;
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("rt-1");
    expect(form.get("scope")).toContain("IMAP.AccessAsUser.All");
  });

  it("refreshes at the configured Microsoft tenant", async () => {
    const tenant = "0b7c6a52-6f0e-4c39-9d0a-1f4e2b3c4d5e";
    const { auth, endpoint } = setup([{ body: { access_token: "at-1", expires_in: 3600 } }], oauthProvider("office365", tenant));
    await auth.credentials();
    expect(endpoint.calls[0]!.url).toBe(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`);
  });

  it("refreshes within five minutes of expiry", async () => {
    const { auth, endpoint, clock } = setup([
      { body: { access_token: "at-1", expires_in: 3600 } },
      { body: { access_token: "at-2", expires_in: 3600 } },
    ]);
    await auth.credentials();
    clock.advance(56 * 60 * 1000);
    expect(await auth.credentials()).toMatchObject({ accessToken: "at-2" });
    expect(endpoint.calls).toHaveLength(2);
  });

  it("saves a rotated refresh token, encrypted", async () => {
    const { auth, store } = setup([{ body: { access_token: "at-1", expires_in: 3600, refresh_token: "rt-2" } }]);
    await auth.credentials();
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]!.blob).not.toContain("rt-2");
    expect(openGrant(store.blob!, key)).toEqual({ user: "me@corp.example", refreshToken: "rt-2" });
  });

  it("does not save when the refresh token is unchanged", async () => {
    const { auth, store } = setup([{ body: { access_token: "at-1", expires_in: 3600, refresh_token: "rt-1" } }]);
    await auth.credentials();
    expect(store.saved).toHaveLength(0);
  });

  it("asks to reconnect on invalid_grant (revoked)", async () => {
    const { auth } = setup([{ status: 400, body: { error: "invalid_grant" } }]);
    await expect(auth.credentials()).rejects.toThrow(ReconnectNeededError);
    await expect(setup([{ status: 400, body: { error: "invalid_grant" } }]).auth.credentials()).rejects.toThrow(
      /reconnect needed/,
    );
  });

  it("asks to reconnect when nothing is stored", async () => {
    const { auth, store } = setup([]);
    store.blob = undefined;
    await expect(auth.credentials()).rejects.toThrow(ReconnectNeededError);
  });

  it("reports other token errors without the reconnect hint", async () => {
    const { auth } = setup([{ status: 500, body: { error: "server_error" } }]);
    await expect(auth.credentials()).rejects.toThrow(/token endpoint failed \(500 server_error\)/);
  });
});
