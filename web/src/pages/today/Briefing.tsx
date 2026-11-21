import { formatTime, plural } from "../../domain/format";
import { summarizeBriefing } from "../../domain/briefing";
import { useAppData } from "../../state/StoreProvider";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Briefing() {
  const data = useAppData();
  const summary = summarizeBriefing(data);
  const isClear = summary.needYou === 0 && summary.quickChecks === 0;

  return (
    <header className="briefing">
      <h1>{greeting()}, Daniel</h1>
      <p className="lead">
        Since {formatTime(data.briefing.since)}, {plural(summary.arrived, "email")} arrived and I handled {summary.handled}.{" "}
        {isClear ? (
          <strong>Nothing needs you.</strong>
        ) : (
          <>
            <strong>{summary.needYou} need you</strong>
            {summary.quickChecks > 0 && <> and {plural(summary.quickChecks, "quick check")}</>}, about {plural(summary.minutes, "minute")}.
          </>
        )}
      </p>
    </header>
  );
}
