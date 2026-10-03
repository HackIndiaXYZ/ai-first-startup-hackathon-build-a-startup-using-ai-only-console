import { env } from "cloudflare:workers";
import { AppError, checkOrigin, json } from "@/lib/store";
import { publicAIConfig } from "@/lib/ai-config";
import { applyPharmaAction, assertValidWorkspace, withCurrentReferenceDate } from "@/lib/pharma/domain";
import { seedPharmaWorkspace } from "@/lib/pharma/seed";
import { pharmaSession, pharmaFailure, hashText, priorRequest, requireRole, requestBody, saveWorkspace } from "@/lib/pharma/store";
import type { PharmaAction, PharmaWorkspace } from "@/lib/pharma/types";
import { pharmaTemplates } from "@/lib/pharma/templates";
import { preserveHistory } from "@/lib/pharma/history";

export async function GET(req: Request) {
  try {
    const session = await pharmaSession(req, true);
    return json({ workspace: session.workspace, access: session.access, ai: publicAIConfig(env), templates: pharmaTemplates }, 200, session.cookie);
  } catch (error) { return pharmaFailure(error); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const session = await pharmaSession(req);
    const { workspace, access } = session;
    const body = await requestBody(req, 19_000_000);
    if (!body || typeof body !== "object" || !body.action || typeof body.action.type !== "string" ||
      typeof body.requestId !== "string" || !/^[\w-]{8,100}$/.test(body.requestId)) throw new AppError("Provide a valid action and request identifier.");
    const digest = await hashText(JSON.stringify(body.action));
    if (await priorRequest(workspace.id, body.requestId, digest)) return json({ workspace, access, replayed: true });
    if (body.revision !== workspace.revision) throw new AppError("This workspace changed. Refresh before saving; your form has been retained.", 409);
    requireRole(access, ["operations", "quality", "admin"]);
    const now = new Date().toISOString();
    let next: PharmaWorkspace;
    if (body.action.type === "workspace.reset") {
      requireRole(access, ["admin"]);
      if (body.action.confirm !== "RESET" || !workspace.synthetic) throw new AppError("Only a sample workspace can be reset. Export a backup first.");
      next = seedPharmaWorkspace(workspace.id, now, body.action.scenario === "active" ? "active" : "complete");
      next = preserveHistory(workspace, next);
      next.revision = workspace.revision + 1;
      next.audit.push({ id: crypto.randomUUID(), at: now, actor: access.displayName, role: access.role, action: "workspace.reset", entity: workspace.id, reason: "Started a fresh labelled sample scenario", before: `revision ${workspace.revision}`, after: body.action.scenario || "complete" });
    } else if (body.action.type === "workspace.rename") {
      requireRole(access, ["admin"]);
      if (typeof body.action.name !== "string" || !body.action.name.trim() || body.action.name.length > 100) throw new AppError("Use a workspace name between 1 and 100 characters.");
      next = { ...workspace, name: body.action.name.trim(), revision: workspace.revision + 1,
        audit: [...workspace.audit, { id: crypto.randomUUID(), at: now, actor: access.displayName, role: access.role, action: "workspace.rename", entity: workspace.id, reason: "Updated organisation name", before: workspace.name, after: body.action.name.trim() }] };
    } else if (body.action.type === "workspace.restore") {
      requireRole(access, ["admin"]);
      const backup = body.action.backup?.workspace ?? body.action.backup;
      if (!backup || backup.schemaVersion !== 2 || typeof body.action.reason !== "string" || body.action.reason.trim().length < 12) throw new AppError("Choose a RecallScope pharmaceutical backup and explain the restore in at least 12 characters.");
      assertValidWorkspace(backup);
      // A backup is data, never authority to retrieve another workspace's blobs.
      const safeSources = backup.sources.map((source: PharmaWorkspace["sources"][number]) => ({ ...source, fileKey: undefined }));
      next = { ...backup, id: workspace.id, sources: safeSources, revision: Math.max(workspace.revision, backup.revision) + 1,
        reports: backup.reports.map((report: PharmaWorkspace["reports"][number]) => ({ ...report, sources: report.sources.map(source => ({ ...source, fileKey: undefined })) })),
        audit: backup.audit };
      next = preserveHistory(workspace, next);
      next.audit.push({ id: crypto.randomUUID(), at: now, actor: access.displayName, role: access.role, action: "workspace.restore", entity: workspace.id, reason: body.action.reason, before: `revision ${workspace.revision}`, after: `restored ${backup.name}` });
    } else {
      if (body.action.type === "source.add") {
        if (body.action.source?.fileKey) throw new AppError("Upload original files through document intake. Manual sources contain text only.");
        if (typeof body.action.source?.text !== "string") throw new AppError("Provide the original source text.");
        body.action.source = { ...body.action.source, mode: "manual", provider: undefined, model: undefined, mimeType: "text/plain", hash: await hashText(body.action.source.text), createdAt: now };
      }
      next = applyPharmaAction(workspace, body.action as PharmaAction, { now, id: body.requestId, actor: access.displayName, role: access.role });
    }
    next = withCurrentReferenceDate(next, now);
    assertValidWorkspace(next);
    await saveWorkspace(next, workspace, body.requestId, digest, access);
    return json({ workspace: next, access });
  } catch (error) { return pharmaFailure(error); }
}
