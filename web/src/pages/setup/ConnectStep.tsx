import { useEffect, useState } from "react";
import { api } from "../../api";
import { failureText, type ImapDetails, type SetupChoice, type SetupStatus, type SetupTarget } from "../../api/setupApi";
import { Button, Chip } from "../../components/ui";
import { Step, StepFooter, type StepProps } from "./StepParts";
import { CHOICES, targetFor } from "./target";

export interface ConnectState {
  choice: SetupChoice;
  imap: ImapDetails;
}

interface Props extends StepProps {
  state: ConnectState;
  onChange: (state: ConnectState) => void;
  onTarget: (target: SetupTarget | undefined) => void;
}

type Outcome = { tone: "ok" | "warn"; text: string } | undefined;

function ChoiceList({ state, onChange }: Pick<Props, "state" | "onChange">) {
  return (
    <div className="choices">
      {CHOICES.map((c) => (
        <label key={c.id} className="choice" data-selected={c.id === state.choice}>
          <input type="radio" name="mailbox" checked={c.id === state.choice} onChange={() => onChange({ ...state, choice: c.id })} />
          <span><strong>{c.label}</strong><span className="muted small block">{c.hint}</span></span>
          <span />
        </label>
      ))}
    </div>
  );
}

function ImapForm({ state, onChange }: Pick<Props, "state" | "onChange">) {
  const set = (patch: Partial<ImapDetails>) => onChange({ ...state, imap: { ...state.imap, ...patch } });
  const { imap } = state;
  return (
    <div className="form-grid">
      <label>IMAP server<input value={imap.host} onChange={(e) => set({ host: e.target.value })} autoComplete="off" /></label>
      <label>Port<input type="number" value={imap.port} onChange={(e) => set({ port: Number(e.target.value) })} /></label>
      <label>User name<input value={imap.user} onChange={(e) => set({ user: e.target.value })} autoComplete="off" /></label>
      <label>Password<input type="password" value={imap.password} onChange={(e) => set({ password: e.target.value })} autoComplete="off" /></label>
    </div>
  );
}

function OAuthSignIn({ choice, status }: { choice: "office365" | "gmail"; status: SetupStatus | undefined }) {
  if (!status?.oauthEnabled) return <p className="muted small">Sign-in with {choice === "gmail" ? "Google" : "Microsoft"} is not set up on this deployment.</p>;
  return (
    <div className="row">
      <a className="button" href={`/api/connect/${choice}/start`}>Sign in</a>
      {status.connected[choice] && <Chip tone="ok">Signed in</Chip>}
    </div>
  );
}

export function ConnectStep({ onNext, state, onChange, onTarget }: Props) {
  const [status, setStatus] = useState<SetupStatus>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.setup.status().then(setStatus).catch(() => undefined); }, []);

  const target = targetFor(state.choice, state.imap);
  const change = (next: ConnectState) => { setOutcome(undefined); onTarget(undefined); onChange(next); };

  async function test() {
    if (!target) return;
    setBusy(true);
    try {
      const result = await api.setup.test(target);
      setOutcome(result.ok ? { tone: "ok", text: "Connected · read-only for now" } : { tone: "warn", text: failureText(result.error) });
      onTarget(result.ok ? target : undefined);
    } catch {
      setOutcome({ tone: "warn", text: "The test failed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Step title="Connect your mailbox" hint="The password for another server is used for the checks only. It is not stored in the browser or saved by the panel.">
      <ChoiceList state={state} onChange={change} />
      {state.choice === "imap" ? <ImapForm state={state} onChange={change} /> : <OAuthSignIn choice={state.choice} status={status} />}
      <div className="row">
        <Button onClick={test} disabled={!target || busy}>Test connection</Button>
        {outcome && <Chip tone={outcome.tone}>{outcome.text}</Chip>}
      </div>
      <StepFooter onNext={onNext} disabled={outcome?.tone !== "ok"} />
    </Step>
  );
}
