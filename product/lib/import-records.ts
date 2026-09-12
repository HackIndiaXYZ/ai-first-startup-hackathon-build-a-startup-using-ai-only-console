import { z } from "zod";
import type { Workspace, SourceDocument } from "./domain";

const optionalText = z.string().max(200).nullable();
const quantity = z.number().finite().nonnegative().max(100000000).nullable();
export const recordSchema = z.object({
  type: z.enum(["lot", "batch", "delivery"]),
  code: z.string().trim().min(1).max(100),
  lotCode: optionalText,
  batchCode: optionalText,
  ingredient: optionalText,
  product: optionalText,
  supplier: optionalText,
  customer: optionalText,
  receivedKg: quantity,
  usedKg: quantity,
  producedPacks: quantity,
  packs: quantity,
  date: optionalText,
  evidence: z.string().min(1).max(2000),
});
export const extractionSchema = z.object({
  transcript: z.string().min(1).max(80000),
  records: z.array(recordSchema).min(1).max(60),
});
export type ExtractedRecord = z.infer<typeof recordSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export function blankRecord(
  type: ExtractedRecord["type"] = "lot",
): ExtractedRecord {
  return {
    type,
    code: "",
    lotCode: null,
    batchCode: null,
    ingredient: null,
    product: null,
    supplier: null,
    customer: null,
    receivedKg: null,
    usedKg: null,
    producedPacks: null,
    packs: null,
    date: null,
    evidence: "",
  };
}
function positive(n: number | null, name: string) {
  if (n === null || n <= 0) throw Error(name + " must be a positive number.");
  return n;
}
function required(s: string | null, name: string) {
  if (!s?.trim()) throw Error(name + " is required.");
  return s.trim();
}
export function importRecords(
  w: Workspace,
  doc: SourceDocument,
  inputs: ExtractedRecord[],
  at: string,
): Workspace {
  if (w.documents.some((d) => d.hash && d.hash === doc.hash))
    throw Error("This source has already been imported.");
  if (w.documents.length >= 100)
    throw Error("This demo workspace supports up to 100 source documents.");
  const next: Workspace = structuredClone(w);
  // Keep the demonstration warning whenever any fictional source remains.
  next.synthetic =
    next.documents.some((d) => d.mode === "sample") || doc.mode === "sample";
  const exactLot = (code: string | null) =>
    next.lots.filter((l) => l.code === code);
  const lineOf = (quote: string) => {
    const at = doc.text.indexOf(quote);
    if (at < 0)
      throw Error(
        "Each evidence quote must appear in the source text. Review the original record.",
      );
    return doc.text.slice(0, at).split("\n").length;
  };
  const records = inputs.map((r) => recordSchema.parse(r));
  // Review is explicit. Only exact identifiers link; no fuzzy normalization or inferred joins.
  for (const r of records.filter((r) => r.type === "lot")) {
    if (next.lots.some((l) => l.code === r.code))
      throw Error(
        "Lot " +
          r.code +
          " already exists. This version requires unique lot codes within a workspace.",
      );
    next.lots.push({
      id: crypto.randomUUID(),
      code: r.code,
      ingredient: required(r.ingredient, "Ingredient"),
      supplier: required(r.supplier, "Supplier"),
      receivedKg:
        r.receivedKg === null
          ? null
          : positive(r.receivedKg, "Received kilograms"),
      sourceId: doc.id,
      line: lineOf(r.evidence),
    });
  }
  for (const r of records.filter((r) => r.type === "batch")) {
    const existing = next.batches.find((b) => b.code === r.code);
    if (existing?.sourceId)
      throw Error(
        "Batch " +
          r.code +
          " already has a source. Use link review for corrections.",
      );
    const matches = exactLot(r.lotCode);
    const lot = matches.length === 1 ? matches[0] : null;
    if (lot && r.supplier?.trim() && r.supplier.trim() !== lot.supplier)
      throw Error(
        "Supplier identity conflicts with lot " +
          lot.code +
          ". Review the source before linking.",
      );
    if (lot && r.ingredient?.trim() && r.ingredient.trim() !== lot.ingredient)
      throw Error(
        "Ingredient identity conflicts with lot " +
          lot.code +
          ". Review the source before linking.",
      );
    const produced =
      r.producedPacks === null
        ? null
        : positive(r.producedPacks, "Produced packs");
    if (produced !== null && !Number.isSafeInteger(produced))
      throw Error("Produced packs must be a whole number.");
    const b = {
      id: existing?.id || crypto.randomUUID(),
      code: r.code,
      product: required(r.product, "Product"),
      producedPacks: produced,
      usedKg: r.usedKg === null ? null : positive(r.usedKg, "Used kilograms"),
      lotId: lot?.id ?? null,
      rawLotCode: r.lotCode?.trim() || "Not recorded",
      status: lot ? ("confirmed" as const) : ("unresolved" as const),
      sourceId: doc.id,
      line: lineOf(r.evidence),
    };
    if (existing)
      next.batches = next.batches.map((old) =>
        old.id === existing.id ? b : old,
      );
    else next.batches.push(b);
  }
  for (const r of records.filter((r) => r.type === "delivery")) {
    if (next.deliveries.some((d) => d.id === r.code))
      throw Error(
        "Delivery " +
          r.code +
          " already exists. Each dispatch needs a unique reference.",
      );
    let batch = next.batches.find((b) => b.code === r.batchCode);
    const packs = positive(r.packs, "Delivered packs");
    if (!batch && r.batchCode?.trim()) {
      batch = {
        id: crypto.randomUUID(),
        code: r.batchCode.trim(),
        product: "Product not recorded",
        producedPacks: null,
        usedKg: null,
        lotId: null,
        rawLotCode: "No consumption record",
        status: "unresolved",
        sourceId: "",
        line: 0,
      };
      next.batches.push(batch);
    }
    if (!Number.isSafeInteger(packs))
      throw Error("Delivered packs must be a whole number.");
    const date = required(r.date, "Delivery date");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw Error("Use a valid delivery date in YYYY-MM-DD format.");
    next.deliveries.push({
      id: r.code,
      batchId: batch?.id ?? null,
      rawBatchCode: r.batchCode?.trim() || "",
      customer: required(r.customer, "Customer"),
      packs,
      date,
      sourceId: doc.id,
      line: lineOf(r.evidence),
    });
  }
  // Later reviewed batch records may resolve exact identifiers on previously orphaned deliveries.
  next.deliveries = next.deliveries.map((d) =>
    d.batchId
      ? d
      : {
          ...d,
          batchId:
            next.batches.find((b) => b.code === d.rawBatchCode)?.id ?? null,
        },
  );
  for (const b of next.batches) {
    const delivered = next.deliveries
      .filter((d) => d.batchId === b.id)
      .reduce((n, d) => n + d.packs, 0);
    if (b.producedPacks !== null && delivered > b.producedPacks)
      throw Error(
        "Recorded deliveries exceed production for " +
          b.code +
          ". Check quantities or duplicate dispatches.",
      );
  }
  for (const l of next.lots) {
    const used = next.batches
      .filter((b) => b.lotId === l.id)
      .reduce((n, b) => n + (b.usedKg ?? 0), 0);
    if (l.receivedKg !== null && used > l.receivedKg + 0.00001)
      throw Error(
        "Recorded ingredient use exceeds received quantity for " + l.code + ".",
      );
  }
  next.documents.push(doc);
  next.revision++;
  next.audit.unshift({
    id: crypto.randomUUID(),
    at,
    action: "Source records reviewed and imported",
    entity: doc.name,
    before: "Pending review",
    after: records.length + " reviewed record(s)",
    note:
      doc.mode === "ai"
        ? "AI suggestions reviewed against source by operator."
        : "Structured records reviewed by operator.",
  });
  return next;
}
export function parseCsv(text: string): Extraction {
  const rows: string[][] = [],
    rawRows: string[] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      row.push(cell);
      if (row.some((s) => s.trim())) {
        rows.push(row);
        rawRows.push(text.slice(start, i));
      }
      if (c === "\r" && text[i + 1] === "\n") i++;
      start = i + 1;
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("CSV has an unclosed quoted field.");
  row.push(cell);
  if (row.some((s) => s.trim())) {
    rows.push(row);
    rawRows.push(text.slice(start));
  }
  rawRows.shift();
  const header = rows.shift()?.map((h) => h.trim().replace(/^\uFEFF/, ""));
  if (!header?.includes("type") || !header.includes("code"))
    throw Error("Use the CSV template with type and code columns.");
  if (new Set(header).size !== header.length)
    throw Error("CSV contains repeated column names.");
  const numeric = new Set(["receivedKg", "usedKg", "producedPacks", "packs"]);
  const records = rows.map((cells, index) => {
    if (cells.length !== header.length)
      throw Error(
        "CSV row " + (index + 2) + " has the wrong number of columns.",
      );
    const r: Record<string, unknown> = blankRecord();
    header.forEach((key, i) => {
      if (!(key in r)) throw Error("Unknown CSV column: " + key);
      if (key === "evidence") return;
      const value = cells[i].trim();
      r[key] = numeric.has(key)
        ? value
          ? Number(value)
          : null
        : value || null;
    });
    // A CSV record is its own source evidence; preserve its literal data row.
    r.evidence = rawRows[index];
    return recordSchema.parse(r);
  });
  return extractionSchema.parse({ transcript: text, records });
}
export const csvTemplate =
  "type,code,lotCode,batchCode,ingredient,product,supplier,customer,receivedKg,usedKg,producedPacks,packs,date\nlot,DEMO-FL-01,,,Wheat flour,,Synthetic Sample Mill,,60,,,,\nbatch,DEMO-CK-01,DEMO-FL-01,,,Butter cookies,,,,12,200,,\ndelivery,DEMO-DIS-01,,DEMO-CK-01,,,,Synthetic Sample Café,,,,180,2026-09-10\n";
