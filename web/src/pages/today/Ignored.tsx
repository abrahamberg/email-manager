import { ignoredTotal } from "../../domain/briefing";
import { plural } from "../../domain/format";
import { useAppData } from "../../state/StoreProvider";

export function Ignored() {
  const data = useAppData();
  const total = ignoredTotal(data);
  if (total === 0) return null;
  const breakdown = data.briefing.ignored.map((group) => `${group.count} ${group.label}`).join(", ");
  return (
    <section className="stack-tight" aria-label="Not worth your time">
      <h2>Not worth your time</h2>
      <p className="muted">
        {plural(total, "email")} didn't need you: {breakdown}. <a href="#digest">Skim them</a>
      </p>
    </section>
  );
}
