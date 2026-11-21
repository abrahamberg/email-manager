import { describe, expect, it } from "vitest";
import { testApp } from "./helpers";

const OWNER = { "X-Auth-Request-Email": "owner@example.com" };
const JSON_TYPE = { "Content-Type": "application/json" };

describe("cross-site request protection on /api", () => {
  const app = testApp();
  const send = (method: string, headers: Record<string, string>, body?: string) =>
    app.request("/api/whatever", { method, headers: { ...OWNER, ...headers }, body });

  it.each([
    ["a form post", "POST", { "Content-Type": "application/x-www-form-urlencoded" }, "a=1", 415],
    ["a text/plain post carrying JSON", "POST", { "Content-Type": "text/plain" }, "{}", 415],
    ["a post with no content type", "POST", {}, "{}", 415],
    ["a cross-site JSON post", "POST", { ...JSON_TYPE, "Sec-Fetch-Site": "cross-site" }, "{}", 403],
    ["a same-site (sibling subdomain) delete", "DELETE", { "Sec-Fetch-Site": "same-site" }, undefined, 403],
    ["a same-origin JSON post", "POST", { ...JSON_TYPE, "Sec-Fetch-Site": "same-origin" }, "{}", 404],
    ["a JSON patch with charset", "PATCH", { "Content-Type": "application/json; charset=utf-8" }, "{}", 404],
    ["a same-origin delete", "DELETE", { "Sec-Fetch-Site": "same-origin" }, undefined, 404],
    ["a cross-site GET", "GET", { "Sec-Fetch-Site": "cross-site" }, undefined, 404],
  ])("%s → %i", async (_name, method, headers, body, status) => {
    expect((await send(method, headers, body)).status).toBe(status);
  });

  it("refuses bodies over the size limit", async () => {
    expect((await send("POST", JSON_TYPE, JSON.stringify({ x: "a".repeat(100_000) }))).status).toBe(413);
  });
});
