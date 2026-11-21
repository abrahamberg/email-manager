import { describe, expect, it } from "vitest";
import { runMailbox } from "../../src/pipeline/runMailbox";
import type { Classifier } from "../../src/ports";
import { fakeMailbox, fakeSenders, fixture, runDeps } from "./fakes";
import { WORK, classifierSaying, failingEmbedder, fakeDrafter, fakeWhy, lifeDeps } from "./lifeFakes";

const PERSONAL = "personal-question.eml";
const JOBS = "job-alert.eml";

async function runOne(name: string, opts: { classifier?: Classifier; life?: Parameters<typeof lifeDeps>[0]; dryRun?: boolean; received?: number } = {}) {
  const box = fakeMailbox({ uidValidity: 1, uidNext: 8 }, [{ uid: 7, source: fixture(name) }]);
  const life = lifeDeps(opts.life);
  const senders = fakeSenders({ "jobs-noreply@linkedin.example": { address: "jobs-noreply@linkedin.example", received: opts.received ?? 0, repliedTo: 0, opened: 0 } });
  const { deps, records, runs } = runDeps({ mailbox: box.mailbox, classifier: opts.classifier, life: life.deps, senders, dryRun: opts.dryRun ?? false });
  await runMailbox(deps);
  return { ...life, records, run: runs[0]!, changes: box.changes() };
}

describe("Phase 2 run", () => {
  it("dontMiss saves a decision, facts, a matter and search vectors", async () => {
    const classifier = classifierSaying({
      tier: "dontMiss", areaId: "a-school", matter: "School trip", need: "Sign the form.", deadline: "2025-11-14",
      facts: [{ kind: "deadline", title: "Form due", detail: "Trip form", at: "2025-11-14" }],
    });
    const r = await runOne(PERSONAL, { classifier });
    expect(r.records[0]).toMatchObject({ outcome: "kept", signal: "ai", tier: "dontMiss", areaId: "a-school" });
    expect(r.saved.decisions).toEqual([expect.objectContaining({
      kind: "task", matter: "School trip", need: "Sign the form.", deadline: "2025-11-14", title: "Sign the form.",
      email: expect.objectContaining({ id: "<pq-1@friend.example>", areaId: "a-school" }),
    })]);
    expect(r.saved.facts).toEqual([expect.objectContaining({ title: "Form due", areaId: "a-school", sourceEmailId: "<pq-1@friend.example>" })]);
    expect(r.saved.matters).toEqual([expect.objectContaining({ title: "School trip", areaId: "a-school", status: "open" })]);
    expect(r.saved.attached).toEqual([[r.saved.matters[0]!.id, "<pq-1@friend.example>"]]);
    expect(r.saved.messages[0]).toMatchObject({ areaId: "a-school", category: "question" });
    expect(r.saved.messages[0]!.compactText).toContain("dinner");
    expect(r.saved.embeddings.map((e) => e.kind)).toEqual(["message", "fact"]);
    expect(r.changes).toEqual([]);
  });

  it("worthKnowing labels with the area name and records the tier for the report", async () => {
    const r = await runOne(PERSONAL, { classifier: classifierSaying({ tier: "worthKnowing", areaId: WORK.id }) });
    expect(r.changes).toEqual(["label 7 Work"]);
    expect(r.records[0]).toMatchObject({ outcome: "labeled", tier: "worthKnowing", areaId: WORK.id });
    expect(r.saved.decisions).toEqual([]);
  });

  it("notWorth goes to the digest", async () => {
    const r = await runOne(PERSONAL, { classifier: classifierSaying({ tier: "notWorth" }) });
    expect(r.records[0]).toMatchObject({ outcome: "digest", signal: "ai", tier: "notWorth" });
    expect(r.changes).toEqual(["label 7 Digest", "move 7 archive"]);
  });

  it("needsReply in dry run puts the draft on the decision but appends nothing", async () => {
    const drafter = fakeDrafter();
    const r = await runOne(PERSONAL, { classifier: classifierSaying({ tier: "dontMiss", needsReply: true }), life: { drafter }, dryRun: true });
    expect(drafter.calls).toBe(1);
    expect(r.saved.decisions).toEqual([expect.objectContaining({ kind: "reply", draft: "Yes, Friday works for me.", confidence: 0.9 })]);
    expect(r.changes).toEqual([]);
  });

  it("needsReply outside dry run appends the draft and never sends", async () => {
    const r = await runOne(PERSONAL, { classifier: classifierSaying({ tier: "dontMiss", needsReply: true }), life: { drafter: fakeDrafter() } });
    expect(r.changes).toEqual(["draft"]);
  });

  it("without a classifier the message is kept by logic", async () => {
    const r = await runOne(PERSONAL);
    expect(r.records[0]).toMatchObject({ outcome: "kept", signal: "headers" });
    expect(r.saved.messages).toEqual([]);
  });

  it("an embedder failure is logged once and the run goes on", async () => {
    const classifier = classifierSaying({ tier: "dontMiss", areaId: "a-school", matter: "School trip", facts: [{ kind: "note", title: "N", detail: "d" }] });
    const r = await runOne(PERSONAL, { classifier, life: { embedder: failingEmbedder } });
    expect(r.run.error).toBeUndefined();
    expect(r.records[0]).toMatchObject({ tier: "dontMiss" });
    expect(r.saved.decisions).toHaveLength(1);
    expect(r.saved.embeddings).toEqual([]);
    expect(r.logs).toHaveLength(1);
  });
});

describe("streams in the run", () => {
  it("picks matching items, writes one AI why, and files the rest as digest", async () => {
    const writeWhy = fakeWhy();
    const classifier = classifierSaying({});
    const r = await runOne(JOBS, { classifier, life: { writeWhy }, received: 4 });
    expect(classifier.calls).toBe(0);
    expect(r.records[0]).toMatchObject({ outcome: "digest", tier: "worthKnowing", areaId: WORK.id });
    expect(r.saved.streams).toHaveLength(1);
    const stream = r.saved.streams[0]!;
    expect(stream).toMatchObject({ areaId: WORK.id, emailId: "<job-1@linkedin.example>", total: 8 });
    expect(stream.picks.map((p) => p.title)).toEqual(["Engineer at Acme"]);
    expect(stream.picks[0]!.why).toBe("Fits your Acme search.");
    expect(writeWhy.sizes).toEqual([1]);
  });

  it("is notWorth when nothing matches, and needs no AI", async () => {
    const r = await runOne(JOBS, { life: { areas: [] }, received: 4 });
    expect(r.records[0]).toMatchObject({ outcome: "digest", tier: "notWorth" });
    expect(r.saved.streams).toEqual([]);
  });

  it("is not a stream before the sender has written a few times", async () => {
    const r = await runOne(JOBS, { received: 0 });
    expect(r.saved.streams).toEqual([]);
    expect(r.records[0]!.tier).toBeUndefined();
  });
});
