import type { ReactNode } from "react";
import type { MailProvider } from "../../api/setupApi";
import { ProviderLogo } from "../../components/ProviderLogo";
import { CHOICES, type MailboxForm } from "./target";

interface Props {
  form: MailboxForm;
  onChange: (form: MailboxForm) => void;
  /** Saved mailboxes keep their provider. */
  providerFixed: boolean;
  hasSecret: boolean;
}

function ProviderChoice({ form, onChange }: Pick<Props, "form" | "onChange">) {
  const pick = (provider: MailProvider) => onChange({ ...form, provider });
  return (
    <div className="choices">
      {CHOICES.map((c) => (
        <label key={c.id} className="choice with-logo" data-selected={c.id === form.provider}>
          <input type="radio" name="provider" checked={c.id === form.provider} onChange={() => pick(c.id)} />
          <ProviderLogo provider={c.id} />
          <span><strong>{c.label}</strong><span className="muted small block">{c.hint}</span></span>
        </label>
      ))}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>;

export function MailboxFormView({ form, onChange, providerFixed, hasSecret }: Props) {
  const set = (patch: Partial<MailboxForm>) => onChange({ ...form, ...patch });
  const keep = hasSecret ? "Leave empty to keep the saved one" : "";
  const text = (key: keyof MailboxForm, type = "text") => (
    <input type={type} value={String(form[key] ?? "")} onChange={(e) => set({ [key]: e.target.value })} autoComplete="off"
      placeholder={type === "password" ? keep : undefined} />
  );
  return (
    <div className="stack">
      {!providerFixed && <ProviderChoice form={form} onChange={onChange} />}
      <div className="form-grid">
        <Field label="Name in the panel">{text("label")}</Field>
        {form.provider === "imap" ? (
          <>
            <Field label="IMAP server">{text("host")}</Field>
            <Field label="Port"><input type="number" value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} /></Field>
            <Field label="User name">{text("user")}</Field>
            <Field label="Password">{text("password", "password")}</Field>
            <Field label="SMTP server (optional)">{text("smtpHost")}</Field>
            <Field label="SMTP port">
              <select value={form.smtpPort ?? 587} onChange={(e) => set({ smtpPort: Number(e.target.value) })}>
                <option value={587}>587</option><option value={465}>465</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Client ID">{text("clientId")}</Field>
            <Field label="Client secret">{text("clientSecret", "password")}</Field>
            {form.provider === "office365" && (
              <Field label="Tenant ID or domain (single-tenant apps)">
                <input value={form.tenant} onChange={(e) => set({ tenant: e.target.value })} autoComplete="off" placeholder="common" />
              </Field>
            )}
          </>
        )}
      </div>
      <label className="row"><input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Include in runs</label>
    </div>
  );
}
