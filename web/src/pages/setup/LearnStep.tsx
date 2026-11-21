import { useState } from "react";
import { api } from "../../api";
import { failureText, type LearnSummary, type SetupTarget } from "../../api/setupApi";
import { Button, Chip } from "../../components/ui";
import { Step, StepFooter, type StepProps } from "./StepParts";

export function LearnStep({ onNext, onBack, target }: StepProps & { target: SetupTarget | undefined }) {
  const [summary, setSummary] = useState<LearnSummary>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function learn() {
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.setup.learn(target);
      if (result.ok) setSummary(result.summary);
      else setError(failureText(result.error));
    } catch {
      setError("Reading failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Step title="What I learn from your mail" hint="I read the last 30 days, read-only, to count who writes to you and how much is bulk mail. Nothing is moved, drafted or stored.">
      <div className="row">
        <Button onClick={learn} disabled={!target || busy}>Learn from 30 days</Button>
        {error && <Chip tone="warn">{error}</Chip>}
      </div>
      {!target && <p className="muted small">Go back and test the connection first.</p>}
      {summary && (
        <ul className="facts">
          <li><strong>{summary.emailsRead.toLocaleString("en-GB")}</strong> emails read in {summary.daysRead} days</li>
          <li><strong>{summary.distinctSenders}</strong> different senders</li>
          <li><strong>{summary.newsletters}</strong> newsletters and lists</li>
        </ul>
      )}
      <StepFooter onNext={onNext} onBack={onBack} nextLabel="Looks right" disabled={!summary} />
    </Step>
  );
}
