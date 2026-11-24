import { describe, expect, it } from "vitest";
import { runMailbox } from "../../src/pipeline/runMailbox";
import { RESYNC_WINDOW } from "../../src/pipeline/startPoint";
import { fakeCursor, fakeMailbox, fakeOutcomes, fakeQueue, fakeSenders, fakeSpam, fixture, runDeps } from "./fakes";

const msgs = () => [
  { uid: 301, source: fixture("newsletter-with-list-unsubscribe.eml") },
  { uid: 302, source: fixture("personal-question.eml") },
  { uid: 303, source: fixture("receipt.eml") },
];

describe("runMailbox", () => {
  it("processes new mail, advances the cursor and records the run", async () => {
    const box = fakeMailbox({ uidValidity: 9, uidNext: 304 }, msgs());
    const senders = fakeSenders();
    const cursor = fakeCursor({ uidValidity: 9, uidNext: 301 });
    const { deps, records, runs } = runDeps({ mailbox: box.mailbox, cursor, senders });
    const result = await runMailbox(deps);
    expect(box.fetchedSince).toEqual([300]);
    expect(records.map((r) => r.uid)).toEqual([301, 302, 303]);
    expect(cursor.value).toEqual({ uidValidity: 9, uidNext: 304 });
    expect(senders.received).toHaveLength(3);
    expect(runs).toHaveLength(1);
    expect(result?.run).toMatchObject({ fetched: 3, handledByLogic: 3, sentToAi: 0 });
    expect(result?.run.error).toBeUndefined();
    expect(box.calls.at(-1)).toBe("close");
  });

  it("is a no-op when another run holds the lock", async () => {
    const box = fakeMailbox({ uidValidity: 9, uidNext: 304 }, msgs());
    const { deps, runs } = runDeps({ mailbox: box.mailbox });
    const [a, b] = await Promise.all([runMailbox(deps), runMailbox(deps)]);
    expect(a).toBeDefined();
    expect(b).toBeUndefined();
    expect(runs).toHaveLength(1);
    expect(box.calls.filter((c) => c === "open")).toHaveLength(1);
  });

  it("rescans a window after UIDVALIDITY changes and skips mail already seen", async () => {
    const box = fakeMailbox({ uidValidity: 10, uidNext: 304 }, msgs());
    const cursor = fakeCursor({ uidValidity: 9, uidNext: 5000 });
    const outcomes = fakeOutcomes(["<nl-1@digest.example>"]);
    const { deps, runs } = runDeps({ mailbox: box.mailbox, cursor, outcomes: outcomes.log });
    await runMailbox(deps);
    expect(box.fetchedSince).toEqual([304 - 1 - RESYNC_WINDOW]);
    expect(outcomes.records.map((r) => r.uid)).toEqual([302, 303]);
    expect(cursor.value).toEqual({ uidValidity: 10, uidNext: 304 });
    expect(runs[0]).toMatchObject({ fetched: 3, handledByLogic: 2 });
  });

  it("records a failing message and carries on", async () => {
    const list = msgs();
    const box = fakeMailbox({ uidValidity: 9, uidNext: 304 }, list);
    const cursor = fakeCursor({ uidValidity: 9, uidNext: 301 });
    const { deps, records } = runDeps({ mailbox: box.mailbox, cursor, spamCheck: fakeSpam(undefined, list[1]!.source) });
    const result = await runMailbox(deps);
    expect(records.map((r) => r.uid)).toEqual([301, 303]);
    expect(result?.aborted).toBe(false);
    expect(result?.run.error).toBe("mb-1 uid 302: spam engine exploded");
    expect(cursor.value?.uidNext).toBe(304);
  });

  it("marks the run aborted when the mailbox cannot open", async () => {
    const box = fakeMailbox({ uidValidity: 9, uidNext: 304 }, []);
    box.mailbox.open = async () => { throw new Error("connection refused"); };
    const { deps, runs } = runDeps({ mailbox: box.mailbox });
    const result = await runMailbox(deps);
    expect(result).toMatchObject({ aborted: true, run: { error: "mailbox mb-1: connection refused" } });
    expect(runs).toHaveLength(1);
  });

  it("runs prepare inside the lock before reading mail", async () => {
    const order: string[] = [];
    const box = fakeMailbox({ uidValidity: 9, uidNext: 1 }, []);
    const open = box.mailbox.open;
    box.mailbox.open = async () => (order.push("open"), open());
    const { deps } = runDeps({ mailbox: box.mailbox, prepare: async () => void order.push("migrate") });
    await runMailbox(deps);
    expect(order).toEqual(["migrate", "open"]);
  });

  it.each([
    ["the panel paused it", false, true, false],
    ["the panel did not pause it", false, false, true],
    ["the deployment is in dry-run, whatever the panel says", true, false, false],
  ])("touches the mailbox only when neither side says dry-run: %s", async (_name, envDryRun, paused, touches) => {
    const box = fakeMailbox({ uidValidity: 9, uidNext: 304 }, msgs());
    const cursor = fakeCursor({ uidValidity: 9, uidNext: 301 });
    const { deps, records } = runDeps({ mailbox: box.mailbox, cursor, dryRun: envDryRun, pausedInPanel: async () => paused });
    await runMailbox(deps);
    expect(box.changes().length > 0).toBe(touches);
    expect(records.every((r) => r.dryRun === !touches)).toBe(true);
  });
});

