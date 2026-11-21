import { areaById } from "../../domain/areas";
import { useAppData } from "../../state/StoreProvider";
import { useEmailViewer } from "../../layout/EmailViewer";

export function WhatHappened() {
  const { report, areas } = useAppData();
  const { open } = useEmailViewer();
  if (report.length === 0) return null;
  return (
    <section className="stack-tight" aria-label="Worth knowing">
      <h2>Worth knowing</h2>
      <ul className="report">
        {report.map((item) => (
          <li key={item.id}>
            <button type="button" className="report-item" onClick={() => open(item.emailId)}>
              <span className="area">{areaById(areas, item.areaId)?.shortName}</span>
              <span>{item.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
