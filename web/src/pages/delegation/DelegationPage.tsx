import { useState } from "react";
import { PageHeader, Tabs } from "../../components/ui";
import { AutonomyTable } from "./AutonomyTable";
import { RulesList } from "./RulesList";
import { FeedsList } from "./FeedsList";
import "./delegation.css";

type Tab = "autonomy" | "rules" | "feeds";

const TABS: { value: Tab; label: string }[] = [
  { value: "autonomy", label: "How much I do" },
  { value: "rules", label: "Rules" },
  { value: "feeds", label: "Trusted sources" },
];

export function DelegationPage() {
  const [tab, setTab] = useState<Tab>("autonomy");
  return (
    <>
      <PageHeader title="Delegation" subtitle="What I'm allowed to do on my own, and the rules I follow. Everything here is plain language." />
      <Tabs value={tab} tabs={TABS} onChange={setTab} />
      {tab === "autonomy" && <AutonomyTable />}
      {tab === "rules" && <RulesList />}
      {tab === "feeds" && <FeedsList />}
    </>
  );
}
