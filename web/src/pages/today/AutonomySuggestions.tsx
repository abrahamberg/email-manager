import type { AutonomyLevel, CategoryPolicy } from "../../domain/types";
import { AUTONOMY_LABELS, AUTONOMY_LEVELS, accuracy, suggestAutonomy } from "../../domain/autonomy";
import { formatPercent } from "../../domain/format";
import { Button } from "../../components/ui";
import { useStore } from "../../state/StoreProvider";

interface Suggestion {
  policy: CategoryPolicy;
  level: AutonomyLevel;
}

function isPromotion({ policy, level }: Suggestion): boolean {
  return AUTONOMY_LEVELS.indexOf(level) > AUTONOMY_LEVELS.indexOf(policy.level);
}

function message(suggestion: Suggestion): string {
  const { policy, level } = suggestion;
  const record = `I was right ${policy.correct} of ${policy.checked} times (${formatPercent(accuracy(policy))})`;
  return isPromotion(suggestion)
    ? `${record}. Shall I move from “${AUTONOMY_LABELS[policy.level]}” to “${AUTONOMY_LABELS[level]}”?`
    : `${record}, which isn't good enough. I'd like to step back to “${AUTONOMY_LABELS[level]}” until I improve.`;
}

// Demotions first: being wrong matters more than doing more. Then the
// suggestion with the most evidence. One at a time keeps Today short.
function mostImportant(suggestions: Suggestion[]): Suggestion | undefined {
  return [...suggestions].sort((a, b) => Number(isPromotion(a)) - Number(isPromotion(b)) || b.policy.checked - a.policy.checked)[0];
}

export function AutonomySuggestions() {
  const { state, dispatch } = useStore();
  const suggestions = state.data.policies.flatMap((policy) => {
    const level = suggestAutonomy(policy);
    return level ? [{ policy, level }] : [];
  });
  const top = mostImportant(suggestions);
  if (!top) return null;
  const others = suggestions.length - 1;

  return (
    <section className="stack">
      <h2>{isPromotion(top) ? "I can take more off your plate" : "I should do less here"}</h2>
      <div className="card stack">
        <p><strong>{top.policy.label}</strong>: {message(top)}</p>
        <div className="spread">
          <Button size="small" variant="primary" onClick={() => dispatch({ type: "policy/setLevel", category: top.policy.category, level: top.level })}>
            Yes, do it
          </Button>
          {others > 0 && <a className="small" href="#delegation">{others} more suggestion{others === 1 ? "" : "s"} in Delegation</a>}
        </div>
      </div>
    </section>
  );
}
