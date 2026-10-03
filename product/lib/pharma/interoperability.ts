import { z } from "zod";
import { readPharmaCsv } from "./intake";
import type { LabelDate, PharmaWorkspace } from "./types";

/** Bounded profiles, based on GS1 AIs and EPCIS 2.0.1 normative artefacts:
 * https://ref.gs1.org/ai/
 * https://ref.gs1.org/standards/epcis/artefacts
 * https://ref.gs1.org/guidelines/2d-in-retail/1.0.0/
 * These utilities decode records; they do not establish product authenticity or regulatory compliance.
 */
export const INTEROPERABILITY_SOURCES = ["https://ref.gs1.org/ai/", "https://ref.gs1.org/standards/epcis/artefacts", "https://ref.gs1.org/guidelines/2d-in-retail/1.0.0/"];
export function validGtin(gtin: string): boolean {
  if (!/^\d{14}$/.test(gtin)) return false;
  const sum = gtin.slice(0, -1).split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === Number(gtin[13]);
}
type SupportedAI = "01" | "10" | "17" | "21";
export type Gs1Preview = {
  original: string;
  gtin: string;
  batchCode?: string;
  serial?: string;
  expiryRaw?: string;
  expiry?: LabelDate;
  fields: Partial<Record<SupportedAI, string>>;
  notice: string;
};

export function parseGs1Barcode(input: string, options: { century?: number } = {}): Gs1Preview {
  if (!input || input.length > 512) throw Error("Use a GS1 scanner value of 1–512 characters.");
  if (options.century !== undefined && ![1900, 2000, 2100].includes(options.century)) throw Error("Choose an explicit century: 1900, 2000 or 2100.");
  let text = input.replace(/[\r\n]+$/, "");
  if (text.startsWith("]d2") || text.startsWith("]C1")) text = text.slice(3);
  else if (text.startsWith("]")) throw Error("This scanner symbology is unsupported. Use GS1 DataMatrix or GS1-128 data.");
  if (text.startsWith("\u001d")) text = text.slice(1);
  const fields: Partial<Record<SupportedAI, string>> = {};
  const add = (ai: string, value: string) => {
    if (!["01", "10", "17", "21"].includes(ai)) throw Error(`Application identifier ${ai} is outside this profile (01, 10, 17, 21). No fields were guessed.`);
    const key = ai as SupportedAI;
    if (fields[key] !== undefined) throw Error(`Application identifier ${ai} occurs more than once.`);
    if (ai === "01" && !validGtin(value)) throw Error("The 14-digit GTIN is incomplete or its check digit does not match.");
    if (ai === "17" && !/^\d{6}$/.test(value)) throw Error("GS1 expiry must contain exactly six digits (YYMMDD).");
    if (["10", "21"].includes(ai) && !/^[A-Za-z0-9._/\-]{1,20}$/.test(value)) throw Error("This profile supports 1–20 letters, digits, dots, underscores, slashes or hyphens for batch/serial identifiers. Other GS1 characters require a broader decoder.");
    fields[key] = value;
  };
  if (text.startsWith("(")) {
    let offset = 0;
    while (offset < text.length) {
      const ai = /^\((\d{2,4})\)/.exec(text.slice(offset));
      if (!ai) throw Error("The readable GS1 value has an invalid application identifier.");
      offset += ai[0].length;
      const next = text.indexOf("(", offset);
      const end = next < 0 ? text.length : next;
      add(ai[1], text.slice(offset, end));
      offset = end;
    }
  } else {
    let offset = 0;
    while (offset < text.length) {
      if (text[offset] === "\u001d") throw Error("Unexpected or repeated GS separator.");
      const ai = text.slice(offset, offset + 2);
      offset += 2;
      if (ai === "01" || ai === "17") {
        const size = ai === "01" ? 14 : 6;
        add(ai, text.slice(offset, offset + size)); offset += size;
      } else if (ai === "10" || ai === "21") {
        const end = text.indexOf("\u001d", offset);
        add(ai, text.slice(offset, end < 0 ? text.length : end));
        offset = end < 0 ? text.length : end;
      } else throw Error(`Application identifier ${ai} is unsupported. Variable-length fields need a GS separator before the next identifier.`);
      if (text[offset] === "\u001d") offset++;
    }
  }
  if (!fields["01"]) throw Error("This profile requires the product GTIN in application identifier 01.");
  let expiry: LabelDate | undefined;
  if (fields["17"]) {
    const raw = fields["17"], yy = Number(raw.slice(0, 2)), month = Number(raw.slice(2, 4)), day = Number(raw.slice(4));
    if (!day) throw Error("A pharmaceutical GS1 expiry requires a valid day; day 00 is unsupported. Preserve a printed month-only date through document intake.");
    // Validate the actual calendar date in the selected century; 2000 is used only for structural checking when unresolved.
    const year = (options.century ?? 2000) + yy;
    const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw Error("The encoded expiry is not a valid calendar date.");
    if (options.century !== undefined) expiry = { value, precision: "day", sourceText: raw };
  }
  return {
    original: input, gtin: fields["01"], batchCode: fields["10"], serial: fields["21"], expiryRaw: fields["17"], expiry, fields,
    notice: `Decoded identifiers require catalogue review. A readable barcode is not proof of authenticity.${fields["17"] && options.century === undefined ? " The two-digit expiry year remains unresolved until a century is selected." : fields["17"] ? ` Expiry uses the explicitly selected ${options.century}–${options.century! + 99} century.` : ""}`,
  };
}

