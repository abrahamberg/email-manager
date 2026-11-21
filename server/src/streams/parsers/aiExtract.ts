import { z } from "zod";
import { structuredCall, type Send } from "../../ai/client";
import type { Budget } from "../../ai/budget";
import { compactEmail } from "../../ai/compactEmail";
import type { Email } from "../../mail/Email";
import type { ExtractedItem } from "../splitItems";

export const MAX_ITEMS = 20;
const MAX_FACTS = 3;

const schema = z.object({
  items: z.array(z.object({
    title: z.string().min(1).max(200),
    facts: z.array(z.string().max(120)),
    closes: z.string().max(40).optional(),
  })),
});

const SYSTEM = `You split one bulk email (newsletter, alert, digest) into its separate items, e.g. one job or one article.
Return only the JSON the schema asks for: a title, at most three short facts (company, place, topic) and a closing date
as YYYY-MM-DD only if the email states one. At most ${MAX_ITEMS} items. Skip headers, footers and ads.`;

export interface AiExtractDeps {
  send: Send;
  budget: Budget;
  model: string;
}

/** One cheap call. A failed call yields no items: the stream is then just not shown. */
export async function aiExtract(email: Email, deps: AiExtractDeps): Promise<ExtractedItem[]> {
  const result = await structuredCall({
    model: deps.model,
    system: SYSTEM,
    user: { task: "List the items in this email.", email: compactEmail(email) },
    schema,
    maxTokens: 2000,
    budget: deps.budget,
    send: deps.send,
  });
  if (!result.ok) return [];
  return result.value.items.slice(0, MAX_ITEMS).map((i) => ({
    title: i.title,
    facts: i.facts.slice(0, MAX_FACTS),
    ...(i.closes ? { closes: i.closes } : {}),
  }));
}
