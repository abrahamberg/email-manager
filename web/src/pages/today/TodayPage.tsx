import { DECISION_TITLES } from "../../domain/labels";
import { plural } from "../../domain/format";
import { useAppData } from "../../state/StoreProvider";
import { Briefing } from "./Briefing";
import { DecisionCard } from "./DecisionCard";
import { QuickChecks } from "./QuickChecks";
import { AutonomySuggestions } from "./AutonomySuggestions";
import "./today.css";

function UpNext() {
  const [, ...rest] = useAppData().decisions;
  if (rest.length === 0) return null;
  return (
    <ol className="up-next">
      {rest.map((decision) => (
        <li key={decision.id}>
          <span className="muted small">{DECISION_TITLES[decision.kind]}</span> {decision.email.from.name}: {decision.email.subject}
        </li>
      ))}
    </ol>
  );
}

function DoneState({ nextBriefing, snoozed }: { nextBriefing: string; snoozed: number }) {
  return (
    <div className="card done">
      <div className="done-mark" aria-hidden>✓</div>
      <h2>You're clear</h2>
      <p className="muted">
        Next briefing at {nextBriefing}.{snoozed > 0 && ` ${plural(snoozed, "snoozed item")} will come back then.`}
      </p>
      <a href="#handled">See what I handled</a>
    </div>
  );
}

export function TodayPage({ shortcutsEnabled }: { shortcutsEnabled: boolean }) {
  const data = useAppData();
  const [current] = data.decisions;
  const nothingLeft = !current && data.quickChecks.length === 0;

  return (
    <div className="stack-lg">
      <Briefing />
      {current && (
        <section className="stack" aria-label="Decisions">
          <div className="spread">
            <h2>Needs you</h2>
            <span className="muted small">1 of {data.decisions.length}</span>
          </div>
          <DecisionCard key={current.id} decision={current} shortcutsEnabled={shortcutsEnabled} />
          <UpNext />
        </section>
      )}
      <QuickChecks checks={data.quickChecks} receipts={data.receipts} />
      {nothingLeft && <DoneState nextBriefing={data.briefing.nextBriefing} snoozed={data.snoozed.length} />}
      <AutonomySuggestions />
    </div>
  );
}
