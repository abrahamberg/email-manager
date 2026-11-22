import { useEffect, useState } from "react";
import { api } from "../api";
import { splitLinks } from "../domain/links";
import type { AuthVerdict, EmailDetail, PipelineStage, TraceStep } from "../domain/types";
import { formatDay, formatTime } from "../domain/format";
import { Button, Chip, type ChipTone } from "../components/ui";
import { useShortcuts } from "../hooks/useShortcuts";
import { useAppData } from "../state/StoreProvider";
import { findEmail } from "../state/selectors";
import "./drawer.css";

const STAGE_LABELS: Record<PipelineStage, string> = {
  rules: "1. Your rules",
  spam: "2. Spam check",
  lowValue: "3. Bulk and repeat check",
  ai: "4. AI",
};

const RESULT_TONES: Record<TraceStep["result"], ChipTone> = { decided: "accent", passed: "default", skipped: "default" };
const VERDICT_TONES: Record<AuthVerdict, ChipTone> = { pass: "ok", fail: "danger", none: "warn" };

function Trace({ steps }: { steps: TraceStep[] }) {
  const tokens = steps.reduce((sum, step) => sum + (step.tokens ?? 0), 0);
  return (
    <section className="stack">
      <h3>How I decided</h3>
      <ol className="trace">
        {steps.map((step) => (
          <li key={step.stage} data-result={step.result}>
            <div className="row">
              <strong>{STAGE_LABELS[step.stage]}</strong>
              <Chip tone={RESULT_TONES[step.result]}>{step.result}</Chip>
              {step.tokens !== undefined && <span className="muted small">{step.tokens.toLocaleString("en-GB")} tokens</span>}
            </div>
            <p className="muted small">{step.note}</p>
          </li>
        ))}
      </ol>
      <p className="muted small">{tokens === 0 ? "Decided without AI, at no cost." : `AI used ${tokens.toLocaleString("en-GB")} tokens on this email.`}</p>
    </section>
  );
}

function Checks({ detail }: { detail: EmailDetail }) {
  return (
    <section className="stack">
      <h3>Sender checks</h3>
      <div className="row">
        {(["spf", "dkim", "dmarc"] as const).map((key) => (
          <Chip key={key} tone={VERDICT_TONES[detail.auth[key]]}>{key.toUpperCase()} {detail.auth[key]}</Chip>
        ))}
        <Chip tone={detail.spamScore >= 6 ? "danger" : "default"}>Spam score {detail.spamScore}</Chip>
      </div>
      {detail.bulkHeaders.length > 0 && <p className="muted small mono">{detail.bulkHeaders.join(" · ")}</p>}
    </section>
  );
}

function MailText({ text }: { text: string }) {
  return (
    <pre className="email-body">
      {splitLinks(text).map((part, i) => part.href
        ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow">{part.text}</a>
        : part.text)}
    </pre>
  );
}

/** The stored text has no links, so the original is read from the mailbox while the drawer is open. */
function useOriginalText(emailId: string): string | undefined {
  const [text, setText] = useState<string>();
  useEffect(() => {
    let current = true;
    setText(undefined);
    api.emailText(emailId).then((t) => current && setText(t), () => undefined);
    return () => { current = false; };
  }, [emailId]);
  return text;
}

export function EmailDrawer({ emailId, onClose }: { emailId: string; onClose: () => void }) {
  const data = useAppData();
  const email = findEmail(data, emailId);
  const detail = data.details[emailId];
  const original = useOriginalText(emailId);
  useShortcuts({ Escape: onClose });
  if (!email) return null;

  return (
    <div className="overlay drawer-overlay" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label={email.subject} onClick={(event) => event.stopPropagation()}>
        <header className="spread">
          <span className="section-title">Email</span>
          <Button variant="quiet" size="small" onClick={onClose} shortcut="Esc">Close</Button>
        </header>
        <div className="stack-tight">
          <h2>{email.subject}</h2>
          <p className="muted small">
            {email.from.name} &lt;{email.from.address}&gt; · {formatDay(email.receivedAt)} {formatTime(email.receivedAt)}
            {detail && ` · to ${detail.to}`}
          </p>
        </div>
        <MailText text={original ?? detail?.body ?? email.snippet} />
        {detail && <Trace steps={detail.trace} />}
        {detail && <Checks detail={detail} />}
      </aside>
    </div>
  );
}
