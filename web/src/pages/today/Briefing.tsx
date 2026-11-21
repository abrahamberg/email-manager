import { formatTime, plural } from "../../domain/format";
import { summarizeBriefing, type BriefingSummary } from "../../domain/briefing";
import { handledHeadline } from "../../domain/areas";
import { useAppData } from "../../state/StoreProvider";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function nextStep({ needYou, quickChecks, minutes }: BriefingSummary): string {
  if (needYou > 0) return `${plural(needYou, "thing")} need you, about ${plural(minutes, "minute")}.`;
  if (quickChecks > 0) return `Just ${plural(quickChecks, "quick check")} left.`;
  return "Nothing needs you.";
}

export function Briefing() {
  const data = useAppData();
  const summary = summarizeBriefing(data);

  return (
    <header className="briefing">
      <h1>{greeting()}, Daniel</h1>
      <p className="lead">
        Since {formatTime(data.briefing.since)} I handled {summary.handled} of {plural(summary.arrived, "email")}. {handledHeadline(data)}{" "}
        <strong>{nextStep(summary)}</strong>
      </p>
    </header>
  );
}
