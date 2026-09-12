import type { DrillReport } from "@/lib/domain";
import { comparePreviousReport } from "@/lib/report-comparison";
import { ArrowRight, History } from "lucide-react";

const number = (value: number) => value.toLocaleString("en-US");
const change = (value: number) =>
  value === 0 ? "No change" : `${value > 0 ? "+" : ""}${number(value)} packs`;

export default function ReportComparison({
  current,
  reports,
  onOpen,
}: {
  current: DrillReport;
  reports: DrillReport[];
  onOpen: (report: DrillReport) => void;
}) {
  const comparison = comparePreviousReport(current, reports);
  if (!comparison)
    return (
      <p className="comparison-empty">
        First saved snapshot for this lot. Save another report after reviewing
        records to compare the scope.
      </p>
    );
  const {
    previous,
    confirmedChange,
    unresolvedChange,
    addedCustomers,
    removedCustomers,
  } = comparison;
  return (
    <section
      className="scope-comparison"
      aria-label="Changes since previous report"
    >
      <div className="comparison-heading">
        <div>
          <History size={18} />
          <h3>What changed</h3>
        </div>
        <button className="text-button" onClick={() => onOpen(previous)}>
          Open earlier report <ArrowRight size={14} />
        </button>
      </div>
      <p>
        Compared with {previous.id}, saved{" "}
        {new Date(previous.at).toLocaleString()} · revision {previous.revision}.
      </p>
      <div className="comparison-grid">
        <div>
          <span>Confirmed delivered packs</span>
          <strong>
            {number(previous.confirmedPacks)}{" "}
            <ArrowRight size={16} aria-label="to" />{" "}
            {number(current.confirmedPacks)}
          </strong>
          <small>{change(confirmedChange)}</small>
        </div>
        <div>
          <span>Unresolved delivered packs</span>
          <strong>
            {number(previous.unresolvedPacks)}{" "}
            <ArrowRight size={16} aria-label="to" />{" "}
            {number(current.unresolvedPacks)}
          </strong>
          <small>{change(unresolvedChange)} · workspace-wide</small>
        </div>
      </div>
      {addedCustomers.length > 0 || removedCustomers.length > 0 ? (
        <div className="comparison-customers">
          {addedCustomers.length > 0 && (
            <p>
              <strong>Added to confirmed scope:</strong>{" "}
              {addedCustomers.join(", ")}
            </p>
          )}
          {removedCustomers.length > 0 && (
            <p>
              <strong>No longer in confirmed scope:</strong>{" "}
              {removedCustomers.join(", ")}
            </p>
          )}
        </div>
      ) : (
        <p>Confirmed customer list unchanged.</p>
      )}
      <p className="comparison-note">
        Changes describe recorded scope, not a change in safety. Review the
        saved sources and decisions to understand why.
      </p>
    </section>
  );
}
