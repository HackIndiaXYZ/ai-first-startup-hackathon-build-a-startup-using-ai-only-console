import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { seedPharmaWorkspace } from "../lib/pharma/seed";
import { applyPharmaAction } from "../lib/pharma/domain";
import type { PharmaWorkspace } from "../lib/pharma/types";

// Exercise production SQL, replacing only its platform binding, not its query logic.
const env: { DB?: unknown; BUCKET?: unknown } = {};
Object.assign(globalThis, { __recallscopePharmaStoreTestEnv: env });
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__recallscopePharmaStoreTestEnv;", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const store = await import("../lib/pharma/store");
const teamRoute = await import("../app/api/pharma/team/route");
const healthRoute = await import("../app/api/health/route");
const retentionRoute = await import("../app/api/pharma/retention/route");
const pharmaRoute = await import("../app/api/pharma/route");
hooks.deregister();

let sql: DatabaseSync;
let blobs: Map<string, string>;
let uploadedAt: Map<string, Date>;
let deletedKeys: string[];
let maxBinds = 0;
let beforeBatch: ((statements: Statement[]) => void) | undefined;
class Statement {
  values: (string | number | null)[] = [];
  constructor(public query: string) {}
  bind(...values: (string | number | null)[]) { this.values = values; maxBinds = Math.max(maxBinds, values.length); return this; }
  async first<T>() { return (sql.prepare(this.query).get(...this.values) ?? null) as T | null; }
  async all() { return { results: sql.prepare(this.query).all(...this.values), meta: { changes: 0 }, success: true }; }
  async run() { const result = sql.prepare(this.query).run(...this.values); return { results: [], meta: { changes: Number(result.changes) }, success: true }; }
}
beforeEach(() => {
  sql = new DatabaseSync(":memory:"); sql.exec("PRAGMA foreign_keys=ON");
  sql.exec(readFileSync(new URL("../drizzle/0002_real_shinobi_shaw.sql", import.meta.url), "utf8"));
  sql.exec(readFileSync(new URL("../drizzle/0003_fuzzy_shatterstar.sql", import.meta.url), "utf8"));
  blobs = new Map(); uploadedAt = new Map(); deletedKeys = []; maxBinds = 0; beforeBatch = undefined;
  env.DB = { prepare: (query: string) => new Statement(query), async batch(statements: Statement[]) {
    beforeBatch?.(statements);
    sql.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map(statement => {
        const compiled = sql.prepare(statement.query);
        if (compiled.columns().length) return { results: compiled.all(...statement.values), meta: { changes: 0 }, success: true };
        const result = compiled.run(...statement.values); return { results: [], meta: { changes: Number(result.changes) }, success: true };
      });
      sql.exec("COMMIT"); return results;
    } catch (error) { sql.exec("ROLLBACK"); throw error; }
  } };
  env.BUCKET = {
    async put(key: string, value: string) { blobs.set(key, value); uploadedAt.set(key, new Date()); },
    async get(key: string) { const value = blobs.get(key); return value === undefined ? null : { text: async () => value, size: Buffer.byteLength(value), uploaded: uploadedAt.get(key) ?? new Date() }; },
    async delete(keys: string | string[]) { for (const key of typeof keys === "string" ? [keys] : keys) { deletedKeys.push(key); blobs.delete(key); uploadedAt.delete(key); } },
    async list({ prefix, limit, cursor }: { prefix: string; limit: number; cursor?: string }) {
      const keys = [...blobs.keys()].filter(key => key.startsWith(prefix)).sort(), offset = Number(cursor ?? 0);
      const selected = keys.slice(offset, offset + limit), truncated = keys.length > offset + limit;
      return { objects: selected.map(key => ({ key, size: Buffer.byteLength(blobs.get(key)!), uploaded: uploadedAt.get(key) ?? new Date() })), truncated, cursor: truncated ? String(offset + limit) : undefined };
    },
  };
});
afterEach(() => sql.close());
const now = "2026-10-03T10:00:00Z";
const access = { role: "admin" as const, displayName: "Synthetic operator", signedIn: false, secured: false, owner: false, signInPath: "/signin-with-chatgpt" };
const make = (id = "store-fixture") => seedPharmaWorkspace(id, now, "complete");
const serialized = (value: unknown) => JSON.parse(JSON.stringify(value));
function receipt(w: PharmaWorkspace, id: string, quantity = 10) {
  return applyPharmaAction(w, { type: "receipt", batchId: "batch-para-002", locationId: "loc-central", supplierId: "supplier-northstar", quantity, unit: "box", reference: id, reason: "Verified authored source receipt", evidence: { sourceId: "src-receipts", line: 3 } }, { now, id, actor: access.displayName, role: access.role });
}

