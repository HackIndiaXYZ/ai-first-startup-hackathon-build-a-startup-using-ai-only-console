export type Evidence = { sourceId: string; line: number };
export type Lot = Evidence & {
  id: string;
  code: string;
  ingredient: string;
  supplier: string;
  receivedKg: number | null;
};
export type Batch = Evidence & {
  id: string;
  code: string;
  product: string;
  producedPacks: number | null;
  usedKg: number | null;
  lotId: string | null;
  rawLotCode: string;
  status: "confirmed" | "unresolved";
};
export type Delivery = Evidence & {
  id: string;
  batchId: string | null;
  rawBatchCode: string;
  customer: string;
  packs: number;
  date: string;
};
export type SourceDocument = {
  id: string;
  name: string;
  kind: string;
  text: string;
  mode: "sample" | "ai" | "manual";
  uploadedAt: string;
  hash?: string;
  fileKey?: string;
  mimeType?: string;
  extraction?: {
    provider: "openai" | "fireworks";
    model: string;
    inputMode: "original" | "browser-rendered-pages";
    pages?: { page: number; hash: string; fileKey: string }[];
  };
};
export type AuditEvent = {
  id: string;
  at: string;
  action: string;
  entity: string;
  before: string;
  after: string;
  note: string;
  beforeLotId?: string | null;
  afterLotId?: string | null;
  sourceId?: string;
};
export type DrillReport = {
  id: string;
  at: string;
  lotCode: string;
  revision: number;
  confirmedPacks: number;
  unresolvedPacks: number;
  customers: string[];
  content: string;
};
export type Workspace = {
  id: string;
  revision: number;
  synthetic: boolean;
  lots: Lot[];
  batches: Batch[];
  deliveries: Delivery[];
  documents: SourceDocument[];
  audit: AuditEvent[];
  reports: DrillReport[];
};
export type TraceResult = {
  batches: Batch[];
  deliveries: Delivery[];
  unresolvedBatches: Batch[];
  unresolvedDeliveries: Delivery[];
  confirmedPacks: number;
  unresolvedPacks: number;
  customers: string[];
  usedKg: number | null;
  remainingPacks: number | null;
};

export function traceLot(w: Workspace, lotId: string): TraceResult {
  const knownLot = w.lots.some((l) => l.id === lotId);
  const validSource = (b: Batch) =>
    !!b.sourceId && w.documents.some((d) => d.id === b.sourceId);
  const uniqueDeliveries = [
    ...new Map(w.deliveries.map((d) => [d.id, d])).values(),
  ];
  for (const d of uniqueDeliveries) {
    if (
      w.deliveries.some(
        (other) =>
          other.id === d.id && JSON.stringify(other) !== JSON.stringify(d),
      )
    )
      throw new Error(
        "Conflicting duplicate dispatch references require review.",
      );
  }
  const batches = w.batches.filter(
    (b) =>
      knownLot &&
      b.lotId === lotId &&
      b.status === "confirmed" &&
      validSource(b),
  );
  const ids = new Set(batches.map((b) => b.id));
  const unresolvedBatches = w.batches.filter(
    (b) =>
      b.status === "unresolved" ||
      !b.lotId ||
      !w.lots.some((l) => l.id === b.lotId) ||
      !validSource(b),
  );
  const unresolvedIds = new Set(unresolvedBatches.map((b) => b.id));
  const deliveries = uniqueDeliveries.filter(
    (d) => !!d.batchId && ids.has(d.batchId),
  );
  const unresolvedDeliveries = uniqueDeliveries.filter(
    (d) =>
      !d.batchId ||
      unresolvedIds.has(d.batchId) ||
      !w.batches.some((b) => b.id === d.batchId),
  );
  return {
    batches,
    deliveries,
    unresolvedBatches,
    unresolvedDeliveries,
    confirmedPacks: deliveries.reduce((n, d) => n + d.packs, 0),
    unresolvedPacks: unresolvedDeliveries.reduce((n, d) => n + d.packs, 0),
    customers: [...new Set(deliveries.map((d) => d.customer))],
    usedKg: batches.some((b) => b.usedKg === null)
      ? null
      : batches.reduce((n, b) => n + b.usedKg!, 0),
    remainingPacks: batches.some((b) => b.producedPacks === null)
      ? null
      : batches.reduce((n, b) => n + b.producedPacks!, 0) -
        deliveries.reduce((n, d) => n + d.packs, 0),
  };
}

