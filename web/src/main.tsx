import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockApi } from "./api/api";
import { StoreProvider } from "./state/StoreProvider";
import { Shell } from "./layout/Shell";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/layout.css";

async function start() {
  const data = await mockApi.loadAppData();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <StoreProvider initialData={data}>
        <Shell />
      </StoreProvider>
    </StrictMode>,
  );
}

void start();
