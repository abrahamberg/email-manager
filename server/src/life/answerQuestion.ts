import type { Decision, EmailRef, Fact } from "@email-manager/shared";
import type { SearchHit, SearchOptions } from "../search/vectorSearch";
import type { StoredMessage } from "../store/messages";
import { describeFact, plural } from "./ask/describe";
import { intentOf, questionType, sharesWord, type Question } from "./ask/intent";

export type AskAction =
  | { type: "digest/unsubscribeCategory"; category: "marketing" }
  | { type: "settings/update"; patch: { dryRun: boolean } };

export interface Answer {
  text: string;
  fact?: Fact;
  matches: EmailRef[];
  proposal?: { label: string; action: AskAction };
}

export interface AskDeps {
  facts: { list(): Promise<Fact[]> };
  messages: { get(messageId: string): Promise<StoredMessage | undefined> };
  decisions: { pending(): Promise<Decision[]> };
  search: { search(query: string, opts?: SearchOptions): Promise<SearchHit[]> };
}

const MIN_FACT_SCORE = 0.3;
const MIN_MESSAGE_SCORE = 0.2;
const RELATED = 3;

const toRef = (m: StoredMessage): EmailRef => ({
  id: m.messageId,
  from: { name: m.fromName ?? m.fromAddress, address: m.fromAddress },
  subject: m.subject,
  receivedAt: m.receivedAt,
  snippet: m.compactText.slice(0, 160),
  category: m.category ?? "notification",
  areaId: m.areaId,
});

async function messagesByMeaning(deps: AskDeps, query: string, limit: number): Promise<EmailRef[]> {
  const hits = await deps.search.search(query, { ownerKind: "message", limit, minScore: MIN_MESSAGE_SCORE });
  const found = await Promise.all(hits.map((h) => deps.messages.get(h.ownerId)));
  return found.filter((m): m is StoredMessage => !!m).map(toRef);
}

const factText = (f: Fact) => `${f.title} ${f.detail} ${f.place ?? ""}`;

async function bestFact(deps: AskDeps, query: string, question: Question): Promise<Fact | undefined> {
  const hits = await deps.search.search(query, { ownerKind: "fact", limit: 10, minScore: MIN_FACT_SCORE });
  const byId = new Map((await deps.facts.list()).map((f) => [f.id, f]));
  return hits
    .map((h) => byId.get(h.ownerId))
    .filter((f): f is Fact => !!f)
    .filter((f) => (question === "when" ? f.at : question === "where" ? f.place : true))
    .find((f) => sharesWord(query, factText(f)));
}

async function factAnswer(deps: AskDeps, query: string, fact: Fact, question: Question): Promise<Answer> {
  const source = fact.sourceEmailId ? await deps.messages.get(fact.sourceEmailId) : undefined;
  const related = (await messagesByMeaning(deps, query, RELATED + 1)).filter((m) => m.id !== source?.messageId);
  const matches = [...(source ? [toRef(source)] : []), ...related.slice(0, RELATED)];
  return { text: describeFact(fact, question), fact, matches };
}

async function searchAnswer(deps: AskDeps, query: string): Promise<Answer> {
  const matches = await messagesByMeaning(deps, query, 10);
  if (matches.length === 0) return { text: "I couldn't find anything about that in your mail.", matches };
  return { text: `${plural(matches.length, "email")} about that, closest first:`, matches };
}

async function needsMeAnswer(deps: AskDeps): Promise<Answer> {
  const pending = await deps.decisions.pending();
  const text = pending.length === 0 ? "Nothing needs you right now." : `${plural(pending.length, "thing")} need you. The most urgent first:`;
  return { text, matches: pending.map((d) => d.email) };
}

const unsubscribeAnswer = (): Answer => ({
  text: "I can unsubscribe from your marketing senders using their List-Unsubscribe links.",
  matches: [],
  proposal: { label: "Unsubscribe from all", action: { type: "digest/unsubscribeCategory", category: "marketing" } },
});

const pauseAnswer = (): Answer => ({
  text: "I'll stop changing your mailbox and only show what I would do (dry-run).",
  matches: [],
  proposal: { label: "Pause automation", action: { type: "settings/update", patch: { dryRun: true } } },
});

export async function answerQuestion(deps: AskDeps, query: string): Promise<Answer> {
  const intent = intentOf(query);
  if (intent === "needsMe") return needsMeAnswer(deps);
  if (intent === "unsubscribe") return unsubscribeAnswer();
  if (intent === "pause") return pauseAnswer();
  const question = questionType(query);
  const fact = await bestFact(deps, query, question);
  return fact ? factAnswer(deps, query, fact, question) : searchAnswer(deps, query);
}
