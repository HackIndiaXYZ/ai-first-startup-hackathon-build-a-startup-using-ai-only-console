import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPharmaAction,
  authorizePharmaAction,
  assertValidWorkspace,
  daysUntilExpiry,
  expiryDate,
  expiryStatus,
  fefoCandidates,
  parseLabelDate,
  recallSummary,
  serialLedger,
  packageSerials,
  stockBalances,
  toBaseQuantity,
  traceBatch,
  withCurrentReferenceDate,
} from "../lib/pharma/domain";
import { seedPharmaWorkspace } from "../lib/pharma/seed";
import type { PharmaAction, PharmaWorkspace } from "../lib/pharma/types";

const NOW = "2026-10-03T12:00:00Z";
const fixture = () => seedPharmaWorkspace("workspace-test", NOW);
let count = 0;
const apply = (
  w: PharmaWorkspace,
  action: PharmaAction,
  actionId = `test-action-${++count}`,
) =>
  applyPharmaAction(w, action, {
    now: NOW,
    id: actionId,
    actor: "Test quality operator",
    role: "admin",
  });
const source = { sourceId: "src-receipts", line: 3 };
const receipt = (quantity = 10): PharmaAction => ({
  type: "receipt",
  batchId: "batch-para-002",
  locationId: "loc-central",
  supplierId: "supplier-northstar",
  quantity,
  unit: "box",
  reference: `NEW-RECEIPT-${count}`,
  reason: "Reviewed receipt evidence",
  evidence: source,
});
const dispatch = (quantity = 10): PharmaAction => ({
  type: "dispatch",
  batchId: "batch-para-002",
  locationId: "loc-central",
  partnerId: "customer-a",
  quantity,
  unit: "box",
  reference: `NEW-DISPATCH-${count}`,
  reason: "Reviewed dispatch evidence",
  evidence: source,
});

test("partial recall accounts for 1,000 received without adding historical exposure to stock", () => {
  const w = fixture();
  const summary = recallSummary(w, "recall-001");
  assert.equal(summary.received, 1000);
  assert.equal(summary.shipped, 600);
  assert.equal(summary.returned, 100);
  assert.equal(summary.onHand, 500);
  assert.equal(summary.quarantined, 500);
  assert.equal(summary.outstanding, 500);
  assert.equal(summary.accounted, 500);
  assert.equal(summary.recipients.length, 4);
  assert.equal(summary.accountingComplete, false);
  assert.deepEqual(
    summary.recipients.map((row) => row.outstanding),
    [200, 120, 100, 80],
  );
  assertValidWorkspace(w);
});
test("completed scenario preserves partial snapshot and explicit accounting closure", () => {
  const w = seedPharmaWorkspace("complete-case", NOW, "complete");
  const summary = recallSummary(w, "recall-001");
  assert.equal(summary.returned, 600);
  assert.equal(summary.onHand, 1000);
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.accountingComplete, true);
  assert.equal(w.recalls[0].status, "closed");
  assert.equal(w.batches[0].held, true);
  assert.equal(w.reports[0].summary.returned, 100);
  assert.equal(w.reports[1].summary.returned, 600);
  assert.equal(summary.disposed, 0);
});
test("same printed batch code on another product is outside recall scope", () => {
  const w = fixture();
  assert.equal(w.batches[0].code, w.batches[2].code);
  assert.equal(traceBatch(w, "batch-amox-001").onHand, 300);
  assert.equal(w.batches[2].held, false);
  assert.throws(
    () =>
      apply(w, {
        type: "recall.create",
        recall: {
          id: "wrong-scope",
          reference: "RC-X",
          title: "Wrong scope",
          productId: "product-para-500",
          batchIds: ["batch-amox-001"],
          reason: "Exercise identity guard",
          owner: "Quality",
          evidence: source,
        },
      }),
    /selected product/,
  );
});
test("dates retain month precision, validate leap days and use explicit end of month", () => {
  assert.equal(expiryDate(parseLabelDate("2028-02")), "2028-02-29");
  assert.equal(expiryDate(parseLabelDate("2027-02")), "2027-02-28");
  assert.equal(
    parseLabelDate("2028-02-29", "29 FEB 2028").sourceText,
    "29 FEB 2028",
  );
  for (const bad of [
    "2027-02-29",
    "2026-13",
    "10/03/2026",
    "2026-04-31",
    "2026-00-01",
  ])
    assert.throws(() => parseLabelDate(bad));
  assert.throws(
    () =>
      expiryDate({
        value: "2026-10",
        precision: "month",
        sourceText: "10/2026",
      }),
    /explicit/,
  );
  assert.equal(
    expiryStatus(parseLabelDate("2026-10"), "2026-10-31"),
    "near-expiry",
  );
  assert.equal(
    expiryStatus(parseLabelDate("2026-10"), "2026-11-01"),
    "expired",
  );
  assert.equal(daysUntilExpiry(parseLabelDate("2026-10-04"), "2026-10-03"), 1);
});
test("unit conversion is product specific and never derives units from strength metadata", () => {
  const w = fixture();
  const tablet = w.products[0];
  const liquid = w.products[1];
  assert.equal(toBaseQuantity(tablet, 10, "blister"), 1);
  assert.equal(toBaseQuantity(tablet, 1, "tablet"), 0.01);
  assert.equal(toBaseQuantity(liquid, 2, "case"), 40);
  assert.throws(() => toBaseQuantity(tablet, 500, "mg"), /Unsupported/);
  assert.throws(() => toBaseQuantity(tablet, 0.1, "tablet"), /precision/);
  assert.throws(() => toBaseQuantity(liquid, 0.5, "bottle"), /precision/);
  for (const n of [NaN, Infinity, -1, 0])
    assert.throws(() => toBaseQuantity(tablet, n, "box"));
});
test("posted actions are immutable and repeated transport identity is a no-op", () => {
  const w = fixture();
  const original = JSON.stringify(w);
  const action = receipt();
  const changed = apply(w, action, "idempotent-receipt");
  assert.equal(JSON.stringify(w), original);
  assert.equal(changed.revision, w.revision + 1);
  assert.equal(apply(changed, action, "idempotent-receipt"), changed);
  assert.equal(traceBatch(changed, "batch-para-002").onHand, 410);
  assert.throws(
    () => apply(changed, action, "different-transport"),
    /already been posted/,
  );
});
test("future receipt source dates are rejected and original occurrence differs from audit posting", () => {
  const action = { ...receipt(), occurredAt: "2026-09-25" } as PharmaAction;
  const w = apply(fixture(), action);
  const movement = w.movements.at(-1)!;
  assert.equal(movement.at, "2026-09-25T00:00:00.000Z");
  assert.equal(movement.recordedAt, NOW);
  assert.equal(w.audit.at(-1)!.at, NOW);
  assert.throws(
    () =>
      apply(fixture(), {
        ...receipt(),
        occurredAt: "2026-10-04",
      } as PharmaAction),
    /reference date/,
  );
});

