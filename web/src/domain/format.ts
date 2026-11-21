const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

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
