import type { ReactNode } from "react";
import { Button } from "../../components/ui";

export interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function StepFooter({ onNext, onBack, nextLabel = "Continue", disabled = false }: StepProps & { nextLabel?: string; disabled?: boolean }) {
  return (
    <div className="row">
      <Button variant="primary" onClick={onNext} disabled={disabled}>{nextLabel}</Button>
      {onBack && <Button variant="quiet" onClick={onBack}>Back</Button>}
    </div>
  );
}

export function Step({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="stack">
      <h2>{title}</h2>
      <p className="muted">{hint}</p>
      {children}
    </div>
  );
}