test("live expiry eligibility rolls over at UTC midnight while samples and saved reports keep their dates", () => {
  const w = fixture();
  w.synthetic = false;
  w.batches.find((batch) => batch.id === "batch-para-002")!.expiry =
    parseLabelDate("2026-10");
  w.partners.find(
    (partner) => partner.id === "customer-a",
  )!.minimumShelfLifeDays = 0;
  const snapshot = JSON.stringify(w.reports);
  const before = withCurrentReferenceDate(w, "2026-11-01T07:59:59+08:00");
  const after = withCurrentReferenceDate(w, "2026-11-01T08:00:00+08:00");
  assert.equal(before.asOf, "2026-10-31");
  assert.equal(after.asOf, "2026-11-01");
  assert.equal(w.asOf, "2026-10-03");
  assert.equal(before.revision, w.revision);
  assert.equal(JSON.stringify(after.reports), snapshot);
  assert.ok(
    fefoCandidates(before, "product-para-500", "loc-central").some(
      (row) => row.batch.id === "batch-para-002",
    ),
  );
  assert.ok(
    !fefoCandidates(after, "product-para-500", "loc-central").some(
      (row) => row.batch.id === "batch-para-002",
    ),
  );
  const context = {
    now: "2026-10-31T23:59:59Z",
    id: "last-day-dispatch",
    actor: "Controlled clock operator",
    role: "admin" as const,
  };
  const dispatched = applyPharmaAction(w, dispatch(1), context);
  assert.equal(dispatched.asOf, "2026-10-31");
  assert.throws(
    () =>
      applyPharmaAction(w, dispatch(1), {
        ...context,
        id: "expired-dispatch",
        now: "2026-11-01T00:00:00Z",
      }),
    /expired/i,
  );
  const sample = fixture();
  assert.equal(
    withCurrentReferenceDate(sample, "2027-01-01T00:00:00Z"),
    sample,
  );
  const replay = applyPharmaAction(dispatched, dispatch(1), {
    ...context,
    now: "2026-11-01T00:00:00Z",
  });
  assert.equal(replay.asOf, "2026-11-01");
  assert.equal(replay.revision, dispatched.revision);
  assert.equal(replay.movements.length, dispatched.movements.length);
  assert.throws(() => withCurrentReferenceDate(w, "2026-11-01"), /timezone/);
});

