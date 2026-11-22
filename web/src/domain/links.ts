export type TextPart = { text: string; href?: string };

const URL_RE = /https?:\/\/[^\s<>()"']+/gi;
const TRAILING = /[.,;:!?\]]+$/;
const MAX_SHOWN = 70;

function safeHref(candidate: string): string | undefined {
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const shorten = (url: string) => (url.length > MAX_SHOWN ? `${url.slice(0, MAX_SHOWN - 1)}…` : url);

/** Splits mail text into plain and link parts. Only http(s) becomes a link, and the shown text is the real address. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0].replace(TRAILING, "");
    const href = safeHref(raw);
    if (!href) continue;
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: shorten(raw), href });
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
