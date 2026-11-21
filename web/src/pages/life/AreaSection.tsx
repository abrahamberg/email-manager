import type { Area, Fact } from "../../domain/types";
import { plural } from "../../domain/format";
import { AreaNote } from "./AreaNote";
import { FactRow } from "./FactRow";

export function AreaSection({ area, facts }: { area: Area; facts: Fact[] }) {
  return (
    <section className="card stack area-section" aria-label={area.name}>
      <div className="stack-tight">
        <h2>{area.name}</h2>
        <p className="muted">{area.summary}</p>
      </div>
      <AreaNote area={area} />
      {area.people.length > 0 && (
        <div className="stack-tight">
          <span className="section-title">People</span>
          <div className="row">
            {area.people.map((person) => (
              <span key={person.name} className="chip">{person.name}, {person.role}</span>
            ))}
          </div>
        </div>
      )}
      {facts.length > 0 && (
        <div className="stack-tight">
          <span className="section-title">{plural(facts.length, "thing")} I picked up</span>
          <ul className="list facts">
            {facts.map((fact) => <FactRow key={fact.id} fact={fact} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
