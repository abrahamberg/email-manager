import type { Fact } from "../../domain/types";
import { formatDay, formatTime } from "../../domain/format";
import { areaById, upcoming } from "../../domain/areas";
import { useAppData } from "../../state/StoreProvider";
import { useEmailViewer } from "../../layout/EmailViewer";

const DAYS_AHEAD = 14;

function groupByDay(facts: Fact[]): [string, Fact[]][] {
  const groups = new Map<string, Fact[]>();
  for (const fact of facts) {
    const day = formatDay(fact.at!);
    groups.set(day, [...(groups.get(day) ?? []), fact]);
  }
  return [...groups.entries()];
}

export function ComingUp() {
  const data = useAppData();
  const { open } = useEmailViewer();
  const facts = upcoming(data.facts, data.briefing.since, DAYS_AHEAD);
  if (facts.length === 0) return null;

  return (
    <section className="stack coming-up" aria-label="Coming up">
      <h2>Coming up</h2>
      <p className="muted small">Dates and places I picked up from your mail.</p>
      {groupByDay(facts).map(([day, items]) => (
        <div key={day} className="stack-tight day">
          <span className="section-title">{day}</span>
          {items.map((fact) => (
            <button key={fact.id} type="button" className="event" onClick={() => fact.sourceEmailId && open(fact.sourceEmailId)}>
              <span className="time">{fact.kind === "deadline" ? "Due" : formatTime(fact.at!)}</span>
              <span className="stack-tight">
                <strong>{fact.title}</strong>
                <span className="muted small">{fact.place ?? fact.detail}</span>
                <span className="muted small">{areaById(data.areas, fact.areaId)?.name}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
