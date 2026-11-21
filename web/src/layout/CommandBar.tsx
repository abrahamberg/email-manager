import type { FormEvent } from "react";
import { AssistantAnswer } from "../components/AssistantAnswer";
import { Button } from "../components/ui";
import { useShortcuts } from "../hooks/useShortcuts";
import { ASK_EXAMPLES, useAsk } from "../hooks/useAsk";

export function CommandBar({ onClose }: { onClose: () => void }) {
  const { query, setQuery, answer, ask } = useAsk();
  useShortcuts({ Escape: onClose });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(query);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" role="dialog" aria-label="Ask" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={submit}>
          <input id="palette-ask" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask anything about your mail, or tell me what to do…" aria-label="Ask" />
        </form>
        <div className="body">
          {answer ? <AssistantAnswer answer={answer} onDone={onClose} /> : (
            <div className="stack examples">
              <span className="section-title">Try</span>
              {ASK_EXAMPLES.map((example) => (
                <Button key={example} variant="quiet" onClick={() => ask(example)}>{example}</Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
