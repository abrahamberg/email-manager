import { beforeAll, describe, expect, it } from "vitest";
import { useFreshDb } from "../store/freshDb";
import { seed, seededApp, send } from "./seed";

const getDb = useFreshDb();
let call: ReturnType<typeof send>;
let store: Awaited<ReturnType<typeof seed>>;
beforeAll(async () => {
  store = await seed(getDb());
  call = send(seededApp(getDb()));
});

describe("decisions", () => {
  it("accepts every kind without sending mail", async () => {
    expect((await call("POST", "/api/decisions/d-reply/accept", {})).status).toBe(204);
    expect((await call("POST", "/api/decisions/d-choice/accept", { optionIndex: 1 })).status).toBe(204);
    expect((await call("POST", "/api/decisions/d-task/accept", { title: "Pay rent" })).status).toBe(204);
    expect((await call("POST", "/api/decisions/d-rule/accept", {})).status).toBe(204);
    expect((await store.tasks.list()).some((t) => t.title === "Pay rent")).toBe(true);
    expect((await store.rules.listShared()).find((r) => r.id === "r1")?.status).toBe("active");
    const [row] = await getDb().query<{ status: string; resolution: string }>("SELECT status, resolution FROM decisions WHERE id = 'd-choice'");
    expect(row).toEqual({ status: "done", resolution: "chose: B" });
  });
  it("dismisses, snoozes and restores", async () => {
    expect((await call("POST", "/api/decisions/d-dismiss/dismiss", {})).status).toBe(204);
    expect((await call("POST", "/api/decisions/d-snooze/snooze", {})).status).toBe(204);
    expect(await store.decisions.snoozed()).toHaveLength(1);
    expect((await call("POST", "/api/decisions/restore", {})).status).toBe(204);
    expect(await store.decisions.snoozed()).toHaveLength(0);
  });
  it("rejects bad input and unknown ids", async () => {
    expect((await call("POST", "/api/decisions/d-choice/accept", { optionIndex: 9 })).status).toBe(400);
    expect((await call("POST", "/api/decisions/d-choice/accept", "nope")).status).toBe(400);
    expect((await call("POST", "/api/decisions/zz/accept", {})).status).toBe(404);
    expect((await call("POST", "/api/decisions/zz/dismiss", {})).status).toBe(404);
  });
});

describe("receipts", () => {
  it("undo flags the receipt and queues a move back for digest outcomes", async () => {
    expect((await call("POST", "/api/receipts/rc-m1-digest/undo", {})).status).toBe(204);
    expect(await getDb().query("SELECT 1 FROM receipt_marks WHERE receipt_id = 'rc-m1-digest' AND undone")).toHaveLength(1);
    expect(await getDb().query("SELECT 1 FROM pending_mailbox_actions WHERE message_id = 'm1' AND action = 'move_to_inbox'")).toHaveLength(1);
  });
  it("teach, 400 and 404", async () => {
    expect((await call("POST", "/api/receipts/rc-m1-digest/teach", { always: true })).status).toBe(204);
    expect((await call("POST", "/api/receipts/rc-m1-digest/teach", { always: "yes" })).status).toBe(400);
    expect((await call("POST", "/api/receipts/rc-zz-digest/undo", {})).status).toBe(404);
  });
});

describe("digest, tasks, policies", () => {
  it("sets a digest state and unsubscribes a category", async () => {
    expect((await call("POST", "/api/digest/dg-news@x.com", { state: "muted" })).status).toBe(204);
    expect((await call("POST", "/api/digest/unsubscribe", { category: "newsletter" })).status).toBe(204);
    const [r] = await getDb().query<{ state: string }>("SELECT state FROM digest_states WHERE group_id = 'dg-news@x.com'");
    expect(r?.state).toBe("unsubscribed");
    expect((await call("POST", "/api/digest/dg-news@x.com", { state: "loud" })).status).toBe(400);
    expect((await call("POST", "/api/digest/dg-nobody@x.com", { state: "muted" })).status).toBe(404);
  });
  it("toggles tasks", async () => {
    expect((await call("POST", "/api/tasks/t1/toggle", {})).status).toBe(204);
    expect((await call("POST", "/api/tasks/zz/toggle", {})).status).toBe(404);
  });
  it("applies a preset, with replies kept at suggest", async () => {
    expect((await call("POST", "/api/policies/preset", { preset: "handsOff" })).status).toBe(204);
    const levels = Object.fromEntries((await store.policies.list()).map((p) => [p.category, p.level]));
    expect(levels).toMatchObject({ newsletter: "quiet", question: "suggest", meeting: "suggest" });
    expect((await call("POST", "/api/policies/preset", { preset: "wild" })).status).toBe(400);
  });
});

