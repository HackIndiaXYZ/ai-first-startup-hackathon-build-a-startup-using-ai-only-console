import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePharmaFixtures } from "../scripts/evaluate-pharma";

test("declared pharmaceutical corpus passes software checks with no live AI requests", async () => {
  const result = await evaluatePharmaFixtures();
  assert.equal(result.corpus.csvCases, 10);
  assert.equal(result.corpus.pdfCases, 6);
  assert.equal(result.deterministic.casesPassed, 10);
  assert.equal(result.deterministic.records, 11);
  assert.equal(result.deterministic.fieldChecks, 187);
  assert.equal(result.mockedProviders.successfulFixtures, 7);
  assert.equal(result.mockedProviders.requests, 8);
  assert.equal(result.liveProviderRequests, 0);
  assert.equal(result.liveOcrAccuracy, "not measured");
  assert.equal(result.ledgerUnchanged, true);
});
