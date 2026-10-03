import { z } from "zod";
import type { PharmaWorkspace } from "./types";

export const intakeKinds = ["receipt", "dispatch", "return", "recall"] as const;
export type IntakeKind = (typeof intakeKinds)[number];
export const intakeFields = [
  "reference", "date", "productSku", "productName", "strength", "dosageForm",
  "manufacturer", "batchCode", "expiry", "quantity", "unit", "partnerCode",
  "partnerName", "locationCode", "toLocationCode", "dispatchReference", "reason",
] as const;
export type IntakeField = (typeof intakeFields)[number];
export type IntakeRaw = Record<IntakeField, string>;
export type IntakeValues = Omit<IntakeRaw, "quantity"> & { quantity: number | null };
export type IntakeColumnMap = Partial<Record<IntakeField, string>>;
export type IntakeIssue = {
  field: IntakeField | "row" | "evidence";
  code: string;
  message: string;
  severity: "error" | "warning";
};
export type IntakeProposal = {
  id: string;
  kind: IntakeKind;
  raw: IntakeRaw;
  values: IntakeValues;
  evidence: { quote: string; line: number; page: number | null };
  issues: IntakeIssue[];
  status: "ready" | "attention";
  requiresReview: true;
};
export type IntakePreview = {
  mode: "csv" | "guided" | "ai";
  notice: string;
  source: { name: string; text: string; textOrigin: "original" | "model-transcript"; synthetic: boolean };
  headers: string[];
  columnMap: IntakeColumnMap;
  records: IntakeProposal[];
  issues: string[];
  canReview: boolean;
  provider?: "fireworks" | "openai";
  model?: string;
};

export const GUIDED_NOTICE = "Guided example — pre-filled records; no AI request is made.";
export const CSV_NOTICE = "Structured import — columns are read directly; no AI request is made. Review records before posting.";
export const AI_NOTICE = "AI-assisted extraction — proposed records require your review before posting.";
export const MAX_INTAKE_ROWS = 200;
export const MAX_INTAKE_TEXT = 250_000;
export const MAX_AI_ROWS = 60;

export function blankIntakeRaw(): IntakeRaw {
  return Object.fromEntries(intakeFields.map((field) => [field, ""])) as IntakeRaw;
}

type CsvRow = { cells: string[]; line: number; quote: string };

// Preserve each complete original row, including quoted newlines, for evidence.
export function readPharmaCsv(text: string): CsvRow[] {
  if (!text.trim()) throw Error("Choose a non-empty CSV file or paste its contents.");
  if (text.length > MAX_INTAKE_TEXT) throw Error("Use a CSV document under 250,000 characters.");
  if (text.includes("\0")) throw Error("The CSV contains unsupported binary data.");
  const rows: CsvRow[] = [];
  let cells: string[] = [], cell = "", quoted = false, closed = false;
  let line = 1, rowLine = 1, start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const first = start;
  const finish = (end: number) => {
    cells.push(cell);
    const quote = text.slice(start, end);
    if (cells.some((value) => value.trim())) rows.push({ cells, line: rowLine, quote });
    if (rows.length > MAX_INTAKE_ROWS + 1) throw Error("Split this document into files of at most 200 records; no rows were omitted.");
    cells = []; cell = ""; closed = false;
  };
  for (let index = first; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closed = true; }
      } else {
        cell += char;
        if (char === "\n" || (char === "\r" && text[index + 1] !== "\n")) line++;
      }
      continue;
    }
    if (char === '"') {
      if (cell || closed) throw Error(`Unexpected quote at CSV line ${line}. Quote the whole field and double embedded quotes.`);
      quoted = true;
    } else if (char === ",") {
      cells.push(cell); cell = ""; closed = false;
    } else if (char === "\n" || char === "\r") {
      finish(index);
      if (char === "\r" && text[index + 1] === "\n") index++;
      line++; rowLine = line; start = index + 1;
    } else {
      if (closed) throw Error(`Unexpected text after a closing quote at CSV line ${line}.`);
      cell += char;
    }
  }
  if (quoted) throw Error("A CSV field has an unclosed quote. No records were added.");
  if (start < text.length) finish(text.length);
  if (!rows.length) throw Error("The CSV contains no fields.");
  return rows;
}

function realDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateIntakeProposal(
  kind: IntakeKind,
  raw: IntakeRaw,
  evidence: IntakeProposal["evidence"],
  id = `row-${evidence.line}`,
): IntakeProposal {
  if (!intakeKinds.includes(kind)) throw Error("Choose a supported pharmaceutical document type.");
  const values = Object.fromEntries(intakeFields.map((field) => [field, String(raw[field] ?? "").trim()])) as unknown as IntakeValues;
  const issues: IntakeIssue[] = [];
  const error = (field: IntakeIssue["field"], code: string, message: string) => issues.push({ field, code, message, severity: "error" });
  const required: IntakeField[] = ["reference", "date", "productSku", "batchCode"];
  if (kind !== "recall") required.push("quantity", "unit", "partnerCode", "locationCode");
  if (kind === "return") required.push("dispatchReference");
  if (kind === "recall") required.push("reason");
  if (kind === "receipt") required.push("expiry");
  for (const field of required) if (!raw[field]?.trim()) error(field, "required", `${field} is required; copy the value from the source or supply an explicit reviewed correction.`);
  for (const field of intakeFields) {
    if (typeof raw[field] !== "string" || raw[field].length > (field === "reason" ? 1500 : 250)) error(field, "length", `${field} is too long or unsupported.`);
  }
  if (values.date && !realDay(values.date)) error("date", "date", "Use an unambiguous date in YYYY-MM-DD format. No date has been guessed.");
  if (values.expiry && !realDay(values.expiry) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.expiry)) error("expiry", "expiry", "Expiry must be YYYY-MM or a valid YYYY-MM-DD. Preserve month-only precision.");
  if (values.toLocationCode) error("toLocationCode", "unsupported-movement", "This intake profile supports receipts, customer dispatches, returns and recall notices. Use the stock transfer workflow for a second warehouse location; the field cannot be silently dropped.");
  const quantityText = String(values.quantity);
  values.quantity = quantityText && /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(quantityText) ? Number(quantityText) : null;
  if (quantityText && (values.quantity === null || values.quantity <= 0 || values.quantity > 100_000_000)) {
    error("quantity", "quantity", "Quantity must be a positive number up to 100,000,000, without unit text, grouping commas or more than six decimal places.");
    values.quantity = null;
  }
  if (!evidence.quote.trim() || !Number.isInteger(evidence.line) || evidence.line < 1) error("evidence", "evidence", "An exact source quote and original line are required.");
  return { id, kind, raw: { ...raw }, values, evidence: { ...evidence }, issues, status: issues.some((issue) => issue.severity === "error") ? "attention" : "ready", requiresReview: true };
}

function markDuplicates(records: IntakeProposal[]): void {
  const seen = new Map<string, IntakeProposal>();
  for (const row of records) {
    const key = JSON.stringify([row.kind, ...intakeFields.map((field) => row.values[field])]);
    const previous = seen.get(key);
    if (previous) {
      row.issues.push({ field: "row", code: "duplicate", severity: "error", message: `This repeats the record at source line ${previous.evidence.line}. Resolve the duplicate before posting.` });
      row.status = "attention";
    } else seen.set(key, row);
  }
}

