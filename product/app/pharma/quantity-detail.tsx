"use client";
import { recallSummary, stockBalances } from "@/lib/pharma/domain";
import type { PharmaWorkspace } from "@/lib/pharma/types";
import { Dialog, Empty, NumberValue } from "./ui";

export type QuantityMetric = "shipped" | "returned" | "onHand" | "outstanding";
const labels = { shipped: "Historically dispatched", returned: "Returned to quarantine", onHand: "Recorded on hand", outstanding: "Outstanding accounting" };

export default function QuantityDetail({ workspace: w, recallId, metric, onClose, onMovement, onBatch }: {
  workspace: PharmaWorkspace; recallId: string; metric: QuantityMetric; onClose: () => void;
  onMovement: (id: string) => void; onBatch: (id: string) => void;
}) {
  const recall = w.recalls.find(r => r.id === recallId);
  if (!recall) return null;
  const summary = recallSummary(w, recallId);
  const scope = new Set(recall.batchIds);
  const reversed = new Set(w.movements.flatMap(m => m.reversalOf ? [m.reversalOf] : []));
  const shipments = new Set(w.shipments.filter(s => scope.has(s.batchId) && s.status !== "cancelled").map(s => s.id));
  const movements = w.movements.filter(m => scope.has(m.batchId) && !reversed.has(m.id) &&
    (metric === "returned" ? m.kind === "return" : m.kind === "dispatch" && shipments.has(m.shipmentId || "")));
  const balances = stockBalances(w).filter(b => scope.has(b.batchId) && !["in-transit", "disposed"].includes(b.status));
  return <Dialog title={labels[metric]} eyebrow={`${recall.reference} · quantity explanation`} onClose={onClose} wide>
    <div className="ph-panel-body">
      <p><strong><NumberValue value={summary[metric]} unit={summary.unit} /></strong> · Reference date {w.asOf} · Revision {w.revision}</p>
      <p className="ph-dense-note">{metric === "outstanding" ? "For each recipient and batch: dispatched minus returned, current evidenced customer stock and evidenced customer disposition. Later customer statements replace earlier statements." : metric === "onHand" ? "Current ledger balances at recorded locations, including quarantined and reserved stock. In-transit and disposed quantities are separate. This is not a physical stock count." : metric === "returned" ? "Effective return movements, excluding linked reversals. Returns enter quarantine; subsequent disposal or other movements can change the current on-hand balance." : "Effective dispatched quantities for the scoped batches. Cancelled shipments are excluded. Historical exposure is not added to current stock."}</p>
      <div className="ph-table-scroll">
        {metric === "outstanding" ? <table className="ph-table"><thead><tr><th>Recipient / batch</th><th>Dispatched</th><th>Returned</th><th>Customer held</th><th>Disposed</th><th>Outstanding</th></tr></thead><tbody>{summary.recipients.map(r => <tr key={`${r.partnerId}-${r.batchId}`}><td>{r.partnerName}<small>{r.batchCode}</small></td><td>{r.shipped}</td><td>{r.returned}</td><td>{r.customerHeld}</td><td>{r.disposed}</td><td><NumberValue value={r.outstanding} unit={r.unit} /></td></tr>)}</tbody></table>
        : metric === "onHand" ? <table className="ph-table"><thead><tr><th>Batch</th><th>Location</th><th>Status</th><th>Recorded quantity</th></tr></thead><tbody>{balances.map(b => <tr key={`${b.batchId}-${b.locationId}-${b.status}`}><td><button className="ph-text-button" onClick={() => onBatch(b.batchId)}>{w.batches.find(x => x.id === b.batchId)?.code}</button></td><td>{w.locations.find(x => x.id === b.locationId)?.name}</td><td>{b.status}</td><td><NumberValue value={b.quantity} unit={b.unit} /></td></tr>)}</tbody></table>
        : movements.length ? <table className="ph-table"><thead><tr><th>Source-linked movement</th><th>Batch</th><th>Quantity</th></tr></thead><tbody>{movements.map(m => <tr key={m.id}><td><button className="ph-text-button" onClick={() => onMovement(m.id)}>{m.reference}</button><small>{m.at.slice(0, 10)}</small></td><td>{w.batches.find(x => x.id === m.batchId)?.code}</td><td><NumberValue value={m.quantity} unit={m.unit} /></td></tr>)}</tbody></table> : <Empty title="No contributing movements" description="No effective movements contribute to this measure." />}
      </div>
    </div>
    <div className="ph-dialog-actions"><button className="ph-button" onClick={onClose}>Close</button></div>
  </Dialog>;
}
