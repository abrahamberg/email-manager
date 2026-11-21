import { priceOf } from "./models";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };

export function estimateCost(model: string, usage: TokenUsage): number {
  const p = priceOf(model);
  const micro =
    usage.inputTokens * p.input +
    usage.outputTokens * p.output +
    usage.cacheWriteTokens * p.cacheWrite +
    usage.cacheReadTokens * p.cacheRead;
  return micro / 1_000_000;
}

export interface Budget {
  /** False once today's spend has reached the limit. */
  allows(): Promise<boolean>;
  record(usd: number): void;
  spent(): Promise<number>;
}

export interface BudgetOptions {
  limitUsd: number;
  /** Spend already recorded today (e.g. from the runs table), read once per day. */
  spentToday: () => Promise<number>;
  now?: () => Date;
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export function dailyBudget({ limitUsd, spentToday, now = () => new Date() }: BudgetOptions): Budget {
  let day: string | undefined;
  let total = 0;

  async function current(): Promise<number> {
    const today = dayOf(now());
    if (day !== today) {
      total = await spentToday();
      day = today;
    }
    return total;
  }

  return {
    async allows() {
      return (await current()) < limitUsd;
    },
    record(usd) {
      total += usd;
    },
    spent: current,
  };
}
