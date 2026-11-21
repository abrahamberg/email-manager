import { describe, expect, it } from "vitest";
import { bulkSignals } from "../src/lowValue/bulkHeaders";
import type { Email } from "../src/mail/Email";

const mail = (headers: Record<string, string>, address = "alice@x.com"): Pick<Email, "headers" | "from"> => ({
  headers,
  from: { address },
});

describe("bulkSignals", () => {
  const cases: [string, Record<string, string>, string | undefined, boolean, string[]][] = [
    ["personal mail", {}, undefined, false, []],
    ["list-id", { "list-id": "Weekly <news.x.com>" }, undefined, true, ["List-Id"]],
    ["unsubscribe", { "list-unsubscribe": "<mailto:u@x.com>, <https://x.com/u>" }, undefined, true, ["List-Unsubscribe"]],
    ["precedence bulk", { precedence: "Bulk" }, undefined, true, ["Precedence"]],
    ["precedence first-class", { precedence: "first-class" }, undefined, false, []],
    ["auto-submitted", { "auto-submitted": "auto-generated" }, undefined, true, ["Auto-Submitted"]],
    ["auto-submitted no", { "auto-submitted": "no" }, undefined, false, []],
    ["auto-response-suppress", { "x-auto-response-suppress": "All" }, undefined, true, ["X-Auto-Response-Suppress"]],
    ["noreply", {}, "no-reply@x.com", true, ["noreply sender"]],
    ["notifications+tag", {}, "notifications+abc@github.com", true, ["noreply sender"]],
    ["normal name containing noreply-ish", {}, "reply@x.com", false, []],
  ];
  it.each(cases)("%s", (_n, headers, address, isBulk, reasons) => {
    const r = bulkSignals(mail(headers, address));
    expect(r.isBulk).toBe(isBulk);
    expect(r.reasons).toEqual(reasons);
  });

  it("extracts list id and first unsubscribe target", () => {
    const r = bulkSignals(mail({ "list-id": "Weekly <news.x.com>", "list-unsubscribe": "<https://x.com/u>, <mailto:u@x.com>" }));
    expect(r.listId).toBe("news.x.com");
    expect(r.unsubscribe).toBe("https://x.com/u");
  });
});
