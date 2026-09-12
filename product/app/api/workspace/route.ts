import { env } from "cloudflare:workers";
import {
  session,
  json,
  failure,
  checkOrigin,
  readJson,
  save,
  AppError,
} from "@/lib/store";
import { resolveBatch, createReport } from "@/lib/domain";
import { sampleWorkspace } from "@/lib/sample";
import { resolveDelivery } from "@/lib/resolve-delivery";
export async function GET(req: Request) {
  try {
    const { workspace, cookie } = await session(req, true);
    return json({ workspace, aiAvailable: !!env.OPENAI_API_KEY }, 200, cookie);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { workspace: w } = await session(req);
    const body = await readJson(req);
    if (body.revision !== w.revision)
      throw new AppError("This workspace changed. Reload before saving.", 409);
    let next;
    if (body.action === "resolve") {
      if (
        typeof body.batchId !== "string" ||
        typeof body.lotId !== "string" ||
        typeof body.note !== "string" ||
        body.note.length > 2000
      )
        throw new AppError("Provide a batch, lot and a short evidence note.");
      try {
        next = resolveBatch(
          w,
          body.batchId,
          body.lotId,
          body.note,
          new Date().toISOString(),
          crypto.randomUUID(),
        );
      } catch (e) {
        throw new AppError((e as Error).message);
      }
    } else if (body.action === "resolve-delivery") {
      if (
        typeof body.deliveryId !== "string" ||
        typeof body.batchId !== "string" ||
        typeof body.note !== "string" ||
        body.note.length > 2000
      )
        throw new AppError("Provide a delivery, batch and evidence note.");
      try {
        next = resolveDelivery(
          w,
          body.deliveryId,
          body.batchId,
          body.note,
          new Date().toISOString(),
          crypto.randomUUID(),
        );
      } catch (e) {
        throw new AppError((e as Error).message);
      }
    } else if (body.action === "report") {
      if (!w.lots.some((l) => l.id === body.lotId))
        throw new AppError("Choose an ingredient lot.");
      if (w.reports.length >= 50)
        throw new AppError(
          "This demo workspace has reached its 50-report limit.",
        );
      const report = createReport(
        w,
        body.lotId,
        new Date().toISOString(),
        `RS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      );
      next = {
        ...w,
        revision: w.revision + 1,
        reports: [report, ...w.reports],
      };
    } else if (body.action === "reset" && body.confirm === "RESET") {
      next = {
        ...sampleWorkspace(w.id, new Date().toISOString()),
        revision: w.revision + 1,
      };
    } else if (body.action === "clear" && body.confirm === "CLEAR") {
      next = {
        ...w,
        revision: w.revision + 1,
        synthetic: false,
        lots: [],
        batches: [],
        deliveries: [],
        documents: [],
        audit: [],
        reports: [],
      };
    } else throw new AppError("Unknown workspace action.");
    await save(next, w.revision);
    return json({ workspace: next });
  } catch (e) {
    return failure(e);
  }
}
