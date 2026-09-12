import { env } from "cloudflare:workers";
import { session, json, failure, checkOrigin, AppError } from "@/lib/store";
import { parseCsv } from "@/lib/import-records";
import { extractWithAI } from "@/lib/ai-extract";
import type { Draft } from "@/lib/draft";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { workspace: w } = await session(req);
    if (!env.BUCKET)
      throw new AppError("Document storage is temporarily unavailable.", 503);
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 5500000)
      throw new AppError("Use a document smaller than 5 MB.", 413);
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
    if (mode === "ai" && !env.OPENAI_API_KEY)
      throw new AppError(
        "Live AI is not connected yet. Structured CSV import is available.",
        503,
      );
    const bytes = await file.arrayBuffer();
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (w.documents.some((d) => d.hash === hash))
      throw new AppError("This document is already in the workspace.", 409);
    let extracted;
    try {
      extracted =
        mode === "csv"
          ? parseCsv(await file.text())
          : await extractWithAI(
              file,
              env.OPENAI_API_KEY!,
              env.OPENAI_MODEL || "gpt-5.4-mini",
            );
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
      model: mode === "ai" ? env.OPENAI_MODEL || "gpt-5.4-mini" : undefined,
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
      },
      records: extracted.records,
    };
    await env.BUCKET.put(fileKey, bytes, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    await env.BUCKET.put(
      w.id + "/drafts/" + id + ".json",
      JSON.stringify(draft),
    );
    return json({ draft });
  } catch (e) {
    return failure(e);
  }
}
