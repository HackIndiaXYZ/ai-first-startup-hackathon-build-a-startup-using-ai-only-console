import test from "node:test";
import assert from "node:assert/strict";
import { sampleWorkspace } from "../lib/sample";
import {
  traceLot,
  resolveBatch,
  createReport,
  type SourceDocument,
} from "../lib/domain";
import {
  parseCsv,
  csvTemplate,
  importRecords,
  blankRecord,
} from "../lib/import-records";
import { extractWithAI } from "../lib/ai-extract";
import { resolveDelivery } from "../lib/resolve-delivery";
import { comparePreviousReport } from "../lib/report-comparison";

test("delivery decisions survive later ingredient resolution in report evidence", () => {
  const initial = sampleWorkspace();
  const delivery = initial.deliveries.find((d) => d.batchId === "batch-03")!;
  delivery.batchId = null;
  delivery.rawBatchCode = "UNREADABLE";
  const linked = resolveDelivery(
    initial,
    delivery.id,
    "batch-03",
    "Dispatch signature verified against production register.",
    at,
    "dispatch-review",
  );
  assert.equal(linked.audit[0].afterLotId, null);
  const unresolvedReport = createReport(linked, "lot-a", at, "unresolved");
  assert.match(unresolvedReport.content, /Dispatch signature verified/);
  const resolved = resolveBatch(
    linked,
    "batch-03",
    "lot-a",
    "Ingredient verified against the synthetic supplier receipt.",
    at,
    "ingredient-review",
  );
  const report = createReport(resolved, "lot-a", at, "resolved");
  assert.match(report.content, /Dispatch signature verified/);
  assert.match(report.content, /Ingredient verified against/);
  assert.equal(report.confirmedPacks, 1080);
  assert.equal(report.unresolvedPacks, 360);
  assert.equal(
    resolved.deliveries.find((d) => d.id === delivery.id)!.rawBatchCode,
    "UNREADABLE",
  );
});

test("report comparison uses the nearest earlier snapshot of the same lot and preserves sources", () => {
  const initial = sampleWorkspace();
  const before = createReport(
    initial,
    "lot-a",
    "2026-09-12T09:00:00Z",
    "before",
  );
  const revised = resolveBatch(
    initial,
    "batch-03",
    "lot-a",
    "Verified the synthetic invoice and O/0 code.",
    "2026-09-12T10:00:00Z",
    "decision",
  );
  revised.revision = before.revision + 2;
  const after = createReport(revised, "lot-a", "2026-09-12T10:00:00Z", "after");
  const other = {
    ...before,
    id: "other",
    lotCode: "DIFFERENT",
    revision: after.revision - 1,
    confirmedPacks: 9999,
  };
  const older = {
    ...before,
    id: "oldest",
    revision: before.revision - 1,
    confirmedPacks: 1,
  };
  const snapshots = [other, after, older, before];
  const unchanged = JSON.stringify(snapshots);
  const result = comparePreviousReport(after, snapshots)!;
  assert.equal(result.previous.id, "before");
  assert.equal(result.confirmedChange, 360);
  assert.equal(result.unresolvedChange, -360);
  assert.deepEqual(result.addedCustomers, ["Harbor Grocer"]);
  assert.deepEqual(result.removedCustomers, []);
  assert.equal(comparePreviousReport(older, snapshots), null);
  assert.equal(JSON.stringify(snapshots), unchanged);
  const reversed = comparePreviousReport(
    { ...before, revision: after.revision + 1 },
    snapshots,
  )!;
  assert.deepEqual(reversed.removedCustomers, ["Harbor Grocer"]);
  assert.equal(reversed.confirmedChange, -360);
});
test("missing receipt or production quantity remains explicit after import", () => {
  const x = parseCsv(csvTemplate);
  x.records[0].receivedKg = null;
  x.records[1].usedKg = null;
  x.records[1].producedPacks = null;
  const w = importRecords(empty(), doc(x.transcript), x.records, at);
  const t = traceLot(w, w.lots[0].id);
  assert.equal(t.confirmedPacks, 180);
  assert.equal(t.usedKg, null);
  assert.equal(t.remainingPacks, null);
  assert.equal(w.lots[0].receivedKg, null);
});
const at = "2026-09-12T10:00:00.000Z";
const corrected = () =>
  resolveBatch(
    sampleWorkspace(),
    "batch-03",
    "lot-a",
    "Compared the synthetic invoice and batch sheet; O/0 verified.",
    at,
    "test-decision",
  );
