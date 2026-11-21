import type { AppData, Receipt } from "../domain/types";
import { OUTCOME_LABELS } from "../domain/labels";
import { newId, newRule } from "./records";
import { recordCheck } from "./delegation";

function findReceipt(data: AppData, id: string): Receipt | undefined {
  return data.receipts.find((receipt) => receipt.id === id);
}

function markUndone(data: AppData, id: string): AppData {
  return {
    ...data,
    receipts: data.receipts.map((receipt) => (receipt.id === id ? { ...receipt, undone: true } : receipt)),
  };
}

function ruleTextFor(receipt: Receipt, always: boolean): string {
  const action = OUTCOME_LABELS[receipt.outcome].toLowerCase();
  const sender = receipt.email.from.address;
  return always ? `Mail from ${sender}: always ${action}` : `Mail from ${sender}: never ${action}, show it to me`;
}

// A correction is only useful if it is not needed twice, so every "that was
// wrong" turns into a rule proposal the user can accept with one key.
function proposeCorrection(data: AppData, receipt: Receipt): AppData {
  const rule = newRule(ruleTextFor(receipt, false), "ai", "proposed");
  const decision = {
    kind: "ruleProposal" as const,
    id: newId("d"),
    email: receipt.email,
    matter: `Mail from ${receipt.email.from.name}`,
    need: "Add a rule so I don't make this mistake again?",
    why: "You said my decision on this mail was wrong.",
    ruleId: rule.id,
  };
  return { ...data, rules: [rule, ...data.rules], decisions: [...data.decisions, decision] };
}

export function undoReceipt(data: AppData, id: string): AppData {
  return markUndone(data, id);
}

export function teachFromReceipt(data: AppData, id: string, always: boolean): AppData {
  const receipt = findReceipt(data, id);
  if (!receipt) return data;
  const rule = newRule(ruleTextFor(receipt, always), "user", "active");
  const taught = { ...data, rules: [rule, ...data.rules] };
  return always ? taught : markUndone(taught, id);
}

export function answerQuickCheck(data: AppData, id: string, correct: boolean): AppData {
  const check = data.quickChecks.find((item) => item.id === id);
  const receipt = check && findReceipt(data, check.receiptId);
  if (!check || !receipt) return data;
  const remaining = { ...data, quickChecks: data.quickChecks.filter((item) => item.id !== id) };
  const counted = recordCheck(remaining, receipt.email.category, correct);
  return correct ? counted : proposeCorrection(markUndone(counted, receipt.id), receipt);
}
