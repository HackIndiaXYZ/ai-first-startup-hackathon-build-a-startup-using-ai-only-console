import test from "node:test";
import assert from "node:assert/strict";
import { blankIntakeRaw, parsePharmaCsv, readPharmaCsv, intakeCsv, previewPharmaExtraction, validateIntakeProposal, matchPharmaIntake, MAX_INTAKE_ROWS, type IntakeRaw } from "../lib/pharma/intake";
import { extractPharmaDocument } from "../lib/pharma/providers";
import { getGuidedTemplate, getTemplateCsv, pharmaTemplates } from "../lib/pharma/templates";
import { seedPharmaWorkspace } from "../lib/pharma/seed";
import { applyPharmaAction, stockBalances } from "../lib/pharma/domain";

const raw: IntakeRaw = { ...blankIntakeRaw(), reference: "GRN-001", date: "2026-10-03", productSku: "PAR-500-100", productName: "Paracetamol", strength: "500 mg", dosageForm: "Tablet", manufacturer: "Fictional Northstar Pharma", batchCode: "0001O", expiry: "2027-12", quantity: "10", unit: "box", partnerCode: "supplier-northstar", partnerName: "Fictional Northstar Supply", locationCode: "central" };
const csv = () => intakeCsv("receipt", [raw]);
const extractFixture = () => {
  const evidence = Object.values(raw).filter(Boolean).join(" | ");
  return { transcript: evidence, records: [{ kind: "receipt", fields: raw, evidence, page: null }] };
};

test("guided examples are complete review proposals with transparent no-AI provenance", () => {
  for (const template of pharmaTemplates) {
    const preview = getGuidedTemplate(template.id);
    assert.equal(preview.mode, "guided");
    assert.equal(preview.source.synthetic, true);
    assert.match(preview.notice, /pre-filled records; no AI request is made/);
    assert.ok(preview.records.length);
    assert.ok(preview.records.every((record) => record.status === "ready" && record.requiresReview));
    assert.equal(getTemplateCsv(template.id), template.csv);
    assert.equal(parsePharmaCsv(getTemplateCsv(template.id, { blank: true }), { kind: template.kind }).records.length, 0);
  }
  assert.throws(() => getGuidedTemplate("unknown"), /available/);
});

test("guided receipt matches the completed pharma workspace and can post once as reviewed evidence", () => {
  let workspace = seedPharmaWorkspace("intake-test", "2026-10-03T10:00:00Z", "complete");
  const preview = getGuidedTemplate("goods-receipt"), row = preview.records[0];
  const match = matchPharmaIntake(row, workspace);
  assert.equal(match.exact, true, JSON.stringify(match.issues));
  const context = { now: "2026-10-03T10:00:00Z", actor: "Test operator", role: "admin" as const };
  workspace = applyPharmaAction(workspace, { type: "source.add", source: { id: "guided-source", name: preview.source.name, kind: "Receipt", mode: "template", text: preview.source.text, createdAt: context.now } }, { ...context, id: "guided-source-action" });
  workspace = applyPharmaAction(workspace, { type: "receipt", batchId: match.batchId!, supplierId: match.partnerId!, locationId: match.locationId!, quantity: row.values.quantity!, unit: row.values.unit, reference: row.values.reference, reason: "Reviewed original fictional source and exact catalogue identity", evidence: { sourceId: "guided-source", ...row.evidence, page: undefined } }, { ...context, id: "guided-receipt-action" });
  assert.equal(stockBalances(workspace).find(balance => balance.batchId === match.batchId && balance.locationId === match.locationId && balance.status === "available")?.quantity, 440);
});

test("intake matching never links a same-code batch from another product or guesses typography", () => {
  const workspace = seedPharmaWorkspace("match-test", "2026-10-03T10:00:00Z");
  const recall = getGuidedTemplate("recall-notice").records[0];
  assert.equal(matchPharmaIntake(recall, workspace).batchId, "batch-amox-001");
  const changed = validateIntakeProposal(recall.kind, { ...recall.raw, productSku: "PAR-500-100" }, recall.evidence);
  assert.equal(matchPharmaIntake(changed, workspace).batchId, "batch-para-001");
  const mistyped = validateIntakeProposal(recall.kind, { ...recall.raw, batchCode: "PCR-26O901" }, recall.evidence);
  assert.equal(matchPharmaIntake(mistyped, workspace).exact, false);
  const wrongStrength = validateIntakeProposal(recall.kind, { ...recall.raw, strength: "250 mg" }, recall.evidence);
  assert.ok(matchPharmaIntake(wrongStrength, workspace).issues.some(issue => issue.field === "strength"));
});

