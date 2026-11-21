import { describe, expect, it } from "vitest";
import { parseEmail } from "../../src/mail/parseEmail";
import { processEmail, type ProcessDeps } from "../../src/pipeline/processEmail";
import type { Rule } from "../../src/rules/Rule";
import { clock, fakeClassifier, fakeMailbox, fakeOutcomes, fakeSpam, fixture, ruleFor } from "./fakes";

const SPAM = { score: 15, isSpam: true, symbols: ["BAYES_SPAM"] };

async function run(name: string, opts: { spam?: boolean; rules?: Rule[]; dryRun?: boolean; ai?: boolean } = {}) {
  const raw = fixture(name);
  const email = await parseEmail(7, raw);
  const box = fakeMailbox({ uidValidity: 1, uidNext: 8 }, []);
  const outcomes = fakeOutcomes();
  const classifier = fakeClassifier();
  const spamCheck = fakeSpam(opts.spam ? SPAM : undefined);
  const deps: ProcessDeps = {
    mailbox: box.mailbox, outcomes: outcomes.log, clock, dryRun: opts.dryRun ?? false, spamCheck,
    rules: opts.rules ?? [], sender: undefined, recentHashes: [], classifier: opts.ai === false ? undefined : classifier,
  };
  const decision = await processEmail(email, raw, deps);
  return { decision, changes: box.changes(), records: outcomes.records, aiCalls: classifier.calls };
}

const NEWSLETTER = "newsletter-with-list-unsubscribe.eml";
const PERSONAL = "personal-question.eml";

describe("processEmail order", () => {
  it.each([
    ["spam beats a rule and low value", { spam: true, rules: [ruleFor("digest.example", { kind: "label", label: "News" })] }, "junk", "spam"],
    ["a rule beats low value", { rules: [ruleFor("digest.example", { kind: "label", label: "News" })] }, "labeled", "rule"],
    ["low value when no rule", {}, "digest", "headers"],
  ] as const)("%s", async (_name, opts, outcome, signal) => {
    const r = await run(NEWSLETTER, opts as never);
    expect(r.decision).toMatchObject({ outcome, signal });
    expect(r.aiCalls).toBe(0);
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ outcome, signal, dryRun: false, messageId: "<nl-1@digest.example>" });
    expect(r.records[0]!.reason.length).toBeGreaterThan(0);
  });

  it("files a low-value message under Digest and archives it", async () => {
    expect((await run(NEWSLETTER)).changes).toEqual(["label 7 Digest", "move 7 archive"]);
  });

  it("asks AI only when logic did not decide", async () => {
    const r = await run(PERSONAL);
    expect(r.aiCalls).toBe(1);
    expect(r.decision).toMatchObject({ outcome: "kept", signal: "ai", confidence: 0.8 });
    expect(r.changes).toEqual([]);
  });

  it("keeps the message without a classifier", async () => {
    const r = await run(PERSONAL, { ai: false });
    expect(r.decision).toMatchObject({ outcome: "kept", signal: "headers" });
  });

  it("never asks AI after an alwaysShow rule", async () => {
    const r = await run(PERSONAL, { rules: [ruleFor("friend.example", { kind: "alwaysShow" })] });
    expect(r.aiCalls).toBe(0);
    expect(r.decision).toMatchObject({ outcome: "kept", signal: "rule" });
  });
});

describe("dry run", () => {
  it.each([
    ["spam", { spam: true }, "junk"],
    ["rule", { rules: [ruleFor("digest.example", { kind: "archive" })] }, "archived"],
    ["low value", {}, "digest"],
  ] as const)("records %s but touches nothing", async (_n, opts, outcome) => {
    const r = await run(NEWSLETTER, { ...opts, dryRun: true } as never);
    expect(r.changes).toEqual([]);
    expect(r.records[0]).toMatchObject({ outcome, dryRun: true });
  });
});
