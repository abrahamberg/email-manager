import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { failureText, type KindGroup, type LearnSummary, type SetupTarget } from "../../api/setupApi";
import { Button, Chip } from "../../components/ui";
import { Step, StepFooter, type StepProps } from "./StepParts";

const GROUP_LABEL: Record<KindGroup["kind"], string> = {
  newsletters: "Newsletters and lists",
  notifications: "Automatic notifications",
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

function Headline({ summary }: { summary: LearnSummary }) {
  const hidden = summary.emailsRead - summary.needsYou;
  return (
    <p className="headline">
      Of <strong>{plural(summary.emailsRead, "email", "emails")}</strong> in {summary.daysRead} days, only{" "}
      <strong>{summary.needsYou.toLocaleString("en-GB")}</strong> came from people. I would have kept the other{" "}
      <strong>{hidden.toLocaleString("en-GB")}</strong> out of your way.
    </p>
  );
}

function Groups({ groups }: { groups: KindGroup[] }) {
  return (
    <ul className="facts">
      {groups.map((g) => (
        <li key={g.kind}>
          <strong>{GROUP_LABEL[g.kind]}</strong>: {plural(g.emails, "email", "emails")} from {plural(g.senders, "sender", "senders")}
          <span className="muted small block">Most from {g.top.map((t) => `${t.sender} (${t.emails})`).join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

export function LearnStep({ onNext, onBack, target }: StepProps & { target: SetupTarget | undefined }) {
  const [summary, setSummary] = useState<LearnSummary>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const learn = useCallback(async (current: SetupTarget) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.setup.learn(current);
      if (result.ok) setSummary(result.summary);
      else setError(failureText(result.error));
    } catch {
      setError("Reading failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (target) void learn(target);
  }, [target, learn]);

  return (
    <Step title="What I would keep from you" hint="I read the headers of your last 30 days, read-only. Nothing is moved, drafted or stored.">
      {busy && <p className="muted">Reading your mail…</p>}
      {summary && <Headline summary={summary} />}
      {summary && <Groups groups={summary.groups} />}
      {error && <div className="row"><Chip tone="warn">{error}</Chip><Button onClick={() => target && void learn(target)}>Try again</Button></div>}
      {!target && <p className="muted small">Go back and test the connection first.</p>}
      <StepFooter onNext={onNext} onBack={onBack} nextLabel="Looks right" disabled={!summary} />
    </Step>
  );
}
