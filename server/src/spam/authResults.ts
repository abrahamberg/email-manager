import type { AuthResults } from "@email-manager/shared";
import type { Email } from "../mail/Email";

type Verdict = AuthResults["spf"];
const METHODS = ["spf", "dkim", "dmarc"] as const;

// pass -> pass; fail/softfail/permerror -> fail; neutral/none/temperror/policy/unknown -> none.
function toVerdict(raw: string): Verdict {
  if (raw === "pass") return "pass";
  if (raw === "fail" || raw === "softfail" || raw === "permerror") return "fail";
  return "none";
}

// One pass among several (e.g. DKIM signatures) is enough; otherwise any fail wins.
function merge(a: Verdict, b: Verdict): Verdict {
  if (a === "pass" || b === "pass") return "pass";
  return a === "fail" || b === "fail" ? "fail" : "none";
}

function stripComments(value: string): string {
  return value.replace(/\([^)]*\)/g, " ");
}

export function parseAuthResults(headers: Email["headers"]): AuthResults {
  const result: AuthResults = { spf: "none", dkim: "none", dmarc: "none" };
  const value = headers["authentication-results"];
  if (!value) return result;
  for (const line of value.split("\n")) {
    const re = /(?:^|[;\s])(spf|dkim|dmarc)\s*=\s*([a-z]+)/gi;
    for (const m of stripComments(line).matchAll(re)) {
      const method = m[1]!.toLowerCase() as (typeof METHODS)[number];
      result[method] = merge(result[method], toVerdict(m[2]!.toLowerCase()));
    }
  }
  return result;
}

export function looksSpoofed(auth: AuthResults): boolean {
  return auth.dmarc === "fail" || (auth.spf === "fail" && auth.dkim === "fail");
}
