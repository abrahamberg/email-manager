import type { Embedder } from "../ports";
import type { OwnerKind, embeddingRepo } from "../store/embeddings";
import type { Neighbour } from "../store/embeddings";

const KINDS: OwnerKind[] = ["message", "matter", "fact", "area", "streamItem"];

export interface SearchOptions {
  ownerKind?: OwnerKind;
  limit?: number;
  minScore?: number;
}

export interface SearchHit extends Neighbour {
  ownerKind: OwnerKind;
}

export function vectorSearch(repo: ReturnType<typeof embeddingRepo>, embedder: Embedder) {
  return {
    async index(ownerKind: OwnerKind, ownerId: string, text: string): Promise<void> {
      const [vector] = await embedder.embed([text]);
      if (vector) await repo.save(ownerKind, ownerId, vector);
    },
    async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
      const { ownerKind, limit = 10, minScore = 0.3 } = opts;
      const [vector] = await embedder.embed([query]);
      if (!vector) return [];
      const hits: SearchHit[] = [];
      for (const kind of ownerKind ? [ownerKind] : KINDS) {
        for (const n of await repo.nearest(kind, vector, limit)) hits.push({ ...n, ownerKind: kind });
      }
      return hits.filter((h) => h.score >= minScore).sort((a, b) => b.score - a.score).slice(0, limit);
    },
  };
}