test("live movements use current date despite a stale persisted clock and keep expiry checks current", () => {
  const w = fixture();
  w.synthetic = false;
  const context = {
    now: "2026-10-04T00:00:00Z",
    id: "current-day-receipt",
    actor: "Controlled clock operator",
    role: "admin" as const,
  };
  const next = applyPharmaAction(
    w,
    { ...receipt(), occurredAt: "2026-10-04" } as PharmaAction,
    context,
  );
  assert.equal(next.asOf, "2026-10-04");
  assert.equal(next.movements.at(-1)!.at, "2026-10-04T00:00:00.000Z");
  assert.throws(
    () =>
      applyPharmaAction(
        w,
        { ...receipt(), occurredAt: "2026-10-05" } as PharmaAction,
        context,
      ),
    /reference date/,
  );
  assert.throws(
    () =>
      applyPharmaAction(
        w,
        {
          type: "clock.set",
          asOf: "2026-01-01",
          reason: "Try to rewind a live expiry clock",
        },
        context,
      ),
    /Only sample/,
  );
});
test("dispatch checks held, expired, available and source workspace ownership", () => {
  const w = fixture();
  assert.throws(
    () =>
      apply(w, { ...dispatch(), batchId: "batch-para-001" } as PharmaAction),
    /held/,
  );
  assert.throws(
    () =>
      apply(w, {
        ...dispatch(),
        batchId: "batch-cet-expired",
        locationId: "loc-north",
      } as PharmaAction),
    /Expired/,
  );
  assert.throws(() => apply(w, dispatch(401)), /Insufficient/);
  assert.throws(
    () =>
      apply(w, {
        ...receipt(),
        evidence: { sourceId: "foreign-source" },
      } as PharmaAction),
    /workspace/,
  );
  assert.throws(
    () =>
      apply(w, {
        ...receipt(),
        locationId: "foreign-location",
      } as PharmaAction),
    /workspace/,
  );
});
test("transfer stock stays in transit until one receiving event and conserves enterprise quantity", () => {
  const w = fixture();
  const inTransit = apply(w, {
    type: "transfer",
    batchId: "batch-para-002",
    locationId: "loc-central",
    destinationId: "loc-north",
    quantity: 70,
    unit: "box",
    reference: "TRF-TEST",
    reason: "Rebalance sample locations",
    evidence: source,
  });
  const movement = inTransit.movements.at(-1)!;
  const trace = traceBatch(inTransit, "batch-para-002");
  assert.equal(trace.onHand, 330);
  assert.equal(trace.inTransit, 70);
  assert.equal(trace.onHand + trace.inTransit, 400);
  const received = apply(inTransit, {
    type: "transfer.receive",
    transferId: movement.transferId!,
    reason: "Confirm arrival at North",
    evidence: source,
  });
  assert.equal(traceBatch(received, "batch-para-002").onHand, 400);
  assert.equal(traceBatch(received, "batch-para-002").inTransit, 0);
  assert.throws(
    () =>
      apply(received, {
        type: "transfer.receive",
        transferId: movement.transferId!,
        reason: "Try duplicate arrival",
      }),
    /already posted/,
  );
});
test("a recall opened during transit routes the receiving stock to quarantine", () => {
  let w = apply(fixture(), {
    type: "transfer",
    batchId: "batch-para-002",
    locationId: "loc-central",
    destinationId: "loc-north",
    quantity: 70,
    unit: "box",
    reference: "TRF-HOLD",
    reason: "Rebalance sample locations",
  });
  const transferId = w.movements.at(-1)!.transferId!;
  w = apply(w, {
    type: "recall.create",
    recall: {
      id: "recall-second",
      productId: "product-para-500",
      batchIds: ["batch-para-002"],
      reference: "RC-SECOND",
      title: "Second recall",
      owner: "Quality",
      reason: "Authorised scoped recall",
      evidence: source,
    },
  });
  assert.equal(recallSummary(w, "recall-second").accountingComplete, false);
  w = apply(w, {
    type: "transfer.receive",
    transferId,
    reason: "Receive under the batch hold",
  });
  assert.equal(recallSummary(w, "recall-second").quarantined, 400);
  assert.equal(recallSummary(w, "recall-second").inTransit, 0);
});
test("reservation dispatch consumes only reserved quantity and cancellation does not create stock", () => {
  let w = apply(fixture(), {
    type: "reserve",
    batchId: "batch-para-002",
    locationId: "loc-central",
    quantity: 40,
    unit: "box",
    reference: "RES-001",
    reason: "Customer allocation request",
  });
  const reservationId = w.movements.at(-1)!.id;
  w = apply(w, { ...dispatch(25), reservationId } as PharmaAction);
  const shipmentId = w.shipments.at(-1)!.id;
  assert.equal(traceBatch(w, "batch-para-002").onHand, 375);
  assert.throws(
    () => apply(w, { ...dispatch(20), reservationId } as PharmaAction),
    /reservation/,
  );
  w = apply(w, {
    type: "reservation.cancel",
    reservationId,
    reason: "Release unused allocation",
  });
  assert.equal(traceBatch(w, "batch-para-002").onHand, 375);
  w = apply(w, {
    type: "delivery.cancel",
    shipmentId,
    reason: "Cancelled before delivery",
    evidence: source,
  });
  assert.equal(traceBatch(w, "batch-para-002").onHand, 400);
  assert.equal(traceBatch(w, "batch-para-002").shipped, 0);
});
test("partial returns require delivery, preserve quarantine and enforce remaining quantity", () => {
  let w = apply(fixture(), dispatch(40));
  const shipmentId = w.shipments.at(-1)!.id;
  const action: PharmaAction = {
    type: "return",
    shipmentId,
    batchId: "batch-para-002",
    locationId: "loc-central",
    quantity: 15,
    unit: "box",
    reference: "RET-X",
    reason: "Physical return receipt",
    evidence: source,
  };
  assert.throws(() => apply(w, action), /delivered/);
  w = apply(w, {
    type: "delivery.confirm",
    shipmentId,
    reason: "Customer delivery confirmation",
    evidence: source,
  });
  w = apply(w, action);
  assert.equal(traceBatch(w, "batch-para-002").onHand, 375);
  assert.equal(
    stockBalances(w).find(
      (row) => row.batchId === "batch-para-002" && row.status === "quarantined",
    )?.quantity,
    15,
  );
  assert.throws(
    () => apply(w, { ...action, quantity: 26, reference: "RET-Y" }),
    /exceeds/,
  );
  assert.throws(() => apply(w, action), /already been posted/);
  assert.throws(
    () =>
      apply(w, {
        type: "delivery.cancel",
        shipmentId,
        reason: "Cancel after delivery",
      }),
    /undelivered/,
  );
});
test("evidenced customer statements replace previous statements instead of accumulating", () => {
  let w = fixture();
  const action: PharmaAction = {
    type: "recall.acknowledge",
    recallId: "recall-001",
    partnerId: "customer-a",
    batchId: "batch-para-001",
    status: "acknowledged",
    customerHeld: 100,
    disposed: 0,
    note: "Customer warehouse statement",
    evidence: source,
  };
  w = apply(w, action);
  assert.equal(recallSummary(w, "recall-001").outstanding, 400);
  w = apply(w, { ...action, customerHeld: 120 });
  assert.equal(w.acknowledgments.length, 2);
  assert.equal(recallSummary(w, "recall-001").outstanding, 380);
  assert.throws(() => apply(w, { ...action, customerHeld: 201 }), /exceed/);
  assert.throws(() => apply(w, { ...action, evidence: undefined }), /required/);
  assert.throws(
    () => apply(w, { ...action, status: "contacted" }),
    /contact attempt/,
  );
});
test("a later return cannot silently double-count a stale customer-held statement", () => {
  let w = apply(fixture(), {
    type: "recall.acknowledge",
    recallId: "recall-001",
    partnerId: "customer-a",
    batchId: "batch-para-001",
    status: "acknowledged",
    customerHeld: 200,
    disposed: 0,
    note: "Customer reports all remaining stock",
    evidence: source,
  });
  w = apply(w, {
    type: "return",
    shipmentId: "seed-dispatch-a-shipment-1",
    batchId: "batch-para-001",
    locationId: "loc-central",
    quantity: 10,
    unit: "box",
    reference: "RETURN-A-LATER",
    reason: "Ten additional boxes received",
    evidence: source,
  });
  const summary = recallSummary(w, "recall-001");
  assert.equal(summary.accountingComplete, false);
  assert.match(summary.exceptions[0], /exceeds shipped/);
});
test("recall closure requires reconciled accounting, finished tasks and evidence", () => {
  assert.throws(
    () =>
      apply(fixture(), {
        type: "recall.close",
        recallId: "recall-001",
        reason: "Request accounting closure",
        evidence: source,
      }),
    /Reconcile/,
  );
  const complete = seedPharmaWorkspace("complete-2", NOW, "complete");
  assert.throws(
    () =>
      apply(complete, {
        type: "recall.update",
        recallId: "recall-001",
        status: "open",
        reason: "Attempt implicit reopening",
      }),
    /immutable/,
  );
  assert.throws(
    () =>
      apply(fixture(), {
        type: "batch.release",
        batchId: "batch-para-001",
        reason: "Attempt clearing an active recall",
      }),
    /active recall/,
  );
});
test("stocktake adjustments require matching counted stock, evidence and immutable reversal", () => {
  const action: PharmaAction = {
    type: "adjust",
    batchId: "batch-para-002",
    locationId: "loc-central",
    quantity: 5,
    unit: "box",
    reference: "COUNT-001",
    reason: "Documented stock count correction",
    evidence: source,
    direction: "decrease",
    countedQuantity: 395,
    status: "available",
  };
  const w = apply(fixture(), action);
  assert.equal(traceBatch(w, "batch-para-002").onHand, 395);
  const movementId = w.movements.at(-1)!.id;
  const reversed = apply(w, {
    type: "movement.reverse",
    movementId,
    reason: "Count entry was duplicated",
    evidence: source,
  });
  assert.equal(traceBatch(reversed, "batch-para-002").onHand, 400);
  assert.equal(reversed.movements.length, w.movements.length + 1);
  assert.throws(
    () => apply(fixture(), { ...action, countedQuantity: 399 }),
    /reconcile/,
  );
  assert.throws(
    () =>
      apply(reversed, {
        type: "movement.reverse",
        movementId,
        reason: "Duplicate reversal attempt",
        evidence: source,
      }),
    /already been reversed/,
  );
});
test("FEFO excludes recalled and expired stock; later edits cannot reinterpret historical units", () => {
  const w = fixture();
  assert.deepEqual(
    fefoCandidates(w, "product-para-500", "loc-central").map(
      (row) => row.batch.id,
    ),
    ["batch-para-002"],
  );
  assert.deepEqual(
    fefoCandidates(w, "product-cet-10", "loc-north").map((row) => row.batch.id),
    ["batch-cet-001"],
  );
  assert.throws(
    () =>
      apply(w, {
        type: "product.edit",
        productId: "product-para-500",
        changes: { baseUnit: "tablet" },
        reason: "Change history to tablets",
      }),
    /lock product identity/,
  );
  assert.throws(
    () =>
      apply(w, {
        type: "product.archive",
        productId: "product-para-500",
        archived: true,
        reason: "Archive product with stock",
      }),
    /recorded stock/,
  );
});
test("batch code correction keeps original code and requires evidence", () => {
  const w = apply(fixture(), {
    type: "batch.correct",
    batchId: "batch-para-002",
    code: "PCR-0261001",
    reason: "Correct the verified leading zero",
    evidence: source,
  });
  assert.equal(w.batches[1].code, "PCR-0261001");
  assert.equal(w.batches[1].originalCode, "PCR-261001");
  assert.match(w.audit.at(-1)!.before, /PCR-261001/);
  assert.throws(
    () =>
      apply(w, {
        type: "batch.correct",
        batchId: "batch-para-002",
        code: "PCR-260901",
        reason: "Try merging two identities",
        evidence: source,
      }),
    /conflicts/,
  );
});
test("saved reports remain fixed when subsequent stock changes", () => {
  const w = fixture();
  const snapshot = JSON.stringify(w.reports[0]);
  const changed = apply(w, {
    type: "return",
    shipmentId: "seed-dispatch-a-shipment-1",
    batchId: "batch-para-001",
    locationId: "loc-central",
    quantity: 20,
    unit: "box",
    reference: "RTN-NEW",
    reason: "Additional physical return evidence",
    evidence: source,
  });
  assert.equal(JSON.stringify(changed.reports[0]), snapshot);
  assert.equal(recallSummary(changed, "recall-001").returned, 120);
  assert.equal(changed.reports[0].summary.returned, 100);
});

