import { Button } from "../components/ui";
import { useAppData, useStore } from "../state/StoreProvider";

export function DryRunBanner() {
  const { settings } = useAppData();
  const { dispatch } = useStore();
  if (!settings.dryRun) return null;
  return (
    <div className="banner" role="status">
      <span><strong>Dry-run is on.</strong> I'm deciding everything but not touching your mailbox.</span>
      <Button size="small" onClick={() => dispatch({ type: "settings/update", patch: { dryRun: false } })}>Go live</Button>
    </div>
  );
}
