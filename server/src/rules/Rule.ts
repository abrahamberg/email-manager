import { z } from "zod";

export const Condition = z.object({
  field: z.enum(["from", "subject", "body", "category", "listId"]),
  operator: z.enum(["contains", "endsWith", "is"]),
  value: z.string().min(1).max(200),
});

// "delete" is deliberately absent: no rule, from any source, can delete mail.
export const Action = z.object({
  kind: z.enum(["junk", "digest", "archive", "label", "alwaysShow", "task"]),
  label: z.string().max(60).optional(),
});

export const Rule = z.object({
  id: z.string().min(1),
  source: z.enum(["feed", "user", "ai"]),
  when: z.array(Condition).min(1),
  then: Action,
  priority: z.number().int().default(0),
  status: z.enum(["active", "proposed", "disabled"]),
  expiresAt: z.iso.datetime().optional(),
});

export type Condition = z.infer<typeof Condition>;
export type Action = z.infer<typeof Action>;
export type Rule = z.infer<typeof Rule>;
