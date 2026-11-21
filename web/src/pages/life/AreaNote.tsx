import { useState } from "react";
import type { Area } from "../../domain/types";
import { Button } from "../../components/ui";
import { useStore } from "../../state/StoreProvider";

export function AreaNote({ area }: { area: Area }) {
  const { dispatch } = useStore();
  const [draft, setDraft] = useState(area.note ?? "");
  const changed = draft.trim() !== (area.note ?? "");
  return (
    <div className="stack-tight">
      <label className="section-title" htmlFor={`note-${area.id}`}>What you told me</label>
      <textarea
        id={`note-${area.id}`}
        className="short"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Anything I should know here, like who matters or what to ignore"
      />
      {changed && (
        <div className="row">
          <Button size="small" variant="primary" onClick={() => dispatch({ type: "area/setNote", id: area.id, note: draft })}>Save</Button>
          <Button size="small" variant="quiet" onClick={() => setDraft(area.note ?? "")}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
