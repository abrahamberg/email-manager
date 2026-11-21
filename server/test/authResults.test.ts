import { describe, expect, it } from "vitest";
import { looksSpoofed, parseAuthResults } from "../src/spam/authResults";

const ar = (v?: string) => parseAuthResults(v === undefined ? {} : { "authentication-results": v });

describe("parseAuthResults", () => {
  const cases: [string, string | undefined, [string, string, string]][] = [
    ["all pass", "mx.x.com; spf=pass smtp.mailfrom=a@b.c; dkim=pass header.d=b.c; dmarc=pass header.from=b.c", ["pass", "pass", "pass"]],
    ["missing header", undefined, ["none", "none", "none"]],
    ["softfail is fail", "mx; spf=softfail; dkim=none; dmarc=fail (p=reject)", ["fail", "none", "fail"]],
    ["temperror/permerror", "mx; spf=temperror; dkim=permerror", ["none", "fail", "none"]],
    ["upper case and spacing", "MX;\n SPF = Pass ;\n DKIM=FAIL", ["pass", "fail", "none"]],
    ["comment ignored", "mx; dkim=fail (spf=pass in comment)", ["none", "fail", "none"]],
    ["pass among dkim signatures", "mx; dkim=fail header.d=a; dkim=pass header.d=b", ["none", "pass", "none"]],
    ["only the topmost header counts", "mx1; spf=pass\nmx2; dmarc=fail", ["pass", "none", "none"]],
    ["a forged lower header cannot turn a fail into a pass", "mx; dmarc=fail\nforged; dmarc=pass", ["none", "none", "fail"]],
    ["header.d not mistaken", "mx; dkim=pass header.d=spf.example", ["none", "pass", "none"]],
  ];
  it.each(cases)("%s", (_n, header, [spf, dkim, dmarc]) => {
    expect(ar(header)).toEqual({ spf, dkim, dmarc });
  });
});

describe("looksSpoofed", () => {
  const v = (spf: string, dkim: string, dmarc: string) => ({ spf, dkim, dmarc }) as never;
  it.each([
    [v("pass", "pass", "fail"), true],
    [v("fail", "fail", "none"), true],
    [v("fail", "pass", "none"), false],
    [v("none", "none", "none"), false],
    [v("pass", "pass", "pass"), false],
  ])("%j -> %s", (auth, expected) => {
    expect(looksSpoofed(auth)).toBe(expected);
  });
});