test("reports retain shipment, transfer, reservation, reversal and source decisions in batch scope", () => {
  let w = fixture();
  const originalAuditIds = new Set(w.audit.map((event) => event.id));
  w = apply(w, {
    type: "source.add",
    source: {
      id: "source-delivery-proof",
      name: "Delivery and return evidence",
      kind: "Delivery record",
      text: "Delivery accepted.\nTen boxes returned.",
      mode: "manual",
      createdAt: NOW,
    },
  });
  const deliveryEvidence = {
    sourceId: "source-delivery-proof",
    line: 1,
    quote: "Delivery accepted.",
  };
  w = apply(w, receipt(40));
  w = apply(w, {
    ...receipt(10),
    type: "transfer",
    destinationId: "loc-north",
  } as PharmaAction);
  const transferId = w.movements.at(-1)!.transferId!;
  w = apply(w, {
    type: "transfer.receive",
    transferId,
    reason: "Receiving count matches the transfer",
    evidence: source,
  });
  w = apply(w, { ...receipt(5), type: "reserve" } as PharmaAction);
  const reservationId = w.movements.at(-1)!.id;
  w = apply(w, {
    type: "reservation.cancel",
    reservationId,
    reason: "Release the unused allocation",
  });
  w = apply(w, dispatch(10));
  const shipmentId = w.shipments.at(-1)!.id;
  w = apply(w, {
    type: "delivery.confirm",
    shipmentId,
    reason: "Reviewed the signed delivery evidence",
    evidence: deliveryEvidence,
  });
  w = apply(w, {
    ...receipt(10),
    type: "return",
    shipmentId,
    reference: "RETURN-EVIDENCE-001",
  } as PharmaAction);
  const returnedMovementId = w.movements.at(-1)!.id;
  w = apply(w, {
    type: "movement.reverse",
    movementId: returnedMovementId,
    reason: "Correct the duplicate return record",
    evidence: source,
  });
  w = apply(w, {
    ...receipt(10),
    type: "return",
    shipmentId,
    reference: "RETURN-EVIDENCE-002",
  } as PharmaAction);
  w = apply(w, {
    type: "recall.create",
    holdStock: true,
    recall: {
      id: "audit-scope-recall",
      reference: "AUDIT-SCOPE",
      title: "Recall for evidence scope",
      productId: "product-para-500",
      batchIds: ["batch-para-002"],
      owner: "Quality operator",
      reason: "Authorised batch recall",
      evidence: source,
    },
  });
  const relevant = w.audit.filter((event) => !originalAuditIds.has(event.id));
  w = apply(w, {
    type: "temperature.add",
    batchId: "batch-saline-001",
    locationId: "loc-north",
    celsius: 5,
    observedAt: NOW,
    note: "Unrelated batch observation",
  });
  const unrelatedAuditId = w.audit.at(-1)!.id;
  w = apply(w, { type: "report.create", recallId: "audit-scope-recall" });
  const report = w.reports.at(-1)!;
  assert.equal(report.summary.shipped, 10);
  assert.equal(report.summary.returned, 10);
  for (const event of relevant)
    assert.ok(
      report.audit.some((snapshot) => snapshot.id === event.id),
      "Missing scoped decision: " + event.action,
    );
  assert.ok(!report.audit.some((event) => event.id === unrelatedAuditId));
  assert.ok(
    report.sources.some((item) => item.id === deliveryEvidence.sourceId),
  );
  assertValidWorkspace(w);
  const invalid = structuredClone(w);
  invalid.reports
    .at(-1)!
    .audit.find(
      (event) => event.action === "delivery.confirm",
    )!.evidence!.quote = "Unrelated replacement text";
  assert.throws(() => assertValidWorkspace(invalid), /quote.*source/i);
});
test("temperature excursions are observations and do not silently make a safety decision", () => {
  const w = fixture();
  assert.equal(w.temperatures[0].excursion, true);
  assert.equal(
    w.batches.find((row) => row.id === "batch-saline-001")!.held,
    false,
  );
  const changed = apply(w, {
    type: "temperature.add",
    batchId: "batch-saline-001",
    locationId: "loc-north",
    celsius: 20,
    observedAt: NOW,
    note: "Recorded within authored policy",
    evidence: source,
  });
  assert.equal(changed.temperatures.at(-1)!.excursion, false);
  assert.throws(
    () =>
      apply(w, {
        type: "temperature.add",
        batchId: "batch-saline-001",
        locationId: "loc-north",
        celsius: 200,
        observedAt: NOW,
        note: "Invalid sensor value",
      }),
    /finite number/,
  );
});
test("workspace restoration rejects duplicate identities, foreign references and negative history", () => {
  const duplicate = fixture();
  duplicate.batches.push(structuredClone(duplicate.batches[0]));
  assert.throws(() => assertValidWorkspace(duplicate), /Duplicate/);
  const foreign = fixture();
  foreign.movements[0].productId = "product-amox-500";
  assert.throws(() => assertValidWorkspace(foreign), /does not match/);
  const negative = fixture();
  negative.movements[0].quantity = 1;
  negative.movements[0].originalQuantity = 1;
  assert.throws(() => assertValidWorkspace(negative), /negative/);
  const badNumber = fixture();
  badNumber.movements[0].quantity = NaN;
  assert.throws(() => assertValidWorkspace(badNumber), /finite/);
});
test("runtime action validation rejects nonfinite inputs, unsupported actions and viewer writes", () => {
  const w = fixture();
  assert.throws(
    () => apply(w, { ...receipt(), quantity: "10" } as unknown as PharmaAction),
    /finite/,
  );
  assert.throws(
    () => apply(w, { type: "fabricate-stock" } as unknown as PharmaAction),
    /Unsupported/,
  );
  assert.throws(
    () =>
      applyPharmaAction(w, receipt(), {
        id: "viewer-write",
        now: NOW,
        actor: "Visitor",
        role: "viewer",
      }),
    /Viewer/,
  );
  assert.throws(
    () =>
      apply(w, {
        type: "clock.set",
        asOf: "2026-02-30",
        reason: "Invalid date fixture",
      }),
    /real ISO/,
  );
});
test("empty workspaces retain versioned isolation and do not inherit sample entities", () => {
  const w = seedPharmaWorkspace("new-org", NOW, "empty");
  assertValidWorkspace(w);
  assert.equal(w.schemaVersion, 2);
  assert.equal(w.synthetic, false);
  assert.equal(w.products.length, 0);
  assert.throws(
    () =>
      apply(w, {
        type: "clock.set",
        asOf: "2026-01-01",
        reason: "Move an operational clock",
      }),
    /sample workspaces/,
  );
});

