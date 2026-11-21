import type { Embedder } from "../ports";

/**
 * Search and matching are extras: when the local model fails, the run goes on
 * without vectors. An empty result means "no vector" to every caller.
 */
export function quietEmbedder(inner: Embedder, log: (message: string) => void): Embedder {
  let warned = false;
  return {
    async embed(texts) {
      try {
        return await inner.embed(texts);
      } catch (err) {
        if (!warned) log(`embedder unavailable, continuing without vectors: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200));
        warned = true;
        return [];
      }
    },
  };
}
