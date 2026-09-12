"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileText,
  FlaskConical,
  GitBranch,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react";
import {
  traceLot,
  type Workspace,
  type Batch,
  type SourceDocument,
  type Delivery,
} from "@/lib/domain";
import UploadPanel from "./upload-panel";
import Modal from "./modal";
type View = "trace" | "records" | "review" | "reports";
const fmt = (n: number) => n.toLocaleString("en-US");
export function download(name: string, text: string, type = "text/markdown") {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export default function Home() {
  const [w, setW] = useState<Workspace | null>(null),
    [view, setView] = useState<View>("trace"),
    [lotId, setLotId] = useState("lot-a"),
    [selected, setSelected] = useState("batch-01");
  const [source, setSource] = useState<{
      doc: SourceDocument;
      line: number;
    } | null>(null),
    [review, setReview] = useState<Batch | null>(null),
    [note, setNote] = useState(""),
    [chosenLot, setChosenLot] = useState("");
  const [deliveryReview, setDeliveryReview] = useState<Delivery | null>(null),
    [chosenBatch, setChosenBatch] = useState("");
  const [upload, setUpload] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ai, setAi] = useState(false),
    [query, setQuery] = useState(""),
    [confirm, setConfirm] = useState<"reset" | "clear" | null>(null),
    [help, setHelp] = useState(false);
  useEffect(() => {
    fetch("/api/workspace")
      .then(async (r) => {
        const d = (await r.json()) as {
          workspace: Workspace;
          aiAvailable: boolean;
          error: string;
        };
        if (!r.ok) throw Error(d.error);
        setW(d.workspace);
        setAi(d.aiAvailable);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (w && !w.lots.some((l) => l.id === lotId)) setLotId(w.lots[0]?.id || "");
  }, [w, lotId]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  async function mutate(body: Record<string, unknown>) {
    if (!w) return null;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, revision: w.revision }),
      });
      const d = (await r.json()) as {
        workspace: Workspace;
        aiAvailable: boolean;
        error: string;
      };
      if (!r.ok) throw Error(d.error);
      setW(d.workspace);
      return d.workspace as Workspace;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function evidence(id: string, line: number) {
    const doc = w?.documents.find((d) => d.id === id);
    if (doc) setSource({ doc, line });
    else
      setNotice(
        "The production record is missing. Upload it to establish this connection.",
      );
  }
  function beginReview(b: Batch) {
    setReview(b);
    setNote("");
    setChosenLot(lotId || w?.lots[0]?.id || "");
  }
  async function report() {
    if (await mutate({ action: "report", lotId })) {
      setView("reports");
      setNotice("Report saved as a fixed snapshot of this drill.");
    }
  }
  const t = w ? traceLot(w, lotId) : null,
    lot = w?.lots.find((l) => l.id === lotId),
    batch = w?.batches.find((b) => b.id === selected),
    unresolved = w?.batches.filter((b) => b.status === "unresolved") || [];
  const orphaned =
    w?.deliveries.filter(
      (d) => !d.batchId || !w.batches.some((b) => b.id === d.batchId),
    ) || [];
  const reviewCount = unresolved.length + orphaned.length;
  const titles = {
    trace: ["Trace workspace", "Follow the evidence. Know the scope."],
    records: ["Source records", "Every connection begins with a record."],
    review: ["Review queue", "Resolve the gaps that change the picture."],
    reports: ["Drill reports", "A clear record of what you know."],
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="RecallScope home">
          <span className="brand-mark">
            <GitBranch size={24} />
          </span>
          <span>
            Recall<b>Scope</b>
          </span>
        </a>
        <div className="workspace-label">
          <span className="avatar">F</span>
          <div>
            <strong>
              {w?.synthetic ? "Fieldwork Bakery" : "Your workspace"}
            </strong>
            <small>
              {w?.synthetic
                ? "Demonstration workspace"
                : "Private browser session"}
            </small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "trace", label: "Trace workspace", icon: GitBranch },
              { id: "records", label: "Source records", icon: FileText },
              { id: "review", label: "Review queue", icon: ClipboardCheck },
              { id: "reports", label: "Drill reports", icon: Layers3 },
            ] as const
          ).map((i) => (
            <button
              key={i.id}
              className={"nav-item " + (view === i.id ? "active" : "")}
              onClick={() => setView(i.id)}
              aria-current={view === i.id ? "page" : undefined}
              aria-label={i.label}
            >
              <i.icon size={19} />
              <span>{i.label}</span>
              {i.id === "review" && unresolved.length + orphaned.length > 0 && (
                <em>{unresolved.length + orphaned.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="exercise-note">
            <FlaskConical size={21} />
            <strong>Built for the practice run.</strong>
            <p>
              Trace the records, review the gaps, and rehearse your response.
            </p>
            <button onClick={() => setHelp(true)}>
              How this drill works <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} /> About this workspace
          </button>
          <div className="profile">
            <span className="avatar">C</span>
            <div>
              <strong>Console</strong>
              <small>HackIndia 2026</small>
            </div>
            <ShieldCheck size={18} />
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{titles[view][0]}</strong>
          </div>
          <div className="topbar-right">
            <span className="sample-tag">
              <FlaskConical size={14} />
              {w?.synthetic
                ? w.documents.some((d) => d.mode !== "sample")
                  ? "Mixed demo + uploads"
                  : "Synthetic demo"
                : "Practice workspace"}
            </span>
            <span className="save-state">
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <CheckCheck size={16} />
              )}{" "}
              {busy ? "Saving…" : w ? "Saved in workspace" : "Connecting…"}
            </span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">EVIDENCE-FIRST TRACEABILITY</div>
              <h1>{titles[view][0]}</h1>
              <p>{titles[view][1]}</p>
            </div>
            <div className="heading-actions">
              {view === "trace" && (
                <button
                  className="button secondary"
                  disabled={!lot || busy}
                  onClick={report}
                >
                  <ArrowDownToLine size={17} /> Save drill report
                </button>
              )}
              <button
                className="button primary"
                disabled={!w}
                onClick={() => setUpload(true)}
              >
                <Plus size={18} /> Add records
              </button>
            </div>
          </div>
          {error && (
            <div className="message error" role="alert">
              <TriangleAlert size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message success" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!w ? (
            <div className="empty-state">
              {error ? (
                <>
                  <TriangleAlert />
                  <h2>Workspace unavailable</h2>
                  <button
                    className="button secondary"
                    onClick={() => location.reload()}
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle className="spin" />
                  <p>Opening your traceability workspace…</p>
                </>
              )}
            </div>
          ) : (
            <>
              {view === "trace" && t && (
                <>
                  <section className="lot-toolbar">
                    <div className="lot-control">
                      <span className="icon-tile">
                        <Box size={22} />
                      </span>
                      <div>
                        <label htmlFor="selected-lot">
                          Investigating ingredient lot
                        </label>
                        <select
                          id="selected-lot"
                          value={lotId}
                          onChange={(e) => {
                            setLotId(e.target.value);
                            setSelected("");
                          }}
                        >
                          {!w.lots.length && (
                            <option value="">Add an ingredient lot</option>
                          )}
                          {w.lots.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code} · {l.ingredient}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="lot-supplier">
                      <small>SUPPLIER</small>
                      <strong>{lot?.supplier || "No records yet"}</strong>
                    </div>
                    <span className="drill-badge">Recall drill active</span>
                  </section>
                  <section className="metrics" aria-label="Trace results">
                    <div className="metric">
                      <span>
                        Confirmed batches <Box size={16} />
                      </span>
                      <strong>
                        {t.batches.length}
                        <small>/ {w.batches.length} recorded</small>
                      </strong>
                      <p>Evidence-linked to this ingredient lot</p>
                    </div>
                    <div className="metric">
                      <span>
                        Delivered packs <Truck size={16} />
                      </span>
                      <strong data-testid="confirmed-packs">
                        {fmt(t.confirmedPacks)}
                      </strong>
                      <p>
                        Across {t.customers.length} confirmed{" "}
                        {t.customers.length === 1 ? "customer" : "customers"}
                      </p>
                    </div>
                    <div className="metric amber">
                      <span>
                        Unresolved delivered packs <TriangleAlert size={16} />
                      </span>
                      <strong data-testid="unresolved-packs">
                        {fmt(t.unresolvedPacks)}
                      </strong>
                      <p>Workspace-wide · may be in scope</p>
                    </div>
                    <div className="metric">
                      <span>
                        Source records <FileText size={16} />
                      </span>
                      <strong>{w.documents.length}</strong>
                      <p>Original evidence stays inspectable</p>
                    </div>
                  </section>
                  {!!reviewCount && (
                    <div className="review-banner">
                      <TriangleAlert size={20} />
                      <div>
                        <strong>
                          {reviewCount} record{" "}
                          {reviewCount === 1 ? "link needs" : "links need"} a
                          closer look
                        </strong>
                        <span>
                          One unclear lot code or missing record can change the
                          scope.
                        </span>
                      </div>
                      <button onClick={() => setView("review")}>
                        Review gaps <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <section className="panel">
                    <div className="section-bar">
                      <div>
                        <h2>From ingredient to customer</h2>
                        <small>Select a batch to inspect its evidence.</small>
                      </div>
                      <div className="legend">
                        <span>
                          <i />
                          Confirmed
                        </span>
                        <span>
                          <i className="dashed" />
                          Unresolved
                        </span>
                      </div>
                    </div>
                    <div className="graph-and-inspector">
                      <div className="graph-scroll">
                        <div className="trace-graph">
                          <div className="graph-labels">
                            <span>INGREDIENT LOT</span>
                            <span>PRODUCTION BATCH</span>
                            <span>CUSTOMER DELIVERIES</span>
                          </div>
                          {!w.batches.length ? (
                            <div className="empty-state">
                              <GitBranch size={32} />
                              <h3>Your trace starts here</h3>
                              <p>
                                Add supplier, production and delivery records to
                                connect the dots.
                              </p>
                              <button
                                className="button primary"
                                onClick={() => setUpload(true)}
                              >
                                Add your first record
                              </button>
                            </div>
                          ) : (
                            <div
                              className="graph-body"
                              style={{
                                height: Math.max(450, w.batches.length * 90),
                              }}
                            >
                              <svg
                                className="graph-connections"
                                aria-hidden="true"
                                width="100%"
                                height="100%"
                                viewBox={
                                  "0 0 720 " +
                                  Math.max(450, w.batches.length * 90)
                                }
                                preserveAspectRatio="none"
                              >
                                {w.batches.map((b, i) => {
                                  const y = 38 + i * 90,
                                    pending = b.status === "unresolved";
                                  return (
                                    <g
                                      key={b.id}
                                      className={
                                        b.lotId === lotId
                                          ? "edge-confirmed"
                                          : pending
                                            ? "edge-pending"
                                            : "edge-other"
                                      }
                                    >
                                      {b.lotId === lotId &&
                                        b.status === "confirmed" && (
                                          <path
                                            d={
                                              "M 184 184 C 219 184, 226 " +
                                              y +
                                              ", 260 " +
                                              y
                                            }
                                          />
                                        )}
                                      <path d={"M 450 " + y + " L 505 " + y} />
                                    </g>
                                  );
                                })}
                              </svg>
                              <div className="ingredient-card">
                                <span className="node-caption">
                                  <Box size={14} />
                                  {lot?.ingredient || "Choose a lot"}
                                </span>
                                <strong>{lot?.code || "—"}</strong>
                                <span>
                                  {lot?.receivedKg == null
                                    ? "Received quantity missing"
                                    : lot.receivedKg + " kg received"}
                                </span>
                                <button
                                  disabled={!lot}
                                  onClick={() =>
                                    lot && evidence(lot.sourceId, lot.line)
                                  }
                                >
                                  <FileText size={13} /> View source{" "}
                                  <ArrowUpRight size={13} />
                                </button>
                              </div>
                              <div className="batch-column">
                                {w.batches.map((b) => (
                                  <button
                                    key={b.id}
                                    aria-label={"Inspect batch " + b.code}
                                    onClick={() => setSelected(b.id)}
                                    className={
                                      "batch-node " +
                                      (b.lotId === lotId
                                        ? "linked"
                                        : b.status === "unresolved"
                                          ? "pending"
                                          : "other") +
                                      (selected === b.id ? " selected" : "")
                                    }
                                  >
                                    <span className="node-caption">
                                      {b.status === "unresolved" ? (
                                        <TriangleAlert size={12} />
                                      ) : (
                                        <Box size={12} />
                                      )}{" "}
                                      {b.status === "unresolved"
                                        ? "Needs review"
                                        : b.lotId === lotId
                                          ? "Confirmed link"
                                          : "Other ingredient lot"}
                                    </span>
                                    <strong>{b.code}</strong>
                                    <span>
                                      {b.producedPacks === null
                                        ? "Production quantity missing"
                                        : fmt(b.producedPacks) +
                                          " packs produced"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                              <div className="delivery-column">
                                {w.batches.map((b) => {
                                  const ds = w.deliveries.filter(
                                    (d) => d.batchId === b.id,
                                  );
                                  return (
                                    <button
                                      key={b.id}
                                      className={
                                        "delivery-node " +
                                        (b.lotId === lotId
                                          ? "linked"
                                          : b.status === "unresolved"
                                            ? "pending"
                                            : "other")
                                      }
                                      onClick={() => {
                                        setSelected(b.id);
                                        if (ds[0])
                                          evidence(ds[0].sourceId, ds[0].line);
                                      }}
                                    >
                                      <span>
                                        <Truck size={14} />
                                        <strong>
                                          {fmt(
                                            ds.reduce((n, d) => n + d.packs, 0),
                                          )}{" "}
                                          packs
                                        </strong>
                                      </span>
                                      <span>
                                        {[
                                          ...new Set(ds.map((d) => d.customer)),
                                        ].join(" + ") ||
                                          "No recorded deliveries"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <aside className="inspector">
                        {batch ? (
                          <>
                            <div className="inspector-label">
                              BATCH DETAILS <Box size={16} />
                            </div>
                            <h3>{batch.code}</h3>
                            <p>{batch.product}</p>
                            <span
                              className={
                                "status-pill " +
                                (batch.status === "unresolved" ? "warn" : "")
                              }
                            >
                              {batch.status === "unresolved" ? (
                                <TriangleAlert size={12} />
                              ) : (
                                <Check size={12} />
                              )}{" "}
                              {batch.status === "unresolved"
                                ? "Review required"
                                : "Link confirmed"}
                            </span>
                            <dl>
                              <div>
                                <dt>Ingredient lot as recorded</dt>
                                <dd className="mono">{batch.rawLotCode}</dd>
                              </div>
                              <div>
                                <dt>Flour used</dt>
                                <dd>
                                  {batch.usedKg === null
                                    ? "Not recorded"
                                    : batch.usedKg + " kg"}
                                </dd>
                              </div>
                              <div>
                                <dt>Produced</dt>
                                <dd>
                                  {batch.producedPacks === null
                                    ? "Not recorded"
                                    : fmt(batch.producedPacks) + " packs"}
                                </dd>
                              </div>
                            </dl>
                            <div className="evidence-box">
                              <FileText size={18} />
                              <strong>
                                {batch.sourceId
                                  ? "Production evidence"
                                  : "Source missing"}
                              </strong>
                              <p>
                                {batch.sourceId
                                  ? w.documents.find(
                                      (d) => d.id === batch.sourceId,
                                    )?.name
                                  : "The delivery register names this batch, but its production record is absent."}
                              </p>
                              <button
                                onClick={() =>
                                  batch.sourceId
                                    ? evidence(batch.sourceId, batch.line)
                                    : setUpload(true)
                                }
                              >
                                {batch.sourceId
                                  ? "Inspect source"
                                  : "Upload production record"}{" "}
                                <ArrowUpRight size={14} />
                              </button>
                            </div>
                            {batch.sourceId && (
                              <button
                                className={
                                  "button full " +
                                  (batch.status === "unresolved"
                                    ? "primary"
                                    : "secondary")
                                }
                                onClick={() => beginReview(batch)}
                              >
                                {batch.status === "unresolved"
                                  ? "Review ingredient link"
                                  : "Review or correct link"}{" "}
                                <ArrowRight size={15} />
                              </button>
                            )}
                            <p className="inspector-footnote">
                              Every confirmed connection is based on a source
                              record or a recorded operator decision.
                            </p>
                          </>
                        ) : (
                          <div className="empty-state">
                            <Search size={25} />
                            <h3>Inspect a connection</h3>
                            <p>Select a batch on the map.</p>
                          </div>
                        )}
                      </aside>
                    </div>
                    <div className="graph-footer">
                      <span>
                        <ShieldCheck size={15} /> Confirmed links determine
                        scope. Missing links remain unresolved.
                      </span>
                      <span>
                        {w.synthetic
                          ? w.documents.some((d) => d.mode !== "sample")
                            ? "CONTAINS SYNTHETIC RECORDS"
                            : "ALL RECORDS ARE SYNTHETIC"
                          : "PRACTICE EXERCISE"}
                      </span>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-bar">
                      <h2>Confirmed customer exposure</h2>
                      <small>
                        {t.deliveries.length} delivery{" "}
                        {t.deliveries.length === 1 ? "record" : "records"}
                      </small>
                    </div>
                    {t.customers.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Customer</th>
                              <th>Production batches</th>
                              <th>Delivered packs</th>
                              <th>Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.customers.map((c) => {
                              const ds = t.deliveries.filter(
                                (d) => d.customer === c,
                              );
                              return (
                                <tr key={c}>
                                  <td>
                                    <Truck size={16} />
                                    <strong>{c}</strong>
                                  </td>
                                  <td className="mono">
                                    {[
                                      ...new Set(
                                        ds.map(
                                          (d) =>
                                            w.batches.find(
                                              (b) => b.id === d.batchId,
                                            )?.code || d.rawBatchCode,
                                        ),
                                      ),
                                    ].join(", ")}
                                  </td>
                                  <td>
                                    <strong>
                                      {fmt(ds.reduce((n, d) => n + d.packs, 0))}
                                    </strong>{" "}
                                    packs
                                  </td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        evidence(ds[0].sourceId, ds[0].line)
                                      }
                                    >
                                      View register <ArrowUpRight size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-inline">
                        No confirmed customer deliveries for this lot yet.
                      </div>
                    )}
                  </section>
                </>
              )}
              {view === "records" && (
                <section className="panel">
                  <div className="section-bar">
                    <div>
                      <h2>{w.documents.length} source records</h2>
                      <small>
                        Original documents remain unchanged after review.
                      </small>
                    </div>
                    <label className="search-input">
                      <Search size={17} />
                      <input
                        aria-label="Search records"
                        placeholder="Find a record…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  {w.documents
                    .filter((d) =>
                      (d.name + " " + d.kind)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((d) => (
                      <button
                        className="record-row"
                        key={d.id}
                        onClick={() => evidence(d.id, 0)}
                      >
                        <span className="file-icon">
                          <FileText size={22} />
                        </span>
                        <div>
                          <strong>{d.name}</strong>
                          <small>
                            {d.kind} ·{" "}
                            {d.mode === "sample"
                              ? "Synthetic sample"
                              : d.mode === "ai"
                                ? "AI-assisted extraction · reviewed"
                                : "Operator-reviewed import"}
                          </small>
                        </div>
                        <span className="record-label">
                          View evidence <ArrowUpRight size={15} />
                        </span>
                      </button>
                    ))}
                  {!w.documents.length && (
                    <div className="empty-inline">
                      Add a supplier invoice, production sheet or delivery
                      record to get started.
                    </div>
                  )}
                  <div className="records-bottom">
                    <p>
                      PDF and image extraction uses AI when connected.
                      Structured text records can be reviewed and imported
                      without AI.
                    </p>
                    <button
                      className="text-button"
                      disabled={!w.documents.some((d) => d.mode === "sample")}
                      onClick={() =>
                        download(
                          "recallscope-synthetic-records.txt",
                          w.documents
                            .filter((d) => d.mode === "sample")
                            .map((d) => "=== " + d.name + " ===\n" + d.text)
                            .join("\n\n"),
                          "text/plain",
                        )
                      }
                    >
                      <ArrowDownToLine size={16} /> Download sample sources
                    </button>
                  </div>
                </section>
              )}
              {view === "review" && (
                <>
                  <div className="review-intro">
                    <TriangleAlert size={24} />
                    <div>
                      <h2>{reviewCount} unresolved record links</h2>
                      <p>
                        Unknown connections stay unresolved until the records
                        support a decision.
                      </p>
                    </div>
                  </div>
                  <div className="review-cards">
                    {unresolved.map((b) => (
                      <article className="review-card" key={b.id}>
                        <div className="review-card-top">
                          <span className="status-pill warn">
                            {b.sourceId
                              ? "Ambiguous identifier"
                              : "Missing source record"}
                          </span>
                          <span className="mono">{b.code}</span>
                        </div>
                        <h2>
                          {b.sourceId
                            ? "A letter or a zero?"
                            : "This batch has no consumption sheet."}
                        </h2>
                        <p>
                          {b.sourceId
                            ? "The recorded lot “" +
                              b.rawLotCode +
                              "” does not exactly match a supplier lot. Check the source before confirming a link."
                            : "Deliveries exist, but there is no record of which ingredient lot went into this batch. A date or recipe match cannot establish the connection."}
                        </p>
                        <div className="review-impact">
                          <Truck size={17} />
                          <strong>
                            {fmt(
                              w.deliveries
                                .filter((d) => d.batchId === b.id)
                                .reduce((n, d) => n + d.packs, 0),
                            )}{" "}
                            delivered packs
                          </strong>
                          <span>remain unresolved</span>
                        </div>
                        <button
                          className="button secondary"
                          onClick={() =>
                            b.sourceId ? beginReview(b) : setUpload(true)
                          }
                        >
                          {b.sourceId
                            ? "Review source & resolve"
                            : "Add missing production record"}{" "}
                          <ArrowRight size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                  {orphaned.map((d) => (
                    <article className="review-card orphan-card" key={d.id}>
                      <span className="status-pill warn">
                        Delivery batch unknown
                      </span>
                      <h2>
                        {d.customer} · {fmt(d.packs)} packs
                      </h2>
                      <p>
                        The dispatch has no confirmed production batch. These
                        packs stay unresolved until the source supports a batch
                        reference.
                      </p>
                      <div className="heading-actions">
                        <button
                          className="button secondary"
                          onClick={() => evidence(d.sourceId, d.line)}
                        >
                          Inspect dispatch
                        </button>
                        <button
                          className="button primary"
                          disabled={!w.batches.length}
                          onClick={() => {
                            setDeliveryReview(d);
                            setChosenBatch(w.batches[0]?.id || "");
                            setNote("");
                          }}
                        >
                          Review batch reference
                        </button>
                      </div>
                    </article>
                  ))}
                  {!unresolved.length && !orphaned.length && (
                    <div className="empty-state">
                      <CheckCheck size={35} />
                      <h2>All recorded production links reviewed</h2>
                      <p>This is not a safety or completeness certification.</p>
                    </div>
                  )}
                  <section className="panel">
                    <div className="section-bar">
                      <h2>Decision history</h2>
                      <small>{w.audit.length} recorded decisions</small>
                    </div>
                    {w.audit.length ? (
                      w.audit.map((a) => (
                        <div className="audit-row" key={a.id}>
                          <Check size={18} />
                          <div>
                            <strong>
                              {a.action} · {a.entity}
                            </strong>
                            <p className="mono">
                              {a.before} → {a.after}
                            </p>
                            <p>{a.note}</p>
                            <time>{new Date(a.at).toLocaleString()}</time>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-inline">
                        Your evidence-based decisions will appear here.
                      </div>
                    )}
                  </section>
                </>
              )}
              {view === "reports" && (
                <section className="panel">
                  <div className="section-bar">
                    <div>
                      <h2>Saved drill snapshots</h2>
                      <small>
                        Later corrections never rewrite a previous report.
                      </small>
                    </div>
                    <button
                      className="button primary"
                      disabled={!lot || busy}
                      onClick={report}
                    >
                      <Plus size={16} /> Save current drill
                    </button>
                  </div>
                  {w.reports.length ? (
                    w.reports.map((r) => (
                      <article className="report-row" key={r.id}>
                        <span className="file-icon">
                          <ClipboardCheck size={25} />
                        </span>
                        <div>
                          <div className="eyebrow">
                            {r.id} · REVISION {r.revision}
                          </div>
                          <h3>Recall drill · {r.lotCode}</h3>
                          <p>
                            {fmt(r.confirmedPacks)} confirmed packs ·{" "}
                            {fmt(r.unresolvedPacks)} unresolved ·{" "}
                            {new Date(r.at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          className="button secondary"
                          onClick={() => download(r.id + ".md", r.content)}
                        >
                          <ArrowDownToLine size={16} /> Download report
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <ClipboardCheck size={36} />
                      <h2>Make the drill a record.</h2>
                      <p>
                        Save the current scope, sources, unresolved exposure and
                        decisions in one report.
                      </p>
                      <button
                        className="button primary"
                        disabled={!lot || busy}
                        onClick={report}
                      >
                        Save your first drill report <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <p className="report-note">
                    Practice records for operator review. RecallScope does not
                    send recall notices or certify food safety.
                  </p>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              RecallScope <span>/</span> Evidence before certainty.
            </span>
            <div>
              <button disabled={!w} onClick={() => setConfirm("reset")}>
                Reset sample drill
              </button>
              <button disabled={!w} onClick={() => setConfirm("clear")}>
                Start empty workspace
              </button>
            </div>
          </footer>
        </div>
      </main>
      {upload && w && (
        <UploadPanel
          workspace={w}
          aiAvailable={ai}
          onClose={() => setUpload(false)}
          onSaved={(next) => {
            setW(next);
            setUpload(false);
            setView("records");
            setNotice(
              "Reviewed records saved. Traceability has been recalculated.",
            );
          }}
        />
      )}
      {source && (
        <Modal
          title={source.doc.name}
          label="SOURCE EVIDENCE"
          wide
          onClose={() => setSource(null)}
        >
          <div className="source-meta">
            <span className="status-pill">
              {source.doc.mode === "sample"
                ? "Synthetic source"
                : source.doc.mode === "ai"
                  ? "AI transcription · verify original"
                  : "Imported source text"}
            </span>
            <span>
              {source.line > 0
                ? "Referenced line " + source.line
                : "Full document"}
            </span>
          </div>
          <div className="source-lines">
            {source.doc.text.split("\n").map((line, i) => (
              <div key={i} className={source.line === i + 1 ? "highlight" : ""}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <code>{line || " "}</code>
              </div>
            ))}
          </div>
          {source.doc.hash && (
            <div className="source-hash">
              SHA-256 <code>{source.doc.hash}</code>
            </div>
          )}
          <div className="modal-footer">
            <p>The original record is preserved when a link is corrected.</p>
            {source.doc.fileKey && (
              <a
                className="button secondary"
                href={"/api/document?id=" + encodeURIComponent(source.doc.id)}
                target="_blank"
                rel="noreferrer"
              >
                Original file <ArrowUpRight size={15} />
              </a>
            )}
            <button
              className="button secondary"
              onClick={() =>
                download(
                  source.doc.name + ".txt",
                  source.doc.text,
                  "text/plain",
                )
              }
            >
              <ArrowDownToLine size={16} /> Download text
            </button>
          </div>
        </Modal>
      )}
      {review && w && (
        <Modal
          title="Confirm the ingredient link"
          label="HUMAN REVIEW"
          busy={busy}
          onClose={() => setReview(null)}
        >
          <div className="modal-body">
            <span className="status-pill warn">{review.code}</span>
            <p>
              Check the source below. Confirm only the lot supported by this
              record.
            </p>
            <pre className="review-source">
              {w.documents.find((d) => d.id === review.sourceId)?.text}
            </pre>
            <label className="field-label" htmlFor="resolved-lot">
              Verified ingredient lot
            </label>
            <select
              className="form-control"
              id="resolved-lot"
              value={chosenLot}
              onChange={(e) => setChosenLot(e.target.value)}
            >
              {w.lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.supplier}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="evidence-note">
              What evidence supports this decision?
            </label>
            <textarea
              className="form-control"
              id="evidence-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Describe the source and how you verified the lot code…"
              rows={3}
            />
            <p className="field-hint">
              The original value, confirmed lot and your note are saved in
              decision history.
            </p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Keep unresolved
            </button>
            <button
              className="button primary"
              disabled={busy || note.trim().length < 12 || !chosenLot}
              onClick={async () => {
                if (
                  await mutate({
                    action: "resolve",
                    batchId: review.id,
                    lotId: chosenLot,
                    note,
                  })
                ) {
                  setReview(null);
                  setView("trace");
                  setSelected(review.id);
                  setNotice(
                    "Decision recorded. Confirmed deliveries have been recalculated.",
                  );
                }
              }}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              Confirm link & recalculate
            </button>
          </div>
        </Modal>
      )}
      {deliveryReview && w && (
        <Modal
          title="Identify the delivery batch"
          label="HUMAN REVIEW"
          busy={busy}
          onClose={() => setDeliveryReview(null)}
        >
          <div className="modal-body">
            <p>
              {deliveryReview.customer} · {deliveryReview.packs} packs ·{" "}
              {deliveryReview.id}
            </p>
            <pre className="review-source">
              {w.documents.find((d) => d.id === deliveryReview.sourceId)?.text}
            </pre>
            <label className="field-label" htmlFor="delivery-batch">
              Verified production batch
            </label>
            <select
              id="delivery-batch"
              className="form-control"
              value={chosenBatch}
              onChange={(e) => setChosenBatch(e.target.value)}
            >
              {w.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.product}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="delivery-note">
              What evidence identifies this batch?
            </label>
            <textarea
              id="delivery-note"
              className="form-control"
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeliveryReview(null)}
            >
              Keep unresolved
            </button>
            <button
              className="button primary"
              disabled={busy || note.trim().length < 12 || !chosenBatch}
              onClick={async () => {
                if (
                  await mutate({
                    action: "resolve-delivery",
                    deliveryId: deliveryReview.id,
                    batchId: chosenBatch,
                    note,
                  })
                ) {
                  setDeliveryReview(null);
                  setNotice(
                    "Delivery decision saved. The trace has been recalculated.",
                  );
                }
              }}
            >
              Confirm batch reference
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={
            confirm === "reset"
              ? "Reset the sample drill?"
              : "Start an empty workspace?"
          }
          busy={busy}
          onClose={() => setConfirm(null)}
        >
          <div className="modal-body">
            <p>
              This replaces the records, decisions and reports in this browser
              session. Download any reports you want to keep first.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                const next = await mutate({
                  action: confirm,
                  confirm: confirm.toUpperCase(),
                });
                if (next) {
                  setConfirm(null);
                  setView("trace");
                  setSelected("batch-01");
                  setLotId(next.lots[0]?.id || "");
                }
              }}
            >
              {confirm === "reset" ? "Reset sample" : "Start empty"}
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="An evidence-first recall drill"
          onClose={() => setHelp(false)}
        >
          <div className="modal-body help-content">
            <p>
              Follow one ingredient lot through production batches to recorded
              customer deliveries.
            </p>
            <ol>
              <li>
                <strong>Inspect.</strong> Select a lot and open the source
                behind a batch.
              </li>
              <li>
                <strong>Review.</strong> Resolve the unclear code with a
                source-supported note. Missing records stay unresolved.
              </li>
              <li>
                <strong>Record.</strong> Save a report that preserves this
                moment in the drill.
              </li>
            </ol>
            <p>
              All sample records are synthetic. Their extraction is
              pre-authored, not a live AI run. Uploaded documents use live AI
              only when connected.
            </p>
            <p>
              Records are saved server-side for this browser session. This is a
              single-operator practice tool without team accounts. It does not
              replace a real recall procedure.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
