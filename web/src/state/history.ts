import type { AppData } from "../domain/types";
import type { Action } from "./actions";
import { applyAction } from "./reducer";
import { describeAction } from "./describeAction";

const MAX_UNDO = 20;

export interface StoreState {
  data: AppData;
  past: AppData[];
  notice?: string;
}

export type StoreEvent = { type: "store/undo" } | { type: "store/clearNotice" } | Action;

export function storeReducer(state: StoreState, event: StoreEvent): StoreState {
  if (event.type === "store/clearNotice") return { ...state, notice: undefined };
  if (event.type === "store/undo") return undoLast(state);
  const data = applyAction(state.data, event);
  if (data === state.data) return state;
  return { data, past: [state.data, ...state.past].slice(0, MAX_UNDO), notice: describeAction(state.data, event) };
}

function undoLast(state: StoreState): StoreState {
  const [previous, ...rest] = state.past;
  return previous ? { data: previous, past: rest, notice: "Undone" } : state;
}