test("actual D1 storage SQL round-trips ordered records, source hashes and bounded bindings", async () => {
  const w = make(); await store.createWorkspace(w, null);
  const loaded = await store.loadWorkspace(w.id);
  assert.deepEqual(loaded, serialized(w));
  assert.ok(loaded!.sources.every(source => /^[a-f0-9]{64}$/.test(source.hash!)));
  assert.ok(maxBinds <= 100, `D1 statement has ${maxBinds} bindings`);
  assert.equal(await store.loadWorkspace("other"), null);
});

test("two saves from one revision produce one winner with no losing movements or request ID", async () => {
  const w = make(); await store.createWorkspace(w, null);
  const a = receipt(w, "concurrent-a"), b = receipt(w, "concurrent-b");
  const results = await Promise.allSettled([store.saveWorkspace(a, w, "request-a", "digest-a", access), store.saveWorkspace(b, w, "request-b", "digest-b", access)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const saved = await store.loadWorkspace(w.id);
  assert.equal(saved!.movements.filter(movement => movement.reference.startsWith("concurrent-")).length, 1);
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_requests").get()!.n), 1);
  const winner = saved!.movements.find(movement => movement.reference.startsWith("concurrent-"))!.reference.endsWith("a") ? "a" : "b";
  assert.equal(await store.priorRequest(w.id, `request-${winner}`, `digest-${winner}`), true);
  await assert.rejects(() => store.priorRequest(w.id, `request-${winner}`, "different-action"), /different action/);
});

test("a uniqueness failure rolls back metadata and all inserted records", async () => {
  const w = make(); await store.createWorkspace(w, null);
  const a = receipt(w, "rollback-first");
  await store.saveWorkspace(a, w, "same-request", "first", access);
  const b = receipt(a, "rollback-second");
  await assert.rejects(() => store.saveWorkspace(b, a, "same-request", "second", access), /UNIQUE/);
  assert.deepEqual(await store.loadWorkspace(w.id), serialized(a));
});

test("role changes between validation and save fail atomically", async () => {
  const w = make(); const user = { id: "owner-1", email: "owner@example.invalid", name: "Owner" };
  await store.createWorkspace(w, user);
  const next = receipt(w, "role-race");
  sql.prepare("UPDATE pharma_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(w.id, user.id);
  await assert.rejects(() => store.saveWorkspace(next, w, "role-race-request", "role-race-digest", { ...access, signedIn: true, secured: true, userId: user.id }), /workspace changed/i);
  assert.deepEqual(await store.loadWorkspace(w.id), serialized(w));
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_requests").get()!.n), 0);
});

test("large records use isolated R2 pointers and reject cross-workspace substitutions", async () => {
  const w = make(); w.sources[0].text += "x".repeat(181000);
  await store.createWorkspace(w, null);
  assert.ok(blobs.size > 0);
  assert.equal((await store.loadWorkspace(w.id))!.sources[0].text, w.sources[0].text);
  sql.prepare("UPDATE pharma_records SET data=? WHERE workspace_id=? AND collection='sources' AND record_id=?").run(JSON.stringify({ $recordBlob: "pharma/foreign/records/private.json" }), w.id, w.sources[0].id);
  blobs.set("pharma/foreign/records/private.json", JSON.stringify({ ...w.sources[0], text: "foreign secret" }));
  await assert.rejects(() => store.loadWorkspace(w.id), /could not be verified/);
});

test("session cookies contain random tokens while SQLite stores only hashes", async () => {
  const w = make(); await store.createWorkspace(w, null);
  const cookie = await store.issueSession(new Request("https://app.example.invalid/"), w.id);
  const token = /recallscope_pharma=([a-f0-9]{64})/.exec(cookie)![1];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Secure/);
  const saved = sql.prepare("SELECT token_hash FROM pharma_sessions").get()!;
  assert.notEqual(saved.token_hash, token);
  assert.equal(saved.token_hash, await store.hashText(token));
});

test("session reads project current UTC dates without changing sample clocks, stored revisions or reports", async () => {
  const user = { id: "clock-owner", email: "clock@example.invalid", name: "Clock owner" };
  const w = make("clock-live"); w.synthetic = false;
  await store.createWorkspace(w, user);
  const request = new Request("https://app.example.invalid/api/pharma", { headers: { "oai-authenticated-user-id": user.id, "oai-authenticated-user-email": user.email } });
  const before = await store.pharmaSession(request, false, "2026-10-31T23:59:59Z");
  const after = await store.pharmaSession(request, false, "2026-11-01T00:00:00Z");
  assert.equal(before.workspace.asOf, "2026-10-31");
  assert.equal(after.workspace.asOf, "2026-11-01");
  assert.equal(after.workspace.revision, w.revision);
  assert.deepEqual(after.workspace.reports, serialized(w.reports));
  assert.equal((await store.loadWorkspace(w.id))!.asOf, w.asOf);
  const sample = make("clock-sample"); await store.createWorkspace(sample, null);
  const cookie = await store.issueSession(new Request("https://app.example.invalid/"), sample.id);
  const sampleSession = await store.pharmaSession(new Request("https://app.example.invalid/", { headers: { Cookie: cookie.split(";")[0] } }), false, now);
  assert.equal(sampleSession.workspace.asOf, sample.asOf);
});

test("workspace GET and restore responses refresh a live date without rewriting report snapshot dates", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-01T00:00:00Z") });
  const user = { id: "route-clock-owner", email: "route-clock@example.invalid", name: "Route clock owner" };
  const w = make("route-clock-live"); w.synthetic = false;
  await store.createWorkspace(w, user);
  const headers = { Origin: "https://app.example.invalid", "Content-Type": "application/json", "oai-authenticated-user-id": user.id, "oai-authenticated-user-email": user.email };
  const result = await pharmaRoute.GET(new Request("https://app.example.invalid/api/pharma", { headers }));
  assert.equal(result.status, 200, await result.clone().text());
  const current = (await result.json() as { workspace: PharmaWorkspace }).workspace;
  assert.equal(current.asOf, "2026-11-01");
  const backup = structuredClone(w); backup.asOf = "2000-01-01";
  const restored = await pharmaRoute.POST(new Request("https://app.example.invalid/api/pharma", { method: "POST", headers, body: JSON.stringify({ revision: current.revision, requestId: "restore-clock-regression", action: { type: "workspace.restore", backup, reason: "Restore a previously saved workspace archive" } }) }));
  assert.equal(restored.status, 200, await restored.clone().text());
  const next = (await restored.json() as { workspace: PharmaWorkspace }).workspace;
  assert.equal(next.asOf, "2026-11-01");
  assert.equal((await store.loadWorkspace(w.id))!.asOf, "2026-11-01");
  assert.deepEqual(next.reports.map(report => report.asOf), w.reports.map(report => report.asOf));
});

test("bounded JSON bodies reject oversized streams even without content-length", async () => {
  const request = new Request("http://localhost/action", { method: "POST", body: JSON.stringify({ text: "x".repeat(300) }) });
  await assert.rejects(() => store.requestBody(request, 100), /too large/);
  await assert.rejects(() => store.requestBody(new Request("http://localhost/action", { method: "POST", body: "{broken" }), 100), /not valid JSON/);
  assert.deepEqual(await store.requestBody(new Request("http://localhost/action", { method: "POST", body: '{"ok":true}' })), { ok: true });
});

test("health checks database availability without exposing details or creating workspace state", async () => {
  const healthy = await healthRoute.GET();
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { status: "ok" });
  assert.equal(healthy.headers.get("Cache-Control"), "no-store");
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_workspaces").get()!.n), 0);
  env.DB = undefined;
  const missing = await healthRoute.GET();
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), { status: "unavailable" });
  env.DB = { prepare() { throw new Error("private database name and secret connection details"); } };
  const failed = await healthRoute.GET();
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { status: "unavailable" });
});

