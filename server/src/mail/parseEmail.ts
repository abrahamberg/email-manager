import { createHash } from "node:crypto";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import type { Address, Email } from "./Email.js";

const MAX_TEXT = 20_000;
const MAX_LINKS = 50;

function addresses(field: AddressObject | AddressObject[] | undefined): Address[] {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list
    .flatMap((o) => o.value)
    .filter((a) => a.address)
    .map((a) => (a.name ? { name: a.name, address: a.address as string } : { address: a.address as string }));
}


function headersOf(parsed: ParsedMail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of parsed.headerLines) {
    const idx = line.line.indexOf(":");
    if (idx < 0) continue;
    const key = line.key.toLowerCase();
    const value = line.line.slice(idx + 1).replace(/\r?\n[ \t]+/g, " ").trim();
    out[key] = key in out ? `${out[key]}\n${value}` : value;
  }
  return out;
}

function ids(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v.join(" ") : (v ?? "");
  return s.match(/<[^>]+>/g) ?? [];
}

function fallbackId(date: string, from: string, subject: string): string {
  const h = createHash("sha256").update(`${date}|${from}|${subject}`).digest("hex").slice(0, 32);
  return `<generated-${h}@local.invalid>`;
}

function extractLinks(text: string, html: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) found.push(m[1]!);
  for (const m of `${text}\n${html}`.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) found.push(m[0]);
  const clean = found
    .map((u) => u.replace(/&amp;/g, "&").replace(/[.,;:!?]+$/, ""))
    .filter((u) => /^https?:\/\//i.test(u));
  return [...new Set(clean)].slice(0, MAX_LINKS);
}

export async function parseEmail(uid: number, source: Uint8Array): Promise<Email> {
  const parsed = await simpleParser(Buffer.from(source));
  const from = addresses(parsed.from)[0] ?? { address: "" };
  const subject = parsed.subject ?? "";
  const date = parsed.date ? parsed.date.toISOString() : "";
  const messageId = parsed.messageId?.trim() || fallbackId(date, from.address, subject);
  const threadId = ids(parsed.references)[0] ?? ids(parsed.inReplyTo)[0] ?? messageId;
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const text = (parsed.text ?? "").slice(0, MAX_TEXT);
  return {
    uid,
    messageId,
    threadId,
    from,
    ...(addresses(parsed.replyTo)[0] && { replyTo: addresses(parsed.replyTo)[0] }),
    to: addresses(parsed.to),
    cc: addresses(parsed.cc),
    subject,
    date,
    headers: headersOf(parsed),
    text,
    links: extractLinks(text, html),
    hasAttachments: parsed.attachments.some((a) => a.contentDisposition === "attachment"),
  };
}
