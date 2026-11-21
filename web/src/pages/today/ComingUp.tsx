import { formatDay, formatTime } from "../../domain/format";
import { upcoming } from "../../domain/areas";
import { useAppData } from "../../state/StoreProvider";
import { useEmailViewer } from "../../layout/EmailViewer";

const DAYS_AHEAD = 7;
const SHOWN = 3;

export function ComingUp() {
  const data = useAppData();
  const { open } = useEmailViewer();
  const facts = upcoming(data.facts, data.briefing.since, DAYS_AHEAD).slice(0, SHOWN);
  if (facts.length === 0) return null;

  return (
    <section className="stack-tight coming-up" aria-label="Coming up">
      <span className="section-title">Coming up</span>
      {facts.map((fact) => (
        <button key={fact.id} type="button" className="event" onClick={() => fact.sourceEmailId && open(fact.sourceEmailId)}>
          <span className="when">{formatDay(fact.at!)}, {fact.kind === "deadline" ? "due" : formatTime(fact.at!)}</span>
          <span>{fact.title}</span>
        </button>
      ))}
    </section>
  );
}
