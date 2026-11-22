import { useEffect, useState } from "react";
import { api } from "../../api";
import type { MailboxView, SetupStatus, SetupTarget } from "../../api/setupApi";
import { Button } from "../../components/ui";
import { MailboxEditor, type Editing } from "./MailboxEditor";
import { MailboxList, outcomeOf, type Outcome } from "./MailboxList";
import { Step, StepFooter, type StepProps } from "./StepParts";
import { emptyForm, formFrom } from "./target";

interface Props extends StepProps {
  onTarget: (target: SetupTarget | undefined) => void;
}

export function ConnectStep({ onNext, onTarget }: Props) {
  const [status, setStatus] = useState<SetupStatus>();
  const [mailboxes, setMailboxes] = useState<MailboxView[]>();
  const [editing, setEditing] = useState<Editing>();
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState(false);

  const reload = () => api.setup.mailboxes().then(setMailboxes).catch(() => setMailboxes([]));
  useEffect(() => {
    void api.setup.status().then(setStatus).catch(() => undefined);
    void reload();
  }, []);
  useEffect(() => {
    if (mailboxes?.length === 0 && !editing) setEditing({ form: emptyForm() });
  }, [mailboxes, editing]);

  async function test(m: MailboxView) {
    setBusy(true);
    try {
      const result = await api.setup.test({ mailboxId: m.id });
      setOutcomes((o) => ({ ...o, [m.id]: outcomeOf(result) }));
      if (result.ok) onTarget({ mailboxId: m.id });
    } catch {
      setOutcomes((o) => ({ ...o, [m.id]: { tone: "warn", text: "The test failed. Try again." } }));
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MailboxView) {
    if (!window.confirm(`Remove ${m.label}? Its saved password or sign-in is deleted.`)) return;
    await api.setup.removeMailbox(m.id);
    onTarget(undefined);
    await reload();
  }

  const saved = async () => { setEditing(undefined); await reload(); };
  const tested = Object.values(outcomes).some((o) => o?.tone === "ok");

  return (
    <Step title="Connect your mailboxes" hint="Add each mailbox you want handled. Passwords and client secrets are stored encrypted on the server and never shown again.">
      {mailboxes && <MailboxList mailboxes={mailboxes} status={status} outcomes={outcomes} busy={busy} onTest={test}
        onEdit={(m) => setEditing({ id: m.id, form: formFrom(m), view: m })} onRemove={remove} />}
      {editing
        ? <MailboxEditor editing={editing} onChange={setEditing} onSaved={saved} onCancel={mailboxes?.length ? () => setEditing(undefined) : undefined} />
        : <div className="row"><Button onClick={() => setEditing({ form: emptyForm() })}>Add a mailbox</Button></div>}
      <StepFooter onNext={onNext} disabled={!tested} />
    </Step>
  );
}
