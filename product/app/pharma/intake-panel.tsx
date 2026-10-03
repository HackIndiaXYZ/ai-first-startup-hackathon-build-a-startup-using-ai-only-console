"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  ScanLine,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import type { PharmaWorkspace } from "@/lib/pharma/types";
import {
  intakeFields,
  matchPharmaIntake,
  validateIntakeProposal,
  type IntakeColumnMap,
  type IntakeField,
  type IntakeKind,
  type IntakePreview,
  type IntakeRaw,
} from "@/lib/pharma/intake";
import type { PharmaTemplate } from "@/lib/pharma/templates";
import { renderDocument } from "@/lib/render-document";
import { Badge, Dialog, Panel } from "./ui";

export type PharmaAiStatus = {
  available: boolean;
  provider?: string;
  model?: string;
};
type PreviewResponse = {
  draftId: string;
  preview: IntakePreview;
  error?: string;
};

const names: Partial<Record<IntakeField, string>> = {
  productSku: "Product SKU",
  productName: "Product name",
  batchCode: "Batch code",
  partnerCode: "Partner ID",
  partnerName: "Partner name",
  locationCode: "Location ID",
  dispatchReference: "Original dispatch",
  dosageForm: "Dosage form",
  toLocationCode: "Destination ID",
};
const label = (field: IntakeField) =>
  names[field] || field.charAt(0).toUpperCase() + field.slice(1);
const kindLabels: Record<IntakeKind, string> = {
  receipt: "Goods receipt",
  dispatch: "Customer dispatch",
  return: "Customer return",
  recall: "Recall notice",
};
const fieldsToShow: IntakeField[] = [
  "reference",
  "date",
  "productSku",
  "productName",
  "strength",
  "dosageForm",
  "manufacturer",
  "batchCode",
  "expiry",
  "quantity",
  "unit",
  "partnerCode",
  "locationCode",
  "dispatchReference",
  "reason",
];

