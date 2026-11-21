import { PageHeader } from "../../components/ui";
import { useAppData } from "../../state/StoreProvider";
import { AreaSection } from "./AreaSection";
import { NewArea } from "./NewArea";
import { ComingUp } from "./ComingUp";
import "./life.css";

export function LifePage() {
  const { areas, facts } = useAppData();
  return (
    <div className="stack-lg">
      <PageHeader
        title="What I know about you"
        subtitle="I learn this from your mail and use it to sort, answer and remind. Correct anything that's wrong, or make me forget it."
      />
      <ComingUp />
      {areas.map((area) => (
        <AreaSection key={area.id} area={area} facts={facts.filter((fact) => fact.areaId === area.id)} />
      ))}
      <NewArea />
    </div>
  );
}
