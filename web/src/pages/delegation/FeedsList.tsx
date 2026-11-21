import type { RuleFeed } from "../../domain/types";
import { formatDay, formatTime } from "../../domain/format";
import { Chip } from "../../components/ui";
import { useAppData } from "../../state/StoreProvider";

function FeedRow({ feed }: { feed: RuleFeed }) {
  return (
    <tr>
      <td>
        <strong>{feed.name}</strong>
        <div className="muted small">{feed.host}</div>
      </td>
      <td>{feed.ruleCount.toLocaleString("en-GB")}</td>
      <td>
        {feed.version}
        <div className="muted small">{formatDay(feed.updatedAt)} {formatTime(feed.updatedAt)}</div>
      </td>
      <td>
        {feed.verified
          ? <Chip tone="ok">Verified</Chip>
          : <Chip tone="danger" title="Signature check failed, the previous version is still in use">Check failed</Chip>}
      </td>
    </tr>
  );
}

export function FeedsList() {
  const { feeds } = useAppData();
  return (
    <div className="stack">
      <p className="muted small">
        Rules are downloaded only from these hosts, and each download is checked against its signature. A feed that fails the check is
        ignored and the last good version stays in use.
      </p>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Source</th><th>Rules</th><th>Version</th><th>Status</th></tr>
          </thead>
          <tbody>{feeds.map((feed) => <FeedRow key={feed.id} feed={feed} />)}</tbody>
        </table>
      </div>
    </div>
  );
}