export function lookupGs1Barcode(input: string, workspace: Pick<PharmaWorkspace, "products" | "batches">, options: { century?: number } = {}): {
  decoded: Gs1Preview; productIds: string[]; batchIds: string[]; issues: string[]; exact: boolean;
} {
  const decoded = parseGs1Barcode(input, options);
  const products = workspace.products.filter((product) => product.gtin === decoded.gtin && !product.archived);
  const issues: string[] = [];
  if (products.length !== 1) issues.push("The decoded GTIN must identify exactly one active catalogue product.");
  if (!decoded.batchCode) issues.push("A product batch was not encoded; select it explicitly before changing stock.");
  const batches = products.length === 1 && decoded.batchCode ? workspace.batches.filter((batch) => batch.productId === products[0].id && batch.code === decoded.batchCode) : [];
  if (decoded.batchCode && batches.length !== 1) issues.push("No unique batch matches this GTIN and exact batch code. Similar batch identifiers were not linked.");
  if (batches.length === 1 && decoded.expiryRaw) {
    const label = batches[0].expiry;
    if (label.precision !== "day") issues.push("The catalogue expiry has month precision; compare the barcode day with its original label before correction.");
    else if (label.value.replace(/-/g, "").slice(2) !== decoded.expiryRaw || (decoded.expiry && decoded.expiry.value !== label.value)) issues.push("The encoded expiry differs from the catalogue batch expiry.");
  }
  if (batches.length === 1 && decoded.serial && !batches[0].serials?.includes(decoded.serial)) issues.push("This serial is not registered under the matched batch. Decoding a serial does not establish its authenticity.");
  return { decoded, productIds: products.map((product) => product.id), batchIds: batches.map((batch) => batch.id), issues, exact: !issues.length };
}