export function parsePharmaCsv(text: string, options: {
  kind: IntakeKind;
  columnMap?: IntakeColumnMap;
  sourceName?: string;
  synthetic?: boolean;
}): IntakePreview {
  const rows = readPharmaCsv(text);
  const headers = rows[0].cells.map((header) => header.trim());
  if (headers.some((header) => !header)) throw Error("Every CSV column needs a non-empty header.");
  if (new Set(headers).size !== headers.length) throw Error("CSV headers must be unique before mapping columns.");
  if (headers.length > 80) throw Error("Use at most 80 CSV columns.");
  const columnMap: IntakeColumnMap = {};
  for (const field of intakeFields) {
    const mapped = options.columnMap?.[field];
    if (mapped !== undefined && !headers.includes(mapped)) throw Error(`The mapped column for ${field} does not exist in this CSV.`);
    if (mapped !== undefined) columnMap[field] = mapped;
    else if (headers.includes(field)) columnMap[field] = field;
  }
  const chosen = Object.values(columnMap);
  if (new Set(chosen).size !== chosen.length) throw Error("Map each source column to only one field.");
  const issues: string[] = [];
  if (rows.length === 1) issues.push("The CSV has headers but no records. Add source rows to preview them.");
  const unmapped = headers.filter((header) => !chosen.includes(header));
  if (unmapped.length) issues.push(`Unmapped columns remain in the source: ${unmapped.join(", ")}. Map any required record fields before posting.`);
  const records = rows.slice(1).map((row) => {
    if (row.cells.length !== headers.length) throw Error(`CSV line ${row.line} has ${row.cells.length} fields; its header has ${headers.length}. No rows were omitted.`);
    const raw = blankIntakeRaw();
    for (const field of intakeFields) if (columnMap[field]) raw[field] = row.cells[headers.indexOf(columnMap[field]!)];
    return validateIntakeProposal(options.kind, raw, { quote: row.quote, line: row.line, page: null });
  });
  markDuplicates(records);
  return { mode: "csv", notice: CSV_NOTICE, source: { name: options.sourceName || "Structured records.csv", text, textOrigin: "original", synthetic: options.synthetic === true }, headers, columnMap, records, issues, canReview: records.length > 0 };
}

const rawShape = Object.fromEntries(intakeFields.map((field) => [field, z.string().max(field === "reason" ? 1500 : 250)])) as Record<IntakeField, z.ZodString>;
export const pharmaAIRecordSchema = z.object({
  kind: z.enum(intakeKinds),
  fields: z.object(rawShape).strict(),
  evidence: z.string().min(1).max(8000),
  page: z.number().int().min(1).max(6).nullable(),
}).strict();
export const pharmaExtractionSchema = z.object({
  transcript: z.string().min(1).max(MAX_INTAKE_TEXT),
  records: z.array(pharmaAIRecordSchema).min(1).max(MAX_AI_ROWS),
}).strict();
export type PharmaExtraction = z.infer<typeof pharmaExtractionSchema>;

export function previewPharmaExtraction(extraction: unknown, options: {
  sourceName: string;
  originalText?: string;
  pageCount?: number;
  provider: "fireworks" | "openai";
  model: string;
}): IntakePreview {
  const parsed = pharmaExtractionSchema.parse(extraction);
  const text = options.originalText ?? parsed.transcript;
  const records = parsed.records.map((record, index) => {
    const offset = text.indexOf(record.evidence);
    if (offset < 0) throw Error("A proposed evidence quote does not occur in the source. No records were added.");
    if (record.page !== null && (!options.pageCount || record.page > options.pageCount)) throw Error("The result cites a document page that was not supplied.");
    const raw = record.fields as IntakeRaw;
    const row = validateIntakeProposal(record.kind, raw, { quote: record.evidence, line: text.slice(0, offset).split(/\r\n|\n|\r/).length, page: record.page }, `proposal-${index + 1}`);
    for (const field of intakeFields) {
      if (raw[field] && !record.evidence.includes(raw[field])) {
        row.issues.push({ field, code: "unsupported-evidence", severity: "error", message: `${field} is not an exact value in the cited evidence. Review the original document and record any correction explicitly.` });
        row.status = "attention";
      }
    }
    return row;
  });
  markDuplicates(records);
  return { mode: "ai", notice: AI_NOTICE, source: { name: options.sourceName, text, textOrigin: options.originalText === undefined ? "model-transcript" : "original", synthetic: false }, headers: [], columnMap: {}, records, issues: options.originalText === undefined ? ["Page text was transcribed by the model. Compare the cited text with the original document before approval."] : [], canReview: true, provider: options.provider, model: options.model };
}

