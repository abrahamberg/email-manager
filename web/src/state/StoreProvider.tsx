import { createContext, useCallback, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from "react";
import { api } from "../api";
import type { AppData } from "../domain/types";
import { storeReducer, type StoreEvent, type StoreState } from "./history";

interface Store {
  state: StoreState;
  dispatch: Dispatch<StoreEvent>;
}

const StoreContext = createContext<Store | undefined>(undefined);

const NOTICE_MS = 4000;
export const SAVE_FAILED = "Couldn't save that, I undid it";

export function StoreProvider({ initialData, children }: { initialData: AppData; children: ReactNode }) {
  const [state, rawDispatch] = useReducer(storeReducer, { data: initialData, past: [] });
  const [failure, setFailure] = useState<string>();

  // Optimistic: apply locally, then persist; roll back if the server refuses.
  const dispatch = useCallback((event: StoreEvent) => {
    if (event.type === "store/clearNotice") setFailure(undefined);
    rawDispatch(event);
    if (event.type === "store/undo" || event.type === "store/clearNotice") return;
    api.send(event).catch(() => {
      rawDispatch({ type: "store/undo" });
      setFailure(SAVE_FAILED);
    });
  }, []);

  useEffect(() => {
    if (!state.notice && !failure) return;
    const timer = setTimeout(() => dispatch({ type: "store/clearNotice" }), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [state.notice, state.past.length, failure, dispatch]);

  return <StoreContext.Provider value={{ state: failure ? { ...state, notice: failure } : state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

export function useAppData(): AppData {
  return useStore().state.data;
}
