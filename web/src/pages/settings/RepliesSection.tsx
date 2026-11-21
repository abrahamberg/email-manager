import type { ReplyPolicy, ReplyTopic, Settings } from "../../domain/types";
import { REPLY_TOPIC_LABELS } from "../../domain/labels";
import { useStore } from "../../state/StoreProvider";

function useUpdateReplies(settings: Settings): (patch: Partial<ReplyPolicy>) => void {
  const { dispatch } = useStore();
  return (patch) => dispatch({ type: "settings/update", patch: { replies: { ...settings.replies, ...patch } } });
}

function toggle(topics: ReplyTopic[], topic: ReplyTopic): ReplyTopic[] {
  return topics.includes(topic) ? topics.filter((item) => item !== topic) : [...topics, topic];
}

export function RepliesSection({ settings }: { settings: Settings }) {
  const update = useUpdateReplies(settings);
  const { replies } = settings;
  return (
    <section className="card stack">
      <div>
        <h2>Replies</h2>
        <p className="muted small">
          Limits for replies I send without asking. They apply only to categories you set to “Act” in Delegation. Everything else
          stays a draft for you to approve.
        </p>
      </div>
      <fieldset className="topic-list">
        <legend className="section-title">Topics I may answer on my own</legend>
        {(Object.keys(REPLY_TOPIC_LABELS) as ReplyTopic[]).map((topic) => (
          <label key={topic} className="row">
            <input id={`topic-${topic}`} type="checkbox" checked={replies.topics.includes(topic)} onChange={() => update({ topics: toggle(replies.topics, topic) })} />
            {REPLY_TOPIC_LABELS[topic]}
          </label>
        ))}
      </fieldset>
      <label className="row">
        <input id="known-contacts" type="checkbox" checked={replies.knownContactsOnly} onChange={(event) => update({ knownContactsOnly: event.target.checked })} />
        Only to people I've written to before
      </label>
      <label className="stack-tight">
        <span>Never reply on my own to</span>
        <input
          id="never-reply"
          value={replies.neverAutoReplyTo.join(", ")}
          onChange={(event) => update({ neverAutoReplyTo: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
        />
        <span className="muted small">Domains or addresses, comma separated. Legal, banks and government are good candidates.</span>
      </label>
      <label className="stack-tight">
        <span>Signature</span>
        <textarea id="signature" className="short" value={replies.signature} onChange={(event) => update({ signature: event.target.value })} />
      </label>
    </section>
  );
}
