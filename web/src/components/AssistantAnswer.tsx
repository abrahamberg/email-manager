import type { Answer } from "../state/assistant";
import { useStore } from "../state/StoreProvider";
import { areaById } from "../domain/areas";
import { EmailMeta } from "./EmailMeta";
import { Button, Chip } from "./ui";

export function AssistantAnswer({ answer, onDone }: { answer: Answer; onDone?: () => void }) {
  const { state, dispatch } = useStore();
  const { proposal, fact } = answer;
  const area = fact && areaById(state.data.areas, fact.areaId);
  return (
    <div className="stack answer">
      <p className={fact ? "answer-fact" : undefined}>{answer.text}</p>
      {area && <div className="row"><Chip tone="accent">{area.name}</Chip><span className="muted small">Learned from the email below</span></div>}
      {answer.matches.length > 0 && (
        <div className="stack answer-matches">
          {answer.matches.map((email) => <EmailMeta key={email.id} email={email} />)}
        </div>
      )}
      {proposal && (
        <div className="row">
          <Button variant="primary" onClick={() => { dispatch(proposal.action); onDone?.(); }}>{proposal.label}</Button>
          {onDone && <Button variant="quiet" onClick={onDone}>Cancel</Button>}
        </div>
      )}
    </div>
  );
}