describe("runMailbox over several mailboxes", () => {
  const second = () => [{ uid: 7, source: fixture("receipt.eml") }];

  it("reads each mailbox under its own cursor and records where each message came from", async () => {
    const a = fakeMailbox({ uidValidity: 9, uidNext: 302 }, msgs().slice(0, 1));
    const b = fakeMailbox({ uidValidity: 3, uidNext: 8 }, second());
    const cursorA = fakeCursor({ uidValidity: 9, uidNext: 301 });
    const cursorB = fakeCursor();
    const { deps, records } = runDeps({ mailbox: a.mailbox });
    deps.mailboxes = async () => [{ id: "a", mailbox: a.mailbox, cursor: cursorA }, { id: "b", mailbox: b.mailbox, cursor: cursorB }];
    const result = await runMailbox(deps);
    expect(result).toMatchObject({ mailboxes: 2, aborted: false, run: { fetched: 2 } });
    expect(records.map((r) => [r.mailboxId, r.uid])).toEqual([["a", 301], ["b", 7]]);
    expect(cursorA.value).toEqual({ uidValidity: 9, uidNext: 302 });
    expect(cursorB.value).toEqual({ uidValidity: 3, uidNext: 8 });
  });

  it("notes a failing mailbox on the run and still reads the others", async () => {
    const broken = fakeMailbox({ uidValidity: 1, uidNext: 1 }, []);
    broken.mailbox.open = async () => { throw new Error("login refused"); };
    const ok = fakeMailbox({ uidValidity: 3, uidNext: 8 }, second());
    const { deps, records, runs } = runDeps({ mailbox: ok.mailbox });
    deps.mailboxes = async () => [
      { id: "mb-9", label: "Work", mailbox: broken.mailbox, cursor: fakeCursor() },
      { id: "ok", mailbox: ok.mailbox, cursor: fakeCursor() },
    ];
    const result = await runMailbox(deps);
    expect(records.map((r) => r.mailboxId)).toEqual(["ok"]);
    expect(result).toMatchObject({ aborted: true, run: { error: "mailbox Work: login refused" } });
    expect(broken.calls).toContain("close");
    expect(runs).toHaveLength(1);
  });

  it("carries out each undo in the mailbox it was queued for", async () => {
    const a = fakeMailbox({ uidValidity: 1, uidNext: 1 }, []);
    const b = fakeMailbox({ uidValidity: 1, uidNext: 1 }, []);
    const { deps } = runDeps({ mailbox: a.mailbox });
    const qa = fakeQueue([{ id: 1, messageId: "<in-a@x>", action: "move_to_inbox", from: "junk", attempts: 0 }]);
    const qb = fakeQueue([{ id: 2, messageId: "<in-b@x>", action: "move_to_inbox", from: "archive", attempts: 0 }]);
    deps.mailboxes = async () => [
      { id: "a", mailbox: a.mailbox, cursor: fakeCursor(), pendingActions: qa.queue },
      { id: "b", mailbox: b.mailbox, cursor: fakeCursor(), pendingActions: qb.queue },
    ];
    await runMailbox(deps);
    expect(a.changes()).toEqual(["move <in-a@x> from junk to inbox"]);
    expect(b.changes()).toEqual(["move <in-b@x> from archive to inbox"]);
  });

  it("saves no run row when no mailbox is set up", async () => {
    const { deps, runs } = runDeps({ mailbox: fakeMailbox({ uidValidity: 1, uidNext: 1 }, []).mailbox });
    deps.mailboxes = async () => [];
    expect(await runMailbox(deps)).toMatchObject({ mailboxes: 0, aborted: false });
    expect(runs).toHaveLength(0);
  });
});
