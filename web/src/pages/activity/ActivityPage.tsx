import type { Run } from "../../domain/types";
import { formatTime, formatUsd } from "../../domain/format";
import { Chip, PageHeader } from "../../components/ui";
import { useAppData } from "../../state/StoreProvider";
import "./activity.css";

function sum(runs: Run[], pick: (run: Run) => number): number {
  return runs.reduce((total, run) => total + pick(run), 0);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card stat">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  return (
    <tr>
      <td>{formatTime(run.startedAt)}</td>
      <td>{run.fetched}</td>
      <td>{run.handledByLogic}</td>
      <td>{run.sentToAi}</td>
      <td>{run.tokens.toLocaleString("en-GB")}</td>
      <td>{formatUsd(run.costUsd)}</td>
      <td>{run.error ? <Chip tone="warn" title={run.error}>Retried</Chip> : <Chip tone="ok">OK</Chip>}</td>
    </tr>
  );
}

export function ActivityPage() {
  const { runs, settings } = useAppData();
  const fetched = sum(runs, (run) => run.fetched);
  const byLogic = sum(runs, (run) => run.handledByLogic);
  const cost = sum(runs, (run) => run.costUsd);
  const failed = runs.find((run) => run.error);

  return (
    <>
      <PageHeader title="Activity" subtitle={`Runs every ${settings.scheduleMinutes} minutes on the cluster. Logic first, AI only for what's left.`} />
      <div className="stack-lg">
        <div className="stats">
          <Stat label="Emails today" value={String(fetched)} />
          <Stat label="Decided without AI" value={`${Math.round((byLogic / Math.max(fetched, 1)) * 100)}%`} hint={`${byLogic} of ${fetched}`} />
          <Stat label="AI cost today" value={formatUsd(cost)} hint={`Budget ${formatUsd(settings.aiDailyBudgetUsd)} a day`} />
        </div>
        {failed && (
          <div className="banner">
            Run at {formatTime(failed.startedAt)}: {failed.error}.
          </div>
        )}
        <section className="stack">
          <h2>Recent runs</h2>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Fetched</th><th>By logic</th><th>To AI</th><th>Tokens</th><th>Cost</th><th>Status</th></tr>
              </thead>
              <tbody>{runs.map((run) => <RunRow key={run.id} run={run} />)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