const owner = { id: "owner-1", email: "owner@example.invalid", name: "Owner" };
const invitee = { id: "reader-1", email: "reader@example.invalid", name: "Reader" };
async function teamRequest(w: PharmaWorkspace, user: typeof owner, body: unknown) {
  const cookie = await store.issueSession(new Request("https://app.example.invalid/"), w.id);
  return teamRoute.POST(new Request("https://app.example.invalid/api/pharma/team", { method: "POST", headers: { Origin: "https://app.example.invalid", "Content-Type": "application/json", Cookie: cookie.split(";")[0], "oai-authenticated-user-id": user.id, "oai-authenticated-user-email": user.email, "oai-authenticated-user-full-name": user.name }, body: JSON.stringify(body) }));
}
function auditCount(w: PharmaWorkspace) { return Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_records WHERE workspace_id=? AND collection='audit'").get(w.id)!.n); }
function revision(w: PharmaWorkspace) { return Number(sql.prepare("SELECT revision FROM pharma_workspaces WHERE id=?").get(w.id)!.revision); }

test("claim changes ownership, revision and audit in one transaction; a replay is a no-op", async () => {
  const w = make(); await store.createWorkspace(w, null);
  const before = auditCount(w), rev = revision(w);
  const claimed = await teamRequest(w, owner, { type: "claim" });
  assert.equal(claimed.status, 200, await claimed.clone().text());
  assert.equal(revision(w), rev + 1); assert.equal(auditCount(w), before + 1);
  assert.equal(sql.prepare("SELECT role FROM pharma_members WHERE workspace_id=? AND user_id=?").get(w.id, owner.id)!.role, "admin");
  const again = await teamRequest(w, owner, { type: "claim" });
  assert.equal(again.status, 200); assert.equal(auditCount(w), before + 1); assert.equal(revision(w), rev + 1);
});

test("a failed claim audit rolls back ownership and membership", async () => {
  const w = make(); await store.createWorkspace(w, null);
  sql.exec("CREATE TRIGGER fail_claim_audit BEFORE INSERT ON pharma_records WHEN NEW.collection='audit' AND json_extract(NEW.data,'$.action')='team.claim' BEGIN SELECT RAISE(ABORT,'audit write failed'); END");
  const before = auditCount(w), rev = revision(w);
  const response = await teamRequest(w, owner, { type: "claim" });
  assert.notEqual(response.status, 200);
  assert.equal(sql.prepare("SELECT owner_id FROM pharma_workspaces WHERE id=?").get(w.id)!.owner_id, null);
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_members WHERE workspace_id=?").get(w.id)!.n), 0);
  assert.equal(auditCount(w), before); assert.equal(revision(w), rev);
});

test("revoking admin access at invite commit creates no invitation, revision or false audit", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  const admin = { id: "other-admin", email: "admin@example.invalid", name: "Other admin" };
  sql.prepare("INSERT INTO pharma_members(workspace_id,user_id,email,name,role,joined_at) VALUES (?,?,?,?,?,?)").run(w.id, admin.id, admin.email, admin.name, "admin", now);
  const before = auditCount(w), rev = revision(w);
  beforeBatch = statements => {
    if (statements[0].query.startsWith("INSERT INTO pharma_invitations")) {
      beforeBatch = undefined;
      sql.prepare("UPDATE pharma_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(w.id, admin.id);
    }
  };
  const response = await teamRequest(w, admin, { type: "invite", email: invitee.email, role: "viewer" });
  assert.equal(response.status, 409);
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_invitations").get()!.n), 0);
  assert.equal(auditCount(w), before); assert.equal(revision(w), rev);
});

test("accept uses the invited role, consumes the invitation once and audits that actual role", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  const invited = await teamRequest(w, owner, { type: "invite", email: invitee.email, role: "viewer" });
  assert.equal(invited.status, 200, await invited.clone().text());
  const token = new URL((await invited.json() as { inviteUrl: string }).inviteUrl).searchParams.get("invite")!;
  const before = auditCount(w), rev = revision(w);
  const accepted = await teamRequest(w, invitee, { type: "accept", token });
  assert.equal(accepted.status, 200, await accepted.clone().text());
  assert.equal(sql.prepare("SELECT role FROM pharma_members WHERE workspace_id=? AND user_id=?").get(w.id, invitee.id)!.role, "viewer");
  const event = sql.prepare("SELECT data FROM pharma_records WHERE workspace_id=? AND collection='audit' ORDER BY position DESC LIMIT 1").get(w.id)!;
  assert.equal(JSON.parse(String(event.data)).role, "viewer");
  assert.equal(auditCount(w), before + 1); assert.equal(revision(w), rev + 1);
  const replay = await teamRequest(w, invitee, { type: "accept", token });
  assert.equal(replay.status, 403); assert.equal(auditCount(w), before + 1); assert.equal(revision(w), rev + 1);
});