test("cancelled reserved dispatch can release its restored reservation", () => {
  let w = apply(fixture(), {
    type: "reserve",
    batchId: "batch-para-002",
    locationId: "loc-central",
    quantity: 40,
    unit: "box",
    reference: "RES-CANCEL",
    reason: "Allocate forty boxes",
  });
  const reservationId = w.movements.at(-1)!.id;
  w = apply(w, { ...dispatch(25), reservationId } as PharmaAction);
  const shipmentId = w.shipments.at(-1)!.id;
  w = apply(w, {
    type: "delivery.cancel",
    shipmentId,
    reason: "Shipment cancelled before delivery",
  });
  w = apply(w, {
    type: "reservation.cancel",
    reservationId,
    reason: "Release the complete restored reservation",
  });
  assert.equal(
    stockBalances(w).find(
      (row) => row.batchId === "batch-para-002" && row.status === "reserved",
    ),
    undefined,
  );
  assert.equal(traceBatch(w, "batch-para-002").onHand, 400);
});

test("supplier returns and adjustments remain visible accounting roles", () => {
  let w = seedPharmaWorkspace("completed-supplier-return", NOW, "complete");
  w = apply(w, {
    type: "supplier-return",
    supplierId: "supplier-northstar",
    batchId: "batch-para-001",
    locationId: "loc-central",
    quantity: 50,
    unit: "box",
    status: "quarantined",
    reference: "SUP-RET-001",
    reason: "Evidence-backed supplier return",
    evidence: source,
  });
  const summary = recallSummary(w, "recall-001");
  assert.equal(summary.supplierReturned, 50);
  assert.equal(summary.onHand, 950);
  assert.equal(summary.accounted, 1000);
  assert.equal(summary.accountingComplete, true);
  assert.equal(w.reports.at(-1)!.summary.onHand, 1000);
});

