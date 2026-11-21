import type { Address, Email } from "../mail/Email";
import type { CompactEmail } from "../ports";

export const MAX_TEXT = 1500;

// Where quoted history or a signature starts; everything from that line on is dropped.
const CUT_MARKERS: RegExp[] = [
  /^On .{0,200}wrote:\s*$/i,
  /^Le .{0,200}a écrit\s*:\s*$/i,
  /^Am .{0,200}schrieb.{0,100}:\s*$/i,
  /^-{2,}\s*(Original|Forwarded) Message\s*-{2,}/i,
  /^_{10,}\s*$/,
  /^From:\s.+$/i, // Outlook-style quoted header block
  /^-- ?$/, // signature delimiter
  /^Sent from my \w+/i,
  /^Get Outlook for /i,
];

const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤﻿]/g;
const URL_RE = /\bhttps?:\/\/[^\s<>()"']+/gi;

function linkLabel(url: string): string {
  try {
    return `[link: ${new URL(url).hostname}]`;
  } catch {
    return "[link]";
  }
}

function cutAtQuoteOrSignature(lines: string[]): string[] {
  const end = lines.findIndex((line, i) => i > 0 && CUT_MARKERS.some((m) => m.test(line.trim())));
  return end === -1 ? lines : lines.slice(0, end);
}

function clean(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").replace(INVISIBLE, "").split("\n");
  return cutAtQuoteOrSignature(lines)
    .filter((line) => !line.trimStart().startsWith(">"))
    .map((line) => line.replace(URL_RE, linkLabel).replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cap(text: string, max = MAX_TEXT): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

const formatAddress = (a: Address) => (a.name ? `${a.name} <${a.address}>` : a.address);

/** The capped, stripped view the model sees. Pure. */
export function compactEmail(email: Email): CompactEmail {
  return {
    from: formatAddress(email.from),
    subject: email.subject.replace(/\s+/g, " ").trim(),
    date: email.date,
    text: cap(clean(email.text)),
  };
}