test("sample has reproducible target scope and unresolved exposure", () => {
  const t = traceLot(sampleWorkspace(), "lot-a");
  assert.equal(t.confirmedPacks, 720);
  assert.equal(t.unresolvedPacks, 720);
  assert.equal(t.customers.length, 2);
  assert.equal(t.usedKg, 48);
  assert.equal(t.remainingPacks, 80);
});
test("source-backed correction changes confirmed scope without rewriting original evidence", () => {
  const w = sampleWorkspace(),
    before = JSON.stringify(w);
  const next = resolveBatch(
    w,
    "batch-03",
    "lot-a",
    "Verified the synthetic O/0 identifier against invoice NF-1042.",
    at,
    "event",
  );
  const t = traceLot(next, "lot-a");
  assert.equal(t.confirmedPacks, 1080);
  assert.equal(t.unresolvedPacks, 360);
  assert.equal(t.customers.length, 3);
  assert.equal(JSON.stringify(w), before);
  assert.equal(next.batches[2].rawLotCode, "FL-2609O1-A");
  assert.equal(next.audit[0].sourceId, "production-03");
});
test("missing production evidence cannot be resolved by a note", () =>
  assert.throws(
    () =>
      resolveBatch(
        sampleWorkspace(),
        "batch-04",
        "lot-a",
        "Assume the same lot from the date.",
        at,
        "e",
      ),
    /Upload a production record/,
  ));
test("short or absent review notes cannot confirm a link", () =>
  assert.throws(
    () => resolveBatch(sampleWorkspace(), "batch-03", "lot-a", "ok", at, "e"),
    /evidence/,
  ));
test("already confirmed link does not produce duplicate history", () =>
  assert.throws(
    () =>
      resolveBatch(
        sampleWorkspace(),
        "batch-01",
        "lot-a",
        "This matches the original invoice.",
        at,
        "e",
      ),
    /already confirmed/,
  ));