test("an invitation consumed during acceptance cannot falsely succeed or append audit", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  const invited = await teamRequest(w, owner, { type: "invite", email: invitee.email, role: "quality" });
  const token = new URL((await invited.json() as { inviteUrl: string }).inviteUrl).searchParams.get("invite")!;
  const before = auditCount(w), rev = revision(w);
  beforeBatch = statements => {
    if (statements[0].query.startsWith("INSERT INTO pharma_members")) {
      beforeBatch = undefined; sql.prepare("UPDATE pharma_invitations SET accepted_by='racing-user' WHERE workspace_id=?").run(w.id);
    }
  };
  const response = await teamRequest(w, invitee, { type: "accept", token });
  assert.equal(response.status, 409);
  assert.equal(sql.prepare("SELECT role FROM pharma_members WHERE workspace_id=? AND user_id=?").get(w.id, invitee.id), undefined);
  assert.equal(auditCount(w), before); assert.equal(revision(w), rev);
});

test("no-op role changes and missing invite cancellation do not manufacture audit events", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  sql.prepare("INSERT INTO pharma_members(workspace_id,user_id,email,name,role,joined_at) VALUES (?,?,?,?,?,?)").run(w.id, invitee.id, invitee.email, invitee.name, "viewer", now);
  const before = auditCount(w), rev = revision(w);
  const unchanged = await teamRequest(w, owner, { type: "role", userId: invitee.id, role: "viewer" });
  assert.equal(unchanged.status, 200);
  assert.equal((await unchanged.json() as { unchanged: boolean }).unchanged, true);
  assert.equal((await teamRequest(w, owner, { type: "cancel-invite", email: "absent@example.invalid" })).status, 409);
  assert.equal(auditCount(w), before); assert.equal(revision(w), rev);
  const changed = await teamRequest(w, owner, { type: "role", userId: invitee.id, role: "operations" });
  assert.equal(changed.status, 200, await changed.clone().text());
  assert.equal(auditCount(w), before + 1); assert.equal(revision(w), rev + 1);
  assert.equal((await teamRequest(w, owner, { type: "revoke", userId: owner.id })).status, 400);
  assert.equal(revision(w), rev + 1);
});

