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
import { Nav } from "./Nav";
import { CommandBar } from "./CommandBar";
import { Notice } from "./Notice";
import { DryRunBanner } from "./DryRunBanner";

function Page({ route, shortcutsEnabled }: { route: Route; shortcutsEnabled: boolean }) {
  switch (route) {
    case "today": return <TodayPage shortcutsEnabled={shortcutsEnabled} />;
    case "handled": return <HandledPage />;
    case "digest": return <DigestPage />;
    case "tasks": return <TasksPage />;
    case "delegation": return <DelegationPage />;
    case "activity": return <ActivityPage />;
    case "preferences": return <SettingsPage />;
  }
}

export function Shell() {
  const route = useHashRoute();
  const { dispatch } = useStore();
  const [asking, setAsking] = useState(false);
  const openAsk = () => setAsking(true);

  useShortcuts({ "/": openAsk, "mod+k": openAsk, z: () => dispatch({ type: "store/undo" }) }, !asking);

  return (
    <div className="shell">
      <Nav route={route} onAsk={openAsk} />
      <main className="main">
        <DryRunBanner />
        <Page route={route} shortcutsEnabled={!asking} />
      </main>
      {asking && <CommandBar onClose={() => setAsking(false)} />}
      <Notice />
    </div>
  );
}
