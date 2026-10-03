import { env } from "cloudflare:workers";
import { AppError, checkOrigin, db, json } from "@/lib/store";
import { aiConfig } from "@/lib/ai-config";
import { dailyRequestLimit, reserveAIRequest } from "@/lib/request-budget";
import { fingerprint, validateRenderedPages } from "@/lib/document-input";
import { applyPharmaAction, assertValidWorkspace } from "@/lib/pharma/domain";
import { extractPharmaDocument } from "@/lib/pharma/providers";
import { getGuidedTemplate, getTemplateCsv, pharmaTemplates } from "@/lib/pharma/templates";
import { intakeFields, intakeKinds, matchPharmaIntake, parsePharmaCsv, validateIntakeProposal, type IntakeKind, type IntakePreview, type IntakeRaw } from "@/lib/pharma/intake";
import { boundedBody, hashText, pharmaFailure, pharmaSession, priorRequest, requestBody, requireRole, saveWorkspace } from "@/lib/pharma/store";
import type { PharmaAction, SourceDocument } from "@/lib/pharma/types";

type StoredDraft = { id: string; createdAt: string; preview: IntakePreview; source: SourceDocument };
function draftKey(workspaceId: string, id: string) { return `pharma/${workspaceId}/drafts/${id}.json`; }