function draftFixture(w: PharmaWorkspace, expired = true) {
  const id = crypto.randomUUID(), sourceId = crypto.randomUUID();
  const createdAt = new Date(Date.now() - (expired ? 9 : 1) * 86400000).toISOString();
  const key = `pharma/${w.id}/drafts/${id}.json`, fileKey = `pharma/${w.id}/files/${sourceId}`;
  blobs.set(key, JSON.stringify({ id, createdAt, source: { id: sourceId, fileKey }, preview: { records: [] } }));
  uploadedAt.set(key, new Date(createdAt)); blobs.set(fileKey, "Original source bytes");
  return { id, key, fileKey };
}
async function retentionRequest(w: PharmaWorkspace, user: typeof owner | null, body?: unknown) {
  const cookie = await store.issueSession(new Request("https://app.example.invalid/"), w.id);
  const request = new Request("https://app.example.invalid/api/pharma/retention", { method: body ? "POST" : "GET", headers: { Origin: "https://app.example.invalid", "Content-Type": "application/json", Cookie: cookie.split(";")[0], ...(user ? { "oai-authenticated-user-id": user.id, "oai-authenticated-user-email": user.email, "oai-authenticated-user-full-name": user.name } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return body ? retentionRoute.POST(request) : retentionRoute.GET(request);
}
const cleanupBody = (w: PharmaWorkspace, ids: string[]) => ({ revision: revision(w), requestId: crypto.randomUUID(), ids, confirm: "REMOVE_EXPIRED_PREVIEWS" });

test("retention removes only explicitly selected expired metadata and keeps original and foreign files", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  const old = draftFixture(w), fresh = draftFixture(w, false), foreign = draftFixture(make("foreign-workspace"));
  const listed = await retentionRequest(w, owner);
  assert.equal(listed.status, 200);
  const listing = await listed.json() as { candidates: { id: string }[] };
  assert.deepEqual(listing.candidates.map(row => row.id), [old.id]);
  const before = auditCount(w), rev = revision(w), body = cleanupBody(w, [old.id]);
  const response = await retentionRequest(w, owner, body);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json() as { removed: number }).removed, 1);
  assert.deepEqual(deletedKeys, [old.key]);
  assert.ok(blobs.has(old.fileKey)); assert.ok(blobs.has(fresh.key)); assert.ok(blobs.has(foreign.key));
  assert.equal(auditCount(w), before + 1); assert.equal(revision(w), rev + 1);
  const replay = await retentionRequest(w, owner, body);
  assert.equal(replay.status, 200); assert.equal((await replay.json() as { replayed: boolean }).replayed, true);
  assert.equal(deletedKeys.length, 1); assert.equal(auditCount(w), before + 1);
});

test("retention requires an account-backed administrator and protects report and archived source references", async () => {
  const w = make(); const sourceDraft = draftFixture(w), reportDraft = draftFixture(w);
  w.sources[0].fileKey = sourceDraft.key; w.sources[0].archived = true;
  w.reports[0].sources[0].fileKey = reportDraft.key;
  await store.createWorkspace(w, owner);
  sql.prepare("INSERT INTO pharma_members(workspace_id,user_id,email,name,role,joined_at) VALUES (?,?,?,?,?,?)").run(w.id, invitee.id, invitee.email, invitee.name, "viewer", now);
  assert.equal((await retentionRequest(w, invitee)).status, 403);
  const listed = await retentionRequest(w, owner);
  assert.deepEqual((await listed.json() as { candidates: unknown[] }).candidates, []);
  assert.equal((await retentionRequest(w, owner, cleanupBody(w, [reportDraft.id]))).status, 409);
  assert.equal(deletedKeys.length, 0);
  const guest = make("guest-retention"); await store.createWorkspace(guest, null);
  assert.equal((await retentionRequest(guest, null)).status, 403);
});

test("retention does not delete recent, malformed or foreign draft IDs or proceed after an audit failure", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  const fresh = draftFixture(w, false), bad = draftFixture(w), old = draftFixture(w), foreign = draftFixture(make("foreign"));
  blobs.set(bad.key, "{broken");
  for (const id of [fresh.id, bad.id, foreign.id]) assert.equal((await retentionRequest(w, owner, cleanupBody(w, [id]))).status, 409);
  assert.equal((await retentionRequest(w, owner, cleanupBody(w, ["../files/private"])) ).status, 400);
  sql.exec("CREATE TRIGGER fail_cleanup_audit BEFORE INSERT ON pharma_records WHEN NEW.collection='audit' AND json_extract(NEW.data,'$.action')='retention.cleanup.requested' BEGIN SELECT RAISE(ABORT,'audit write failed'); END");
  const before = auditCount(w), rev = revision(w);
  const failed = await retentionRequest(w, owner, cleanupBody(w, [old.id]));
  assert.notEqual(failed.status, 200);
  assert.equal(auditCount(w), before); assert.equal(revision(w), rev); assert.equal(deletedKeys.length, 0);
  assert.ok(blobs.has(old.key));
});

