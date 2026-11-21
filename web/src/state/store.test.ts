import { beforeEach, describe, expect, it } from "vitest";
import type { AppData } from "../domain/types";
import { mockApi } from "../api/api";
import { storeReducer, type StoreState } from "./history";
import { answerQuery } from "./commandBar";

let initial: StoreState;

beforeEach(async () => {
  initial = { data: await mockApi.loadAppData(), past: [] };
});

function run(state: StoreState, ...events: Parameters<typeof storeReducer>[1][]): StoreState {
  return events.reduce(storeReducer, state);
}

function decision(data: AppData, kind: string) {
  const found = data.decisions.find((item) => item.kind === kind);
  if (!found) throw new Error(`no ${kind} decision in mock data`);
  return found;
}

describe("decisions", () => {
  it("accepting a reply removes it and records that you replied", () => {
    const reply = decision(initial.data, "reply");
    const { data } = run(initial, { type: "decision/accept", id: reply.id });
    expect(data.decisions.map((item) => item.id)).not.toContain(reply.id);
    expect(data.receipts[0]).toMatchObject({ outcome: "replied", byUser: true, email: reply.email });
  });

  it("accepting a task decision creates the task with the edited title", () => {
    const task = decision(initial.data, "task");
    const { data } = run(initial, { type: "decision/accept", id: task.id, edit: { title: "Sign it" } });
    expect(data.tasks[0]).toMatchObject({ title: "Sign it", owner: "me", done: false });
  });

  it("accepting a rule proposal turns the rule on", () => {
    const proposal = decision(initial.data, "ruleProposal");
    const ruleId = proposal.kind === "ruleProposal" ? proposal.ruleId : "";
    const { data } = run(initial, { type: "decision/accept", id: proposal.id });
    expect(data.rules.find((rule) => rule.id === ruleId)?.status).toBe("active");
  });

  it("snoozing keeps the decision for later", () => {
    const reply = decision(initial.data, "reply");
    const { data } = run(initial, { type: "decision/snooze", id: reply.id });
    expect(data.snoozed).toContainEqual(reply);
  });
});

describe("quick checks", () => {
  it("a wrong answer undoes the action and proposes a rule", () => {
    const check = initial.data.quickChecks[0]!;
    const { data } = run(initial, { type: "quickCheck/answer", id: check.id, correct: false });
    expect(data.receipts.find((receipt) => receipt.id === check.receiptId)?.undone).toBe(true);
    expect(data.decisions.at(-1)?.kind).toBe("ruleProposal");
    expect(data.rules[0]?.status).toBe("proposed");
  });

  it("a right answer counts towards the category's accuracy", () => {
    const check = initial.data.quickChecks[0]!;
    const category = initial.data.receipts.find((receipt) => receipt.id === check.receiptId)!.email.category;
    const before = initial.data.policies.find((policy) => policy.category === category)!;
    const { data } = run(initial, { type: "quickCheck/answer", id: check.id, correct: true });
    expect(data.policies.find((policy) => policy.category === category)).toMatchObject({
      correct: before.correct + 1,
      checked: before.checked + 1,
    });
  });
});

describe("undo", () => {
  it("restores the state before the last action", () => {
    const reply = decision(initial.data, "reply");
    const state = run(initial, { type: "decision/accept", id: reply.id }, { type: "store/undo" });
    expect(state.data).toEqual(initial.data);
  });

  it("ignores actions that change nothing", () => {
    expect(run(initial, { type: "decision/accept", id: "missing" })).toBe(initial);
  });
});

describe("command bar", () => {
  it("offers to unsubscribe from marketing senders", () => {
    expect(answerQuery(initial.data, "unsubscribe from marketing").proposal?.action).toEqual({
      type: "digest/unsubscribeCategory",
      category: "marketing",
    });
  });

  it("finds emails by sender", () => {
    const answer = answerQuery(initial.data, "anything from Anna?");
    expect(answer.matches.map((email) => email.from.name)).toContain("Anna Lind");
  });
});
