import { env } from "cloudflare:workers";
import { session, json, failure, checkOrigin, AppError } from "@/lib/store";
import { parseCsv } from "@/lib/import-records";
import { extractWithAI, extractWithFireworks } from "@/lib/ai-extract";
import { aiConfig } from "@/lib/ai-config";
import { fingerprint, validateRenderedPages } from "@/lib/document-input";
import type { Draft } from "@/lib/draft";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { workspace: w } = await session(req);
    if (!env.BUCKET)
      throw new AppError("Document storage is temporarily unavailable.", 503);
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 11_500_000)
      throw new AppError("The document and rendered pages are too large.", 413);
    const form = await req.formData();
    const file = form.get("file");
    const mode = form.get("mode");
    if (!(file instanceof File) || !file.size)
      throw new AppError("Choose a document to import.");
    if (file.size > 5000000)
      throw new AppError("Use a document smaller than 5 MB.", 413);
    if (w.documents.length >= 100)
      throw new AppError(
        "This demo workspace supports up to 100 source documents.",
      );
    const allowed = [
      "text/plain",
      "text/csv",
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/vnd.ms-excel",
    ];
    if (
      !allowed.includes(file.type) &&
      !file.name.toLowerCase().endsWith(".csv")
    )
      throw new AppError("Use a CSV, text, PDF, PNG, JPEG or WebP file.");
    if (mode !== "csv" && mode !== "ai")
      throw new AppError("Choose an import method.");
    if (mode === "ai" && form.get("consent") !== "yes")
      throw new AppError("Confirm sending this document to the AI service.");
    const ai = aiConfig(env);
    if (mode === "ai" && !ai.available)
      throw new AppError(
        "Live AI is not connected yet. Structured CSV import is available.",
        503,
      );
    if (mode === "ai" && form.get("provider") !== ai.provider)
      throw new AppError(
        "The AI provider changed. Reload and review the destination before sending this document.",
        409,
      );
    let pages: File[] = [];
    if (mode === "ai" && ai.provider === "fireworks") {
      try {
        pages = await validateRenderedPages(file, form);
      } catch (error) {
        throw new AppError((error as Error).message);
      }
    }
    const bytes = await file.arrayBuffer();
    const hash = await fingerprint(bytes);
    if (w.documents.some((d) => d.hash === hash))
      throw new AppError("This document is already in the workspace.", 409);
    let extracted;
    try {
      extracted =
        mode === "csv"
          ? parseCsv(await file.text())
          : ai.provider === "fireworks"
            ? await extractWithFireworks(file, ai.key, ai.model, pages)
            : await extractWithAI(file, ai.key, ai.model);
    } catch (e) {
      throw new AppError((e as Error).message);
    }
    const id = crypto.randomUUID(),
      docId = crypto.randomUUID(),
      at = new Date().toISOString(),
      fileKey = w.id + "/files/" + docId;
    const draft: Draft = {
      id,
      createdAt: at,
      model: mode === "ai" ? ai.model : undefined,
      document: {
        id: docId,
        name: file.name.slice(0, 180),
        kind: "Uploaded record",
        text: extracted.transcript,
        mode: mode === "ai" ? "ai" : "manual",
        uploadedAt: at,
        hash,
        fileKey,
        mimeType: file.type || "text/csv",
        extraction:
          mode === "ai"
            ? {
                provider: ai.provider,
                model: ai.model,
                inputMode: pages.length ? "browser-rendered-pages" : "original",
                pages: pages.length
                  ? await Promise.all(
                      pages.map(async (page, i) => ({
                        page: i + 1,
                        hash: await fingerprint(await page.arrayBuffer()),
                        fileKey: `${fileKey}/page-${i + 1}.jpg`,
                      })),
                    )
                  : undefined,
              }
            : undefined,
      },
      records: extracted.records,
    };
    await env.BUCKET.put(fileKey, bytes, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    for (let i = 0; i < pages.length; i++) {
      await env.BUCKET.put(
        `${fileKey}/page-${i + 1}.jpg`,
        await pages[i].arrayBuffer(),
        { httpMetadata: { contentType: "image/jpeg" } },
      );
    }
    await env.BUCKET.put(
      w.id + "/drafts/" + id + ".json",
      JSON.stringify(draft),
    );
    return json({ draft });
  } catch (e) {
    return failure(e);
  }
}
