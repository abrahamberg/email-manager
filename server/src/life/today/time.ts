const ZONE = "Europe/Stockholm";

function zoneOffsetMs(at: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(at)).map((x) => [x.type, Number(x.value)]),
  ) as Record<string, number>;
  const wall = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return wall - Math.floor(at / 1000) * 1000;
}

/** Midnight Stockholm time on the day of `now`, as an ISO instant. */
export function startOfTodayStockholm(now: Date): string {
  const wall = zoneOffsetMs(now.getTime()) + now.getTime();
  const dayWall = wall - (((wall % 86_400_000) + 86_400_000) % 86_400_000);
  let start = dayWall - zoneOffsetMs(dayWall);
  start = dayWall - zoneOffsetMs(start);
  return new Date(start).toISOString();
}

/** The next "HH:MM" briefing time after now (Stockholm), wrapping to tomorrow's first. */
export function nextBriefing(times: string[], now: Date): string {
  const sorted = [...times].sort();
  if (sorted.length === 0) return "";
  const local = new Date(now.getTime() + zoneOffsetMs(now.getTime()));
  const hhmm = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  return sorted.find((t) => t > hhmm) ?? sorted[0]!;
}