test("alternate lot is isolated from target batches", () => {
  const t = traceLot(sampleWorkspace(), "lot-b");
  assert.equal(t.confirmedPacks, 360);
  assert.deepEqual(
    t.batches.map((b) => b.id),
    ["batch-05"],
  );
  assert.equal(t.unresolvedPacks, 720);
});
test("missing quantity stays unknown rather than becoming zero or negative stock", () => {
  const w = sampleWorkspace();
  w.batches[0].producedPacks = null;
  w.batches[0].usedKg = null;
  const t = traceLot(w, "lot-a");
  assert.equal(t.confirmedPacks, 720);
  assert.equal(t.usedKg, null);
  assert.equal(t.remainingPacks, null);
  assert.match(createReport(w, "lot-a", at, "r").content, /quantity unknown/);
});
test("identical duplicate dispatch reference counts once", () => {
  const w = sampleWorkspace();
  w.deliveries.push({ ...w.deliveries[0] });
  assert.equal(traceLot(w, "lot-a").confirmedPacks, 720);
});
test("conflicting duplicate dispatch reference fails closed", () => {
  const w = sampleWorkspace();
  w.deliveries.push({ ...w.deliveries[0], packs: 241 });
  assert.throws(() => traceLot(w, "lot-a"), /Conflicting duplicate/);
});
test("invalid lot references never overlap confirmed and unresolved totals", () => {
  const w = sampleWorkspace();
  w.lots = w.lots.filter((l) => l.id !== "lot-a");
  const t = traceLot(w, "lot-a");
  assert.equal(t.confirmedPacks, 0);
  assert.equal(t.unresolvedPacks, 1440);
});
test("dangling delivery batch references stay unresolved", () => {
  const w = sampleWorkspace();
  w.deliveries[0].batchId = "missing";
  const t = traceLot(w, "lot-a");
  assert.equal(t.confirmedPacks, 480);
  assert.equal(t.unresolvedPacks, 960);
});
test("report includes unresolved customers, source evidence and practice limitations", () => {
  const r = createReport(sampleWorkspace(), "lot-a", at, "r");
  assert.match(r.content, /Harbor Grocer: 360/);
  assert.match(r.content, /Orchard Pantry: 360/);
  assert.match(r.content, /line 6/);
  assert.match(r.content, /No-link does not mean safe/);
});
test("saved report is a snapshot, unaffected by later corrections", () => {
  const w = sampleWorkspace();
  const r = createReport(w, "lot-a", at, "r");
  w.reports.push(r);
  const next = resolveBatch(
    w,
    "batch-03",
    "lot-a",
    "Verified the synthetic invoice and production record.",
    at,
    "e",
  );
  assert.equal(next.reports[0].confirmedPacks, 720);
  assert.equal(createReport(next, "lot-a", at, "new").confirmedPacks, 1080);
});
test("reassignment history appears for both previous and new lots", () => {
  let w = corrected();
  w = resolveBatch(
    w,
    "batch-03",
    "lot-b",
    "Operator override supported by a rechecked source record.",
    at,
    "e2",
  );
  assert.match(
    createReport(w, "lot-a", at, "r1").content,
    /FL-260901-A → FL-260902-B/,
  );
  assert.match(
    createReport(w, "lot-b", at, "r2").content,
    /FL-260901-A → FL-260902-B/,
  );
});
test("link cannot exceed received ingredient quantity", () => {
  const w = sampleWorkspace();
  w.lots[0].receivedKg = 60;
  assert.throws(
    () =>
      resolveBatch(
        w,
        "batch-03",
        "lot-a",
        "Verified the source record for this link.",
        at,
        "e",
      ),
    /exceed/,
  );
});
const empty = () => ({
  ...sampleWorkspace(),
  lots: [],
  batches: [],
  deliveries: [],
  documents: [],
  audit: [],
  reports: [],
  synthetic: false,
});
const doc = (text: string): SourceDocument => ({
  id: "import-test",
  name: "test.csv",
  kind: "Uploaded record",
  text,
  mode: "manual",
  uploadedAt: at,
  hash: "hash-test",
});
test("CSV template produces a complete exact trace from an empty workspace", () => {
  const x = parseCsv(csvTemplate);
  assert.equal(x.records.length, 3);
  const w = importRecords(empty(), doc(x.transcript), x.records, at);
  assert.equal(w.lots.length, 1);
  assert.equal(w.batches.length, 1);
  assert.equal(w.deliveries.length, 1);
  assert.equal(traceLot(w, w.lots[0].id).confirmedPacks, 180);
});
test("CSV evidence comes from the exact row, including repeated identifiers", () => {
  const x = parseCsv(csvTemplate);
  assert.match(x.records[1].evidence, /^batch,/);
  assert.match(x.records[2].evidence, /^delivery,/);
});
test("CSV handles quoted commas and multiline fields", () => {
  const text =
    'type,code,ingredient,supplier,receivedKg\nlot,F1,"Wheat, flour","Mill\nTwo",12\n';
  const x = parseCsv(text);
  assert.equal(x.records[0].ingredient, "Wheat, flour");
  assert.equal(x.records[0].supplier, "Mill\nTwo");
  assert.ok(text.includes(x.records[0].evidence));
});
test("CSV rejects malformed quoting, duplicate columns and nonnumeric quantity", () => {
  assert.throws(() => parseCsv('type,code\nlot,"broken'), /unclosed/);
  assert.throws(() => parseCsv("type,code,code\nlot,a,b"), /repeated/);
  assert.throws(() => parseCsv("type,code,receivedKg\nlot,a,abc"));
});
test("pending extraction cannot mutate original workspace", () => {
  const w = empty(),
    before = JSON.stringify(w);
  parseCsv(csvTemplate);
  assert.equal(JSON.stringify(w), before);
});
test("unverified evidence quote cannot enter the graph", () => {
  const x = parseCsv(csvTemplate);
  x.records[0].evidence = "invented quote";
  assert.throws(
    () => importRecords(empty(), doc(x.transcript), x.records, at),
    /must appear/,
  );
});
test("duplicate source documents are rejected", () => {
  const x = parseCsv(csvTemplate);
  const w = importRecords(empty(), doc(x.transcript), x.records, at);
  assert.throws(
    () => importRecords(w, doc(x.transcript), x.records, at),
    /already been imported/,
  );
});
test("pack quantities must be whole and cannot exceed production", () => {
  const x = parseCsv(csvTemplate);
  x.records[2].packs = 201;
  assert.throws(
    () => importRecords(empty(), doc(x.transcript), x.records, at),
    /exceed production/,
  );
  x.records[2].packs = 1.5;
  assert.throws(
    () => importRecords(empty(), doc(x.transcript), x.records, at),
    /whole number/,
  );
});
test("impossible calendar dates are rejected", () => {
  const x = parseCsv(csvTemplate);
  x.records[2].date = "2026-02-30";
  assert.throws(
    () => importRecords(empty(), doc(x.transcript), x.records, at),
    /valid delivery date/,
  );
});
test("import never fuzzy-matches a lot identifier", () => {
  const x = parseCsv(csvTemplate);
  x.records[1].lotCode = "DEMO-FL-O1";
  const w = importRecords(empty(), doc(x.transcript), x.records, at);
  const t = traceLot(w, w.lots[0].id);
  assert.equal(t.confirmedPacks, 0);
  assert.equal(t.unresolvedPacks, 180);
});
test("AI request uses structured output, untrusted-data instructions, and no storage", async () => {
  let body: any;
  const fake = async (_url: any, options: any) => {
    body = JSON.parse(options.body);
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify(parseCsv(csvTemplate)),
            },
          ],
        },
      ],
    });
  };
  const x = await extractWithAI(
    new File(["record"], "test.txt", { type: "text/plain" }),
    "test-key",
    "test-model",
    fake as typeof fetch,
  );
  assert.equal(x.records.length, 3);
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.match(body.instructions, /untrusted data/);
  assert.equal(body.model, "test-model");
});
test("AI incomplete or refused output never becomes records", async () => {
  const incomplete = async () => Response.json({ status: "incomplete" });
  await assert.rejects(
    () =>
      extractWithAI(
        new File(["x"], "x.txt", { type: "text/plain" }),
        "k",
        "m",
        incomplete as typeof fetch,
      ),
    /did not finish/,
  );
  const refused = async () =>
    Response.json({
      status: "completed",
      output: [{ content: [{ type: "refusal" }] }],
    });
  await assert.rejects(
    () =>
      extractWithAI(
        new File(["x"], "x.txt", { type: "text/plain" }),
        "k",
        "m",
        refused as typeof fetch,
      ),
    /incomplete or unsupported/,
  );
});
test("mixed imported and sample records retain the synthetic disclosure", () => {
  const x = parseCsv(csvTemplate);
  const w = importRecords(sampleWorkspace(), doc(x.transcript), x.records, at);
  assert.equal(w.synthetic, true);
  assert.match(
    createReport(w, "lot-a", at, "r").content,
    /CONTAINS SYNTHETIC SAMPLE DATA/,
  );
});
test("explicit supplier and ingredient conflicts cannot create a lot link", () => {
  const x = parseCsv(csvTemplate);
  x.records[1].supplier = "A different mill";
  assert.throws(
    () => importRecords(empty(), doc(x.transcript), x.records, at),
    /Supplier identity conflicts/,
  );
  x.records[1].supplier = null;
  x.records[1].ingredient = "Sugar";
  assert.throws(
    () => importRecords(empty(), doc(x.transcript), x.records, at),
    /Ingredient identity conflicts/,
  );
});
test("a named but missing batch gets a visible unresolved placeholder", () => {
  const text =
    "type,code,batchCode,customer,packs,date\ndelivery,ORPHAN,UNKNOWN-B,Sample customer,20,2026-09-10\n";
  const x = parseCsv(text);
  const w = importRecords(empty(), doc(text), x.records, at);
  assert.equal(w.batches[0].sourceId, "");
  assert.equal(w.batches[0].producedPacks, null);
  assert.equal(traceLot(w, "").unresolvedPacks, 20);
});
test("an unknown delivery batch can be explicitly reviewed without changing its original code", () => {
  const w = sampleWorkspace();
  w.deliveries[0].batchId = null;
  w.deliveries[0].rawBatchCode = "";
  const next = resolveDelivery(
    w,
    "delivery-01",
    "batch-01",
    "Verified the dispatch against production source record.",
    at,
    "review-dispatch",
  );
  assert.equal(next.deliveries[0].rawBatchCode, "");
  assert.equal(traceLot(next, "lot-a").confirmedPacks, 720);
  assert.match(
    createReport(next, "lot-a", at, "r").content,
    /not recorded; see operator decision/,
  );
});
test("delivery batch review cannot exceed recorded production", () => {
  const w = sampleWorkspace();
  w.deliveries.push({
    ...w.deliveries[0],
    id: "new",
    batchId: null,
    packs: 100,
  });
  assert.throws(
    () =>
      resolveDelivery(
        w,
        "new",
        "batch-01",
        "Checked the source dispatch and production record.",
        at,
        "e",
      ),
    /exceed recorded production/,
  );
});
