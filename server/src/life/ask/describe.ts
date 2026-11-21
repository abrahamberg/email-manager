import type { Fact } from "@email-manager/shared";
import type { Question } from "./intent";

const ZONE = "Europe/Stockholm";
const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: ZONE });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });

export function formatDayTime(iso: string): string {
  const d = new Date(iso);
  return `${day.format(d)} at ${time.format(d)}`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function describeFact(fact: Fact, question: Question): string {
  if (question === "where" && fact.place) {
    return `${fact.title}: ${fact.place}.${fact.at ? ` ${formatDayTime(fact.at)}.` : ""}`;
  }
  const when = fact.at ? ` is on ${formatDayTime(fact.at)}` : "";
  const where = fact.place ? `, ${fact.place}` : "";
  return `${fact.title}${when}${where}. ${fact.detail}.`;
}
