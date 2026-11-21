import { useState } from "react";
import { api } from "../api";
import type { Answer } from "../state/assistant";
import { useAppData } from "../state/StoreProvider";

export const ASK_EXAMPLES = [
  "When is my tire change?",
  "Where is Saga's party?",
  "programming",
  "What needs me?",
  "Unsubscribe from all marketing",
];

export function useAsk() {
  const data = useAppData();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer>();

  const ask = (text: string) => {
    setQuery(text);
    if (!text.trim()) return setAnswer(undefined);
    api.ask(text, data).then(setAnswer, () => setAnswer({ text: "Couldn't answer that right now.", matches: [] }));
  };
  const clear = () => {
    setQuery("");
    setAnswer(undefined);
  };
  return { query, setQuery, answer, ask, clear };
}
