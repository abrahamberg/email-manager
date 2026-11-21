import type { AutonomyLevel, CategoryPolicy } from "./types";

export const AUTONOMY_LEVELS: AutonomyLevel[] = ["watch", "suggest", "act", "quiet"];

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  watch: "Watch",
  suggest: "Suggest",
  act: "Act and tell me",
  quiet: "Act quietly",
};

export const AUTONOMY_HINTS: Record<AutonomyLevel, string> = {
  watch: "Shows what it would do, does nothing",
  suggest: "Prepares it, you approve on Today",
  act: "Does it, lists it in Handled with Undo",
  quiet: "Does it without listing it",
};

export type PresetName = "careful" | "balanced" | "handsOff";

export interface Preset {
  label: string;
  description: string;
  bulk: AutonomyLevel;
  people: AutonomyLevel;
}

// "Bulk" is mail nobody wrote to you personally; "people" is mail that may
// need a reply. Even hands-off keeps people at suggest: sending is opt-in.
export const PRESETS: Record<PresetName, Preset> = {
  careful: { label: "Careful", description: "I prepare everything, you approve everything.", bulk: "suggest", people: "suggest" },
  balanced: { label: "Balanced", description: "I sort bulk mail on my own and prepare replies for you.", bulk: "act", people: "suggest" },
  handsOff: { label: "Hands-off", description: "Bulk mail disappears quietly. Replies are still yours to approve.", bulk: "quiet", people: "suggest" },
};

export function levelForPreset(preset: Preset, policy: CategoryPolicy): AutonomyLevel {
  return policy.sendsMail || policy.category === "question" ? preset.people : preset.bulk;
}

const MIN_CHECKS_TO_PROMOTE = 20;
const MIN_ACCURACY_TO_PROMOTE = 0.95;
const MAX_ACCURACY_TO_DEMOTE = 0.8;

export function accuracy(policy: CategoryPolicy): number | undefined {
  return policy.checked === 0 ? undefined : policy.correct / policy.checked;
}

// Sending mail on its own is the riskiest thing the system does, so it is
// never suggested above "suggest". Only the user can raise it.
function highestSuggestedLevel(policy: CategoryPolicy): AutonomyLevel {
  return policy.sendsMail ? "suggest" : "quiet";
}

function stepLevel(level: AutonomyLevel, step: 1 | -1): AutonomyLevel {
  const index = AUTONOMY_LEVELS.indexOf(level) + step;
  return AUTONOMY_LEVELS[Math.min(Math.max(index, 0), AUTONOMY_LEVELS.length - 1)] ?? level;
}

function isAtOrAbove(level: AutonomyLevel, limit: AutonomyLevel): boolean {
  return AUTONOMY_LEVELS.indexOf(level) >= AUTONOMY_LEVELS.indexOf(limit);
}

export function suggestAutonomy(policy: CategoryPolicy): AutonomyLevel | undefined {
  const rate = accuracy(policy);
  if (rate === undefined) return undefined;
  if (rate <= MAX_ACCURACY_TO_DEMOTE && policy.level !== "watch") return stepLevel(policy.level, -1);
  const canPromote =
    policy.checked >= MIN_CHECKS_TO_PROMOTE &&
    rate >= MIN_ACCURACY_TO_PROMOTE &&
    !isAtOrAbove(policy.level, highestSuggestedLevel(policy));
  return canPromote ? stepLevel(policy.level, 1) : undefined;
}
