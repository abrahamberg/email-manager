// The user's zone. Will come from settings once the backend stores it.
const TIME_ZONE = "Europe/Stockholm";

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE });

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

export function formatPercent(rate: number | undefined): string {
  return rate === undefined ? "No checks yet" : `${Math.round(rate * 100)}%`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount < 0.1 ? 3 : 2)}`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function formatDayTime(iso: string): string {
  return `${formatDay(iso)} at ${formatTime(iso)}`;
}
