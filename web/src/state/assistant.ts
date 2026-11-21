import type { Action } from "./actions";
import type { AppData, EmailRef, Fact } from "../domain/types";
import { formatDayTime, plural } from "../domain/format";
import { expandQuery, rankByMeaning, sharesWord } from "../domain/semantic";
import { allEmails } from "./selectors";

export interface Answer {
  text: string;
  fact?: Fact;
  matches: EmailRef[];
  proposal?: { label: string; action: Action };
}

type Question = "when" | "where" | "other";

// A fact is only used as the answer when it shares a word with the question
// and scores well overall; a vague match shows emails instead of guessing.
const MIN_FACT_SCORE = 3;

function questionType(query: string): Question {
  if (/\b(when|what time|what day|date)\b/i.test(query)) return "when";
  if (/\b(where|address|adress|located)\b/i.test(query)) return "where";
  return "other";
}

function factText(fact: Fact, data: AppData): string {
  const area = data.areas.find((item) => item.id === fact.areaId)?.name ?? "";
  return `${fact.title} ${fact.detail} ${fact.place ?? ""} ${area}`;
}

function bestFact(data: AppData, query: string, question: Question): Fact | undefined {
  const expanded = expandQuery(query);
  const candidates = data.facts
    .filter((fact) => (question === "when" ? fact.at : question === "where" ? fact.place : true))
    .filter((fact) => sharesWord(expanded, factText(fact, data)));
  return rankByMeaning(query, candidates, (fact) => factText(fact, data), MIN_FACT_SCORE)[0];
}

function describeFact(fact: Fact, question: Question): string {
  if (question === "where" && fact.place) return `${fact.title}: ${fact.place}.${fact.at ? ` ${formatDayTime(fact.at)}.` : ""}`;
  const when = fact.at ? ` is on ${formatDayTime(fact.at)}` : "";
  const where = fact.place ? `, ${fact.place}` : "";
  return `${fact.title}${when}${where}. ${fact.detail}.`;
}

function emailText(email: EmailRef, data: AppData): string {
  return `${email.from.name} ${email.subject} ${email.snippet} ${data.details[email.id]?.body ?? ""}`;
}

export function searchByMeaning(data: AppData, query: string): EmailRef[] {
  return rankByMeaning(query, allEmails(data), (email) => emailText(email, data));
}

function factAnswer(data: AppData, query: string, fact: Fact, question: Question): Answer {
  const source = allEmails(data).find((email) => email.id === fact.sourceEmailId);
  const related = searchByMeaning(data, query).filter((email) => email.id !== source?.id).slice(0, 3);
  return { text: describeFact(fact, question), fact, matches: source ? [source, ...related] : related };
}

function searchAnswer(data: AppData, query: string): Answer {
  const matches = searchByMeaning(data, query);
  if (matches.length === 0) return { text: "I couldn't find anything about that in your mail.", matches };
  return { text: `${plural(matches.length, "email")} about that, closest first:`, matches };
}

function needsMeAnswer(data: AppData): Answer {
  const count = data.decisions.length;
  return {
    text: count === 0 ? "Nothing needs you right now." : `${plural(count, "thing")} need you. The most urgent first:`,
    matches: data.decisions.map((decision) => decision.email),
  };
}

function unsubscribeAnswer(data: AppData): Answer {
  const senders = data.digest.filter((group) => group.category === "marketing" && group.state !== "unsubscribed");
  return {
    text: `I found ${plural(senders.length, "marketing sender")} in your digest. I can unsubscribe from all of them using their List-Unsubscribe links.`,
    matches: [],
    proposal: { label: "Unsubscribe from all", action: { type: "digest/unsubscribeCategory", category: "marketing" } },
  };
}

function pauseAnswer(): Answer {
  return {
    text: "I'll stop changing your mailbox and only show what I would do (dry-run).",
    matches: [],
    proposal: { label: "Pause automation", action: { type: "settings/update", patch: { dryRun: true } } },
  };
}

export function answerQuestion(data: AppData, query: string): Answer {
  const normalized = query.toLowerCase();
  if (/\b(needs? me|urgent|what should i do)\b/.test(normalized)) return needsMeAnswer(data);
  if (normalized.includes("unsubscribe")) return unsubscribeAnswer(data);
  if (/\b(pause|dry.?run)\b/.test(normalized)) return pauseAnswer();
  const question = questionType(query);
  const fact = bestFact(data, query, question);
  return fact ? factAnswer(data, query, fact, question) : searchAnswer(data, query);
}
