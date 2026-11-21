import { useState } from "react";
import { useHashRoute, type Route } from "../hooks/useHashRoute";
import { useShortcuts } from "../hooks/useShortcuts";
import { useStore } from "../state/StoreProvider";
import { TodayPage } from "../pages/today/TodayPage";
import { HandledPage } from "../pages/handled/HandledPage";
import { DigestPage } from "../pages/digest/DigestPage";
import { TasksPage } from "../pages/tasks/TasksPage";
import { DelegationPage } from "../pages/delegation/DelegationPage";
import { ActivityPage } from "../pages/activity/ActivityPage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { SetupPage } from "../pages/setup/SetupPage";
import { Nav } from "./Nav";
import { CommandBar } from "./CommandBar";
import { Notice } from "./Notice";
import { DryRunBanner } from "./DryRunBanner";
import { EmailViewerProvider, useEmailViewer } from "./EmailViewer";

function Page({ route, shortcutsEnabled }: { route: Route; shortcutsEnabled: boolean }) {
  switch (route) {
    case "today": return <TodayPage shortcutsEnabled={shortcutsEnabled} />;
    case "handled": return <HandledPage />;
    case "digest": return <DigestPage />;
    case "tasks": return <TasksPage />;
    case "delegation": return <DelegationPage />;
    case "activity": return <ActivityPage />;
    case "preferences": return <SettingsPage />;
    case "setup": return <SetupPage />;
  }
}

function Frame() {
  const route = useHashRoute();
  const { dispatch } = useStore();
  const [asking, setAsking] = useState(false);
  const viewer = useEmailViewer();
  const shortcutsEnabled = !asking && !viewer.isOpen;
  const openAsk = () => setAsking(true);

  useShortcuts({ "/": openAsk, "mod+k": openAsk, z: () => dispatch({ type: "store/undo" }) }, shortcutsEnabled);

  return (
    <div className="shell">
      <Nav route={route} onAsk={openAsk} />
      <main className="main">
        <DryRunBanner />
        <Page route={route} shortcutsEnabled={shortcutsEnabled} />
      </main>
      {asking && <CommandBar onClose={() => setAsking(false)} />}
      <Notice />
    </div>
  );
}

export function Shell() {
  return (
    <EmailViewerProvider>
      <Frame />
    </EmailViewerProvider>
  );
}
