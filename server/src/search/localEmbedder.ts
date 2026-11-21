import type { Embedder } from "../ports";

const BATCH = 16;
const MAX_CHARS = 512;

export interface LocalEmbedderOptions {
  model?: string;
  /** The cluster needs an emptyDir or PVC mounted here: the root filesystem is read-only. */
  cacheDir?: string;
}

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) =>
  Promise<{ tolist(): number[][] }>;

export function localEmbedder(opts: LocalEmbedderOptions = {}): Embedder {
  const model = opts.model ?? "Xenova/all-MiniLM-L6-v2";
  const cacheDir = opts.cacheDir ?? process.env.EMBEDDING_CACHE_DIR ?? "/tmp/models";
  let loading: Promise<Extractor> | undefined;

  const load = (): Promise<Extractor> => (loading ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = cacheDir;
    return (await pipeline("feature-extraction", model)) as unknown as Extractor;
  })().catch((e) => { loading = undefined; throw e; }));

  return {
    async embed(texts) {
      if (!texts.length) return [];
      const extract = await load();
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) {
        const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, MAX_CHARS));
        out.push(...(await extract(batch, { pooling: "mean", normalize: true })).tolist());
      }
      return out;
    },
  };
}
