import type { Embedder } from "../ports";
import { cosine } from "../search/cosine";
import type { ExtractedItem } from "./splitItems";

export const THRESHOLD = 0.45;
export const MAX_PICKS = 5;
const LIKED_WEIGHT = 0.1;
const DISLIKED_WEIGHT = 0.15;

export interface Interest {
  areaId: string;
  text: string;
  feedback: { liked: string[]; disliked: string[] };
}

export interface Pick {
  item: ExtractedItem;
  score: number;
  areaId: string;
  /** The interest that matched, for the later "why" line. */
  interest: string;
}

export interface Matches {
  picks: Pick[];
  /** Short summary of the unmatched items, e.g. "mostly frontend, crypto". */
  rest: string;
}

const STOP = new Set("with from your this that have will for and the new at in of to a an is are our you job jobs engineer developer senior junior remote".split(" "));

const nearest = (v: number[], others: number[][]) => (others.length ? Math.max(...others.map((o) => cosine(v, o))) : 0);

export function summariseRest(items: ExtractedItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const words = new Set(`${item.title} ${item.facts.join(" ")}`.toLowerCase().split(/[^\p{L}\p{N}#+]+/u));
    for (const w of words) if (w.length > 2 && !STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([w]) => w);
  return top.length ? `mostly ${top.join(", ")}` : "";
}

export async function matchInterests(items: ExtractedItem[], interests: Interest[], embedder: Embedder): Promise<Matches> {
  if (items.length === 0 || interests.length === 0) return { picks: [], rest: summariseRest(items) };
  const feedback = interests.map((i) => i.feedback);
  const texts = [
    ...items.map((i) => `${i.title}. ${i.facts.join(", ")}`),
    ...interests.map((i) => i.text),
    ...feedback.flatMap((f) => [...f.liked, ...f.disliked]),
  ];
  const vectors = await embedder.embed(texts);
  const itemVecs = vectors.slice(0, items.length);
  let at = items.length + interests.length;
  const interestVecs = vectors.slice(items.length, at);
  const feedbackVecs = feedback.map((f) => {
    const liked = vectors.slice(at, at + f.liked.length);
    const disliked = vectors.slice(at + f.liked.length, at + f.liked.length + f.disliked.length);
    at += f.liked.length + f.disliked.length;
    return { liked, disliked };
  });

  const scored = items.map((item, n) => {
    const v = itemVecs[n]!;
    const best = interests
      .map((it, k) => ({
        it,
        score: cosine(v, interestVecs[k]!) + LIKED_WEIGHT * nearest(v, feedbackVecs[k]!.liked) - DISLIKED_WEIGHT * nearest(v, feedbackVecs[k]!.disliked),
      }))
      .reduce((a, b) => (b.score > a.score ? b : a));
    return { item, score: best.score, areaId: best.it.areaId, interest: best.it.text };
  });
  const picks = scored.filter((s) => s.score >= THRESHOLD).sort((a, b) => b.score - a.score).slice(0, MAX_PICKS);
  const chosen = new Set(picks.map((p) => p.item));
  return { picks, rest: summariseRest(items.filter((i) => !chosen.has(i))) };
}
