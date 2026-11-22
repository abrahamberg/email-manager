import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KEY_FILE, loadInstanceKeys, TOKEN_FILE } from "../../src/keys/instanceKeys";

const freshDir = () => mkdtempSync(join(tmpdir(), "keys-"));

describe("loadInstanceKeys", () => {
  it("creates both files once with owner-only access, then reuses them", async () => {
    const dir = freshDir();
    const first = await loadInstanceKeys({ DATA_DIR: dir });
    expect(first.encryptionKey).toHaveLength(32);
    expect(first.internalToken.length).toBeGreaterThanOrEqual(32);
    expect(statSync(join(dir, KEY_FILE)).mode & 0o777).toBe(0o600);
    const again = await loadInstanceKeys({ DATA_DIR: dir });
    expect(again.encryptionKey.equals(first.encryptionKey)).toBe(true);
    expect(again.internalToken).toBe(first.internalToken);
  });

  it("gives every concurrent caller the same keys", async () => {
    const dir = freshDir();
    const all = await Promise.all(Array.from({ length: 8 }, () => loadInstanceKeys({ DATA_DIR: dir })));
    expect(new Set(all.map((k) => k.encryptionKey.toString("base64"))).size).toBe(1);
    expect(new Set(all.map((k) => k.internalToken)).size).toBe(1);
  });

  it.each([[KEY_FILE, "not-a-key"], [TOKEN_FILE, "short"]])("fails on an invalid %s and leaves it as it was", async (file, text) => {
    const dir = freshDir();
    writeFileSync(join(dir, file), text);
    await expect(loadInstanceKeys({ DATA_DIR: dir })).rejects.toThrow("refusing to replace");
    expect(readFileSync(join(dir, file), "utf8")).toBe(text);
  });

  it("uses env values when set and needs no directory then", async () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const keys = await loadInstanceKeys({ DATA_DIR: "/nonexistent-dir", TOKEN_ENCRYPTION_KEY: key, INTERNAL_TOKEN: "t".repeat(32) });
    expect(keys.encryptionKey.toString("base64")).toBe(key);
    expect(keys.internalToken).toBe("t".repeat(32));
  });

  it("refuses to run without the data directory, rather than keep keys that vanish", async () => {
    await expect(loadInstanceKeys({ DATA_DIR: join(freshDir(), "missing") })).rejects.toThrow("DATA_DIR");
  });
});
