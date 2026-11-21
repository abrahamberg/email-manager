import { describe, expect, it } from "vitest";
import { safeRelativePath } from "../../src/http/static";
import { testApp } from "./helpers";

describe("static panel", () => {
  const app = testApp();

  it("serves files with a content type", async () => {
    const res = await app.request("/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("javascript");
    expect(await res.text()).toBe("console.log(1)");
  });

  it.each(["/", "/rules", "/settings/mail", "/assets"])("falls back to index.html for %s", async (path) => {
    const res = await app.request(path);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>panel</title>");
  });

  it.each([
    "/..%2fsecret.txt",
    "/%2e%2e%2fsecret.txt",
    "/assets/..%2f..%2fsecret.txt",
    "/..%5csecret.txt",
    "/../secret.txt",
    "/%2e%2e/secret.txt",
  ])("never serves files outside the root: %s", async (path) => {
    const res = await app.request(`http://localhost${path}`);
    expect(await res.text()).not.toContain("TOP-SECRET");
  });

  it.each([
    ["a/b.js", "a/b.js"],
    ["/../x", undefined],
    ["/a/%2e%2e/x", undefined],
    ["/a%00", undefined],
    ["/%E0%A4%A", undefined],
  ])("safeRelativePath(%s)", (input, expected) => {
    expect(safeRelativePath(input)).toBe(expected);
  });
});
