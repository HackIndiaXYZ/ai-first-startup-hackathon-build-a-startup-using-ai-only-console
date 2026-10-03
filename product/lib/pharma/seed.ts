import { applyPharmaAction, parseLabelDate } from "./domain";
import type { PharmaAction, PharmaWorkspace, Product } from "./types";

/** Reproducible fictional records. No invented customer outcomes or official registrations. */
export function seedPharmaWorkspace(
  id: string,
  now: string,
  scenario: "active" | "complete" | "empty" = "active",
): PharmaWorkspace {
  const asOf = "2026-10-03";
  let workspace: PharmaWorkspace = {
    schemaVersion: 2,
    id,
    revision: 0,
    name: "Asterbridge Distribution",
    synthetic: true,
    asOf,
    createdAt: now,
    products: [],
    batches: [],
    locations: [],
    partners: [],
    sources: [],
    movements: [],
    shipments: [],
    recalls: [],
    acknowledgments: [],
    temperatures: [],
    reports: [],
    audit: [],
    appliedActionIds: [],
    packages: [],
  };
  if (scenario === "empty")
    return {
      ...workspace,
      name: "My pharmaceutical workspace",
      synthetic: false,
      asOf: now.slice(0, 10),
    };
  workspace.sources = [
    {
      id: "src-catalog",
      name: "Asterbridge · product catalogue",
      kind: "Product catalogue",
      mode: "sample",
      createdAt: now,
      text: "FICTIONAL DISTRIBUTOR SCENARIO — all organisations, products and records are authored examples.\nPAR-500-100 | Paracetamol 500 mg tablets | 10 blisters × 10 tablets per box | Asterbridge Laboratories\nPAR-250-100ML | Paracetamol 250 mg/5 mL suspension | 100 mL bottle | Asterbridge Laboratories\nAMX-500-100 | Amoxicillin 500 mg capsules | 10 blisters × 10 capsules per box | Meridian Example Pharma\nCET-10-100 | Cetirizine 10 mg tablets | 10 blisters × 10 tablets per box | Meridian Example Pharma\nMET-500-100 | Metformin 500 mg tablets | 10 blisters × 10 tablets per box | Asterbridge Laboratories\nSAL-09-500 | Sodium chloride 0.9% infusion | 500 mL bag | Meridian Example Pharma\nStorage policies in this catalogue are authored software fixtures, not product instructions.",
    },
    {
      id: "src-receipts",
      name: "GRN-260901 · goods received register",
      kind: "Goods received note",
      mode: "sample",
      createdAt: now,
      text: "FICTIONAL RECORDS\nGRN-001 | Northstar Supply | PAR-500-100 | PCR-260901 | 1,000 box | Central | expiry 2027-09\nGRN-002 | Northstar Supply | PAR-500-100 | PCR-261001 | 400 box | Central | expiry 2028-01\nGRN-003 | Northstar Supply | AMX-500-100 | PCR-260901 | 300 box | Central | expiry 2027-11\nGRN-004 | Northstar Supply | CET-10-100 | CET-260701 | 180 box | North | expiry 2026-11\nGRN-005 | Northstar Supply | MET-500-100 | MET-260801 | 240 box | Central | expiry 2027-08\nGRN-006 | Northstar Supply | PAR-250-100ML | SUS-260901 | 120 bottle | Central | expiry 2027-06\nGRN-007 | Northstar Supply | SAL-09-500 | SAL-260801 | 100 bag | North | expiry 2027-05\nGRN-008 | Northstar Supply | CET-10-100 | CET-250501 | 20 box | North | expiry 2026-09",
    },
    {
      id: "src-transfer",
      name: "TRF-001 · Central to North",
      kind: "Transfer record",
      mode: "sample",
      createdAt: now,
      text: "FICTIONAL RECORD\nTRF-001 | PAR-500-100 | PCR-260901 | 200 box transferred Central → North; receipt confirmed.\nEnterprise stock remains 1,000 boxes after this transfer.",
    },
    {
      id: "src-dispatches",
      name: "DSP-260902 · dispatch register",
      kind: "Dispatch note",
      mode: "sample",
      createdAt: now,
      text: "FICTIONAL RECORDS\nDSP-001 | PAR-500-100 | PCR-260901 | Aster Pharmacy | 250 box | Central | delivered\nDSP-002 | PAR-500-100 | PCR-260901 | Brook Clinic | 150 box | Central | delivered\nDSP-003 | PAR-500-100 | PCR-260901 | Cedar Hospital | 100 box | Central | delivered\nDSP-004 | PAR-500-100 | PCR-260901 | Delta Distribution | 100 box | North | delivered\nAll records are authored examples. Delivery confirmations are part of the fictional scenario.",
    },
    {
      id: "src-recall",
      name: "RC-2026-001 · batch recall instruction",
      kind: "Recall notice",
      mode: "sample",
      createdAt: now,
      text: "FICTIONAL RECALL EXERCISE\nRC-2026-001 | PAR-500-100 | PCR-260901 only.\nReason: an authored packaging-label discrepancy in this scenario.\nAuthorised sample operator: Maya Chen, quality team.\nHold the 400 boxes remaining at Central (300) and North (100); contact the four recorded recipients.\nThe same printed batch code on AMX-500-100 is outside this scope. No authority-issued recall or product safety decision is represented.",
    },
    {
      id: "src-returns",
      name: "RTN-260903 · customer return receipts",
      kind: "Return note",
      mode: "sample",
      createdAt: now,
      text: "FICTIONAL RECORDS\nRTN-001 | DSP-001 | Aster Pharmacy | PCR-260901 | 50 box received into Central quarantine\nRTN-002 | DSP-002 | Brook Clinic | PCR-260901 | 30 box received into Central quarantine\nRTN-003 | DSP-004 | Delta Distribution | PCR-260901 | 20 box received into North quarantine\nTotal received back: 100 boxes. Remaining shipped quantity: 500 boxes. This is a partial reconciliation scenario.",
    },
    {
      id: "src-temperature",
      name: "TEMP-001 · warehouse observation",
      kind: "Temperature record",
      mode: "sample",
      createdAt: now,
      text: "FICTIONAL RECORD\nTEMP-001 | SAL-09-500 | SAL-260801 | North | 27.2 °C observed at 2026-09-30T08:00:00Z.\nThe authored catalogue policy for this software fixture is 15–25 °C. This observation requires a quality decision; software does not determine medicine safety.",
    },
  ];
  workspace.locations = [
    {
      id: "loc-central",
      name: "Central · A01",
      warehouse: "Central warehouse",
    },
    { id: "loc-north", name: "North · B02", warehouse: "North warehouse" },
  ];
  workspace.partners = [
    {
      id: "supplier-northstar",
      name: "Northstar Supply",
      kind: "supplier",
      contact: "Supplier records desk",
      email: "records@northstar.example",
      address: "Example Logistics Park",
    },
    {
      id: "customer-a",
      name: "Aster Pharmacy",
      kind: "pharmacy",
      contact: "Aisha Lim",
      email: "quality@aster.example",
      minimumShelfLifeDays: 90,
    },
    {
      id: "customer-b",
      name: "Brook Clinic",
      kind: "clinic",
      contact: "Daniel Tan",
      email: "stores@brook.example",
    },
    {
      id: "customer-c",
      name: "Cedar Hospital",
      kind: "hospital",
      contact: "Priya Rao",
      email: "pharmacy@cedar.example",
    },
    {
      id: "customer-d",
      name: "Delta Distribution",
      kind: "distributor",
      contact: "Evan Wong",
      email: "recalls@delta.example",
    },
  ];
  const product = (
    input: Pick<
      Product,
      | "id"
      | "sku"
      | "name"
      | "genericName"
      | "activeIngredient"
      | "strength"
      | "dosageForm"
      | "manufacturer"
      | "baseUnit"
      | "packaging"
    >,
    line: number,
  ): Product => ({
    ...input,
    units:
      input.baseUnit === "box"
        ? [
            { unit: "box", factor: 1 },
            { unit: "blister", factor: 0.1 },
            {
              unit: input.dosageForm === "Capsule" ? "capsule" : "tablet",
              factor: 0.01,
            },
          ]
        : [
            { unit: input.baseUnit, factor: 1 },
            { unit: "case", factor: 20 },
          ],
    quantityPrecision: input.baseUnit === "box" ? 2 : 0,
    storage:
      "Authored scenario policy: store at 15–25 °C; consult the original product instructions for an actual product.",
    temperatureMin: 15,
    temperatureMax: 25,
    archived: false,
    version: 1,
    evidence: { sourceId: "src-catalog", line },
  });
  workspace.products = [
    product(
      {
        id: "product-para-500",
        sku: "PAR-500-100",
        name: "Paracetamol 500 mg",
        genericName: "Paracetamol",
        activeIngredient: "Paracetamol",
        strength: "500 mg",
        dosageForm: "Tablet",
        manufacturer: "Asterbridge Laboratories",
        baseUnit: "box",
        packaging: "10 blisters × 10 tablets",
      },
      2,
    ),
    product(
      {
        id: "product-para-susp",
        sku: "PAR-250-100ML",
        name: "Paracetamol oral suspension",
        genericName: "Paracetamol",
        activeIngredient: "Paracetamol",
        strength: "250 mg/5 mL",
        dosageForm: "Oral suspension",
        manufacturer: "Asterbridge Laboratories",
        baseUnit: "bottle",
        packaging: "100 mL bottle; 20 bottles per case",
      },
      3,
    ),
    product(
      {
        id: "product-amox-500",
        sku: "AMX-500-100",
        name: "Amoxicillin 500 mg",
        genericName: "Amoxicillin",
        activeIngredient: "Amoxicillin",
        strength: "500 mg",
        dosageForm: "Capsule",
        manufacturer: "Meridian Example Pharma",
        baseUnit: "box",
        packaging: "10 blisters × 10 capsules",
      },
      4,
    ),
    product(
      {
        id: "product-cet-10",
        sku: "CET-10-100",
        name: "Cetirizine 10 mg",
        genericName: "Cetirizine",
        activeIngredient: "Cetirizine",
        strength: "10 mg",
        dosageForm: "Tablet",
        manufacturer: "Meridian Example Pharma",
        baseUnit: "box",
        packaging: "10 blisters × 10 tablets",
      },
      5,
    ),
    product(
      {
        id: "product-met-500",
        sku: "MET-500-100",
        name: "Metformin 500 mg",
        genericName: "Metformin",
        activeIngredient: "Metformin",
        strength: "500 mg",
        dosageForm: "Tablet",
        manufacturer: "Asterbridge Laboratories",
        baseUnit: "box",
        packaging: "10 blisters × 10 tablets",
      },
      6,
    ),
    product(
      {
        id: "product-saline",
        sku: "SAL-09-500",
        name: "Sodium chloride 0.9%",
        genericName: "Sodium chloride",
        activeIngredient: "Sodium chloride",
        strength: "0.9%",
        dosageForm: "Infusion",
        manufacturer: "Meridian Example Pharma",
        baseUnit: "bag",
        packaging: "500 mL bag; 20 bags per case",
      },
      7,
    ),
  ];
  workspace.batches = [
    [
      "batch-para-001",
      "product-para-500",
      "PCR-260901",
      "2027-09",
      "2026-09",
      2,
    ],
    [
      "batch-para-002",
      "product-para-500",
      "PCR-261001",
      "2028-01",
      "2026-09",
      3,
    ],
    [
      "batch-amox-001",
      "product-amox-500",
      "PCR-260901",
      "2027-11",
      "2026-09",
      4,
    ],
    ["batch-cet-001", "product-cet-10", "CET-260701", "2026-11", "2026-07", 5],
    ["batch-met-001", "product-met-500", "MET-260801", "2027-08", "2026-08", 6],
    [
      "batch-susp-001",
      "product-para-susp",
      "SUS-260901",
      "2027-06",
      "2026-09",
      7,
    ],
    [
      "batch-saline-001",
      "product-saline",
      "SAL-260801",
      "2027-05",
      "2026-08",
      8,
    ],
    [
      "batch-cet-expired",
      "product-cet-10",
      "CET-250501",
      "2026-09",
      "2025-05",
      9,
    ],
  ].map(([batchId, productId, code, expiry, manufactured, line]) => ({
    id: String(batchId),
    productId: String(productId),
    code: String(code),
    originalCode: String(code),
    manufacturer: workspace.products.find((row) => row.id === productId)!
      .manufacturer,
    expiry: parseLabelDate(String(expiry)),
    manufactured: parseLabelDate(String(manufactured)),
    evidence: { sourceId: "src-receipts", line: Number(line) },
    held: false,
  }));
  const act = (actionId: string, action: PharmaAction) => {
    workspace = applyPharmaAction(workspace, action, {
      id: actionId,
      now,
      actor: "Maya Chen · sample quality team",
      role: "admin",
    });
  };
  const receipts = [
    ["batch-para-001", 1000, "loc-central", "box"],
    ["batch-para-002", 400, "loc-central", "box"],
    ["batch-amox-001", 300, "loc-central", "box"],
    ["batch-cet-001", 180, "loc-north", "box"],
    ["batch-met-001", 240, "loc-central", "box"],
    ["batch-susp-001", 120, "loc-central", "bottle"],
    ["batch-saline-001", 100, "loc-north", "bag"],
    ["batch-cet-expired", 20, "loc-north", "box"],
  ] as const;
  receipts.forEach(([batchId, quantity, locationId, unit], index) =>
    act(`seed-receipt-${index + 1}`, {
      type: "receipt",
      batchId,
      quantity,
      unit,
      locationId,
      supplierId: "supplier-northstar",
      reference: `GRN-${String(index + 1).padStart(3, "0")}`,
      reason: "Posted from authored goods receipt scenario",
      evidence: { sourceId: "src-receipts", line: index + 2 },
    }),
  );
  act("seed-transfer", {
    type: "transfer",
    batchId: "batch-para-001",
    locationId: "loc-central",
    destinationId: "loc-north",
    quantity: 200,
    unit: "box",
    reference: "TRF-001",
    reason: "Allocate the authored North warehouse shipment",
    evidence: { sourceId: "src-transfer", line: 2 },
  });
  act("seed-transfer-receive", {
    type: "transfer.receive",
    transferId: "seed-transfer-transfer-1",
    reason: "Confirmed the authored transfer receipt",
    evidence: { sourceId: "src-transfer", line: 2 },
  });
  const dispatches = [
    ["a", 250, "loc-central"],
    ["b", 150, "loc-central"],
    ["c", 100, "loc-central"],
    ["d", 100, "loc-north"],
  ] as const;
  dispatches.forEach(([letter, quantity, locationId], index) => {
    act(`seed-dispatch-${letter}`, {
      type: "dispatch",
      batchId: "batch-para-001",
      locationId,
      quantity,
      unit: "box",
      partnerId: `customer-${letter}`,
      reference: `DSP-${String(index + 1).padStart(3, "0")}`,
      reason: "Posted from authored dispatch register",
      evidence: { sourceId: "src-dispatches", line: index + 2 },
    });
    act(`seed-delivery-${letter}`, {
      type: "delivery.confirm",
      shipmentId: `seed-dispatch-${letter}-shipment-1`,
      reason: "Recorded delivery in the fictional scenario",
      evidence: { sourceId: "src-dispatches", line: index + 2 },
    });
  });
  act("seed-recall", {
    type: "recall.create",
    recall: {
      id: "recall-001",
      reference: "RC-2026-001",
      title: "Paracetamol · packaging label recall",
      productId: "product-para-500",
      batchIds: ["batch-para-001"],
      reason:
        "Authored packaging-label discrepancy, limited to this product and batch",
      owner: "Maya Chen",
      dueDate: "2026-10-10",
      evidence: { sourceId: "src-recall", line: 2 },
    },
    holdStock: true,
  });
  const returns = [
    ["a", 50, "loc-central"],
    ["b", 30, "loc-central"],
    ["d", 20, "loc-north"],
  ] as const;
  returns.forEach(([letter, quantity, locationId], index) =>
    act(`seed-return-${letter}`, {
      type: "return",
      batchId: "batch-para-001",
      locationId,
      quantity,
      unit: "box",
      shipmentId: `seed-dispatch-${letter}-shipment-1`,
      reference: `RTN-${String(index + 1).padStart(3, "0")}`,
      reason: "Customer return received into quarantine in authored scenario",
      evidence: { sourceId: "src-returns", line: index + 2 },
    }),
  );
  act("seed-recall-state", {
    type: "recall.update",
    recallId: "recall-001",
    status: "reconciling",
    reason: "Partial returns recorded; continue recipient reconciliation",
  });
  act("seed-recall-task", {
    type: "recall.task",
    recallId: "recall-001",
    task: {
      id: "task-returns",
      title: "Reconcile the remaining recipient quantities",
      owner: "Maya Chen",
      dueDate: "2026-10-10",
      done: false,
    },
    reason: "Assign the remaining recall accounting work",
  });
  // The observation timestamp is bounded by creation time for reproducible earlier-date tests.
  const observedAt =
    Date.parse(now) < Date.parse("2026-09-30T08:00:00Z")
      ? now
      : "2026-09-30T08:00:00Z";
  act("seed-temperature", {
    type: "temperature.add",
    batchId: "batch-saline-001",
    locationId: "loc-north",
    celsius: 27.2,
    observedAt,
    note: "Authored policy excursion; a quality decision is required",
    evidence: { sourceId: "src-temperature", line: 2 },
  });
  const serials = Array.from(
    { length: 8 },
    (_, index) => `SERIAL-${String(index + 1).padStart(4, "0")}`,
  );
  act("seed-serial-source", {
    type: "source.add",
    source: {
      id: "src-serials",
      name: "SAL-SERIAL-001 · serial and package register",
      kind: "Serialised packing record",
      mode: "sample",
      createdAt: now,
      text: `FICTIONAL SERIALISED DISTRIBUTION RECORD\nSAL-09-500 | SAL-SERIAL-001 | 8 bag received at Central | expiry 2028-09\nRegistered units: ${serials.join(", ")}\nPKG-SAL-A contains SERIAL-0001 through SERIAL-0004.\nPKG-SAL-B contains SERIAL-0005 through SERIAL-0008.\nCASE-SAL-001 contains PKG-SAL-A and PKG-SAL-B. Package codes are authored internal identifiers, not certified logistics codes.`,
    },
  });
  act("seed-serial-batch", {
    type: "batch.add",
    batch: {
      id: "batch-saline-serial",
      productId: "product-saline",
      code: "SAL-SERIAL-001",
      originalCode: "SAL-SERIAL-001",
      manufacturer: "Meridian Example Pharma",
      expiry: parseLabelDate("2028-09"),
      manufactured: parseLabelDate("2026-09"),
      serials,
      evidence: { sourceId: "src-serials", line: 2 },
    },
  });
  act("seed-serial-receipt", {
    type: "receipt",
    batchId: "batch-saline-serial",
    locationId: "loc-central",
    supplierId: "supplier-northstar",
    quantity: 8,
    unit: "bag",
    serials,
    reference: "GRN-SERIAL-001",
    reason: "Register the eight authored serialised units",
    evidence: { sourceId: "src-serials", line: 3 },
  });
  act("seed-package-a", {
    type: "package.create",
    package: {
      id: "package-saline-a",
      code: "PKG-SAL-A",
      batchId: "batch-saline-serial",
      serials: serials.slice(0, 4),
      childPackageIds: [],
      evidence: { sourceId: "src-serials", line: 4 },
    },
    reason: "Record the first four-unit package",
  });
  act("seed-package-b", {
    type: "package.create",
    package: {
      id: "package-saline-b",
      code: "PKG-SAL-B",
      batchId: "batch-saline-serial",
      serials: serials.slice(4),
      childPackageIds: [],
      evidence: { sourceId: "src-serials", line: 5 },
    },
    reason: "Record the second four-unit package",
  });
  act("seed-package-case", {
    type: "package.create",
    package: {
      id: "package-saline-case",
      code: "CASE-SAL-001",
      batchId: "batch-saline-serial",
      serials: [],
      childPackageIds: ["package-saline-a", "package-saline-b"],
      evidence: { sourceId: "src-serials", line: 6 },
    },
    reason: "Record both packages inside one container",
  });
  act("seed-report", {
    type: "report.create",
    recallId: "recall-001",
    title: "RC-2026-001 · partial return snapshot",
    note: "Fictional scenario: 1,000 boxes received; 600 dispatched; 100 returned; 500 outstanding. Original held stock and returns are not double-counted.",
  });
  if (scenario === "complete") {
    act("seed-complete-source", {
      type: "source.add",
      source: {
        id: "src-completion",
        name: "RC-2026-001 · completed reconciliation record",
        kind: "Return and closure record",
        mode: "sample",
        createdAt: now,
        text: "FICTIONAL COMPLETED SCENARIO\nAster Pharmacy returns a further 200 boxes; Brook Clinic 120; Cedar Hospital 100; Delta Distribution 80.\nAll 600 dispatched boxes are now returned into quarantine. Original held stock was 400 boxes; recorded stock is 1,000 boxes.\nMaya Chen records accounting closure. Stock remains quarantined; no disposal or medical safety decision is represented.",
      },
    });
    (
      [
        ["a", 200, "loc-central"],
        ["b", 120, "loc-central"],
        ["c", 100, "loc-central"],
        ["d", 80, "loc-north"],
      ] as const
    ).forEach(([letter, quantity, locationId]) =>
      act(`seed-complete-return-${letter}`, {
        type: "return",
        batchId: "batch-para-001",
        shipmentId: `seed-dispatch-${letter}-shipment-1`,
        locationId,
        quantity,
        unit: "box",
        reference: `RTN-FINAL-${letter.toUpperCase()}`,
        reason: "Final authored return receipt for completed scenario",
        evidence: { sourceId: "src-completion", line: 2 },
      }),
    );
    act("seed-complete-task", {
      type: "recall.task",
      recallId: "recall-001",
      task: {
        id: "task-returns",
        title: "Reconcile the remaining recipient quantities",
        owner: "Maya Chen",
        dueDate: "2026-10-10",
        done: true,
      },
      reason: "All authored return receipts are accounted for",
    });
    act("seed-complete-close", {
      type: "recall.close",
      recallId: "recall-001",
      reason:
        "Accounting complete with all 1,000 boxes recorded in quarantine; disposition remains a separate decision",
      evidence: { sourceId: "src-completion", line: 4 },
    });
    act("seed-complete-report", {
      type: "report.create",
      recallId: "recall-001",
      title: "RC-2026-001 · completed accounting",
      note: "Completed fictional scenario, with stock still held and no invented disposal decision.",
    });
  }
  return workspace;
}
