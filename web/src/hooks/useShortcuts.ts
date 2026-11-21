import { useEffect } from "react";

export type ShortcutMap = Record<string, () => void>;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

// Enter on a focused button or link already triggers it; don't fire twice.
function activatesFocused(target: EventTarget | null, name: string): boolean {
  return name === "Enter" && target instanceof HTMLElement && ["BUTTON", "A"].includes(target.tagName);
}

function keyName(event: KeyboardEvent): string {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return event.ctrlKey || event.metaKey ? `mod+${key}` : key;
}

export function useShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const name = keyName(event);
      const handler = shortcuts[name];
      if (!handler || (isTyping(event.target) && !name.startsWith("mod+")) || activatesFocused(event.target, name)) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts, enabled]);
}
