import { useState } from "react";
import type { Decision } from "../../domain/types";
import { formatDay } from "../../domain/format";
import { DecisionCard } from "./DecisionCard";

function OtherMatter({ decision, onSelect }: { decision: Decision; onSelect: () => void }) {
  return (
    <li>
      <button type="button" className="other-matter" onClick={onSelect}>
        <span>{decision.matter}</span>
        {decision.deadline && <span className="muted small">by {formatDay(decision.deadline)}</span>}
      </button>
    </li>
  );
}

export function DontMiss({ decisions, shortcutsEnabled }: { decisions: Decision[]; shortcutsEnabled: boolean }) {
  const [selectedId, setSelectedId] = useState<string>();
  const current = decisions.find((decision) => decision.id === selectedId) ?? decisions[0];
  if (!current) return null;
  const others = decisions.filter((decision) => decision !== current);
  return (
    <section className="stack" aria-label="Don't miss">
      <h2>Don't miss</h2>
      <DecisionCard key={current.id} decision={current} shortcutsEnabled={shortcutsEnabled} />
      {others.length > 0 && (
        <ul className="other-matters">
          {others.map((decision) => <OtherMatter key={decision.id} decision={decision} onSelect={() => setSelectedId(decision.id)} />)}
        </ul>
      )}
    </section>
  );
}
