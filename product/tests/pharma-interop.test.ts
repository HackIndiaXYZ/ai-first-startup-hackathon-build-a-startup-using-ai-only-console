import test from "node:test";
import assert from "node:assert/strict";
import { parseGs1Barcode, validGtin, exportEpcis, previewEpcis, parseTemperatureCsv, temperatureCsvHeader } from "../lib/pharma/interoperability";
import type { PharmaWorkspace, Product, Batch, Movement } from "../lib/pharma/types";

const product: Product = { id: "p1", sku: "P-001", name: "Fictional medicine", genericName: "Example", activeIngredient: "Example", strength: "500 mg", dosageForm: "Tablet", manufacturer: "Fictional manufacturer", baseUnit: "box", units: [{ unit: "box", factor: 1 }], quantityPrecision: 0, packaging: "10 × 10", storage: "Recorded policy", temperatureMin: 2, temperatureMax: 8, archived: false, version: 1 };
const batch: Batch = { id: "b1", productId: "p1", code: "000ABC", originalCode: "000ABC", manufacturer: product.manufacturer, expiry: { value: "2027-12", precision: "month", sourceText: "2027-12" }, held: false };
const movement: Movement = { id: "m1", kind: "receipt", batchId: "b1", productId: "p1", productVersion: 1, quantity: 100, unit: "box", originalQuantity: 100, originalUnit: "box", to: { locationId: "central", status: "available" }, at: "2026-10-03T09:00:00Z", reference: "GRN-001", reason: "Fictional receipt", actor: "Operator" };
function workspace(): PharmaWorkspace { return { schemaVersion: 2, id: "workspace-1", revision: 1, name: "Fictional distributor", synthetic: true, asOf: "2026-10-03", createdAt: "2026-10-03T09:00:00Z", products: [product], batches: [batch], locations: [{ id: "central", name: "Central", warehouse: "Central" }], partners: [], sources: [], movements: [movement], shipments: [], recalls: [], acknowledgments: [], temperatures: [], reports: [], audit: [], appliedActionIds: [] }; }

test("GS1 HRI and raw DataMatrix preserve GTIN, leading zeros, batch and serial", () => {
  const readable = "(01)09506000134352(17)271231(10)000ABC(21)00123";
  const raw = "]d201095060001343521727123110000ABC\u001d2100123\r\n";
  const a = parseGs1Barcode(readable, { century: 2000 });
  const b = parseGs1Barcode(raw, { century: 2000 });
  assert.deepEqual(a.fields, b.fields);
  assert.equal(a.gtin, "09506000134352");
  assert.equal(a.batchCode, "000ABC");
  assert.equal(a.serial, "00123");
  assert.equal(a.expiry?.value, "2027-12-31");
  assert.match(a.notice, /not proof of authenticity/);
  assert.equal(parseGs1Barcode(readable).expiry, undefined);
  assert.match(parseGs1Barcode(readable).notice, /remains unresolved/);
});

test("GS1 rejects check digit errors, unsupported AIs, duplicates and invalid healthcare dates", () => {
  assert.equal(validGtin("09506000134352"), true);
  assert.equal(validGtin("09506000134353"), false);
  for (const value of ["(01)09506000134353", "(01)09506000134352(17)270200", "(01)09506000134352(17)270229", "(01)09506000134352(10)A(10)B", "(01)09506000134352(30)1", "(10)000ABC", "]Q10109506000134352", "(01)09506000134352(21)123456789012345678901"]) assert.throws(() => parseGs1Barcode(value));
  assert.equal(parseGs1Barcode("(01)09506000134352(17)280229", { century: 2000 }).expiry?.value, "2028-02-29");
  assert.throws(() => parseGs1Barcode("(01)09506000134352(17)000229", { century: 2100 }), /valid calendar/);
});

