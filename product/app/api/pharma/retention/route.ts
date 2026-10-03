import { env } from "cloudflare:workers";
import { AppError, checkOrigin, db, json } from "@/lib/store";
import { hashText, pharmaFailure, pharmaSession, priorRequest, requestBody, requireRole, saveWorkspace } from "@/lib/pharma/store";
import type { PharmaAccess } from "@/lib/pharma/store";
import type { PharmaWorkspace } from "@/lib/pharma/types";

const age = 7 * 86400000;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const maxCandidates = 20;
function requireAdmin(access: PharmaAccess) {
  requireRole(access, ["admin"]);
  if (!access.signedIn || !access.secured || !access.userId) throw new AppError("Save this workspace to your account before managing retained previews.", 403);
}
function protectedKeys(workspace: PharmaWorkspace) {
  return new Set([...workspace.sources, ...workspace.reports.flatMap(report => report.sources)].flatMap(source => source.fileKey ? [source.fileKey] : []));
}
function draftKey(workspace: PharmaWorkspace, id: string) { return `pharma/${workspace.id}/drafts/${id}.json`; }

async function expiredDraft(workspace: PharmaWorkspace, id: string, protectedFiles: Set<string>, now: number) {
  const key = draftKey(workspace, id);
  if (protectedFiles.has(key)) return null;
  const object = await env.BUCKET!.get(key);
  // Both storage age and authored draft age must be expired. Malformed or oversized
  // objects remain untouched; this endpoint only recognises our preview format.
  if (!object || object.size > 1_500_000 || object.uploaded.getTime() > now - age) return null;
  try {
    const draft = JSON.parse(await object.text());
    if (draft.id !== id || typeof draft.createdAt !== "string" || !Number.isFinite(Date.parse(draft.createdAt)) || Date.parse(draft.createdAt) > now - age || !draft.preview || !draft.source || !uuid.test(draft.source.id) || draft.source.fileKey !== `pharma/${workspace.id}/files/${draft.source.id}`) return null;
    return { id, createdAt: draft.createdAt as string, bytes: object.size, key };
  } catch { return null; }
}

export async function GET(req: Request) {
  try {
    const { workspace, access } = await pharmaSession(req);
    requireAdmin(access);
    if (!env.BUCKET) throw new AppError("Document storage is temporarily unavailable.", 503);
    const cursor = new URL(req.url).searchParams.get("cursor") || undefined;
    if (cursor && cursor.length > 4096) throw new AppError("The preview page is invalid.");
    const prefix = `pharma/${workspace.id}/drafts/`;
    const objects = await env.BUCKET.list({ prefix, limit: maxCandidates, ...(cursor ? { cursor } : {}) });
    const protectedFiles = protectedKeys(workspace), now = Date.now();
    const candidates = [];
    for (const object of objects.objects) {
      if (!object.key.startsWith(prefix) || !object.key.endsWith(".json")) continue;
      const id = object.key.slice(prefix.length, -5);
      if (!uuid.test(id)) continue;
      const candidate = await expiredDraft(workspace, id, protectedFiles, now);
      if (candidate) candidates.push({ id, createdAt: candidate.createdAt, bytes: candidate.bytes });
    }
    return json({ revision: workspace.revision, candidates, scanned: objects.objects.length, nextCursor: objects.truncated ? objects.cursor : null, previewLifetimeDays: 7 });
  } catch (error) { return pharmaFailure(error); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { workspace, access } = await pharmaSession(req);
    requireAdmin(access);
    if (!env.BUCKET) throw new AppError("Document storage is temporarily unavailable.", 503);
    const body = await requestBody(req, 16000);
    if (body?.confirm !== "REMOVE_EXPIRED_PREVIEWS" || typeof body.requestId !== "string" || !/^[\w-]{8,100}$/.test(body.requestId) || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > maxCandidates || body.ids.some((id: unknown) => typeof id !== "string" || !uuid.test(id)) || new Set(body.ids).size !== body.ids.length) throw new AppError("Review a group of up to 20 expired previews before removing it.");
    const digest = await hashText(JSON.stringify({ type: "retention.cleanup", ids: body.ids }));
    if (await priorRequest(workspace.id, body.requestId, digest)) return json({ workspace, replayed: true, notice: "This cleanup request was already recorded. Review retained previews to see the current result." });
    if (body.revision !== workspace.revision) throw new AppError("The workspace changed. Review expired previews again before removing them.", 409);
    const protectedFiles = protectedKeys(workspace), now = Date.now(), candidates = [];
    for (const id of body.ids) {
      const candidate = await expiredDraft(workspace, id, protectedFiles, now);
      if (!candidate) throw new AppError("A selected preview is no longer eligible. Review retained previews again.", 409);
      candidates.push(candidate);
    }
    const at = new Date(now).toISOString();
    const next: PharmaWorkspace = { ...workspace, revision: workspace.revision + 1, audit: [...workspace.audit, {
      id: crypto.randomUUID(), at, actor: access.displayName, role: access.role, action: "retention.cleanup.requested", entity: workspace.id,
      reason: "Administrator explicitly approved removal of expired preview metadata; original files and posted evidence are retained.",
      before: JSON.stringify(candidates.map(candidate => ({ id: candidate.id, createdAt: candidate.createdAt }))),
      after: `Requested removal of ${candidates.length} expired preview metadata object(s). Completion is returned separately; this audit records authorisation, not deletion success.`,
    }] };
    // Persist authorisation first. R2 and D1 do not share a transaction; the audit
    // deliberately describes the request rather than claiming a completed delete.
    await saveWorkspace(next, workspace, body.requestId, digest, access);
    const member = await db().prepare("SELECT 1 AS allowed FROM pharma_members WHERE workspace_id=? AND user_id=? AND role='admin'").bind(workspace.id, access.userId!).first();
    if (!member) return json({ error: "Your administrator access changed. The request was recorded, but no preview cleanup was started.", workspace: next }, 403);
    try { await env.BUCKET.delete(candidates.map(candidate => candidate.key)); }
    catch { return json({ error: "Cleanup authorisation was saved, but removal could not be confirmed. Review retained previews before retrying.", workspace: next }, 503); }
    return json({ workspace: next, removed: candidates.length, retainedOriginalFiles: true });
  } catch (error) { return pharmaFailure(error); }
}
