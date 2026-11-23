/** Calls `run` every `minutes`; returns the function that stops it. Without minutes it does nothing. */
export function everyMinutes(minutes: number | undefined, run: () => Promise<unknown>): () => void {
  if (!minutes) return () => {};
  const tick = () => {
    run().catch((err: unknown) => console.error(`schedule: run failed: ${err instanceof Error ? err.name : "error"}`));
  };
  const timer = setInterval(tick, minutes * 60_000);
  return () => clearInterval(timer);
}
