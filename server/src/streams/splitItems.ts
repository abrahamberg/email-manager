import type { Email } from "../mail/Email";
import { parseJobAlert } from "./parsers/jobAlert";

export interface ExtractedItem {
  title: string;
  /** At most three. */
  facts: string[];
  url?: string;
  closes?: string;
}

export type Extract = (email: Email) => Promise<ExtractedItem[]>;

const KNOWN_PARSERS: ((email: Email) => ExtractedItem[] | undefined)[] = [parseJobAlert];

/** Known formats cost nothing; only unknown ones fall back to the model. */
export async function splitItems(email: Email, extract: Extract): Promise<ExtractedItem[]> {
  for (const parse of KNOWN_PARSERS) {
    const items = parse(email);
    if (items) return items;
  }
  return extract(email);
}
