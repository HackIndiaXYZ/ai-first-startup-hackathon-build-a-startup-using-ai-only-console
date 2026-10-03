import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { intakeCsv, intakeFields } from "../lib/pharma/intake";
import {
  pharmaFixtureCorpus,
  pharmaPdfFixtures,
  mockExtraction,
  type PharmaFixture,
} from "./pharma-fixture-corpus";

const folder = resolve("fixtures/pharma");
await mkdir(join(folder, "mock-extractions"), { recursive: true });
const fixed = new Date("2026-10-03T00:00:00Z");
const labels: Record<string, string> = {
  reference: "Reference",
  date: "Record date",
  productSku: "Product SKU",
  productName: "Product",
  strength: "Strength",
  dosageForm: "Dosage form",
  manufacturer: "Manufacturer",
  batchCode: "Batch code",
  expiry: "Expiry label",
  quantity: "Quantity",
  unit: "Stock unit",
  partnerCode: "Partner ID",
  partnerName: "Partner",
  locationCode: "Location",
  dispatchReference: "Original dispatch",
  reason: "Source note",
};
async function pdf(fixture: PharmaFixture, rotated = false) {
  const document = await PDFDocument.create();
  document.setTitle(`RecallScope fixture: ${fixture.id}`);
  document.setAuthor("RecallScope software verification");
  document.setCreationDate(fixed);
  document.setModificationDate(fixed);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([595.28, 841.89]);
  if (rotated) page.setRotation(degrees(90));
  page.drawRectangle({
    x: 0,
    y: 730,
    width: 595.28,
    height: 112,
    color: rgb(0.07, 0.16, 0.22),
  });
  page.drawText("ASTERBRIDGE DISTRIBUTION", {
    x: 38,
    y: 801,
    size: 10,
    font: bold,
    color: rgb(0.6, 0.85, 0.8),
  });
  page.drawText(
    fixture.kind === "receipt" ? "Goods received note" : "Distribution record",
    { x: 38, y: 767, size: 24, font: bold, color: rgb(1, 1, 1) },
  );
  page.drawText("Fictional software fixture - no commercial transaction", {
    x: 38,
    y: 706,
    size: 9,
    font,
    color: rgb(0.35, 0.4, 0.44),
  });
  const columns = fixture.rows.length > 1 ? 2 : 1;
  const width = columns === 2 ? 247 : 519;
  fixture.rows.forEach((record, index) => {
    const x = 38 + index * 272;
    let y = 674;
    page.drawText(`LINE ${index + 1}`, {
      x,
      y,
      size: 10,
      font: bold,
      color: rgb(0.08, 0.4, 0.34),
    });
    y -= 26;
    for (const field of intakeFields) {
      const value = record[field];
      if (!value) continue;
      page.drawText(labels[field] || field, {
        x,
        y,
        size: 8,
        font: bold,
        color: rgb(0.35, 0.4, 0.44),
      });
      y -= 15;
      const lines: string[] = [];
      let line = "";
      for (const word of value.replace(/\n/g, " / ").split(" ")) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, 10) > width && line) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      if (line) lines.push(line);
      for (const line of lines) {
        page.drawText(line, {
          x,
          y,
          size: 10,
          font,
          color: rgb(0.1, 0.16, 0.2),
        });
        y -= 13;
      }
      y -= 10;
    }
    if (y < 64) throw Error(`Fixture ${fixture.id} exceeds its layout bounds.`);
  });
  page.drawLine({
    start: { x: 38, y: 49 },
    end: { x: 557, y: 49 },
    thickness: 0.7,
    color: rgb(0.78, 0.82, 0.83),
  });
  page.drawText(
    `Fixture ${fixture.id}  |  Original labels retained  |  1 / 1`,
    { x: 38, y: 31, size: 8, font, color: rgb(0.35, 0.4, 0.44) },
  );
  return document.save();
}
for (const fixture of pharmaFixtureCorpus) {
  await writeFile(
    join(folder, `${fixture.id}.csv`),
    intakeCsv(fixture.kind, fixture.rows),
  );
  await writeFile(
    join(folder, "mock-extractions", `${fixture.id}.json`),
    JSON.stringify(mockExtraction(fixture), null, 2) + "\n",
  );
}
for (const fixture of pharmaPdfFixtures.filter(
  (row) => row.format !== "image-only",
)) {
  const source = pharmaFixtureCorpus.find(
    (row) => row.id === fixture.corpusId,
  )!;
  await writeFile(
    join(folder, `${fixture.id}.pdf`),
    await pdf(source, fixture.format === "rotated"),
  );
}
const render = spawnSync(
  process.env.PDFTOPPM_PATH || "pdftoppm",
  [
    "-r",
    "120",
    "-singlefile",
    "-png",
    join(folder, "clean-receipt.pdf"),
    join(folder, "scanned-receipt"),
  ],
  { encoding: "utf8", timeout: 30000, windowsHide: true },
);
if (render.status !== 0)
  throw Error(
    "Install Poppler or set PDFTOPPM_PATH to reproduce the image-only fixture; the committed fixtures remain usable.",
  );
