"use client";
import { useState } from "react";
import {
  Check,
  FileText,
  LoaderCircle,
  Sparkles,
  Upload,
  ArrowDownToLine,
  TriangleAlert,
  FlaskConical,
} from "lucide-react";
import type { Workspace } from "@/lib/domain";
import type { Draft } from "@/lib/draft";
import { csvTemplate, type ExtractedRecord } from "@/lib/import-records";
import Modal from "./modal";
const labels: Record<string, string> = {
  code: "Reference / code",
  lotCode: "Ingredient lot code",
  batchCode: "Production batch",
  ingredient: "Ingredient",
  product: "Product",
  supplier: "Supplier",
  customer: "Customer",
  receivedKg: "Received (kg)",
  usedKg: "Used (kg)",
  producedPacks: "Produced (packs)",
  packs: "Delivered (packs)",
  date: "Delivery date",
  evidence: "Source evidence quote",
};
const fields: Record<ExtractedRecord["type"], (keyof ExtractedRecord)[]> = {
  lot: ["code", "ingredient", "supplier", "receivedKg"],
  batch: ["code", "lotCode", "product", "usedKg", "producedPacks"],
  delivery: ["code", "batchCode", "customer", "packs", "date"],
};
const numeric = new Set(["receivedKg", "usedKg", "producedPacks", "packs"]);
export default function UploadPanel({
  workspace,
  aiAvailable,
  onClose,
  onSaved,
}: {
  workspace: Workspace;
  aiAvailable: boolean;
  onClose: () => void;
  onSaved: (w: Workspace) => void;
}) {
  const [mode, setMode] = useState<"ai" | "csv">(aiAvailable ? "ai" : "csv"),
    [file, setFile] = useState<File | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [records, setRecords] = useState<ExtractedRecord[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [original, setOriginal] = useState("");
  function choose(f: File | undefined) {
    setFile(f || null);
    setError("");
    if (original) URL.revokeObjectURL(original);
    setOriginal(f ? URL.createObjectURL(f) : "");
  }
  async function extract() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      form.append("consent", consent ? "yes" : "no");
      const r = await fetch("/api/extract", { method: "POST", body: form });
      const d = (await r.json()) as { draft: Draft; error: string };
      if (!r.ok) throw Error(d.error);
      setDraft(d.draft);
      setRecords(d.draft.records);
      setReviewed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          records,
          reviewed,
          revision: workspace.revision,
        }),
      });
      const d = (await r.json()) as { workspace: Workspace; error: string };
      if (!r.ok) throw Error(d.error);
      if (original) URL.revokeObjectURL(original);
      onSaved(d.workspace);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(index: number, key: keyof ExtractedRecord, value: string) {
    setReviewed(false);
    setRecords((old) =>
      old.map((r, i) =>
        i === index
          ? {
              ...r,
              [key]: numeric.has(key)
                ? value === ""
                  ? null
                  : Number(value)
                : value || null,
            }
          : r,
      ),
    );
  }
  function template() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvTemplate], { type: "text/csv" }));
    a.download = "recallscope-synthetic-import.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const close = () => {
    if (original) URL.revokeObjectURL(original);
    onClose();
  };
  return (
    <Modal
      title={draft ? "Review proposed records" : "Add source records"}
      label={draft ? "REVIEW BEFORE CONNECTING" : "DOCUMENT INTAKE"}
      onClose={close}
      busy={busy}
      wide={!!draft}
    >
      {!draft ? (
        <div className="modal-body">
          <p>
            Add supplier receipts, production sheets or delivery records. Every
            import is reviewed before it changes the trace.
          </p>
          {workspace.synthetic && (
            <div className="import-info">
              <FlaskConical size={18} />
              <p>
                This workspace contains fictional sample records. New uploads
                will be mixed with them. Use “Start empty workspace” first to
                work only with your own records.
              </p>
            </div>
          )}
          <div className="import-methods">
            <button
              className={mode === "ai" ? "selected" : ""}
              onClick={() => setMode("ai")}
              disabled={busy}
            >
              <Sparkles size={20} />
              <strong>Read with AI</strong>
              <small>PDF, image or text</small>
              <span>{aiAvailable ? "Connected" : "Connection needed"}</span>
            </button>
            <button
              className={mode === "csv" ? "selected" : ""}
              onClick={() => setMode("csv")}
              disabled={busy}
            >
              <FileText size={20} />
              <strong>Structured CSV</strong>
              <small>Review exact record fields</small>
              <span>Available now</span>
            </button>
          </div>
          {mode === "ai" && !aiAvailable && (
            <div className="import-info">
              <TriangleAlert size={18} />
              <p>
                Live AI extraction is not connected yet. You can explore the
                sample drill or import records using the CSV template.
              </p>
            </div>
          )}
          {mode === "csv" && (
            <div className="import-info">
              <FileText size={18} />
              <p>
                Use the record template. Keep identifiers exact, use kilograms
                for ingredients and whole packs for production and deliveries.
              </p>
              <button className="text-button" onClick={template}>
                <ArrowDownToLine size={15} /> Sample CSV
              </button>
            </div>
          )}
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) choose(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={28} />
            <strong>
              {file ? file.name : "Choose a document or drop it here"}
            </strong>
            <span>
              {file
                ? (file.size / 1024).toFixed(1) + " KB"
                : "Up to 5 MB · one document at a time"}
            </span>
            <input
              aria-label="Choose source document"
              type="file"
              accept={
                mode === "csv" ? ".csv" : ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
              }
              disabled={busy}
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          {mode === "ai" && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              <span>
                Send this document to OpenAI for extraction. I have permission
                to use its contents.
              </span>
            </label>
          )}
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="modal-body draft-body">
          <div className="draft-intro">
            <span className="status-pill">
              {draft.document.mode === "ai"
                ? "AI suggestions · not yet linked"
                : "CSV records · not yet linked"}
            </span>
            <strong>{records.length} proposed records</strong>
            <p>
              Compare every field with the source. Correct identifiers and
              quantities below; leave unsupported identifiers blank.
            </p>
          </div>
          <details className="draft-source" open>
            <summary>Inspect source · {draft.document.name}</summary>
            {file?.type.startsWith("image/") && original && (
              <img src={original} alt="Original uploaded source document" />
            )}
            {original && (
              <a href={original} download={file?.name} className="text-button">
                Download original source <ArrowDownToLine size={15} />
              </a>
            )}
            <pre>{draft.document.text}</pre>
          </details>
          <div className="draft-records">
            {records.map((r, i) => (
              <article className="draft-record" key={i}>
                <div className="draft-record-heading">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <h3>
                    {r.type === "lot"
                      ? "Ingredient receipt"
                      : r.type === "batch"
                        ? "Production batch"
                        : "Customer delivery"}
                  </h3>
                </div>
                <div className="draft-fields">
                  {fields[r.type].map((key) => (
                    <label key={key}>
                      <span>{labels[key]}</span>
                      <input
                        aria-label={"Record " + (i + 1) + " " + labels[key]}
                        type={
                          numeric.has(key)
                            ? "number"
                            : key === "date"
                              ? "date"
                              : "text"
                        }
                        min={numeric.has(key) ? "0" : undefined}
                        step={
                          key === "usedKg" || key === "receivedKg"
                            ? "any"
                            : numeric.has(key)
                              ? "1"
                              : undefined
                        }
                        value={String(r[key] ?? "")}
                        onChange={(e) => update(i, key, e.target.value)}
                        disabled={busy}
                      />
                    </label>
                  ))}
                </div>
                <label className="evidence-field">
                  <span>Exact source evidence quote</span>
                  <textarea
                    aria-label={"Record " + (i + 1) + " source evidence quote"}
                    value={r.evidence}
                    onChange={(e) => update(i, "evidence", e.target.value)}
                    rows={2}
                    disabled={busy}
                  />
                </label>
              </article>
            ))}
          </div>
          <label className="check-label review-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            <span>
              I checked all proposed records against the source. Confirmed
              fields are supported; unresolved identifiers may remain blank.
            </span>
          </label>
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
        </div>
      )}
      <div className="modal-footer">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => (draft ? setDraft(null) : close())}
        >
          {draft ? "Back" : "Cancel"}
        </button>
        <button
          className="button primary"
          disabled={
            busy ||
            (!draft &&
              (!file || (mode === "ai" && (!aiAvailable || !consent)))) ||
            (!!draft && !reviewed)
          }
          onClick={draft ? commit : extract}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : draft ? (
            <Check size={16} />
          ) : (
            <FileText size={16} />
          )}{" "}
          {busy
            ? draft
              ? "Saving reviewed records…"
              : mode === "ai"
                ? "Reading document…"
                : "Preparing records…"
            : draft
              ? "Confirm records & connect"
              : "Prepare for review"}
        </button>
      </div>
    </Modal>
  );
}
