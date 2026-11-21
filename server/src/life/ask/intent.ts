export type Intent = "needsMe" | "unsubscribe" | "pause" | "question";
export type Question = "when" | "where" | "other";

export function intentOf(query: string): Intent {
  const q = query.toLowerCase();
  if (/\b(needs? me|urgent|what should i do)\b/.test(q)) return "needsMe";
  if (q.includes("unsubscribe")) return "unsubscribe";
  if (/\b(pause|dry.?run)\b/.test(q)) return "pause";
  return "question";
}

export function questionType(query: string): Question {
  if (/\b(when|what time|what day|date)\b/i.test(query)) return "when";
  if (/\b(where|address|adress|located)\b/i.test(query)) return "where";
  return "other";
}

const STOP = new Set(["the", "and", "for", "have", "has", "what", "when", "where", "does", "did", "are", "was",
  "with", "about", "anything", "any", "from", "that", "this", "address", "time", "date", "day", "you", "your", "can"]);

const words = (text: string) => (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w));

/** Guards against a vague embedding match being presented as a fact. */
export function sharesWord(query: string, text: string): boolean {
  const have = new Set(words(text));
  return words(query).some((w) => have.has(w));
}
