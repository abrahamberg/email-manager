import type { FormEvent } from "react";
import { AssistantAnswer } from "../../components/AssistantAnswer";
import { Button } from "../../components/ui";
import { ASK_EXAMPLES, useAsk } from "../../hooks/useAsk";

export function AskBox() {
  const { query, setQuery, answer, ask, clear } = useAsk();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(query);
  };

  return (
    <section className="ask-box" aria-label="Ask">
      <form onSubmit={submit} className="ask-form">
        <input
          id="today-ask"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask me anything: “when is my tire change?”, “programming”…"
          aria-label="Ask about your mail"
        />
        <Button variant="primary" onClick={() => ask(query)}>Ask</Button>
      </form>
      {answer ? (
        <div className="card">
          <AssistantAnswer answer={answer} />
          <Button size="small" variant="quiet" onClick={clear}>Clear</Button>
        </div>
      ) : (
        <div className="row ask-examples">
          {ASK_EXAMPLES.slice(0, 3).map((example) => (
            <button key={example} type="button" className="chip" onClick={() => ask(example)}>{example}</button>
          ))}
        </div>
      )}
    </section>
  );
}
