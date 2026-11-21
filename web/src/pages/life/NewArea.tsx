import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui";
import { useStore } from "../../state/StoreProvider";

export function NewArea() {
  const { dispatch } = useStore();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    dispatch({ type: "area/add", name, note });
    setName("");
    setNote("");
  };
  return (
    <form className="card stack" onSubmit={submit} aria-label="Something new">
      <h2>Tell me about something new</h2>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name it, like “Football club” or “Selling the flat”" aria-label="Name" />
      <textarea className="short" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What should I know? Who is involved, what matters, what to ignore" aria-label="What I should know" />
      <div className="row">
        <Button variant="primary" type="submit" disabled={!name.trim()}>Keep track of it</Button>
      </div>
    </form>
  );
}
