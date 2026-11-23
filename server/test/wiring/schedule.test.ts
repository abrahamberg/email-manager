import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { everyMinutes } from "../../src/wiring/schedule.js";

describe("everyMinutes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs on every interval until stopped", async () => {
    const run = vi.fn(async () => true);
    const stop = everyMinutes(15, run);
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    stop();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does nothing without an interval", async () => {
    const run = vi.fn(async () => true);
    everyMinutes(undefined, run);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("keeps running after a failed run", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(async () => { throw new TypeError("boom"); });
    const stop = everyMinutes(1, run);
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    stop();
    expect(run).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledWith("schedule: run failed: TypeError");
    errors.mockRestore();
  });
});
