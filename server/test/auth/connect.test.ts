import { describe, expect, it } from "vitest";
import { connectRoutes } from "../../src/http/routes/connect.js";
import { s256Challenge } from "../../src/mail/auth/pkce.js";
import { openGrant } from "../../src/mail/auth/tokenStore.js";
import { fakeIdToken, fakeTokenEndpoint, key, memoryTokenStore } from "./fakes.js";

const MAILBOX = "0b7c6a52-6f0e-4c39-9d0a-1f4e2b3c4d5e";

function setup(responses: { status?: number; body: unknown }[] = [], tenant?: string) {
  const store = memoryTokenStore();
  const endpoint = fakeTokenEndpoint(responses);
  const providerOf: Record<string, "gmail" | "office365"> = { [MAILBOX]: "gmail", "mb-o365": "office365" };
  const app = connectRoutes({
    publicUrl: "https://mail.example.org",
    client: async (id) => providerOf[id] && { provider: providerOf[id], clientId: "cid", clientSecret: "secret", tenant, tokenStore: store },
    encryptionKey: key,
    fetchImpl: endpoint.impl,
  });
  return { app, store, endpoint };
}

async function start(app: ReturnType<typeof connectRoutes>, provider = "gmail", mailbox = provider === "gmail" ? MAILBOX : "mb-o365") {
  const res = await app.request(`/api/connect/${provider}/start?mailbox=${mailbox}`);
  const location = new URL(res.headers.get("location")!);
  const cookie = res.headers.get("set-cookie")!;
  return { res, location, cookie: cookie.split(";")[0]!, rawCookie: cookie };
}

describe("connect routes", () => {
  it("redirects to the authorize URL with PKCE S256 and a flow cookie", async () => {
    const { app } = setup();
    const { res, location, rawCookie } = await start(app, "office365");
    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(location.searchParams.get("redirect_uri")).toBe("https://mail.example.org/api/connect/office365/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(rawCookie).toMatch(/HttpOnly/);
    expect(rawCookie).toMatch(/SameSite=Lax/);
    expect(rawCookie).toMatch(/Secure/);
  });

  it("signs in at the mailbox's own Microsoft tenant", async () => {
    const { app } = setup([], "contoso.onmicrosoft.com");
    const { location } = await start(app, "office365");
    expect(location.origin + location.pathname).toBe("https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/authorize");
  });

  it("adds offline access and consent for Gmail", async () => {
    const { location } = await start(setup().app);
    expect(location.searchParams.get("access_type")).toBe("offline");
    expect(location.searchParams.get("prompt")).toBe("consent");
    expect(location.searchParams.get("scope")).toContain("https://mail.google.com/");
  });

  it("exchanges the code with the verifier and stores the encrypted grant", async () => {
    const { app, store, endpoint } = setup([
      { body: { access_token: "at", expires_in: 3600, refresh_token: "rt", id_token: fakeIdToken({ email: "Me@Gmail.com" }) } },
    ]);
    const { location, cookie } = await start(app);
    const state = location.searchParams.get("state")!;
    const res = await app.request(`/api/connect/gmail/callback?state=${state}&code=abc`, { headers: { cookie } });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/#setup");
    const form = endpoint.calls[0]!.form;
    expect(form.get("code")).toBe("abc");
    expect(s256Challenge(form.get("code_verifier")!)).toBe(location.searchParams.get("code_challenge"));
    expect(openGrant(store.blob!, key)).toEqual({ user: "me@gmail.com", refreshToken: "rt" });
  });

  it("rejects a wrong state", async () => {
    const { app, endpoint, store } = setup();
    const { cookie } = await start(app);
    const res = await app.request(`/api/connect/gmail/callback?state=forged&code=abc`, { headers: { cookie } });
    expect(res.status).toBe(400);
    expect(endpoint.calls).toHaveLength(0);
    expect(store.saved).toHaveLength(0);
  });

  it("rejects a missing state or missing cookie", async () => {
    const { app } = setup();
    const { location, cookie } = await start(app);
    const state = location.searchParams.get("state")!;
    expect((await app.request(`/api/connect/gmail/callback?code=abc`, { headers: { cookie } })).status).toBe(400);
    expect((await app.request(`/api/connect/gmail/callback?state=${state}&code=abc`)).status).toBe(400);
  });

  it("rejects a cookie with a forged signature", async () => {
    const { app } = setup();
    const { location, cookie } = await start(app);
    const state = location.searchParams.get("state")!;
    const forged = cookie.replace(/\.[^.]*$/, ".AAAA");
    expect((await app.request(`/api/connect/gmail/callback?state=${state}&code=abc`, { headers: { cookie: forged } })).status).toBe(400);
  });

  it("returns 404 for an unknown provider", async () => {
    expect((await setup().app.request(`/api/connect/yahoo/start`)).status).toBe(404);
  });

  it("carries the mailbox in the state and uses that mailbox's client id", async () => {
    const { location } = await start(setup().app);
    expect(location.searchParams.get("state")!.startsWith(`${MAILBOX}~`)).toBe(true);
    expect(location.searchParams.get("client_id")).toBe("cid");
  });

  it.each([["an unknown mailbox", "gmail", "nope"], ["a mailbox of another provider", "office365", MAILBOX]])(
    "refuses to start for %s", async (_n, provider, mailbox) => {
      const res = await setup().app.request(`/api/connect/${provider}/start?mailbox=${mailbox}`);
      expect(res.status).toBe(409);
      expect(res.headers.get("set-cookie")).toBeNull();
    });
});
