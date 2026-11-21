import { useEffect, useState } from "react";

export const ROUTES = ["today", "handled", "digest", "tasks", "delegation", "activity", "preferences"] as const;
export type Route = (typeof ROUTES)[number];

function currentRoute(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : "today";
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
