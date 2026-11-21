import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildAppData } from "../../../src/life/buildAppData";
import { todayRoutes } from "../../../src/http/routes/today";
import { createStore } from "../../../src/store";
import { startOfTodayStockholm, nextBriefing } from "../../../src/life/today/time";
import { useFreshDb } from "../../store/freshDb";

const Email = z.object({ id: z.string(), subject: z.string(), category: z.string() });
const AppData = z.object({
  briefing: z.object({ since: z.string(), arrived: z.number(), nextBriefing: z.string(),
    ignored: z.array(z.object({ label: z.string(), count: z.number() })) }),
  details: z.record(z.string(), z.object({ body: z.string(), trace: z.array(z.object({ note: z.string() })) })),
  profile: z.object({ emailsRead: z.number(), wouldHaveDone: z.array(z.object({ count: z.number() })) }),
  areas: z.array(z.object({ id: z.string() })),
  facts: z.array(z.object({ id: z.string() })),
  decisions: z.array(z.object({ id: z.string(), kind: z.string(), email: Email })),
  report: z.array(z.object({ id: z.string(), areaId: z.string(), text: z.string(), emailId: z.string() })),
  streams: z.array(z.object({ id: z.string(), picks: z.array(z.object({ id: z.string() })) })),
  snoozed: z.array(z.unknown()),
  quickChecks: z.array(z.unknown()),
  receipts: z.array(z.object({ id: z.string(), email: Email, outcome: z.string() })),
  digest: z.array(z.object({ id: z.string(), entries: z.array(z.object({ subject: z.string() })) })),
  tasks: z.array(z.object({ id: z.string(), owner: z.enum(["me", "them"]) })),
  policies: z.array(z.object({ category: z.string() })),
  rules: z.array(z.object({ id: z.string(), text: z.string() })),
  feeds: z.array(z.unknown()),
  runs: z.array(z.object({ id: z.string() })),
  settings: z.object({ briefingTimes: z.array(z.string()), dryRun: z.boolean() }),
});

const NOW = new Date("2026-11-21T10:00:00Z");
const at = "2026-11-21T09:00:00Z";

describe("today payload", () => {
  const getDb = useFreshDb();
  beforeEach(async () => {
    const db = getDb();
    for (const t of ["outcomes", "messages", "decisions", "streams", "areas", "runs", "rules", "settings"])
      await db.exec(`DELETE FROM ${t}`);
  });

  it("is a valid empty payload on an empty database", async () => {
    const data = AppData.parse(await buildAppData(getDb(), NOW));
    expect(data.decisions).toEqual([]);
    expect(data.briefing.since).toBe("2026-11-20T23:00:00.000Z");
    expect(data.briefing.nextBriefing).toBe("13:00");
  });

  it("builds every section from a few rows", async () => {
    const db = getDb();
    const s = createStore(db);
    await s.areas.save({ id: "home", shortName: "Home", kind: "home", name: "Home", summary: "", people: [] });
    const msg = (id: string, subject: string, category: "newsletter" | "question", areaId?: string) =>
      s.messages.save({ messageId: id, uid: 1, fromAddress: `${id}@x.example`, subject, receivedAt: at, category, areaId, compactText: "hello" });
    await msg("m1", "Weekly news", "newsletter");
    await msg("m2", "Boiler service", "question", "home");
    await s.outcomes.record({ messageId: "m1", uid: 1, outcome: "digest", signal: "rule", reason: "list", dryRun: false, at });
    await s.outcomes.record({ messageId: "m2", uid: 2, outcome: "labeled", signal: "ai", reason: "home", areaId: "home", dryRun: false, at });
    const email = { id: "m2", from: { name: "A", address: "a@x" }, subject: "Boiler service", receivedAt: at, snippet: "", category: "question" as const };
    await s.decisions.add({ id: "d2", kind: "task", email, matter: "m", need: "n", why: "w", title: "Book", deadline: "2026-12-01" });
    await s.decisions.add({ id: "d1", kind: "task", email, matter: "m", need: "n", why: "w", title: "Pay", deadline: "2026-11-25" });
    await s.streams.save({ id: "st", name: "Jobs", areaId: "home", emailId: "m1", period: "week", total: 3, rest: "", picks: [{ id: "p", title: "t", facts: [], why: "" }] });
    await s.runs.save({ id: "r1", startedAt: at, durationSec: 1, fetched: 2, handledByLogic: 2, sentToAi: 0, tokens: 0, costUsd: 0 });
    await s.rules.save({ rule: { id: "u1", source: "user", when: [{ field: "from", operator: "is", value: "a@x" }], then: { kind: "digest" }, priority: 0, status: "active" } });

    const data = AppData.parse(await buildAppData(db, NOW));
    expect(data.decisions.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(data.briefing.arrived).toBe(2);
    expect(data.briefing.ignored).toEqual([{ label: "newsletters", count: 1 }]);
    expect(data.report).toEqual([{ id: "rep-m2", areaId: "home", text: "Boiler service", emailId: "m2" }]);
    expect(data.receipts).toHaveLength(2);
    expect(data.digest[0]?.entries[0]?.subject).toBe("Weekly news");
    expect(data.tasks).toHaveLength(2);
    expect(data.streams[0]?.picks).toHaveLength(1);
    expect(data.details["m2"]?.trace[0]?.note).toBe("home");
    expect(data.rules[0]?.id).toBe("u1");
    expect(data.runs).toHaveLength(1);
  });

  it("serves it over GET /today", async () => {
    const res = await todayRoutes(getDb()).request("/today");
    expect(res.status).toBe(200);
    AppData.parse(await res.json());
  });
});

describe("time helpers", () => {
  it("handles summer and winter offsets", () => {
    expect(startOfTodayStockholm(new Date("2026-07-01T10:00:00Z"))).toBe("2026-06-30T22:00:00.000Z");
    expect(startOfTodayStockholm(new Date("2026-11-21T23:30:00Z"))).toBe("2026-11-21T23:00:00.000Z");
  });
  it("wraps to tomorrow's first briefing", () => {
    expect(nextBriefing(["08:00", "17:00"], new Date("2026-11-21T20:00:00Z"))).toBe("08:00");
  });
});
