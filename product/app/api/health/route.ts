import { db, json } from "@/lib/store";

/** Database availability only; no workspace, account, provider or infrastructure details. */
export async function GET() {
  try {
    const result = await db().prepare("SELECT 1 AS reachable").first<{ reachable: number }>();
    return result?.reachable === 1 ? json({ status: "ok" }) : json({ status: "unavailable" }, 503);
  } catch {
    return json({ status: "unavailable" }, 503);
  }
}
