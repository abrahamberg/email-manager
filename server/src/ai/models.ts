import { z } from "zod";

export type ModelRole = "triage" | "draft";

// The only place model ids live. Override per deployment with env vars.
const DEFAULTS: Record<ModelRole, string> = {
  triage: "gpt-6-luna",
  draft: "gpt-6-luna",
};

const envSchema = z.object({
  AI_TRIAGE_MODEL: z.string().trim().min(1).optional(),
  AI_DRAFT_MODEL: z.string().trim().min(1).optional(),
});

export function aiModels(env: NodeJS.ProcessEnv = process.env): Record<ModelRole, string> {
  const parsed = envSchema.parse(env);
  return {
    triage: parsed.AI_TRIAGE_MODEL ?? DEFAULTS.triage,
    draft: parsed.AI_DRAFT_MODEL ?? DEFAULTS.draft,
  };
}

/** USD per million tokens. */
export interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const PRICES: Record<string, Price> = {
  "gpt-6-luna": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

// Unknown models are priced like the dearest one so the budget errs on the safe side.
const FALLBACK_PRICE: Price = { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 };

export function priceOf(model: string): Price {
  return PRICES[model] ?? FALLBACK_PRICE;
}
