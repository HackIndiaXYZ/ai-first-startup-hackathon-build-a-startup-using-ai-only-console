import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PharmaWorkspace, ReportSnapshot } from "./types";

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]|^[\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function ledgerCsv(w: PharmaWorkspace, report?: ReportSnapshot) {
  const catalogue = report?.catalogue ?? w;
  const rows = [["movement_id", "date", "kind", "sku", "product", "batch", "quantity", "unit", "source_quantity", "source_unit", "from_location", "from_status", "to_location", "to_status", "recipient", "reference", "evidence_id", "actor", "reason"]];
  for (const m of report?.movements ?? w.movements) {
    const product = catalogue.products.find(p => p.id === m.productId);
    rows.push([m.id, m.at, m.kind, product?.sku || m.productId, product?.name || "", catalogue.batches.find(b => b.id === m.batchId)?.code || m.batchId,
      String(m.quantity), m.unit, String(m.originalQuantity), m.originalUnit,
      catalogue.locations.find(l => l.id === m.from?.locationId)?.name || "", m.from?.status || "",
      catalogue.locations.find(l => l.id === m.to?.locationId)?.name || "", m.to?.status || "",
      catalogue.partners.find(p => p.id === m.partnerId)?.name || "", m.reference, m.evidence?.sourceId || "", m.actor, m.reason]);
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}

function printable(value: unknown) {
  return String(value ?? "").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/→/g, "to").replace(/[^\x20-\x7e\n\r\t\u00a0-\u00ff]/g, "?");
}

export async function reportPdf(w: PharmaWorkspace, report: ReportSnapshot) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(report.title); pdf.setAuthor("RecallScope"); pdf.setSubject("Pharmaceutical distribution recall evidence");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]); let y = 774;
  const left = 48, width = 499;
  const text = (value: unknown, size = 10, heading = false) => {
    const font = heading ? bold : regular;
    const lines: string[] = [];
    for (const paragraph of printable(value).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
        else { if (current) lines.push(current); current = word;
          while (font.widthOfTextAtSize(current, size) > width) { let n = Math.min(current.length, 75); while (n > 1 && font.widthOfTextAtSize(current.slice(0, n), size) > width) n--; lines.push(current.slice(0, n)); current = current.slice(n); }
        }
      }
      lines.push(current);
    }
    const blockHeight = lines.length * size * 1.5 + 5 + (heading ? 30 : 0);
    if (blockHeight <= 718 && y - blockHeight < 62) {
      page = pdf.addPage([595, 842]); y = 780;
    }
    for (const line of lines) {
      if (y < 62) { page = pdf.addPage([595, 842]); y = 780; }
      page.drawText(line, { x: left, y, size, font, color: rgb(0.09, 0.15, 0.22) }); y -= size * 1.5;
    }
    y -= 5;
  };
  text("RECALLSCOPE / PHARMACEUTICAL DISTRIBUTION", 11, true);
  text(report.title, 24, true);
  text(`Snapshot ${report.id} | Workspace revision ${report.revision}`);
  text(`Created ${report.createdAt} by ${report.actor} | Reference date ${report.asOf}`);
  if (w.synthetic) text("Sample records - fictional organisations and transactions.");
  const s = report.summary;
  text("Quantity reconciliation", 16, true);
  for (const [label, value] of [["Received", s.received], ["Historically shipped", s.shipped], ["Returned", s.returned], ["Recorded on hand", s.onHand], ["Quarantined", s.quarantined], ["In transit", s.inTransit], ["Customer-held", s.customerHeld], ["Outstanding", s.outstanding]] as const) text(`${label}: ${value.toLocaleString("en-US")} ${s.unit}`, 11);
  text(`Accounting status: ${s.accountingComplete ? "All recorded quantities accounted for" : "Reconciliation in progress"}`, 11, true);
  text("Historical exposure and current stock are different measures and must not be added together. This report reflects recorded evidence, not a physical count or a medical safety decision.");
  if (s.exceptions.length) { text("Accounting exceptions", 13, true); s.exceptions.forEach(message => text(message)); }
  text("Customer destinations", 16, true);
  for (const row of s.recipients) {
    text(`${row.partnerName} / ${row.batchCode}`, 11, true);
    text(`Shipped ${row.shipped}; returned ${row.returned}; held ${row.customerHeld}; other disposition ${row.disposed}; outstanding ${row.outstanding} ${row.unit}. Acknowledged: ${row.acknowledged ? "yes" : "no"}.`);
  }
  text("Source manifest", 16, true);
  for (const source of report.sources) {
    text(`${source.name} [${source.id}]`, 10, true);
    text(`Origin: ${source.mode}${source.provider ? ` / ${source.provider} / ${source.model}` : ""}. SHA-256: ${source.hash || "Not fingerprinted"}`);
  }
  text("Decision history", 16, true);
  for (const event of report.audit.slice(-100)) text(`${event.at} | ${event.actor} | ${event.action}\n${event.reason}${event.before || event.after ? `\n${event.before} -> ${event.after}` : ""}`);
  if (report.audit.length > 100) text("The PDF shows the latest 100 decisions. The JSON evidence package includes the complete captured history.");
  if (report.note) { text("Operator note", 13, true); text(report.note); }
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`RecallScope | ${i + 1} / ${pages.length}`, { x: left, y: 30, size: 9, font: regular, color: rgb(0.4, 0.45, 0.5) }));
  return pdf.save();
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Bounded, uncompressed UTF-8 ZIP; avoids buffering a second compression copy in Workers. */
export function evidenceZip(files: { name: string; bytes: Uint8Array }[]) {
  if (files.length > 220 || files.reduce((n, f) => n + f.bytes.length, 0) > 22_000_000) throw Error("Export sources in smaller groups; the evidence bundle exceeds 22 MB.");
  const chunks: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0;
  for (const file of files) {
    if (file.name.includes("..") || file.name.startsWith("/") || file.name.includes("\\")) throw Error("Invalid archive filename.");
    const name = new TextEncoder().encode(file.name), crc = crc32(file.bytes);
    const header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint32(14, crc, true); view.setUint32(18, file.bytes.length, true); view.setUint32(22, file.bytes.length, true); view.setUint16(26, name.length, true); header.set(name, 30);
    chunks.push(header, file.bytes);
    const entry = new Uint8Array(46 + name.length), ev = new DataView(entry.buffer);
    ev.setUint32(0, 0x02014b50, true); ev.setUint16(4, 20, true); ev.setUint16(6, 20, true); ev.setUint16(8, 0x800, true);
    ev.setUint32(16, crc, true); ev.setUint32(20, file.bytes.length, true); ev.setUint32(24, file.bytes.length, true); ev.setUint16(28, name.length, true); ev.setUint32(42, offset, true); entry.set(name, 46);
    central.push(entry); offset += header.length + file.bytes.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + 22); let at = 0;
  for (const chunk of [...chunks, ...central, end]) { result.set(chunk, at); at += chunk.length; }
  return result;
}
