import type { Fact } from "../../domain/types";
import { formatDayTime } from "../../domain/format";
import { Button } from "../../components/ui";
import { useStore } from "../../state/StoreProvider";
import { useEmailViewer } from "../../layout/EmailViewer";

function whenAndWhere(fact: Fact): string {
  return [fact.at && formatDayTime(fact.at), fact.place].filter(Boolean).join(" · ");
}

export function FactRow({ fact }: { fact: Fact }) {
  const { dispatch } = useStore();
  const { open } = useEmailViewer();
  return (
    <li className="fact">
      <div className="stack-tight">
        <strong>{fact.title}</strong>
        <span className="muted small">{whenAndWhere(fact) || fact.detail}</span>
      </div>
      <div className="row">
        {fact.sourceEmailId && <Button size="small" variant="quiet" onClick={() => open(fact.sourceEmailId!)}>Source</Button>}
        <Button size="small" variant="quiet" onClick={() => dispatch({ type: "fact/forget", id: fact.id })}>Forget</Button>
      </div>
    </li>
  );
}
