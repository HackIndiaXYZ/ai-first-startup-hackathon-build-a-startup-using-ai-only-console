import { env } from "cloudflare:workers";
import { AppError, db } from "../store";
import { fingerprint } from "../document-input";
import { seedPharmaWorkspace } from "./seed";
import { withCurrentReferenceDate } from "./domain";
import type { PharmaRole, PharmaWorkspace } from "./types";

export const collections = ["products", "batches", "locations", "partners", "sources", "movements", "shipments", "recalls", "acknowledgments", "temperatures", "reports", "audit", "packages"] as const;
type Collection = typeof collections[number];
type Row = { collection: Collection; record_id: string; data: string; position: number };
type MetaRow = { id: string; revision: number; metadata: string; owner_id: string | null };
export type PharmaAccess = { role: PharmaRole; displayName: string; signedIn: boolean; secured: boolean; signInPath: string; userId?: string; email?: string; owner: boolean };
export type PharmaSession = { workspace: PharmaWorkspace; access: PharmaAccess; cookie?: string };

export function identity(req: Request) {
  const id = req.headers.get("oai-authenticated-user-id");
  const email = req.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  let name = req.headers.get("oai-authenticated-user-full-name") || email;
  if (req.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { name = decodeURIComponent(name); } catch { name = email; }
  }
  return { id, email: email.toLowerCase(), name: name.slice(0, 160) };
}

export async function hashText(value: string) {
  return fingerprint(new TextEncoder().encode(value).buffer);
}

export function secretToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}

