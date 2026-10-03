import { AppError, checkOrigin, json } from "@/lib/store";
import { applyPharmaAction } from "@/lib/pharma/domain";
import { exportEpcis, lookupGs1Barcode, parseTemperatureCsv, previewEpcis } from "@/lib/pharma/interoperability";
import { hashText, pharmaFailure, pharmaSession, priorRequest, requestBody, requireRole, saveWorkspace } from "@/lib/pharma/store";

export async function GET(req: Request) {
  try {
    const { workspace } = await pharmaSession(req);
    return json(exportEpcis(workspace));
  } catch (error) { return pharmaFailure(error); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { workspace, access } = await pharmaSession(req);
    const body = await requestBody(req, 5_200_000);
    if (body.type === "barcode") return json(lookupGs1Barcode(body.value, workspace, { century: body.century }));
    if (body.type === "epcis.preview") return json(previewEpcis(body.document));
    if (body.type === "temperature.preview" || body.type === "temperature.import") {
      if (typeof body.text !== "string") throw new AppError("Provide the temperature CSV contents.");
      const preview = parseTemperatureCsv(body.text, workspace);
      if (body.type === "temperature.preview") return json(preview);
      requireRole(access, ["operations", "quality", "admin"]);
      if (typeof body.requestId !== "string" || !/^[\w-]{8,100}$/.test(body.requestId) || typeof body.reviewNote !== "string" || body.reviewNote.trim().length < 12 || body.reviewNote.length > 1500) throw new AppError("Record an evidence note of at least 12 characters.");
      if (!preview.records.length || preview.records.some(row => row.issues.length)) throw new AppError("Resolve all observation issues before importing.");
      const digest = await hashText(body.text + body.reviewNote);
      if (await priorRequest(workspace.id, body.requestId, digest)) return json({ workspace, replayed: true });
      if (body.revision !== workspace.revision) throw new AppError("Refresh before importing these observations.", 409);
      const hash = await hashText(body.text);
      if (workspace.sources.some(s => !s.archived && s.hash === hash)) throw new AppError("These observations have already been imported.", 409);
      const now = new Date().toISOString(), sourceId = crypto.randomUUID();
      let next = applyPharmaAction(workspace, { type: "source.add", source: { id: sourceId, name: "Temperature observation register.csv", kind: "Temperature observations", text: body.text, mode: "manual", hash, createdAt: now } }, { id: `${body.requestId}-source`, now, actor: access.displayName, role: access.role });
      for (const [i, row] of preview.records.entries()) next = applyPharmaAction(next, { type: "temperature.add", batchId: row.batchId!, locationId: row.locationId, celsius: row.celsius!, observedAt: row.observedAt, note: `${row.note}. ${body.reviewNote}`, evidence: { sourceId, ...row.evidence } }, { id: `${body.requestId}-${i}`, now, actor: access.displayName, role: access.role });
      await saveWorkspace(next, workspace, body.requestId, digest, access);
      return json({ workspace: next, imported: preview.records.length });
    }
    throw new AppError("Choose barcode lookup, EPCIS preview or temperature import.");
  } catch (error) { return pharmaFailure(error); }
}
