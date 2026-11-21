import { beforeEach, describe, expect, it } from "vitest";
import type { AppData } from "../domain/types";
import { mockApi } from "../api/api";
import { answerQuestion } from "./assistant";
import { visiblePicks } from "../domain/briefing";
import { storeReducer, type StoreState } from "./history";

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

describe("snooze and rules", () => {
  it("brings snoozed decisions back", () => {
    const reply = decision(initial.data, "reply");
    const { data } = run(initial, { type: "decision/snooze", id: reply.id }, { type: "decision/restoreSnoozed" });
    expect(data.snoozed).toHaveLength(0);
    expect(data.decisions).toContainEqual(reply);
  });

  it("saves a new rule with a plain-language description", () => {
    const { data } = run(initial, {
      type: "rule/save",
      when: [{ field: "from", operator: "endsWith", value: "@substack.com" }],
      then: { kind: "digest" },
    });
    expect(data.rules[0]).toMatchObject({ status: "active", source: "user", text: "When sender ends with “@substack.com”: move to the digest" });
  });

  it("edits an existing rule in place", () => {
    const rule = initial.data.rules.find((item) => item.when)!;
    const { data } = run(initial, { type: "rule/save", id: rule.id, when: rule.when!, then: { kind: "archive" } });
    expect(data.rules.find((item) => item.id === rule.id)?.then).toEqual({ kind: "archive" });
    expect(data.rules).toHaveLength(initial.data.rules.length);
  });

  it("applies a starting preset without ever letting replies go out on their own", () => {
    const { data } = run(initial, { type: "policy/applyPreset", preset: "handsOff" });
    for (const policy of data.policies.filter((item) => item.sendsMail)) expect(policy.level).toBe("suggest");
  });
});

describe("what I know", () => {
  it("forgotten facts are no longer used to answer", () => {
    const { data } = run(initial, { type: "fact/forget", id: "f-tires" });
    expect(answerQuestion(data, "When is my tire change?").fact).toBeUndefined();
  });

  it("an empty note clears it", () => {
    const { data } = run(initial, { type: "area/setNote", id: "school", note: "  " });
    expect(data.areas.find((area) => area.id === "school")?.note).toBeUndefined();
  });

  it("adds a new area to keep track of, and ignores a blank name", () => {
    const added = run(initial, { type: "area/add", name: "Football club", note: "Coach on Saturdays" });
    expect(added.data.areas.at(-1)).toMatchObject({ name: "Football club", note: "Coach on Saturdays", kind: "other" });
    expect(run(initial, { type: "area/add", name: " ", note: "" }).data.areas).toHaveLength(initial.data.areas.length);
  });
});

describe("picked for you", () => {
  it("hides an item you said is not for you and keeps the others", () => {
    const stream = initial.data.streams[0]!;
    const [first, second] = stream.picks;
    const { data } = run(initial, { type: "pick/feedback", streamId: stream.id, itemId: first!.id, feedback: "less" });
    expect(visiblePicks(data.streams[0]!).map((item) => item.id)).toEqual([second!.id]);
  });
});
