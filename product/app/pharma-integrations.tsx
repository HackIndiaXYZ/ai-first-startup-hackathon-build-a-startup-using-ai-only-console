"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Download, ExternalLink, ScanLine, Thermometer, Workflow } from "lucide-react";
import { Panel, Badge } from "./pharma/ui";
import type { PharmaWorkspace } from "@/lib/pharma/types";
import type { lookupGs1Barcode, parseTemperatureCsv, previewEpcis, exportEpcis } from "@/lib/pharma/interoperability";

type Barcode = ReturnType<typeof lookupGs1Barcode>;
type Temperatures = ReturnType<typeof parseTemperatureCsv>;
type Events = ReturnType<typeof previewEpcis>;
type EventExport = ReturnType<typeof exportEpcis>;
type Notices = { jurisdiction: string; notice: string; retrievedAt: string; sourceUrl: string; records: { id: string; reportDate: string; firm: string; product: string; reason: string; batches: string; classification: string; status: string }[] };
function download(text: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PharmaConnections({ workspace, onUpdate, readOnly = false }: { workspace: PharmaWorkspace; onUpdate: (w: PharmaWorkspace) => void; readOnly?: boolean }) {
  const [section, setSection] = useState("barcode"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [barcode, setBarcode] = useState(""), [century, setCentury] = useState(""), [decoded, setDecoded] = useState<Barcode | null>(null);
  const [eventText, setEventText] = useState(""), [events, setEvents] = useState<Events | null>(null), [eventExport, setEventExport] = useState<EventExport | null>(null);
  const [temperatureText, setTemperatureText] = useState(""), [temperatures, setTemperatures] = useState<Temperatures | null>(null), [review, setReview] = useState("");
  const [notices, setNotices] = useState<Notices | null>(null), [noticeSearch, setNoticeSearch] = useState("");
  const [camera, setCamera] = useState(false), video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), scanning = useRef(false);
  useEffect(() => () => { scanning.current = false; stream.current?.getTracks().forEach(track => track.stop()); }, []);
  async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const value = await response.json() as T & { error?: string };
    if (!response.ok) throw Error(value.error || "The connection could not complete. Please retry.");
    return value;
  }
  async function run(task: () => Promise<void>) { setBusy(true); setError(""); try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Please retry."); } finally { setBusy(false); } }
  async function readFile(file: File | undefined, set: (text: string) => void) { if (!file) return; if (file.size > 5_000_000) { setError("Choose a document smaller than 5 MB."); return; } set(await file.text()); }
  function stopCamera() { scanning.current = false; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false); }
  async function startCamera() {
    type Detector = { detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    const BarcodeDetector = (window as unknown as { BarcodeDetector?: { new(options: { formats: string[] }): Detector; getSupportedFormats: () => Promise<string[]> } }).BarcodeDetector;
    if (!BarcodeDetector) { setError("This browser does not support camera barcode decoding. Use a USB scanner or paste the scanner value below."); return; }
    try {
      const formats = (await BarcodeDetector.getSupportedFormats()).filter(format => ["data_matrix", "code_128"].includes(format));
      if (!formats.length) throw Error("This browser cannot read GS1 DataMatrix. Use a USB scanner or paste the scanner value.");
      const detector = new BarcodeDetector({ formats });
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      setCamera(true); scanning.current = true;
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!video.current) { stopCamera(); return; }
      video.current.srcObject = stream.current; await video.current.play();
      const scan = async () => {
        if (!scanning.current || !video.current) return;
        try {
          const results = await detector.detect(video.current);
          if (results[0]) { setBarcode(results[0].rawValue); stopCamera(); return; }
        } catch { /* A frame can be unavailable while the camera focuses. */ }
        if (scanning.current) setTimeout(scan, 250);
      };
      void scan();
    } catch (e) { stopCamera(); setError(e instanceof Error ? e.message : "Camera could not open."); }
  }
  return <Panel title="Connections" description="Bring structured records into the same evidence-led workflow.">
    <div className="ph-tab-row" aria-label="Connection tools">{[["barcode", "Barcode lookup"], ["epcis", "EPCIS exchange"], ["temperature", "Temperature records"], ["notices", "Public notices"]].map(([id, label]) => <button key={id} type="button" aria-pressed={section === id} className={section === id ? "is-active" : ""} onClick={() => { stopCamera(); setSection(id); setError(""); }}>{label}</button>)}</div>
    <div className="ph-panel-body">
      {error && <p className="ph-alert" role="alert">{error}</p>}
      {section === "barcode" && <>
        <p className="ph-dense-note">Read GTIN, batch, expiry and serial identifiers from a GS1 scanner. An exact match opens the recorded identity; decoding alone does not establish authenticity.</p>
        <div className="ph-form-grid"><label className="ph-field ph-field-full">Scanner value<input value={barcode} onChange={e => { setBarcode(e.target.value); setDecoded(null); }} placeholder="Scan or paste (01)…(17)…(10)…" onKeyDown={e => { if (e.key === "Enter") void run(async () => setDecoded(await request<Barcode>("/api/pharma/connections", { type: "barcode", value: barcode, ...(century ? { century: Number(century) } : {}) }))); }} /></label>
          <label className="ph-field">Expiry century<select value={century} onChange={e => setCentury(e.target.value)}><option value="">Preserve printed year</option><option value="2000">2000–2099</option><option value="2100">2100–2199</option><option value="1900">1900–1999</option></select></label>
          <div className="ph-actions"><button className="ph-button" disabled={busy || !barcode} onClick={() => void run(async () => setDecoded(await request<Barcode>("/api/pharma/connections", { type: "barcode", value: barcode, ...(century ? { century: Number(century) } : {}) })))}><ScanLine size={16} /> Look up code</button><button className="ph-button ph-button-secondary" onClick={() => void startCamera()}><Camera size={16} /> Camera</button></div>
        </div>
        {camera && <div><video ref={video} playsInline muted style={{ width: "100%", maxHeight: 260, marginTop: 12, borderRadius: 8 }} /><button className="ph-button" onClick={stopCamera}>Stop camera</button></div>}
        {decoded && <div className="ph-notice" style={{ marginTop: 16 }}><div><Badge tone={decoded.exact ? "good" : "warning"}>{decoded.exact ? "Exact catalogue match" : "Decoded identifiers"}</Badge><p>GTIN {decoded.decoded.gtin} · Batch {decoded.decoded.batchCode || "Not encoded"} · Serial {decoded.decoded.serial || "Not encoded"}</p><p>{decoded.decoded.expiry ? `Expiry ${decoded.decoded.expiry.value}` : `Printed expiry ${decoded.decoded.expiryRaw || "Not encoded"}`}</p>{decoded.issues.map(issue => <p key={issue}>{issue}</p>)}</div></div>}
      </>}
      {section === "epcis" && <>
        <p className="ph-dense-note">Exchange distribution observations using the declared EPCIS 2.0 ObjectEvent quantity-count profile. Imported files open as previews; catalogue mapping is required before stock posting.</p>
        <div className="ph-actions"><button className="ph-button" disabled={busy} onClick={() => void run(async () => { const result = await request<EventExport>("/api/pharma/connections"); setEventExport(result); download(JSON.stringify(result.document, null, 2), "RecallScope-EPCIS.json"); })}><Download size={16} /> Export EPCIS</button></div>
        {eventExport && <p className="ph-dense-note">Exported {eventExport.document.epcisBody.eventList.length} distribution events. {eventExport.excluded.length} internal status events remain in the full workspace export. <button className="ph-text-button" onClick={() => download(JSON.stringify(eventExport, null, 2), "RecallScope-EPCIS-export-manifest.json")}>Download scope manifest</button></p>}
        <label className="ph-field" style={{ marginTop: 20 }}>EPCIS document<input type="file" accept=".json,application/json" onChange={e => void readFile(e.target.files?.[0], value => { setEventText(value); setEvents(null); })} /><textarea rows={6} value={eventText} onChange={e => { setEventText(e.target.value); setEvents(null); }} placeholder="Paste the EPCIS JSON document" /></label>
        <button className="ph-button ph-button-secondary" disabled={busy || !eventText} onClick={() => void run(async () => setEvents(await request<Events>("/api/pharma/connections", { type: "epcis.preview", document: eventText })))}><Workflow size={16} /> Validate and preview</button>
        {events && <div style={{ marginTop: 16 }}><Badge tone="good">{events.records.length} valid observation rows</Badge><p className="ph-dense-note">{events.notice}</p><div className="ph-table-wrap"><table><thead><tr><th>Reference</th><th>Product / batch</th><th>Quantity</th><th>Event</th></tr></thead><tbody>{events.records.slice(0, 30).map((row, i) => <tr key={`${row.eventId}-${i}`}><td>{row.reference || row.eventId}</td><td>{row.productSku || row.epcClass}<br />{row.batchCode}</td><td>{row.quantity} {row.unit}</td><td>{row.kind}</td></tr>)}</tbody></table></div>{events.records.length > 30 && <p className="ph-dense-note">Showing the first 30 rows; validation covers the complete file.</p>}</div>}
      </>}
      {section === "temperature" && <>
        <p className="ph-dense-note">Compare recorded observations with each product's documented temperature policy. An excursion is a recorded exception for the quality team.</p>
        <button className="ph-text-button" onClick={() => download("reference,productSku,batchCode,locationId,observedAt,celsius,note\r\n", "RecallScope-temperature-template.csv", "text/csv")}>Download CSV columns</button>
        <label className="ph-field" style={{ marginTop: 16 }}>Temperature register<input type="file" accept=".csv,text/csv" onChange={e => void readFile(e.target.files?.[0], value => { setTemperatureText(value); setTemperatures(null); })} /><textarea rows={5} value={temperatureText} onChange={e => { setTemperatureText(e.target.value); setTemperatures(null); }} placeholder="Paste observation rows under the template header" /></label>
        <button className="ph-button ph-button-secondary" disabled={busy || !temperatureText} onClick={() => void run(async () => setTemperatures(await request<Temperatures>("/api/pharma/connections", { type: "temperature.preview", text: temperatureText })))}><Thermometer size={16} /> Preview observations</button>
        {temperatures && <div style={{ marginTop: 16 }}><p>{temperatures.records.length} observations</p>{temperatures.records.map(row => <div className="ph-list-item" key={`${row.reference}-${row.evidence.line}`}><div><strong>{row.reference} · {row.productSku} / {row.batchCode}</strong><p>{row.celsius ?? "Unknown"} °C · {row.observedAt} · {row.policyStatus}</p>{row.issues.map(issue => <p key={issue}>{issue}</p>)}</div></div>)}<label className="ph-field">Review note<textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Describe how you checked the source observations" /></label><button className="ph-button" disabled={readOnly || busy || review.trim().length < 12 || !temperatures.records.length || temperatures.records.some(row => row.issues.length)} onClick={() => void run(async () => { const result = await request<{ workspace: PharmaWorkspace }>("/api/pharma/connections", { type: "temperature.import", text: temperatureText, revision: workspace.revision, requestId: crypto.randomUUID(), reviewNote: review }); onUpdate(result.workspace); setTemperatures(null); setTemperatureText(""); setReview(""); })}>Approve observations</button></div>}
      </>}
      {section === "notices" && <>
        <p className="ph-dense-note">Optional public reference: United States FDA drug enforcement reports. The list is separate from your workspace's fictional records and never creates a recall automatically.</p>
        <button className="ph-button ph-button-secondary" disabled={busy} onClick={() => void run(async () => setNotices(await request<Notices>("/api/pharma/alerts")))}><ExternalLink size={16} /> Load public notices</button>
        {notices && <><p className="ph-dense-note">Retrieved {new Date(notices.retrievedAt).toLocaleString()} · <a href={notices.sourceUrl} target="_blank" rel="noreferrer">View source records</a></p><label className="ph-field">Filter these notices<input value={noticeSearch} onChange={e => setNoticeSearch(e.target.value)} placeholder="Product, manufacturer or batch" /></label>{notices.records.filter(row => JSON.stringify(row).toLowerCase().includes(noticeSearch.toLowerCase())).map(row => <article className="ph-list-item" key={row.id}><div><Badge>{row.classification}</Badge><h3 style={{ fontSize: "1rem", margin: "8px 0" }}>{row.product}</h3><p>{row.firm} · {row.id} · {row.reportDate}</p><p>{row.reason}</p><p>Recorded codes: {row.batches}</p></div></article>)}</>}
      </>}
    </div>
  </Panel>;
}
