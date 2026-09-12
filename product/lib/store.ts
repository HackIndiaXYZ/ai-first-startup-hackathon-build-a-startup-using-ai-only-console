import { env } from "cloudflare:workers";
import { sampleWorkspace } from "./sample";
import type { Workspace } from "./domain";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function db() {
  if (!env.DB)
    throw new AppError(
      "The workspace store is unavailable. Please retry shortly.",
      503,
    );
  return env.DB;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw new AppError("Request origin could not be verified.", 403);
}
export async function session(
  req: Request,
  create = false,
): Promise<{ workspace: Workspace; cookie?: string }> {
  const candidate = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)recallscope_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
  if (candidate) {
    const row = await db()
      .prepare("SELECT data FROM workspaces WHERE id = ?")
      .bind(candidate)
      .first<{ data: string }>();
    if (row) return { workspace: JSON.parse(row.data) };
  }
  if (!create)
    throw new AppError(
      "Your workspace session has expired. Reload the page.",
      401,
    );
  const id = crypto.randomUUID();
  const workspace = sampleWorkspace(id, new Date().toISOString());
  await db()
    .prepare(
      "INSERT INTO workspaces (id,revision,data,updated_at) VALUES (?,0,?,?)",
    )
    .bind(id, JSON.stringify(workspace), new Date().toISOString())
    .run();
  return {
    workspace,
    cookie: `recallscope_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
export async function save(w: Workspace, previousRevision: number) {
  const data = JSON.stringify(w);
  if (new TextEncoder().encode(data).length > 1500000)
    throw new AppError(
      "This practice workspace has reached its storage limit. Download reports and start a fresh workspace.",
      413,
    );
  const result = await db()
    .prepare(
      "UPDATE workspaces SET revision = ?, data = ?, updated_at = ? WHERE id = ? AND revision = ?",
    )
    .bind(w.revision, data, new Date().toISOString(), w.id, previousRevision)
    .run();
  if (result.meta.changes !== 1)
    throw new AppError(
      "This workspace changed in another tab. Reload before saving your decision.",
      409,
    );
}
export function json(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return json({ error: error.message }, error.status);
  console.error(
    "RecallScope request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return json(
    {
      error:
        "The request could not be completed. Your saved workspace is unchanged. Please retry.",
    },
    500,
  );
}
export async function readJson(req: Request, max = 300000) {
  const text = await req.text();
  if (text.length > max) throw new AppError("This request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("The request is not valid JSON.");
  }
}