export async function GET(req: Request) {
  try {
    const query = new URL(req.url).searchParams;
    const id = query.get("template");
    if (!id) return json({ templates: pharmaTemplates });
    const template = pharmaTemplates.find(t => t.id === id);
    if (!template) throw new AppError("Choose a supported document template.", 404);
    return new Response(getTemplateCsv(id, { blank: query.get("blank") === "1" }), { headers: { "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": `attachment; filename="${template.filename}"`, "Cache-Control": "no-store" } });
  } catch (error) { return pharmaFailure(error); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { workspace, access } = await pharmaSession(req);
    requireRole(access, ["operations", "quality", "admin"]);
    if (!env.BUCKET) throw new AppError("Document storage is temporarily unavailable.", 503);
    const multipart = req.headers.get("content-type")?.includes("multipart/form-data");
    const body = multipart ? null : await requestBody(req, 650000);
    if (body?.mode === "approve") {
      if (typeof body.draftId !== "string" || !/^[a-f0-9-]{36}$/.test(body.draftId) || typeof body.requestId !== "string" || !/^[\w-]{8,100}$/.test(body.requestId)) throw new AppError("Choose a saved document review.");
      const digest = await hashText(JSON.stringify({ draftId: body.draftId, corrections: body.corrections ?? [], reviewNote: body.reviewNote }));
      if (await priorRequest(workspace.id, body.requestId, digest)) return json({ workspace, replayed: true });
      if (body.revision !== workspace.revision) throw new AppError("The workspace changed. Refresh and review these records against the latest stock.", 409);
      if (typeof body.reviewNote !== "string" || body.reviewNote.trim().length < 12 || body.reviewNote.length > 2000) throw new AppError("Record an evidence note of at least 12 characters before posting.");
      const object = await env.BUCKET.get(draftKey(workspace.id, body.draftId));
      if (!object) throw new AppError("This review is unavailable or belongs to another workspace.", 404);
      const draft: StoredDraft = JSON.parse(await object.text());
      if (!draft.preview.records.length) throw new AppError("This document has no supported records to post.");
      if (Date.now() - Date.parse(draft.createdAt) > 7 * 86400000) throw new AppError("This review has expired. Prepare the source again.", 410);
      if (workspace.sources.some(source => !source.archived && source.hash === draft.source.hash)) throw new AppError("This document has already been posted.", 409);
      const corrections = body.corrections ?? [];
      if (!Array.isArray(corrections) || corrections.length > draft.preview.records.length || new Set(corrections.map(c => c.id)).size !== corrections.length) throw new AppError("The record corrections are invalid.");
      for (const correction of corrections) {
        if (!draft.preview.records.some(record => record.id === correction.id) || !correction.raw || typeof correction.raw !== "object" || Object.keys(correction.raw).some(k => !intakeFields.includes(k as keyof IntakeRaw))) throw new AppError("A correction refers to an unknown record or field.");
      }
      const now = new Date().toISOString();
      const ctx = { now, actor: access.displayName, role: access.role };
      let next = applyPharmaAction(workspace, { type: "source.add", source: draft.source }, { ...ctx, id: `${body.requestId}-source` });
      const reviewedRows = new Set<string>();
      for (const [index, original] of draft.preview.records.entries()) {
        const correction = corrections.find(c => c.id === original.id);
        const raw = { ...original.raw, ...(correction?.raw || {}) } as IntakeRaw;
        for (const issue of original.issues.filter(issue => issue.severity === "error")) {
          if (issue.field === "row" || issue.field === "evidence") throw new AppError(`Line ${original.evidence.line}: ${issue.message} Prepare a corrected source before posting.`);
          if (issue.code === "unsupported-evidence" && raw[issue.field] === original.raw[issue.field]) throw new AppError(`Line ${original.evidence.line}: ${issue.message}`);
        }
        const rowKey = JSON.stringify([original.kind, ...intakeFields.map(field => typeof raw[field] === "string" ? raw[field].trim() : raw[field])]);
        if (reviewedRows.has(rowKey)) throw new AppError("The reviewed document repeats a record. Resolve duplicate rows before posting.");
        reviewedRows.add(rowKey);
        const record = validateIntakeProposal(original.kind, raw, original.evidence, original.id);
        const match = matchPharmaIntake(record, next);
        if (!match.exact) throw new AppError(`Line ${record.evidence.line}: ${[...record.issues, ...match.issues].filter(issue => issue.severity === "error").map(issue => issue.message).join(" ")}`);
        const v = record.values;
        const evidence = { sourceId: draft.source.id, line: record.evidence.line, page: record.evidence.page ?? undefined, quote: record.evidence.quote };
        const reason = `${v.reason ? `${v.reason}. ` : ""}${body.reviewNote}`;
        const movement = { batchId: match.batchId!, locationId: match.locationId!, quantity: v.quantity!, unit: v.unit, reference: v.reference, reason, evidence, occurredAt: v.date };
        let action: PharmaAction;
        if (record.kind === "receipt") action = { ...movement, type: "receipt", supplierId: match.partnerId! };
        else if (record.kind === "dispatch") action = { ...movement, type: "dispatch", partnerId: match.partnerId! };
        else if (record.kind === "return") action = { ...movement, type: "return", shipmentId: match.shipmentId! };
        else action = { type: "recall.create", holdStock: true, recall: { id: crypto.randomUUID(), reference: v.reference, title: `${v.productName || next.products.find(p => p.id === match.productId)?.name} batch recall`, productId: match.productId!, batchIds: [match.batchId!], owner: access.displayName, reason, evidence } };
        next = applyPharmaAction(next, action, { ...ctx, id: `${body.requestId}-${index}` });
        if (correction) next.audit.push({ id: crypto.randomUUID(), at: now, actor: access.displayName, role: access.role, action: "intake.correct", entity: match.batchId!, evidence, reason: body.reviewNote, before: JSON.stringify(original.raw), after: JSON.stringify(raw) });
      }
      next.synthetic = workspace.synthetic || draft.preview.source.synthetic;
      assertValidWorkspace(next);
      await saveWorkspace(next, workspace, body.requestId, digest, access);
      return json({ workspace: next, posted: draft.preview.records.length });
    }

    if (workspace.sources.length >= 200) throw new AppError("This workspace has reached its 200-document allowance. Export a backup before continuing.");
    let preview: IntakePreview;
    let bytes: ArrayBuffer;
    let mime = "text/csv";
    if (multipart) {
      if (Number(req.headers.get("content-length") || 0) > 15_000_000) throw new AppError("Use an original document and rendered pages under 15 MB in total.", 413);
      const bounded = await boundedBody(req, 15_000_000);
      const form = await new Response(bounded as BodyInit, { headers: { "Content-Type": req.headers.get("content-type")! } }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 8_000_000) throw new AppError("Choose a non-empty document smaller than 8 MB.");
      if (form.get("mode") !== "ai" || form.get("consent") !== "yes") throw new AppError("Confirm sending this document to the named AI provider.");
      const ai = aiConfig(env);
      if (!ai.available) throw new AppError("Live AI is not connected. Guided examples and CSV remain available.", 503);
      if (form.get("provider") !== ai.provider) throw new AppError("The provider changed. Refresh and review the destination before sending the document.", 409);
      bytes = await file.arrayBuffer(); mime = file.type;
      const originalHash = await fingerprint(bytes);
      if (workspace.sources.some(source => !source.archived && source.hash === originalHash)) throw new AppError("This document has already been posted. Its source is available in Documents.", 409);
      const pages = ai.provider === "fireworks" ? await validateRenderedPages(file, form) : [];
      const day = new Date().toISOString().slice(0, 10);
      const allowance = await db().prepare("INSERT INTO pharma_ai_usage(workspace_id,day,requests) VALUES (?,?,1) ON CONFLICT(workspace_id,day) DO UPDATE SET requests=requests+1 WHERE requests<5 RETURNING requests").bind(workspace.id, day).first();
      if (!allowance || !(await reserveAIRequest(db(), dailyRequestLimit(env.AI_DAILY_REQUEST_LIMIT)))) throw new AppError("The AI allowance is used for today. Guided examples and CSV remain available.", 429);
      preview = await extractPharmaDocument(file, { provider: ai.provider, key: ai.key, model: ai.model, pages, pageCount: pages.length || undefined });
    } else if (body?.mode === "template" && typeof body.templateId === "string") {
      preview = getGuidedTemplate(body.templateId);
      bytes = new TextEncoder().encode(preview.source.text).buffer;
    } else if (body?.mode === "csv") {
      if (!intakeKinds.includes(body.kind as IntakeKind) || typeof body.text !== "string") throw new AppError("Choose a document type and provide CSV contents.");
      const sourceName = body.sourceName ?? body.name;
      preview = parsePharmaCsv(body.text, { kind: body.kind, columnMap: body.columnMap, sourceName: typeof sourceName === "string" ? sourceName.slice(0, 160) : "Uploaded distribution record.csv" });
      bytes = new TextEncoder().encode(body.text).buffer;
    } else throw new AppError("Choose a guided example, structured CSV or live AI extraction.");
    const hash = await fingerprint(bytes);
    if (workspace.sources.some(source => !source.archived && source.hash === hash)) throw new AppError("This document has already been posted. Its source is available in Documents.", 409);
    const id = crypto.randomUUID(), sourceId = crypto.randomUUID(), now = new Date().toISOString();
    const fileKey = `pharma/${workspace.id}/files/${sourceId}`;
    const source: SourceDocument = { id: sourceId, name: preview.source.name.slice(0, 160), kind: "Distribution document", text: preview.source.text,
      mode: preview.mode === "guided" ? "template" : preview.mode === "ai" ? "ai" : "manual", createdAt: now, hash, fileKey, mimeType: mime, provider: preview.provider, model: preview.model };
    await env.BUCKET.put(fileKey, bytes, { httpMetadata: { contentType: mime } });
    const draft: StoredDraft = { id, createdAt: now, preview, source };
    await env.BUCKET.put(draftKey(workspace.id, id), JSON.stringify(draft), { httpMetadata: { contentType: "application/json" } });
    return json({ draftId: id, preview, matches: preview.records.map(row => ({ id: row.id, ...matchPharmaIntake(row, workspace) })) });
  } catch (error) { return pharmaFailure(error); }
}
