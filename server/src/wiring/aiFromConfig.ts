import type { Config } from "../config";
import { dailyBudget, type Budget } from "../ai/budget";
import type { Send } from "../ai/client";
import { openaiSend } from "../ai/openaiSend";
import { aiModels } from "../ai/models";
import { aiClassifier } from "../ai/triage";
import type { WhyWriter } from "../pipeline/lifeDeps";
import type { Classifier, Drafter } from "../ports";
import { aiDrafter } from "../replies/draftReply";
import { aiExtract } from "../streams/parsers/aiExtract";
import type { Extract } from "../streams/splitItems";
import { aiWhyWriter } from "./aiWhyWriter";

export interface AiParts {
  classifier?: Classifier;
  drafter?: Drafter;
  writeWhy?: WhyWriter;
  extract: Extract;
  /** Spend recorded by this run's calls, for the run row the daily budget reads back. */
  costUsd: () => number;
}

const startOfUtcDay = (now: Date) => `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

/** Without an API key every AI part is absent and the run is logic-only. */
export function aiFromConfig(config: Config, costSince: (since: string) => Promise<number>, send?: Send): AiParts {
  if (!config.OPENAI_API_KEY) return { extract: async () => [], costUsd: () => 0 };
  const models = aiModels();
  const { budget, costUsd } = trackedBudget(dailyBudget({
    limitUsd: config.AI_DAILY_BUDGET_USD,
    spentToday: () => costSince(startOfUtcDay(new Date())),
  }));
  const call = send ?? openaiSend(config.OPENAI_API_KEY);
  const small = { send: call, budget, model: models.triage };
  return {
    classifier: aiClassifier(small),
    drafter: aiDrafter({ send: call, budget, model: models.draft }),
    writeWhy: aiWhyWriter(small),
    extract: (email) => aiExtract(email, small),
    costUsd,
  };
}

function trackedBudget(inner: Budget): { budget: Budget; costUsd: () => number } {
  let spent = 0;
  return {
    budget: { ...inner, record: (usd) => (spent += usd, inner.record(usd)) },
    costUsd: () => spent,
  };
}
