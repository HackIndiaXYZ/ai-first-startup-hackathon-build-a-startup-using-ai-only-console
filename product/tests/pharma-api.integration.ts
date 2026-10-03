import assert from "node:assert/strict";
import { recallSummary, stockBalances } from "../lib/pharma/domain";
import type { PharmaWorkspace } from "../lib/pharma/types";
import type { IntakePreview } from "../lib/pharma/intake";

type TestBody = { workspace: PharmaWorkspace; access: { signedIn: boolean; secured: boolean; owner: boolean }; ai: Record<string, unknown>; draftId: string; preview: IntakePreview; matches: { exact: boolean }[]; replayed?: boolean };
type TestResponse = Omit<Response, "json"> & { json(): Promise<TestBody> };

const base = process.env.TEST_BASE_URL || "http://localhost:5173";
function client() {
  const jar = new Map<string, string>();
  return {
    async send(path: string, body?: unknown, extra: Record<string, string> = {}) {
      const res = await fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers: {
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body ? { Origin: base, "Content-Type": "application/json" } : {}), ...extra,
      }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
      for (const cookie of res.headers.getSetCookie()) { const pair = cookie.split(";")[0]; const index = pair.indexOf("="); jar.set(pair.slice(0, index), pair.slice(index + 1)); }
      return res as TestResponse;
    },
  };
}

const a = client(), b = client();
const first = await a.send("/api/pharma");
assert.equal(first.status, 200, await first.clone().text());
let body = await first.json() as { workspace: PharmaWorkspace; access: { signedIn: boolean }; ai: Record<string, unknown> };
let w = body.workspace;
assert.equal(w.schemaVersion, 2);
assert.equal(w.products.length, 6);
assert.equal(recallSummary(w, "recall-001").outstanding, 0);
assert.equal(recallSummary(w, "recall-001").returned, 600);
assert.equal(recallSummary(w, "recall-001").onHand, 1000);
assert.equal("key" in body.ai, false);
const other = await (await b.send("/api/pharma")).json();
assert.notEqual(other.workspace.id, w.id);
const deniedOrigin = await a.send("/api/pharma", { revision: w.revision, requestId: crypto.randomUUID(), action: { type: "workspace.rename", name: "Wrong origin" } }, { Origin: "https://unrelated.example" });
assert.equal(deniedOrigin.status, 403);

const template = await a.send("/api/pharma/intake", { mode: "template", templateId: "goods-receipt" });
assert.equal(template.status, 200, await template.clone().text());
const draft = await template.json();
assert.match(draft.preview.notice, /no AI request is made/);
assert.equal(draft.preview.mode, "guided");
assert.ok(draft.matches.every((row: { exact: boolean }) => row.exact));
const pending = await (await a.send("/api/pharma")).json();
assert.equal(pending.workspace.revision, w.revision, "Preview must not post stock");
const review = { mode: "approve", draftId: draft.draftId, revision: w.revision, requestId: crypto.randomUUID(), reviewNote: "Compared the guided receipt with its source and confirmed all identifiers.", corrections: [] };
const stolen = await b.send("/api/pharma/intake", { ...review, revision: other.workspace.revision });
assert.equal(stolen.status, 404);
const approved = await a.send("/api/pharma/intake", review);
assert.equal(approved.status, 200, await approved.clone().text());
w = (await approved.json()).workspace;
assert.equal(stockBalances(w).filter(row => row.batchId === "batch-para-002").reduce((n, row) => n + row.quantity, 0), 440);
const replayed = await a.send("/api/pharma/intake", review);
assert.equal(replayed.status, 200, await replayed.clone().text());
assert.equal((await replayed.json()).replayed, true);
const duplicate = await a.send("/api/pharma/intake", { ...review, requestId: crypto.randomUUID(), revision: w.revision });
assert.equal(duplicate.status, 409);
const stale = await a.send("/api/pharma", { revision: 0, requestId: crypto.randomUUID(), action: { type: "workspace.rename", name: "Stale edit" } });
assert.equal(stale.status, 409);
const source = w.sources.find(row => row.mode === "template")!;
assert.equal((await a.send(`/api/pharma/document?id=${source.id}`)).status, 200);
assert.equal((await b.send(`/api/pharma/document?id=${source.id}`)).status, 404);

