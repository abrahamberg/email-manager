import { z } from "zod";
import type { SpamCheck, SpamVerdict } from "../ports";

const TIMEOUT_MS = 5000;

const Response = z.object({
  score: z.number(),
  required_score: z.number(),
  action: z.string(),
  symbols: z.record(z.string(), z.unknown()).default({}),
});

export function rspamdCheck(url: string, fetchImpl: typeof fetch = fetch): SpamCheck {
  return {
    async check(raw: Uint8Array): Promise<SpamVerdict | undefined> {
      try {
        const res = await fetchImpl(`${url.replace(/\/+$/, "")}/checkv2`, {
          method: "POST",
          body: raw,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return undefined;
        const body = Response.parse(await res.json());
        return {
          score: body.score,
          isSpam: body.action === "reject" || body.score >= body.required_score,
          symbols: Object.keys(body.symbols),
        };
      } catch {
        return undefined;
      }
    },
  };
}
