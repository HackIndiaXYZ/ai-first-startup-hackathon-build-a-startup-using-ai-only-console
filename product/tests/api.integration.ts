import assert from "node:assert/strict";
import { csvTemplate } from "../lib/import-records";
import { traceLot } from "../lib/domain";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
async function open() {
  const r = await fetch(base + "/api/workspace");
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  return { cookie, workspace: ((await r.json()) as any).workspace };
}
const a = await open(),
  b = await open();
assert.equal(a.workspace.documents.length, 7);
assert.equal(traceLot(a.workspace, "lot-a").confirmedPacks, 1440);
assert.equal(traceLot(a.workspace, "lot-a").unresolvedPacks, 0);
async function post(path: string, body: any, cookie = a.cookie) {
  return fetch(base + path, {
    method: "POST",
    headers: { origin: base, cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
let r = await fetch(base + "/api/workspace", {
  method: "POST",
  headers: { cookie: a.cookie, "content-type": "application/json" },
  body: JSON.stringify({ action: "clear", revision: 0, confirm: "CLEAR" }),
});
assert.equal(r.status, 403);
r = await post("/api/workspace", {
  action: "reset",
  revision: 0,
  confirm: "RESET",
  scenario: "review",
});
assert.equal(r.status, 200);
r = await post("/api/workspace", {
  action: "resolve",
  revision: 1,
  batchId: "batch-03",
  lotId: "lot-a",
  note: "Synthetic test: checked O/0 against supplier invoice.",
});
assert.equal(r.status, 200);
let data: any = await r.json();
assert.equal(data.workspace.revision, 2);
r = await post("/api/workspace", {
  action: "report",
  revision: 0,
  lotId: "lot-a",
});
assert.equal(r.status, 409);
r = await post("/api/workspace", {
  action: "report",
  revision: 2,
  lotId: "lot-a",
});
assert.equal(r.status, 200);
data = await r.json();
assert.equal(data.workspace.reports[0].confirmedPacks, 1080);
assert.equal(data.workspace.reports[0].unresolvedPacks, 360);
const saved = data.workspace;
r = await fetch(base + "/api/workspace", { headers: { cookie: a.cookie } });
assert.deepEqual(((await r.json()) as any).workspace, saved);
r = await fetch(base + "/api/workspace", { headers: { cookie: b.cookie } });
data = await r.json();
assert.equal(data.workspace.revision, 0);
assert.equal(data.workspace.audit.length, 0);
r = await post("/api/workspace", {
  action: "clear",
  revision: 3,
  confirm: "CLEAR",
});
assert.equal(r.status, 200);
const form = new FormData();
form.append("mode", "csv");
form.append(
  "file",
  new File([csvTemplate], "synthetic-test.csv", { type: "text/csv" }),
);
r = await fetch(base + "/api/extract", {
  method: "POST",
  headers: { origin: base, cookie: a.cookie },
  body: form,
});
data = await r.json();
assert.equal(r.status, 200, JSON.stringify(data));
assert.equal(data.draft.records.length, 3);
const draft = data.draft;
r = await fetch(base + "/api/workspace", { headers: { cookie: a.cookie } });
data = await r.json();
assert.equal(
  data.workspace.lots.length,
  0,
  "Pending extraction must not mutate graph",
);
r = await post("/api/import", {
  draftId: draft.id,
  revision: 4,
  records: draft.records,
  reviewed: false,
});
assert.equal(r.status, 400);
r = await post(
  "/api/import",
  { draftId: draft.id, revision: 0, records: draft.records, reviewed: true },
  b.cookie,
);
assert.equal(r.status, 404);
r = await post("/api/import", {
  draftId: draft.id,
  revision: 4,
  records: draft.records,
  reviewed: true,
});
data = await r.json();
assert.equal(r.status, 200, JSON.stringify(data));
assert.equal(data.workspace.documents.length, 1);
assert.equal(data.workspace.deliveries[0].packs, 180);
assert.equal(data.workspace.revision, 5);
const imported = data.workspace;
r = await fetch(base + "/api/workspace", { headers: { cookie: a.cookie } });
assert.deepEqual(((await r.json()) as any).workspace, imported);
r = await fetch(base + "/api/document?id=" + draft.document.id, {
  headers: { cookie: a.cookie },
});
assert.equal(r.status, 200);
assert.equal(await r.text(), csvTemplate);
assert.match(r.headers.get("content-disposition")!, /^attachment/);
r = await fetch(base + "/api/document?id=" + draft.document.id, {
  headers: { cookie: b.cookie },
});
assert.equal(r.status, 404);
const duplicate = new FormData();
duplicate.append("mode", "csv");
duplicate.append(
  "file",
  new File([csvTemplate], "same-content.csv", { type: "text/csv" }),
);
r = await fetch(base + "/api/extract", {
  method: "POST",
  headers: { origin: base, cookie: a.cookie },
  body: duplicate,
});
assert.equal(r.status, 409);
const unsupported = new FormData();
unsupported.append("mode", "csv");
unsupported.append(
  "file",
  new File(["hello"], "unsupported.bin", { type: "application/octet-stream" }),
);
r = await fetch(base + "/api/extract", {
  method: "POST",
  headers: { origin: base, cookie: a.cookie },
  body: unsupported,
});
assert.equal(r.status, 400);
const ai = new FormData();
ai.append("mode", "ai");
ai.append("consent", "yes");
ai.append("file", new File(["sample"], "sample.txt", { type: "text/plain" }));
r = await fetch(base + "/api/workspace", { headers: { cookie: a.cookie } });
data = await r.json();
if (!data.aiAvailable) {
  r = await fetch(base + "/api/extract", {
    method: "POST",
    headers: { origin: base, cookie: a.cookie },
    body: ai,
  });
  assert.equal(r.status, 503);
} else {
  assert.equal("key" in data.ai, false);
  assert.equal("apiKey" in data.ai, false);
  ai.set("provider", data.ai.provider === "fireworks" ? "openai" : "fireworks");
  r = await fetch(base + "/api/extract", {
    method: "POST",
    headers: { origin: base, cookie: a.cookie },
    body: ai,
  });
  assert.equal(r.status, 409);
  assert.match(
    ((await r.json()) as { error: string }).error,
    /provider changed/,
  );
  ai.set("provider", data.ai.provider);
  ai.set("consent", "no");
  r = await fetch(base + "/api/extract", {
    method: "POST",
    headers: { origin: base, cookie: a.cookie },
    body: ai,
  });
  assert.equal(r.status, 400);
  if (data.ai.provider === "fireworks") {
    ai.set("consent", "yes");
    ai.set(
      "file",
      new File(["%PDF"], "sample.pdf", { type: "application/pdf" }),
    );
    r = await fetch(base + "/api/extract", {
      method: "POST",
      headers: { origin: base, cookie: a.cookie },
      body: ai,
    });
    assert.equal(r.status, 400);
    assert.match(
      ((await r.json()) as { error: string }).error,
      /every document page/,
    );
  }
}
r = await post(
  "/api/workspace",
  { action: "report", revision: 0, lotId: "lot-a" },
  b.cookie,
);
assert.equal(r.status, 200);
data = await r.json();
assert.equal(data.workspace.reports[0].confirmedPacks, 1440);
assert.doesNotMatch(data.workspace.reports[0].content, /Unresolved exposure/);
r = await post(
  "/api/workspace",
  { action: "reset", revision: 1, confirm: "RESET" },
  b.cookie,
);
assert.equal(r.status, 200);
data = await r.json();
assert.equal(data.workspace.revision, 2);
assert.equal(traceLot(data.workspace, "lot-a").confirmedPacks, 1440);
assert.equal(data.workspace.documents.length, 7);
console.log(
  "PASS: session isolation, origin checks, stale writes, report snapshots, pending extraction, reviewed import, original-file retrieval, duplicate rejection, provider consent/configuration guards, cross-session draft/file isolation. No live AI requests made by this suite.",
);
