import { plural } from "../../domain/format";
import { dontMiss } from "../../domain/briefing";
import { Button } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";
import { Briefing } from "./Briefing";
import { AskBox } from "./AskBox";
import { DontMiss } from "./DontMiss";
import { QuickChecks } from "./QuickChecks";
import { WhatHappened } from "./WhatHappened";
import { Ignored } from "./Ignored";
import { PickedForYou } from "./PickedForYou";
import "./today.css";

function SnoozedNote() {
  const { state, dispatch } = useStore();
  const { snoozed, briefing } = state.data;
  if (snoozed.length === 0) return null;
  return (
    <div className="spread muted small">
      <span>{plural(snoozed.length, "snoozed item")}, back at {briefing.nextBriefing}</span>
      <Button size="small" variant="quiet" onClick={() => dispatch({ type: "decision/restoreSnoozed" })}>Bring back now</Button>
    </div>
  );
}

function Clear() {
  const { briefing } = useAppData();
  return (
    <div className="card done">
      <div className="done-mark" aria-hidden>✓</div>
      <h2>Nothing you'd miss</h2>
      <p className="muted">Next look at {briefing.nextBriefing}.</p>
    </div>
  );
}

// One thing at a time: quick checks only appear once nothing important is left.
function Focus({ shortcutsEnabled }: { shortcutsEnabled: boolean }) {
  const data = useAppData();
  const important = dontMiss(data.decisions);
  if (important.length > 0) return <DontMiss decisions={important} shortcutsEnabled={shortcutsEnabled} />;
  if (data.quickChecks.length > 0) return <QuickChecks checks={data.quickChecks} receipts={data.receipts} />;
  return <Clear />;
}

export function TodayPage({ shortcutsEnabled }: { shortcutsEnabled: boolean }) {
  return (
    <div className="stack-lg today">
      <Briefing />
      <AskBox />
      <Focus shortcutsEnabled={shortcutsEnabled} />
      <SnoozedNote />
      <WhatHappened />
      <PickedForYou />
      <Ignored />
    </div>
  );
}
