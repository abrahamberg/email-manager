import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "default" | "primary" | "quiet" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "normal" | "small";
  shortcut?: string;
}

export function Button({ variant = "default", size = "normal", shortcut, children, className = "", ...rest }: ButtonProps) {
  const classes = ["button", variant !== "default" && variant, size === "small" && "small", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {children}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export type ChipTone = "default" | "accent" | "warn" | "danger" | "ok";

export function Chip({ tone = "default", children, title }: { tone?: ChipTone; children: ReactNode; title?: string }) {
  return (
    <span className={`chip ${tone}`} title={title}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" title={option.title} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} role="tab" type="button" aria-selected={tab.value === value} onClick={() => onChange(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
