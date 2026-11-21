import type { Route } from "../hooks/useHashRoute";
import { Kbd } from "../components/ui";
import { useAppData } from "../state/StoreProvider";
import { dontMiss } from "../domain/briefing";

interface NavLink { route: Route; label: string }

const MAIN: NavLink[] = [
  { route: "today", label: "Today" },
  { route: "tasks", label: "Tasks" },
  { route: "life", label: "What I know" },
];

const BEHIND_THE_SCENES: NavLink[] = [
  { route: "handled", label: "Handled" },
  { route: "digest", label: "Skipped mail" },
  { route: "delegation", label: "Delegation" },
  { route: "activity", label: "Activity" },
  { route: "preferences", label: "Settings" },
];

export function Nav({ route, onAsk }: { route: Route; onAsk: () => void }) {
  const data = useAppData();
  const needYou = dontMiss(data.decisions).length;
  return (
    <nav className="nav" aria-label="Main">
      <div className="brand">✦ Email Manager</div>
      {MAIN.map((link) => (
        <a key={link.route} href={`#${link.route}`} aria-current={route === link.route ? "page" : undefined}>
          {link.label}
          {link.route === "today" && needYou > 0 && <span className="chip accent count">{needYou}</span>}
        </a>
      ))}
      <span className="nav-group">Behind the scenes</span>
      {BEHIND_THE_SCENES.map((link) => (
        <a key={link.route} className="secondary" href={`#${link.route}`} aria-current={route === link.route ? "page" : undefined}>
          {link.label}
        </a>
      ))}
      <button type="button" className="button ask" onClick={onAsk}>
        Ask <Kbd>/</Kbd>
      </button>
    </nav>
  );
}
