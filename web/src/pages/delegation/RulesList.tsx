import { useState } from "react";
import type { Rule } from "../../domain/types";
import { RULE_SOURCE_LABELS } from "../../domain/labels";
import { plural } from "../../domain/format";
import { Button, Chip, Empty } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";
import { RuleEditor } from "./RuleEditor";

function RuleActions({ rule, onEdit }: { rule: Rule; onEdit: () => void }) {
  const { dispatch } = useStore();
  const set = (status: Rule["status"]) => dispatch({ type: "rule/setStatus", id: rule.id, status });
  if (rule.status === "proposed") {
    return (
      <div className="row">
        <Button size="small" variant="primary" onClick={() => set("active")}>Turn on</Button>
        <Button size="small" variant="quiet" onClick={() => set("disabled")}>Reject</Button>
      </div>
    );
  }
  return (
    <div className="row">
      {rule.when && <Button size="small" variant="quiet" onClick={onEdit}>Edit</Button>}
      {rule.status === "active"
        ? <Button size="small" variant="quiet" onClick={() => set("disabled")}>Turn off</Button>
        : <Button size="small" onClick={() => set("active")}>Turn on</Button>}
    </div>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <li><RuleEditor rule={rule} onClose={() => setEditing(false)} /></li>;
  return (
    <li className="rule" data-status={rule.status}>
      <div className="stack-tight">
        <span>{rule.text}</span>
        <span className="row muted small">
          <Chip tone={rule.source === "ai" ? "accent" : "default"}>{RULE_SOURCE_LABELS[rule.source]}</Chip>
          {rule.status !== "proposed" && <span>Used {plural(rule.hits, "time")}</span>}
          {rule.status === "disabled" && <span>· off</span>}
        </span>
      </div>
      <RuleActions rule={rule} onEdit={() => setEditing(true)} />
    </li>
  );
}

function RuleSection({ title, hint, rules }: { title: string; hint?: string; rules: Rule[] }) {
  return (
    <section className="stack">
      <div>
        <h2>{title}</h2>
        {hint && <p className="muted small">{hint}</p>}
      </div>
      {rules.length === 0 ? <Empty>None.</Empty> : <ul className="card list">{rules.map((rule) => <RuleRow key={rule.id} rule={rule} />)}</ul>}
    </section>
  );
}

export function RulesList() {
  const { rules } = useAppData();
  const [creating, setCreating] = useState(false);
  const byStatus = (status: Rule["status"]) => rules.filter((rule) => rule.status === status);
  return (
    <div className="stack-lg">
      {creating ? <RuleEditor onClose={() => setCreating(false)} /> : (
        <div><Button variant="primary" onClick={() => setCreating(true)}>New rule</Button></div>
      )}
      <RuleSection
        title="Proposed by AI"
        hint="Learned from your corrections and habits. Nothing here runs until you turn it on."
        rules={byStatus("proposed")}
      />
      <RuleSection title="Active" hint="Checked in order before any AI is used. Rules are free; AI costs tokens." rules={byStatus("active")} />
      <RuleSection title="Off" rules={byStatus("disabled")} />
    </div>
  );
}