describe("rules and settings", () => {
  const when = [{ field: "from", operator: "is", value: "boss@x.com" }];
  it("saves a user rule as active, and edits it in place", async () => {
    expect((await call("POST", "/api/rules", { when, then: { kind: "alwaysShow" } })).status).toBe(204);
    const saved = (await store.rules.listShared()).find((r) => r.source === "user");
    expect(saved?.status).toBe("active");
    expect((await call("POST", "/api/rules", { id: saved!.id, when, then: { kind: "task" } })).status).toBe(204);
    expect((await call("POST", "/api/rules", { id: "zz", when, then: { kind: "task" } })).status).toBe(404);
    expect((await call("POST", "/api/rules", { when: [], then: { kind: "delete" } })).status).toBe(400);
  });
  it("patches only known fields and refuses auto-send", async () => {
    expect((await call("PATCH", "/api/settings", { dryRun: false, dailySendCap: 3 })).status).toBe(204);
    expect(await store.settings.get()).toMatchObject({ dryRun: false, dailySendCap: 3 });
    expect((await call("PATCH", "/api/settings", { autoSend: true })).status).toBe(400);
    expect((await call("PATCH", "/api/settings", { replies: { signature: "", knownContactsOnly: true, topics: [], neverAutoReplyTo: [], autoSend: true } })).status).toBe(400);
    expect((await call("PATCH", "/api/settings", { quietHours: { from: "9pm", to: "07:00" } })).status).toBe(400);
  });
});

describe("picks, facts, areas", () => {
  it("stores pick feedback", async () => {
    expect((await call("POST", "/api/picks/i1/feedback", { streamId: "s1", feedback: "more" })).status).toBe(204);
    expect((await store.streams.list())[0]?.picks[0]?.feedback).toBe("more");
    expect((await call("POST", "/api/picks/i1/feedback", { streamId: "s1", feedback: "meh" })).status).toBe(400);
    expect((await call("POST", "/api/picks/zz/feedback", { streamId: "s1", feedback: "less" })).status).toBe(404);
  });
  it("forgets a fact and its embedding", async () => {
    expect((await call("DELETE", "/api/facts/f1")).status).toBe(204);
    expect(await store.facts.list()).toHaveLength(0);
    expect(await store.embeddings.get("fact", "f1")).toBeUndefined();
    expect((await call("DELETE", "/api/facts/f1")).status).toBe(404);
  });
  it("sets a note and adds an area", async () => {
    expect((await call("POST", "/api/areas/a1/note", { note: " mind the roof " })).status).toBe(204);
    expect((await store.areas.get("a1"))?.note).toBe("mind the roof");
    expect((await call("POST", "/api/areas", { name: " Garden ", note: "" })).status).toBe(204);
    expect((await store.areas.list()).some((a) => a.name === "Garden")).toBe(true);
    expect((await call("POST", "/api/areas", { name: "  ", note: "" })).status).toBe(400);
    expect((await call("POST", "/api/areas/zz/note", { note: "x" })).status).toBe(404);
  });
});

describe("delegation paths", () => {
  it("keeps 204/400/404 semantics", async () => {
    expect((await call("POST", "/api/quick-checks/q1", { correct: true })).status).toBe(204);
    expect((await call("POST", "/api/quick-checks/q1", { correct: "x" })).status).toBe(400);
    expect((await call("POST", "/api/quick-checks/zz", { correct: true })).status).toBe(404);
    expect((await call("POST", "/api/policies/newsletter/level", { level: "act" })).status).toBe(204);
  });
});
