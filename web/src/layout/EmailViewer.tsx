import { createContext, useContext, useState, type ReactNode } from "react";
import { EmailDrawer } from "./EmailDrawer";

interface Viewer {
  open: (emailId: string) => void;
  isOpen: boolean;
}

const ViewerContext = createContext<Viewer>({ open: () => undefined, isOpen: false });

export function EmailViewerProvider({ children }: { children: ReactNode }) {
  const [emailId, setEmailId] = useState<string>();
  return (
    <ViewerContext.Provider value={{ open: setEmailId, isOpen: emailId !== undefined }}>
      {children}
      {emailId && <EmailDrawer emailId={emailId} onClose={() => setEmailId(undefined)} />}
    </ViewerContext.Provider>
  );
}

export function useEmailViewer(): Viewer {
  return useContext(ViewerContext);
}
