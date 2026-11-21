import { Hono } from "hono";
import { z } from "zod";
import type { Settings } from "@email-manager/shared";
import type { Store } from "../../store";
import { badRequest, done, parseBody } from "./validate";

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// Strict on purpose: unknown fields, including any auto-send switch, are rejected in v1.
const Patch = z.object({
  dryRun: z.boolean(),
  replies: z.object({
    signature: z.string().max(2000),
    knownContactsOnly: z.boolean(),
    topics: z.array(z.enum(["acknowledge", "confirmAppointment", "schedule", "declinePolitely", "shareKnownInfo"])),
    neverAutoReplyTo: z.array(z.string().max(200)).max(200),
  }).strict(),
  quietHours: z.object({ from: Time, to: Time }).strict(),
  briefingTimes: z.array(Time).max(6),
  aiDailyBudgetUsd: z.number().min(0).max(1000),
  dailySendCap: z.number().int().min(0).max(1000),
}).partial().strict();

export function settingsRoutes(store: Store): Hono {
  return new Hono().patch("/settings", async (c) => {
    const patch = await parseBody(c, Patch);
    if (!patch) return badRequest(c);
    const current = (await store.settings.get()) ?? ({} as Settings);
    await store.settings.save({ ...current, ...patch });
    return done(c);
  });
}
