import { z } from "zod";
import type { Budget } from "../ai/budget";
import { structuredCall, type Send } from "../ai/client";
import type { WhyItem, WhyWriter } from "../pipeline/lifeDeps";

const schema = z.object({ lines: z.array(z.string().max(200)) });

const SYSTEM = `For each numbered item from a bulk email, write one short line (under 15 words) on why it matches the user's
interest given with it. Return only the JSON the schema asks for: one line per item, in the same order.`;

const MAX_LINE = 140;

const listing = (items: WhyItem[]) =>
  items.map((it, i) => `${i + 1}. ${it.title} (${it.facts.join(", ")}). Interest: ${it.interest}`).join("\n");

/** One small call for a handful of picks. Item text came from email, so it goes in as quoted data. */
export function aiWhyWriter(deps: { send: Send; budget: Budget; model: string }): WhyWriter {
  return async (streamName, items) => {
    if (items.length === 0) return [];
    const result = await structuredCall({
      model: deps.model,
      system: SYSTEM,
      user: {
        task: "Write the lines for the items below.",
        email: { from: streamName, subject: "Picked items", date: "", text: listing(items) },
      },
      schema,
      maxTokens: 300,
      budget: deps.budget,
      send: deps.send,
    });
    return result.ok ? result.value.lines.map((l) => l.trim().slice(0, MAX_LINE)) : undefined;
  };
}
