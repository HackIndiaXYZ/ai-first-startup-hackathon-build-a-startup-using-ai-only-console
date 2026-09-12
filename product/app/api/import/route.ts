import { env } from "cloudflare:workers";
import {
  session,
  json,
  failure,
  checkOrigin,
  AppError,
  readJson,
  save,
} from "@/lib/store";
import { recordSchema, importRecords } from "@/lib/import-records";
import type { Draft } from "@/lib/draft";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { workspace: w } = await session(req);
    const body = await readJson(req);
    if (body.revision !== w.revision)
      throw new AppError(
        "The workspace changed. Reopen import before saving.",
        409,
      );
    if (body.reviewed !== true)
      throw new AppError(
        "Review the source and confirm the proposed records first.",
      );
    if (
      typeof body.draftId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(body.draftId)
    )
      throw new AppError("Invalid draft reference.");
    if (!env.BUCKET)
      throw new AppError("Document storage is unavailable.", 503);
    const object = await env.BUCKET.get(
      w.id + "/drafts/" + body.draftId + ".json",
    );
    if (!object)
      throw new AppError(
        "This draft is no longer available. Import the file again.",
        404,
      );
    const draft = await object.json<Draft>();
    if (Date.now() - Date.parse(draft.createdAt) > 86400000)
      throw new AppError("This draft expired. Import the file again.");
    const result = recordSchema.array().min(1).max(60).safeParse(body.records);
    if (!result.success)
      throw new AppError(
        "Some proposed fields are invalid. Check identifiers and quantities.",
      );
    let next;
    try {
      next = importRecords(
        w,
        draft.document,
        result.data,
        new Date().toISOString(),
      );
    } catch (e) {
      throw new AppError((e as Error).message);
    }
    const changes = result.data.flatMap((record, index) =>
      Object.entries(record)
        .filter(
          ([key, value]) =>
            JSON.stringify(value) !==
            JSON.stringify(draft.records[index]?.[key as keyof typeof record]),
        )
        .map(
          ([key, value]) =>
            "Record " +
            (index + 1) +
            " " +
            key +
            ": " +
            String(
              draft.records[index]?.[key as keyof typeof record] ?? "blank",
            ) +
            " → " +
            String(value ?? "blank"),
        ),
    );
    if (changes.length)
      next.audit[0].note +=
        " Operator edits: " + changes.join("; ").slice(0, 12000);
    await save(next, w.revision);
    // A committed import remains successful even if disposable draft cleanup fails.
    await env.BUCKET.delete(w.id + "/drafts/" + draft.id + ".json").catch(() =>
      console.warn("Draft cleanup deferred after successful import."),
    );
    return json({ workspace: next });
  } catch (e) {
    return failure(e);
  }
}
