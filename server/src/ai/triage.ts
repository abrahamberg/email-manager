import { z } from "zod";
import type { Category } from "@email-manager/shared";
import type { Classifier, CompactEmail, FactDraft, Triage, TriageContext } from "../ports";
import type { Budget } from "./budget";
import { type FailReason, type Send, structuredCall } from "./client";
import { TRIAGE_SYSTEM, triageTask } from "./prompts";

const CATEGORIES = ["newsletter", "receipt", "notification", "meeting", "question", "marketing", "security"] as const satisfies readonly Category[];
const FACT_KINDS = ["appointment", "deadline", "address", "person", "note"] as const satisfies readonly FactDraft["kind"][];

// Deliberately loose: limits are enforced after parsing so a long title doesn't throw away a good triage.
const factSchema = z.object({
  kind: z.enum(FACT_KINDS),
  title: z.string(),
  detail: z.string(),
  at: z.string().optional(),
  place: z.string().optional(),
});

export const triageSchema = z.object({
  tier: z.enum(["dontMiss", "worthKnowing", "notWorth"]),
  category: z.enum(CATEGORIES),
  areaId: z.string().optional(),
  matter: z.string().optional(),
  need: z.string().optional(),
  deadline: z.string().optional(),
  needsReply: z.boolean(),
  facts: z.array(factSchema),
  confidence: z.number(),
  why: z.string(),
});

type ModelTriage = z.infer<typeof triageSchema>;

const MAX_FACTS = 5;
const MAX_MATTER = 60;
const MAX_LINE = 300;
const MAX_DETAIL = 500;
const MAX_TOKENS = 1024;

const isoDate = (s?: string) => (s && !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}/.test(s) ? s : undefined);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const nonEmpty = (s?: string) => (s?.trim() ? s.trim() : undefined);
const cap = (s: string, max: number) => s.trim().slice(0, max);

function cleanFact(f: ModelTriage["facts"][number]): FactDraft {
  return {
    kind: f.kind, title: cap(f.title, MAX_LINE), detail: cap(f.detail, MAX_DETAIL), at: isoDate(f.at), place: nonEmpty(f.place)?.slice(0, MAX_LINE),
  };
}

/** Never trust ids or sizes from the model: keep only what the context allows. */
export function toTriage(raw: ModelTriage, context: TriageContext): Triage {
  const knownArea = context.areas.some((a) => a.id === raw.areaId);
  return {
    tier: raw.tier,
    category: raw.category,
    areaId: knownArea ? raw.areaId : undefined,
    matter: nonEmpty(raw.matter)?.slice(0, MAX_MATTER),
    need: nonEmpty(raw.need)?.slice(0, MAX_DETAIL),
    deadline: isoDate(raw.deadline),
    needsReply: raw.needsReply,
    facts: raw.facts.slice(0, MAX_FACTS).map(cleanFact).filter((f) => f.title),
    confidence: clamp01(raw.confidence),
    why: cap(raw.why, MAX_LINE),
  };
}

const GUESSES: [RegExp, Category][] = [
  [/password|sign-?in|verify|security|2fa|login/i, "security"],
  [/receipt|invoice|order|payment|paid/i, "receipt"],
  [/meeting|invite|calendar|webinar/i, "meeting"],
  [/unsubscribe|newsletter|digest/i, "newsletter"],
  [/sale|offer|% off|discount/i, "marketing"],
];

export function guessCategory(email: CompactEmail): Category {
  const text = `${email.subject}\n${email.text.slice(0, 2000)}`;
  return GUESSES.find(([re]) => re.test(text))?.[1] ?? "question";
}

/** Keeps the email visible and un-actioned when the model can't be used. */
export function safeDefault(email: CompactEmail, reason: FailReason): Triage {
  return {
    tier: "worthKnowing",
    category: guessCategory(email),
    needsReply: false,
    facts: [],
    confidence: 0,
    why: `AI triage unavailable (${reason}); kept for you to look at.`,
  };
}

export interface ClassifierDeps {
  send: Send;
  budget: Budget;
  model: string;
}

export function aiClassifier({ send, budget, model }: ClassifierDeps): Classifier {
  return {
    async triage(email, context) {
      const result = await structuredCall({
        model,
        system: TRIAGE_SYSTEM,
        user: { task: triageTask(context), email },
        schema: triageSchema,
        maxTokens: MAX_TOKENS,
        budget,
        send,
      });
      return result.ok ? toTriage(result.value, context) : safeDefault(email, result.reason);
    },
  };
}
