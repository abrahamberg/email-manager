import { useState } from "react";
import { answerQuestion, type Answer } from "../state/assistant";
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
    setAnswer(text.trim() ? answerQuestion(data, text) : undefined);
  };
  const clear = () => {
    setQuery("");
    setAnswer(undefined);
  };
  return { query, setQuery, answer, ask, clear };
}
