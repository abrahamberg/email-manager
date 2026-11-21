import type { Stream, StreamItem } from "../../domain/types";
import { visiblePicks } from "../../domain/briefing";
import { formatDay } from "../../domain/format";
import { Button, Chip } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";
import { useEmailViewer } from "../../layout/EmailViewer";

function Pick({ stream, item }: { stream: Stream; item: StreamItem }) {
  const { dispatch } = useStore();
  const { open } = useEmailViewer();
  const feedback = (value: "more" | "less") => dispatch({ type: "pick/feedback", streamId: stream.id, itemId: item.id, feedback: value });
  return (
    <li className="pick stack-tight">
      <div className="row">
        <strong>{item.title}</strong>
        {item.closes && <Chip tone="warn">closes {formatDay(item.closes)}</Chip>}
      </div>
      <span className="muted small">{item.facts.join(" · ")}</span>
      <span className="small">{item.why}</span>
      <div className="row">
        <Button size="small" variant="quiet" onClick={() => open(stream.emailId)}>Open</Button>
        {item.feedback === "more" ? (
          <span className="muted small">Looking for more like this</span>
        ) : (
          <Button size="small" variant="quiet" onClick={() => feedback("more")}>More like this</Button>
        )}
        <Button size="small" variant="quiet" onClick={() => feedback("less")}>Not for me</Button>
      </div>
    </li>
  );
}

function StreamPicks({ stream }: { stream: Stream }) {
  const picks = visiblePicks(stream);
  const others = stream.total - picks.length;
  return (
    <div className="stack-tight stream">
      <span className="stream-head">
        <strong>{stream.name}</strong>
        <span className="muted"> · {picks.length} of {stream.total} {stream.period} worth a look</span>
      </span>
      {picks.length > 0 && <ul className="picks">{picks.map((item) => <Pick key={item.id} stream={stream} item={item} />)}</ul>}
      <span className="muted small">{others} others: {stream.rest}.</span>
    </div>
  );
}

export function PickedForYou() {
  const { streams } = useAppData();
  if (streams.length === 0) return null;
  return (
    <section className="stack" aria-label="Picked for you">
      <h2>Picked for you</h2>
      {streams.map((stream) => <StreamPicks key={stream.id} stream={stream} />)}
    </section>
  );
}
