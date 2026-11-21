import { Button } from "../components/ui";
import { SAVE_FAILED, useStore } from "../state/StoreProvider";

export function Notice() {
  const { state, dispatch } = useStore();
  if (!state.notice) return null;
  const canUndo = state.past.length > 0 && state.notice !== "Undone" && state.notice !== SAVE_FAILED;
  return (
    <div className="notice" role="status">
      <span>{state.notice}</span>
      {canUndo && <Button size="small" onClick={() => dispatch({ type: "store/undo" })} shortcut="Z">Undo</Button>}
    </div>
  );
}
