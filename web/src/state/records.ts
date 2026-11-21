import type { EmailRef, Outcome, Receipt, Rule, Task } from "../domain/types";

let sequence = 0;

export function newId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

export function userReceipt(email: EmailRef, outcome: Outcome, reason: string): Receipt {
  return {
    id: newId("h"),
    email,
    outcome,
    signal: "rule",
    reason,
    confidence: 1,
    at: new Date().toISOString(),
    byUser: true,
  };
}

export function newTask(email: EmailRef, title: string, due?: string): Task {
  return { id: newId("t"), title, owner: "me", email, due, done: false };
}

export function newRule(text: string, source: Rule["source"], status: Rule["status"]): Rule {
  return { id: newId("r"), text, source, status, hits: 0 };
}
