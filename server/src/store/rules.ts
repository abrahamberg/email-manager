import type { RuleFeed } from "@email-manager/shared";
import type { RuleSource } from "../ports";
import { Rule } from "../rules/Rule";
import type { Db } from "./db";
import { iso, json } from "./convert";

export interface StoredRule {
  rule: Rule;
  text?: string;
  feedId?: string;
}

const upsertSql = `
  INSERT INTO rules (id, source, status, priority, expires_at, text, feed_id, definition)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
  ON CONFLICT (id) DO UPDATE SET source = $2, status = $3, priority = $4, expires_at = $5,
    text = $6, feed_id = $7, definition = $8::jsonb`;

function upsert(db: Db, { rule, text = "", feedId }: StoredRule): Promise<unknown> {
  return db.query(upsertSql, [
    rule.id, rule.source, rule.status, rule.priority, rule.expiresAt ?? null, text, feedId ?? null, json(rule),
  ]);
}

export function ruleRepo(db: Db) {
  const source: RuleSource = {
    async activeRules() {
      const rows = await db.query<{ definition: unknown; status: string }>(
        `SELECT definition, status FROM rules
         WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())
         ORDER BY priority DESC, id`,
      );
      // Re-validate on read: a bad row is skipped rather than trusted.
      return rows.flatMap((r) => {
        const parsed = Rule.safeParse({ ...(r.definition as object), status: r.status });
        return parsed.success ? [parsed.data] : [];
      });
    },
  };
  return {
    ...source,
    save: (r: StoredRule) => upsert(db, r).then(() => undefined),
    async setStatus(id: string, status: Rule["status"]) {
      await db.query("UPDATE rules SET status = $2 WHERE id = $1", [id, status]);
    },
    async addHits(id: string, n = 1) {
      await db.query("UPDATE rules SET hits = hits + $2 WHERE id = $1", [id, n]);
    },
    /** Swaps a feed's rules for a new version atomically; old rules from that feed are removed. */
    async replaceFeed(feed: Omit<RuleFeed, "updatedAt" | "ruleCount">, rules: Rule[]) {
      await db.transaction(async (tx) => {
        await tx.query("DELETE FROM rules WHERE feed_id = $1", [feed.id]);
        for (const rule of rules) await upsert(tx, { rule, feedId: feed.id });
        await tx.query(
          `INSERT INTO rule_versions (feed_id, version, name, host, verified, rule_count) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (feed_id, version) DO UPDATE SET fetched_at = now(), verified = $5, rule_count = $6`,
          [feed.id, feed.version, feed.name, feed.host, feed.verified, rules.length],
        );
      });
    },
    async feeds(): Promise<RuleFeed[]> {
      const rows = await db.query<{ feed_id: string; version: string; name: string; host: string; verified: boolean; rule_count: number; fetched_at: unknown }>(
        `SELECT DISTINCT ON (feed_id) * FROM rule_versions ORDER BY feed_id, fetched_at DESC`,
      );
      return rows.map((r) => ({
        id: r.feed_id, name: r.name, host: r.host, version: r.version,
        updatedAt: iso(r.fetched_at), verified: r.verified, ruleCount: r.rule_count,
      }));
    },
  };
}