test("evidence cannot point beyond its document or invent an excerpt", () => {
  assert.throws(
    () =>
      apply(fixture(), {
        ...receipt(),
        evidence: { sourceId: "src-receipts", line: 500 },
      } as PharmaAction),
    /outside the source/,
  );
  assert.throws(
    () =>
      apply(fixture(), {
        ...receipt(),
        evidence: {
          sourceId: "src-receipts",
          quote: "No such original document text",
        },
      } as PharmaAction),
    /not present/,
  );
});

test("report catalogue keeps historical product names after an allowed edit", () => {
  const w = fixture();
  const oldName = w.reports[0].catalogue!.products[0].name;
  const changed = apply(w, {
    type: "product.edit",
    productId: "product-para-500",
    changes: { name: "Paracetamol 500 mg · catalogue refresh" },
    reason: "Refresh the display wording",
  });
  assert.equal(changed.reports[0].catalogue!.products[0].name, oldName);
  assert.notEqual(changed.products[0].name, oldName);
  const invalid = structuredClone(changed);
  invalid.reports[0].summary.outstanding = NaN;
  assert.throws(() => assertValidWorkspace(invalid), /finite/);
});

test("restore rejects stock-shaped data that does not match its declared operation", () => {
  const badTransfer = fixture();
  const movement = badTransfer.movements.find(
    (row) => row.kind === "transfer-in",
  )!;
  movement.quantity = 199;
  movement.originalQuantity = 199;
  assert.throws(() => assertValidWorkspace(badTransfer), /preceding departure/);
  const badReceipt = fixture();
  badReceipt.movements[0].to!.status = "disposed";
  assert.throws(() => assertValidWorkspace(badReceipt), /Receipt must enter/);
  const badReturn = fixture();
  const returned = badReturn.movements.find((row) => row.kind === "return")!;
  returned.partnerId = "customer-c";
  assert.throws(() => assertValidWorkspace(badReturn), /delivered shipment/);
});

test("1,000 and 10,000 movement software benchmarks retain exact ledger totals", (t) => {
  for (const size of [1000, 10000]) {
    const w = fixture();
    const original = w.movements.find(
      (row) => row.batchId === "batch-para-002" && row.kind === "receipt",
    )!;
    w.movements = Array.from({ length: size }, (_, index) => ({
      ...original,
      id: `benchmark-${index}`,
      reference: `BENCH-${index}`,
      quantity: 1,
      originalQuantity: 1,
    }));
    w.shipments = [];
    w.recalls = [];
    w.acknowledgments = [];
    w.reports = [];
    w.audit = [];
    w.appliedActionIds = [];
    w.packages = [];
    const start = performance.now();
    assertValidWorkspace(w);
    const validationMs = performance.now() - start;
    const traceStart = performance.now();
    const trace = traceBatch(w, "batch-para-002");
    const traceMs = performance.now() - traceStart;
    assert.equal(trace.onHand, size);
    assert.equal(trace.received, size);
    assert.equal(trace.balances.length, 1);
    t.diagnostic(
      `${size} synthetic receipts: validation ${validationMs.toFixed(2)} ms; trace ${traceMs.toFixed(2)} ms; Node ${process.version}; no industrial workload claim.`,
    );
  }
});

