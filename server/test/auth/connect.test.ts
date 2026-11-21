import { describe, expect, it } from "vitest";
import { connectRoutes } from "../../src/http/routes/connect.js";
import { s256Challenge } from "../../src/mail/auth/pkce.js";
import { openGrant } from "../../src/mail/auth/tokenStore.js";
import { fakeIdToken, fakeTokenEndpoint, key, memoryTokenStore } from "./fakes.js";

function setup(responses: { status?: number; body: unknown }[] = []) {
  const store = memoryTokenStore();
  const endpoint = fakeTokenEndpoint(responses);
  const app = connectRoutes({
    publicUrl: "https://mail.example.org",
    clientId: "cid",
    clientSecret: "secret",
    encryptionKey: key,
    tokenStore: store,
    fetchImpl: endpoint.impl,
  });
  return { app, store, endpoint };
}

async function start(app: ReturnType<typeof connectRoutes>, provider = "gmail") {
  const res = await app.request(`/api/connect/${provider}/start`);
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
});
