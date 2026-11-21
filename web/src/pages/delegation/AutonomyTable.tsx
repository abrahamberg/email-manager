import type { AutonomyLevel, CategoryPolicy } from "../../domain/types";
import { AUTONOMY_HINTS, AUTONOMY_LABELS, AUTONOMY_LEVELS, accuracy, suggestAutonomy } from "../../domain/autonomy";
import { formatPercent } from "../../domain/format";
import { Button, Chip, Segmented } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";

const LEVEL_OPTIONS = AUTONOMY_LEVELS.map((level) => ({ value: level, label: AUTONOMY_LABELS[level], title: AUTONOMY_HINTS[level] }));

function PolicyRow({ policy }: { policy: CategoryPolicy }) {
  const { dispatch } = useStore();
  const setLevel = (level: AutonomyLevel) => dispatch({ type: "policy/setLevel", category: policy.category, level });
  const suggestion = suggestAutonomy(policy);

  return (
    <li className="policy">
      <div className="spread">
        <div className="stack-tight">
          <h3>{policy.label}</h3>
          <span className="muted small">
            Right {policy.correct} of {policy.checked} checks ({formatPercent(accuracy(policy))})
            {policy.sendsMail && " · can send mail"}
          </span>
        </div>
        {suggestion && (
          <Button size="small" variant="primary" onClick={() => setLevel(suggestion)}>
            Suggest: {AUTONOMY_LABELS[suggestion]}
          </Button>
        )}
      </div>
      <Segmented label={`Autonomy for ${policy.label}`} value={policy.level} options={LEVEL_OPTIONS} onChange={setLevel} />
      {policy.sendsMail && (policy.level === "act" || policy.level === "quiet") && (
        <Chip tone="warn">Sends replies without asking, up to the daily cap in Settings</Chip>
      )}
    </li>
  );
}

export function AutonomyTable() {
  const { policies } = useAppData();
  return (
    <div className="stack">
      <p className="muted small">
        Hover a level to see what it means. I never delete mail, and I never send replies on my own unless you raise a category to
        “Act and tell me” yourself.
      </p>
      <ul className="card list">
        {policies.map((policy) => <PolicyRow key={policy.category} policy={policy} />)}
      </ul>
    </div>
  );
}
