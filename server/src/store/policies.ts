import type { AutonomyLevel, Category, CategoryPolicy } from "@email-manager/shared";
import type { Db } from "./db";

const CATEGORIES: [Category, string, boolean][] = [
  ["security", "Spam and phishing", false], ["newsletter", "Newsletters", false],
  ["marketing", "Marketing and offers", false], ["notification", "Notifications", false],
  ["receipt", "Receipts and statements", false], ["meeting", "Meeting requests", true],
  ["question", "Questions from contacts", true],
];

const known = (category: string) => CATEGORIES.some(([c]) => c === category);

interface Row { category: string; level: AutonomyLevel; correct: number; checked: number }

/** Labels and whether a category sends mail are fixed; only level and tallies are stored. */
export function policyRepo(db: Db) {
  return {
    async list(): Promise<CategoryPolicy[]> {
      const rows = new Map((await db.query<Row>("SELECT * FROM policies")).map((r) => [r.category, r]));
      return CATEGORIES.map(([category, label, sendsMail]) => {
        const r = rows.get(category);
        return { category, label, level: r?.level ?? "suggest", correct: r?.correct ?? 0, checked: r?.checked ?? 0, sendsMail };
      });
    },
    async setLevel(category: string, level: AutonomyLevel): Promise<boolean> {
      if (!known(category)) return false;
      await db.query(
        `INSERT INTO policies (category, level) VALUES ($1, $2)
         ON CONFLICT (category) DO UPDATE SET level = $2`, [category, level]);
      return true;
    },
    async recordAnswer(category: string, correct: boolean): Promise<boolean> {
      if (!known(category)) return false;
      await db.query(
        `INSERT INTO policies (category, correct, checked) VALUES ($1, $2, 1)
         ON CONFLICT (category) DO UPDATE SET correct = policies.correct + $2, checked = policies.checked + 1`,
        [category, correct ? 1 : 0]);
      return true;
    },
  };
}
