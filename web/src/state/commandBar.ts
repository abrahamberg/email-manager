import type { Action } from "./actions";
import type { AppData, EmailRef } from "../domain/types";
import { plural } from "../domain/format";

export interface CommandAnswer {
  text: string;
  matches: EmailRef[];
  proposal?: { label: string; action: Action };
}

const STOP_WORDS = new Set(["what", "did", "the", "send", "sent", "me", "this", "week", "from", "show", "any", "all", "my", "a", "to"]);

function allEmails(data: AppData): EmailRef[] {
  const seen = new Map<string, EmailRef>();
  for (const email of [...data.decisions.map((d) => d.email), ...data.receipts.map((r) => r.email)]) {
    seen.set(email.id, email);
  }
  return [...seen.values()];
}

function keywords(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9@.]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function emailMatches(email: EmailRef, words: string[]): boolean {
  const haystack = `${email.from.name} ${email.from.address} ${email.subject} ${email.snippet} ${email.category}`.toLowerCase();
  return words.some((word) => haystack.includes(word));
}

export function searchEmails(data: AppData, query: string): EmailRef[] {
  const words = keywords(query);
  return words.length === 0 ? [] : allEmails(data).filter((email) => emailMatches(email, words));
}

function unsubscribeAnswer(data: AppData): CommandAnswer {
  const senders = data.digest.filter((group) => group.category === "marketing" && group.state !== "unsubscribed");
  return {
    text: `I found ${plural(senders.length, "marketing sender")} in your digest. I can unsubscribe from all of them using their List-Unsubscribe links.`,
    matches: [],
    proposal: { label: "Unsubscribe from all", action: { type: "digest/unsubscribeCategory", category: "marketing" } },
  };
}

function pauseAnswer(): CommandAnswer {
  return {
    text: "I'll stop changing your mailbox and only show what I would do (dry-run).",
    matches: [],
    proposal: { label: "Pause automation", action: { type: "settings/update", patch: { dryRun: true } } },
  };
}

function searchAnswer(data: AppData, query: string): CommandAnswer {
  const matches = searchEmails(data, query);
  const text = matches.length === 0 ? "I found nothing matching that today." : `I found ${plural(matches.length, "email")}:`;
  return { text, matches };
}

export function answerQuery(data: AppData, query: string): CommandAnswer {
  const normalized = query.toLowerCase();
  if (normalized.includes("unsubscribe")) return unsubscribeAnswer(data);
  if (/\b(pause|stop|dry.?run)\b/.test(normalized)) return pauseAnswer();
  return searchAnswer(data, query);
}
