import type { Route } from "../hooks/useHashRoute";
import { Kbd } from "../components/ui";
import { useAppData } from "../state/StoreProvider";

const LINKS: { route: Route; label: string }[] = [
  { route: "today", label: "Today" },
  { route: "handled", label: "Handled" },
  { route: "digest", label: "Digest" },
  { route: "tasks", label: "Tasks" },
  { route: "delegation", label: "Delegation" },
  { route: "activity", label: "Activity" },
  { route: "preferences", label: "Settings" },
];

export function Nav({ route, onAsk }: { route: Route; onAsk: () => void }) {
  const data = useAppData();
  const needYou = data.decisions.length + data.quickChecks.length;
  return (
    <nav className="nav" aria-label="Main">
      <div className="brand">✦ Email Manager</div>
      {LINKS.map((link) => (
        <a key={link.route} href={`#${link.route}`} aria-current={route === link.route ? "page" : undefined}>
          {link.label}
          {link.route === "today" && needYou > 0 && <span className="chip accent count">{needYou}</span>}
        </a>
      ))}
      <button type="button" className="button ask" onClick={onAsk}>
        Ask <Kbd>/</Kbd>
      </button>
    </nav>
  );
}