test("retention reviews at most twenty objects and refuses stale approval", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  const drafts = Array.from({ length: 25 }, () => draftFixture(w));
  const listed = await retentionRequest(w, owner);
  const listing = await listed.json() as { candidates: unknown[]; nextCursor: string };
  assert.equal(listing.candidates.length, 20); assert.ok(listing.nextCursor);
  assert.equal((await retentionRequest(w, owner, cleanupBody(w, drafts.map(row => row.id)))).status, 400);
  const stale = { ...cleanupBody(w, [drafts[0].id]), revision: revision(w) - 1 };
  assert.equal((await retentionRequest(w, owner, stale)).status, 409);
  assert.equal(deletedKeys.length, 0);
});

test("an unavailable object deletion records only authorisation and reports an unconfirmed outcome", async () => {
  const w = make(); await store.createWorkspace(w, owner);
  const old = draftFixture(w), rev = revision(w);
  (env.BUCKET as { delete: (keys: string[]) => Promise<void> }).delete = async () => { throw new Error("private storage endpoint failure"); };
  const result = await retentionRequest(w, owner, cleanupBody(w, [old.id]));
  assert.equal(result.status, 503);
  const body = await result.json() as { error: string; workspace: PharmaWorkspace };
  assert.match(body.error, /removal could not be confirmed/);
  assert.doesNotMatch(body.error, /private storage|unchanged/);
  assert.equal(body.workspace.revision, rev + 1);
  const audit = (await store.loadWorkspace(w.id))!.audit.at(-1)!;
  assert.equal(audit.action, "retention.cleanup.requested");
  assert.match(audit.after!, /not deletion success/);
  assert.ok(blobs.has(old.key));
});

