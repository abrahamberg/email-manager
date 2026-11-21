import { useState } from "react";
import type { Rule, RuleAction, RuleActionKind, RuleCondition, RuleField, RuleOperator } from "../../domain/types";
import { ACTION_LABELS, FIELD_LABELS, OPERATOR_LABELS, describeRule, isComplete, ruleMatches } from "../../domain/rules";
import { plural } from "../../domain/format";
import { Button, Chip } from "../../components/ui";
import { EmailLink } from "../../components/EmailMeta";
import { useAppData, useStore } from "../../state/StoreProvider";
import { allEmails } from "../../state/selectors";

const EMPTY_CONDITION: RuleCondition = { field: "from", operator: "contains", value: "" };

function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => <option key={value} value={value}>{labels[value]}</option>);
}

function ConditionRow({ condition, index, onChange, onRemove }: {
  condition: RuleCondition;
  index: number;
  onChange: (condition: RuleCondition) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="condition">
      <span className="muted small">{index === 0 ? "When" : "and"}</span>
      <select aria-label="Field" value={condition.field} onChange={(event) => onChange({ ...condition, field: event.target.value as RuleField })}>
        {options(FIELD_LABELS)}
      </select>
      <select aria-label="Operator" value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value as RuleOperator })}>
        {options(OPERATOR_LABELS)}
      </select>
      <input aria-label="Value" value={condition.value} placeholder="e.g. @substack.com" onChange={(event) => onChange({ ...condition, value: event.target.value })} />
      {onRemove ? <Button size="small" variant="quiet" onClick={onRemove} aria-label="Remove condition">✕</Button> : <span />}
    </div>
  );
}

function Preview({ when }: { when: RuleCondition[] }) {
  const data = useAppData();
  if (!isComplete(when)) return <p className="muted small">Fill in the conditions to see which mail it catches.</p>;
  const matches = allEmails(data).filter((email) => ruleMatches(when, email, data.details[email.id]));
  return (
    <div className="stack-tight">
      <span className="section-title">Would catch {plural(matches.length, "email")} from today</span>
      {matches.map((email) => <span key={email.id} className="small">{email.from.name}: <EmailLink email={email} /></span>)}
    </div>
  );
}

export function RuleEditor({ rule, onClose }: { rule?: Rule; onClose: () => void }) {
  const { dispatch } = useStore();
  const [when, setWhen] = useState<RuleCondition[]>(rule?.when ?? [EMPTY_CONDITION]);
  const [then, setThen] = useState<RuleAction>(rule?.then ?? { kind: "digest" });
  const ready = isComplete(when) && (then.kind !== "label" || Boolean(then.label?.trim()));

  const updateCondition = (index: number, condition: RuleCondition) => setWhen(when.map((item, i) => (i === index ? condition : item)));
  const save = () => {
    dispatch({ type: "rule/save", id: rule?.id, when, then });
    onClose();
  };

  return (
    <div className="card stack rule-editor">
      <h3>{rule ? "Edit rule" : "New rule"}</h3>
      {when.map((condition, index) => (
        <ConditionRow
          key={index}
          index={index}
          condition={condition}
          onChange={(next) => updateCondition(index, next)}
          onRemove={when.length > 1 ? () => setWhen(when.filter((_, i) => i !== index)) : undefined}
        />
      ))}
      <Button size="small" variant="quiet" onClick={() => setWhen([...when, EMPTY_CONDITION])}>+ Add condition</Button>
      <div className="condition">
        <span className="muted small">Then</span>
        <select aria-label="Action" value={then.kind} onChange={(event) => setThen({ kind: event.target.value as RuleActionKind })}>
          {options(ACTION_LABELS)}
        </select>
        {then.kind === "label" && <input aria-label="Label" placeholder="Label name" value={then.label ?? ""} onChange={(event) => setThen({ ...then, label: event.target.value })} />}
      </div>
      {then.kind === "junk" && <Chip tone="warn">Mail from people you reply to still reaches you, whatever this rule says.</Chip>}
      {ready && <p className="rule-sentence">{describeRule(when, then)}</p>}
      <Preview when={when} />
      <div className="row">
        <Button variant="primary" onClick={save} disabled={!ready}>Save rule</Button>
        <Button variant="quiet" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
