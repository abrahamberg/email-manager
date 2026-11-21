import { formatTime, plural } from "../../domain/format";
import { summarizeBriefing, type BriefingSummary } from "../../domain/briefing";
import { useAppData } from "../../state/StoreProvider";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function verdict({ needYou, quickChecks }: BriefingSummary): string {
  if (needYou === 1) return "1 is something you shouldn't miss. I took care of the rest.";
  if (needYou > 1) return `${needYou} are things you shouldn't miss. I took care of the rest.`;
  if (quickChecks > 0) return `Nothing you'd miss. I'd like you to check ${plural(quickChecks, "thing")} I wasn't sure about.`;
  return "Nothing you'd miss. I took care of all of it.";
}

export function Briefing() {
  const data = useAppData();
  const summary = summarizeBriefing(data);
  return (
    <header className="briefing">
      <h1>{greeting()}, Daniel</h1>
      <p className="lead">
        Of {plural(summary.arrived, "email")} since {formatTime(data.briefing.since)}, <strong>{verdict(summary)}</strong>
      </p>
    </header>
  );
}
