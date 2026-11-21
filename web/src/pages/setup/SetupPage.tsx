import { useState } from "react";
import { PageHeader } from "../../components/ui";
import { ConnectStep, GoLiveStep, LearnStep, PresetStep, ReviewStep } from "./steps";
import "./setup.css";

const STEPS = ["Connect", "Learn", "Watch", "Choose", "Go live"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper">
      {STEPS.map((label, index) => (
        <li key={label} data-state={index < current ? "done" : index === current ? "current" : "todo"}>
          <span className="dot">{index < current ? "✓" : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function SetupPage() {
  const [step, setStep] = useState(0);
  const next = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));
  const back = step > 0 ? () => setStep(step - 1) : undefined;

  return (
    <>
      <PageHeader title="Set up" subtitle="About five minutes now, then a week where I only watch. Nothing in your mailbox changes until you go live." />
      <Stepper current={step} />
      <div className="card setup-step">
        {step === 0 && <ConnectStep onNext={next} />}
        {step === 1 && <LearnStep onNext={next} onBack={back} />}
        {step === 2 && <ReviewStep onNext={next} onBack={back} />}
        {step === 3 && <PresetStep onNext={next} onBack={back} />}
        {step === 4 && <GoLiveStep onBack={back} />}
      </div>
    </>
  );
}
