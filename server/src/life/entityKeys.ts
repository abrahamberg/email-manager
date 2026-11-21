import type { Email } from "../mail/Email";
import type { Triage } from "../ports";
import { bulkSignals } from "../lowValue/bulkHeaders";

// Why: a shared consumer domain says nothing about which matter a sender belongs to.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de",
]);
const STOP = new Set(["the", "a", "an", "and", "of", "for", "to", "with", "re", "fwd", "your", "my"]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

function senderKeys(email: Pick<Email, "from" | "headers">): string[] {
  if (bulkSignals(email).isBulk) return [];
  const address = email.from.address.trim().toLowerCase();
  const domain = address.split("@")[1];
  const keys = [`addr:${address}`];
  if (domain && !FREE_MAIL.has(domain)) keys.push(`domain:${domain}`);
  return keys;
}

/** Keys an email shares with the matter it belongs to. Stored on the matter when it is created. */
export function entityKeys(email: Pick<Email, "from" | "headers">, triage: Pick<Triage, "matter">): string[] {
  const keys = senderKeys(email);
  const title = triage.matter ? normalizeTitle(triage.matter) : "";
  if (title) keys.push(`title:${title}`);
  return keys;
}
