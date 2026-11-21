import type { EmailRef } from "../domain/types";
import { formatTime } from "../domain/format";
import { useEmailViewer } from "../layout/EmailViewer";

export function EmailLink({ email }: { email: EmailRef }) {
  const { open } = useEmailViewer();
  return (
    <button type="button" className="link-button subject" onClick={() => open(email.id)} title="Open email">
      {email.subject}
    </button>
  );
}

export function EmailMeta({ email, showSnippet = false }: { email: EmailRef; showSnippet?: boolean }) {
  return (
    <div className="email-meta">
      <div className="row">
        <span className="sender">{email.from.name}</span>
        <span className="muted small">{email.from.address}</span>
        <span className="muted small">· {formatTime(email.receivedAt)}</span>
      </div>
      <EmailLink email={email} />
      {showSnippet && <p className="muted small">{email.snippet}</p>}
    </div>
  );
}
