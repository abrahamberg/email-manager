import { describe, expect, it } from "vitest";
import { emptyForm, formFrom, inputFor, unsavedTarget } from "../pages/setup/target";
import { mockApi } from "./api";
import { createHttpApi } from "./httpApi";
import { failureText, saveErrorText, type MailboxInput } from "./setupApi";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const imap = { provider: "imap", host: "imap.example.com", port: 993, user: "me", password: "pw" } as const;
const imapInput: MailboxInput = { provider: "imap", label: "Home", host: "imap.example.com", port: 993, user: "me", password: "pw", enabled: true };

describe("setup api over http", () => {
  it("posts test and learn to the server", async () => {
    const { fn, calls } = fakeFetch(200, { ok: true });
    const api = createHttpApi(fn).setup;
    await api.test(imap);
    await api.learn({ mailboxId: "mb-1" });
    expect(calls.map((c) => [c.url, c.init.method])).toEqual([["/api/setup/test", "POST"], ["/api/setup/learn", "POST"]]);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(imap);
  });

  it("adds with POST, edits with PUT and removes with DELETE", async () => {
    const view = { id: "mb-1", label: "Home", provider: "imap", hasPassword: true, hasClientSecret: false, enabled: true, connected: false };
    const { fn, calls } = fakeFetch(200, view);
    const api = createHttpApi(fn).setup;
    expect(await api.saveMailbox(imapInput)).toEqual({ ok: true, mailbox: view });
    await api.saveMailbox(imapInput, "mb-1");
    await api.removeMailbox("mb-1");
    expect(calls.map((c) => [c.url, c.init.method])).toEqual([
      ["/api/setup/mailboxes", "POST"], ["/api/setup/mailboxes/mb-1", "PUT"], ["/api/setup/mailboxes/mb-1", "DELETE"],
    ]);
  });

  it("turns refusals into save errors", async () => {
    expect(await createHttpApi(fakeFetch(422, { error: "secret_required" }).fn).setup.saveMailbox(imapInput)).toEqual({ ok: false, error: "secret_required" });
    expect(await createHttpApi(fakeFetch(400, {}).fn).setup.saveMailbox(imapInput)).toEqual({ ok: false, error: "invalid" });
  });

  it("turns 404 into not_found and other errors into a throw", async () => {
    expect(await createHttpApi(fakeFetch(404, {}).fn).setup.test({ mailboxId: "gone" })).toEqual({ ok: false, error: "not_found" });
    await expect(createHttpApi(fakeFetch(500, {}).fn).setup.learn({ mailboxId: "mb-1" })).rejects.toThrow("500");
  });

  it("explains every failure and save error", () => {
    for (const code of ["login_failed", "reconnect_needed", "unreachable", "not_found"] as const) expect(failureText(code)).not.toBe("");
    for (const code of ["secret_required", "provider_fixed", "invalid", "not_found"] as const) expect(saveErrorText(code)).not.toBe("");
  });
});

describe("mock setup api", () => {
  it("keeps added mailboxes, never returns their secrets, and answers test and learn", async () => {
    const saved = await mockApi.setup.saveMailbox({ provider: "gmail", label: "G", clientId: "cid", clientSecret: "s3cret", enabled: true });
    expect(saved.ok).toBe(true);
    const id = saved.ok ? saved.mailbox.id : "";
    expect(JSON.stringify(await mockApi.setup.mailboxes())).not.toContain("s3cret");
    expect((await mockApi.setup.test({ mailboxId: id })).ok).toBe(true);
    const learned = await mockApi.setup.learn({ mailboxId: id });
    expect(learned.ok && learned.summary.daysRead).toBe(30);
    await mockApi.setup.removeMailbox(id);
    expect(await mockApi.setup.test({ mailboxId: id })).toEqual({ ok: false, error: "not_found" });
  });
});

describe("inputFor", () => {
  const filled = { ...emptyForm("imap"), label: " Home ", host: " imap.example.com ", user: " me ", password: "pw" };
  it.each([
    [{ ...filled, label: "" }], [{ ...filled, host: "" }], [{ ...filled, user: "" }], [{ ...filled, port: 0 }],
    [{ ...emptyForm("gmail"), label: "G" }],
  ])("is undefined while the form is incomplete %#", (form) => {
    expect(inputFor(form)).toBeUndefined();
  });
  it("trims and leaves a blank secret out, so the saved one stays", () => {
    expect(inputFor({ ...filled, password: "" })).toEqual({ provider: "imap", label: "Home", host: "imap.example.com", port: 993, user: "me", password: undefined, enabled: true });
    expect(inputFor({ ...emptyForm("office365"), label: "W", clientId: " cid " })).toEqual({ provider: "office365", label: "W", clientId: "cid", clientSecret: undefined, tenant: undefined, enabled: true });
    expect(inputFor({ ...emptyForm("office365"), label: "W", clientId: "cid", tenant: " contoso.com " })).toMatchObject({ tenant: "contoso.com" });
    expect(inputFor({ ...emptyForm("gmail"), label: "G", clientId: "cid", tenant: "contoso.com" })).not.toHaveProperty("tenant");
  });
  it("adds SMTP only with a host", () => {
    expect(inputFor({ ...filled, smtpHost: "smtp.example.com" })).toMatchObject({ smtpHost: "smtp.example.com", smtpPort: 587 });
  });
  it("offers an unsaved test only for IMAP with a password", () => {
    expect(unsavedTarget(filled)).toEqual(imap);
    expect(unsavedTarget({ ...filled, password: "" })).toBeUndefined();
    expect(unsavedTarget({ ...emptyForm("gmail"), label: "G", clientId: "c", clientSecret: "s" })).toBeUndefined();
  });
  it("starts an edit from the saved view with empty secrets", () => {
    const form = formFrom({ id: "mb-1", label: "Home", provider: "imap", imapHost: "h.example.com", imapPort: 993, imapUser: "me", hasPassword: true, hasClientSecret: false, enabled: true, connected: false });
    expect(form).toMatchObject({ host: "h.example.com", user: "me", password: "", clientSecret: "" });
  });
});
