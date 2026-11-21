import type { Decision, Rule } from "../../domain/types";
import { formatDay } from "../../domain/format";
import { RULE_SOURCE_LABELS } from "../../domain/labels";
import { Chip } from "../../components/ui";
import { Confidence } from "../../components/Confidence";
import type { DecisionEdit } from "../../state/actions";

interface BodyProps {
  decision: Decision;
  edit: DecisionEdit;
  editing: boolean;
  rules: Rule[];
  onEdit: (edit: DecisionEdit) => void;
}

function DraftBody({ draft, confidence, edit, editing, onEdit }: { draft: string; confidence?: number } & Omit<BodyProps, "decision" | "rules">) {
  const text = edit.text ?? draft;
  return (
    <div className="stack">
      <div className="row">
        <span className="section-title">Drafted reply</span>
        {confidence !== undefined && <Confidence value={confidence} />}
      </div>
      {editing ? (
        <textarea autoFocus value={text} onChange={(event) => onEdit({ ...edit, text: event.target.value })} aria-label="Reply text" />
      ) : (
        <blockquote className="draft">{text}</blockquote>
      )}
    </div>
  );
}

function ChoiceBody({ decision, edit, onEdit }: { decision: Extract<Decision, { kind: "choice" }> } & Pick<BodyProps, "edit" | "onEdit">) {
  const selected = edit.optionIndex ?? decision.recommended;
  return (
    <fieldset className="choices">
      <legend className="section-title">{decision.question}</legend>
      {decision.options.map((option, index) => (
        <label key={option.label} className="choice" data-selected={index === selected}>
          <input type="radio" name={decision.id} checked={index === selected} onChange={() => onEdit({ ...edit, optionIndex: index })} />
          <span>
            <strong>{option.label}</strong> {index === decision.recommended && <Chip tone="accent">Recommended</Chip>}
            <span className="muted small block">{option.detail}</span>
          </span>
          <kbd className="kbd">{index + 1}</kbd>
        </label>
      ))}
    </fieldset>
  );
}

function TaskBody({ decision, edit, editing, onEdit }: { decision: Extract<Decision, { kind: "task" }> } & Omit<BodyProps, "decision" | "rules">) {
  const title = edit.title ?? decision.title;
  const due = edit.due ?? decision.due;
  if (!editing) {
    return (
      <div className="task-preview">
        <span className="section-title">Task</span>
        <p><strong>{title}</strong></p>
        {due && <p className="muted small">Due {formatDay(due)}</p>}
      </div>
    );
  }
  return (
    <div className="stack">
      <input autoFocus value={title} onChange={(event) => onEdit({ ...edit, title: event.target.value })} aria-label="Task title" />
      <input type="date" value={due ?? ""} onChange={(event) => onEdit({ ...edit, due: event.target.value })} aria-label="Due date" />
    </div>
  );
}

function RuleBody({ ruleId, rules }: { ruleId: string; rules: Rule[] }) {
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) return null;
  return (
    <div className="task-preview">
      <span className="section-title">Proposed rule · {RULE_SOURCE_LABELS[rule.source]}</span>
      <p><strong>{rule.text}</strong></p>
      <p className="muted small">You can change or turn it off any time in Delegation.</p>
    </div>
  );
}

export function DecisionBody(props: BodyProps) {
  const { decision } = props;
  switch (decision.kind) {
    case "reply": return <DraftBody draft={decision.draft} confidence={decision.confidence} {...props} />;
    case "followUp": return <DraftBody draft={decision.draft} {...props} />;
    case "choice": return <ChoiceBody decision={decision} edit={props.edit} onEdit={props.onEdit} />;
    case "task": return <TaskBody decision={decision} edit={props.edit} editing={props.editing} onEdit={props.onEdit} />;
    case "ruleProposal": return <RuleBody ruleId={decision.ruleId} rules={props.rules} />;
  }
}
