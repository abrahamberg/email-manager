/** Drivers differ in how they return timestamps and bigints; repos normalise here. */
export function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
}

export function isoOrUndef(v: unknown): string | undefined {
  return v == null ? undefined : iso(v);
}

export function orUndef<T>(v: T | null): T | undefined {
  return v ?? undefined;
}

export function json(v: unknown): string {
  return JSON.stringify(v);
}

/** A Postgres array literal for a real[] parameter (cast with ::real[]). */
export function pgRealArray(v: number[]): string {
  return `{${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}}`;
}
