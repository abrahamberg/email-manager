import type { Email } from "../mail/Email";
import type { ReplyDraft } from "./draftReply";

const MAX_HEADER = 900;

/** Strips CR/LF and other control characters so a value cannot start a new header. */
export function headerValue(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_HEADER);
}

const ADDRESS_RE = /^[^\s@<>()",;:\\[\]]+@[a-z0-9.-]+\.[a-z0-9-]{2,}$/i;
const cleanAddress = (a: string) => {
  const v = headerValue(a);
  return ADDRESS_RE.test(v) ? v : undefined;
};
const domainOf = (a: string) => a.slice(a.lastIndexOf("@") + 1).toLowerCase();
const msgId = (id: string) => {
  const v = headerValue(id).replace(/[<>\s]/g, "");
  return v.includes("@") ? `<${v}>` : undefined;
};

/** The sender, or Reply-To only when it stays on the sender's own domain. Never the model. */
export function replyRecipient(email: Email): string | undefined {
  const from = cleanAddress(email.from.address);
  if (!from) return undefined;
  const replyTo = email.replyTo && cleanAddress(email.replyTo.address);
  return replyTo && domainOf(replyTo) === domainOf(from) ? replyTo : from;
}

export function replySubject(subject: string): string {
  const s = headerValue(subject).replace(/^(?:\s*(?:re|sv|aw)\s*:\s*)+/i, "");
  return `Re: ${s}`;
}

function references(email: Email): string[] {
  const prior = (email.headers["references"] ?? "").split(/\s+/).map(msgId).filter((x): x is string => !!x);
  const own = msgId(email.messageId);
  return own && !prior.includes(own) ? [...prior, own].slice(-20) : prior.slice(-20);
}

const encodeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);

/** RFC 822 text for IMAP APPEND to Drafts. Recipients come only from the original headers. */
export function buildDraft(email: Email, draft: ReplyDraft, userAddress: string, now = new Date()): string | undefined {
  const to = replyRecipient(email);
  const from = cleanAddress(userAddress);
  if (!to || !from) return undefined;
  const refs = references(email);
  const inReplyTo = msgId(email.messageId);
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeWord(replySubject(email.subject))}`,
    `Date: ${now.toUTCString().replace("GMT", "+0000")}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(refs.length ? [`References: ${refs.join(" ")}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
  ];
  const body = Buffer.from(draft.text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}\r\n`;
}
