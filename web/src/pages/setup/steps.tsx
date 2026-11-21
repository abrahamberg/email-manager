import { useState, type ReactNode } from "react";
import { PRESETS, type PresetName } from "../../domain/autonomy";
import { OUTCOME_LABELS } from "../../domain/labels";
import { Button, Chip } from "../../components/ui";
import { useAppData, useStore } from "../../state/StoreProvider";

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

function StepFooter({ onNext, onBack, nextLabel = "Continue", disabled = false }: StepProps & { nextLabel?: string; disabled?: boolean }) {
  return (
    <div className="row">
      <Button variant="primary" onClick={onNext} disabled={disabled}>{nextLabel}</Button>
      {onBack && <Button variant="quiet" onClick={onBack}>Back</Button>}
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="stack">
      <h2>{title}</h2>
      <p className="muted">{hint}</p>
      {children}
    </div>
  );
}

export function ConnectStep({ onNext }: StepProps) {
  const { settings } = useAppData();
  const [tested, setTested] = useState(false);
  return (
    <Step title="Connect your mailbox" hint="IMAP works with Gmail, Outlook, Fastmail and most others. The password is stored as a Kubernetes Secret, never in the browser.">
      <div className="form-grid">
        <label>IMAP server<input id="setup-host" defaultValue={settings.mailbox.host} /></label>
        <label>Email address<input id="setup-user" defaultValue={settings.mailbox.user} /></label>
        <label>
          Sign-in
          <select id="setup-auth" defaultValue="app-password">
            <option value="app-password">App password</option>
            <option value="oauth">OAuth (Gmail, Outlook)</option>
          </select>
        </label>
      </div>
      <div className="row">
        <Button onClick={() => setTested(true)}>Test connection</Button>
        {tested && <Chip tone="ok">Connected · read-only for now</Chip>}
      </div>
      <StepFooter onNext={onNext} disabled={!tested} />
    </Step>
  );
}

export function LearnStep({ onNext, onBack }: StepProps) {
  const { profile } = useAppData();
  return (
    <Step title="What I learned from your mail" hint={`I read the last ${profile.daysRead} days, read-only, to learn who matters to you and how you write.`}>
      <ul className="facts">
        <li><strong>{profile.emailsRead.toLocaleString("en-GB")}</strong> emails read</li>
        <li><strong>{profile.peopleYouReplyTo}</strong> people you reply to. Their mail always reaches you.</li>
        <li><strong>{profile.newsletters}</strong> newsletters and lists</li>
      </ul>
      <div className="task-preview">
        <span className="section-title">Your writing tone</span>
        <p>{profile.toneSummary}</p>
      </div>
      <StepFooter onNext={onNext} onBack={onBack} nextLabel="Looks right" />
    </Step>
  );
}

export function ReviewStep({ onNext, onBack }: StepProps) {
  const { profile } = useAppData();
  return (
    <Step title="A week of watching" hint="For the next 7 days I decide everything but change nothing. Each day you get a few quick checks. Here is what I would have done with the last 30 days:">
      <ul className="facts">
        {profile.wouldHaveDone.map((item) => (
          <li key={item.outcome}><strong>{item.count}</strong> {OUTCOME_LABELS[item.outcome].toLowerCase()}</li>
        ))}
      </ul>
      <p className="muted small">After the week you'll see how often I was right in each category, so you can decide how much to hand over.</p>
      <StepFooter onNext={onNext} onBack={onBack} />
    </Step>
  );
}

export function PresetStep({ onNext, onBack }: StepProps) {
  const { dispatch } = useStore();
  const [choice, setChoice] = useState<PresetName>("balanced");
  const choose = () => {
    dispatch({ type: "policy/applyPreset", preset: choice });
    onNext();
  };
  return (
    <Step title="How much should I do?" hint="A starting point. I'll suggest changes as I prove myself, and you can change each category in Delegation.">
      <div className="choices">
        {(Object.keys(PRESETS) as PresetName[]).map((name) => (
          <label key={name} className="choice" data-selected={name === choice}>
            <input type="radio" name="preset" checked={name === choice} onChange={() => setChoice(name)} />
            <span>
              <strong>{PRESETS[name].label}</strong> {name === "balanced" && <Chip tone="accent">Recommended</Chip>}
              <span className="muted small block">{PRESETS[name].description}</span>
            </span>
            <span />
          </label>
        ))}
      </div>
      <StepFooter onNext={choose} onBack={onBack} />
    </Step>
  );
}

export function GoLiveStep({ onBack }: Omit<StepProps, "onNext">) {
  const { dispatch } = useStore();
  const watch = () => {
    dispatch({ type: "settings/update", patch: { dryRun: true } });
    window.location.hash = "today";
  };
  return (
    <Step title="Ready" hint="I recommend watching for a week first. You can go live from the banner at any time.">
      <div className="row">
        <Button variant="primary" onClick={watch}>Start the watch week</Button>
        {onBack && <Button variant="quiet" onClick={onBack}>Back</Button>}
      </div>
    </Step>
  );
}
