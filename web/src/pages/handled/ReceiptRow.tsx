import type { Receipt } from "../../domain/types";
import { OUTCOME_LABELS, SIGNAL_LABELS } from "../../domain/labels";
import { formatTime } from "../../domain/format";
import { Button, Chip, type ChipTone } from "../../components/ui";
import { Confidence } from "../../components/Confidence";
import { useStore } from "../../state/StoreProvider";

const OUTCOME_TONES: Record<Receipt["outcome"], ChipTone> = {
  junk: "danger",
  digest: "default",
  replied: "accent",
  labeled: "default",
  archived: "default",
  task: "warn",
};

function ReceiptActions({ receipt }: { receipt: Receipt }) {
  const { dispatch } = useStore();
  if (receipt.undone) return <Chip>Undone</Chip>;
  if (receipt.byUser) return null;
  return (
    <div className="row">
      <Button size="small" onClick={() => dispatch({ type: "receipt/undo", id: receipt.id })}>Undo</Button>
      <Button size="small" variant="quiet" title="Turn this into a rule" onClick={() => dispatch({ type: "receipt/teach", id: receipt.id, always: true })}>
        Always
      </Button>
      <Button size="small" variant="quiet" title="Undo and never do this for this sender" onClick={() => dispatch({ type: "receipt/teach", id: receipt.id, always: false })}>
        Never
      </Button>
    </div>
  );
}

export function ReceiptRow({ receipt }: { receipt: Receipt }) {
  return (
    <li className="receipt" data-undone={receipt.undone}>
      <div className="receipt-main">
        <div className="row">
          <Chip tone={OUTCOME_TONES[receipt.outcome]}>{OUTCOME_LABELS[receipt.outcome]}</Chip>
          <span className="sender">{receipt.email.from.name}</span>
          <span className="muted small">{formatTime(receipt.at)}</span>
        </div>
        <p className="subject">{receipt.email.subject}</p>
        <p className="muted small">
          {receipt.byUser ? receipt.reason : `${SIGNAL_LABELS[receipt.signal]}: ${receipt.reason}`}
        </p>
      </div>
      <div className="receipt-side">
        {!receipt.byUser && <Confidence value={receipt.confidence} />}
        <ReceiptActions receipt={receipt} />
      </div>
    </li>
  );
}
