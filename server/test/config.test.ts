import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const base = {
  DATABASE_URL: "postgres://u:secretpw@db:5432/app",
  ALLOWED_EMAILS: "A@x.com, b@x.com",
};

describe("loadConfig", () => {
  it("needs only the database and the allowed users, and applies defaults", () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({ PORT: 8080, INTERNAL_PORT: 8081, DRY_RUN: true, AI_DAILY_BUDGET_USD: 0.5, DATA_DIR: "/data" });
    expect(c.ALLOWED_EMAILS).toEqual(["a@x.com", "b@x.com"]);
    expect(c.INTERNAL_TOKEN).toBeUndefined();
    expect(c.TOKEN_ENCRYPTION_KEY).toBeUndefined();
  });

  it("parses DRY_RUN=false", () => {
    expect(loadConfig({ ...base, DRY_RUN: "false" }).DRY_RUN).toBe(false);
  });

  it("ignores mail provider settings, which live in the database now", () => {
    expect(loadConfig({ ...base, MAIL_PROVIDER: "pop3", IMAP_HOST: "x" })).not.toHaveProperty("MAIL_PROVIDER");
  });

  it.each([
    ["DATABASE_URL", { DATABASE_URL: undefined }],
    ["DATABASE_URL", { DATABASE_URL: "mysql://x" }],
    ["ALLOWED_EMAILS", { ALLOWED_EMAILS: " , " }],
    ["INTERNAL_TOKEN", { INTERNAL_TOKEN: "short" }],
    ["TOKEN_ENCRYPTION_KEY", { TOKEN_ENCRYPTION_KEY: "AAAA" }],
    ["PORT", { PORT: "99999" }],
  ])("fails naming %s", (name, patch) => {
    expect(() => loadConfig({ ...base, ...patch })).toThrow(name);
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
