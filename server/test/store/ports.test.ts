import { describe, expect, it } from "vitest";
import { cursorRepo } from "../../src/store/cursor";
import { outcomeRepo } from "../../src/store/outcomes";
import { runLock } from "../../src/store/runLock";
import { senderRepo } from "../../src/store/senders";
import { useFreshDb } from "./freshDb";

describe("port repos", () => {
  const db = useFreshDb();

  it("records outcomes and knows what it has seen", async () => {
    const log = outcomeRepo(db());
    expect(await log.seen("<a@x>")).toBe(false);
    await log.record({ messageId: "<a@x>", uid: 4_000_000_000, outcome: "junk", signal: "spam", reason: "score 9",
      confidence: 0.9, dryRun: true, at: "2026-01-02T03:04:05.000Z" });
    expect(await log.seen("<a@x>")).toBe(true);
    expect(await log.recent(5)).toEqual([{ messageId: "<a@x>", uid: 4_000_000_000, outcome: "junk", signal: "spam",
      reason: "score 9", confidence: 0.9, areaId: undefined, dryRun: true, at: "2026-01-02T03:04:05.000Z" }]);
  });

  it("stores the mailbox cursor, beyond 32-bit uids", async () => {
    const c = cursorRepo(db());
    expect(await c.get()).toBeUndefined();
    await c.set({ uidValidity: 4_294_967_295, uidNext: 10 });
    await c.set({ uidValidity: 4_294_967_295, uidNext: 11 });
    expect(await c.get()).toEqual({ uidValidity: 4_294_967_295, uidNext: 11 });
  });

  it("counts sender history case-insensitively", async () => {
    const s = senderRepo(db());
    await s.recordReceived("Ann@Example.com");
    await s.recordReceived("ann@example.com");
    await s.recordReplied("ann@example.com");
    expect(await s.get("ANN@example.com")).toEqual({ address: "ann@example.com", received: 2, repliedTo: 1, opened: 0 });
    expect(await s.get("nobody@example.com")).toBeUndefined();
  });

  it("lets only one run hold the lock", async () => {
    const lock = runLock(db());
    let release!: () => void;
    const first = lock.tryRun(() => new Promise<string>((r) => (release = () => r("first"))));
    expect(await lock.tryRun(async () => "second")).toBeUndefined();
    release();
    expect(await first).toBe("first");
    expect(await lock.tryRun(async () => "third")).toBe("third");
  });

  it("releases the lock when work throws", async () => {
    const lock = runLock(db());
    await expect(lock.tryRun(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await lock.tryRun(async () => 1)).toBe(1);
  });
});
