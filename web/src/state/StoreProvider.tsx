import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import type { AppData } from "../domain/types";
import { storeReducer, type StoreEvent, type StoreState } from "./history";

interface Store {
  state: StoreState;
  dispatch: Dispatch<StoreEvent>;
}

const StoreContext = createContext<Store | undefined>(undefined);

const NOTICE_MS = 4000;

export function StoreProvider({ initialData, children }: { initialData: AppData; children: ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, { data: initialData, past: [] });

  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => dispatch({ type: "store/clearNotice" }), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [state.notice, state.past.length]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

export function useAppData(): AppData {
  return useStore().state.data;
}