test("one domain authorization policy protects direct and imported sensitive actions", () => {
  for (const type of [
    "hold",
    "release",
    "dispose",
    "adjust",
    "movement.reverse",
    "recall.create",
    "recall.acknowledge",
    "recall.close",
  ] as const) {
    assert.throws(
      () => authorizePharmaAction("operations", type),
      /Quality or administrator/,
    );
    assert.doesNotThrow(() => authorizePharmaAction("quality", type));
  }
  for (const type of [
    "product.add",
    "product.edit",
    "batch.correct",
    "location.add",
    "clock.set",
  ] as const) {
    assert.throws(
      () => authorizePharmaAction("quality", type),
      /Administrator/,
    );
    assert.doesNotThrow(() => authorizePharmaAction("admin", type));
  }
  for (const type of [
    "receipt",
    "dispatch",
    "return",
    "source.add",
    "report.create",
    "temperature.add",
  ] as const) {
    assert.doesNotThrow(() => authorizePharmaAction("operations", type));
    assert.throws(() => authorizePharmaAction("viewer", type), /Viewer/);
  }
  assert.throws(
    () =>
      applyPharmaAction(
        fixture(),
        {
          type: "batch.hold",
          batchId: "batch-para-002",
          reason: "Unauthorised hold attempt",
        },
        {
          id: "operations-hold",
          now: NOW,
          actor: "Warehouse operator",
          role: "operations",
        },
      ),
    /Quality or administrator/,
  );
});

test("archived sources preserve evidence without blocking a fresh reviewed source", () => {
  const w = fixture();
  const original = w.sources[0];
  original.hash = "a".repeat(64);
  assert.throws(
    () =>
      apply(w, {
        type: "source.add",
        source: { ...original, id: "fresh-copy" },
      }),
    /already been posted/,
  );
  original.archived = true;
  const changed = apply(w, {
    type: "source.add",
    source: { ...original, id: "fresh-copy", archived: false },
  });
  assert.equal(
    changed.sources.find((row) => row.id === original.id)!.archived,
    true,
  );
  assert.equal(
    changed.sources.find((row) => row.id === "fresh-copy")!.archived,
    false,
  );
  assertValidWorkspace(changed);
});

const serialDispatch = (serials: string[]): PharmaAction => ({
  type: "dispatch",
  batchId: "batch-saline-serial",
  locationId: "loc-central",
  partnerId: "customer-a",
  quantity: serials.length,
  unit: "bag",
  serials,
  reference: `SERIAL-DSP-${count}`,
  reason: "Dispatch the explicitly selected serialised units",
  evidence: { sourceId: "src-serials", line: 3 },
});

test("serialised seed records eight distinct units and two levels of package aggregation", () => {
  const w = fixture();
  const positions = serialLedger(w, "batch-saline-serial");
  assert.equal(positions.length, 8);
  assert.ok(
    positions.every(
      (row) => row.status === "available" && row.locationId === "loc-central",
    ),
  );
  assert.deepEqual(
    packageSerials(w, "package-saline-case"),
    Array.from(
      { length: 8 },
      (_, index) => `SERIAL-${String(index + 1).padStart(4, "0")}`,
    ),
  );
  assert.equal(traceBatch(w, "batch-saline-serial").onHand, 8);
});

test("sealed packages cannot be split until their recorded parent is opened", () => {
  let w = fixture();
  const first = packageSerials(w, "package-saline-a");
  assert.throws(
    () => apply(w, serialDispatch(first)),
    /Open the sealed package/,
  );
  assert.throws(
    () =>
      apply(w, {
        type: "package.open",
        packageId: "package-saline-a",
        reason: "Attempt opening an enclosed box",
      }),
    /parent container/,
  );
  w = apply(w, {
    type: "package.open",
    packageId: "package-saline-case",
    reason: "Open outer case for split distribution",
    evidence: { sourceId: "src-serials", line: 6 },
  });
  w = apply(w, serialDispatch(first));
  assert.equal(
    serialLedger(w, "batch-saline-serial").filter(
      (row) => row.status === "with-customer",
    ).length,
    4,
  );
  assert.equal(traceBatch(w, "batch-saline-serial").onHand, 4);
  assert.equal(
    w.packages!.find((row) => row.id === "package-saline-case")!.status,
    "opened",
  );
});

test("serialised partial returns match their dispatch and preserve remaining individual custody", () => {
  let w = apply(fixture(), {
    type: "package.open",
    packageId: "package-saline-case",
    reason: "Open outer shipping case",
  });
  w = apply(w, serialDispatch(packageSerials(w, "package-saline-a")));
  const shipmentId = w.shipments.at(-1)!.id;
  w = apply(w, {
    type: "delivery.confirm",
    shipmentId,
    reason: "Record delivery confirmation",
  });
  const returnAction: PharmaAction = {
    type: "return",
    shipmentId,
    batchId: "batch-saline-serial",
    locationId: "loc-central",
    quantity: 1,
    unit: "bag",
    serials: ["SERIAL-0001"],
    reference: "SERIAL-RTN-001",
    reason: "One serialised bag physically returned",
    evidence: { sourceId: "src-serials", line: 3 },
  };
  assert.throws(() => apply(w, returnAction), /Open the sealed package/);
  w = apply(w, {
    type: "package.open",
    packageId: "package-saline-a",
    reason: "Customer reports the delivered box opened",
  });
  assert.throws(
    () => apply(w, { ...returnAction, serials: ["SERIAL-0005"] }),
    /does not belong to the returned shipment/,
  );
  w = apply(w, returnAction);
  const positions = serialLedger(w, "batch-saline-serial");
  assert.equal(
    positions.find((row) => row.serial === "SERIAL-0001")!.status,
    "quarantined",
  );
  assert.equal(
    positions.filter((row) => row.status === "with-customer").length,
    3,
  );
  assert.equal(positions.filter((row) => row.status === "available").length, 4);
  assert.throws(
    () => apply(w, { ...returnAction, reference: "SERIAL-RTN-002" }),
    /does not belong to the returned shipment/,
  );
  w = apply(w, {
    type: "recall.create",
    holdStock: true,
    recall: {
      id: "serial-recall",
      reference: "SERIAL-RECALL",
      title: "Serialized bag reconciliation",
      productId: "product-saline",
      batchIds: ["batch-saline-serial"],
      owner: "Quality operator",
      reason: "Reconcile serialized customer stock",
      evidence: { sourceId: "src-serials", line: 1 },
    },
  });
  w = apply(w, { type: "report.create", recallId: "serial-recall" });
  const report = w.reports.at(-1)!;
  assert.equal(
    report.audit.filter((event) => event.action === "package.open").length,
    2,
  );
  assert.equal(report.catalogue!.packages!.length, 3);
  assert.ok(report.audit.some((event) => event.action === "delivery.confirm"));
  assert.ok(report.sources.some((document) => document.id === "src-serials"));
});