export function resolveBatch(
  w: Workspace,
  batchId: string,
  lotId: string,
  note: string,
  at: string,
  eventId: string,
): Workspace {
  const batch = w.batches.find((b) => b.id === batchId);
  const lot = w.lots.find((l) => l.id === lotId);
  if (!batch || !lot)
    throw new Error("Choose an existing batch and ingredient lot.");
  if (!batch.sourceId || !w.documents.some((d) => d.id === batch.sourceId))
    throw new Error("Upload a production record before linking this batch.");
  if (note.trim().length < 12)
    throw new Error(
      "Describe the source evidence used for this decision (at least 12 characters).",
    );
  if (batch.status === "confirmed" && batch.lotId === lotId)
    throw new Error("This link is already confirmed.");
  const used =
    w.batches
      .filter((b) => b.id !== batchId && b.lotId === lotId)
      .reduce((n, b) => n + (b.usedKg ?? 0), 0) + (batch.usedKg ?? 0);
  if (lot.receivedKg !== null && used > lot.receivedKg + 0.00001)
    throw new Error(
      "This link would exceed the lot’s received quantity. Review the records first.",
    );
  return {
    ...w,
    revision: w.revision + 1,
    batches: w.batches.map((b) =>
      b.id === batchId ? { ...b, lotId, status: "confirmed" } : b,
    ),
    audit: [
      {
        id: eventId,
        at,
        action: "Ingredient link confirmed",
        entity: batch.code,
        before:
          w.lots.find((l) => l.id === batch.lotId)?.code ??
          batch.rawLotCode ??
          "Missing",
        after: lot.code,
        note: note.trim(),
        beforeLotId: batch.lotId,
        afterLotId: lotId,
        sourceId: batch.sourceId,
      },
      ...w.audit,
    ],
  };
}

export function createReport(
  w: Workspace,
  lotId: string,
  at: string,
  id: string,
): DrillReport {
  const lot = w.lots.find((l) => l.id === lotId);
  if (!lot) throw new Error("Choose an ingredient lot first.");
  const t = traceLot(w, lotId);
  const ev = (e: Evidence) => {
    const d = w.documents.find((d) => d.id === e.sourceId);
    return d
      ? `${d.name}, ${d.mode === "ai" ? "AI transcript " : ""}line ${e.line}${d.hash ? ` (SHA-256 ${d.hash})` : ""}${d.extraction ? `; extracted by ${d.extraction.provider} / ${d.extraction.model}${d.extraction.pages?.length ? "; browser-rendered page SHA-256: " + d.extraction.pages.map((p) => `${p.page}: ${p.hash}`).join(", ") : ""}` : ""}`
      : "Source record missing";
  };
  const content = [
    "# RecallScope · Recall drill report",
    `${w.synthetic ? "CONTAINS SYNTHETIC SAMPLE DATA · " : ""}Practice exercise — operator review required.`,
    `Report: ${id} | Created: ${at} | Workspace revision: ${w.revision}`,
    `## Selected ingredient lot\n${lot.code} · ${lot.ingredient} · ${lot.supplier}\nEvidence: ${ev(lot)}`,
    `## Recorded scope\n${t.batches.length} confirmed batches · ${t.confirmedPacks} delivered packs · ${t.customers.length} customers\n${t.usedKg === null ? "Ingredient use quantity incomplete" : t.usedKg + " kg ingredient recorded as used"} · ${t.remainingPacks === null ? "Undelivered production quantity unknown" : t.remainingPacks + " produced packs not recorded as delivered (not a verified stock count)"}.`,
    "## Confirmed batch links",
    ...t.batches.map(
      (b) =>
        `- ${b.code}: ${b.producedPacks ?? "Unknown"} packs produced; ${b.usedKg ?? "Unknown"} kg used. Evidence: ${ev(b)}`,
    ),
    "## Recorded deliveries",
    ...t.deliveries.map(
      (d) =>
        `- ${d.date} · ${d.customer} · ${d.packs} packs · ${w.batches.find((b) => b.id === d.batchId)?.code || d.rawBatchCode}. Source batch code: ${d.rawBatchCode || "not recorded; see operator decision"}. Evidence: ${ev(d)}`,
    ),
    `## Unresolved exposure\n${t.unresolvedPacks} delivered packs cannot yet be traced reliably. These may overlap the selected lot's exposure and must remain under review.`,
    ...t.unresolvedBatches.map(
      (b) =>
        `- ${b.code}: ${b.rawLotCode || "Ingredient lot missing"}. ${ev(b)}`,
    ),
    ...t.unresolvedDeliveries.map(
      (d) =>
        `- ${d.customer}: ${d.packs} packs; batch ${d.rawBatchCode || "missing"}; ingredient link or production record unresolved. Evidence: ${ev(d)}`,
    ),
    "## Evidence and decisions",
    ...w.audit
      .filter(
        (a) =>
          a.beforeLotId === lotId ||
          a.afterLotId === lotId ||
          t.batches.some((b) => b.code === a.entity),
      )
      .map(
        (a) =>
          `- ${a.at} · ${a.entity}: ${a.before} → ${a.after}. Operator note: ${a.note}`,
      ),
    "## Limits\nThis snapshot reflects uploaded records and operator-confirmed links only. No-link does not mean safe. Missing records, unrecorded movements, rework and cross-contact are outside this drill. No recall notice has been sent. No regulatory compliance or real-world accuracy is claimed.",
  ].join("\n\n");
  return {
    id,
    at,
    lotCode: lot.code,
    revision: w.revision,
    confirmedPacks: t.confirmedPacks,
    unresolvedPacks: t.unresolvedPacks,
    customers: t.customers,
    content,
  };
}
