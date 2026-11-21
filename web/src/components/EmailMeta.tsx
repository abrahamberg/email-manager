import type { EmailRef } from "../domain/types";
import { formatTime } from "../domain/format";

export function EmailMeta({ email, showSnippet = false }: { email: EmailRef; showSnippet?: boolean }) {
  return (
    <div className="email-meta">
      <div className="row">
        <span className="sender">{email.from.name}</span>
        <span className="muted small">{email.from.address}</span>
        <span className="muted small">· {formatTime(email.receivedAt)}</span>
      </div>
      <div className="subject">{email.subject}</div>
      {showSnippet && <p className="muted small">{email.snippet}</p>}
    </div>
  );
}
