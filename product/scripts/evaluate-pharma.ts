import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import {
  intakeFields,
  matchPharmaIntake,
  parsePharmaCsv,
} from "../lib/pharma/intake";
import { extractPharmaDocument } from "../lib/pharma/providers";
import { seedPharmaWorkspace } from "../lib/pharma/seed";
import type { PharmaFixture } from "./pharma-fixture-corpus";

type Manifest = {
  format: string;
  csvCases: PharmaFixture[];
  pdfCases: { id: string; corpusId: string; format: string }[];
  hashes: Record<string, string>;
};
const folder = resolve("fixtures/pharma");
export async function evaluatePharmaFixtures() {
  const manifest: Manifest = JSON.parse(
    await readFile(join(folder, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.format, "recallscope-pharma-fixtures-v1");
  let hashChecks = 0;
  for (const [file, expected] of Object.entries(manifest.hashes)) {
    const actual = createHash("sha256")
      .update(await readFile(join(folder, file)))
      .digest("hex");
    assert.equal(
      actual,
      expected,
      `${file}: fixture bytes changed; regenerate the declared corpus intentionally.`,
    );
    hashChecks++;
  }
  const workspace = seedPharmaWorkspace(
    "fixture-evaluation",
    "2026-10-03T12:00:00Z",
    "active",
  );
  const before = JSON.stringify(workspace);
  const csvResults: {
    id: string;
    records: number;
    fieldChecks: number;
    outcome: string;
  }[] = [];
  let fieldChecks = 0;
  for (const fixture of manifest.csvCases) {
    const csv = await readFile(join(folder, `${fixture.id}.csv`), "utf8");
    const preview = parsePharmaCsv(csv, {
      kind: fixture.kind,
      sourceName: `${fixture.id}.csv`,
      synthetic: true,
    });
    assert.equal(preview.records.length, fixture.rows.length);
    assert.equal(preview.mode, "csv");
    assert.equal(preview.source.text, csv);
    assert.equal(preview.source.textOrigin, "original");
    let checked = 0;
    for (const [index, record] of preview.records.entries()) {
      assert.equal(record.requiresReview, true);
      assert.equal(record.status, fixture.expected[index].status, fixture.id);
      assert.ok(csv.includes(record.evidence.quote));
      for (const field of intakeFields) {
        assert.equal(
          record.raw[field],
          fixture.rows[index][field],
          `${fixture.id}: raw ${field}`,
        );
        const expected =
          field === "quantity"
            ? fixture.rows[index][field]
              ? Number(fixture.rows[index][field])
              : null
            : fixture.rows[index][field].trim();
        assert.equal(
          record.values[field],
          expected,
          `${fixture.id}: parsed ${field}`,
        );
        checked++;
        fieldChecks++;
      }
      const match = matchPharmaIntake(record, workspace);
      assert.equal(
        match.exact,
        fixture.expected[index].exact,
        `${fixture.id}: matching ${JSON.stringify(match.issues)}`,
      );
      if (fixture.expected[index].batchId)
        assert.equal(match.batchId, fixture.expected[index].batchId);
      for (const field of fixture.expected[index].issueFields ?? [])
        assert.ok(
          [...record.issues, ...match.issues].some(
            (issue) => issue.field === field,
          ),
          `${fixture.id}: expected attention on ${field}`,
        );
    }
    csvResults.push({
      id: fixture.id,
      records: preview.records.length,
      fieldChecks: checked,
      outcome: "passed",
    });
  }
  const mockResults: {
    id: string;
    provider: string;
    sourceFormat: string;
    records: number;
    outcome: string;
  }[] = [];
  let mockedRequests = 0;
  for (const fixture of manifest.pdfCases) {
    const expected = manifest.csvCases.find(
      (item) => item.id === fixture.corpusId,
    )!;
    const responseFixture = JSON.parse(
      await readFile(
        join(folder, "mock-extractions", `${fixture.corpusId}.json`),
        "utf8",
      ),
    );
    const bytes = await readFile(join(folder, `${fixture.id}.pdf`));
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    if (fixture.format === "rotated")
      assert.equal(pdf.getPage(0).getRotation().angle, 90);
    const send: typeof fetch = async (url, init) => {
      mockedRequests++;
      assert.equal(url, "https://api.openai.com/v1/responses");
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.store, false);
      assert.equal(payload.input[0].content[0].type, "input_file");
      return Response.json({
        status: "completed",
        output: [
          {
            content: [
              { type: "output_text", text: JSON.stringify(responseFixture) },
            ],
          },
        ],
      });
    };
    const preview = await extractPharmaDocument(
      new File([bytes], `${fixture.id}.pdf`, { type: "application/pdf" }),
      {
        provider: "openai",
        key: "fixture-only-credential-never-sent",
        model: "authored-response-fixture",
      },
      send,
    );
    assert.equal(preview.mode, "ai");
    assert.equal(preview.source.textOrigin, "model-transcript");
    assert.equal(preview.records.length, expected.rows.length);
    for (const [index, record] of preview.records.entries()) {
      assert.deepEqual(record.raw, expected.rows[index]);
      assert.equal(record.status, expected.expected[index].status);
      assert.equal(record.requiresReview, true);
      assert.equal(record.evidence.page, 1);
    }
    mockResults.push({
      id: fixture.id,
      provider: "OpenAI adapter / authored mock",
      sourceFormat: fixture.format,
      records: preview.records.length,
      outcome: "passed",
    });
  }
  const imageBytes = await readFile(join(folder, "scanned-receipt.png"));
  const scanBytes = await readFile(join(folder, "scanned-receipt.pdf"));
  const responseFixture = JSON.parse(
    await readFile(
      join(folder, "mock-extractions", "clean-receipt.json"),
      "utf8",
    ),
  );
  const fireworksSend: typeof fetch = async (url, init) => {
    mockedRequests++;
    assert.equal(url, "https://api.fireworks.ai/inference/v1/chat/completions");
    const payload = JSON.parse(String(init?.body));
    assert.equal(
      payload.messages[1].content.filter(
        (item: { type: string }) => item.type === "image_url",
      ).length,
      1,
    );
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(responseFixture) },
        },
      ],
    });
  };
  const fire = await extractPharmaDocument(
    new File([scanBytes], "scanned-receipt.pdf", { type: "application/pdf" }),
    {
      provider: "fireworks",
      key: "fixture-only-credential-never-sent",
      model: "authored-response-fixture",
      pages: [new File([imageBytes], "page-1.png", { type: "image/png" })],
      pageCount: 1,
    },
    fireworksSend,
  );
  assert.deepEqual(fire.records[0].raw, manifest.csvCases[0].rows[0]);
  assert.equal(fire.records[0].requiresReview, true);
  mockResults.push({
    id: "scanned-receipt",
    provider: "Fireworks adapter / authored mock",
    sourceFormat: "rendered image",
    records: 1,
    outcome: "passed",
  });
  // A source-unsupported model value is not silently trusted even when JSON is valid.
  const unsupported = structuredClone(responseFixture);
  unsupported.records[0].fields.batchCode = "INVENTED-BATCH-999";
  const rejected = await extractPharmaDocument(
    new File([scanBytes], "scanned-receipt.pdf", { type: "application/pdf" }),
    {
      provider: "openai",
      key: "fixture-only-credential-never-sent",
      model: "authored-invalid-response",
    },
    async () => {
      mockedRequests++;
      return Response.json({
        status: "completed",
        output: [
          {
            content: [
              { type: "output_text", text: JSON.stringify(unsupported) },
            ],
          },
        ],
      });
    },
  );
  assert.equal(rejected.records[0].status, "attention");
  assert.ok(
    rejected.records[0].issues.some((issue) => issue.field === "batchCode"),
  );
  assert.equal(
    JSON.stringify(workspace),
    before,
    "Preparing records cannot mutate the ledger.",
  );
  return {
    format: "recallscope-pharma-evaluation-v1",
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    corpus: {
      csvCases: csvResults.length,
      pdfCases: manifest.pdfCases.length,
      hashChecks,
    },
    deterministic: {
      casesPassed: csvResults.length,
      fieldChecks,
      records: csvResults.reduce((sum, row) => sum + row.records, 0),
      cases: csvResults,
    },
    mockedProviders: {
      requests: mockedRequests,
      successfulFixtures: mockResults.length,
      unsupportedFieldGuard: "passed",
      cases: mockResults,
    },
    ledgerUnchanged: true,
    liveProviderRequests: 0,
    liveOcrAccuracy: "not measured",
    scope:
      "Software parser, identity matching, evidence validation and mocked transport contracts only. Authored provider replies are not measurements of extraction accuracy.",
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await evaluatePharmaFixtures();
  const output = resolve("verification/pharma-evaluation.json");
  await mkdir(resolve("verification"), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
