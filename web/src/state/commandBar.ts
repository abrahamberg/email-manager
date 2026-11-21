import type { Action } from "./actions";
import type { AppData, EmailRef } from "../domain/types";
import { plural } from "../domain/format";
import { allEmails } from "./selectors";

export interface CommandAnswer {
  text: string;
  matches: EmailRef[];
  proposal?: { label: string; action: Action };
}

const STOP_WORDS = new Set(["what", "did", "the", "send", "sent", "me", "this", "week", "from", "show", "any", "all", "my", "a", "to"]);

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
  const digest = digestLines(data, query);
  if (matches.length === 0 && digest.length === 0) return { text: "I found nothing matching that today.", matches };
  const summary = digest.length > 0 ? ` From the digest: ${digest.join(" · ")}` : "";
  return { text: `I found ${plural(matches.length, "email")}.${summary}`, matches };
}

function needsMeAnswer(data: AppData): CommandAnswer {
  const count = data.decisions.length;
  return {
    text: count === 0 ? "Nothing needs you right now." : `${plural(count, "thing")} need you. The most urgent first:`,
    matches: data.decisions.map((decision) => decision.email),
  };
}

function digestLines(data: AppData, query: string): string[] {
  const words = keywords(query);
  return data.digest.flatMap((group) =>
    group.entries
      .filter((entry) => words.some((word) => `${group.sender.name} ${entry.subject} ${entry.summary}`.toLowerCase().includes(word)))
      .map((entry) => `${group.sender.name}: ${entry.summary}`),
  );
}

export function answerQuery(data: AppData, query: string): CommandAnswer {
  const normalized = query.toLowerCase();
  if (/\b(need|urgent|important|waiting)\b/.test(normalized)) return needsMeAnswer(data);
  if (normalized.includes("unsubscribe")) return unsubscribeAnswer(data);
  if (/\b(pause|stop|dry.?run)\b/.test(normalized)) return pauseAnswer();
  return searchAnswer(data, query);
}