test("serials follow intact packages through transit and automatic recall holds", () => {
  let w = fixture();
  const serials = packageSerials(w, "package-saline-case");
  w = apply(w, {
    type: "transfer",
    batchId: "batch-saline-serial",
    locationId: "loc-central",
    destinationId: "loc-north",
    quantity: 8,
    unit: "bag",
    serials,
    reference: "SERIAL-TRF",
    reason: "Move the intact recorded case",
  });
  const transferId = w.movements.at(-1)!.transferId!;
  assert.ok(
    serialLedger(w, "batch-saline-serial").every(
      (row) => row.status === "in-transit",
    ),
  );
  w = apply(w, {
    type: "transfer.receive",
    transferId,
    reason: "Record intact receiving scan",
  });
  assert.ok(
    serialLedger(w, "batch-saline-serial").every(
      (row) => row.locationId === "loc-north" && row.status === "available",
    ),
  );
  w = apply(w, {
    type: "batch.hold",
    batchId: "batch-saline-serial",
    reason: "Quality places the entire batch on hold",
    evidence: { sourceId: "src-serials", line: 2 },
  });
  assert.ok(
    serialLedger(w, "batch-saline-serial").every(
      (row) => row.status === "quarantined",
    ),
  );
  assert.equal(traceBatch(w, "batch-saline-serial").onHand, 8);
});

test("serialised reservations release only the remaining selected units", () => {
  let w = fixture();
  const all = packageSerials(w, "package-saline-case");
  w = apply(w, {
    type: "reserve",
    batchId: "batch-saline-serial",
    locationId: "loc-central",
    quantity: 8,
    unit: "bag",
    serials: all,
    reference: "SERIAL-RES",
    reason: "Reserve all eight registered bags",
  });
  const reservationId = w.movements.at(-1)!.id;
  w = apply(w, {
    type: "package.open",
    packageId: "package-saline-case",
    reason: "Split outer case for allocation",
  });
  w = apply(w, {
    ...serialDispatch(all.slice(0, 4)),
    reservationId,
  } as PharmaAction);
  w = apply(w, {
    type: "reservation.cancel",
    reservationId,
    reason: "Release the four unused reserved bags",
  });
  const positions = serialLedger(w, "batch-saline-serial");
  assert.equal(positions.filter((row) => row.status === "reserved").length, 0);
  assert.equal(positions.filter((row) => row.status === "available").length, 4);
  assert.equal(
    positions.filter((row) => row.status === "with-customer").length,
    4,
  );
});

test("serial tracking rejects duplicates, omitted IDs and retrospective invented identity", () => {
  const w = fixture();
  const serials = packageSerials(w, "package-saline-case");
  assert.throws(
    () =>
      apply(w, {
        ...serialDispatch(serials),
        serials: undefined,
      } as PharmaAction),
    /one unique serial/,
  );
  assert.throws(
    () =>
      apply(w, {
        ...serialDispatch(serials),
        serials: Array(8).fill("SERIAL-0001"),
      } as PharmaAction),
    /one unique serial/,
  );
  assert.throws(
    () =>
      apply(w, {
        ...receipt(1),
        batchId: "batch-saline-serial",
        unit: "bag",
        serials: ["SERIAL-0001"],
      } as PharmaAction),
    /already recorded/,
  );
  assert.throws(
    () =>
      apply(w, {
        type: "batch.serials.register",
        batchId: "batch-para-002",
        serials: ["NEW-SERIAL"],
        reason: "Attempt assigning identity to existing stock",
      }),
    /before this batch's first movement/,
  );
  const another = {
    ...w.batches.find((row) => row.id === "batch-saline-serial")!,
    id: "other-serial-batch",
    code: "SERIAL-OTHER",
    originalCode: "SERIAL-OTHER",
    serials: ["SERIAL-0001"],
  };
  assert.throws(
    () => apply(w, { type: "batch.add", batch: another }),
    /two batches/,
  );
});

test("package validation rejects duplicate active membership and cyclic aggregation", () => {
  const w = fixture();
  assert.throws(
    () =>
      apply(w, {
        type: "package.create",
        package: {
          id: "duplicate-package",
          code: "DUPLICATE",
          batchId: "batch-saline-serial",
          serials: ["SERIAL-0001"],
          childPackageIds: [],
        },
        reason: "Attempt duplicating a contained unit",
      }),
    /another sealed package/,
  );
  const corrupt = structuredClone(w);
  corrupt.packages!.find((row) => row.id === "package-saline-a")!.serials = [];
  corrupt.packages!.find(
    (row) => row.id === "package-saline-a",
  )!.childPackageIds = ["package-saline-case"];
  assert.throws(() => assertValidWorkspace(corrupt), /cycle/);
});
