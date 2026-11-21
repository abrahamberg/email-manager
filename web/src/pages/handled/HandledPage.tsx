import { useState } from "react";
import type { Outcome, Receipt } from "../../domain/types";
import { plural } from "../../domain/format";
import { Empty, PageHeader, Segmented } from "../../components/ui";
import { useAppData } from "../../state/StoreProvider";
import { ReceiptRow } from "./ReceiptRow";
import "./handled.css";

type Filter = "all" | "mine" | Outcome;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "junk", label: "Junk" },
  { value: "digest", label: "Digest" },
  { value: "replied", label: "Replied" },
  { value: "labeled", label: "Labelled" },
  { value: "archived", label: "Archived" },
  { value: "mine", label: "By you" },
];

function matchesFilter(receipt: Receipt, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "mine") return Boolean(receipt.byUser);
  return receipt.outcome === filter && !receipt.byUser;
}

export function HandledPage() {
  const { receipts, settings } = useAppData();
  const [filter, setFilter] = useState<Filter>("all");
  const visible = receipts.filter((receipt) => matchesFilter(receipt, filter));
  const automatic = receipts.filter((receipt) => !receipt.byUser);

  return (
    <>
      <PageHeader
        title="Handled for you"
        subtitle={`${plural(automatic.length, "email")} handled automatically today. Every action has a reason and can be undone.${settings.dryRun ? " Dry-run is on: these are what I would have done." : ""}`}
      />
      <div className="stack">
        <Segmented label="Filter" value={filter} options={FILTERS} onChange={setFilter} />
        {visible.length === 0 ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <ul className="card list">
            {visible.map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} />)}
          </ul>
        )}
        <p className="muted small">Nothing is ever deleted automatically. Junk is emptied by your mail provider's own policy.</p>
      </div>
    </>
  );
}
