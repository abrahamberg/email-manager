import type { QuickCheck, Receipt } from "../../domain/types";
import { SIGNAL_LABELS } from "../../domain/labels";
import { Button } from "../../components/ui";
import { Confidence } from "../../components/Confidence";
import { useStore } from "../../state/StoreProvider";

function QuickCheckRow({ check, receipt }: { check: QuickCheck; receipt: Receipt }) {
  const { dispatch } = useStore();
  const answer = (correct: boolean) => dispatch({ type: "quickCheck/answer", id: check.id, correct });
  return (
    <li className="quick-check">
      <div className="stack-tight">
        <p>{check.question}</p>
        <p className="muted small">
          {receipt.email.from.name}: “{receipt.email.subject}” · {SIGNAL_LABELS[receipt.signal]} · <Confidence value={receipt.confidence} />
        </p>
      </div>
      <div className="row">
        <Button size="small" onClick={() => answer(true)}>Yes, right</Button>
        <Button size="small" variant="danger" onClick={() => answer(false)}>No, fix it</Button>
      </div>
    </li>
  );
}

export function QuickChecks({ checks, receipts }: { checks: QuickCheck[]; receipts: Receipt[] }) {
  const rows = checks.flatMap((check) => {
    const receipt = receipts.find((item) => item.id === check.receiptId);
    return receipt ? [{ check, receipt }] : [];
  });
  if (rows.length === 0) return null;
  return (
    <section className="stack">
      <div>
        <h2>Quick checks</h2>
        <p className="muted small">I wasn't fully sure about these. Your answers set how much I do on my own.</p>
      </div>
      <ul className="card list">
        {rows.map(({ check, receipt }) => <QuickCheckRow key={check.id} check={check} receipt={receipt} />)}
      </ul>
    </section>
  );
}
