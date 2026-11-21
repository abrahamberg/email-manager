import type { Email } from "../mail/Email.js";
import type { Condition, Rule } from "./Rule.js";

const SOURCE_RANK: Record<Rule["source"], number> = { user: 2, feed: 1, ai: 0 };

function fieldValue(email: Email, field: Condition["field"], category: string | undefined): string {
  switch (field) {
    case "from": return `${email.from.address} ${email.from.name ?? ""}`;
    case "subject": return email.subject;
    case "body": return email.text;
    case "category": return category ?? "";
    case "listId": return email.headers["list-id"] ?? "";
  }
}

function conditionMatches(condition: Condition, email: Email, category: string | undefined): boolean {
  const needle = condition.value.trim().toLowerCase();
  if (condition.field === "from") {
    const candidates = [email.from.address, email.from.name ?? ""].map((v) => v.trim().toLowerCase());
    return candidates.some((c) => textMatches(condition.operator, c, needle));
  }
  return textMatches(condition.operator, fieldValue(email, condition.field, category).toLowerCase(), needle);
}

function textMatches(operator: Condition["operator"], haystack: string, needle: string): boolean {
  switch (operator) {
    case "contains": return haystack.includes(needle);
    case "endsWith": return haystack.endsWith(needle);
    case "is": return haystack === needle;
  }
}

function isLive(rule: Rule, now: Date): boolean {
  return rule.status === "active" && (!rule.expiresAt || new Date(rule.expiresAt) > now);
}

function outranks(a: Rule, b: Rule): boolean {
  if (a.priority !== b.priority) return a.priority > b.priority;
  return SOURCE_RANK[a.source] > SOURCE_RANK[b.source];
}

export function matchRules(email: Email, rules: Rule[], now: Date, category?: string): Rule | undefined {
  let best: Rule | undefined;
  for (const rule of rules) {
    if (!isLive(rule, now) || rule.when.length === 0) continue;
    if (!rule.when.every((c) => conditionMatches(c, email, category))) continue;
    if (!best || outranks(rule, best)) best = rule;
  }
  return best;
}
