import type { EmailDetail, EmailRef, RuleAction, RuleActionKind, RuleCondition, RuleField, RuleOperator } from "./types";

export const FIELD_LABELS: Record<RuleField, string> = {
  from: "Sender",
  subject: "Subject",
  body: "Text",
  category: "Kind of mail",
  listId: "Mailing list",
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: "contains",
  endsWith: "ends with",
  is: "is",
};

export const ACTION_LABELS: Record<RuleActionKind, string> = {
  alwaysShow: "Always show it to me",
  digest: "Move to the digest",
  label: "Add a label and archive",
  archive: "Archive",
  task: "Make it a task",
  junk: "Move to junk",
};

function fieldValue(email: EmailRef, detail: EmailDetail | undefined, field: RuleField): string {
  switch (field) {
    case "from": return email.from.address;
    case "subject": return email.subject;
    case "body": return detail?.body ?? email.snippet;
    case "category": return email.category;
    case "listId": return detail?.bulkHeaders.find((header) => header.startsWith("List-Id")) ?? "";
  }
}

function conditionMatches(condition: RuleCondition, text: string): boolean {
  const haystack = text.toLowerCase();
  const needle = condition.value.trim().toLowerCase();
  switch (condition.operator) {
    case "contains": return haystack.includes(needle);
    case "endsWith": return haystack.endsWith(needle);
    case "is": return haystack === needle;
  }
}

export function ruleMatches(conditions: RuleCondition[], email: EmailRef, detail?: EmailDetail): boolean {
  return conditions.length > 0 && conditions.every((condition) => conditionMatches(condition, fieldValue(email, detail, condition.field)));
}

export function isComplete(conditions: RuleCondition[]): boolean {
  return conditions.length > 0 && conditions.every((condition) => condition.value.trim() !== "");
}

function describeCondition(condition: RuleCondition): string {
  return `${FIELD_LABELS[condition.field].toLowerCase()} ${OPERATOR_LABELS[condition.operator]} “${condition.value.trim()}”`;
}

function describeAction(action: RuleAction): string {
  const text = ACTION_LABELS[action.kind].toLowerCase();
  return action.kind === "label" && action.label ? `label it “${action.label}” and archive` : text;
}

export function describeRule(conditions: RuleCondition[], action: RuleAction): string {
  const when = conditions.map(describeCondition).join(" and ");
  const sentence = `When ${when}: ${describeAction(action)}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