export default function IntakePanel({
  workspace,
  templates,
  ai,
  canWrite,
  onUpdated,
  onClose,
}: {
  workspace: PharmaWorkspace;
  templates: PharmaTemplate[];
  ai: PharmaAiStatus;
  canWrite: boolean;
  onUpdated: (workspace: PharmaWorkspace) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"template" | "csv" | "ai">("template"),
    [kind, setKind] = useState<IntakeKind>("receipt");
  const [text, setText] = useState(""),
    [filename, setFilename] = useState("distribution-records.csv"),
    [columnMap, setColumnMap] = useState<IntakeColumnMap>({});
  const [draft, setDraft] = useState<PreviewResponse | null>(null),
    [corrections, setCorrections] = useState<Record<string, IntakeRaw>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [reviewNote, setReviewNote] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [consent, setConsent] = useState(false),
    [provider, setProvider] = useState(
      ai.provider === "openai" ? "openai" : "fireworks",
    ),
    [success, setSuccess] = useState("");
  const [queue, setQueue] = useState<File[]>([]);
  const approvalRequest = useRef<{ fingerprint: string; id: string } | null>(null);

  const checked = useMemo(
    () =>
      draft?.preview.records.map((row) => {
        const record = corrections[row.id]
          ? validateIntakeProposal(
              row.kind,
              corrections[row.id],
              row.evidence,
              row.id,
            )
          : row;
        if (corrections[row.id])
          record.issues.push(
            ...row.issues.filter(
              (issue) =>
                issue.field === "row" ||
                issue.field === "evidence" ||
                (issue.code === "unsupported-evidence" &&
                  corrections[row.id][issue.field] === row.raw[issue.field]),
            ),
          );
        return { record, match: matchPharmaIntake(record, workspace) };
      }) || [],
    [draft, corrections, workspace],
  );
  const hasErrors =
    !checked.length ||
    checked.some(
      (item) =>
        item.record.issues.some((issue) => issue.severity === "error") ||
        !item.match.exact,
    );

  async function preview(payload: unknown | FormData) {
    setBusy(true);
    setError("");
    setSuccess("");
    setReviewed(false);
    try {
      const response = await fetch(
        "/api/pharma/intake",
        payload instanceof FormData
          ? { method: "POST", body: payload }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
      );
      const body = (await response.json()) as PreviewResponse;
      if (!response.ok)
        throw Error(
          body.error ||
            "The document could not be prepared. Your workspace has not changed.",
        );
      setDraft(body);
      setCorrections({});
      setColumnMap(body.preview.columnMap);
      setReviewNote("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The document could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadCsv(selected: File) {
    if (selected.size > 350_000) {
      setError(
        "Use a CSV smaller than 350 KB. Large records can be split into batches of at most 200 rows.",
      );
      return;
    }
    const value = await selected.text();
    setText(value);
    setFilename(selected.name);
    setColumnMap({});
    setDraft(null);
    setSuccess("");
  }

  async function approve() {
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({ draftId: draft?.draftId, reviewNote, corrections });
      if (approvalRequest.current?.fingerprint !== fingerprint) approvalRequest.current = { fingerprint, id: crypto.randomUUID() };
      const response = await fetch("/api/pharma/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "approve",
          draftId: draft?.draftId,
          revision: workspace.revision,
          requestId: approvalRequest.current.id,
          reviewNote,
          corrections: Object.entries(corrections).map(([id, raw]) => ({
            id,
            raw,
          })),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        workspace?: PharmaWorkspace;
      };
      if (!response.ok)
        throw Error(body.error || "The reviewed records could not be posted.");
      if (!body.workspace)
        throw Error(
          "The server did not return the updated workspace. Refresh before retrying.",
        );
      onUpdated(body.workspace);
      approvalRequest.current = null;
      setSuccess(
        `${checked.length} reviewed ${checked.length === 1 ? "record was" : "records were"} posted with source evidence.`,
      );
      setDraft(null);
      setReviewed(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The reviewed records could not be posted.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function extract() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set("mode", "ai");
      data.set("kind", kind);
      data.set("file", file);
      data.set("consent", "yes");
      data.set("provider", provider);
      if (provider === "fireworks") {
        const pages = await renderDocument(file, () => {});
        if (pages.length) {
          data.set("pageCount", String(pages.length));
          for (const page of pages) data.append("page", page);
        }
      }
      await preview(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The source could not be prepared for extraction.",
      );
      setBusy(false);
    }
  }

  function downloadTemplate(template: PharmaTemplate, blank = false) {
    const csv = blank
      ? template.csv.split(/\r?\n/, 1)[0] + "\r\n"
      : template.csv;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = blank
      ? template.filename.replace("example", "template")
      : template.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      title="Bring a document into the workflow"
      eyebrow="Document intake"
      onClose={onClose}
      busy={busy}
      wide
    >
      <div className="ph-dialog-body">
        <div className="ph-notice">
          <WandSparkles size={20} />
          <div>
            <strong>Guided example · No API key needed</strong>
            <p>
              Explore the same review-and-post workflow using pre-filled
              records. No AI request is made. Live AI extraction is an optional
              separate mode.
            </p>
          </div>
        </div>
        <div
          className="ph-mode-cards"
          role="radiogroup"
          aria-label="Document intake method"
          onKeyDown={(event) => {
            if (
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            const options = ["template", "csv", "ai"] as const;
            const next =
              (options.indexOf(mode) +
                (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) +
                options.length) %
              options.length;
            if (busy) return;
            setMode(options[next]);
            setDraft(null);
            setError("");
            (event.currentTarget.children[next] as HTMLElement)?.focus();
          }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "template"}
            tabIndex={mode === "template" ? 0 : -1}
            disabled={busy}
            onClick={() => {
              setMode("template");
              setDraft(null);
              setError("");
            }}
          >
            <WandSparkles size={21} />
            <strong>Guided examples</strong>
            <small>Pre-filled source records. Ready to inspect and post.</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "csv"}
            tabIndex={mode === "csv" ? 0 : -1}
            disabled={busy}
            onClick={() => {
              setMode("csv");
              setDraft(null);
              setError("");
            }}
          >
            <FileSpreadsheet size={21} />
            <strong>Structured import</strong>
            <small>Your CSV columns, mapped directly. No AI needed.</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "ai"}
            tabIndex={mode === "ai" ? 0 : -1}
            disabled={busy}
            onClick={() => {
              setMode("ai");
              setDraft(null);
              setError("");
            }}
          >
            <Sparkles size={21} />
            <strong>Live AI assistance</strong>
            <small>
              Optional document extraction with a configured provider.
            </small>
          </button>
        </div>
        {success && (
          <div className="ph-notice" role="status">
            <Check size={20} />
            <div>
              <strong>Records saved</strong>
              <p>{success}</p>
            </div>
          </div>
        )}
        {!draft && mode === "template" && (
          <div className="ph-template-grid">
            {templates.map((template) => (
              <article className="ph-template-card" key={template.id}>
                <Badge tone="accent">{kindLabels[template.kind]}</Badge>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <div>
                  <button
                    className="ph-button ph-button-primary"
                    type="button"
                    disabled={busy || !canWrite}
                    onClick={() =>
                      preview({ mode: "template", templateId: template.id })
                    }
                  >
                    Review example <ArrowRight size={14} />
                  </button>
                  <button
                    className="ph-text-button"
                    type="button"
                    onClick={() => downloadTemplate(template)}
                  >
                    Source CSV
                  </button>
                  <button
                    className="ph-text-button"
                    type="button"
                    onClick={() => downloadTemplate(template, true)}
                  >
                    Blank template
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {!draft && mode === "csv" && (
          <div>
            <div className="ph-form-grid">
              <label className="ph-field">
                <span>Document type</span>
                <select
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as IntakeKind)
                  }
                >
                  {Object.entries(kindLabels).map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ph-field">
                <span>Upload CSV files</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  onChange={async (event) => {
                    const files = Array.from(event.target.files || []);
                    if (files[0]) {
                      await loadCsv(files[0]);
                      setQueue(files.slice(1));
                    }
                  }}
                />
                <small>
                  Review files one at a time. Up to 200 rows per file.
                </small>
              </label>
              <label className="ph-field ph-field-full">
                <span>CSV source · {filename}</span>
                <textarea
                  rows={8}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="reference,date,productSku,batchCode,expiry,quantity,unit,partnerCode,locationCode"
                />
                <small>
                  Column names can be mapped after preview. Original rows remain
                  attached as evidence.
                </small>
              </label>
            </div>
            <div className="ph-actions" style={{ marginTop: 17 }}>
              <button
                className="ph-button ph-button-primary"
                disabled={busy || !text.trim() || !canWrite}
                onClick={() =>
                  preview({
                    mode: "csv",
                    kind,
                    text,
                    sourceName: filename,
                    columnMap,
                  })
                }
              >
                <ScanLine size={15} />
                Prepare records
              </button>
              {templates
                .filter((template) => template.kind === kind)
                .map((template) => (
                  <button
                    key={template.id}
                    className="ph-text-button"
                    onClick={() => downloadTemplate(template, true)}
                  >
                    Download CSV template
                  </button>
                ))}
            </div>
            {queue.length > 0 && (
              <p className="ph-dense-note" style={{ marginTop: 14 }}>
                {queue.length} more {queue.length === 1 ? "file" : "files"}{" "}
                selected.{" "}
                <button
                  className="ph-text-button"
                  disabled={busy}
                  onClick={async () => {
                    const [next, ...remaining] = queue;
                    if (next) await loadCsv(next);
                    setQueue(remaining);
                  }}
                >
                  Load next file
                </button>
              </p>
            )}
          </div>
        )}
        {!draft && mode === "ai" && (
          <div>
            <div className={`ph-notice ${!ai.available ? "ph-warning" : ""}`}>
              <Info size={18} />
              <div>
                <strong>
                  {ai.available
                    ? `${ai.provider === "openai" ? "OpenAI" : "Fireworks"} is configured on this server`
                    : "Live extraction is not configured on this server"}
                </strong>
                <p>
                  {ai.available
                    ? `Requests use the server's provider configuration${ai.model ? ` (${ai.model})` : ""}. Provider limits apply. Your key is never shared with judges or sent to the browser.`
                    : "Guided examples and CSV imports work fully without a key. A workspace operator can configure Fireworks or OpenAI on the server to enable extraction."}
                </p>
              </div>
            </div>
            <div className="ph-form-grid">
              <label className="ph-field">
                <span>Document type</span>
                <select
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as IntakeKind)
                  }
                >
                  {Object.entries(kindLabels).map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ph-field">
                <span>Provider</span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  <option value="fireworks">Fireworks</option>
                  <option value="openai">OpenAI</option>
                </select>
                <small>
                  {provider === ai.provider
                    ? "The configured provider will receive this document."
                    : "Change the server configuration before using this provider."}
                </small>
              </label>
              <label className="ph-field ph-field-full">
                <span>Source document</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <small>
                  Use distribution records only. Keep patient information and
                  unrelated personal data out of uploads.
                </small>
              </label>
            </div>
            <label className="ph-check-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                I can share this document with the selected provider and
                understand that extraction produces proposals for review.
              </span>
            </label>
            <button
              style={{ marginTop: 17 }}
              className="ph-button ph-button-primary"
              disabled={
                busy ||
                !file ||
                !consent ||
                !ai.available ||
                provider !== ai.provider ||
                !canWrite
              }
              onClick={() => void extract()}
            >
              <Sparkles size={15} />
              Extract proposed records
            </button>
          </div>
        )}
        {draft && (
          <div>
            <div className="ph-notice">
              <FileText size={19} />
              <div>
                <strong>
                  {draft.preview.mode === "ai"
                    ? "AI-assisted proposals"
                    : draft.preview.mode === "guided"
                      ? "Pre-filled example records"
                      : "Structured records"}
                </strong>
                <p>{draft.preview.notice}</p>
              </div>
              <Badge>
                {draft.preview.records.length}{" "}
                {draft.preview.records.length === 1 ? "record" : "records"}
              </Badge>
            </div>
            {draft.preview.mode === "csv" && (
              <details
                className="ph-intake-review"
                style={{ marginBottom: 18 }}
              >
                <summary>Map CSV columns</summary>
                <p className="ph-dense-note" style={{ margin: "12px 0" }}>
                  Map required fields to the original headers. Rebuilding the
                  preview preserves the original source, and replaces unsaved
                  corrections.
                </p>
                <div className="ph-form-grid">
                  {intakeFields.map((field) => (
                    <label className="ph-field" key={field}>
                      <span>{label(field)}</span>
                      <select
                        value={columnMap[field] || ""}
                        onChange={(event) =>
                          setColumnMap((value) => {
                            const next = { ...value };
                            if (event.target.value)
                              next[field] = event.target.value;
                            else delete next[field];
                            return next;
                          })
                        }
                      >
                        <option value="">Not mapped</option>
                        {draft.preview.headers.map((header) => (
                          <option key={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <button
                  className="ph-button"
                  style={{ marginTop: 17 }}
                  disabled={busy}
                  onClick={() =>
                    preview({
                      mode: "csv",
                      kind,
                      text,
                      sourceName: filename,
                      columnMap,
                    })
                  }
                >
                  Rebuild preview
                </button>
              </details>
            )}
            <details className="ph-intake-review">
              <summary>
                <FolderOpen
                  size={14}
                  style={{ display: "inline", marginRight: 7 }}
                />
                Original source · {draft.preview.source.name}
              </summary>
              <pre className="ph-source-text">{draft.preview.source.text}</pre>
            </details>
            {draft.preview.issues.length > 0 && (
              <ul className="ph-issues">
                {draft.preview.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            )}
            {checked.map(({ record, match }, index) => (
              <article className="ph-intake-review" key={record.id}>
                <div className="ph-intake-review-head">
                  <div>
                    <h3>
                      {index + 1}. {kindLabels[record.kind]} ·{" "}
                      {record.values.reference || "Reference required"}
                    </h3>
                    <p>
                      Source line {record.evidence.line}
                      {record.evidence.page
                        ? ` · Page ${record.evidence.page}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    tone={
                      record.status === "ready" && match.exact
                        ? "good"
                        : "warning"
                    }
                  >
                    {record.status === "ready" && match.exact
                      ? "Exact record match"
                      : "Complete record details"}
                  </Badge>
                </div>
                <div className="ph-form-grid">
                  {fieldsToShow
                    .filter(
                      (field) =>
                        !(
                          record.kind === "recall" &&
                          [
                            "quantity",
                            "unit",
                            "partnerCode",
                            "locationCode",
                            "dispatchReference",
                          ].includes(field)
                        ) &&
                        !(
                          record.kind !== "return" &&
                          field === "dispatchReference"
                        ),
                    )
                    .map((field) => (
                      <label
                        className={`ph-field ${field === "reason" ? "ph-field-full" : ""}`}
                        key={field}
                      >
                        <span>{label(field)}</span>
                        <input
                          value={(corrections[record.id] || record.raw)[field]}
                          onChange={(event) => {
                            setCorrections((value) => ({
                              ...value,
                              [record.id]: {
                                ...(value[record.id] || record.raw),
                                [field]: event.target.value,
                              },
                            }));
                            setReviewed(false);
                          }}
                        />
                      </label>
                    ))}
                </div>
                <blockquote className="ph-evidence-quote">
                  {record.evidence.quote}
                </blockquote>
                {(record.issues.length > 0 || match.issues.length > 0) && (
                  <ul className="ph-issues">
                    {record.issues.map((issue, issueIndex) => (
                      <li key={`record-${issueIndex}`}>{issue.message}</li>
                    ))}
                    {match.issues.map((issue, issueIndex) => (
                      <li key={`match-${issueIndex}`}>
                        {typeof issue === "string" ? issue : issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
            <label className="ph-field" style={{ marginTop: 23 }}>
              <span>Review note</span>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Describe how you verified the source, identifiers and quantities, including any corrections."
              />
              <small>Your note is stored with the review decision.</small>
            </label>
            <label className="ph-check-row">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              <span>
                I have reviewed the source, product and batch identity,
                quantities, units and any corrections. Post these records to the
                workspace.
              </span>
            </label>
          </div>
        )}
        {busy && (
          <div
            className="ph-notice"
            role="status"
            style={{ marginTop: 20, marginBottom: 0 }}
          >
            <Loader2 size={18} />
            <div>
              <strong>
                {draft
                  ? "Saving reviewed records…"
                  : mode === "ai"
                    ? "Preparing document proposals…"
                    : "Preparing records…"}
              </strong>
              <p>
                Keep this dialog open until the server responds. The workspace
                updates only after confirmation.
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="ph-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer className="ph-dialog-footer">
        <button
          className="ph-button"
          type="button"
          disabled={busy}
          onClick={
            draft
              ? () => {
                  setDraft(null);
                  setError("");
                }
              : onClose
          }
        >
          {draft ? "Back to source options" : "Close"}
        </button>
        {draft && (
          <button
            className="ph-button ph-button-primary"
            type="button"
            disabled={
              busy ||
              hasErrors ||
              !reviewed ||
              reviewNote.trim().length < 12 ||
              !canWrite
            }
            onClick={approve}
          >
            <Check size={15} />
            Post {checked.length} reviewed{" "}
            {checked.length === 1 ? "record" : "records"}
          </button>
        )}
      </footer>
    </Dialog>
  );
}
