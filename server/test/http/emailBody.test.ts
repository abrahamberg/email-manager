import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { emailBodyRoutes } from "../../src/http/routes/emailBody";
import type { ReadOnlyMailbox } from "../../src/setup/readOnly";

const RAW = new TextEncoder().encode("From: a@x.com\r\nSubject: s\r\nMessage-ID: <m1@x>\r\n\r\nSee https://example.com/a?b=1 now\r\n");

function app(opts: { raw?: Uint8Array; fail?: boolean; mailbox?: string | undefined } = {}) {
  const closed: string[] = [];
  const box: ReadOnlyMailbox = {
    open: async () => ({ uidValidity: 1, uidNext: 2 }),
    scanHeaders: async function* () {},
    readMessage: async () => {
      if (opts.fail) throw new Error("secret-host refused");
      return opts.raw;
    },
    close: async () => void closed.push("close"),
  };
  const routes = emailBodyRoutes({
    mailboxOf: async (id) => (id === "<m1@x>" ? ("mailbox" in opts ? opts.mailbox : "mb-1") : undefined),
    reader: async (id) => (id === "mb-1" ? box : undefined),
  });
  const host = new Hono().route("/", routes);
  const post = (body: unknown) => host.request("/api/emails/body", { method: "POST", body: JSON.stringify(body) });
  return { post, closed };
}

describe("emailBodyRoutes", () => {
  it("returns the original text with its links, and closes the mailbox", async () => {
    const { post, closed } = app({ raw: RAW });
    const res = await post({ id: "<m1@x>" });
    expect(res.status).toBe(200);
    expect((await res.json() as { text: string }).text).toContain("https://example.com/a?b=1");
    expect(closed).toEqual(["close"]);
  });

  it.each([
    ["unknown message", { id: "<nope@x>" }, {}],
    ["message gone from the mailbox", { id: "<m1@x>" }, { raw: undefined }],
    ["no known mailbox", { id: "<m1@x>" }, { mailbox: undefined }],
  ])("404 for %s", async (_n, body, opts) => {
    expect((await app(opts).post(body)).status).toBe(404);
  });

  it("answers 502 without the server's message when the mailbox fails", async () => {
    const res = await app({ fail: true }).post({ id: "<m1@x>" });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret-host");
  });

  it.each([["no id", {}], ["extra field", { id: "<m1@x>", mailbox: "mb-2" }], ["empty", { id: " " }]])("400 for %s", async (_n, body) => {
    expect((await app({ raw: RAW }).post(body)).status).toBe(400);
  });
});
