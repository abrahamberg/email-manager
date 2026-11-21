import { describe, expect, it } from "vitest";
import { createStore } from "../../src/store";
import { useFreshDb } from "./freshDb";

const at = "2026-11-21T09:00:00Z";

describe("phase 2 store additions", () => {
  const getDb = useFreshDb();
  const store = () => createStore(getDb());

  it("lists open matter candidates with threads, keys and vector", async () => {
    const s = store();
    await s.areas.save({ id: "home", shortName: "Home", kind: "home", name: "Home", summary: "", people: [] });
    await s.messages.save({ messageId: "m1", uid: 1, threadId: "t1", fromAddress: "a@x", subject: "s", receivedAt: at, compactText: "" });
    await s.messages.save({ messageId: "m2", uid: 2, threadId: "t2", fromAddress: "a@x", subject: "s", receivedAt: at, compactText: "" });
    await s.matters.save({ id: "a", areaId: "home", title: "Boiler", summary: "", status: "open", updatedAt: at, keys: ["inv-1", "o'x"], vector: [0.5, 1] });
    await s.matters.save({ id: "b", title: "Other", summary: "", status: "open", updatedAt: at });
    await s.matters.save({ id: "c", areaId: "home", title: "Done", summary: "", status: "closed", updatedAt: at });
    await s.matters.attach("a", "m1");
    await s.matters.attach("a", "m2");
    const all = await s.matters.openCandidates();
    expect(all.map((m) => m.id).sort()).toEqual(["a", "b"]);
    const a = all.find((m) => m.id === "a")!;
    expect(a.threadIds.sort()).toEqual(["t1", "t2"]);
    expect(a.keys).toEqual(["inv-1", "o'x"]);
    expect(a.vector).toEqual([0.5, 1]);
    expect(all.find((m) => m.id === "b")).toMatchObject({ threadIds: [], keys: [] });
    expect((await s.matters.openCandidates("home")).map((m) => m.id)).toEqual(["a"]);
    await s.matters.save({ id: "a", areaId: "home", title: "Boiler 2", summary: "", status: "open", updatedAt: at });
    expect((await s.matters.get("a"))).toMatchObject({ title: "Boiler 2", keys: ["inv-1", "o'x"], vector: [0.5, 1] });
  });

  it("stores the tier on outcomes", async () => {
    const s = store();
    await s.outcomes.record({ messageId: "t", uid: 1, outcome: "labeled", signal: "ai", reason: "r", dryRun: false, tier: "worthKnowing", at });
    expect((await s.outcomes.recent(1))[0]?.tier).toBe("worthKnowing");
  });

  it("tallies policies and rejects unknown categories", async () => {
    const s = store();
    expect(await s.policies.setLevel("meeting", "act")).toBe(true);
    expect(await s.policies.setLevel("bogus", "act")).toBe(false);
    await s.policies.recordAnswer("meeting", true);
    await s.policies.recordAnswer("meeting", false);
    expect((await s.policies.list()).find((p) => p.category === "meeting")).toMatchObject({
      level: "act", correct: 1, checked: 2, sendsMail: true, label: "Meeting requests",
    });
  });

  it("creates, lists and answers quick checks once", async () => {
    const s = store();
    await s.messages.save({ messageId: "q", uid: 1, fromAddress: "a@x", subject: "s", receivedAt: at, category: "marketing", compactText: "" });
    expect(await s.quickChecks.create({ id: "x", messageId: "nope", question: "?" })).toBe(false);
    await s.outcomes.record({ messageId: "q", uid: 1, outcome: "junk", signal: "ai", reason: "r", dryRun: false, at });
    expect(await s.quickChecks.create({ id: "qc", messageId: "q", question: "Junk?" })).toBe(true);
    expect(await s.quickChecks.listOpen()).toEqual([{ id: "qc", receiptId: "rc-q-junk", question: "Junk?" }]);
    expect(await s.quickChecks.answer("qc", true)).toEqual({ category: "marketing" });
    expect(await s.quickChecks.answer("qc", true)).toBeUndefined();
    expect(await s.quickChecks.listOpen()).toEqual([]);
  });

  it("lists, creates and toggles tasks", async () => {
    const s = store();
    await s.tasks.create({ id: "t1", title: "Pay", owner: "me", messageId: "m1", due: "2026-12-01" });
    expect(await s.tasks.list()).toEqual([{ id: "t1", title: "Pay", owner: "me", messageId: "m1", due: "2026-12-01", done: false }]);
    expect(await s.tasks.toggle("t1")).toBe(true);
    expect((await s.tasks.list())[0]?.done).toBe(true);
    expect(await s.tasks.toggle("zz")).toBe(false);
  });

  it("remembers the last briefing", async () => {
    const s = store();
    expect(await s.briefings.get()).toBeUndefined();
    await s.briefings.set(at);
    await s.briefings.set("2026-11-21T12:00:00Z");
    expect(await s.briefings.get()).toBe("2026-11-21T12:00:00.000Z");
  });

  it("lists rules in the shared shape and reports unknown ids", async () => {
    const s = store();
    await s.rules.save({ rule: { id: "r", source: "ai", when: [{ field: "subject", operator: "contains", value: "sale" }], then: { kind: "label", label: "Shops" }, priority: 1, status: "proposed" } });
    expect(await s.rules.listShared()).toEqual([{
      id: "r", text: "When subject contains “sale”: label it “Shops” and archive", source: "ai", status: "proposed", hits: 0,
      when: [{ field: "subject", operator: "contains", value: "sale" }], then: { kind: "label", label: "Shops" },
    }]);
    expect(await s.rules.setStatus("r", "active")).toBe(true);
    expect(await s.rules.setStatus("zz", "active")).toBe(false);
  });
});
