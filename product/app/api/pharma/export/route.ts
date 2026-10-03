import { env } from "cloudflare:workers";
import { AppError } from "@/lib/store";
import { hashText, pharmaFailure, pharmaSession } from "@/lib/pharma/store";
import { evidenceZip, ledgerCsv, reportPdf } from "@/lib/pharma/export";

function download(body: BodyInit, type: string, name: string) {
  return new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function GET(req: Request) {
  try {
    const { workspace } = await pharmaSession(req);
    const query = new URL(req.url).searchParams;
    const format = query.get("format") || "json", reportId = query.get("reportId");
    const report = reportId ? workspace.reports.find(r => r.id === reportId) : undefined;
    if (reportId && !report) throw new AppError("This report is not in your workspace.", 404);
    const name = `RecallScope-${report ? "report" : "workspace"}-${workspace.asOf}`;
    if (format === "csv") return download(ledgerCsv(workspace, report), "text/csv;charset=utf-8", name + ".csv");
    if (format === "json") return download(JSON.stringify(report ?? { format: "recallscope-pharma-backup", exportedAt: new Date().toISOString(), workspace }, null, 2), "application/json", name + ".json");
    if (!report) throw new AppError("Choose a saved report for a PDF or evidence package.");
    const pdf = await reportPdf(workspace, report);
    if (format === "pdf") return download(pdf as BodyInit, "application/pdf", name + ".pdf");
    if (format !== "evidence") throw new AppError("Choose JSON, CSV, PDF or an evidence package.");
    const encoder = new TextEncoder();
    const files = [
      { name: "report.pdf", bytes: pdf },
      { name: "report.json", bytes: encoder.encode(JSON.stringify(report, null, 2)) },
      { name: "movements.csv", bytes: encoder.encode(ledgerCsv(workspace, report)) },
    ];
    let totalBytes = files.reduce((n, file) => n + file.bytes.byteLength, 0);
    if (report.sources.length > 200 || totalBytes > 16_000_000) throw new AppError("This evidence package exceeds 16 MB. Download its JSON report and original documents individually.", 413);
    for (const [i, source] of report.sources.entries()) {
      const safeName = source.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_").slice(0, 140) || "source.txt";
      let bytes = encoder.encode(source.text);
      let filename = safeName;
      if (source.fileKey) {
        if (!source.fileKey.startsWith(`pharma/${workspace.id}/files/`)) throw new AppError("The source file is outside this workspace.", 403);
        const object = await env.BUCKET?.get(source.fileKey);
        if (!object) throw new AppError("An original source file is unavailable. Retry before exporting the complete package.", 503);
        if (totalBytes + object.size > 16_000_000) throw new AppError("This evidence package exceeds 16 MB. Download its JSON report and original documents individually.", 413);
        bytes = new Uint8Array(await object.arrayBuffer());
      } else if (!/\.(txt|csv|json)$/i.test(filename)) filename += ".transcript.txt";
      totalBytes += bytes.byteLength;
      if (totalBytes > 16_000_000) throw new AppError("This evidence package exceeds 16 MB. Download its JSON report and original documents individually.", 413);
      files.push({ name: `sources/${String(i + 1).padStart(3, "0")}-${filename}`, bytes });
    }
    const manifest = await Promise.all(files.map(async file => ({ path: file.name, bytes: file.bytes.byteLength,
      sha256: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", file.bytes as BufferSource)), b => b.toString(16).padStart(2, "0")).join("") })));
    files.push({ name: "manifest.json", bytes: encoder.encode(JSON.stringify({ exportedAt: new Date().toISOString(), reportId: report.id, revision: report.revision, files: manifest, note: "Fingerprints identify file content; they do not certify the truth of source records." }, null, 2)) });
    return download(evidenceZip(files) as BodyInit, "application/zip", name + "-evidence.zip");
  } catch (error) { return pharmaFailure(error); }
}
