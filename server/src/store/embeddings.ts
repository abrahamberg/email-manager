import type { Db } from "./db";
import { pgRealArray } from "./convert";

export type OwnerKind = "message" | "matter" | "fact" | "area" | "streamItem";

export interface Neighbour {
  ownerId: string;
  score: number;
}


function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Plain real[] (no pgvector): data is one mailbox, so ranking in memory is enough. */
export function embeddingRepo(db: Db) {
  return {
    async save(kind: OwnerKind, ownerId: string, vector: number[]) {
      await db.query(
        `INSERT INTO embeddings (owner_kind, owner_id, vector) VALUES ($1, $2, $3::real[])
         ON CONFLICT (owner_kind, owner_id) DO UPDATE SET vector = $3::real[], updated_at = now()`,
        [kind, ownerId, pgRealArray(vector)],
      );
    },
    async get(kind: OwnerKind, ownerId: string): Promise<number[] | undefined> {
      const [r] = await db.query<{ vector: number[] }>(
        "SELECT vector FROM embeddings WHERE owner_kind = $1 AND owner_id = $2", [kind, ownerId]);
      return r?.vector.map(Number);
    },
    async nearest(kind: OwnerKind, vector: number[], k: number): Promise<Neighbour[]> {
      const rows = await db.query<{ owner_id: string; vector: number[] }>(
        "SELECT owner_id, vector FROM embeddings WHERE owner_kind = $1", [kind]);
      return rows
        .map((r) => ({ ownerId: r.owner_id, score: cosine(vector, r.vector.map(Number)) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    },
  };
}
