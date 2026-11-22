import { failureText, type MailboxView, type SetupStatus, type TestResult } from "../../api/setupApi";
import { Button, Chip } from "../../components/ui";
import { CHOICES } from "./target";

export type Outcome = { tone: "ok" | "warn"; text: string } | undefined;

export const outcomeOf = (r: TestResult): Outcome =>
  r.ok ? { tone: "ok", text: "Connected · read-only for now" } : { tone: "warn", text: failureText(r.error) };

interface Props {
  mailboxes: MailboxView[];
  status: SetupStatus | undefined;
  outcomes: Record<string, Outcome>;
  busy: boolean;
  onTest: (m: MailboxView) => void;
  onEdit: (m: MailboxView) => void;
  onRemove: (m: MailboxView) => void;
}

const providerLabel = (m: MailboxView) => CHOICES.find((c) => c.id === m.provider)?.label ?? m.provider;

function SignIn({ m, status }: { m: MailboxView; status: SetupStatus | undefined }) {
  if (m.provider === "imap") return null;
  if (!status?.oauthEnabled) return <span className="muted small">Sign-in needs the deployment's public URL.</span>;
  return (
    <>
      <a className="button small" href={`/api/connect/${m.provider}/start?mailbox=${encodeURIComponent(m.id)}`}>Sign in</a>
      <Chip tone={m.connected ? "ok" : "warn"}>{m.connected ? "Signed in" : "Not signed in"}</Chip>
    </>
  );
}

export function MailboxList({ mailboxes, status, outcomes, busy, onTest, onEdit, onRemove }: Props) {
  return (
    <ul className="mailboxes">
      {mailboxes.map((m) => (
        <li key={m.id} className="card">
          <div className="row">
            <strong>{m.label}</strong>
            <span className="muted small">{providerLabel(m)}{m.imapUser ? ` · ${m.imapUser}` : ""}</span>
            {!m.enabled && <Chip>Not in runs</Chip>}
          </div>
          <div className="row">
            <SignIn m={m} status={status} />
            <Button size="small" onClick={() => onTest(m)} disabled={busy}>Test connection</Button>
            <Button size="small" variant="quiet" onClick={() => onEdit(m)}>Edit</Button>
            <Button size="small" variant="danger" onClick={() => onRemove(m)}>Remove</Button>
            {outcomes[m.id] && <Chip tone={outcomes[m.id]!.tone}>{outcomes[m.id]!.text}</Chip>}
          </div>
        </li>
      ))}
    </ul>
  );
}
