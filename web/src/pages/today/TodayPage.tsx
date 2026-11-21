import type { Decision } from "../../domain/types";
import { plural } from "../../domain/format";
import { Button } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";
import { Briefing } from "./Briefing";
import { AskBox } from "./AskBox";
import { DecisionCard } from "./DecisionCard";
import { ComingUp } from "./ComingUp";
import { QuickChecks } from "./QuickChecks";
import "./today.css";

function SnoozedNote({ count, nextBriefing }: { count: number; nextBriefing: string }) {
  const { dispatch } = useStore();
  if (count === 0) return null;
  return (
    <div className="spread muted small">
      <span>{plural(count, "snoozed item")}, back at {nextBriefing}</span>
      <Button size="small" variant="quiet" onClick={() => dispatch({ type: "decision/restoreSnoozed" })}>Bring back now</Button>
    </div>
  );
}

function DoneState({ nextBriefing, snoozed }: { nextBriefing: string; snoozed: number }) {
  return (
    <div className="card done">
      <div className="done-mark" aria-hidden>✓</div>
      <h2>You're clear</h2>
      <p className="muted">Next briefing at {nextBriefing}.</p>
      <a href="#handled">See what I handled</a>
      {snoozed > 0 && <SnoozedNote count={snoozed} nextBriefing={nextBriefing} />}
    </div>
  );
}

function NeedsYou({ decisions, shortcutsEnabled }: { decisions: Decision[]; shortcutsEnabled: boolean }) {
  const [current] = decisions;
  if (!current) return null;
  return (
    <section className="stack" aria-label="Decisions">
      <div className="spread">
        <h2>Needs you</h2>
        <span className="muted small">1 of {decisions.length}</span>
      </div>
      <DecisionCard key={current.id} decision={current} shortcutsEnabled={shortcutsEnabled} />
    </section>
  );
}

// One thing at a time: quick checks only appear once the decisions are done.
function Focus({ shortcutsEnabled }: { shortcutsEnabled: boolean }) {
  const data = useAppData();
  if (data.decisions.length > 0) return <NeedsYou decisions={data.decisions} shortcutsEnabled={shortcutsEnabled} />;
  if (data.quickChecks.length > 0) return <QuickChecks checks={data.quickChecks} receipts={data.receipts} />;
  return <DoneState nextBriefing={data.briefing.nextBriefing} snoozed={data.snoozed.length} />;
}

export function TodayPage({ shortcutsEnabled }: { shortcutsEnabled: boolean }) {
  const data = useAppData();
  const busy = data.decisions.length + data.quickChecks.length > 0;
  return (
    <div className="stack-lg today">
      <Briefing />
      <AskBox />
      <Focus shortcutsEnabled={shortcutsEnabled} />
      {busy && <SnoozedNote count={data.snoozed.length} nextBriefing={data.briefing.nextBriefing} />}
      <ComingUp />
    </div>
  );
}
