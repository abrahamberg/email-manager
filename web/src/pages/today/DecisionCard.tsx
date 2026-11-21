import { useState } from "react";
import type { Decision } from "../../domain/types";
import { DECISION_TITLES } from "../../domain/labels";
import { EmailMeta } from "../../components/EmailMeta";
import { Button, Chip } from "../../components/ui";
import { areaById } from "../../domain/areas";
import { useShortcuts, type ShortcutMap } from "../../hooks/useShortcuts";
import { useStore } from "../../state/StoreProvider";
import type { DecisionEdit } from "../../state/actions";
import { DecisionBody } from "./DecisionBody";
import { useEmailViewer } from "../../layout/EmailViewer";
import { labelsFor } from "./decisionActions";

function optionShortcuts(decision: Decision, setOption: (index: number) => void): ShortcutMap {
  if (decision.kind !== "choice") return {};
  return Object.fromEntries(decision.options.map((_, index) => [String(index + 1), () => setOption(index)]));
}

export function DecisionCard({ decision, shortcutsEnabled }: { decision: Decision; shortcutsEnabled: boolean }) {
  const { state, dispatch } = useStore();
  const { open } = useEmailViewer();
  const [edit, setEdit] = useState<DecisionEdit>({});
  const [editing, setEditing] = useState(false);
  const optionIndex = edit.optionIndex ?? (decision.kind === "choice" ? decision.recommended : 0);
  const labels = labelsFor(decision, optionIndex);
  const area = areaById(state.data.areas, decision.email.areaId);

  const accept = () => dispatch({ type: "decision/accept", id: decision.id, edit });
  const dismiss = () => dispatch({ type: "decision/dismiss", id: decision.id });
  const snooze = () => dispatch({ type: "decision/snooze", id: decision.id });

  const shortcuts: ShortcutMap = {
    Enter: accept,
    x: dismiss,
    s: snooze,
    o: () => open(decision.email.id),
    ...(labels.canEdit ? { e: () => setEditing(true) } : {}),
    ...optionShortcuts(decision, (index) => setEdit((current) => ({ ...current, optionIndex: index }))),
  };
  useShortcuts(shortcuts, shortcutsEnabled && !editing);
  useShortcuts({ "mod+Enter": accept, Escape: () => setEditing(false) }, editing);

  return (
    <article className="card decision" aria-label={DECISION_TITLES[decision.kind]}>
      <header className="stack">
        <div className="spread">
          <span className="row">
            <span className="section-title">{DECISION_TITLES[decision.kind]}</span>
            {area && <Chip>{area.name}</Chip>}
          </span>
          <Button variant="quiet" size="small" onClick={() => open(decision.email.id)} shortcut="O">Open email</Button>
        </div>
        <EmailMeta email={decision.email} />
        <p className="why">{decision.why}</p>
      </header>

      <DecisionBody decision={decision} edit={edit} editing={editing} rules={state.data.rules} onEdit={setEdit} />

      <footer className="row actions">
        <Button variant="primary" onClick={accept} shortcut={editing ? "Ctrl ↵" : "↵"}>{labels.accept}</Button>
        {labels.canEdit && !editing && <Button onClick={() => setEditing(true)} shortcut="E">Edit</Button>}
        <Button onClick={snooze} shortcut="S">Snooze</Button>
        <Button variant="quiet" onClick={dismiss} shortcut="X">{labels.dismiss}</Button>
      </footer>
    </article>
  );
}