export const EPCIS_PROFILE = "RecallScope EPCIS 2.0 / ObjectEvent quantity-count profile v1";
export const EPCIS_CONTEXT = "https://ref.gs1.org/standards/epcis/2.0.1/epcis-context.jsonld";
const namespace = "https://recallscope.console3096.chatgpt.site/vocab/";
const identifier = (workspace: string, kind: string, id: string) => `urn:recallscope:${encodeURIComponent(workspace)}:${kind}:${encodeURIComponent(id)}`;
const isoTime = z.string().datetime({ offset: true }).refine((value) => {
  const day = value.slice(0, 10), parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day;
}, "Use a valid calendar timestamp with UTC or an explicit offset.");
const uri = z.string().max(1500).refine((value) => /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]+$/.test(value), "Use an absolute URI.");
const qty = z.object({ epcClass: uri, quantity: z.number().int().positive().max(100_000_000) }).strict();
const eventSchema = z.object({
  type: z.literal("ObjectEvent"), eventID: uri, eventTime: isoTime, eventTimeZoneOffset: z.string().regex(/^[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/),
  action: z.literal("OBSERVE"), bizStep: z.enum(["receiving", "shipping", "https://ref.gs1.org/cbv/BizStep-receiving", "https://ref.gs1.org/cbv/BizStep-shipping"]),
  quantityList: z.array(qty).min(1).max(100), readPoint: z.object({ id: uri }).strict(),
  "recallscope:movementKind": z.enum(["receipt", "dispatch", "return", "transfer-out", "transfer-in"]).optional(),
  "recallscope:reference": z.string().max(250).optional(), "recallscope:productSku": z.string().max(250).optional(),
  "recallscope:batchCode": z.string().max(250).optional(), "recallscope:unit": z.string().max(250).optional(),
  "recallscope:locationId": z.string().max(250).optional(), "recallscope:partnerId": z.string().max(250).optional(),
}).strict();
const epcisSchema = z.object({
  "@context": z.union([
    z.enum([EPCIS_CONTEXT, "https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"]),
    z.tuple([z.literal(EPCIS_CONTEXT), z.object({ recallscope: z.literal(namespace) }).strict()]),
  ]), type: z.literal("EPCISDocument"), schemaVersion: z.literal("2.0"), creationDate: isoTime,
  epcisBody: z.object({ eventList: z.array(eventSchema).max(10_000) }).strict(),
}).strict();
export type EpcisDocument = z.infer<typeof epcisSchema>;

export function exportEpcis(workspace: PharmaWorkspace, creationDate = new Date().toISOString()): { document: EpcisDocument; excluded: { id: string; kind: string; reason: string }[]; profile: string; notice: string } {
  const eventList: EpcisDocument["epcisBody"]["eventList"] = [];
  const excluded: { id: string; kind: string; reason: string }[] = [];
  for (const movement of workspace.movements) {
    if (!["receipt", "dispatch", "return", "transfer-out", "transfer-in"].includes(movement.kind)) {
      excluded.push({ id: movement.id, kind: movement.kind, reason: "Internal stock/status event outside the declared EPCIS exchange profile." }); continue;
    }
    const product = workspace.products.find((item) => item.id === movement.productId);
    const batch = workspace.batches.find((item) => item.id === movement.batchId);
    const locationId = movement.kind === "dispatch" || movement.kind === "transfer-out" ? movement.from?.locationId : movement.to?.locationId;
    if (!product || !batch || !locationId || !Number.isInteger(movement.quantity) || movement.quantity <= 0) {
      excluded.push({ id: movement.id, kind: movement.kind, reason: "This count profile requires a known product, batch, location and positive integer base-unit quantity." }); continue;
    }
    eventList.push({
      type: "ObjectEvent", eventID: identifier(workspace.id, "event", movement.id), eventTime: movement.at,
      eventTimeZoneOffset: movement.at.endsWith("Z") ? "+00:00" : movement.at.slice(-6), action: "OBSERVE", bizStep: ["dispatch", "transfer-out"].includes(movement.kind) ? "shipping" : "receiving",
      quantityList: [{ epcClass: identifier(workspace.id, "batch", `${batch.id}:${movement.unit}`), quantity: movement.quantity }],
      readPoint: { id: identifier(workspace.id, "location", locationId) },
      "recallscope:movementKind": movement.kind as "receipt" | "dispatch" | "return" | "transfer-out" | "transfer-in",
      "recallscope:reference": movement.reference, "recallscope:productSku": product.sku,
      "recallscope:batchCode": batch.code, "recallscope:unit": movement.unit,
      "recallscope:locationId": locationId, ...(movement.partnerId ? { "recallscope:partnerId": movement.partnerId } : {}),
    });
  }
  const document = epcisSchema.parse({ "@context": [EPCIS_CONTEXT, { recallscope: namespace }], type: "EPCISDocument", schemaVersion: "2.0", creationDate, epcisBody: { eventList } });
  return { document, excluded, profile: EPCIS_PROFILE, notice: "Exports recorded distribution observations using workspace-scoped class identifiers. It does not claim GS1 identifier allocation, serial-level traceability, a complete EPCIS repository or regulatory certification. Excluded internal events remain in the full workspace export." };
}

export function previewEpcis(input: string | unknown): { document: EpcisDocument; records: { eventId: string; eventTime: string; kind: string; reference: string; productSku: string; batchCode: string; quantity: number; unit: string; locationId: string; epcClass: string; issues: string[] }[]; profile: string; notice: string } {
  if (typeof input === "string" && input.length > 5_000_000) throw Error("Use an EPCIS document under 5 MB.");
  let document: EpcisDocument;
  try { document = epcisSchema.parse(typeof input === "string" ? JSON.parse(input) : input); }
  catch { throw Error("This document is outside the supported EPCIS 2.0 ObjectEvent OBSERVE count profile. Use receipt/shipping events with timestamps, read points and positive integer quantityList values; unsupported fields and event kinds are not discarded."); }
  const seen = new Set<string>();
  const records = document.epcisBody.eventList.flatMap((event) => {
    if (seen.has(event.eventID)) throw Error("Duplicate EPCIS event IDs require reconciliation before import.");
    seen.add(event.eventID);
    return event.quantityList.map((quantity) => ({
      eventId: event.eventID, eventTime: event.eventTime, kind: event["recallscope:movementKind"] || event.bizStep,
      reference: event["recallscope:reference"] || "", productSku: event["recallscope:productSku"] || "",
      batchCode: event["recallscope:batchCode"] || "", quantity: quantity.quantity, unit: event["recallscope:unit"] || "",
      locationId: event["recallscope:locationId"] || "", epcClass: quantity.epcClass,
      issues: ["External identifiers require an explicit catalogue mapping and operator review before posting."],
    }));
  });
  return { document, records, profile: EPCIS_PROFILE, notice: "Validated preview only. No stock movements were posted. JSON-LD contexts are not fetched or executed; this is the declared subset, not full EPCIS certification." };
}

export const temperatureCsvHeader = "reference,productSku,batchCode,locationId,observedAt,celsius,note\r\n";
export type TemperatureProposal = { reference: string; productSku: string; batchCode: string; locationId: string; observedAt: string; celsius: number | null; note: string; batchId?: string; evidence: { line: number; quote: string }; issues: string[]; policyStatus: "within-range" | "outside-range" | "no-policy" | "unresolved"; requiresReview: true };
export function parseTemperatureCsv(text: string, workspace: Pick<PharmaWorkspace, "products" | "batches" | "locations">): { records: TemperatureProposal[]; sourceText: string; notice: string } {
  const rows = readPharmaCsv(text), headers = rows[0].cells;
  const fields = temperatureCsvHeader.trim().split(",");
  if (headers.length !== fields.length || headers.some((field, index) => field !== fields[index])) throw Error("Use the temperature CSV columns in the supplied template order.");
  const seen = new Set<string>();
  const records = rows.slice(1).map((row): TemperatureProposal => {
    if (row.cells.length !== fields.length) throw Error(`Temperature row ${row.line} does not match the CSV header.`);
    const [reference, productSku, batchCode, locationId, observedAt, rawCelsius, note] = row.cells;
    const issues: string[] = [];
    if (!reference || reference.length > 250) issues.push("Supply a bounded observation reference.");
    if (seen.has(reference)) issues.push("Observation reference occurs more than once in this file.");
    seen.add(reference);
    if (!isoTime.safeParse(observedAt).success) issues.push("Observation time needs a valid timestamp with a timezone.");
    const celsius = /^-?(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(rawCelsius) && Number(rawCelsius) >= -273.15 && Number(rawCelsius) <= 1000 ? Number(rawCelsius) : null;
    if (celsius === null) issues.push("Use an explicit Celsius number between −273.15 and 1000; no unit conversion is inferred.");
    if (note.length > 1500) issues.push("The observation note is too long.");
    const products = workspace.products.filter((product) => product.sku === productSku && !product.archived);
    const batches = products.length === 1 ? workspace.batches.filter((batch) => batch.productId === products[0].id && batch.code === batchCode) : [];
    if (batches.length !== 1) issues.push("Match the exact product SKU and its batch before posting.");
    if (!workspace.locations.some((location) => location.id === locationId && !location.archived)) issues.push("Match an existing location identifier.");
    const product = products[0];
    let policyStatus: TemperatureProposal["policyStatus"] = "unresolved";
    if (!issues.length && product && celsius !== null) {
      policyStatus = product.temperatureMin === undefined || product.temperatureMax === undefined ? "no-policy" : celsius < product.temperatureMin || celsius > product.temperatureMax ? "outside-range" : "within-range";
    }
    return { reference, productSku, batchCode, locationId, observedAt, celsius, note, batchId: batches.length === 1 ? batches[0].id : undefined, evidence: { line: row.line, quote: row.quote }, issues, policyStatus, requiresReview: true };
  });
  return { records, sourceText: text, notice: "Recorded Celsius observations are compared only with explicitly configured product limits. Review exceptions; no medicine safety or disposition decision is inferred." };
}