const scan = await PDFDocument.create();
scan.setTitle("RecallScope image-only fixture");
scan.setCreationDate(fixed);
scan.setModificationDate(fixed);
const png = await scan.embedPng(
  await readFile(join(folder, "scanned-receipt.png")),
);
const scanPage = scan.addPage([595.28, 841.89]);
scanPage.drawImage(png, { x: 0, y: 0, width: 595.28, height: 841.89 });
await writeFile(join(folder, "scanned-receipt.pdf"), await scan.save());
const hashes: Record<string, string> = {};
for (const item of [
  ...pharmaFixtureCorpus.map((row) => `${row.id}.csv`),
  ...pharmaPdfFixtures.map((row) => `${row.id}.pdf`),
  "scanned-receipt.png",
])
  hashes[item] = createHash("sha256")
    .update(await readFile(join(folder, item)))
    .digest("hex");
await writeFile(
  join(folder, "manifest.json"),
  JSON.stringify(
    {
      format: "recallscope-pharma-fixtures-v1",
      authoredReferenceDate: "2026-10-03",
      provenance:
        "Fictional documents and independently declared expected handling. Provider responses are authored mocks, not observed AI/OCR results.",
      csvCases: pharmaFixtureCorpus,
      pdfCases: pharmaPdfFixtures,
      hashes,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(folder, "README.md"),
  `# Pharmaceutical verification corpus\n\nAll organisations, documents and events are fictional software fixtures. These files do not represent actual supplies, recall instructions or patient records.\n\nThe corpus includes ${pharmaFixtureCorpus.length} structured CSV cases and six PDFs: clean text, month-only expiry, the same batch code across two products, an ambiguous printed date, a rotated page and an image-only scanned page. The matching PNG is a raster rendering of the clean authored PDF.\n\nRun \`npm run test:pharma-eval\` to compare parsed fields, exact identity matching, review flags and mocked Fireworks/OpenAI response handling against \`manifest.json\`. The expected answers and mock transcripts are authored fixtures. **No live model or OCR accuracy is measured, and no API key or network request is used.**\n\nRun \`npm run fixtures:pharma\` to regenerate with the existing pdf-lib dependency and Poppler's \`pdftoppm\` on PATH (or \`PDFTOPPM_PATH\`). Reproduction is deterministic for the supplied reference date.\n\nRun \`npm run benchmark\` for measured 1,000- and 10,000-movement synthetic receipt and mixed distribution workloads. Benchmarks report the execution environment and do not assert industrial performance.\n`,
);
console.log(
  JSON.stringify({
    csvFixtures: pharmaFixtureCorpus.length,
    pdfFixtures: pharmaPdfFixtures.length,
    output: folder,
    liveRequests: 0,
  }),
);
