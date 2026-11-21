import { useState } from "react";
import type { Decision } from "../../domain/types";
import { DECISION_TITLES } from "../../domain/labels";
import { areaById } from "../../domain/areas";
import { plural } from "../../domain/format";
import { Button } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";
import { Briefing } from "./Briefing";
import { AskBox } from "./AskBox";
import { DecisionCard } from "./DecisionCard";
import { AreaBriefings } from "./AreaBriefings";
import { ComingUp } from "./ComingUp";
import { QuickChecks } from "./QuickChecks";
import { AutonomySuggestions } from "./AutonomySuggestions";
import "./today.css";

function UpNext({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) return null;
  return (
    <ol className="up-next">
      {decisions.map((decision) => (
        <li key={decision.id}>
          <span className="muted small">{DECISION_TITLES[decision.kind]}</span> {decision.email.from.name}: {decision.email.subject}
        </li>
      ))}
    </ol>
  );
}

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

function NeedsYou({ decisions, focusedArea, onClearFocus, shortcutsEnabled }: {
  decisions: Decision[];
  focusedArea?: string;
  onClearFocus: () => void;
  shortcutsEnabled: boolean;
}) {
  const { areas } = useAppData();
  const [current, ...rest] = decisions;
  if (!current) return null;
  const focusName = focusedArea && areaById(areas, focusedArea)?.name;
  return (
    <section id="needs-you" className="stack" aria-label="Decisions">
      <div className="spread">
        <h2>{focusName ? `Needs you: ${focusName}` : "Needs you"}</h2>
        {focusName ? (
          <Button size="small" variant="quiet" onClick={onClearFocus}>Show all</Button>
        ) : (
          <span className="muted small">1 of {decisions.length}</span>
        )}
      </div>
      <DecisionCard key={current.id} decision={current} shortcutsEnabled={shortcutsEnabled} />
      <UpNext decisions={rest} />
    </section>
  );
}

function inArea(decisions: Decision[], areaId?: string): Decision[] {
  return areaId ? decisions.filter((decision) => decision.email.areaId === areaId) : decisions;
}

export function TodayPage({ shortcutsEnabled }: { shortcutsEnabled: boolean }) {
  const data = useAppData();
  const [focus, setFocus] = useState<string>();
  const decisions = inArea(data.decisions, focus);
  const focusedArea = decisions.length > 0 ? focus : undefined;
  const shown = focusedArea ? decisions : data.decisions;
  const focusOn = (areaId?: string) => {
    setFocus(areaId);
    if (areaId) requestAnimationFrame(() => document.getElementById("needs-you")?.scrollIntoView({ behavior: "smooth" }));
  };
  const nothingLeft = data.decisions.length === 0 && data.quickChecks.length === 0;

  return (
    <div className="today-grid">
      <div className="stack-lg today-main">
        <Briefing />
        <AskBox />
        <AreaBriefings focusedArea={focusedArea} onFocus={focusOn} />
        <NeedsYou decisions={shown} focusedArea={focusedArea} onClearFocus={() => setFocus(undefined)} shortcutsEnabled={shortcutsEnabled} />
        <QuickChecks checks={data.quickChecks} receipts={data.receipts} />
        {!nothingLeft && <SnoozedNote count={data.snoozed.length} nextBriefing={data.briefing.nextBriefing} />}
        {nothingLeft && <DoneState nextBriefing={data.briefing.nextBriefing} snoozed={data.snoozed.length} />}
        <AutonomySuggestions />
      </div>
      <aside className="today-rail">
        <ComingUp />
      </aside>
    </div>
  );
}
