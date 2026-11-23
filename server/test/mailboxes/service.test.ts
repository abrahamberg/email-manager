import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/http/app";
import { mailboxService } from "../../src/mailboxes/service";
import { createStore } from "../../src/store";
import { mailboxSources } from "../../src/wiring/mailboxSources";
import { setupDeps } from "../../src/wiring/setupDeps";
import { staticFixture } from "../http/helpers";
import { useFreshDb } from "../store/freshDb";

const PASSWORD = "imap-password-very-secret";
const SECRET = "oauth-client-secret-very-secret";
const key = randomBytes(32);

describe("mailbox service", () => {
  const db = useFreshDb();
  let n = 0;
  const service = () => {
    const store = createStore(db());
    return { store, svc: mailboxService(store.mailboxes, store.tokens, key, () => `mb-${++n}`) };
  };
  const imap = { provider: "imap", label: "Home", host: "imap.example.com", port: 993, user: "me@example.com", enabled: true } as const;

  it("seals secrets, keeps them out of the read model, and opens them for wiring", async () => {
    const { svc } = service();
    const created = await svc.admin.create({ ...imap, password: PASSWORD });
    expect(created.ok && created.mailbox).toMatchObject({ provider: "imap", hasPassword: true, hasClientSecret: false, connected: false });
    expect(JSON.stringify(await svc.admin.list())).not.toContain(PASSWORD);
    const raw = await db().query<{ imap_password_enc: string }>("SELECT imap_password_enc FROM mailboxes");
    expect(raw.every((r) => !r.imap_password_enc.includes(PASSWORD))).toBe(true);
    expect((await svc.opened(created.ok ? created.mailbox.id : ""))?.password).toBe(PASSWORD);
  });

  it("keeps a saved secret on an edit that leaves it out", async () => {
    const { svc } = service();
    const created = await svc.admin.create({ provider: "gmail", label: "G", clientId: "cid", clientSecret: SECRET, enabled: true });
    const id = created.ok ? created.mailbox.id : "";
    const edited = await svc.admin.update(id, { provider: "gmail", label: "Renamed", clientId: "cid", enabled: false });
    expect(edited.ok && edited.mailbox).toMatchObject({ label: "Renamed", enabled: false, hasClientSecret: true });
    expect((await svc.opened(id))?.clientSecret).toBe(SECRET);
    expect((await svc.enabled()).map((m) => m.record.id)).not.toContain(id);
  });

  it("saves an Office 365 tenant and clears it when left out", async () => {
    const { svc } = service();
    const o365 = { provider: "office365", label: "W", clientId: "cid", clientSecret: SECRET, enabled: true } as const;
    const created = await svc.admin.create({ ...o365, tenant: "contoso.onmicrosoft.com" });
    const id = created.ok ? created.mailbox.id : "";
    expect((await svc.opened(id))?.record.oauthTenant).toBe("contoso.onmicrosoft.com");
    await svc.admin.update(id, { ...o365, clientSecret: undefined });
    expect((await svc.opened(id))?.record.oauthTenant).toBeUndefined();
  });

  it("says whether an OAuth mailbox has a grant, and removes the grant and cursor with the mailbox", async () => {
    const { svc, store } = service();
    const created = await svc.admin.create({ provider: "office365", label: "W", clientId: "cid", clientSecret: SECRET, enabled: true });
    const id = created.ok ? created.mailbox.id : "";
    await store.tokens.save(id, { ciphertext: "sealed" });
    await store.cursorFor(id).set({ uidValidity: 1, uidNext: 2 });
    expect((await svc.admin.list()).find((m) => m.id === id)?.connected).toBe(true);
    expect(await svc.admin.remove(id)).toBe(true);
    expect(await store.tokens.get(id)).toBeUndefined();
    expect(await store.cursorFor(id).get()).toBeUndefined();
    expect(await svc.admin.remove(id)).toBe(false);
  });

  it("serves add, edit and remove over HTTP without ever returning a secret", async () => {
    const { svc, store } = service();
    const app = createApp({
      allowedEmails: ["owner@example.com"], runs: { recent: async () => [] }, staticDir: staticFixture(),
      setup: setupDeps({ service: svc, tokens: store.tokens, encryptionKey: key }),
    });
    const call = (method: string, path: string, body?: unknown) => app.request(path, {
      method, headers: { "content-type": "application/json", "X-Auth-Request-Email": "owner@example.com" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await call("POST", "/api/setup/mailboxes", { ...imap, password: PASSWORD });
    const text = await res.text();
    expect(res.status).toBe(201);
    expect(text).not.toContain(PASSWORD);
    const { id } = JSON.parse(text) as { id: string };
    expect((await call("POST", "/api/setup/mailboxes", { ...imap, host: "192.168.1.5", password: "x" })).status).toBe(400);
    expect((await call("POST", "/api/setup/mailboxes", imap)).status).toBe(422);
    expect((await call("PUT", `/api/setup/mailboxes/${id}`, { ...imap, label: "Renamed" })).status).toBe(200);
    expect((await call("PUT", "/api/setup/mailboxes/unknown", imap)).status).toBe(404);
    expect(await (await call("GET", "/api/setup/mailboxes")).text()).not.toContain(PASSWORD);
    expect((await call("DELETE", `/api/setup/mailboxes/${id}`)).status).toBe(204);
  });

  it("gives a run one source per enabled mailbox, each with its own cursor and the account address", async () => {
    const { svc, store } = service();
    await db().exec("DELETE FROM mailboxes");
    const a = await svc.admin.create({ ...imap, password: PASSWORD });
    await svc.admin.create({ ...imap, label: "Off", user: "off@example.com", password: PASSWORD, enabled: false });
    const sources = await mailboxSources({ service: svc, store, encryptionKey: key });
    expect(sources.map((s) => [s.id, s.address])).toEqual([[a.ok ? a.mailbox.id : "", "me@example.com"]]);
    await sources[0]!.cursor.set({ uidValidity: 5, uidNext: 9 });
    expect(await store.cursorFor("someone-else").get()).toBeUndefined();
  });
});