test("EPCIS export is a bounded explicit profile and round-trips to a read-only preview", () => {
  const w = workspace();
  w.movements.push({ ...movement, id: "hold-1", kind: "hold" });
  const result = exportEpcis(w, "2026-10-03T10:00:00Z");
  assert.equal(result.document.schemaVersion, "2.0");
  assert.equal(result.document.epcisBody.eventList[0].action, "OBSERVE");
  assert.equal(result.document.epcisBody.eventList[0].quantityList[0].quantity, 100);
  assert.equal("uom" in result.document.epcisBody.eventList[0].quantityList[0], false);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].id, "hold-1");
  const preview = previewEpcis(JSON.stringify(result.document));
  assert.equal(preview.records[0].productSku, "P-001");
  assert.equal(preview.records[0].batchCode, "000ABC");
  assert.equal(preview.records[0].quantity, 100);
  assert.match(preview.notice, /No stock movements/);
  assert.equal(w.movements.length, 2);
});

test("EPCIS refuses unsupported events, fractional count, duplicate event IDs and external contexts", () => {
  const doc = exportEpcis(workspace(), "2026-10-03T10:00:00Z").document;
  const duplicate = structuredClone(doc);
  duplicate.epcisBody.eventList.push(duplicate.epcisBody.eventList[0]);
  assert.throws(() => previewEpcis(duplicate), /Duplicate/);
  const fractional = structuredClone(doc);
  fractional.epcisBody.eventList[0].quantityList[0].quantity = 0.5;
  assert.throws(() => previewEpcis(fractional), /outside the supported/);
  assert.throws(() => previewEpcis({ ...doc, "@context": "https://untrusted.invalid/context" }), /outside the supported/);
  assert.throws(() => previewEpcis({ ...doc, epcisBody: { eventList: [{ ...doc.epcisBody.eventList[0], type: "AggregationEvent" }] } }), /outside the supported/);
  assert.throws(() => previewEpcis({ ...doc, epcisBody: { eventList: [{ ...doc.epcisBody.eventList[0], unexpected: "never silently discard" }] } }), /outside the supported/);
});

test("temperature CSV preserves source and checks exact product-scoped batch and supplied limits", () => {
  const text = temperatureCsvHeader + "TEMP-001,P-001,000ABC,central,2026-10-03T08:30:00+08:00,5,Fictional logger reading\r\nTEMP-002,P-001,000ABC,central,2026-10-03T08:40:00+08:00,12,Fictional excursion\r\n";
  const result = parseTemperatureCsv(text, workspace());
  assert.equal(result.records[0].policyStatus, "within-range");
  assert.equal(result.records[1].policyStatus, "outside-range");
  assert.equal(result.sourceText, text);
  assert.equal(result.records[0].batchId, "b1");
  assert.ok(text.includes(result.records[0].evidence.quote));
  assert.equal(result.records[0].requiresReview, true);
  assert.match(result.notice, /no medicine safety/);
});

test("temperature validation flags ambiguous identity, missing policy, bad date/unit and duplicates", () => {
  const w = workspace();
  const row = "TEMP-001,P-001,000ABC,central,2026-10-03T08:30:00Z,5,note\r\n";
  const duplicate = parseTemperatureCsv(temperatureCsvHeader + row + row, w);
  assert.match(duplicate.records[1].issues.join(" "), /more than once/);
  for (const altered of [row.replace(",P-001,", ",P-002,"), row.replace("000ABC", "000abc"), row.replace("08:30:00Z", "08:30:00"), row.replace(",5,", ",5 F,"), row.replace("2026-10-03", "2026-02-29")]) {
    assert.equal(parseTemperatureCsv(temperatureCsvHeader + altered, w).records[0].policyStatus, "unresolved");
  }
  w.products[0] = { ...product, temperatureMin: undefined, temperatureMax: undefined };
  assert.equal(parseTemperatureCsv(temperatureCsvHeader + row, w).records[0].policyStatus, "no-policy");
});
