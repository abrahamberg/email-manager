import { describe, expect, it } from "vitest";
import { embeddingRepo } from "../../src/store/embeddings";
import { runRepo } from "../../src/store/runs";
import { streamRepo } from "../../src/store/streams";
import { tokenRepo } from "../../src/store/tokens";
import { useFreshDb } from "./freshDb";

describe("activity repos", () => {
  const db = useFreshDb();

  it("logs runs and sums cost", async () => {
    const r = runRepo(db());
    const run = { id: "r1", startedAt: "2026-01-01T10:00:00.000Z", durationSec: 3.5, fetched: 10, handledByLogic: 8,
      sentToAi: 2, tokens: 1200, costUsd: 0.25 };
    await r.save(run);
    await r.save({ ...run, id: "r2", startedAt: "2026-01-01T11:00:00.000Z", error: "imap timeout" });
    expect((await r.recent(1))[0]).toMatchObject({ id: "r2", error: "imap timeout" });
    expect(await r.costSince("2026-01-01T00:00:00Z")).toBeCloseTo(0.5);
    expect(await r.costSince("2027-01-01T00:00:00Z")).toBe(0);
  });

  it("replaces stream picks and records feedback", async () => {
    const s = streamRepo(db());
    const stream = { id: "s1", name: "Jobs", areaId: "job", emailId: "<j@x>", period: "week", total: 40, rest: "38 others",
      picks: [{ id: "i1", title: "Role A", facts: ["remote"], why: "fits" }, { id: "i2", title: "Role B", facts: [], why: "" }] };
    await s.save(stream);
    await s.save({ ...stream, picks: [stream.picks[1]!] });
    await s.setFeedback("i2", "more");
    const [got] = await s.list();
    expect(got?.picks).toEqual([{ id: "i2", title: "Role B", facts: [], why: "", closes: undefined, feedback: "more" }]);
  });

  it("ranks embeddings by cosine similarity", async () => {
    const e = embeddingRepo(db());
    await e.save("message", "a", [1, 0, 0]);
    await e.save("message", "b", [0.7, 0.7, 0]);
    await e.save("message", "c", [0, 0, 1]);
    await e.save("fact", "z", [1, 0, 0]);
    expect(await e.get("message", "b")).toEqual([expect.closeTo(0.7), expect.closeTo(0.7), 0]);
    const near = await e.nearest("message", [1, 0.1, 0], 2);
    expect(near.map((n) => n.ownerId)).toEqual(["a", "b"]);
  });

  it("stores only ciphertext for tokens", async () => {
    const t = tokenRepo(db());
    await t.save("office365", { ciphertext: "enc:abc", expiresAt: "2026-01-01T01:00:00.000Z" });
    expect(await t.get("office365")).toEqual({ ciphertext: "enc:abc", expiresAt: "2026-01-01T01:00:00.000Z" });
    await t.remove("office365");
    expect(await t.get("office365")).toBeUndefined();
  });
});
