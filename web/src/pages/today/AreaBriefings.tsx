import type { Area } from "../../domain/types";
import { areaActivity, describeHandled } from "../../domain/areas";
import { plural } from "../../domain/format";
import { Button, Chip } from "../../components/ui";
import { useAppData } from "../../state/StoreProvider";

interface Props {
  focusedArea?: string;
  onFocus: (areaId: string | undefined) => void;
}

function AreaCard({ area, focused, onFocus }: { area: Area; focused: boolean; onFocus: Props["onFocus"] }) {
  const data = useAppData();
  const activity = areaActivity(data, area.id);
  const handled = describeHandled(activity);
  return (
    <article className="card area-card" data-focused={focused}>
      <div className="spread">
        <h3>{area.name}</h3>
        {activity.needYou > 0 && (
          <Button size="small" variant={focused ? "primary" : "default"} onClick={() => onFocus(focused ? undefined : area.id)}>
            {focused ? "Show all" : `${activity.needYou} need you`}
          </Button>
        )}
      </div>
      <p>{area.summary}</p>
      <div className="row">
        {handled && <Chip tone="ok">{handled}</Chip>}
        {activity.needYou === 0 && <span className="muted small">Nothing for you here</span>}
      </div>
    </article>
  );
}

export function AreaBriefings({ focusedArea, onFocus }: Props) {
  const { areas } = useAppData();
  return (
    <section className="stack" aria-label="Your areas">
      <div className="spread">
        <h2>What's going on</h2>
        <a className="small" href="#life">What I know about you</a>
      </div>
      <div className="area-grid">
        {areas.map((area) => <AreaCard key={area.id} area={area} focused={area.id === focusedArea} onFocus={onFocus} />)}
      </div>
      <p className="muted small">{plural(areas.length, "area")} I keep track of. Tell me about a new one on the What I know page.</p>
    </section>
  );
}
