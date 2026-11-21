import type { RuleAction, RuleCondition } from "@email-manager/shared";

const FIELD: Record<RuleCondition["field"], string> = {
  from: "sender", subject: "subject", body: "text", category: "kind of mail", listId: "mailing list",
};
const OPERATOR: Record<RuleCondition["operator"], string> = { contains: "contains", endsWith: "ends with", is: "is" };
const ACTION: Record<RuleAction["kind"], string> = {
  alwaysShow: "always show it to me", digest: "move to the digest", label: "add a label and archive",
  archive: "archive", task: "make it a task", junk: "move to junk",
};

const describeCondition = (c: RuleCondition) => `${FIELD[c.field]} ${OPERATOR[c.operator]} “${c.value.trim()}”`;

const describeAction = (a: RuleAction) =>
  a.kind === "label" && a.label ? `label it “${a.label}” and archive` : ACTION[a.kind];

/** The same plain sentence the panel writes for a rule. */
export function describeRule(conditions: RuleCondition[], action: RuleAction): string {
  const sentence = `When ${conditions.map(describeCondition).join(" and ")}: ${describeAction(action)}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
