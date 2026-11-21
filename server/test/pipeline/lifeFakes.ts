import type { Area, Decision, Fact, Stream } from "@email-manager/shared";
import type { MatterCandidate } from "../../src/life/assignMatter";
import { DEFAULT_SETTINGS } from "../../src/life/buildAppData";
import type { LifeDeps, WhyWriter } from "../../src/pipeline/lifeDeps";
import type { Classifier, Drafter, Embedder, Triage } from "../../src/ports";
import type { Matter } from "../../src/store/matters";
import type { StoredMessage } from "../../src/store/messages";

const VOCAB = ["acme", "dinner", "friday", "school", "trip"];

/** Bag-of-words over a tiny vocabulary: enough for deterministic similarity. */
export function wordEmbedder(): Embedder & { calls: number } {
  const e = {
    calls: 0,
    async embed(texts: string[]) {
      e.calls++;
      return texts.map((t) => VOCAB.map((w) => (t.toLowerCase().includes(w) ? 1 : 0)));
    },
  };
  return e;
}

export const failingEmbedder: Embedder = { embed: async () => { throw new Error("model download failed"); } };

export function fakeLifeStore(areas: Area[] = []) {
  const saved = {
    decisions: [] as Decision[], facts: [] as Fact[], matters: [] as Matter[], attached: [] as [string, string][],
    messages: [] as StoredMessage[], streams: [] as Stream[], embeddings: [] as { kind: string; id: string }[],
  };
  const store: LifeDeps["store"] = {
    areas: { list: async () => areas },
    decisions: { add: async (d) => void saved.decisions.push(d) },
    facts: { save: async (f) => void saved.facts.push(f) },
    matters: {
      openCandidates: async (): Promise<MatterCandidate[]> =>
        saved.matters.map((m) => ({ id: m.id, title: m.title, areaId: m.areaId, threadIds: [], keys: m.keys ?? [], vector: m.vector })),
      save: async (m) => void saved.matters.push(m),
      attach: async (matterId, messageId) => void saved.attached.push([matterId, messageId]),
    },
    messages: { save: async (m) => void saved.messages.push(m) },
    streams: { list: async () => saved.streams, save: async (s) => void saved.streams.push(s) },
    settings: { get: async () => undefined },
    embeddings: {
      save: async (kind, id) => void saved.embeddings.push({ kind, id }),
      get: async () => undefined,
      nearest: async () => [],
    },
  };
  return { store, saved };
}

export const SCHOOL: Area = { id: "a-school", shortName: "School", kind: "family", name: "School", summary: "", note: "school trip", people: [] };
export const WORK: Area = { id: "a-work", shortName: "Work", kind: "work", name: "Work", summary: "", note: "Acme engineering roles", people: [] };

export function lifeDeps(over: Partial<LifeDeps> & { areas?: Area[] } = {}) {
  const { store, saved } = fakeLifeStore(over.areas ?? [SCHOOL, WORK]);
  const logs: string[] = [];
  const deps: LifeDeps = {
    store,
    embedder: wordEmbedder(),
    extract: async () => [],
    user: { address: "me@example.com", name: "me" },
    defaults: DEFAULT_SETTINGS,
    log: (m) => void logs.push(m),
    ...over,
  };
  return { deps, saved, logs };
}

export function classifierSaying(triage: Partial<Triage>): Classifier & { calls: number } {
  const full: Triage = { tier: "worthKnowing", category: "question", needsReply: false, facts: [], confidence: 0.9, why: "Because.", ...triage };
  const c = { calls: 0, triage: async () => (c.calls++, full) };
  return c;
}

export function fakeDrafter(text = "Yes, Friday works for me."): Drafter & { calls: number } {
  const d = { calls: 0, draftReply: async () => (d.calls++, { text, confidence: 0.9, topic: "schedule" as const }) };
  return d;
}

export function fakeWhy(): WhyWriter & { calls: number; sizes: number[] } {
  const sizes: number[] = [];
  const w = Object.assign(async (_name: string, items: unknown[]) => (w.calls++, sizes.push(items.length), items.map(() => "Fits your Acme search.")), { calls: 0, sizes });
  return w;
}