const report = w.reports[w.reports.length - 1];
const frozen = JSON.stringify(report);
const pdf = await a.send(`/api/pharma/export?format=pdf&reportId=${report.id}`);
assert.equal(pdf.status, 200, await pdf.clone().text());
assert.ok(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 8)).startsWith("%PDF"));
const bundle = await a.send(`/api/pharma/export?format=evidence&reportId=${report.id}`);
assert.equal(bundle.status, 200, await bundle.clone().text());
assert.deepEqual([...new Uint8Array(await bundle.arrayBuffer()).slice(0, 4)], [80, 75, 3, 4]);
const renamed = await a.send("/api/pharma", { revision: w.revision, requestId: crypto.randomUUID(), action: { type: "workspace.rename", name: "Integration workspace" } });
assert.equal(renamed.status, 200);
w = (await renamed.json()).workspace;
assert.equal(JSON.stringify(w.reports.find(row => row.id === report.id)), frozen);
const backupResponse = await a.send("/api/pharma/export?format=json");
const backup = await backupResponse.json();
const restored = await a.send("/api/pharma", { revision: w.revision, requestId: crypto.randomUUID(), action: { type: "workspace.restore", backup, reason: "Restored the exported synthetic workspace for an integration check." } });
assert.equal(restored.status, 200, await restored.clone().text());
w = (await restored.json()).workspace;
assert.equal(w.sources.find(row => row.id === source.id)?.fileKey, undefined, "Backup cannot grant access to arbitrary R2 objects");
const reset = await a.send("/api/pharma", { revision: w.revision, requestId: crypto.randomUUID(), action: { type: "workspace.reset", scenario: "active", confirm: "RESET" } });
assert.equal(reset.status, 200, await reset.clone().text());
w = (await reset.json()).workspace;
assert.equal(recallSummary(w, "recall-001").outstanding, 500);
const partial = await a.send("/api/pharma/intake", { mode: "template", templateId: "customer-return" });
assert.equal(partial.status, 200, await partial.clone().text());
const returnDraft = await partial.json();
const returnPost = await a.send("/api/pharma/intake", { ...review, draftId: returnDraft.draftId, revision: w.revision, requestId: crypto.randomUUID() });
assert.equal(returnPost.status, 200, await returnPost.clone().text());
w = (await returnPost.json()).workspace;
assert.equal(recallSummary(w, "recall-001").returned, 120);
assert.equal(recallSummary(w, "recall-001").outstanding, 480);

const spoof = await b.send("/api/pharma", undefined, { "oai-authenticated-user-id": "forged-owner", "oai-authenticated-user-email": "forged@example.invalid" });
if (new URL(base).hostname === "localhost" || new URL(base).hostname === "127.0.0.1") {
  assert.equal((await spoof.json()).access.signedIn, false, "Local proxy strips spoofed identity headers");
  const signIn = await a.send("/signin-with-chatgpt?return_to=%2F");
  assert.equal(signIn.status, 302);
  const claim = await a.send("/api/pharma/team", { type: "claim" });
  assert.equal(claim.status, 200, await claim.clone().text());
  const secured = await (await a.send("/api/pharma")).json();
  assert.equal(secured.access.secured, true);
  assert.equal(secured.access.owner, true);
  assert.equal((await b.send("/api/pharma/team", { type: "invite", email: "nobody@example.invalid", role: "viewer" })).status, 401);
  const signedOut = await a.send("/signout-with-chatgpt?return_to=%2F");
  assert.ok([302, 303].includes(signedOut.status));
  assert.equal((await a.send("/api/pharma")).status, 401);
}
console.log("PASS: isolated pharma sessions, template preview/review, exact matching, atomic stock posting, replay protection, stale edits, source access, PDF/ZIP exports, fixed snapshots, backup restore, partial returns and account protection. No live AI requests.");
