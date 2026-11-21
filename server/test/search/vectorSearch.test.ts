import { describe, expect, it } from "vitest";
import { cosine } from "../../src/search/cosine";
import { vectorSearch } from "../../src/search/vectorSearch";
import { embeddingRepo } from "../../src/store/embeddings";
import type { Embedder } from "../../src/ports";
import { useFreshDb } from "../store/freshDb";

const DIM = 64;
const hash = (w: string) => [...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % DIM, 7);

const fakeEmbedder: Embedder = {
  async embed(texts) {
    return texts.map((t) => {
      const v = new Array<number>(DIM).fill(0);
      for (const w of t.toLowerCase().match(/[a-z]+/g) ?? []) v[hash(w)]! += 1;
      return v;
    });
  },
};

describe("cosine", () => {
  it.each([
    [[1, 0], [1, 0], 1],
    [[1, 0], [0, 1], 0],
    [[2, 0], [5, 0], 1],
    [[1, 0], [-1, 0], -1],
    [[0, 0], [1, 1], 0],
  ])("%j vs %j", (a, b, want) => expect(cosine(a, b)).toBeCloseTo(want));
});

describe("vectorSearch", () => {
  const db = useFreshDb();

  it("finds the closest owners and respects kind, limit and minScore", async () => {
    const s = vectorSearch(embeddingRepo(db()), fakeEmbedder);
    await s.index("message", "m1", "invoice for hotel booking in Paris");
    await s.index("message", "m2", "football match tickets on sale");
    await s.index("fact", "f1", "hotel booking confirmation number");

    const all = await s.search("hotel booking");
    expect(all.map((h) => h.ownerId)).toEqual(expect.arrayContaining(["m1", "f1"]));
    expect(all.map((h) => h.ownerId)).not.toContain("m2");
    expect(all[0]!.score).toBeGreaterThanOrEqual(all[1]!.score);

    const msgs = await s.search("hotel booking", { ownerKind: "message" });
    expect(msgs.map((h) => h.ownerId)).toEqual(["m1"]);
    expect(await s.search("hotel booking", { limit: 1 })).toHaveLength(1);
    expect(await s.search("hotel booking", { minScore: 0.99 })).toEqual([]);
  });
});
