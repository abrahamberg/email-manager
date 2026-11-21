import { useState, type FormEvent } from "react";
import { EmailMeta } from "../components/EmailMeta";
import { Button } from "../components/ui";
import { useShortcuts } from "../hooks/useShortcuts";
import { answerQuery, type CommandAnswer } from "../state/commandBar";
import { useStore } from "../state/StoreProvider";

const EXAMPLES = ["What needs me?", "What did the bank send?", "Anything about Rust?", "Unsubscribe from all marketing", "Pause everything"];

function Answer({ answer, onDone }: { answer: CommandAnswer; onDone: () => void }) {
  const { dispatch } = useStore();
  const { proposal } = answer;
  return (
    <div className="stack">
      <p>{answer.text}</p>
      {answer.matches.map((email) => <EmailMeta key={email.id} email={email} />)}
      {proposal && (
        <div className="row">
          <Button variant="primary" onClick={() => { dispatch(proposal.action); onDone(); }}>{proposal.label}</Button>
          <Button variant="quiet" onClick={onDone}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

export function CommandBar({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<CommandAnswer>();
  useShortcuts({ Escape: onClose });

  const ask = (text: string) => {
    setQuery(text);
    setAnswer(answerQuery(state.data, text));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) ask(query);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" role="dialog" aria-label="Ask" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={submit}>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask or tell me what to do…" aria-label="Ask" />
        </form>
        <div className="body">
          {answer ? <Answer answer={answer} onDone={onClose} /> : (
            <div className="stack examples">
              <span className="section-title">Try</span>
              {EXAMPLES.map((example) => (
                <Button key={example} variant="quiet" onClick={() => ask(example)}>{example}</Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
