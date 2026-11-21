const MASK = (1n << 64n) - 1n;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const SHINGLE = 3;

function fnv1a64(text: string): bigint {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h = ((h ^ BigInt(text.charCodeAt(i))) * FNV_PRIME) & MASK;
  }
  return h;
}

/** Digits are collapsed so "week 12" and "week 13" hash alike. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\d+/g, "0")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function shingles(tokens: string[]): string[] {
  if (tokens.length <= SHINGLE) return tokens.length ? [tokens.join(" ")] : [];
  const out: string[] = [];
  for (let i = 0; i + SHINGLE <= tokens.length; i++) out.push(tokens.slice(i, i + SHINGLE).join(" "));
  return out;
}

export function simhash(text: string): bigint {
  const counts = new Array<number>(64).fill(0);
  for (const s of shingles(words(text))) {
    const h = fnv1a64(s);
    for (let bit = 0; bit < 64; bit++) counts[bit]! += (h >> BigInt(bit)) & 1n ? 1 : -1;
  }
  let out = 0n;
  for (let bit = 0; bit < 64; bit++) if (counts[bit]! > 0) out |= 1n << BigInt(bit);
  return out;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

export function isNearDuplicate(a: bigint, b: bigint, maxDistance = 3): boolean {
  return hammingDistance(a, b) <= maxDistance;
}
