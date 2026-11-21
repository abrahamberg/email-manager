import type { AutonomyLevel, CategoryPolicy } from "@email-manager/shared";

export const AUTONOMY_LEVELS: AutonomyLevel[] = ["watch", "suggest", "act", "quiet"];

const MIN_CHECKS_TO_PROMOTE = 20;
const MIN_ACCURACY_TO_PROMOTE = 0.95;
const MAX_ACCURACY_TO_DEMOTE = 0.8;

export function accuracy(policy: Pick<CategoryPolicy, "correct" | "checked">): number | undefined {
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

const isAtOrAbove = (level: AutonomyLevel, limit: AutonomyLevel) =>
  AUTONOMY_LEVELS.indexOf(level) >= AUTONOMY_LEVELS.indexOf(limit);

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
