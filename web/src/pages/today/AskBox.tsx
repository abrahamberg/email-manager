import type { FormEvent } from "react";
import { AssistantAnswer } from "../../components/AssistantAnswer";
import { Button } from "../../components/ui";
import { useAsk } from "../../hooks/useAsk";

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
          placeholder="Ask me anything, like “when is my tire change?”"
          aria-label="Ask about your mail"
        />
        {answer && <Button variant="quiet" onClick={clear}>Clear</Button>}
      </form>
      {answer && <div className="card"><AssistantAnswer answer={answer} /></div>}
    </section>
  );
}
