import { useState } from "react";
import { PageHeader } from "../../components/ui";
import type { SetupTarget } from "../../api/setupApi";
import { ConnectStep, type ConnectState } from "./ConnectStep";
import { LearnStep } from "./LearnStep";
import { GoLiveStep, PresetStep, ReviewStep } from "./steps";
import { EMPTY_IMAP } from "./target";
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
  const [connect, setConnect] = useState<ConnectState>({ choice: "office365", imap: EMPTY_IMAP });
  const [tested, setTested] = useState<SetupTarget>();
  const next = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));
  const back = step > 0 ? () => setStep(step - 1) : undefined;

  return (
    <>
      <PageHeader title="Set up" subtitle="About five minutes now, then a week where I only watch. Nothing in your mailbox changes until you go live." />
      <Stepper current={step} />
      <div className="card setup-step">
        {step === 0 && <ConnectStep onNext={next} state={connect} onChange={setConnect} onTarget={setTested} />}
        {step === 1 && <LearnStep onNext={next} onBack={back} target={tested} />}
        {step === 2 && <ReviewStep onNext={next} onBack={back} />}
        {step === 3 && <PresetStep onNext={next} onBack={back} />}
        {step === 4 && <GoLiveStep onBack={back} />}
      </div>
    </>
  );
}
