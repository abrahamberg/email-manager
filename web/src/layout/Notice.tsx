import { Button } from "../components/ui";
import { useStore } from "../state/StoreProvider";

export function Notice() {
  const { state, dispatch } = useStore();
  if (!state.notice) return null;
  const canUndo = state.past.length > 0 && state.notice !== "Undone";
  return (
    <div className="notice" role="status">
      <span>{state.notice}</span>
      {canUndo && <Button size="small" onClick={() => dispatch({ type: "store/undo" })} shortcut="Z">Undo</Button>}
    </div>
  );
}
