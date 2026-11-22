import { useState } from "react";
import { api } from "../../api";
import { saveErrorText, type MailboxView } from "../../api/setupApi";
import { Button, Chip } from "../../components/ui";
import { outcomeOf, type Outcome } from "./MailboxList";
import { MailboxFormView } from "./MailboxFormView";
import { inputFor, unsavedTarget, type MailboxForm } from "./target";

export interface Editing {
  /** Absent while adding a new mailbox. */
  id?: string;
  form: MailboxForm;
  view?: MailboxView;
}

interface Props {
  editing: Editing;
  onChange: (editing: Editing) => void;
  onSaved: () => void;
  onCancel?: () => void;
}

export function MailboxEditor({ editing, onChange, onSaved, onCancel }: Props) {
  const [outcome, setOutcome] = useState<Outcome>();
  const [busy, setBusy] = useState(false);
  const input = inputFor(editing.form);
  const trial = unsavedTarget(editing.form);
  const hasSecret = Boolean(editing.view && (editing.view.hasPassword || editing.view.hasClientSecret));

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch {
      setOutcome({ tone: "warn", text: "That did not work. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(async () => {
    if (!input) return;
    const result = await api.setup.saveMailbox(input, editing.id);
    if (result.ok) onSaved();
    else setOutcome({ tone: "warn", text: saveErrorText(result.error) });
  });
  const test = () => run(async () => {
    if (trial) setOutcome(outcomeOf(await api.setup.test(trial)));
  });

  return (
    <div className="card stack mailbox-editor">
      <h3>{editing.id ? `Edit ${editing.view?.label ?? "mailbox"}` : "Add a mailbox"}</h3>
      <MailboxFormView form={editing.form} onChange={(form) => { setOutcome(undefined); onChange({ ...editing, form }); }}
        providerFixed={Boolean(editing.id)} hasSecret={hasSecret} />
      {editing.form.provider !== "imap" && <p className="muted small">Save first, then use Sign in on the saved mailbox.</p>}
      <div className="row">
        <Button variant="primary" onClick={save} disabled={!input || busy}>Save</Button>
        {editing.form.provider === "imap" && <Button onClick={test} disabled={!trial || busy}>Test before saving</Button>}
        {onCancel && <Button variant="quiet" onClick={onCancel}>Cancel</Button>}
        {outcome && <Chip tone={outcome.tone}>{outcome.text}</Chip>}
      </div>
    </div>
  );
}
