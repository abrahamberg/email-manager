import { useEffect, useState } from "react";
import type { Route } from "../hooks/useHashRoute";
import { Icon, type IconName } from "../components/Icon";
import { Kbd } from "../components/ui";
import { useAppData } from "../state/StoreProvider";
import { dontMiss } from "../domain/briefing";

interface NavLink { route: Route; label: string; short?: string; icon: IconName }

const MAIN: NavLink[] = [
  { route: "today", label: "Today", icon: "today" },
  { route: "tasks", label: "Tasks", icon: "tasks" },
  { route: "life", label: "What I know", short: "Know", icon: "life" },
];

const BEHIND_THE_SCENES: NavLink[] = [
  { route: "handled", label: "Handled", icon: "handled" },
  { route: "digest", label: "Skipped mail", icon: "digest" },
  { route: "delegation", label: "Delegation", icon: "delegation" },
  { route: "activity", label: "Activity", icon: "activity" },
  { route: "setup", label: "Mailboxes", icon: "mailbox" },
  { route: "preferences", label: "Settings", icon: "settings" },
];

function NavItem({ link, route, short, badge, className }: { link: NavLink; route: Route; short?: boolean; badge?: number; className?: string }) {
  return (
    <a className={className} href={`#${link.route}`} aria-current={route === link.route ? "page" : undefined}>
      <span className="nav-label">
        <Icon name={link.icon} />
        <span>{short ? link.short ?? link.label : link.label}</span>
      </span>
      {badge ? <span className="chip accent count">{badge}</span> : null}
    </a>
  );
}

function SideNav({ route, onAsk, needYou }: { route: Route; onAsk: () => void; needYou: number }) {
  return (
    <nav className="nav side-nav" aria-label="Main">
      <div className="brand"><img src="/favicon.svg" alt="" width={22} height={22} /> Email Manager</div>
      {MAIN.map((link) => <NavItem key={link.route} link={link} route={route} badge={link.route === "today" ? needYou : 0} />)}
      <span className="nav-group">Behind the scenes</span>
      {BEHIND_THE_SCENES.map((link) => <NavItem key={link.route} className="secondary" link={link} route={route} />)}
      <button type="button" className="button ask" onClick={onAsk}>
        <span className="nav-label"><Icon name="ask" /> Ask</span> <Kbd>/</Kbd>
      </button>
    </nav>
  );
}

function MoreSheet({ route, onClose }: { route: Route; onClose: () => void }) {
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <nav className="sheet" aria-label="Behind the scenes" onClick={(event) => event.stopPropagation()}>
        <div className="spread">
          <span className="nav-group">Behind the scenes</span>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        {BEHIND_THE_SCENES.map((link) => <NavItem key={link.route} link={link} route={route} />)}
      </nav>
    </div>
  );
}

function MobileNav({ route, onAsk, needYou }: { route: Route; onAsk: () => void; needYou: number }) {
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [route]);
  const inMore = BEHIND_THE_SCENES.some((link) => link.route === route);
  return (
    <>
      <header className="top-bar">
        <a className="brand" href="#today"><img src="/favicon.svg" alt="" width={22} height={22} /> Email Manager</a>
        <button type="button" className="icon-button" aria-label="Ask" onClick={onAsk}><Icon name="ask" size={20} /></button>
      </header>
      <nav className="tab-bar" aria-label="Main">
        {MAIN.map((link) => <NavItem key={link.route} link={link} route={route} short badge={link.route === "today" ? needYou : 0} />)}
        <button type="button" className="tab" aria-expanded={moreOpen} aria-current={inMore ? "page" : undefined} onClick={() => setMoreOpen(true)}>
          <span className="nav-label"><Icon name="more" /><span>More</span></span>
        </button>
      </nav>
      {moreOpen && <MoreSheet route={route} onClose={() => setMoreOpen(false)} />}
    </>
  );
}

export function Nav({ route, onAsk }: { route: Route; onAsk: () => void }) {
  const needYou = dontMiss(useAppData().decisions).length;
  return (
    <>
      <SideNav route={route} onAsk={onAsk} needYou={needYou} />
      <MobileNav route={route} onAsk={onAsk} needYou={needYou} />
    </>
  );
}
