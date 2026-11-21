import { Rule, type Condition } from "../rules/Rule.js";

export interface ProposeOptions {
  /** The setting that lets safe proposals go live without approval. */
  autoActivate: boolean;
  /** Lowercase addresses the user has replied to. */
  repliedSenders: ReadonlySet<string>;
}

export type Proposal =
  | { kind: "saved"; rule: Rule; activated: boolean }
  | { kind: "duplicate"; existing: Rule }
  | { kind: "invalid"; error: string };

const AUTO_ACTIVATABLE: ReadonlySet<Rule["then"]["kind"]> = new Set(["digest", "label"]);

const sameConditions = (a: Condition[], b: Condition[]) => {
  const key = (c: Condition) => `${c.field}|${c.operator}|${c.value.toLowerCase()}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.length === right.length && left.every((k, i) => k === right[i]);
};

export function isDuplicate(rule: Rule, existing: Rule[]): Rule | undefined {
  return existing.find(
    (e) => e.then.kind === rule.then.kind && e.then.label === rule.then.label && sameConditions(e.when, rule.when),
  );
}

function matchesAddress(c: Condition, address: string): boolean {
  const value = c.value.toLowerCase();
  if (c.operator === "is") return address === value;
  if (c.operator === "endsWith") return address.endsWith(value);
  return address.includes(value);
}

export function touchesRepliedSender(rule: Rule, replied: ReadonlySet<string>): boolean {
  return rule.when.some((c) => c.field === "from" && [...replied].some((a) => matchesAddress(c, a)));
}

export function canAutoActivate(rule: Rule, opts: ProposeOptions): boolean {
  if (!opts.autoActivate || !AUTO_ACTIVATABLE.has(rule.then.kind)) return false;
  return !(rule.source === "ai" && touchesRepliedSender(rule, opts.repliedSenders));
}

export function proposeRule(suggestion: unknown, existing: Rule[], opts: ProposeOptions): Proposal {
  const parsed = Rule.safeParse(typeof suggestion === "object" && suggestion ? { ...suggestion, status: "proposed" } : suggestion);
  if (!parsed.success) return { kind: "invalid", error: parsed.error.message };
  const proposed: Rule = { ...parsed.data, status: "proposed" };
  const dup = isDuplicate(proposed, existing);
  if (dup) return { kind: "duplicate", existing: dup };
  const activated = canAutoActivate(proposed, opts);
  return { kind: "saved", rule: activated ? { ...proposed, status: "active" } : proposed, activated };
}
