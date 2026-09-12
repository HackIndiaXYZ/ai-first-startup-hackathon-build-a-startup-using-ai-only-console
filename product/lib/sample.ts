import type { Workspace } from "./domain";

export function sampleWorkspace(
  id = "preview",
  at = "2026-09-12T07:30:00.000Z",
): Workspace {
  const doc = (id: string, name: string, kind: string, text: string) => ({
    id,
    name,
    kind,
    text,
    mode: "sample" as const,
    uploadedAt: at,
  });
  return {
    id,
    revision: 0,
    synthetic: true,
    lots: [
      {
        id: "lot-a",
        code: "FL-260901-A",
        ingredient: "Wheat flour",
        supplier: "Northfield Milling",
        receivedKg: 120,
        sourceId: "invoice",
        line: 4,
      },
      {
        id: "lot-b",
        code: "FL-260902-B",
        ingredient: "Wheat flour",
        supplier: "Northfield Milling",
        receivedKg: 80,
        sourceId: "invoice",
        line: 5,
      },
    ],
    batches: [
      {
        id: "batch-01",
        code: "CK-0903-01",
        product: "Butter cookies · 200 g",
        producedPacks: 400,
        usedKg: 24,
        lotId: "lot-a",
        rawLotCode: "FL-260901-A",
        status: "confirmed",
        sourceId: "production-01",
        line: 4,
      },
      {
        id: "batch-02",
        code: "CK-0903-02",
        product: "Butter cookies · 200 g",
        producedPacks: 400,
        usedKg: 24,
        lotId: "lot-a",
        rawLotCode: "FL-260901-A",
        status: "confirmed",
        sourceId: "production-02",
        line: 4,
      },
      {
        id: "batch-03",
        code: "CK-0904-01",
        product: "Butter cookies · 200 g",
        producedPacks: 400,
        usedKg: 24,
        lotId: null,
        rawLotCode: "FL-2609O1-A",
        status: "unresolved",
        sourceId: "production-03",
        line: 4,
      },
      {
        id: "batch-04",
        code: "CK-0904-02",
        product: "Butter cookies · 200 g",
        producedPacks: null,
        usedKg: null,
        lotId: null,
        rawLotCode: "No consumption record",
        status: "unresolved",
        sourceId: "",
        line: 0,
      },
      {
        id: "batch-05",
        code: "CK-0905-01",
        product: "Butter cookies · 200 g",
        producedPacks: 400,
        usedKg: 24,
        lotId: "lot-b",
        rawLotCode: "FL-260902-B",
        status: "confirmed",
        sourceId: "production-05",
        line: 4,
      },
    ],
    deliveries: [
      {
        id: "delivery-01",
        batchId: "batch-01",
        rawBatchCode: "CK-0903-01",
        customer: "Juniper Café",
        packs: 240,
        date: "2026-09-04",
        sourceId: "dispatch",
        line: 3,
      },
      {
        id: "delivery-02",
        batchId: "batch-01",
        rawBatchCode: "CK-0903-01",
        customer: "Grove Market",
        packs: 120,
        date: "2026-09-04",
        sourceId: "dispatch",
        line: 4,
      },
      {
        id: "delivery-03",
        batchId: "batch-02",
        rawBatchCode: "CK-0903-02",
        customer: "Grove Market",
        packs: 360,
        date: "2026-09-04",
        sourceId: "dispatch",
        line: 5,
      },
      {
        id: "delivery-04",
        batchId: "batch-03",
        rawBatchCode: "CK-0904-01",
        customer: "Harbor Grocer",
        packs: 360,
        date: "2026-09-05",
        sourceId: "dispatch",
        line: 6,
      },
      {
        id: "delivery-05",
        batchId: "batch-04",
        rawBatchCode: "CK-0904-02",
        customer: "Orchard Pantry",
        packs: 360,
        date: "2026-09-05",
        sourceId: "dispatch",
        line: 7,
      },
      {
        id: "delivery-06",
        batchId: "batch-05",
        rawBatchCode: "CK-0905-01",
        customer: "Juniper Café",
        packs: 360,
        date: "2026-09-06",
        sourceId: "dispatch",
        line: 8,
      },
    ],
    documents: [
      doc(
        "invoice",
        "NF-1042 · Supplier invoice.txt",
        "Supplier invoice",
        "SYNTHETIC SAMPLE — Northfield Milling\nInvoice NF-1042 | 02 September 2026\nIngredient | Lot | Received\nWheat flour | FL-260901-A | 120 kg\nWheat flour | FL-260902-B | 80 kg",
      ),
      ...[
        ["01", "CK-0903-01", "FL-260901-A"],
        ["02", "CK-0903-02", "FL-260901-A"],
        ["03", "CK-0904-01", "FL-2609O1-A"],
        ["05", "CK-0905-01", "FL-260902-B"],
      ].map(([suffix, batch, lot]) =>
        doc(
          `production-${suffix}`,
          `${batch} · Production sheet.txt`,
          "Production record",
          `SYNTHETIC SAMPLE — Fieldwork Bakery\nProduct: Butter cookies, 200 g\nBatch: ${batch}\nIngredient lot: ${lot}\nWheat flour used: 24 kg\nProduced: 400 packs${suffix === "03" ? "\nReview note: the lot code contains a letter O where the supplier invoice uses zero. Verify before linking." : ""}`,
        ),
      ),
      doc(
        "dispatch",
        "DIS-0906 · Delivery register.csv",
        "Delivery register",
        "SYNTHETIC SAMPLE — Fieldwork Bakery\nDate,Customer,Batch,Packs\n2026-09-04,Juniper Café,CK-0903-01,240\n2026-09-04,Grove Market,CK-0903-01,120\n2026-09-04,Grove Market,CK-0903-02,360\n2026-09-05,Harbor Grocer,CK-0904-01,360\n2026-09-05,Orchard Pantry,CK-0904-02,360\n2026-09-06,Juniper Café,CK-0905-01,360",
      ),
    ],
    audit: [],
    reports: [],
  };
}

/** Complete fictional example; the original review fixture remains independent. */
export function completeSampleWorkspace(
  id = "preview",
  at = "2026-09-12T07:30:00.000Z",
): Workspace {
  const workspace = sampleWorkspace(id, at);
  for (const suffix of ["03", "04"]) {
    const batch = workspace.batches.find((b) => b.id === `batch-${suffix}`)!;
    Object.assign(batch, {
      producedPacks: 400,
      usedKg: 24,
      lotId: "lot-a",
      rawLotCode: "FL-260901-A",
      status: "confirmed",
      sourceId: `production-${suffix}`,
      line: 4,
    });
    const source = {
      id: batch.sourceId,
      name: `${batch.code} · Production sheet.txt`,
      kind: "Production record",
      text: `SYNTHETIC SAMPLE — Fieldwork Bakery\nProduct: Butter cookies, 200 g\nBatch: ${batch.code}\nIngredient lot: FL-260901-A\nWheat flour used: 24 kg\nProduced: 400 packs`,
      mode: "sample" as const,
      uploadedAt: at,
    };
    const index = workspace.documents.findIndex((d) => d.id === source.id);
    if (index >= 0) workspace.documents[index] = source;
    else workspace.documents.splice(workspace.documents.length - 1, 0, source);
  }
  return workspace;
}
