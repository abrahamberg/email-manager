import type { ReactNode } from "react";
import type { Settings } from "../../domain/types";
import { ProviderLogo } from "../../components/ProviderLogo";
import { Chip, PageHeader } from "../../components/ui";
import { providerFromHost } from "../../domain/providers";
import { useAppData, useStore } from "../../state/StoreProvider";
import { RepliesSection } from "./RepliesSection";
import "./settings.css";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="stack-tight">
        <span>{label}</span>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      <span className="control">{children}</span>
    </label>
  );
}

function useUpdate(): (patch: Partial<Settings>) => void {
  const { dispatch } = useStore();
  return (patch) => dispatch({ type: "settings/update", patch });
}

function SafetySection({ settings }: { settings: Settings }) {
  const update = useUpdate();
  return (
    <section className="card stack">
      <h2>Safety</h2>
      <Field label="Dry-run" hint="Decide everything, change nothing. Use it for the first days, or to pause.">
        <input type="checkbox" checked={settings.dryRun} onChange={(event) => update({ dryRun: event.target.checked })} />
      </Field>
      <Field label="Replies sent on my own per day" hint="Hard cap, also when a category is set to act.">
        <input type="number" min={0} max={50} value={settings.dailySendCap} onChange={(event) => update({ dailySendCap: Number(event.target.value) })} />
      </Field>
      <Field label="AI budget per day (USD)" hint="When reached, the rest waits for the next day or for rules.">
        <input type="number" min={0} step={0.1} value={settings.aiDailyBudgetUsd} onChange={(event) => update({ aiDailyBudgetUsd: Number(event.target.value) })} />
      </Field>
    </section>
  );
}

function RhythmSection({ settings }: { settings: Settings }) {
  const update = useUpdate();
  return (
    <section className="card stack">
      <h2>Rhythm</h2>
      <Field label="Briefings" hint="When Today collects new decisions for you.">
        <input value={settings.briefingTimes.join(", ")} onChange={(event) => update({ briefingTimes: event.target.value.split(",").map((time) => time.trim()) })} />
      </Field>
      <Field label="Quiet hours" hint="No replies are sent in this window.">
        <span className="row nowrap">
          <input type="time" value={settings.quietHours.from} onChange={(event) => update({ quietHours: { ...settings.quietHours, from: event.target.value } })} />
          <input type="time" value={settings.quietHours.to} onChange={(event) => update({ quietHours: { ...settings.quietHours, to: event.target.value } })} />
        </span>
      </Field>
      <Field label="Check mail every (minutes)" hint="The cluster's CronJob schedule.">
        <input type="number" min={5} value={settings.scheduleMinutes} onChange={(event) => update({ scheduleMinutes: Number(event.target.value) })} />
      </Field>
    </section>
  );
}

function MailboxSection({ settings }: { settings: Settings }) {
  return (
    <section className="card stack">
      <div className="spread">
        <h2 className="row"><ProviderLogo provider={providerFromHost(settings.mailbox.host)} />Mailbox</h2>
        {settings.mailbox.connected ? <Chip tone="ok">Connected</Chip> : <Chip tone="danger">Not connected</Chip>}
      </div>
      <p className="muted small">
        {settings.mailbox.user} on {settings.mailbox.host} over IMAP. Credentials live in a Kubernetes Secret and are never shown here.
      </p>
      <a href="#setup">Run setup again</a>
    </section>
  );
}

export function SettingsPage() {
  const { settings } = useAppData();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="stack">
        <SafetySection settings={settings} />
        <RepliesSection settings={settings} />
        <RhythmSection settings={settings} />
        <MailboxSection settings={settings} />
      </div>
    </>
  );
}
