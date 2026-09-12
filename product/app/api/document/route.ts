import { env } from "cloudflare:workers";
import { session, AppError, failure } from "@/lib/store";
export async function GET(req: Request) {
  try {
    const { workspace: w } = await session(req);
    const id = new URL(req.url).searchParams.get("id");
    const doc = w.documents.find((d) => d.id === id);
    if (!doc?.fileKey || !doc.fileKey.startsWith(w.id + "/"))
      throw new AppError("Document not found.", 404);
    const pageParam = new URL(req.url).searchParams.get("page");
    const page =
      pageParam === null
        ? null
        : doc.extraction?.pages?.find((p) => String(p.page) === pageParam);
    if (pageParam !== null && (!page || !page.fileKey.startsWith(w.id + "/")))
      throw new AppError("Document page not found.", 404);
    const file = await env.BUCKET?.get(page ? page.fileKey : doc.fileKey);
    if (!file) throw new AppError("The original file is unavailable.", 404);
    return new Response(file.body, {
      headers: {
        "Content-Type": page
          ? "image/jpeg"
          : doc.mimeType || "application/octet-stream",
        "Content-Disposition":
          "attachment; filename*=UTF-8''" +
          encodeURIComponent(
            page ? `${doc.name}-page-${page.page}.jpg` : doc.name,
          ),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
