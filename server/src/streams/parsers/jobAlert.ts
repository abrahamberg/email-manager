import type { Email } from "../../mail/Email";
import type { ExtractedItem } from "../splitItems";

const SUBJECT = /\bnew jobs?\b|\bjob alerts?\b|\bjobs? for you\b/i;
const JOB_LINE = /^(.{2,80}?) (?:at|@) (.{2,60})$/i;
const TECH = ["react", "typescript", "javascript", "node", "python", "java", "kotlin", "go", "rust", "aws", "kubernetes", "docker", "postgres", "sql", "swift", "vue", "angular", "c#", "ruby", "php"];
const MAX_FACTS = 3;

export function isJobAlert(email: Pick<Email, "from" | "subject">): boolean {
  return SUBJECT.test(email.subject) && /jobs?|careers?/i.test(email.from.address + (email.from.name ?? ""));
}

function techIn(text: string): string[] {
  const words = new Set(text.toLowerCase().split(/[^a-z0-9#+.]+/));
  return TECH.filter((t) => words.has(t));
}

const tidy = (l: string) => l.replace(/\[https?:[^\]]*\]/g, "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

const looksLikePlace = (l: string) => /^[\p{L} .'-]+(, [\p{L} .'-]+)*( \((remote|hybrid|on-site)\))?$/u.test(l) && l.length <= 60;

/** One item per "Title at Company" line; the lines after it (until the next job) give place and tech. */
export function parseJobAlert(email: Email): ExtractedItem[] | undefined {
  if (!isJobAlert(email)) return undefined;
  const lines = email.text.split("\n").map(tidy).filter(Boolean);
  const starts = lines.flatMap((l, i) => (JOB_LINE.test(l) ? [i] : []));
  const items = starts.map((start, n): ExtractedItem => {
    const [, title, company] = JOB_LINE.exec(lines[start]!)!;
    const block = lines.slice(start + 1, starts[n + 1] ?? lines.length);
    const place = block.find(looksLikePlace);
    const facts = [company!, ...(place ? [place] : []), ...techIn(block.join(" ") + " " + title)].slice(0, MAX_FACTS);
    const url = email.links.filter((l) => l.startsWith("https://"))[n];
    return { title: `${title} at ${company}`, facts, ...(url ? { url } : {}) };
  });
  return items.length > 0 ? items : undefined;
}