test("persistence rejects reserved blob fields in every record collection before any write", async () => {
  for (const collection of store.collections) {
    const w = make(`reserved-${collection}`);
    const records = (w[collection] ??= []) as unknown as Record<string, unknown>[];
    if (!records.length) records.push({ id: `reserved-${collection}` });
    records[0].$recordBlob = `pharma/${w.id}/records/${crypto.randomUUID()}.json`;
    await assert.rejects(() => store.createWorkspace(w, null), /reserved storage field/, collection);
  }
  const metadata = make("reserved-metadata"); Object.assign(metadata, { $recordBlob: null });
  await assert.rejects(() => store.createWorkspace(metadata, null), /reserved storage field/);
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_workspaces").get()!.n), 0);
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_records").get()!.n), 0);
  assert.equal(blobs.size, 0);
});

test("nested report and extension fields cannot smuggle a blob reference into a save", async () => {
  const w = make(); w.sources[0].text += '\nLiteral source text mentioning "$recordBlob" is ordinary evidence.';
  await store.createWorkspace(w, null);
  for (const value of [null, "", false, { key: "not-a-reference" }]) {
    const next = structuredClone(w); next.revision++;
    Object.assign(next.reports[0].sources[0], { extra: [{ $recordBlob: value }] });
    await assert.rejects(() => store.saveWorkspace(next, w, crypto.randomUUID(), "reserved-nested", access), /reserved storage field/);
  }
  assert.deepEqual(await store.loadWorkspace(w.id), serialized(w));
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_requests").get()!.n), 0);
  assert.equal(blobs.size, 0);
});

