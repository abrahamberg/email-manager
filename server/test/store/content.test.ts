import type { Area, Decision, Settings } from "@email-manager/shared";
import { describe, expect, it } from "vitest";
import { areaRepo } from "../../src/store/areas";
import { decisionRepo } from "../../src/store/decisions";
import { factRepo } from "../../src/store/facts";
import { matterRepo } from "../../src/store/matters";
import { messageRepo } from "../../src/store/messages";
import { settingsRepo } from "../../src/store/settings";
import { useFreshDb } from "./freshDb";

const area: Area = { id: "fam", shortName: "Family", kind: "family", name: "Family", summary: "", people: [{ name: "Sam", role: "son" }] };

describe("content repos", () => {
  const db = useFreshDb();

  it("saves areas and facts", async () => {
    await areaRepo(db()).save(area);
    await areaRepo(db()).setNote("fam", "school runs");
    expect(await areaRepo(db()).get("fam")).toEqual({ ...area, note: "school runs" });
    const facts = factRepo(db());
    await facts.save({ id: "f1", areaId: "fam", kind: "appointment", title: "Dentist", detail: "Sam", at: "2026-03-01T09:00:00.000Z" });
    await facts.save({ id: "f2", areaId: "fam", kind: "note", title: "Shoe size", detail: "34" });
    expect((await facts.list("fam")).map((f) => f.id)).toEqual(["f1", "f2"]);
    expect((await facts.list())[0]).toMatchObject({ at: "2026-03-01T09:00:00.000Z", place: undefined });
  });

  it("stores message headers and compact text", async () => {
    const m = messageRepo(db());
    await m.save({ messageId: "<m1@x>", uid: 1, threadId: "t1", fromAddress: "a@x", subject: "Hi",
      receivedAt: "2026-01-01T00:00:00.000Z", category: "question", areaId: "fam", compactText: "hello" });
    expect(await m.get("<m1@x>")).toMatchObject({ uid: 1, category: "question", compactText: "hello" });
    expect(await m.inThread("t1")).toHaveLength(1);
  });

  it("groups messages into matters", async () => {
    const r = matterRepo(db());
    await r.save({ id: "mt1", areaId: "fam", title: "School trip", summary: "", status: "open", updatedAt: "2026-01-01T00:00:00.000Z" });
    await r.attach("mt1", "<m1@x>");
    await r.attach("mt1", "<m1@x>");
    expect(await r.messageIds("mt1")).toEqual(["<m1@x>"]);
    expect((await r.forMessage("<m1@x>"))?.id).toBe("mt1");
    expect((await r.open()).map((m) => m.id)).toEqual(["mt1"]);
  });

  it("keeps decisions whole and moves them between states", async () => {
    const d: Decision = { id: "d1", kind: "task", title: "Sign form", email: { id: "<m1@x>", from: { name: "A", address: "a@x" },
      subject: "Hi", receivedAt: "2026-01-01T00:00:00.000Z", snippet: "", category: "question" }, matter: "Trip", need: "Sign", why: "" };
    const r = decisionRepo(db());
    await r.add(d);
    expect(await r.pending()).toEqual([d]);
    await r.snooze("d1", "2026-01-02T00:00:00.000Z");
    expect(await r.pending()).toEqual([]);
    expect(await r.wake("2026-01-03T00:00:00.000Z")).toBe(1);
    await r.resolve("d1", "done");
    expect(await r.pending()).toEqual([]);
  });

  it("keeps one settings row", async () => {
    const s = settingsRepo(db());
    expect(await s.get()).toBeUndefined();
    const v = { dryRun: true, dailySendCap: 0 } as unknown as Settings;
    await s.save(v);
    await s.save({ ...v, dryRun: false });
    expect(await s.get()).toEqual({ ...v, dryRun: false });
  });
});