export async function issueSession(req: Request, workspaceId: string) {
  const token = secretToken();
  await db().prepare("INSERT INTO pharma_sessions(token_hash,workspace_id,expires_at) VALUES (?,?,?)")
    .bind(await hashText(token), workspaceId, new Date(Date.now() + 30 * 86400000).toISOString()).run();
  return `recallscope_pharma=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}

function assertNoStorageFields(value: unknown) {
  const pending: unknown[] = [value], seen = new WeakSet<object>();
  while (pending.length) {
    const item = pending.pop();
    if (item === null || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    if (Object.hasOwn(item, "$recordBlob")) throw new AppError("Workspace data contains a reserved storage field. Remove it before importing or saving.");
    pending.push(...Object.values(item));
  }
}

function storedObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("A stored document could not be verified.", 500);
  return value as Record<string, unknown>;
}

/** Only persistence-created, single-field envelopes can dereference an R2 row. */
function storedBlobKey(value: unknown, workspaceId: string) {
  const record = storedObject(value);
  if (!Object.hasOwn(record, "$recordBlob")) return undefined;
  const key = record.$recordBlob, prefix = `pharma/${workspaceId}/records/`;
  if (Object.keys(record).length !== 1 || typeof key !== "string" || !key.startsWith(prefix) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json$/.test(key.slice(prefix.length))) throw new AppError("A stored document could not be verified.", 500);
  return key;
}

function verifiedStoredData(value: unknown, recordId?: string) {
  const record = storedObject(value);
  try { assertNoStorageFields(record); }
  catch { throw new AppError("A stored document could not be verified.", 500); }
  if (recordId !== undefined && record.id !== recordId) throw new AppError("A stored document could not be verified.", 500);
  return record;
}

function splitWorkspace(w: PharmaWorkspace) {
  // This boundary also covers restores, nested report snapshots and metadata.
  // User data must never be interpreted as an internal large-record reference.
  assertNoStorageFields(w);
  const metadata = { ...w } as Record<string, unknown>;
  const rows: Row[] = [];
  for (const collection of collections) {
    delete metadata[collection];
    for (const [position, record] of (w[collection] ?? []).entries()) rows.push({ collection, record_id: record.id, data: JSON.stringify(record), position });
  }
  if (rows.length > 18000) throw new AppError("This workspace supports up to 18,000 records. Export an archive before starting another workspace.", 413);
  if (rows.reduce((n, row) => n + row.data.length, 0) > 18_000_000) throw new AppError("The workspace has reached its document and report allowance. Export a backup before continuing.", 413);
  return { metadata: JSON.stringify(metadata), rows };
}

async function prepareStoredRows(w: PharmaWorkspace, rows: Row[]) {
  const stored: Row[] = [];
  try {
  for (const row of rows) {
    if (row.data.length <= 180000) { stored.push(row); continue; }
    if (!env.BUCKET) throw new AppError("Document storage is unavailable. Your changes have not been saved.", 503);
    const key = `pharma/${w.id}/records/${crypto.randomUUID()}.json`;
    await env.BUCKET.put(key, row.data, { httpMetadata: { contentType: "application/json" } });
    stored.push({ ...row, data: JSON.stringify({ $recordBlob: key }) });
  }
  return stored;
  } catch (error) {
    await discardPreparedBlobs(w.id, stored);
    throw error;
  }
}

async function discardPreparedBlobs(workspaceId: string, rows: Row[]) {
  const candidates = rows.flatMap(row => {
    const key = storedBlobKey(JSON.parse(row.data), workspaceId);
    return key ? [{ key, data: row.data }] : [];
  });
  // An unavailable response can have an unknown commit outcome. Never delete a
  // blob referenced by a committed row, or when the verification read fails.
  try {
    const keys: string[] = [];
    for (const candidate of candidates) {
      const referenced = await db().prepare("SELECT 1 AS found FROM pharma_records WHERE workspace_id=? AND data=? LIMIT 1").bind(workspaceId, candidate.data).first();
      if (!referenced) keys.push(candidate.key);
    }
    if (keys.length && env.BUCKET) await env.BUCKET.delete(keys);
  } catch { console.error("pharma: uncommitted blob cleanup unavailable"); }
}

function insertRows(workspaceId: string, rows: Row[], mutation?: string): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += 18) {
    const group = rows.slice(i, i + 18);
    const params: (string | number)[] = [];
    const selects = group.map(row => {
      params.push(workspaceId, row.collection, row.record_id, row.data, row.position);
      return "(?,?,?,?,?)";
    }).join(",");
    if (mutation) params.push(workspaceId, mutation);
    statements.push(db().prepare(`WITH incoming(workspace_id,collection,record_id,data,position) AS (VALUES ${selects}) INSERT INTO pharma_records(workspace_id,collection,record_id,data,position) SELECT * FROM incoming WHERE ${mutation ? "EXISTS (SELECT 1 FROM pharma_workspaces WHERE id=? AND mutation=?)" : "1"} ON CONFLICT(workspace_id,collection,record_id) DO UPDATE SET data=excluded.data,position=excluded.position`).bind(...params));
  }
  return statements;
}

export async function createWorkspace(w: PharmaWorkspace, user: ReturnType<typeof identity>) {
  w.sources = await Promise.all(w.sources.map(async source => ({ ...source, hash: source.hash || await hashText(source.text) })));
  for (const report of w.reports) report.sources = await Promise.all(report.sources.map(async source => ({ ...source, hash: source.hash || await hashText(source.text) })));
  const split = splitWorkspace(w);
  const rows = await prepareStoredRows(w, split.rows);
  const statements = [db().prepare("INSERT INTO pharma_workspaces(id,revision,metadata,owner_id,mutation,updated_at) VALUES (?,?,?,?,?,?)")
    .bind(w.id, w.revision, split.metadata, user?.id ?? null, crypto.randomUUID(), new Date().toISOString()), ...insertRows(w.id, rows)];
  if (user) statements.push(db().prepare("INSERT INTO pharma_members(workspace_id,user_id,email,name,role,joined_at) VALUES (?,?,?,?,?,?)")
    .bind(w.id, user.id, user.email, user.name, "admin", new Date().toISOString()));
  try { await db().batch(statements); }
  catch (error) { await discardPreparedBlobs(w.id, rows); throw error; }
}

export async function loadWorkspace(id: string): Promise<PharmaWorkspace | null> {
  // A batch provides one consistent read snapshot for metadata and all records.
  const result = await db().batch([
    db().prepare("SELECT id,revision,metadata,owner_id FROM pharma_workspaces WHERE id=?").bind(id),
    db().prepare("SELECT collection,record_id,data,position FROM pharma_records WHERE workspace_id=? ORDER BY collection,position,record_id").bind(id),
  ]);
  const meta = result[0].results[0] as MetaRow | undefined;
  if (!meta) return null;
  const w = verifiedStoredData(JSON.parse(meta.metadata)) as PharmaWorkspace;
  w.id = id; w.revision = meta.revision;
  for (const collection of collections) (w[collection] as unknown[]) = [];
  for (const row of result[1].results as Row[]) {
    if (!collections.includes(row.collection)) throw new AppError("A stored collection is unsupported.", 500);
    let record = JSON.parse(row.data);
    const blobKey = storedBlobKey(record, id);
    if (blobKey) {
      const object = await env.BUCKET?.get(blobKey);
      if (!object) throw new AppError("A saved document is temporarily unavailable. Retry shortly.", 503);
      record = JSON.parse(await object.text());
    }
    (w[row.collection] as unknown[]).push(verifiedStoredData(record, row.record_id));
  }
  return w;
}

export async function pharmaSession(req: Request, create = false, now = new Date().toISOString()): Promise<PharmaSession> {
  const user = identity(req);
  const token = req.headers.get("cookie")?.match(/(?:^|;\s*)recallscope_pharma=([a-f0-9]{64})(?:;|$)/)?.[1];
  let id: string | undefined;
  if (token) {
    const row = await db().prepare("SELECT workspace_id FROM pharma_sessions WHERE token_hash=? AND expires_at>?")
      .bind(await hashText(token), now).first<{ workspace_id: string }>();
    id = row?.workspace_id;
  }
  if (!id && user) {
    const row = await db().prepare("SELECT workspace_id FROM pharma_members WHERE user_id=? ORDER BY joined_at LIMIT 1")
      .bind(user.id).first<{ workspace_id: string }>();
    id = row?.workspace_id;
  }
  let cookie: string | undefined;
  if (!id) {
    if (!create) throw new AppError("Your workspace session has expired. Reload to continue.", 401);
    id = crypto.randomUUID();
    await createWorkspace(seedPharmaWorkspace(id, now, "complete"), user);
    cookie = await issueSession(req, id);
  } else if (!token) cookie = await issueSession(req, id);
  const meta = await db().prepare("SELECT owner_id FROM pharma_workspaces WHERE id=?").bind(id).first<{ owner_id: string | null }>();
  if (!meta) throw new AppError("This workspace could not be found.", 404);
  let role: PharmaRole = "admin";
  if (meta.owner_id) {
    if (!user) throw new AppError("Sign in to reopen your saved organisation workspace.", 401);
    const member = await db().prepare("SELECT role FROM pharma_members WHERE workspace_id=? AND user_id=?")
      .bind(id, user.id).first<{ role: PharmaRole }>();
    if (!member) throw new AppError("You do not have access to this workspace.", 403);
    role = member.role;
  }
  const workspace = await loadWorkspace(id);
  if (!workspace) throw new AppError("This workspace could not be loaded.", 404);
  return { workspace: withCurrentReferenceDate(workspace, now), cookie, access: {
    role, displayName: user?.name || "Guest workspace", signedIn: !!user, secured: !!meta.owner_id,
    signInPath: "/signin-with-chatgpt?return_to=%2F", userId: user?.id, email: user?.email,
    owner: !!user && user.id === meta.owner_id,
  } };
}

export async function priorRequest(workspaceId: string, requestId: string, digest: string) {
  const row = await db().prepare("SELECT fingerprint FROM pharma_requests WHERE workspace_id=? AND request_id=?")
    .bind(workspaceId, requestId).first<{ fingerprint: string }>();
  if (row && row.fingerprint !== digest) throw new AppError("This request identifier was already used for a different action.", 409);
  return !!row;
}

export async function saveWorkspace(next: PharmaWorkspace, previous: PharmaWorkspace, requestId: string, digest: string, access: PharmaAccess) {
  if (next.id !== previous.id || next.revision <= previous.revision) throw new AppError("The workspace revision is invalid.");
  const before = splitWorkspace(previous);
  const after = splitWorkspace(next);
  const old = new Map(before.rows.map(row => [`${row.collection}/${row.record_id}`, `${row.position}:${row.data}`]));
  const keys = new Set(after.rows.map(row => `${row.collection}/${row.record_id}`));
  const changed = await prepareStoredRows(next, after.rows.filter(row => old.get(`${row.collection}/${row.record_id}`) !== `${row.position}:${row.data}`));
  const removed = before.rows.filter(row => !keys.has(`${row.collection}/${row.record_id}`));
  const mutation = crypto.randomUUID();
  const statements = [db().prepare("UPDATE pharma_workspaces SET revision=?,metadata=?,mutation=?,updated_at=? WHERE id=? AND revision=? AND (owner_id IS NULL OR EXISTS(SELECT 1 FROM pharma_members WHERE workspace_id=pharma_workspaces.id AND user_id=? AND role=?))")
    .bind(next.revision, after.metadata, mutation, new Date().toISOString(), next.id, previous.revision, access.userId ?? "", access.role), ...insertRows(next.id, changed, mutation)];
  for (let i = 0; i < removed.length; i += 35) {
    const group = removed.slice(i, i + 35);
    statements.push(db().prepare(`DELETE FROM pharma_records WHERE workspace_id=? AND (${group.map(() => "(collection=? AND record_id=?)").join(" OR ")}) AND EXISTS(SELECT 1 FROM pharma_workspaces WHERE id=? AND mutation=?)`)
      .bind(next.id, ...group.flatMap(row => [row.collection, row.record_id]), next.id, mutation));
  }
  statements.push(db().prepare("INSERT INTO pharma_requests(workspace_id,request_id,fingerprint,revision,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM pharma_workspaces WHERE id=? AND mutation=?)")
    .bind(next.id, requestId, digest, next.revision, new Date().toISOString(), next.id, mutation));
  try {
    const result = await db().batch(statements);
    if (result[0].meta.changes !== 1) throw new AppError("This workspace changed in another tab. Refresh before saving; your form has been retained.", 409);
  } catch (error) { await discardPreparedBlobs(next.id, changed); throw error; }
}

export function requireRole(access: PharmaAccess, roles: PharmaRole[]) {
  if (!roles.includes(access.role)) throw new AppError("Your workspace role does not allow this action.", 403);
}

export async function boundedBody(req: Request, max = 300000) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > max) throw new AppError("This request is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new AppError("A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new AppError("This request is too large.", 413); }
    chunks.push(value);
  }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return data;
}

export async function requestBody(req: Request, max = 300000) {
  const data = await boundedBody(req, max);
  try { return JSON.parse(new TextDecoder().decode(data)); }
  catch { throw new AppError("This request is not valid JSON."); }
}

export function pharmaFailure(error: unknown) {
  const status = error instanceof AppError ? error.status : 400;
  const message = error instanceof Error ? error.message : "The operation could not be completed.";
  if (/SQLITE|D1_|database|R2_|fetch failed/i.test(message)) console.error("Pharmaceutical workspace storage:", message.replace(/(?:Bearer\s+|sk-|fw_)[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 500));
  const safe = /SQLITE|D1_|database|R2_|fetch failed|token|Authorization/i.test(message)
    ? "Storage or the service is temporarily unavailable. Your saved workspace is unchanged; retry shortly." : message.slice(0, 350);
  return Response.json({ error: safe }, { status, headers: { "Cache-Control": "no-store" } });
}
