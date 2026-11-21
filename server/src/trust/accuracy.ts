import type { Category, CategoryPolicy } from "@email-manager/shared";
import { suggestAutonomy } from "./autonomy.js";

export interface QuickCheckAnswer {
  category: Category;
  correct: boolean;
}

export type CategoryTally = Pick<CategoryPolicy, "correct" | "checked">;

export function tallyByCategory(answers: QuickCheckAnswer[]): Map<Category, CategoryTally> {
  const tallies = new Map<Category, CategoryTally>();
  for (const a of answers) {
    const t = tallies.get(a.category) ?? { correct: 0, checked: 0 };
    tallies.set(a.category, { correct: t.correct + (a.correct ? 1 : 0), checked: t.checked + 1 });
  }
  return tallies;
}

export function withAccuracy(policies: CategoryPolicy[], answers: QuickCheckAnswer[]): CategoryPolicy[] {
  const tallies = tallyByCategory(answers);
  return policies.map((p) => ({ ...p, ...(tallies.get(p.category) ?? { correct: 0, checked: 0 }) }));
}

export interface AutonomySuggestion {
  category: Category;
  from: CategoryPolicy["level"];
  to: CategoryPolicy["level"];
}

export function autonomySuggestions(policies: CategoryPolicy[]): AutonomySuggestion[] {
  return policies.flatMap((p) => {
    const to = suggestAutonomy(p);
    return to ? [{ category: p.category, from: p.level, to }] : [];
  });
}
