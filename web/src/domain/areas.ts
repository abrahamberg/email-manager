import type { AppData, Area, Fact, Outcome } from "./types";

export interface AreaActivity {
  handled: Partial<Record<Outcome, number>>;
  handledTotal: number;
  needYou: number;
}

export function areaActivity(data: AppData, areaId: string): AreaActivity {
  const handled: Partial<Record<Outcome, number>> = {};
  const automatic = data.receipts.filter((receipt) => receipt.email.areaId === areaId && !receipt.byUser && !receipt.undone);
  for (const receipt of automatic) handled[receipt.outcome] = (handled[receipt.outcome] ?? 0) + 1;
  const needYou = data.decisions.filter((decision) => decision.email.areaId === areaId).length;
  return { handled, handledTotal: automatic.length, needYou };
}

const OUTCOME_PHRASES: Partial<Record<Outcome, string>> = {
  replied: "answered",
  digest: "summarised",
  labeled: "filed",
  archived: "archived",
  junk: "blocked",
};

export function describeHandled(activity: AreaActivity): string {
  if (activity.handledTotal === 0) return "";
  const parts = (Object.keys(OUTCOME_PHRASES) as Outcome[])
    .filter((outcome) => activity.handled[outcome])
    .map((outcome) => `${OUTCOME_PHRASES[outcome]} ${activity.handled[outcome]}`);
  return `I ${parts.join(", ")}`;
}

function mainOutcome(activity: AreaActivity): string {
  const [outcome, count] = (Object.keys(OUTCOME_PHRASES) as Outcome[])
    .map((key) => [key, activity.handled[key] ?? 0] as const)
    .sort((a, b) => b[1] - a[1])[0]!;
  return `${OUTCOME_PHRASES[outcome]} ${count}`;
}

export function handledHeadline(data: AppData, limit = 2): string {
  const parts = data.areas
    .map((area) => ({ area, activity: areaActivity(data, area.id) }))
    .filter(({ activity }) => activity.handledTotal > 0)
    .sort((a, b) => b.activity.handledTotal - a.activity.handledTotal)
    .slice(0, limit)
    .map(({ area, activity }) => `${mainOutcome(activity)} for ${area.shortName}`);
  return parts.length ? `I ${parts.join(" and ")}.` : "";
}

export function upcoming(facts: Fact[], fromIso: string, days: number): Fact[] {
  const from = Date.parse(fromIso);
  const until = from + days * 24 * 60 * 60 * 1000;
  return facts
    .filter((fact) => fact.at && Date.parse(fact.at) >= from && Date.parse(fact.at) <= until)
    .sort((a, b) => Date.parse(a.at!) - Date.parse(b.at!));
}

export function areaById(areas: Area[], id: string | undefined): Area | undefined {
  return areas.find((area) => area.id === id);
}
