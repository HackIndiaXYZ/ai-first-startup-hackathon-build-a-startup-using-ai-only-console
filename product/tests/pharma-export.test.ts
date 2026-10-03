import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import { csvCell, ledgerCsv, evidenceZip, reportPdf } from "../lib/pharma/export";
import { seedPharmaWorkspace } from "../lib/pharma/seed";
import { readPharmaCsv } from "../lib/pharma/intake";
const fixture = () => seedPharmaWorkspace("exports", "2026-10-03T10:00:00Z", "complete");

test("CSV quotes literal content and neutralises spreadsheet formula prefixes", () => {
  for (const value of ["=SUM(A1:A2)", "+cmd", "-1+2", "@formula", " \t=HYPERLINK(\"https://example.invalid\")", "\rformula"]) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('ordinary, "quoted"'), '"ordinary, ""quoted"""');
  const w = fixture(); w.products[0].name = '=HYPERLINK("https://example.invalid")';
  const csv = ledgerCsv(w), rows = readPharmaCsv(csv);
  const nameColumn = rows[0].cells.indexOf("product");
  assert.equal(rows[1].cells[nameColumn], '\'=HYPERLINK("https://example.invalid")');
  assert.equal(rows[1].cells[rows[0].cells.indexOf("quantity")], "1000");
});

test("snapshot CSV retains captured product, batch, location and partner names after catalogue changes", () => {
  const w = fixture(), snapshot = w.reports[w.reports.length - 1];
  const saved = ledgerCsv(w, snapshot);
  w.products[0].name = "Changed current product"; w.batches[0].code = "CURRENT-CODE";
  w.locations[0].name = "Changed current warehouse"; w.partners[1].name = "Changed current customer";
  assert.equal(ledgerCsv(w, snapshot), saved);
  assert.ok(!saved.includes("Changed current"));
  assert.match(ledgerCsv(w), /Changed current product/);
});

test("PDF is parseable, paginated, contains known accounting text and keeps every line on the page", async () => {
  const w = fixture(), report = w.reports[w.reports.length - 1];
  const bytes = await reportPdf(w, report), document = await PDFDocument.load(bytes);
  assert.equal(document.getTitle(), report.title);
  assert.ok(document.getPageCount() >= 2);
  const content: string[] = [];
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    let decoded: string;
    try { decoded = new TextDecoder().decode(decodePDFRawStream(object).decode()); } catch { continue; }
    for (const match of decoded.matchAll(/<([a-fA-F0-9]+)>\s*Tj/g)) content.push(Buffer.from(match[1], "hex").toString("latin1"));
    for (const match of decoded.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)) {
      assert.ok(Number(match[1]) >= 30 && Number(match[1]) <= 547, "Text starts inside the horizontal page margins");
      assert.ok(Number(match[2]) >= 25 && Number(match[2]) <= 800, "Text stays inside the vertical page margins");
    }
  }
  const text = content.join(" ");
  for (const expected of ["RECALLSCOPE", "Received: 1,000 box", "Historically shipped: 600 box", "Returned: 600 box", "Outstanding: 0 box", "Sample records", "Source manifest", "Decision history"]) assert.ok(text.includes(expected), expected);
});

test("evidence ZIP opens through an independent decoder with filenames, Unicode and exact binary contents", () => {
  const utf8 = new TextEncoder();
  const files = [
    { name: "manifest.json", bytes: utf8.encode('{"source":"fictional"}') },
    { name: "sources/receipt-évidence.csv", bytes: utf8.encode("reference,quantity\r\nGRN-001,1000\r\n") },
    { name: "report.pdf", bytes: new Uint8Array([37, 80, 68, 70, 0, 255, 1, 2]) },
  ];
  const zip = evidenceZip(files), extracted = unzipSync(zip);
  assert.deepEqual(Object.keys(extracted), files.map(file => file.name));
  for (const file of files) assert.deepEqual(extracted[file.name], file.bytes);
  assert.equal(strFromU8(extracted["manifest.json"]), '{"source":"fictional"}');
  assert.equal(new DataView(zip.buffer).getUint16(zip.length - 12, true), files.length);
});

test("ZIP CRC matches the standard check vector in both local and central directory records", () => {
  const zip = evidenceZip([{ name: "vector.txt", bytes: new TextEncoder().encode("123456789") }]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(14, true), 0xcbf43926);
  const centralOffset = view.getUint32(zip.length - 6, true);
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
  assert.equal(view.getUint32(centralOffset + 16, true), 0xcbf43926);
  assert.equal(strFromU8(unzipSync(zip)["vector.txt"]), "123456789");
});

test("archive boundaries reject traversal and excessive entries before producing an export", () => {
  const bytes = new Uint8Array([1]);
  for (const name of ["../outside", "/absolute", "folder\\file", "folder/../../private"]) assert.throws(() => evidenceZip([{ name, bytes }]), /Invalid archive filename/);
  assert.throws(() => evidenceZip(Array.from({ length: 221 }, (_, index) => ({ name: `${index}.txt`, bytes }))), /exceeds/);
  assert.throws(() => evidenceZip([{ name: "large.bin", bytes: new Uint8Array(22_000_001) }]), /exceeds/);
});