test("restore and manual source routes reject reserved storage fields without changing saved data", async () => {
  const w = make(); await store.createWorkspace(w, null);
  const cookie = await store.issueSession(new Request("https://app.example.invalid/"), w.id);
  const backup = structuredClone(w);
  Object.assign(backup.reports[0].sources[0], { $recordBlob: `pharma/${w.id}/records/${crypto.randomUUID()}.json` });
  const source = { id: "untrusted-pointer", name: "Authored fixture", kind: "Reference", text: "Authored synthetic source", mode: "manual", createdAt: now, $recordBlob: null };
  for (const action of [{ type: "workspace.restore", backup, reason: "Restore the authored verification fixture" }, { type: "source.add", source }]) {
    const response = await pharmaRoute.POST(new Request("https://app.example.invalid/api/pharma", { method: "POST", headers: { Origin: "https://app.example.invalid", "Content-Type": "application/json", Cookie: cookie.split(";")[0] }, body: JSON.stringify({ revision: w.revision, requestId: crypto.randomUUID(), action }) }));
    assert.equal(response.status, 400);
    assert.match((await response.json() as { error: string }).error, /reserved storage field/);
    assert.deepEqual(await store.loadWorkspace(w.id), serialized(w));
  }
  assert.equal(Number(sql.prepare("SELECT COUNT(*) AS n FROM pharma_requests").get()!.n), 0);
  assert.equal(blobs.size, 0);
});

test("stored blob dereferencing accepts only exact scoped envelopes and matching record identities", async () => {
  const w = make(); await store.createWorkspace(w, null);
  const key = `pharma/${w.id}/records/${crypto.randomUUID()}.json`, original = w.sources[0];
  let reads = 0;
  const bucket = env.BUCKET as { get: (key: string) => Promise<unknown> }, get = bucket.get;
  bucket.get = async candidate => { reads++; return get(candidate); };
  const replace = (record: unknown) => sql.prepare("UPDATE pharma_records SET data=? WHERE workspace_id=? AND collection='sources' AND record_id=?").run(JSON.stringify(record), w.id, original.id);
  const invalid = [
    { ...original, $recordBlob: key }, { $recordBlob: key, other: true }, { $recordBlob: "" }, { $recordBlob: null },
    { $recordBlob: false }, { $recordBlob: 42 }, { $recordBlob: `pharma/${w.id}/records/../private.json` },
    { $recordBlob: `${key}/extra` }, { $recordBlob: `pharma/another/records/${crypto.randomUUID()}.json` },
    { ...original, extra: { $recordBlob: key } },
  ];
  for (const record of invalid) { replace(record); await assert.rejects(() => store.loadWorkspace(w.id), /could not be verified/); }
  assert.equal(reads, 0, "Malformed pointers must not trigger an object-store read");
  replace({ $recordBlob: key });
  blobs.set(key, JSON.stringify({ ...original, id: "another-record" }));
  await assert.rejects(() => store.loadWorkspace(w.id), /could not be verified/);
  blobs.set(key, JSON.stringify({ ...original, extra: { $recordBlob: key } }));
  await assert.rejects(() => store.loadWorkspace(w.id), /could not be verified/);
  blobs.set(key, JSON.stringify(original));
  assert.equal((await store.loadWorkspace(w.id))!.sources[0].id, original.id);
});