test("pharma CSV preserves exact identifiers, month precision and quoted source lines without AI", () => {
  const source = "\uFEFF" + intakeCsv("receipt", [{ ...raw, productName: 'A, "quoted"\nproduct' }]);
  const result = parsePharmaCsv(source, { kind: "receipt" });
  assert.equal(result.mode, "csv");
  assert.match(result.notice, /no AI request/);
  assert.equal(result.source.text, source);
  assert.equal(result.source.textOrigin, "original");
  assert.equal(result.records[0].raw.batchCode, "0001O");
  assert.equal(result.records[0].values.expiry, "2027-12");
  assert.equal(result.records[0].values.quantity, 10);
  assert.equal(result.records[0].values.productName, 'A, "quoted"\nproduct');
  assert.equal(result.records[0].status, "ready");
  assert.equal(result.records[0].evidence.line, 2);
  assert.ok(source.includes(result.records[0].evidence.quote));
  assert.equal(result.records[0].requiresReview, true);
});

test("CSV mapping is explicit and preserves unmapped source fields", () => {
  const original = csv().replace("productSku", "ERP Code").replace("batchCode", "Printed Batch");
  const unmapped = parsePharmaCsv(original, { kind: "receipt" });
  assert.equal(unmapped.records[0].status, "attention");
  const mapped = parsePharmaCsv(original, { kind: "receipt", columnMap: { productSku: "ERP Code", batchCode: "Printed Batch" } });
  assert.equal(mapped.records[0].status, "ready");
  assert.equal(mapped.columnMap.productSku, "ERP Code");
  assert.throws(() => parsePharmaCsv(original, { kind: "receipt", columnMap: { productSku: "Missing" } }), /does not exist/);
  assert.throws(() => parsePharmaCsv(original, { kind: "receipt", columnMap: { productSku: "ERP Code", batchCode: "ERP Code" } }), /only one field/);
});

test("CSV rejects malformed, duplicated headers and excess rows rather than truncating", () => {
  for (const source of ['a,b\n"unclosed,b', 'a,b\n"closed"extra,b', 'a,a\nx,y', 'a,b\nx,y,z', 'a,b\nx\0,y']) {
    assert.throws(() => parsePharmaCsv(source, { kind: "receipt" }));
  }
  assert.throws(() => parsePharmaCsv(intakeCsv("receipt", Array(MAX_INTAKE_ROWS + 1).fill(raw)), { kind: "receipt" }), /at most 200/);
  assert.equal(readPharmaCsv("a,b\r\nx,y\r\nz,w")[2].line, 3);
  assert.equal(parsePharmaCsv(intakeCsv("receipt"), { kind: "receipt" }).canReview, false);
});

test("ambiguous dates, quantities and missing receipt/return facts require attention", () => {
  for (const changes of [{ date: "03/04/2026" }, { date: "2026-02-29" }, { expiry: "2027-13" }, { quantity: "1,000" }, { quantity: "1e3" }, { quantity: "10 boxes" }, { quantity: "-1" }, { quantity: "0" }, { quantity: "0.0000001" }, { expiry: "" }, { productSku: "" }]) {
    const result = parsePharmaCsv(intakeCsv("receipt", [{ ...raw, ...changes }]), { kind: "receipt" });
    assert.equal(result.records[0].status, "attention", JSON.stringify(changes));
  }
  const returns = validateIntakeProposal("return", raw, { quote: "source", line: 1, page: null });
  assert.ok(returns.issues.some((issue) => issue.field === "dispatchReference"));
  const leap = validateIntakeProposal("receipt", { ...raw, date: "2028-02-29" }, { quote: "source", line: 1, page: null });
  assert.equal(leap.status, "ready");
});

test("duplicate rows are identified while different lines of one dispatch remain separate", () => {
  const duplicate = parsePharmaCsv(intakeCsv("dispatch", [raw, raw]), { kind: "dispatch" });
  assert.equal(duplicate.records[1].issues[0].code, "duplicate");
  const distinct = parsePharmaCsv(intakeCsv("dispatch", [raw, { ...raw, batchCode: "0002" }]), { kind: "dispatch" });
  assert.equal(distinct.records[1].status, "ready");
});

test("recall notice is a proposal requiring an explicit reason, not an inferred safety verdict", () => {
  const recallRaw = { ...blankIntakeRaw(), reference: "RC-001", date: "2026-10-03", productSku: raw.productSku, batchCode: raw.batchCode, reason: "Fictional supplier notice" };
  const result = parsePharmaCsv(intakeCsv("recall", [recallRaw]), { kind: "recall" });
  assert.equal(result.records[0].status, "ready");
  assert.equal(result.records[0].values.quantity, null);
  assert.equal(result.records[0].requiresReview, true);
});

