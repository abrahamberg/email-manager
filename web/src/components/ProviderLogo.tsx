import type { ReactElement } from "react";
import type { MailProvider } from "../api/setupApi";
import { Icon } from "./Icon";

// Bundled inline so the panel never fetches brand assets; the marks only identify the provider.
function GmailMark() {
  return (
    <svg viewBox="52 42 88 66" width="100%" height="100%" aria-hidden focusable="false">
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 23 23" width="100%" height="100%" aria-hidden focusable="false">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

const MARKS: Record<MailProvider, () => ReactElement> = {
  gmail: GmailMark,
  office365: MicrosoftMark,
  imap: () => <Icon name="mailbox" />,
};

export function ProviderLogo({ provider, size = 28 }: { provider: MailProvider; size?: number }) {
  const Mark = MARKS[provider];
  return (
    <span className="provider-logo" data-provider={provider} style={{ width: size, height: size }}>
      <Mark />
    </span>
  );
}
