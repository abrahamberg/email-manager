import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const base = {
  DATABASE_URL: "postgres://u:secretpw@db:5432/app",
  ALLOWED_EMAILS: "A@x.com, b@x.com",
  INTERNAL_TOKEN: "t".repeat(32),
  MAIL_PROVIDER: "imap",
  IMAP_HOST: "imap.x.com",
  IMAP_PORT: "993",
  IMAP_USER: "me",
  IMAP_PASSWORD: "hunter2-secret",
};
const key = Buffer.alloc(32, 1).toString("base64");
const oauth = {
  ...base,
  MAIL_PROVIDER: "office365",
  OAUTH_CLIENT_ID: "id",
  OAUTH_CLIENT_SECRET: "sec",
  TOKEN_ENCRYPTION_KEY: key,
};

describe("loadConfig", () => {
  it("applies defaults and parses lists", () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({ PORT: 8080, INTERNAL_PORT: 8081, DRY_RUN: true, AI_DAILY_BUDGET_USD: 0.5 });
    expect(c.ALLOWED_EMAILS).toEqual(["a@x.com", "b@x.com"]);
  });

  it("accepts oauth providers", () => {
    expect(loadConfig(oauth).MAIL_PROVIDER).toBe("office365");
    expect(loadConfig({ ...oauth, MAIL_PROVIDER: "gmail" }).MAIL_PROVIDER).toBe("gmail");
  });

  it("parses DRY_RUN=false", () => {
    expect(loadConfig({ ...base, DRY_RUN: "false" }).DRY_RUN).toBe(false);
  });

  it.each([
    ["DATABASE_URL", { DATABASE_URL: undefined }],
    ["DATABASE_URL", { DATABASE_URL: "mysql://x" }],
    ["ALLOWED_EMAILS", { ALLOWED_EMAILS: " , " }],
    ["INTERNAL_TOKEN", { INTERNAL_TOKEN: "short" }],
    ["MAIL_PROVIDER", { MAIL_PROVIDER: "pop3" }],
    ["IMAP_PASSWORD", { IMAP_PASSWORD: undefined }],
    ["PORT", { PORT: "99999" }],
  ])("fails naming %s", (name, patch) => {
    expect(() => loadConfig({ ...base, ...patch })).toThrow(name);
  });

  it("requires oauth settings and a 32 byte key", () => {
    expect(() => loadConfig({ ...oauth, OAUTH_CLIENT_ID: undefined })).toThrow("OAUTH_CLIENT_ID");
    expect(() => loadConfig({ ...oauth, TOKEN_ENCRYPTION_KEY: "AAAA" })).toThrow("TOKEN_ENCRYPTION_KEY");
  });

  it("never prints secret values", () => {
    const bad = { ...base, INTERNAL_TOKEN: "leaky", DATABASE_URL: "mysql://u:secretpw@db/x" };
    try {
      loadConfig(bad);
      expect.unreachable();
    } catch (e) {
      const msg = String(e);
      expect(msg).not.toContain("leaky");
      expect(msg).not.toContain("secretpw");
    }
  });
});
