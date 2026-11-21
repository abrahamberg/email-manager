import type { Area, Decision as PanelDecision, Fact, Settings, Stream } from "@email-manager/shared";
import type { MatterCandidate } from "../life/assignMatter";
import type { Drafter, Embedder } from "../ports";
import { vectorSearch } from "../search/vectorSearch";
import type { embeddingRepo, OwnerKind } from "../store/embeddings";
import type { Matter } from "../store/matters";
import type { StoredMessage } from "../store/messages";
import type { Interest } from "../streams/matchInterests";
import type { Extract } from "../streams/splitItems";
import { quietEmbedder } from "./quietEmbedder";

export interface WhyItem {
  title: string;
  facts: string[];
  interest: string;
}

/** One line per item, in order; undefined when there is no AI or no budget. */
export type WhyWriter = (streamName: string, items: WhyItem[]) => Promise<string[] | undefined>;

/** The slice of the store Phase 2 writes to, so tests can pass in-memory fakes. */
export interface LifeStore {
  areas: { list(): Promise<Area[]> };
  decisions: { add(d: PanelDecision): Promise<void> };
  facts: { save(f: Fact): Promise<void> };
  matters: {
    openCandidates(areaId?: string): Promise<MatterCandidate[]>;
    save(m: Matter): Promise<void>;
    attach(matterId: string, messageId: string): Promise<void>;
  };
  messages: { save(m: StoredMessage): Promise<void> };
  streams: { list(): Promise<Stream[]>; save(s: Stream): Promise<void> };
  settings: { get(): Promise<Settings | undefined> };
  embeddings: Pick<ReturnType<typeof embeddingRepo>, "save" | "get" | "nearest">;
}

export interface LifeDeps {
  store: LifeStore;
  embedder: Embedder;
  extract: Extract;
  drafter?: Drafter;
  writeWhy?: WhyWriter;
  user: { address: string; name: string };
  defaults: Settings;
  log?: (message: string) => void;
}

/** At most this many picks per run get an AI "why"; the rest get a plain one. */
export const AI_WHY_PER_RUN = 3;

/** LifeDeps for one run: a quiet embedder and the per-run reads done once. */
export interface LifeRun extends Omit<LifeDeps, "embedder"> {
  embedder: Embedder;
  index(kind: OwnerKind, ownerId: string, text: string): Promise<void>;
  areas(): Promise<Area[]>;
  settings(): Promise<Settings>;
  interests(): Promise<Interest[]>;
  takeWhySlots(wanted: number): number;
}

const once = <T>(load: () => Promise<T>) => {
  let value: Promise<T> | undefined;
  return () => (value ??= load());
};

export function prepareLife(deps: LifeDeps): LifeRun {
  const log = deps.log ?? ((m: string) => console.warn(m));
  const embedder = quietEmbedder(deps.embedder, log);
  const search = vectorSearch(deps.store.embeddings as ReturnType<typeof embeddingRepo>, embedder);
  const areas = once(() => deps.store.areas.list());
  let whyLeft = AI_WHY_PER_RUN;
  return {
    ...deps,
    log,
    embedder,
    index: search.index,
    areas,
    settings: once(async () => ({ ...deps.defaults, ...(await deps.store.settings.get()) })),
    interests: once(async () => interestsFrom(await areas(), await deps.store.streams.list())),
    takeWhySlots(wanted) {
      const n = Math.max(0, Math.min(wanted, whyLeft));
      whyLeft -= n;
      return n;
    },
  };
}

/** Area notes are what the user cares about; stream feedback nudges the match. */
export function interestsFrom(areas: Area[], streams: Stream[]): Interest[] {
  return areas.filter((a) => a.note?.trim()).map((a) => {
    const items = streams.filter((s) => s.areaId === a.id).flatMap((s) => s.picks);
    return {
      areaId: a.id,
      text: a.note!.trim(),
      feedback: {
        liked: items.filter((i) => i.feedback === "more").map((i) => i.title),
        disliked: items.filter((i) => i.feedback === "less").map((i) => i.title),
      },
    };
  });
}
