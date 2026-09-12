"use client";
import { useState } from "react";
import {
  Search,
  ArrowUpRight,
  FileText,
  Box,
  Truck,
  GitBranch,
  ClipboardCheck,
  Layers3,
} from "lucide-react";
import type { Workspace } from "@/lib/domain";
import { traceLot } from "@/lib/domain";
import Modal from "./modal";
export type Destination = {
  view: "trace" | "records" | "review" | "reports";
  lotId?: string;
  batchId?: string;
  sourceId?: string;
  line?: number;
};
export default function WorkspaceSearch({
  workspace: w,
  onClose,
  onNavigate,
}: {
  workspace: Workspace | null;
  onClose: () => void;
  onNavigate: (d: Destination) => void;
}) {
  const [query, setQuery] = useState("");
  const trace = w ? traceLot(w, w.lots[0]?.id || "") : null;
  const hasReviews = !!(
    trace?.unresolvedBatches.length || trace?.unresolvedDeliveries.length
  );
  const entries = [
    ...(
      [
        { title: "Trace lots", view: "trace", icon: GitBranch },
        { title: "Documents", view: "records", icon: FileText },
        {
          title: hasReviews ? "Needs review" : "Decisions",
          view: "review",
          icon: ClipboardCheck,
        },
        { title: "Reports", view: "reports", icon: Layers3 },
      ] as const
    )
      .filter((x) => x.view !== "review" || hasReviews || !!w?.audit.length)
      .map((x) => ({
        title: x.title,
        detail: "Go to page",
        search: x.title,
        icon: x.icon,
        destination: { view: x.view } as Destination,
      })),
    ...(w?.lots || []).map((l) => ({
      title: l.code,
      detail: l.ingredient + " · " + l.supplier,
      search: l.code + " " + l.ingredient + " " + l.supplier,
      icon: Box,
      destination: { view: "trace", lotId: l.id } as Destination,
    })),
    ...(w?.batches || []).map((b) => ({
      title: b.code,
      detail:
        b.product +
        " · " +
        (b.status === "unresolved" ? "Needs review" : "Production batch"),
      search: b.code + " " + b.product + " " + b.rawLotCode,
      icon: GitBranch,
      destination: {
        view: "trace",
        batchId: b.id,
        ...(b.lotId ? { lotId: b.lotId } : {}),
      } as Destination,
    })),
    ...(w?.deliveries || []).map((d) => ({
      title: d.customer,
      detail: d.rawBatchCode + " · " + d.packs + " packs",
      search: d.customer + " " + d.rawBatchCode,
      icon: Truck,
      destination: {
        view: "records",
        sourceId: d.sourceId,
        line: d.line,
      } as Destination,
    })),
    ...(w?.documents || []).map((d) => ({
      title: d.name,
      detail: "Source document",
      search: d.name + " " + d.kind + " " + d.text,
      icon: FileText,
      destination: { view: "records", sourceId: d.id } as Destination,
    })),
  ];
  const matches = query.trim()
    ? entries.filter((e) =>
        e.search.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : entries.slice(0, 4);
  return (
    <Modal title="Find in workspace" onClose={onClose}>
      <div className="command-search">
        <Search size={21} />
        <input
          data-autofocus
          aria-label="Search workspace"
          placeholder="Lot code, customer, document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="command-results">
        {matches.slice(0, 24).map((e, i) => (
          <button key={i} onClick={() => onNavigate(e.destination)}>
            <span className="command-icon">
              <e.icon size={19} />
            </span>
            <span>
              <strong>{e.title}</strong>
              <small>{e.detail}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {!matches.length && (
          <div className="empty-state">
            <Search size={28} />
            <h3>No matching records</h3>
            <p>Try a lot code, supplier or customer name.</p>
          </div>
        )}
      </div>
      <div className="command-foot">
        <span>
          {query
            ? `${matches.length} matches${matches.length > 24 ? " · showing first 24" : ""}`
            : "Search all records, including source text"}
        </span>
        <span>
          <kbd>Tab</kbd> to move · <kbd>Esc</kbd> to close
        </span>
      </div>
    </Modal>
  );
}