export function csvCell(value: string): string {
  // Spreadsheet exports escape formulas; imported original text is never rewritten.
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function intakeCsv(kind: IntakeKind, records: Partial<IntakeRaw>[] = []): string {
  const fields: IntakeField[] = ["reference", "date", "productSku", "productName", "strength", "dosageForm", "manufacturer", "batchCode", "expiry"];
  if (kind !== "recall") fields.push("quantity", "unit", "partnerCode", "partnerName", "locationCode");
  if (kind === "return") fields.push("dispatchReference");
  fields.push("reason");
  return [fields.join(","), ...records.map((record) => fields.map((field) => csvCell(record[field] || "")).join(","))].join("\r\n") + "\r\n";
}

export type IntakeMatch = {
  productId?: string; batchId?: string; partnerId?: string; locationId?: string; shipmentId?: string;
  issues: IntakeIssue[];
  exact: boolean;
};

/** Exact catalogue links are suggestions for review; this function never posts records. */
export function matchPharmaIntake(row: IntakeProposal, workspace: Pick<PharmaWorkspace, "products" | "batches" | "partners" | "locations" | "shipments">): IntakeMatch {
  const match: IntakeMatch = { issues: [], exact: false };
  const issue = (field: IntakeIssue["field"], message: string) => match.issues.push({ field, code: "catalogue-match", message, severity: "error" });
  const value = row.values;
  const products = workspace.products.filter((product) => product.sku === value.productSku && !product.archived);
  if (products.length !== 1) issue("productSku", "Choose the exact product SKU from the catalogue. Similar names or identifiers are not linked automatically.");
  else {
    const product = products[0];
    match.productId = product.id;
    for (const field of ["strength", "dosageForm", "manufacturer"] as const) {
      if (value[field] && value[field] !== product[field]) issue(field, `The printed ${field} differs from the selected catalogue product. Record an explicit correction or choose the correct product.`);
    }
    if (value.productName && value.productName !== product.name) issue("productName", "The printed product name differs from this catalogue product. Confirm the identity explicitly.");
    const batches = workspace.batches.filter((batch) => batch.productId === product.id && batch.code === value.batchCode);
    if (batches.length !== 1) issue("batchCode", "Choose or create the exact batch under this product; batch codes from another product are never linked.");
    else {
      match.batchId = batches[0].id;
      if (value.expiry && value.expiry !== batches[0].expiry.value) issue("expiry", "The printed expiry differs from the catalogue batch. Review its source before posting.");
    }
    if (row.kind !== "recall" && value.unit !== product.baseUnit && !product.units.some((unit) => unit.unit === value.unit)) issue("unit", "This unit has no explicit conversion for the selected product. Set its packaging conversion before posting.");
  }
  if (row.kind !== "recall") {
    const partners = workspace.partners.filter((partner) => partner.id === value.partnerCode && !partner.archived);
    if (partners.length !== 1) issue("partnerCode", "Choose the exact supplier or customer identifier from the trading partner directory.");
    else {
      match.partnerId = partners[0].id;
      if (row.kind === "receipt" && partners[0].kind !== "supplier") issue("partnerCode", "A goods receipt must identify a supplier.");
      if (row.kind !== "receipt" && partners[0].kind === "supplier") issue("partnerCode", "This record requires a customer or distributor partner.");
      if (value.partnerName && value.partnerName !== partners[0].name) issue("partnerName", "The source partner name differs from this directory entry. Confirm the identity explicitly.");
    }
    const locations = workspace.locations.filter((location) => location.id === value.locationCode && !location.archived);
    if (locations.length !== 1) issue("locationCode", "Choose the exact warehouse location identifier. No location has been inferred.");
    else match.locationId = locations[0].id;
  }
  if (row.kind === "return") {
    const shipments = workspace.shipments.filter((shipment) => shipment.reference === value.dispatchReference && shipment.batchId === match.batchId && shipment.partnerId === match.partnerId && shipment.status !== "cancelled");
    if (shipments.length !== 1) issue("dispatchReference", "Choose one original dispatch matching this product batch and customer. Ambiguous references require review.");
    else match.shipmentId = shipments[0].id;
  }
  match.exact = match.issues.length === 0 && row.status === "ready";
  return match;
}
