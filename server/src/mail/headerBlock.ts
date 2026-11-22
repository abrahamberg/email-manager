import type { Address } from "./Email.js";

/** Lower-cased names; folded lines joined; repeated headers joined with "\n" (as in Email.headers). */
export function parseHeaderBlock(block: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  const unfolded = new TextDecoder().decode(block).replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    out[key] = key in out ? `${out[key]}\n${value}` : value;
  }
  return out;
}

/** The first address of a From header, with a display name when there is one. */
export function parseFrom(value: string | undefined): Address {
  const raw = value ?? "";
  const angled = /^(.*?)<([^<>\s]+@[^<>\s]+)>/.exec(raw);
  const address = (angled?.[2] ?? /[^\s<>"',;]+@[^\s<>"',;]+/.exec(raw)?.[0] ?? "").toLowerCase();
  const name = angled?.[1]?.trim().replace(/^"|"$/g, "");
  return name ? { name, address } : { address };
}
