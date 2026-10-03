import { pharmaFailure, pharmaSession } from "@/lib/pharma/store";
import { AppError, json } from "@/lib/store";

const source = "https://api.fda.gov/drug/enforcement.json?limit=12&sort=report_date:desc";
type Notice = { recall_number?: string; report_date?: string; recalling_firm?: string; product_description?: string; reason_for_recall?: string; code_info?: string; classification?: string; status?: string };
let cached: { at: number; data: unknown } | undefined;

export async function GET(req: Request) {
  try {
    await pharmaSession(req);
    if (cached && Date.now() - cached.at < 15 * 60_000) return json(cached.data);
    // A fixed public endpoint prevents arbitrary URL fetching and sends no
    // workspace identifiers, documents or product searches to the provider.
    const response = await fetch(source, { signal: AbortSignal.timeout(10000), redirect: "error", headers: { Accept: "application/json" } });
    if (!response.ok) throw new AppError("Public notices are unavailable. Your workspace and guided examples remain available.", 503);
    const body = await response.json() as { meta?: { last_updated?: string }; results?: Notice[] };
    if (!Array.isArray(body.results) || body.results.length > 12) throw new AppError("The public source returned an unsupported response.", 502);
    const text = (value: unknown, max = 1500) => typeof value === "string" ? value.slice(0, max) : "";
    const data = { jurisdiction: "United States", sourceUrl: source, documentationUrl: "https://open.fda.gov/apis/drug/enforcement/", retrievedAt: new Date().toISOString(), sourceUpdatedAt: body.meta?.last_updated || null,
      notice: "Public US enforcement reports. Review the original notice and exact product/batch scope; no workspace match or recall decision has been made.",
      records: body.results.map(row => ({ id: text(row.recall_number, 100), reportDate: text(row.report_date, 20), firm: text(row.recalling_firm, 200), product: text(row.product_description), reason: text(row.reason_for_recall), batches: text(row.code_info), classification: text(row.classification, 100), status: text(row.status, 100) })) };
    cached = { at: Date.now(), data };
    return json(data);
  } catch (error) { return pharmaFailure(error); }
}
