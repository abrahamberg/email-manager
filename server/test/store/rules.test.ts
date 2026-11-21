import { describe, expect, it } from "vitest";
import type { Rule } from "../../src/rules/Rule";
import { ruleRepo } from "../../src/store/rules";
import { useFreshDb } from "./freshDb";

const rule = (id: string, over: Partial<Rule> = {}): Rule => ({
  id, source: "user", status: "active", priority: 0,
  when: [{ field: "from", operator: "endsWith", value: "@spam.test" }], then: { kind: "junk" }, ...over,
});

describe("ruleRepo", () => {
  const db = useFreshDb();

  it("returns only active, unexpired rules, by priority", async () => {
    const repo = ruleRepo(db());
    await repo.save({ rule: rule("low") });
    await repo.save({ rule: rule("high", { priority: 5 }) });
    await repo.save({ rule: rule("proposed", { status: "proposed" }) });
    await repo.save({ rule: rule("expired", { expiresAt: "2000-01-01T00:00:00Z" }) });
    expect((await repo.activeRules()).map((r) => r.id)).toEqual(["high", "low"]);
    await repo.setStatus("high", "disabled");
    expect((await repo.activeRules()).map((r) => r.id)).toEqual(["low"]);
  });

  it("skips a stored rule that no longer validates", async () => {
    await db().query(
      `INSERT INTO rules (id, source, status, definition) VALUES ('bad', 'user', 'active', $1::jsonb)`,
      [JSON.stringify({ id: "bad", source: "user", when: [], then: { kind: "delete" } })],
    );
    expect((await ruleRepo(db()).activeRules()).map((r) => r.id)).not.toContain("bad");
  });

  it("swaps a feed's rules per version", async () => {
    const repo = ruleRepo(db());
    const feed = { id: "f1", name: "Feed", host: "rules.test", verified: true };
    await repo.replaceFeed({ ...feed, version: "1" }, [rule("f1-a", { source: "feed" }), rule("f1-b", { source: "feed" })]);
    await repo.replaceFeed({ ...feed, version: "2" }, [rule("f1-c", { source: "feed" })]);
    const ids = (await repo.activeRules()).map((r) => r.id);
    expect(ids).toContain("f1-c");
    expect(ids).not.toContain("f1-a");
    const [f] = await repo.feeds();
    expect(f).toMatchObject({ id: "f1", version: "2", ruleCount: 1, verified: true });
  });
});
