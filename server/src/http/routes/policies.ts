import { Hono } from "hono";
import { z } from "zod";
import type { AutonomyLevel, CategoryPolicy } from "@email-manager/shared";
import type { Store } from "../../store";
import { badRequest, done, parseBody } from "./validate";

const Preset = z.object({ preset: z.enum(["careful", "balanced", "handsOff"]) }).strict();

// Mirrors the panel's presets. Replies stay at "suggest": sending is opt-in.
const BULK: Record<z.infer<typeof Preset>["preset"], AutonomyLevel> = { careful: "suggest", balanced: "act", handsOff: "quiet" };

const levelFor = (preset: keyof typeof BULK, p: CategoryPolicy): AutonomyLevel =>
  p.sendsMail || p.category === "question" ? "suggest" : BULK[preset];

/** The per-category level route lives in delegation.ts. */
export function policyRoutes(store: Store): Hono {
  return new Hono().post("/policies/preset", async (c) => {
    const body = await parseBody(c, Preset);
    if (!body) return badRequest(c);
    for (const p of await store.policies.list()) await store.policies.setLevel(p.category, levelFor(body.preset, p));
    return done(c);
  });
}
