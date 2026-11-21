// Search by meaning. In the mock a small concept map stands in for embedding
// similarity: words in the same group count as related. The server will use
// real embeddings and nearest-neighbour search instead; the scoring contract
// (higher score = closer meaning) stays the same.
const CONCEPTS: string[][] = [
  ["programming", "programmer", "developer", "developers", "code", "coding", "software", "engineer", "engineering", "backend", "java", "c#", "kotlin", "rust", "python", "javascript", "runtime", "coroutines", "take-home"],
  ["job", "jobs", "role", "roles", "position", "hiring", "recruiter", "interview", "career", "applying", "application"],
  ["tire", "tyre", "däck", "wheel", "car", "winter"],
  ["address", "where", "located", "location", "street", "adress", "place"],
  ["school", "class", "teacher", "parents", "elsa", "3b", "trip", "fair", "carpool", "swimming"],
  ["party", "birthday", "invitation", "invited"],
  ["dentist", "teeth", "dental"],
  ["money", "pay", "payment", "bill", "invoice", "price", "statement", "bank", "kr", "swish"],
  ["meeting", "call", "appointment", "booked", "booking", "schedule"],
  ["contract", "renewal", "signature", "sign"],
];

const STOP_WORDS = new Set(["the", "and", "for", "you", "your", "what", "when", "did", "does", "have", "has", "to", "of", "is", "are", "my", "me", "i", "a", "an", "do", "about", "anything", "any", "show", "find", "change", "this", "that", "with", "from"]);

function normalize(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9#åäö-]+/)
    .map(normalize)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function relatedWords(word: string): string[] {
  return CONCEPTS.filter((group) => group.some((member) => normalize(member) === word)).flat().map(normalize);
}

export interface ExpandedQuery {
  direct: Set<string>;
  related: Set<string>;
}

export function expandQuery(query: string): ExpandedQuery {
  const direct = new Set(tokenize(query));
  const related = new Set([...direct].flatMap(relatedWords).filter((word) => !direct.has(word)));
  return { direct, related };
}

const DIRECT_WEIGHT = 2;
const RELATED_WEIGHT = 1;

export function similarity(query: ExpandedQuery, text: string): number {
  const words = new Set(tokenize(text));
  let score = 0;
  for (const word of query.direct) if (words.has(word)) score += DIRECT_WEIGHT;
  for (const word of query.related) if (words.has(word)) score += RELATED_WEIGHT;
  return score;
}

export function sharesWord(query: ExpandedQuery, text: string): boolean {
  const words = new Set(tokenize(text));
  return [...query.direct].some((word) => words.has(word));
}

export function rankByMeaning<T>(query: string, items: T[], textOf: (item: T) => string, minScore = 1): T[] {
  const expanded = expandQuery(query);
  return items
    .map((item) => ({ item, score: similarity(expanded, textOf(item)) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
