import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../../src/mail/auth/crypto.js";
import { s256Challenge } from "../../src/mail/auth/pkce.js";
import { passwordAuth } from "../../src/mail/auth/passwordAuth.js";
import { key } from "./fakes.js";

describe("token encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("refresh-secret", key);
    expect(decrypt(a, key)).toBe("refresh-secret");
    expect(encrypt("refresh-secret", key)).not.toBe(a);
    expect(a).not.toContain("refresh-secret");
  });

  it("rejects a tampered ciphertext", () => {
    const raw = Buffer.from(encrypt("refresh-secret", key), "base64");
    raw[raw.length - 1]! ^= 1;
    expect(() => decrypt(raw.toString("base64"), key)).toThrow();
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => encrypt("x", Buffer.alloc(16))).toThrow(/32 bytes/);
  });
});

describe("PKCE", () => {
  it("matches the RFC 7636 S256 example", () => {
    expect(s256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
    const v = "abc";
    expect(s256Challenge(v)).toBe(createHash("sha256").update(v).digest("base64url"));
  });
});

describe("passwordAuth", () => {
  it("returns password credentials", async () => {
    expect(await passwordAuth("me@x.org", "pw").credentials()).toEqual({ kind: "password", user: "me@x.org", password: "pw" });
  });
});
