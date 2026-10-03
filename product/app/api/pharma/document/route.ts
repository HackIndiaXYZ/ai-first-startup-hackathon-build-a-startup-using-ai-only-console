import { env } from "cloudflare:workers";
import { AppError } from "@/lib/store";
import { pharmaFailure, pharmaSession } from "@/lib/pharma/store";

export async function GET(req: Request) {
  try {
    const { workspace } = await pharmaSession(req);
    const id = new URL(req.url).searchParams.get("id");
    const source = workspace.sources.find(s => s.id === id);
    if (!source) throw new AppError("This document is not in your workspace.", 404);
    let body: BodyInit = source.text;
    if (source.fileKey) {
      if (!source.fileKey.startsWith(`pharma/${workspace.id}/files/`)) throw new AppError("This file is outside your workspace.", 403);
      const object = await env.BUCKET?.get(source.fileKey);
      if (!object) throw new AppError("The original file is temporarily unavailable.", 503);
      body = object.body;
    }
    return new Response(body, { headers: { "Content-Type": source.fileKey ? source.mimeType || "application/octet-stream" : "text/plain;charset=utf-8", "Content-Disposition": `attachment; filename="${source.name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return pharmaFailure(error); }
}
