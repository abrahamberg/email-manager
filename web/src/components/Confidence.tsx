import { Chip, type ChipTone } from "./ui";

function toneFor(confidence: number): ChipTone {
  if (confidence >= 0.9) return "ok";
  if (confidence >= 0.75) return "default";
  return "warn";
}

export function Confidence({ value }: { value: number }) {
  return (
    <Chip tone={toneFor(value)} title="How sure the system was">
      {Math.round(value * 100)}% sure
    </Chip>
  );
}
