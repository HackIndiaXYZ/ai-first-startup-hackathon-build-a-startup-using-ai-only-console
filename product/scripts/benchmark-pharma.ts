import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cpus, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import {
  assertValidWorkspace,
  recallSummary,
  traceBatch,
} from "../lib/pharma/domain";
import { seedPharmaWorkspace } from "../lib/pharma/seed";
import type { Movement, PharmaWorkspace, Shipment } from "../lib/pharma/types";

function workload(
  size: number,
  kind: "receipts" | "distribution",
): PharmaWorkspace {
  const w = seedPharmaWorkspace(
    "benchmark-workspace",
    "2026-10-03T12:00:00Z",
    "empty",
  );
  const sample = seedPharmaWorkspace(
    "benchmark-source",
    "2026-10-03T12:00:00Z",
    "active",
  );
  w.products = [sample.products[0]];
  w.batches = [sample.batches[1]];
  w.locations = sample.locations;
  w.partners = sample.partners;
  w.sources = sample.sources;
  const base = sample.movements.find(
    (row) => row.kind === "receipt" && row.batchId === "batch-para-002",
  )!;
  if (kind === "receipts") {
    w.movements = Array.from({ length: size }, (_, index) => ({
      ...base,
      id: `receipt-${index}`,
      reference: `BENCH-${index}`,
      quantity: 1,
      originalQuantity: 1,
    }));
  } else {
    // Each four-event cycle: receipt10 -> dispatch6 -> return2 -> hold4.
    // Current stock6 + customer outstanding4 equals ten received, without double counting.
    const movements: Movement[] = [];
    const shipments: Shipment[] = [];
    for (let index = 0; index < size / 4; index++) {
      const shipmentId = `shipment-${index}`;
      const reference = `DSP-${index}`;
      movements.push({
        ...base,
        id: `receipt-${index}`,
        reference: `GRN-${index}`,
        quantity: 10,
        originalQuantity: 10,
      });
      movements.push({
        ...base,
        id: `dispatch-${index}`,
        kind: "dispatch",
        reference,
        quantity: 6,
        originalQuantity: 6,
        from: { locationId: "loc-central", status: "available" },
        to: undefined,
        shipmentId,
        partnerId: "customer-a",
      });
      movements.push({
        ...base,
        id: `return-${index}`,
        kind: "return",
        reference: `RTN-${index}`,
        quantity: 2,
        originalQuantity: 2,
        from: undefined,
        to: { locationId: "loc-central", status: "quarantined" },
        shipmentId,
        partnerId: "customer-a",
      });
      movements.push({
        ...base,
        id: `hold-${index}`,
        kind: "hold",
        reference: `HOLD-${index}`,
        quantity: 4,
        originalQuantity: 4,
        from: { locationId: "loc-central", status: "available" },
        to: { locationId: "loc-central", status: "quarantined" },
      });
      shipments.push({
        id: shipmentId,
        reference,
        batchId: base.batchId,
        partnerId: "customer-a",
        locationId: "loc-central",
        quantity: 6,
        unit: base.unit,
        status: "delivered",
        dispatchedAt: base.at,
        deliveredAt: base.at,
        evidence: base.evidence,
      });
    }
    w.movements = movements;
    w.shipments = shipments;
    w.batches[0] = {
      ...w.batches[0],
      held: true,
      holdReason: "Synthetic benchmark recall",
    };
    w.recalls = [
      {
        id: "benchmark-recall",
        reference: "BENCH-RC",
        title: "Synthetic reconciliation benchmark",
        productId: "product-para-500",
        batchIds: [base.batchId],
        owner: "Benchmark operator",
        reason: "Synthetic workload, no industrial claim",
        openedAt: base.at,
        status: "reconciling",
        evidence: { sourceId: "src-recall", line: 2 },
        tasks: [],
      },
    ];
  }
  return w;
}
function measure(fn: () => void) {
  fn();
  const runs: number[] = [];
  for (let index = 0; index < 7; index++) {
    const start = performance.now();
    fn();
    runs.push(performance.now() - start);
  }
  runs.sort((a, b) => a - b);
  return {
    medianMs: Number(runs[3].toFixed(3)),
    minMs: Number(runs[0].toFixed(3)),
    maxMs: Number(runs[6].toFixed(3)),
    measuredRuns: 7,
    warmupRuns: 1,
  };
}
const results = [];
for (const kind of ["receipts", "distribution"] as const)
  for (const size of [1000, 10000]) {
    const w = workload(size, kind);
    assertValidWorkspace(w);
    const trace = traceBatch(w, "batch-para-002");
    assert.equal(trace.onHand, kind === "receipts" ? size : (size / 4) * 6);
    if (kind === "distribution") {
      const summary = recallSummary(w, "benchmark-recall");
      assert.equal(summary.outstanding, size);
      assert.equal(summary.accounted, (size / 4) * 6);
      assert.deepEqual(summary.exceptions, []);
    }
    results.push({
      kind,
      movements: size,
      shipments: w.shipments.length,
      serializedWorkspaceBytes: Buffer.byteLength(JSON.stringify(w)),
      validation: measure(() => assertValidWorkspace(w)),
      trace: measure(() => {
        traceBatch(w, "batch-para-002");
      }),
      reconciliation:
        kind === "distribution"
          ? measure(() => {
              recallSummary(w, "benchmark-recall");
            })
          : undefined,
      invariants: "passed",
    });
  }
const report = {
  format: "recallscope-pharma-benchmark-v1",
  measuredAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
    totalMemoryGiB: Number((totalmem() / 1024 ** 3).toFixed(2)),
  },
  methodology:
    "Deterministic synthetic fixtures, one warmup then seven measured in-process runs. Timing excludes DB/network/rendering and fixture construction. No performance acceptance threshold or industrial workload claim.",
  results,
};
await mkdir(resolve("verification"), { recursive: true });
await writeFile(
  resolve("verification/pharma-benchmark.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
