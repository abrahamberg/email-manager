import { describe, expect, it } from "vitest";
import { isSpam } from "../src/spam/isSpam";
import type { Email } from "../src/mail/Email";
import type { SpamCheck, SpamVerdict } from "../src/ports";

const email = (headers: Record<string, string> = {}) => ({ headers }) as unknown as Email;
const check = (v: SpamVerdict | undefined): SpamCheck => ({ check: async () => v });
const raw = new Uint8Array();

describe("isSpam", () => {
  it("uses Rspamd verdict", async () => {
    const r = await isSpam(email(), raw, check({ score: 12.44, isSpam: true, symbols: ["BAYES_SPAM", "X"] }));
    expect(r).toEqual({ spam: true, score: 12.4, reason: "Rspamd score 12.4 (BAYES_SPAM, X)" });
  });
  it("treats DMARC fail as spam even when Rspamd is down", async () => {
    const r = await isSpam(email({ "authentication-results": "mx; dmarc=fail" }), raw, check(undefined));
    expect(r).toMatchObject({ spam: true, reason: "DMARC failed" });
  });
  it("is not spam when Rspamd is down and auth is fine", async () => {
    expect((await isSpam(email(), raw, check(undefined))).spam).toBe(false);
  });
  it("is not spam for clean ham", async () => {
    const r = await isSpam(email({ "authentication-results": "mx; dmarc=pass" }), raw, check({ score: 1, isSpam: false, symbols: [] }));
    expect(r).toMatchObject({ spam: false, score: 1 });
  });
});
