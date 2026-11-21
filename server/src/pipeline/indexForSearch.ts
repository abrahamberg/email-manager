import type { Fact } from "@email-manager/shared";
import type { LifeRun } from "./lifeDeps";

/** The embedder is quiet on failure, so indexing never stops the run. */
export async function indexForSearch(messageId: string, compactText: string, facts: Fact[], life: LifeRun): Promise<void> {
  await life.index("message", messageId, compactText);
  for (const fact of facts) await life.index("fact", fact.id, `${fact.title}. ${fact.detail}`);
}