test("AI review requires exact original evidence and marks unsupported fields", () => {
  const fixture = extractFixture();
  const options = { sourceName: "source.txt", originalText: fixture.transcript, provider: "fireworks" as const, model: "mock" };
  const result = previewPharmaExtraction(fixture, options);
  assert.equal(result.records[0].status, "ready");
  assert.equal(result.source.text, fixture.transcript);
  assert.throws(() => previewPharmaExtraction(fixture, { ...options, originalText: "different" }), /does not occur/);
  const unsupported = structuredClone(fixture);
  unsupported.records[0].fields.batchCode = "invented";
  assert.equal(previewPharmaExtraction(unsupported, options).records[0].status, "attention");
  assert.throws(() => previewPharmaExtraction({ ...fixture, unexpected: "secret" }, options));
  assert.throws(() => previewPharmaExtraction({ ...fixture, records: Array(61).fill(fixture.records[0]) }, options));
  assert.throws(() => previewPharmaExtraction({ ...fixture, records: [{ ...fixture.records[0], page: 2 }] }, { ...options, pageCount: 1 }), /not supplied/);
});

test("provider-free parsing and missing-key AI do not make any request", async () => {
  let calls = 0;
  const send = (async () => { calls++; throw Error("should not run"); }) as typeof fetch;
  parsePharmaCsv(csv(), { kind: "receipt" });
  await assert.rejects(() => extractPharmaDocument(new File([csv()], "records.csv", { type: "text/csv" }), { provider: "fireworks", key: "", model: "mock" }, send), /without an API key/);
  assert.equal(calls, 0);
});

test("Fireworks and OpenAI adapters use structured review output and never return a key", async () => {
  const fixture = extractFixture();
  for (const provider of ["fireworks", "openai"] as const) {
    let called = 0;
    const result = await extractPharmaDocument(new File([fixture.transcript], "receipt.txt", { type: "text/plain" }), { provider, key: "test-private-key", model: "mock-model" }, (async (url, init) => {
      called++;
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-private-key");
      const request = JSON.parse(init!.body as string);
      assert.ok(init?.signal);
      if (provider === "openai") {
        assert.equal(url, "https://api.openai.com/v1/responses");
        assert.equal(request.store, false);
        assert.equal(request.text.format.strict, true);
        assert.match(request.instructions, /untrusted data/);
        return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(fixture) }] }] });
      }
      assert.equal(url, "https://api.fireworks.ai/inference/v1/chat/completions");
      assert.equal(request.response_format.type, "json_schema");
      assert.equal(request.context_length_exceeded_behavior, "error");
      assert.match(request.messages[0].content, /Do not convert units/);
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fixture) } }] });
    }) as typeof fetch);
    assert.equal(called, 1);
    assert.equal(result.records[0].status, "ready");
    assert.equal(result.mode, "ai");
    assert.equal(JSON.stringify(result).includes("test-private-key"), false);
  }
});

test("provider errors, truncation, refusal and network failures are sanitized", async () => {
  const file = new File(["source"], "receipt.txt", { type: "text/plain" });
  for (const provider of ["fireworks", "openai"] as const) {
    const options = { provider, key: "test-private-key", model: "mock" };
    const responses = [401, 402, 403, 404, 429, 500].map((status) => () => new Response("private upstream detail test-private-key", { status }));
    responses.push(() => Response.json({ status: "incomplete", choices: [{ finish_reason: "length" }] }));
    responses.push(() => Response.json({ status: "completed", choices: [{ finish_reason: "stop", message: { refusal: "refused", content: "bad json" } }] }));
    responses.push(() => { throw Error("test-private-key network details"); });
    for (const response of responses) {
      await assert.rejects(() => extractPharmaDocument(file, options, (async () => response()) as typeof fetch), (error) => !String(error).includes("test-private-key") && !String(error).includes("private upstream"));
    }
  }
});

test("Fireworks rejects incomplete PDF preparations before a network request", async () => {
  let calls = 0;
  const send = (async () => { calls++; return Response.json({}); }) as typeof fetch;
  await assert.rejects(() => extractPharmaDocument(new File(["%PDF"], "source.pdf", { type: "application/pdf" }), { provider: "fireworks", key: "key", model: "model" }, send), /every PDF page/);
  assert.equal(calls, 0);
  await assert.rejects(() => extractPharmaDocument(new File(["<svg>not jpeg</svg>"], "forged.jpg", { type: "image/jpeg" }), { provider: "fireworks", key: "key", model: "model" }, send), /stated file type/);
  assert.equal(calls, 0);
});
