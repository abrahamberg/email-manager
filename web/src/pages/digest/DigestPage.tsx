import type { DigestGroup } from "../../domain/types";
import { plural } from "../../domain/format";
import { Button, Chip, PageHeader } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";
import "./digest.css";

const STATE_LABELS: Record<DigestGroup["state"], string> = {
  normal: "",
  muted: "Muted: archived without listing",
  unsubscribed: "Unsubscribed",
  promoted: "Will reach Today from now on",
};

function GroupActions({ group }: { group: DigestGroup }) {
  const { dispatch } = useStore();
  const set = (state: DigestGroup["state"]) => dispatch({ type: "digest/setState", id: group.id, state });
  if (group.state !== "normal") {
    return <Button size="small" variant="quiet" onClick={() => set("normal")}>Restore</Button>;
  }
  return (
    <div className="row">
      <Button size="small" onClick={() => set("promoted")} title="Show this sender on Today">Important</Button>
      <Button size="small" onClick={() => set("muted")}>Mute</Button>
      {group.category === "marketing" || group.category === "newsletter" ? (
        <Button size="small" variant="danger" onClick={() => set("unsubscribed")}>Unsubscribe</Button>
      ) : null}
    </div>
  );
}

function DigestCard({ group }: { group: DigestGroup }) {
  return (
    <article className="card digest-group" data-state={group.state}>
      <div className="spread">
        <div className="row">
          <h3>{group.sender.name}</h3>
          <Chip>{group.category}</Chip>
          {group.state !== "normal" && <Chip tone="accent">{STATE_LABELS[group.state]}</Chip>}
        </div>
        <GroupActions group={group} />
      </div>
      <ul className="digest-entries">
        {group.entries.map((entry) => (
          <li key={entry.subject}>
            <span className="subject">{entry.subject}</span>
            <span className="muted"> · {entry.summary}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function DigestPage() {
  const { digest } = useAppData();
  const count = digest.reduce((sum, group) => sum + group.entries.length, 0);
  return (
    <>
      <PageHeader
        title="Skipped mail"
        subtitle={`${plural(count, "email")} that didn't need you, one line each. Read when you have time, or not at all.`}
      />
      <div className="stack">
        {digest.map((group) => <DigestCard key={group.id} group={group} />)}
      </div>
    </>
  );
}
