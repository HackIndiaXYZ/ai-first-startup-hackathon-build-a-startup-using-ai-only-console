"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  Archive,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  HelpCircle,
  History,
  LayoutDashboard,
  Link2,
  ListFilter,
  LockKeyhole,
  LogIn,
  Mail,
  MapPin,
  Moon,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Sun,
  Thermometer,
  Truck,
  Upload,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import {
  stockBalances,
  traceBatch,
  recallSummary,
  expiryStatus,
  daysUntilExpiry,
  fefoCandidates,
  serialLedger,
  packageSerials,
} from "@/lib/pharma/domain";
import type {
  PharmaWorkspace,
  PharmaAction,
  PharmaRole,
  Product,
  Batch,
  Movement,
  RecallCase,
  RecallRecipient,
  ReportSnapshot,
  SourceDocument,
  StockBalance,
} from "@/lib/pharma/types";
import type { PharmaTemplate } from "@/lib/pharma/templates";
import {
  defaultPreferences,
  preferenceKey,
  readPreferences,
  type Preferences,
} from "@/lib/preferences";
import IntakePanel, { type PharmaAiStatus } from "./intake-panel";
import PharmaConnections from "../pharma-integrations";
import QuantityDetail, { type QuantityMetric } from "./quantity-detail";
import RetentionPanel from "./retention-panel";
import { formDefinition, type FormRequest } from "./forms";
import {
  ActionForm,
  Badge,
  DataTable,
  Dialog,
  Empty,
  NumberValue,
  Panel,
  shortDate,
  productLabel,
  type Column,
} from "./ui";

type View =
  | "overview"
  | "products"
  | "stock"
  | "deliveries"
  | "recalls"
  | "documents"
  | "reports"
  | "settings";
type Access = {
  role: PharmaRole;
  displayName: string;
  signedIn: boolean;
  signInPath: string;
  secured?: boolean;
  owner?: boolean;
  userId?: string;
};
type ResponsePayload = {
  workspace: PharmaWorkspace;
  access: Access;
  ai: PharmaAiStatus;
  templates: PharmaTemplate[];
  error?: string;
};
type Detail = {
  type:
    "product" | "batch" | "source" | "movement" | "report" | "notice" | "audit";
  id: string;
  line?: number;
  partnerId?: string;
  batchId?: string;
};
type ExtraAction =
  | {
      type: "workspace.reset";
      scenario: "active" | "complete";
      confirm: "RESET";
    }
  | { type: "workspace.restore"; backup: unknown; reason: string }
  | { type: "workspace.rename"; name: string };
type Team = {
  members: { userId: string; email: string; name: string; role: PharmaRole }[];
  invitations: { email: string; role: PharmaRole; expiresAt: string }[];
  access?: Access;
};
const navigation: { id: View; label: string; icon: typeof Package }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "products", label: "Products & batches", icon: Package },
  { id: "stock", label: "Stock", icon: Boxes },
  { id: "deliveries", label: "Deliveries", icon: Truck },
  { id: "recalls", label: "Recalls", icon: ShieldCheck },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const descriptions: Record<
  View,
  { title: string; text: string; eyebrow: string }
> = {
  overview: {
    title: "A clear view of every batch.",
    text: "Stock, distribution and recall evidence in one connected workspace.",
    eyebrow: "Your distribution desk",
  },
  products: {
    title: "Products & batches",
    text: "Keep product identity, batch labels and expiry evidence together.",
    eyebrow: "Catalogue",
  },
  stock: {
    title: "Stock, with a history.",
    text: "Every receipt, transfer and status change contributes to the recorded balance.",
    eyebrow: "Warehouse operations",
  },
  deliveries: {
    title: "Every destination connected.",
    text: "Follow dispatched quantities to their recipients and account for returns.",
    eyebrow: "Distribution",
  },
  recalls: {
    title: "From recall to reconciliation.",
    text: "Define the scope, coordinate recipients and account for every affected quantity.",
    eyebrow: "Quality operations",
  },
  documents: {
    title: "Records with their evidence.",
    text: "Start with guided examples, import structured records or use optional live AI.",
    eyebrow: "Document workspace",
  },
  reports: {
    title: "A record you can explain.",
    text: "Fixed snapshots, original sources and an inspectable decision history.",
    eyebrow: "Evidence & reporting",
  },
  settings: {
    title: "Make this workspace yours.",
    text: "Appearance, team access, data recovery and extraction settings.",
    eyebrow: "Workspace settings",
  },
};
const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
const friendly = (value: string) =>
  value.replaceAll("-", " ").replaceAll(".", " · ");
const reportUrl = (
  format: "json" | "csv" | "pdf" | "evidence",
  reportId?: string,
) =>
  `/api/pharma/export?format=${format}${reportId ? `&reportId=${encodeURIComponent(reportId)}` : ""}`;
const badgeTone = (
  status: string,
): "good" | "warning" | "danger" | "neutral" | "accent" =>
  ["available", "current", "delivered", "closed"].includes(status)
    ? "good"
    : [
          "quarantined",
          "near-expiry",
          "reconciling",
          "in-transit",
          "reserved",
        ].includes(status)
      ? "warning"
      : ["expired", "rejected"].includes(status)
        ? "danger"
        : "neutral";

export default function PharmaWorkspace() {
  const [payload, setPayload] = useState<ResponsePayload | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("overview"),
    [preferences, setPreferences] = useState<Preferences>(defaultPreferences),
    [preferencesReady, setPreferencesReady] = useState(false);
  const [form, setForm] = useState<FormRequest | null>(null),
    [formError, setFormError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null),
    [intake, setIntake] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState("");
  const [catalogueTab, setCatalogueTab] = useState("batches"),
    [stockTab, setStockTab] = useState("balances"),
    [deliveriesTab, setDeliveriesTab] = useState("shipments"),
    [reportTab, setReportTab] = useState("snapshots");
  const [expiryFilter, setExpiryFilter] = useState("all"),
    [stockFilter, setStockFilter] = useState("all"),
    [nearDays, setNearDays] = useState(90),
    [selectedRecall, setSelectedRecall] = useState("");
  const [team, setTeam] = useState<Team | null>(null),
    [teamError, setTeamError] = useState(""),
    [inviteUrl, setInviteUrl] = useState(""),
    [resetScenario, setResetScenario] = useState<"active" | "complete" | null>(
      null,
    ),
    [restore, setRestore] = useState<{ name: string; backup: unknown } | null>(
      null,
    ),
    [restoreReason, setRestoreReason] = useState("");
  const [compareA, setCompareA] = useState(""),
    [compareB, setCompareB] = useState("");
  const [sourceFilter, setSourceFilter] = useState("active");
  const [quantityDetail, setQuantityDetail] = useState<{ recallId: string; metric: QuantityMetric } | null>(null);
  const [invitationToken, setInvitationToken] = useState("");
  const mainHeading = useRef<HTMLHeadingElement>(null),
    restoreInput = useRef<HTMLInputElement>(null);
  const reloadSequence = useRef(0);

  const reload = useCallback(async () => {
    const sequence = ++reloadSequence.current;
    try {
      const invite = new URLSearchParams(location.search).get("invite");
      if (invite && /^[a-f0-9]{64}$/.test(invite)) setInvitationToken(invite);
      const response = await fetch("/api/pharma", { cache: "no-store" });
      const data = (await response.json()) as ResponsePayload;
      if (!response.ok || !data.workspace)
        throw Error(data.error || "The workspace could not be loaded.");
      if (sequence !== reloadSequence.current) return null;
      setPayload((old) =>
        old?.workspace.id === data.workspace.id &&
        old.workspace.revision > data.workspace.revision
          ? old
          : data,
      );
      setLoadError("");
      return data;
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "The workspace could not be loaded.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const value = readPreferences(localStorage.getItem(preferenceKey));
    setPreferences(value);
    setPreferencesReady(true);
    try {
      const saved = Number(localStorage.getItem("recallscope.pharma.nearDays"));
      if (saved > 0 && saved <= 3650) setNearDays(saved);
      const hash = location.hash.slice(1);
      if (navigation.some((item) => item.id === hash)) setView(hash as View);
    } catch {}
  }, [reload]);
  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    document.documentElement.dataset.density = preferences.density;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        preferences.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preferences.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences, preferencesReady]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (form) setFormError("");
  }, [form]);

  const workspace = payload?.workspace;
  const balances = useMemo(
    () => (workspace ? stockBalances(workspace) : []),
    [workspace],
  );
  const activeRecalls =
    workspace?.recalls.filter((item) => item.status !== "closed") || [];
  const currentRecall =
    workspace?.recalls.find((item) => item.id === selectedRecall) ||
    activeRecalls[0] ||
    workspace?.recalls[0];
  const summary = useMemo(
    () =>
      workspace && currentRecall
        ? recallSummary(workspace, currentRecall.id)
        : null,
    [workspace, currentRecall],
  );
  const access = payload?.access || {
    role: "viewer" as PharmaRole,
    displayName: "Guest",
    signedIn: false,
    signInPath: "/signin-with-chatgpt?return_to=%2F",
  };
  const canWrite = access.role !== "viewer",
    canOperate = ["admin", "operations", "quality"].includes(access.role),
    canQuality = ["admin", "quality"].includes(access.role),
    canAdmin = access.role === "admin";
  const productById = (id: string) =>
    workspace?.products.find((item) => item.id === id);
  const batchById = (id: string) =>
    workspace?.batches.find((item) => item.id === id);
  const partnerName = (id?: string) =>
    workspace?.partners.find((item) => item.id === id)?.name || "—";
  const locationName = (id?: string) =>
    workspace?.locations.find((item) => item.id === id)?.name || "—";

  function navigate(next: View) {
    setView(next);
    history.replaceState(null, "", `#${next}`);
    setSearchOpen(false);
    setSearch("");
    setTimeout(() => mainHeading.current?.focus(), 0);
  }
  function openForm(value: FormRequest) {
    setDetail(null);
    setFormError("");
    setForm(value);
  }
  async function mutate(
    action: PharmaAction | ExtraAction,
    success = "Workspace updated.",
  ) {
    if (!workspace) return false;
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/pharma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: workspace.revision,
          requestId: crypto.randomUUID(),
          action,
        }),
      });
      const data = (await response.json()) as Partial<ResponsePayload> & {
        error?: string;
        replayed?: boolean;
      };
      if (!response.ok) {
        if (response.status === 409) await reload();
        throw Error(data.error || "The record could not be saved.");
      }
      const nextWorkspace = data.workspace;
      if (!nextWorkspace)
        throw Error(
          "The server did not return the updated workspace. Refresh before retrying.",
        );
      setPayload((old) =>
        old ? { ...old, ...data, workspace: nextWorkspace } : old,
      );
      setToast(success);
      return true;
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "The record could not be saved.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function loadTeam() {
    try {
      const response = await fetch("/api/pharma/team", { cache: "no-store" });
      const data = (await response.json()) as Team & { error?: string };
      if (!response.ok)
        throw Error(data.error || "Team details are unavailable.");
      setTeam(data);
      setTeamError("");
    } catch (err) {
      setTeamError(
        err instanceof Error ? err.message : "Team details are unavailable.",
      );
    }
  }
  async function teamAction(action: Record<string, unknown>) {
    setBusy(true);
    setTeamError("");
    try {
      const response = await fetch("/api/pharma/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = (await response.json()) as {
        error?: string;
        inviteUrl?: string;
      };
      if (!response.ok)
        throw Error(data.error || "The team change could not be saved.");
      if (data.inviteUrl) setInviteUrl(data.inviteUrl);
      await loadTeam();
      await reload();
      if (action.type === "accept") {
        setInvitationToken("");
        history.replaceState(null, "", "/#settings");
        setView("settings");
      }
      setToast(
        action.type === "invite"
          ? "Invitation link created. Nothing has been emailed."
          : "Team access updated.",
      );
    } catch (err) {
      setTeamError(
        err instanceof Error
          ? err.message
          : "The team change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (view === "settings" && payload)
      void loadTeam(); /* data is refreshed explicitly after team actions */
  }, [view, payload?.access.signedIn]);

  if (loading)
    return (
      <div className="ph-app">
        <div className="ph-loader">
          <div className="ph-logo" style={{ color: "var(--ph-ink)" }}>
            <ScanLine size={28} />
            <span>RecallScope</span>
          </div>
          <div className="ph-loading-line" />
          <p>Opening your distribution workspace…</p>
        </div>
      </div>
    );
  if (!workspace || !payload)
    return (
      <div className="ph-app">
        <div className="ph-loader">
          <Empty
            title="The workspace could not be opened"
            description={loadError || "Try loading the workspace again."}
            action={
              <button
                className="ph-button ph-button-primary"
                onClick={() => {
                  setLoading(true);
                  void reload();
                }}
              >
                <RefreshCw size={15} />
                Try again
              </button>
            }
          />
        </div>
      </div>
    );

  const expiryBatches = workspace.batches.filter(
    (batch) =>
      expiryStatus(batch.expiry, workspace.asOf, nearDays) !== "current",
  );
  const onHandBalances = balances.filter(
    (row) => row.status !== "disposed" && row.status !== "in-transit",
  );
  const productCell = (id: string) => {
    const product = productById(id);
    return (
      <>
        <strong>{product?.name || id}</strong>
        <small>
          {product?.strength} · {product?.dosageForm}
        </small>
      </>
    );
  };
  const batchCell = (id: string) => {
    const batch = batchById(id);
    return (
      <>
        <strong className="ph-mono">{batch?.code || id}</strong>
        <small>{productById(batch?.productId || "")?.sku}</small>
      </>
    );
  };
  const evidenceButton = (sourceId?: string, line?: number) =>
    sourceId ? (
      <button
        className="ph-text-button"
        onClick={() => setDetail({ type: "source", id: sourceId, line })}
      >
        <FileText size={13} />
        Source
      </button>
    ) : (
      <span className="ph-muted">—</span>
    );
  const recallPercent = summary?.shipped
    ? Math.min(
        100,
        Math.max(
          0,
          ((summary.shipped - summary.outstanding) / summary.shipped) * 100,
        ),
      )
    : 100;
  const openBatch = (id: string) => setDetail({ type: "batch", id });

  const batchColumns: Column<Batch>[] = [
    {
      key: "product",
      label: "Product",
      render: (row) => productCell(row.productId),
      value: (row) => productById(row.productId)?.name || "",
    },
    {
      key: "batch",
      label: "Batch",
      render: (row) => <span className="ph-mono">{row.code}</span>,
      value: (row) => row.code,
    },
    {
      key: "expiry",
      label: "Expiry",
      render: (row) => (
        <>
          <strong>{shortDate(row.expiry.value)}</strong>
          <small>
            {row.expiry.precision === "month"
              ? "Month label · end-of-month policy"
              : "Day precision"}
          </small>
        </>
      ),
      value: (row) => row.expiry.value,
    },
    {
      key: "available",
      label: "Available",
      render: (row) => (
        <NumberValue
          value={balances
            .filter(
              (item) => item.batchId === row.id && item.status === "available",
            )
            .reduce((sum, item) => sum + item.quantity, 0)}
          unit={productById(row.productId)?.baseUnit}
        />
      ),
      className: "ph-align-right",
      value: (row) =>
        balances
          .filter(
            (item) => item.batchId === row.id && item.status === "available",
          )
          .reduce((sum, item) => sum + item.quantity, 0),
    },
    {
      key: "held",
      label: "Quarantined",
      render: (row) => (
        <NumberValue
          value={balances
            .filter(
              (item) =>
                item.batchId === row.id && item.status === "quarantined",
            )
            .reduce((sum, item) => sum + item.quantity, 0)}
          unit={productById(row.productId)?.baseUnit}
        />
      ),
      className: "ph-align-right",
    },
    {
      key: "state",
      label: "Status",
      render: (row) => (
        <Badge
          tone={
            row.held
              ? "warning"
              : badgeTone(expiryStatus(row.expiry, workspace.asOf, nearDays))
          }
        >
          {row.held
            ? "Batch held"
            : friendly(expiryStatus(row.expiry, workspace.asOf, nearDays))}
        </Badge>
      ),
    },
    {
      key: "trace",
      label: "",
      render: (row) => (
        <button className="ph-text-button" onClick={() => openBatch(row.id)}>
          Trace <ArrowUpRight size={13} />
        </button>
      ),
    },
  ];
  const movementColumns: Column<Movement>[] = [
    {
      key: "reference",
      label: "Reference",
      render: (row) => (
        <>
          <strong>{row.reference}</strong>
          <small>{shortDate(row.at)}</small>
        </>
      ),
      value: (row) => row.reference,
    },
    {
      key: "kind",
      label: "Movement",
      render: (row) => (
        <Badge
          tone={
            row.kind === "return" || row.kind === "receipt"
              ? "accent"
              : row.kind === "hold"
                ? "warning"
                : "neutral"
          }
        >
          {friendly(row.kind)}
        </Badge>
      ),
      value: (row) => row.kind,
    },
    {
      key: "batch",
      label: "Product / batch",
      render: (row) => (
        <>
          <strong>{productById(row.productId)?.name}</strong>
          <small className="ph-mono">{batchById(row.batchId)?.code}</small>
        </>
      ),
    },
    {
      key: "route",
      label: "From → to",
      render: (row) => (
        <>
          <strong>
            {row.from
              ? locationName(row.from.locationId)
              : partnerName(row.partnerId)}{" "}
            →{" "}
            {row.to
              ? locationName(row.to.locationId)
              : partnerName(row.partnerId)}
          </strong>
          <small>
            {row.from?.status || "external"} → {row.to?.status || "external"}
          </small>
        </>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      render: (row) => <NumberValue value={row.quantity} unit={row.unit} />,
      value: (row) => row.quantity,
      className: "ph-align-right",
    },
    {
      key: "source",
      label: "Evidence",
      render: (row) =>
        evidenceButton(row.evidence?.sourceId, row.evidence?.line),
    },
  ];

  const overview = (
    <>
      <div className="ph-metrics">
        <Metric
          label="Products in catalogue"
          value={String(
            workspace.products.filter((item) => !item.archived).length,
          )}
          text={`${workspace.batches.length} distinct product batches`}
          icon={<Package size={14} />}
          onClick={() => navigate("products")}
        />
        <Metric
          label="Recorded stock locations"
          value={String(
            new Set(onHandBalances.map((item) => item.locationId)).size,
          )}
          text="Quantities kept in their own units"
          icon={<Building2 size={14} />}
          onClick={() => navigate("stock")}
        />
        <Metric
          label="Customer destinations"
          value={String(
            new Set(
              workspace.shipments
                .filter((item) => item.status !== "cancelled")
                .map((item) => item.partnerId),
            ).size,
          )}
          text={`${workspace.shipments.filter((item) => item.status !== "cancelled").length} linked dispatch records`}
          icon={<Truck size={14} />}
          onClick={() => navigate("deliveries")}
        />
        <Metric
          label="Recall accounting"
          value={currentRecall ? `${Math.round(recallPercent)}%` : "—"}
          text={
            currentRecall
              ? `${currentRecall.reference} · ${currentRecall.status === "closed" ? "Closed with evidence" : "Case in progress"}`
              : "No recall cases recorded"
          }
          icon={<ShieldCheck size={14} />}
          onClick={() => navigate("recalls")}
        />
      </div>
      <div className="ph-two-col">
        <Panel
          title={
            currentRecall?.status === "closed"
              ? "A complete recall record"
              : "Recall in focus"
          }
          description="One scope. Connected sources. Reconciled quantities."
          actions={
            <button
              className="ph-text-button"
              onClick={() => navigate("recalls")}
            >
              Open case <ArrowUpRight size={14} />
            </button>
          }
        >
          {currentRecall && summary ? (
            <div className="ph-recall-card">
              <div className="ph-recall-top">
                <div>
                  <Badge tone={badgeTone(currentRecall.status)}>
                    {currentRecall.reference} · {friendly(currentRecall.status)}
                  </Badge>
                  <h3>{productLabel(productById(currentRecall.productId))}</h3>
                  <p>
                    Batch{" "}
                    {currentRecall.batchIds
                      .map((id) => batchById(id)?.code)
                      .join(", ")}{" "}
                    · {summary.recipients.length} recipient sites
                  </p>
                </div>
                <ShieldCheck
                  size={36}
                  strokeWidth={1.1}
                  color="var(--ph-accent)"
                />
              </div>
              <div
                className="ph-progress"
                role="progressbar"
                aria-label="Affected shipment accounting"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(recallPercent)}
              >
                <span style={{ width: `${recallPercent}%` }} />
              </div>
              <div className="ph-progress-legend">
                <span>Affected shipment accounting</span>
                <strong>{Math.round(recallPercent)}% accounted for</strong>
              </div>
              <div className="ph-recall-stats">
                <div>
                  <strong>
                    {number(summary.shipped)} <small>{summary.unit}</small>
                  </strong>
                  <span>Historically dispatched</span>
                </div>
                <div>
                  <strong>
                    {number(summary.returned)} <small>{summary.unit}</small>
                  </strong>
                  <span>Returned to quarantine</span>
                </div>
                <div>
                  <strong>
                    {number(summary.outstanding)} <small>{summary.unit}</small>
                  </strong>
                  <span>Outstanding</span>
                </div>
              </div>
            </div>
          ) : (
            <Empty
              title="Start with a clear scope"
              description="Open a recall case to connect the affected batch, its stock and customer destinations."
              action={
                <button
                  className="ph-button"
                  disabled={!canQuality}
                  onClick={() => openForm({ kind: "recall" })}
                >
                  Open recall
                </button>
              }
            />
          )}
          <div className="ph-panel-foot">
            <span>
              Historical dispatch and current stock are separate measures.
            </span>
            <FileCheck2 size={15} />
          </div>
        </Panel>
        <Panel
          title="Your next actions"
          description="A focused view of operational work."
        >
          <ActionItem
            icon={<CalendarDays size={16} />}
            title={`${expiryBatches.length} batches in the expiry window`}
            text={`Expired or due within ${nearDays} days of ${shortDate(workspace.asOf)}.`}
            action={() => {
              setExpiryFilter("attention");
              navigate("products");
            }}
          />
          <ActionItem
            icon={<ShieldCheck size={16} />}
            title={`${activeRecalls.length} active recall ${activeRecalls.length === 1 ? "case" : "cases"}`}
            text={
              activeRecalls.length
                ? "Review recipients, returns and assigned follow-ups."
                : "Closed cases and their evidence remain available."
            }
            action={() => navigate("recalls")}
          />
          <ActionItem
            icon={<WandSparkles size={16} />}
            title="Try a guided document"
            text="Pre-filled source records. No API key needed."
            action={() => setIntake(true)}
          />
          <ActionItem
            icon={<ArrowRightLeft size={16} />}
            title={`${balances.filter((row) => row.status === "in-transit").length} stock lines in transit`}
            text="Transfers remain separate until receipt is recorded."
            action={() => {
              setStockTab("transfers");
              navigate("stock");
            }}
          />
        </Panel>
      </div>
      <Panel
        title="A batch's journey"
        description="Follow the evidence from receipt to customer and back."
        actions={
          <button
            className="ph-text-button"
            onClick={() =>
              openBatch(currentRecall?.batchIds[0] || workspace.batches[0]?.id)
            }
          >
            Explore trace <ArrowUpRight size={14} />
          </button>
        }
      >
        <div className="ph-panel-body">
          <div className="ph-flow">
            <div className="ph-flow-node">
              <Building2 size={27} strokeWidth={1.2} />
              <div>
                <strong>Supplier receipt</strong>
                <span>Product, batch and original quantity</span>
              </div>
            </div>
            <ArrowRight className="ph-flow-arrow" size={23} strokeWidth={1.1} />
            <div className="ph-flow-node">
              <Boxes size={27} strokeWidth={1.2} />
              <div>
                <strong>Warehouse ledger</strong>
                <span>Location, status and every movement</span>
              </div>
            </div>
            <ArrowRight className="ph-flow-arrow" size={23} strokeWidth={1.1} />
            <div className="ph-flow-node">
              <Truck size={27} strokeWidth={1.2} />
              <div>
                <strong>Customer destinations</strong>
                <span>Dispatch, response and returned stock</span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
      <div className="ph-two-col">
        <Panel
          title="Recent stock movements"
          description="Posted records with their original references."
          actions={
            <button
              className="ph-text-button"
              onClick={() => {
                setStockTab("ledger");
                navigate("stock");
              }}
            >
              View ledger <ArrowUpRight size={14} />
            </button>
          }
        >
          <DataTable
            id="recent-ledger"
            rows={[...workspace.movements].reverse().slice(0, 6)}
            columns={movementColumns.filter(
              (item) => !["source", "route"].includes(item.key),
            )}
            searchable={(row) =>
              `${row.reference} ${row.kind} ${productById(row.productId)?.name}`
            }
            rowKey={(row) => row.id}
            onRow={(row) => setDetail({ type: "movement", id: row.id })}
            placeholder="Search recent movements…"
          />
        </Panel>
        <Panel
          title="Decision history"
          description="People, evidence and a saved reason."
        >
          {[...workspace.audit]
            .reverse()
            .slice(0, 4)
            .map((event) => (
              <div className="ph-list-item" key={event.id}>
                <span className="ph-list-icon">
                  <History size={15} />
                </span>
                <div>
                  <strong>{friendly(event.action)}</strong>
                  <p>{event.reason}</p>
                  <small>
                    {event.actor} · {shortDate(event.at)}
                  </small>
                </div>
              </div>
            ))}
          <div className="ph-panel-foot">
            <button
              className="ph-text-button"
              onClick={() => {
                setReportTab("audit");
                navigate("reports");
              }}
            >
              Full audit history <ArrowRight size={13} />
            </button>
          </div>
        </Panel>
      </div>
      <Panel title="Keep the workflow moving">
        <div className="ph-quick-actions">
          <button
            disabled={!canOperate}
            onClick={() => openForm({ kind: "receipt" })}
          >
            <ArrowDownLeft size={20} />
            <div>
              <strong>Receive stock</strong>
              <small>Post a goods receipt</small>
            </div>
          </button>
          <button
            disabled={!canOperate}
            onClick={() => openForm({ kind: "dispatch" })}
          >
            <Truck size={20} />
            <div>
              <strong>Create a dispatch</strong>
              <small>Link a customer destination</small>
            </div>
          </button>
          <button disabled={!canWrite} onClick={() => setIntake(true)}>
            <FileText size={20} />
            <div>
              <strong>Import a document</strong>
              <small>Inspect, review and post</small>
            </div>
          </button>
        </div>
      </Panel>
    </>
  );

  const products = (
    <Panel
      title="Product identity & batch records"
      actions={
        <>
          <button
            className="ph-button"
            disabled={!canAdmin}
            onClick={() => openForm({ kind: "product" })}
          >
            <Plus size={14} />
            Product
          </button>
          <button
            className="ph-button ph-button-primary"
            disabled={!canAdmin}
            onClick={() => openForm({ kind: "batch" })}
          >
            <Plus size={14} />
            Batch
          </button>
        </>
      }
    >
      <Tabs
        value={catalogueTab}
        onChange={setCatalogueTab}
        tabs={[
          { value: "batches", label: `Batches (${workspace.batches.length})` },
          {
            value: "products",
            label: `Catalogue (${workspace.products.length})`,
          },
        ]}
      />
      {catalogueTab === "batches" ? (
        <DataTable
          id="batches"
          rows={workspace.batches.filter((batch) =>
            expiryFilter === "all" || expiryFilter === "attention"
              ? expiryFilter === "all" ||
                expiryStatus(batch.expiry, workspace.asOf, nearDays) !==
                  "current"
              : expiryFilter === "held"
                ? batch.held
                : expiryStatus(batch.expiry, workspace.asOf, nearDays) ===
                  expiryFilter,
          )}
          columns={batchColumns}
          rowKey={(row) => row.id}
          onRow={(row) => openBatch(row.id)}
          searchable={(row) =>
            `${row.code} ${row.originalCode} ${productById(row.productId)?.name} ${productById(row.productId)?.sku} ${productById(row.productId)?.strength} ${row.manufacturer}`
          }
          placeholder="Search product, SKU or batch…"
          filter={
            <select
              className="ph-table-filter"
              aria-label="Batch status filter"
              value={expiryFilter}
              onChange={(event) => setExpiryFilter(event.target.value)}
            >
              <option value="all">All batches</option>
              <option value="attention">Expiry window</option>
              <option value="near-expiry">Near expiry</option>
              <option value="expired">Expired</option>
              <option value="held">Batch held</option>
              <option value="current">Current expiry</option>
            </select>
          }
        />
      ) : (
        <DataTable<Product>
          id="catalogue"
          rows={workspace.products}
          rowKey={(row) => row.id}
          onRow={(row) => setDetail({ type: "product", id: row.id })}
          searchable={(row) =>
            `${row.name} ${row.sku} ${row.strength} ${row.genericName} ${row.gtin} ${row.manufacturer}`
          }
          placeholder="Search catalogue, GTIN or manufacturer…"
          columns={[
            {
              key: "name",
              label: "Product",
              render: (row) => productCell(row.id),
              value: (row) => row.name,
            },
            {
              key: "sku",
              label: "SKU",
              render: (row) => <span className="ph-mono">{row.sku}</span>,
              value: (row) => row.sku,
            },
            {
              key: "packaging",
              label: "Presentation",
              render: (row) => (
                <>
                  <strong>{row.packaging}</strong>
                  <small>Stocking unit: {row.baseUnit}</small>
                </>
              ),
            },
            {
              key: "manufacturer",
              label: "Manufacturer",
              render: (row) => row.manufacturer,
              value: (row) => row.manufacturer,
            },
            {
              key: "state",
              label: "State",
              render: (row) => (
                <Badge tone={row.archived ? "neutral" : "good"}>
                  {row.archived ? "Archived" : "Active"}
                </Badge>
              ),
            },
            {
              key: "version",
              label: "Version",
              render: (row) => `v${row.version}`,
            },
          ]}
        />
      )}
      <div className="ph-panel-foot">
        <span>
          Batch codes are scoped to a product and manufacturer. Equal printed
          codes do not merge products.
        </span>
        <span>As of {shortDate(workspace.asOf)}</span>
      </div>
    </Panel>
  );

  const transfers = workspace.movements
    .filter((row) => row.kind === "transfer-out")
    .map((row) => ({
      ...row,
      received: workspace.movements.some(
        (item) =>
          item.kind === "transfer-in" && item.transferId === row.transferId,
      ),
    }));
  const stock = (
    <>
      <Panel
        title="Recorded inventory"
        actions={
          <>
            <button
              className="ph-button"
              disabled={!canOperate}
              onClick={() => openForm({ kind: "transfer" })}
            >
              <ArrowRightLeft size={14} />
              Transfer
            </button>
            <ActionMenu label="Stock actions">
              <MenuButton
                disabled={!canOperate}
                onClick={() => openForm({ kind: "receipt" })}
              >
                Receive stock
              </MenuButton>
              <MenuButton
                disabled={!canOperate}
                onClick={() => openForm({ kind: "reserve" })}
              >
                Reserve stock
              </MenuButton>
              <MenuButton
                disabled={!canQuality}
                onClick={() => openForm({ kind: "hold" })}
              >
                Quarantine quantity
              </MenuButton>
              <MenuButton
                disabled={!canQuality}
                onClick={() => openForm({ kind: "release" })}
              >
                Release quantity
              </MenuButton>
              <MenuButton
                disabled={!canQuality}
                onClick={() => openForm({ kind: "reject" })}
              >
                Reject stock
              </MenuButton>
              <MenuButton
                disabled={!canQuality}
                onClick={() => openForm({ kind: "dispose" })}
              >
                Record disposal
              </MenuButton>
              <MenuButton
                disabled={!canQuality}
                onClick={() => openForm({ kind: "adjust" })}
              >
                Stocktake adjustment
              </MenuButton>
              <MenuButton
                disabled={!canOperate}
                onClick={() => openForm({ kind: "supplier-return" })}
              >
                Return to supplier
              </MenuButton>
              <MenuButton
                disabled={!canAdmin}
                onClick={() => openForm({ kind: "location" })}
              >
                Add location
              </MenuButton>
            </ActionMenu>
          </>
        }
      >
        <Tabs
          value={stockTab}
          onChange={setStockTab}
          tabs={[
            { value: "balances", label: "Balances" },
            { value: "ledger", label: "Movement ledger" },
            { value: "transfers", label: "Transfers" },
            { value: "allocation", label: "Expiry-first allocation" },
            { value: "temperature", label: "Temperature" },
          ]}
        />
        {stockTab === "balances" && (
          <DataTable<StockBalance>
            id="stock"
            rows={balances.filter(
              (row) => stockFilter === "all" || row.status === stockFilter,
            )}
            rowKey={(row) => `${row.batchId}-${row.locationId}-${row.status}`}
            onRow={(row) => openBatch(row.batchId)}
            searchable={(row) =>
              `${productById(row.productId)?.name} ${productById(row.productId)?.sku} ${batchById(row.batchId)?.code} ${locationName(row.locationId)} ${row.status}`
            }
            placeholder="Search product, batch or location…"
            filter={
              <select
                className="ph-table-filter"
                aria-label="Stock status filter"
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
              >
                <option value="all">All stock statuses</option>
                {[
                  "available",
                  "reserved",
                  "quarantined",
                  "rejected",
                  "in-transit",
                  "disposed",
                ].map((value) => (
                  <option value={value} key={value}>
                    {friendly(value)}
                  </option>
                ))}
              </select>
            }
            columns={[
              {
                key: "product",
                label: "Product",
                render: (row) => productCell(row.productId),
                value: (row) => productById(row.productId)?.name || "",
              },
              {
                key: "batch",
                label: "Batch",
                render: (row) => batchCell(row.batchId),
              },
              {
                key: "location",
                label: "Location",
                render: (row) => (
                  <>
                    <strong>{locationName(row.locationId)}</strong>
                    <small>
                      {
                        workspace.locations.find(
                          (item) => item.id === row.locationId,
                        )?.warehouse
                      }
                    </small>
                  </>
                ),
                value: (row) => locationName(row.locationId),
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={badgeTone(row.status)}>
                    {friendly(row.status)}
                  </Badge>
                ),
                value: (row) => row.status,
              },
              {
                key: "quantity",
                label: "Recorded quantity",
                render: (row) => (
                  <NumberValue value={row.quantity} unit={row.unit} />
                ),
                value: (row) => row.quantity,
                className: "ph-align-right",
              },
              {
                key: "expiry",
                label: "Expiry",
                render: (row) =>
                  shortDate(batchById(row.batchId)!.expiry.value),
                value: (row) => batchById(row.batchId)!.expiry.value,
              },
            ]}
          />
        )}
        {stockTab === "ledger" && (
          <DataTable
            id="ledger"
            rows={[...workspace.movements].reverse()}
            columns={movementColumns}
            searchable={(row) =>
              `${row.reference} ${row.kind} ${row.reason} ${batchById(row.batchId)?.code} ${productById(row.productId)?.name}`
            }
            rowKey={(row) => row.id}
            onRow={(row) => setDetail({ type: "movement", id: row.id })}
            placeholder="Search reference, batch or movement…"
            filter={
              <a className="ph-button" href={reportUrl("csv")}>
                <Download size={13} />
                CSV
              </a>
            }
          />
        )}
        {stockTab === "transfers" && (
          <DataTable
            id="transfers"
            rows={transfers}
            rowKey={(row) => row.id}
            searchable={(row) =>
              `${row.reference} ${batchById(row.batchId)?.code} ${locationName(row.from?.locationId)} ${locationName(row.destinationId)}`
            }
            onRow={(row) => setDetail({ type: "movement", id: row.id })}
            columns={[
              {
                key: "reference",
                label: "Transfer",
                render: (row) => (
                  <>
                    <strong>{row.reference}</strong>
                    <small>{batchById(row.batchId)?.code}</small>
                  </>
                ),
              },
              {
                key: "from",
                label: "Origin",
                render: (row) => locationName(row.from?.locationId),
              },
              {
                key: "to",
                label: "Destination",
                render: (row) => locationName(row.destinationId),
              },
              {
                key: "quantity",
                label: "Quantity",
                render: (row) => (
                  <NumberValue value={row.quantity} unit={row.unit} />
                ),
                className: "ph-align-right",
              },
              {
                key: "state",
                label: "State",
                render: (row) => (
                  <Badge tone={row.received ? "good" : "warning"}>
                    {row.received ? "Received" : "In transit"}
                  </Badge>
                ),
              },
              {
                key: "action",
                label: "",
                render: (row) =>
                  !row.received && (
                    <button
                      className="ph-text-button"
                      disabled={!canOperate}
                      onClick={() =>
                        openForm({
                          kind: "transfer-receive",
                          transferId: row.transferId,
                        })
                      }
                    >
                      Receive stock
                    </button>
                  ),
              },
            ]}
          />
        )}
        {stockTab === "allocation" && (
          <Allocation
            workspace={workspace}
            canOperate={canOperate}
            onDispatch={(batchId, locationId) =>
              openForm({ kind: "dispatch", batchId, locationId })
            }
          />
        )}
        {stockTab === "temperature" && (
          <>
            <div className="ph-panel-body" style={{ paddingTop: 18 }}>
              <div className="ph-actions">
                <p className="ph-dense-note">
                  Compared only with explicitly configured product limits.
                </p>
                <button
                  className="ph-button"
                  disabled={!canOperate && !canQuality}
                  onClick={() => openForm({ kind: "temperature" })}
                >
                  <Plus size={13} />
                  Observation
                </button>
              </div>
            </div>
            <DataTable
              id="temperature"
              rows={[...workspace.temperatures].reverse()}
              rowKey={(row) => row.id}
              searchable={(row) =>
                `${batchById(row.batchId)?.code} ${locationName(row.locationId)} ${row.note}`
              }
              columns={[
                {
                  key: "batch",
                  label: "Batch",
                  render: (row) => batchCell(row.batchId),
                },
                {
                  key: "location",
                  label: "Location",
                  render: (row) => locationName(row.locationId),
                },
                {
                  key: "at",
                  label: "Observed",
                  render: (row) => new Date(row.observedAt).toLocaleString(),
                  value: (row) => row.observedAt,
                },
                {
                  key: "celsius",
                  label: "Reading",
                  render: (row) => (
                    <NumberValue value={row.celsius} unit="°C" />
                  ),
                  className: "ph-align-right",
                },
                {
                  key: "status",
                  label: "Recorded result",
                  render: (row) => (
                    <Badge tone={row.excursion ? "warning" : "neutral"}>
                      {row.excursion
                        ? "Outside configured range"
                        : "No recorded excursion"}
                    </Badge>
                  ),
                },
                {
                  key: "source",
                  label: "Evidence",
                  render: (row) => evidenceButton(row.evidence?.sourceId),
                },
              ]}
            />
          </>
        )}
        <div className="ph-panel-foot">
          <span>
            Ledger balances are recorded quantities. Physical stock counts
            remain separate.
          </span>
          <span>{workspace.movements.length} posted movements</span>
        </div>
      </Panel>
    </>
  );

  const deliveries = (
    <Panel
      title="Customer deliveries & trading partners"
      actions={
        <>
          <button
            className="ph-button"
            disabled={!canOperate}
            onClick={() => openForm({ kind: "return" })}
          >
            <ArrowDownLeft size={14} />
            Return
          </button>
          <button
            className="ph-button ph-button-primary"
            disabled={!canOperate}
            onClick={() => openForm({ kind: "dispatch" })}
          >
            <Plus size={14} />
            Dispatch
          </button>
        </>
      }
    >
      <Tabs
        value={deliveriesTab}
        onChange={setDeliveriesTab}
        tabs={[
          { value: "shipments", label: "Dispatches" },
          { value: "partners", label: "Trading partners" },
        ]}
      />
      {deliveriesTab === "shipments" ? (
        <DataTable
          id="shipments"
          rows={[...workspace.shipments].reverse()}
          rowKey={(row) => row.id}
          searchable={(row) =>
            `${row.reference} ${partnerName(row.partnerId)} ${batchById(row.batchId)?.code} ${row.status}`
          }
          onRow={(row) => openBatch(row.batchId)}
          placeholder="Search shipment, recipient or batch…"
          columns={[
            {
              key: "reference",
              label: "Dispatch",
              render: (row) => (
                <>
                  <strong>{row.reference}</strong>
                  <small>{shortDate(row.dispatchedAt)}</small>
                </>
              ),
              value: (row) => row.reference,
            },
            {
              key: "recipient",
              label: "Recipient",
              render: (row) => (
                <>
                  <strong>{partnerName(row.partnerId)}</strong>
                  <small>
                    {
                      workspace.partners.find(
                        (item) => item.id === row.partnerId,
                      )?.kind
                    }
                  </small>
                </>
              ),
              value: (row) => partnerName(row.partnerId),
            },
            {
              key: "batch",
              label: "Batch",
              render: (row) => batchCell(row.batchId),
            },
            {
              key: "quantity",
              label: "Dispatched",
              render: (row) => (
                <NumberValue value={row.quantity} unit={row.unit} />
              ),
              className: "ph-align-right",
              value: (row) => row.quantity,
            },
            {
              key: "returned",
              label: "Returned",
              render: (row) => (
                <NumberValue
                  value={workspace.movements
                    .filter(
                      (item) =>
                        item.kind === "return" && item.shipmentId === row.id,
                    )
                    .reduce((sum, item) => sum + item.quantity, 0)}
                  unit={row.unit}
                />
              ),
              className: "ph-align-right",
            },
            {
              key: "state",
              label: "State",
              render: (row) => (
                <Badge tone={badgeTone(row.status)}>{row.status}</Badge>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <ActionMenu label={`Actions for ${row.reference}`}>
                  <MenuButton onClick={() => openBatch(row.batchId)}>
                    Trace batch
                  </MenuButton>
                  {row.status === "dispatched" && (
                    <MenuButton
                      disabled={!canOperate}
                      onClick={() =>
                        openForm({
                          kind: "delivery-confirm",
                          shipmentId: row.id,
                        })
                      }
                    >
                      Confirm delivery
                    </MenuButton>
                  )}
                  {row.status === "delivered" && (
                    <MenuButton
                      disabled={!canOperate}
                      onClick={() =>
                        openForm({
                          kind: "return",
                          shipmentId: row.id,
                          batchId: row.batchId,
                          locationId: row.locationId,
                        })
                      }
                    >
                      Record return
                    </MenuButton>
                  )}
                  {row.status !== "cancelled" && (
                    <MenuButton
                      disabled={!canOperate}
                      onClick={() =>
                        openForm({
                          kind: "delivery-cancel",
                          shipmentId: row.id,
                        })
                      }
                    >
                      Cancel dispatch
                    </MenuButton>
                  )}
                  {row.evidence && (
                    <MenuButton
                      onClick={() =>
                        setDetail({
                          type: "source",
                          id: row.evidence!.sourceId,
                        })
                      }
                    >
                      Source evidence
                    </MenuButton>
                  )}
                </ActionMenu>
              ),
            },
          ]}
        />
      ) : (
        <>
          <div className="ph-panel-body" style={{ paddingTop: 17 }}>
            <button
              className="ph-button"
              disabled={!canOperate}
              onClick={() => openForm({ kind: "partner" })}
            >
              <Plus size={13} />
              Add partner
            </button>
          </div>
          <DataTable
            id="partners"
            rows={workspace.partners}
            rowKey={(row) => row.id}
            searchable={(row) =>
              `${row.name} ${row.kind} ${row.email} ${row.contact} ${row.id}`
            }
            placeholder="Search partner, type or contact…"
            columns={[
              {
                key: "name",
                label: "Business / site",
                render: (row) => (
                  <>
                    <strong>{row.name}</strong>
                    <small className="ph-mono">{row.id}</small>
                  </>
                ),
                value: (row) => row.name,
              },
              {
                key: "kind",
                label: "Type",
                render: (row) => <Badge>{row.kind}</Badge>,
                value: (row) => row.kind,
              },
              {
                key: "contact",
                label: "Business contact",
                render: (row) => (
                  <>
                    <strong>{row.contact || "—"}</strong>
                    <small>{row.email}</small>
                  </>
                ),
              },
              {
                key: "address",
                label: "Site",
                render: (row) => row.address || "—",
              },
              {
                key: "shelf",
                label: "Shelf-life policy",
                render: (row) =>
                  row.minimumShelfLifeDays
                    ? `${row.minimumShelfLifeDays} days minimum`
                    : "Not configured",
              },
            ]}
          />
        </>
      )}
    </Panel>
  );

  const recalls = (
    <>
      {workspace.recalls.length > 0 ? (
        <>
          <Panel
            title="Recall case"
            actions={
              <button
                className="ph-button ph-button-primary"
                disabled={!canQuality}
                onClick={() => openForm({ kind: "recall" })}
              >
                <Plus size={14} />
                Open case
              </button>
            }
          >
            <div className="ph-panel-body">
              <label className="ph-field">
                <span>Select a case</span>
                <select
                  value={currentRecall?.id || ""}
                  onChange={(event) => setSelectedRecall(event.target.value)}
                >
                  {workspace.recalls.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.reference} · {item.title} · {item.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>
          {currentRecall && summary && (
            <>
              <div className="ph-metrics">
                <Metric
                  label="Historically dispatched"
                  onClick={() => setQuantityDetail({ recallId: currentRecall.id, metric: "shipped" })}
                  value={number(summary.shipped)}
                  unit={summary.unit}
                  text={`${summary.recipients.length} affected recipient sites`}
                  icon={<Truck size={14} />}
                />
                <Metric
                  label="Returned to quarantine"
                  onClick={() => setQuantityDetail({ recallId: currentRecall.id, metric: "returned" })}
                  value={number(summary.returned)}
                  unit={summary.unit}
                  text="Recorded returns; subsequent movements remain separate"
                  icon={<ArrowDownLeft size={14} />}
                />
                <Metric
                  label="Recorded on hand"
                  onClick={() => setQuantityDetail({ recallId: currentRecall.id, metric: "onHand" })}
                  value={number(summary.onHand)}
                  unit={summary.unit}
                  text={`${number(summary.quarantined)} ${summary.unit} quarantined`}
                  icon={<Boxes size={14} />}
                />
                <Metric
                  label="Outstanding accounting"
                  onClick={() => setQuantityDetail({ recallId: currentRecall.id, metric: "outstanding" })}
                  value={number(summary.outstanding)}
                  unit={summary.unit}
                  text={
                    summary.accountingComplete
                      ? "All recorded quantities accounted for"
                      : "Recipient balances to reconcile"
                  }
                  icon={<ClipboardCheck size={14} />}
                />
              </div>
              <div className="ph-two-col">
                <Panel
                  title={currentRecall.title}
                  description={`${currentRecall.reference} · Opened ${shortDate(currentRecall.openedAt)}`}
                  actions={
                    <Badge tone={badgeTone(currentRecall.status)}>
                      {friendly(currentRecall.status)}
                    </Badge>
                  }
                >
                  <div className="ph-panel-body">
                    <dl className="ph-detail-grid">
                      <div className="ph-span-2">
                        <dt>Product scope</dt>
                        <dd>
                          {productLabel(productById(currentRecall.productId))}
                        </dd>
                      </div>
                      <div>
                        <dt>Responsible person</dt>
                        <dd>{currentRecall.owner}</dd>
                      </div>
                      <div className="ph-span-2">
                        <dt>Batch scope</dt>
                        <dd>
                          {currentRecall.batchIds.map((id) => (
                            <button
                              key={id}
                              className="ph-text-button ph-mono"
                              onClick={() => openBatch(id)}
                              style={{ marginRight: 10 }}
                            >
                              {batchById(id)?.code} <ArrowUpRight size={12} />
                            </button>
                          ))}
                        </dd>
                      </div>
                      <div>
                        <dt>Target date</dt>
                        <dd>
                          {currentRecall.dueDate
                            ? shortDate(currentRecall.dueDate)
                            : "Not set"}
                        </dd>
                      </div>
                    </dl>
                    <p className="ph-dense-note">{currentRecall.reason}</p>
                    <div
                      className="ph-quantity-splits"
                      aria-label={`${number(summary.onHand)} on hand, ${number(summary.customerHeld)} held by customers, ${number(summary.outstanding)} outstanding`}
                    >
                      <span
                        className="ph-split-held"
                        style={{ flex: summary.onHand || 0.01 }}
                      />
                      <span
                        className="ph-split-returned"
                        style={{
                          flex:
                            summary.customerHeld +
                              summary.customerDisposed +
                              summary.disposed || 0.01,
                        }}
                      />
                      <span
                        className="ph-split-outstanding"
                        style={{ flex: summary.outstanding || 0.01 }}
                      />
                    </div>
                    <div className="ph-quantity-legend">
                      <span>
                        <i style={{ background: "var(--ph-accent)" }} />
                        Recorded on hand
                      </span>
                      <span>
                        <i style={{ background: "#91af8a" }} />
                        Other evidenced accounting
                      </span>
                      <span>
                        <i style={{ background: "#d4b479" }} />
                        Outstanding
                      </span>
                    </div>
                    {summary.exceptions.length > 0 && (
                      <ul className="ph-issues">
                        {summary.exceptions.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    )}
                    {currentRecall.status === "closed" && (
                      <div className="ph-notice" style={{ margin: "20px 0 0" }}>
                        <CheckCheck size={18} />
                        <div>
                          <strong>
                            Closure recorded{" "}
                            {currentRecall.closedAt &&
                              shortDate(currentRecall.closedAt)}
                          </strong>
                          <p>{currentRecall.closureNote}</p>
                        </div>
                      </div>
                    )}
                    <div className="ph-actions" style={{ marginTop: 22 }}>
                      <button
                        className="ph-button"
                        disabled={!canWrite}
                        onClick={() =>
                          openForm({
                            kind: "report",
                            recallId: currentRecall.id,
                          })
                        }
                      >
                        <FileCheck2 size={14} />
                        Save snapshot
                      </button>
                      {evidenceButton(currentRecall.evidence?.sourceId)}
                      {currentRecall.status !== "closed" && (
                        <>
                          <button
                            className="ph-text-button"
                            disabled={!canQuality}
                            onClick={() =>
                              openForm({
                                kind: "recall-update",
                                recallId: currentRecall.id,
                              })
                            }
                          >
                            Edit case
                          </button>
                          <button
                            className="ph-text-button"
                            disabled={
                              !canQuality || !summary.accountingComplete
                            }
                            onClick={() =>
                              openForm({
                                kind: "recall-close",
                                recallId: currentRecall.id,
                              })
                            }
                          >
                            Record closure
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Panel>
                <Panel
                  title="Case tasks"
                  description="Assignments are separate from quantity accounting."
                  actions={
                    <button
                      className="ph-text-button"
                      disabled={
                        !canQuality || currentRecall.status === "closed"
                      }
                      onClick={() =>
                        openForm({ kind: "task", recallId: currentRecall.id })
                      }
                    >
                      <Plus size={13} />
                      Add
                    </button>
                  }
                >
                  <div className="ph-panel-body">
                    {currentRecall.tasks.length ? (
                      currentRecall.tasks.map((task) => (
                        <div
                          className={`ph-task ${task.done ? "is-done" : ""}`}
                          key={task.id}
                        >
                          <button
                            type="button"
                            aria-label={`${task.done ? "Reopen" : "Complete"} task: ${task.title}`}
                            aria-pressed={task.done}
                            disabled={
                              !canQuality ||
                              busy ||
                              currentRecall.status === "closed"
                            }
                            onClick={() =>
                              void mutate(
                                {
                                  type: "recall.task",
                                  recallId: currentRecall.id,
                                  task: { ...task, done: !task.done },
                                  reason: `${task.done ? "Reopened" : "Completed"} assigned case task: ${task.title}`,
                                },
                                "Task updated.",
                              )
                            }
                          >
                            {task.done && <Check size={13} />}
                          </button>
                          <div>
                            <strong>{task.title}</strong>
                            <small>
                              {task.owner}
                              {task.dueDate
                                ? ` · Due ${shortDate(task.dueDate)}`
                                : ""}
                            </small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="No tasks assigned"
                        description="Add a specific follow-up and an owner."
                      />
                    )}
                  </div>
                  <div className="ph-panel-foot">
                    <span>
                      {currentRecall.tasks.filter((task) => task.done).length}{" "}
                      of {currentRecall.tasks.length} tasks completed
                    </span>
                  </div>
                </Panel>
              </div>
              <Panel
                title="Affected customer destinations"
                description="Returns, current customer balances and other dispositions each have one accounting role."
              >
                <DataTable<RecallRecipient>
                  id={`recipients-${currentRecall.id}`}
                  rows={summary.recipients}
                  rowKey={(row) => `${row.partnerId}-${row.batchId}`}
                  searchable={(row) => `${row.partnerName} ${row.batchCode}`}
                  columns={[
                    {
                      key: "partner",
                      label: "Recipient",
                      render: (row) => (
                        <>
                          <strong>{row.partnerName}</strong>
                          <small>{row.batchCode}</small>
                        </>
                      ),
                      value: (row) => row.partnerName,
                    },
                    {
                      key: "shipped",
                      label: "Shipped",
                      render: (row) => (
                        <NumberValue value={row.shipped} unit={row.unit} />
                      ),
                      className: "ph-align-right",
                    },
                    {
                      key: "returned",
                      label: "Returned",
                      render: (row) => (
                        <NumberValue value={row.returned} unit={row.unit} />
                      ),
                      className: "ph-align-right",
                    },
                    {
                      key: "held",
                      label: "Customer held",
                      render: (row) => (
                        <NumberValue value={row.customerHeld} unit={row.unit} />
                      ),
                      className: "ph-align-right",
                    },
                    {
                      key: "outstanding",
                      label: "Outstanding",
                      render: (row) => (
                        <NumberValue value={row.outstanding} unit={row.unit} />
                      ),
                      className: "ph-align-right",
                    },
                    {
                      key: "response",
                      label: "Response",
                      render: (row) => (
                        <Badge tone={row.acknowledged ? "good" : "neutral"}>
                          {row.acknowledged
                            ? "Acknowledged"
                            : "No response recorded"}
                        </Badge>
                      ),
                    },
                    {
                      key: "actions",
                      label: "",
                      render: (row) => (
                        <ActionMenu label={`Actions for ${row.partnerName}`}>
                          <MenuButton
                            onClick={() =>
                              setDetail({
                                type: "notice",
                                id: currentRecall.id,
                                partnerId: row.partnerId,
                                batchId: row.batchId,
                              })
                            }
                          >
                            Prepare notice draft
                          </MenuButton>
                          <MenuButton
                            disabled={
                              !canQuality || currentRecall.status === "closed"
                            }
                            onClick={() =>
                              openForm({
                                kind: "acknowledge",
                                recallId: currentRecall.id,
                                partnerId: row.partnerId,
                                batchId: row.batchId,
                              })
                            }
                          >
                            Record response
                          </MenuButton>
                          <MenuButton
                            disabled={
                              !canOperate || currentRecall.status === "closed"
                            }
                            onClick={() =>
                              openForm({
                                kind: "return",
                                shipmentId: row.shipmentIds[0],
                                batchId: row.batchId,
                              })
                            }
                          >
                            Record return
                          </MenuButton>
                        </ActionMenu>
                      ),
                    },
                  ]}
                />
                <div className="ph-panel-foot">
                  <span>
                    Accounting completion records quantities. It does not
                    establish medical safety or regulatory closure.
                  </span>
                </div>
              </Panel>
            </>
          )}
        </>
      ) : (
        <Panel>
          <Empty
            title="Open a recall with a specific scope"
            description="Select the affected product and batch, record the initiating evidence, and track its destinations."
            action={
              <button
                className="ph-button ph-button-primary"
                disabled={!canQuality}
                onClick={() => openForm({ kind: "recall" })}
              >
                <Plus size={14} />
                Open recall case
              </button>
            }
          />
        </Panel>
      )}
    </>
  );

  const documents = (
    <>
      <div className="ph-notice">
        <WandSparkles size={20} />
        <div>
          <strong>Guided examples work without an API key</strong>
          <p>
            Pre-filled records let anyone inspect the source, review proposed
            fields and post the result. AI extraction is an optional separate
            mode, clearly identified when used.
          </p>
        </div>
        <button
          className="ph-button"
          disabled={!canWrite}
          onClick={() => setIntake(true)}
        >
          Try a document <ArrowRight size={14} />
        </button>
      </div>
      <Panel
        title="Source library"
        description="Original text, linked records and extraction origin stay inspectable."
        actions={
          <button
            className="ph-button ph-button-primary"
            disabled={!canWrite}
            onClick={() => setIntake(true)}
          >
            <Upload size={14} />
            Import document
          </button>
        }
      >
        <DataTable<SourceDocument>
          id="sources"
          rows={workspace.sources
            .filter(
              (source) =>
                sourceFilter === "all" ||
                (sourceFilter === "archived"
                  ? source.archived
                  : !source.archived),
            )
            .reverse()}
          rowKey={(row) => row.id}
          searchable={(row) =>
            `${row.name} ${row.kind} ${row.text} ${row.mode}`
          }
          onRow={(row) => setDetail({ type: "source", id: row.id })}
          placeholder="Search documents and source text…"
          filter={
            <select
              className="ph-table-filter"
              aria-label="Document state filter"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option value="active">Current documents</option>
              <option value="archived">Archived evidence</option>
              <option value="all">All documents</option>
            </select>
          }
          columns={[
            {
              key: "name",
              label: "Document",
              render: (row) => (
                <>
                  <strong>{row.name}</strong>
                  <small>
                    {row.kind}
                    {row.archived ? " · Archived evidence" : ""}
                  </small>
                </>
              ),
              value: (row) => row.name,
            },
            {
              key: "origin",
              label: "Origin",
              render: (row) => (
                <Badge tone={row.mode === "ai" ? "accent" : "neutral"}>
                  {row.mode === "sample"
                    ? "Sample record"
                    : row.mode === "template"
                      ? "Guided example"
                      : row.mode === "ai"
                        ? "AI-assisted"
                        : "Structured / manual"}
                </Badge>
              ),
            },
            {
              key: "linked",
              label: "Linked movements",
              render: (row) =>
                workspace.movements.filter(
                  (item) => item.evidence?.sourceId === row.id,
                ).length,
              className: "ph-align-right",
            },
            {
              key: "created",
              label: "Added",
              render: (row) => shortDate(row.createdAt),
              value: (row) => row.createdAt,
            },
            {
              key: "integrity",
              label: "Content identity",
              render: (row) =>
                row.hash ? (
                  <span className="ph-mono" title={row.hash}>
                    {row.hash.slice(0, 12)}…
                  </span>
                ) : (
                  "Not fingerprinted"
                ),
            },
            {
              key: "action",
              label: "",
              render: (row) => (
                <button
                  className="ph-text-button"
                  onClick={() => setDetail({ type: "source", id: row.id })}
                >
                  Inspect <ArrowUpRight size={13} />
                </button>
              ),
            },
          ]}
        />
        <div className="ph-panel-foot">
          <span>
            Hashes identify file contents; they do not establish whether a
            document is true.
          </span>
          <span>{workspace.sources.length} sources</span>
        </div>
      </Panel>
    </>
  );

  const reports = (
    <Panel
      title="Snapshots & decision history"
      actions={
        <>
          <a className="ph-button" href={reportUrl("csv")}>
            <Download size={14} />
            Ledger CSV
          </a>
          <button
            className="ph-button ph-button-primary"
            disabled={!canWrite || !workspace.recalls.length}
            onClick={() =>
              openForm({ kind: "report", recallId: currentRecall?.id })
            }
          >
            <Plus size={14} />
            Save snapshot
          </button>
        </>
      }
    >
      <Tabs
        value={reportTab}
        onChange={setReportTab}
        tabs={[
          { value: "snapshots", label: "Case snapshots" },
          { value: "comparison", label: "Compare snapshots" },
          { value: "audit", label: "Audit history" },
        ]}
      />
      {reportTab === "snapshots" &&
        (workspace.reports.length ? (
          [...workspace.reports].reverse().map((report) => (
            <article key={report.id} className="ph-report-card">
              <div>
                <h3>
                  <button
                    className="ph-row-button"
                    onClick={() => setDetail({ type: "report", id: report.id })}
                  >
                    {report.title}
                  </button>
                </h3>
                <p>
                  {shortDate(report.createdAt)} · {report.actor} · Revision{" "}
                  {report.revision}
                  <br />
                  Reference date {shortDate(report.asOf)} ·{" "}
                  {report.summary.unit}
                </p>
                <div className="ph-report-numbers">
                  <div>
                    <strong>{number(report.summary.shipped)}</strong>
                    <span>Historically dispatched</span>
                  </div>
                  <div>
                    <strong>{number(report.summary.returned)}</strong>
                    <span>Returned</span>
                  </div>
                  <div>
                    <strong>{number(report.summary.outstanding)}</strong>
                    <span>Outstanding</span>
                  </div>
                </div>
              </div>
              <div className="ph-actions">
                <a href={reportUrl("pdf", report.id)} className="ph-button">
                  <Download size={13} />
                  PDF
                </a>
                <a
                  href={reportUrl("evidence", report.id)}
                  className="ph-button"
                >
                  Evidence ZIP
                </a>
                <ActionMenu label={`More exports for ${report.title}`}>
                  <a className="ph-button" href={reportUrl("json", report.id)}>
                    Snapshot JSON
                  </a>
                  <a className="ph-button" href={reportUrl("csv", report.id)}>
                    Movement CSV
                  </a>
                </ActionMenu>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="Save a fixed point in the case"
            description="A snapshot captures the current accounting, evidence and audit history. Future changes leave that report intact."
          />
        ))}
      {reportTab === "comparison" && (
        <div className="ph-panel-body" style={{ paddingTop: 23 }}>
          <div className="ph-form-grid">
            <label className="ph-field">
              <span>Earlier snapshot</span>
              <select
                value={compareA}
                onChange={(event) => setCompareA(event.target.value)}
              >
                <option value="">Choose a snapshot</option>
                {workspace.reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title} · revision {report.revision}
                  </option>
                ))}
              </select>
            </label>
            <label className="ph-field">
              <span>Later snapshot</span>
              <select
                value={compareB}
                onChange={(event) => setCompareB(event.target.value)}
              >
                <option value="">Choose a snapshot</option>
                {workspace.reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title} · revision {report.revision}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ReportComparison
            a={workspace.reports.find((report) => report.id === compareA)}
            b={workspace.reports.find((report) => report.id === compareB)}
          />
        </div>
      )}
      {reportTab === "audit" && (
        <DataTable
          id="audit"
          rows={[...workspace.audit].reverse()}
          rowKey={(row) => row.id}
          searchable={(row) =>
            `${row.action} ${row.actor} ${row.reason} ${row.entity}`
          }
          onRow={(row) => setDetail({ type: "audit", id: row.id })}
          placeholder="Search decision, actor or reason…"
          columns={[
            {
              key: "action",
              label: "Decision",
              render: (row) => (
                <>
                  <strong>{friendly(row.action)}</strong>
                  <small className="ph-mono">{row.entity}</small>
                </>
              ),
            },
            {
              key: "actor",
              label: "Recorded by",
              render: (row) => (
                <>
                  <strong>{row.actor}</strong>
                  <small>{row.role}</small>
                </>
              ),
            },
            {
              key: "reason",
              label: "Reason",
              className: "ph-audit-reason",
              render: (row) => (
                <span style={{ display: "block", maxWidth: 370 }}>
                  {row.reason}
                </span>
              ),
            },
            {
              key: "at",
              label: "Time",
              className: "ph-time-cell",
              render: (row) => (
                <>
                  <strong>{shortDate(row.at)}</strong>
                  <small>{new Date(row.at).toLocaleTimeString()}</small>
                </>
              ),
              value: (row) => row.at,
            },
            {
              key: "details",
              label: "",
              render: (row) => (
                <button
                  className="ph-text-button"
                  onClick={() => setDetail({ type: "audit", id: row.id })}
                >
                  Inspect
                </button>
              ),
            },
          ]}
        />
      )}
    </Panel>
  );

  const settings = (
    <>
      <Panel
        title="Appearance & personalisation"
        description="Preferences are saved on this device."
      >
        <SettingRow
          title="Appearance"
          description="Every workspace view follows your chosen theme."
        >
          <div className="ph-segmented">
            {(["light", "dark", "system"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={preferences.theme === value}
                onClick={() =>
                  setPreferences((old) => ({ ...old, theme: value }))
                }
              >
                {value === "light" ? (
                  <Sun size={14} />
                ) : value === "dark" ? (
                  <Moon size={14} />
                ) : (
                  <Settings2 size={14} />
                )}
                {value === "dark"
                  ? "Night"
                  : value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          title="Table density"
          description="Choose a little more breathing room or more rows at a glance."
        >
          <div className="ph-segmented">
            {(["comfortable", "compact"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={preferences.density === value}
                onClick={() =>
                  setPreferences((old) => ({ ...old, density: value }))
                }
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          title="Display name"
          description="Used for the personal workspace label on this device. Server audit identity comes from your access session."
        >
          <input
            aria-label="Display name"
            value={preferences.displayName}
            maxLength={48}
            onChange={(event) =>
              setPreferences((old) => ({
                ...old,
                displayName: event.target.value,
              }))
            }
          />
        </SettingRow>
        <SettingRow
          title="Near-expiry window"
          description={`Expiry calculations use ${shortDate(workspace.asOf)} as the workspace reference date.`}
        >
          <label className="ph-inline-actions">
            <input
              aria-label="Near-expiry window in days"
              type="number"
              min={1}
              max={3650}
              value={nearDays}
              style={{ width: 90 }}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value > 0 && value <= 3650) {
                  setNearDays(value);
                  localStorage.setItem(
                    "recallscope.pharma.nearDays",
                    String(value),
                  );
                }
              }}
            />{" "}
            days
          </label>
        </SettingRow>
        <SettingRow
          title="Reference date"
          description="A visible, controlled date makes example expiry scenarios reproducible."
        >
          <button
            className="ph-button"
            disabled={!canAdmin}
            onClick={() => openForm({ kind: "clock" })}
          >
            <CalendarDays size={14} />
            {shortDate(workspace.asOf)}
          </button>
        </SettingRow>
      </Panel>
      <Panel
        title="Team & account access"
        description="Recoverable accounts and server-enforced workspace roles."
        actions={<Badge tone="accent">{access.role}</Badge>}
      >
        <div className="ph-panel-body">
          <div className="ph-notice">
            <LockKeyhole size={19} />
            <div>
              <strong>
                {access.signedIn
                  ? `Signed in as ${access.displayName}`
                  : "You are using a browser workspace"}
              </strong>
              <p>
                {access.signedIn
                  ? access.secured
                    ? "This workspace is connected to an account. Access is checked on the server for every operation."
                    : "Connect this workspace to your account to recover it later and manage a team."
                  : "Sign in to connect a workspace to your account and invite team members. Guided examples remain available without signing in."}
              </p>
            </div>
            {access.signedIn && !access.secured && canAdmin ? (
              <button
                className="ph-button"
                disabled={busy}
                onClick={() => void teamAction({ type: "claim" })}
              >
                Connect workspace
              </button>
            ) : !access.signedIn ? (
              <a
                className="ph-button"
                href={access.signInPath || "/signin-with-chatgpt?return_to=%2F"}
              >
                <LogIn size={14} />
                Sign in
              </a>
            ) : (
              <Badge tone="good">Account connected</Badge>
            )}
          </div>
          {teamError && (
            <div className="ph-error" role="alert">
              {teamError}
            </div>
          )}
          {team?.members.length ? (
            <div className="ph-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {team.members.map((member) => (
                    <tr key={member.userId}>
                      <td>
                        <strong>{member.name}</strong>
                        <small>{member.email}</small>
                      </td>
                      <td>
                        <select
                          aria-label={`Role for ${member.name}`}
                          disabled={
                            !canAdmin ||
                            busy ||
                            Boolean(
                              access.owner && member.userId === access.userId,
                            )
                          }
                          value={member.role}
                          onChange={(event) =>
                            void teamAction({
                              type: "role",
                              userId: member.userId,
                              role: event.target.value,
                            })
                          }
                        >
                          {["viewer", "operations", "quality", "admin"].map(
                            (role) => (
                              <option value={role} key={role}>
                                {role}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td>
                        <button
                          className="ph-text-button"
                          disabled={
                            !canAdmin ||
                            busy ||
                            Boolean(
                              access.owner && member.userId === access.userId,
                            )
                          }
                          onClick={() =>
                            void teamAction({
                              type: "revoke",
                              userId: member.userId,
                            })
                          }
                        >
                          Remove access
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ph-dense-note">
              No account members are connected to this workspace.
            </p>
          )}
          {access.signedIn && access.secured && canAdmin && (
            <form
              style={{ marginTop: 22 }}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void teamAction({
                  type: "invite",
                  email: String(data.get("email")),
                  role: String(data.get("role")),
                });
              }}
            >
              <div className="ph-form-grid">
                <label className="ph-field">
                  <span>Invite email</span>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="colleague@company.com"
                  />
                </label>
                <label className="ph-field">
                  <span>Role</span>
                  <select name="role" defaultValue="viewer">
                    {["viewer", "operations", "quality", "admin"].map(
                      (role) => (
                        <option value={role} key={role}>
                          {role}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <button
                style={{ marginTop: 13 }}
                className="ph-button"
                disabled={busy}
                type="submit"
              >
                <Link2 size={14} />
                Create invitation link
              </button>
              <p className="ph-dense-note" style={{ marginTop: 8 }}>
                You choose how to share the link. RecallScope does not send an
                email.
              </p>
            </form>
          )}
          {inviteUrl && (
            <div className="ph-notice" style={{ marginTop: 18 }}>
              <Link2 size={17} />
              <div>
                <strong>Invitation link</strong>
                <p style={{ overflowWrap: "anywhere" }}>{inviteUrl}</p>
                <button
                  className="ph-text-button"
                  onClick={() =>
                    navigator.clipboard.writeText(inviteUrl).then(
                      () => setToast("Invitation link copied."),
                      () =>
                        setTeamError(
                          "Clipboard access is unavailable. Select and copy the invitation link.",
                        ),
                    )
                  }
                >
                  Copy link
                </button>
              </div>
            </div>
          )}
          {team?.invitations.map((invite) => (
            <div className="ph-stat-line" key={invite.email}>
              <span>
                {invite.email} · {invite.role} · expires{" "}
                {shortDate(invite.expiresAt)}
              </span>
              <button
                className="ph-text-button"
                disabled={!canAdmin || busy}
                onClick={() =>
                  void teamAction({
                    type: "cancel-invite",
                    email: invite.email,
                  })
                }
              >
                Cancel invitation
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Document intelligence"
        description="A useful workflow with or without a model."
      >
        <SettingRow
          title="Guided examples & CSV"
          description="Pre-filled examples and deterministic CSV mapping work without a provider key."
        >
          <Badge tone="good">Available</Badge>
        </SettingRow>
        <SettingRow
          title="Optional live extraction"
          description={
            payload.ai.available
              ? `${payload.ai.provider || "Provider"}${payload.ai.model ? ` · ${payload.ai.model}` : ""}. Keys are held on the server.`
              : "Configure Fireworks or OpenAI server-side to enable live document extraction. No shared API key is required for the guided workflow."
          }
        >
          <Badge tone={payload.ai.available ? "good" : "neutral"}>
            {payload.ai.available ? "Configured" : "Optional"}
          </Badge>
        </SettingRow>
        <SettingRow
          title="Source review"
          description="Extracted or structured records are proposals until explicitly approved. Original source text and correction decisions remain inspectable."
        >
          <button
            className="ph-button"
            disabled={!canWrite}
            onClick={() => setIntake(true)}
          >
            Open intake <ArrowRight size={13} />
          </button>
        </SettingRow>
      </Panel>
      <RetentionPanel access={{ ...access, secured: !!access.secured }} onUpdate={next => setPayload(old => old ? { ...old, workspace: next } : old)} />
      <PharmaConnections
        workspace={workspace}
        onUpdate={(next) =>
          setPayload((old) => (old ? { ...old, workspace: next } : old))
        }
        readOnly={!canOperate}
      />
      <Panel
        title="Workspace data"
        description="Export a backup before switching scenarios or restoring data."
      >
        <SettingRow
          title="Workspace name"
          description="Shown to everyone with access to this workspace."
        >
          <form
            className="ph-inline-actions"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void mutate(
                { type: "workspace.rename", name: String(data.get("name")) },
                "Workspace renamed.",
              );
            }}
          >
            <input
              name="name"
              aria-label="Workspace name"
              key={workspace.name}
              defaultValue={workspace.name}
              required
              maxLength={80}
              disabled={!canAdmin}
              style={{ maxWidth: 210 }}
            />
            <button
              type="submit"
              className="ph-button"
              disabled={!canAdmin || busy}
            >
              Save
            </button>
          </form>
        </SettingRow>
        <SettingRow
          title="Backup & restore"
          description="Download versioned workspace JSON with its record history. Restoration validates identities and balances before replacing records."
        >
          <div className="ph-actions">
            <a className="ph-button" href={reportUrl("json")}>
              <Download size={14} />
              Backup JSON
            </a>
            <button
              className="ph-button"
              disabled={!canAdmin}
              onClick={() => restoreInput.current?.click()}
            >
              <Upload size={14} />
              Restore backup
            </button>
            <input
              ref={restoreInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 12_000_000)
                    throw Error("Choose a backup smaller than 12 MB.");
                  setRestore({
                    name: file.name,
                    backup: JSON.parse(await file.text()),
                  });
                  setRestoreReason("");
                  setFormError("");
                } catch (err) {
                  setToast(
                    err instanceof Error
                      ? err.message
                      : "The backup could not be read.",
                  );
                }
                event.target.value = "";
              }}
            />
          </div>
        </SettingRow>
        <SettingRow
          title="Explore the example scenarios"
          description="All organisations and transactions in the examples are fictional. Switching replaces the current workspace records after confirmation."
        >
          <div className="ph-actions">
            <button
              className="ph-button"
              disabled={!canAdmin}
              onClick={() => {
                setResetScenario("complete");
                setFormError("");
              }}
            >
              Complete recall
            </button>
            <button
              className="ph-button"
              disabled={!canAdmin}
              onClick={() => {
                setResetScenario("active");
                setFormError("");
              }}
            >
              Active recall
            </button>
          </div>
        </SettingRow>
      </Panel>
    </>
  );

  const content: Record<View, ReactNode> = {
    overview,
    products,
    stock,
    deliveries,
    recalls,
    documents,
    reports,
    settings,
  };
  const formConfig = form ? formDefinition(form, workspace) : null;
  const searchResults = search.trim()
    ? [
        ...workspace.products
          .filter((product) =>
            `${product.name} ${product.sku} ${product.gtin || ""} ${product.strength}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .slice(0, 6)
          .map((product) => ({
            key: product.id,
            title: productLabel(product),
            subtitle: `Product · ${product.sku}`,
            run: () => setDetail({ type: "product", id: product.id }),
            icon: Package,
          })),
        ...workspace.batches
          .filter((batch) =>
            `${batch.code} ${batch.originalCode} ${batch.serials?.join(" ") || ""} ${productById(batch.productId)?.name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .slice(0, 6)
          .map((batch) => ({
            key: batch.id,
            title: batch.code,
            subtitle: `Batch · ${productById(batch.productId)?.name}`,
            run: () => openBatch(batch.id),
            icon: Boxes,
          })),
        ...workspace.sources
          .filter((source) =>
            `${source.name} ${source.text}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .slice(0, 4)
          .map((source) => ({
            key: source.id,
            title: source.name,
            subtitle: "Source document",
            run: () => setDetail({ type: "source", id: source.id }),
            icon: FileText,
          })),
        ...workspace.recalls
          .filter((recall) =>
            `${recall.reference} ${recall.title}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((recall) => ({
            key: recall.id,
            title: recall.reference,
            subtitle: recall.title,
            run: () => {
              setSelectedRecall(recall.id);
              navigate("recalls");
            },
            icon: ShieldCheck,
          })),
      ]
    : navigation.map((item) => ({
        key: item.id,
        title: item.label,
        subtitle: descriptions[item.id].text,
        run: () => navigate(item.id),
        icon: item.icon,
      }));

  return (
    <div className="ph-app">
      <a href="#ph-main" className="skip-link">
        Skip to workspace
      </a>
      <aside className="ph-sidebar">
        <a
          className="ph-logo"
          href="#overview"
          onClick={(event) => {
            event.preventDefault();
            navigate("overview");
          }}
        >
          <span className="ph-logo-mark">
            <ScanLine size={22} strokeWidth={1.6} />
          </span>
          <span>RecallScope</span>
        </a>
        <div className="ph-workspace-label">
          <strong>{workspace.name}</strong>
          <small>Pharmaceutical distribution</small>
        </div>
        <div className="ph-nav-label">Workspace</div>
        <nav className="ph-nav" aria-label="Workspace navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              title={item.label}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={17} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === "recalls" && activeRecalls.length > 0 && (
                <em>{activeRecalls.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="ph-side-bottom">
          <p className="ph-side-note">
            Know where every affected batch went. Account for what comes back.
          </p>
          <div className="ph-side-profile">
            <span className="ph-avatar">
              {(preferences.displayName || access.displayName || "RC")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div>
              <strong>{preferences.displayName || access.displayName}</strong>
              <small>{access.role} workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="ph-main" id="ph-main">
        <header className="ph-topbar">
          <div className="ph-breadcrumb">
            <span>RecallScope</span>
            <ChevronRight size={12} />
            <strong>
              {navigation.find((item) => item.id === view)?.label}
            </strong>
          </div>
          <div className="ph-topbar-actions">
            <button
              className="ph-global-search"
              onClick={() => {
                setSearch("");
                setSearchOpen(true);
              }}
              aria-label="Search workspace"
            >
              <Search size={16} />
              <span>Search workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="ph-icon-button"
              aria-label="Toggle night mode"
              title="Toggle night mode"
              onClick={() =>
                setPreferences((old) => ({
                  ...old,
                  theme:
                    document.documentElement.dataset.theme === "dark"
                      ? "light"
                      : "dark",
                }))
              }
            >
              {preferences.theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
            <button
              className="ph-icon-button"
              title="Refresh workspace"
              aria-label="Refresh workspace"
              disabled={busy}
              onClick={() =>
                void reload().then(
                  (data) => data && setToast("Workspace refreshed."),
                )
              }
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <div className="ph-content">
          <div className="ph-context-strip">
            <div>
              <span className="ph-live-dot" />
              <span>Saved workspace · Revision {workspace.revision}</span>
              {workspace.synthetic && <Badge>Sample records</Badge>}
            </div>
            <div>
              <CalendarDays size={12} />
              <span>Reference date {shortDate(workspace.asOf)}</span>
            </div>
          </div>
          <div className="ph-heading">
            <div>
              <span className="ph-eyebrow">{descriptions[view].eyebrow}</span>
              <h1 ref={mainHeading} tabIndex={-1}>
                {descriptions[view].title}
              </h1>
              <p>{descriptions[view].text}</p>
            </div>
            {view === "overview" && (
              <div className="ph-heading-actions">
                <button
                  className="ph-button"
                  onClick={() => setSearchOpen(true)}
                >
                  <ScanLine size={15} />
                  Find a batch
                </button>
                <button
                  className="ph-button ph-button-primary"
                  disabled={!canWrite}
                  onClick={() => setIntake(true)}
                >
                  <Plus size={15} />
                  Import document
                </button>
              </div>
            )}
          </div>
          {loadError && (
            <div className="ph-error" role="alert">
              {loadError}{" "}
              <button className="ph-text-button" onClick={() => void reload()}>
                Retry
              </button>
            </div>
          )}
          {invitationToken && (
            <div className="ph-notice">
              <Users size={19} />
              <div>
                <strong>You have a workspace invitation</strong>
                <p>
                  {access.signedIn
                    ? "Accept to join the workspace linked to this invitation. The server checks that your signed-in email matches the invitation."
                    : "Sign in with the invited email address to accept this workspace invitation."}
                </p>
                {teamError && <p role="alert">{teamError}</p>}
              </div>
              {access.signedIn ? (
                <button
                  className="ph-button"
                  disabled={busy}
                  onClick={() =>
                    void teamAction({ type: "accept", token: invitationToken })
                  }
                >
                  Accept invitation
                </button>
              ) : (
                <a
                  className="ph-button"
                  href={`/signin-with-chatgpt?return_to=${encodeURIComponent(`/?invite=${invitationToken}`)}`}
                >
                  Sign in to join
                </a>
              )}
            </div>
          )}
          {formError && !form && !resetScenario && !restore && (
            <div className="ph-error" role="alert">
              {formError}
              <button
                className="ph-icon-button"
                aria-label="Dismiss error"
                onClick={() => setFormError("")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {content[view]}
          <footer className="ph-footer">
            <span>RecallScope · Pharmaceutical distribution</span>
            <span>
              {workspace.synthetic
                ? "Fictional organisations and transactions · "
                : ""}
              Recorded evidence, connected decisions.
            </span>
          </footer>
        </div>
      </main>
      {form && formConfig && (
        <Dialog
          title={formConfig.title}
          eyebrow="Record an operation"
          busy={busy}
          wide={form.kind === "product" || form.kind === "product-edit"}
          onClose={() => setForm(null)}
        >
          <ActionForm
            fields={formConfig.fields}
            notice={formConfig.notice}
            busy={busy}
            error={formError}
            submit={formConfig.submit}
            onCancel={() => setForm(null)}
            onSubmit={async (values) => {
              try {
                const action = formConfig.action(values);
                if (await mutate(action, `${formConfig.title}: saved.`))
                  setForm(null);
              } catch (err) {
                setFormError(
                  err instanceof Error
                    ? err.message
                    : "Review the entered values.",
                );
              }
            }}
          />
        </Dialog>
      )}
      {quantityDetail && <QuantityDetail workspace={workspace} {...quantityDetail} onClose={() => setQuantityDetail(null)} onMovement={id => { setQuantityDetail(null); setDetail({ type: "movement", id }); }} onBatch={id => { setQuantityDetail(null); openBatch(id); }} />}
      {intake && (
        <IntakePanel
          workspace={workspace}
          templates={payload.templates || []}
          ai={payload.ai || { available: false }}
          canWrite={canWrite}
          onUpdated={(next) => {
            setPayload((old) => (old ? { ...old, workspace: next } : old));
            setToast("Reviewed source records saved.");
          }}
          onClose={() => setIntake(false)}
        />
      )}
      {detail && (
        <DetailDialog
          detail={detail}
          workspace={workspace}
          canOperate={canOperate}
          canAdmin={canAdmin}
          canQuality={canQuality}
          onClose={() => setDetail(null)}
          onDetail={setDetail}
          onForm={openForm}
          onToast={setToast}
        />
      )}
      {searchOpen && (
        <Dialog
          title="Find your next record"
          eyebrow="Workspace search · SKU, batch, GTIN or serial"
          onClose={() => setSearchOpen(false)}
        >
          <div className="ph-dialog-body" style={{ paddingBottom: 12 }}>
            <label
              className="ph-search"
              style={{ maxWidth: "none", height: 44 }}
            >
              <Search size={18} />
              <input
                data-autofocus
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search or scan an identifier…"
                aria-label="Search all workspace records"
              />
            </label>
          </div>
          <div className="ph-command-list">
            {searchResults.length ? (
              searchResults.slice(0, 16).map((result) => (
                <button
                  key={result.key}
                  onClick={() => {
                    setSearchOpen(false);
                    result.run();
                  }}
                >
                  <result.icon size={18} />
                  <span>
                    <strong>{result.title}</strong>
                    <small>{result.subtitle}</small>
                  </span>
                  <ArrowUpRight size={13} style={{ marginLeft: "auto" }} />
                </button>
              ))
            ) : (
              <Empty
                title="No matching record"
                description="Try the product SKU or the printed batch code. Identical batch codes can belong to different products."
              />
            )}
          </div>
          <div className="ph-dialog-footer">
            <span className="ph-dense-note">
              Search preserves product identity. Identifier matching does not
              authenticate a medicine.
            </span>
          </div>
        </Dialog>
      )}
      {resetScenario && (
        <Dialog
          title="Switch example scenario"
          eyebrow="Workspace data"
          busy={busy}
          onClose={() => setResetScenario(null)}
        >
          <div className="ph-dialog-body">
            <p className="ph-dense-note">
              Load the{" "}
              {resetScenario === "complete"
                ? "completed recall"
                : "active partial-return recall"}{" "}
              example. This replaces the current workspace records. Download a
              backup first if you want to preserve changes.
            </p>
            <div className="ph-actions" style={{ marginTop: 16 }}>
              <a className="ph-button" href={reportUrl("json")}>
                <Download size={14} />
                Download backup
              </a>
            </div>
            {formError && (
              <p className="ph-error" role="alert">
                {formError}
              </p>
            )}
          </div>
          <div className="ph-dialog-footer">
            <button
              className="ph-button"
              disabled={busy}
              onClick={() => setResetScenario(null)}
            >
              Cancel
            </button>
            <button
              className="ph-button ph-button-primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    {
                      type: "workspace.reset",
                      scenario: resetScenario,
                      confirm: "RESET",
                    },
                    "Example scenario loaded.",
                  )
                ) {
                  setResetScenario(null);
                  setSelectedRecall("");
                }
              }}
            >
              Replace with example
            </button>
          </div>
        </Dialog>
      )}
      {restore && (
        <Dialog
          title="Restore workspace backup"
          eyebrow="Versioned data recovery"
          busy={busy}
          onClose={() => setRestore(null)}
        >
          <div className="ph-dialog-body">
            <p className="ph-dense-note">
              Restore <strong>{restore.name}</strong>. The server validates the
              full ledger before replacing workspace data. Export your current
              workspace if you want to keep its changes.
            </p>
            <label className="ph-field" style={{ marginTop: 20 }}>
              <span>Restoration reason</span>
              <textarea
                required
                value={restoreReason}
                onChange={(event) => setRestoreReason(event.target.value)}
                placeholder="Describe why this backup is being restored."
              />
            </label>
            {formError && (
              <p className="ph-error" role="alert">
                {formError}
              </p>
            )}
          </div>
          <div className="ph-dialog-footer">
            <a className="ph-button" href={reportUrl("json")}>
              Current backup
            </a>
            <button
              className="ph-button"
              disabled={busy}
              onClick={() => setRestore(null)}
            >
              Cancel
            </button>
            <button
              className="ph-button ph-button-primary"
              disabled={busy || restoreReason.trim().length < 12}
              onClick={async () => {
                if (
                  await mutate(
                    {
                      type: "workspace.restore",
                      backup: restore.backup,
                      reason: restoreReason,
                    },
                    "Workspace backup restored.",
                  )
                )
                  setRestore(null);
              }}
            >
              Validate & restore
            </button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="ph-toast" role="status">
          <Check size={15} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  text,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  text: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>
        {icon}
        {label}
      </span>
      <strong>
        {value}
        {unit && <small> {unit}</small>}
      </strong>
      <p>{text}</p>
    </>
  );
  return onClick ? (
    <button
      className="ph-metric"
      type="button"
      onClick={onClick}
      style={{ borderTop: 0, borderBottom: 0, borderLeft: 0 }}
    >
      {content}
    </button>
  ) : (
    <div className="ph-metric">{content}</div>
  );
}
function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: { value: string; label: string }[];
}) {
  return (
    <div className="ph-tab-row" role="tablist">
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              const next =
                (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                tabs.length;
              onChange(tabs[next].value);
              (
                event.currentTarget.parentElement?.children[
                  next
                ] as HTMLButtonElement
              )?.focus();
            }
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
function ActionItem({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: () => void;
}) {
  return (
    <button
      type="button"
      className="ph-list-item ph-action-list-item"
      onClick={action}
    >
      <span className="ph-list-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}
function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    const close = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape")
        return;
      if (
        event.type !== "mousedown" ||
        !details.current?.contains(event.target as Node)
      ) {
        if (details.current) details.current.open = false;
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
    };
  }, []);
  return (
    <div className="ph-top-action-menu">
      <details
        ref={details}
        onToggle={(event) => {
          if (!event.currentTarget.open) return;
          const rect = event.currentTarget
            .querySelector("summary")
            ?.getBoundingClientRect();
          if (!rect) return;
          const height = menu.current?.scrollHeight || 220;
          setPosition({
            left: Math.max(
              10,
              Math.min(window.innerWidth - 230, rect.right - 220),
            ),
            top:
              rect.bottom + height + 12 < window.innerHeight
                ? rect.bottom + 6
                : Math.max(10, rect.top - height - 6),
          });
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            event.currentTarget.open = false;
        }}
      >
        <summary className="ph-button" aria-label={label} title={label}>
          <MoreHorizontal size={17} />
        </summary>
        <div
          ref={menu}
          className="ph-menu"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            right: "auto",
            width: 220,
            maxHeight: "calc(100vh - 20px)",
            overflowY: "auto",
          }}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button,a"))
              event.currentTarget.closest("details")?.removeAttribute("open");
          }}
        >
          {children}
        </div>
      </details>
    </div>
  );
}
function MenuButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="ph-setting-row">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

function Allocation({
  workspace,
  canOperate,
  onDispatch,
}: {
  workspace: PharmaWorkspace;
  canOperate: boolean;
  onDispatch: (batchId: string, locationId: string) => void;
}) {
  const [productId, setProductId] = useState(
      workspace.products.find((item) => !item.archived)?.id || "",
    ),
    [locationId, setLocationId] = useState(workspace.locations[0]?.id || "");
  const rows =
    productId && locationId
      ? fefoCandidates(workspace, productId, locationId)
      : [];
  return (
    <div className="ph-panel-body" style={{ paddingTop: 23 }}>
      <div className="ph-form-grid">
        <label className="ph-field">
          <span>Product</span>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            {workspace.products
              .filter((item) => !item.archived)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {productLabel(item)}
                </option>
              ))}
          </select>
        </label>
        <label className="ph-field">
          <span>Location</span>
          <select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          >
            {workspace.locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.warehouse} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="ph-dense-note" style={{ margin: "16px 0" }}>
        Eligible available stock, ordered by earliest expiry. Held and expired
        batches are excluded. Customer shelf-life rules are checked when
        dispatch is posted.
      </p>
      {rows.length ? (
        rows.map((row, index) => (
          <div
            className="ph-list-item"
            key={row.batch.id}
            style={{ paddingLeft: 0, paddingRight: 0 }}
          >
            <span className="ph-list-icon">{index + 1}</span>
            <div>
              <strong>{row.batch.code}</strong>
              <p>
                Expires {shortDate(row.expiry)} · {number(row.quantity)}{" "}
                {
                  workspace.products.find((item) => item.id === productId)
                    ?.baseUnit
                }{" "}
                available
              </p>
            </div>
            <button
              className="ph-button"
              disabled={!canOperate}
              onClick={() => onDispatch(row.batch.id, locationId)}
            >
              Dispatch <ArrowUpRight size={13} />
            </button>
          </div>
        ))
      ) : (
        <Empty
          title="No eligible stock at this location"
          description="Inspect stock balances or choose another location. Held and expired quantities cannot be allocated."
        />
      )}
    </div>
  );
}

function ReportComparison({
  a,
  b,
}: {
  a?: ReportSnapshot;
  b?: ReportSnapshot;
}) {
  if (!a || !b)
    return (
      <Empty
        title="Compare two fixed snapshots"
        description="See how shipments, returns, recipient balances and outstanding quantities changed within the same case."
      />
    );
  if (a.id === b.id)
    return (
      <p className="ph-form-notice" style={{ marginTop: 20 }}>
        Choose two different snapshots.
      </p>
    );
  if (a.recallId !== b.recallId || a.summary.unit !== b.summary.unit)
    return (
      <p className="ph-form-notice" style={{ marginTop: 20 }}>
        Choose snapshots of the same case and unit to compare quantities.
      </p>
    );
  const fields = [
    { key: "shipped" as const, label: "Historically dispatched" },
    { key: "returned" as const, label: "Returned" },
    { key: "onHand" as const, label: "Recorded on hand" },
    { key: "customerHeld" as const, label: "Customer held" },
    { key: "outstanding" as const, label: "Outstanding" },
  ];
  return (
    <div style={{ marginTop: 23 }}>
      <div className="ph-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Measure · {a.summary.unit}</th>
              <th>Revision {a.revision}</th>
              <th>Revision {b.revision}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key}>
                <td>{field.label}</td>
                <td>{number(a.summary[field.key])}</td>
                <td>{number(b.summary[field.key])}</td>
                <td>
                  {b.summary[field.key] - a.summary[field.key] > 0 ? "+" : ""}
                  {number(b.summary[field.key] - a.summary[field.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ph-dense-note" style={{ marginTop: 18 }}>
        {
          b.summary.recipients.filter(
            (row) =>
              !a.summary.recipients.some(
                (prior) =>
                  prior.partnerId === row.partnerId &&
                  prior.batchId === row.batchId,
              ),
          ).length
        }{" "}
        new recipient/batch connections.{" "}
        {b.movements.length - a.movements.length} change in captured movement
        count. Snapshots retain their original evidence.
      </p>
    </div>
  );
}

function DetailDialog({
  detail,
  workspace,
  canOperate,
  canAdmin,
  canQuality,
  onClose,
  onDetail,
  onForm,
  onToast,
}: {
  detail: Detail;
  workspace: PharmaWorkspace;
  canOperate: boolean;
  canAdmin: boolean;
  canQuality: boolean;
  onClose: () => void;
  onDetail: (detail: Detail) => void;
  onForm: (request: FormRequest) => void;
  onToast: (message: string) => void;
}) {
  const balances = stockBalances(workspace),
    product = workspace.products.find((item) => item.id === detail.id),
    batch = workspace.batches.find((item) => item.id === detail.id),
    source = workspace.sources.find((item) => item.id === detail.id),
    movement = workspace.movements.find((item) => item.id === detail.id),
    report = workspace.reports.find((item) => item.id === detail.id),
    audit = workspace.audit.find((item) => item.id === detail.id),
    recall = workspace.recalls.find((item) => item.id === detail.id);
  const partner = workspace.partners.find(
      (item) => item.id === detail.partnerId,
    ),
    affectedBatch = workspace.batches.find(
      (item) => item.id === detail.batchId,
    );
  const evidence = (link?: { sourceId: string; line?: number }) =>
    link ? (
      <button
        className="ph-text-button"
        onClick={() =>
          onDetail({ type: "source", id: link.sourceId, line: link.line })
        }
      >
        <FileText size={14} />
        Open source evidence
      </button>
    ) : (
      <span className="ph-muted">No source linked</span>
    );
  let title = "Record details",
    eyebrow = "Evidence and history",
    body: ReactNode = null,
    actions: ReactNode = null;
  if (detail.type === "product" && product) {
    title = productLabel(product);
    eyebrow = `${product.sku} · Catalogue version ${product.version}`;
    body = (
      <>
        <dl className="ph-detail-grid">
          <DetailValue label="Generic name" value={product.genericName} />
          <DetailValue
            label="Active ingredient"
            value={product.activeIngredient}
          />
          <DetailValue label="Dosage form" value={product.dosageForm} />
          <DetailValue label="Manufacturer" value={product.manufacturer} />
          <DetailValue
            label="Registration holder"
            value={product.registrationHolder || "Not supplied"}
          />
          <DetailValue
            label="Registration identifier"
            value={product.registrationId || "Not supplied"}
          />
          <DetailValue
            label="Jurisdiction"
            value={product.jurisdiction || "Not specified"}
          />
          <DetailValue label="GTIN" value={product.gtin || "Not supplied"} />
          <DetailValue label="Stocking unit" value={product.baseUnit} />
          <DetailValue label="Presentation" value={product.packaging} />
          <DetailValue label="Storage instructions" value={product.storage} />
          <DetailValue
            label="Declared temperature limits"
            value={
              product.temperatureMin !== undefined &&
              product.temperatureMax !== undefined
                ? `${product.temperatureMin}–${product.temperatureMax} °C`
                : "Not configured"
            }
          />
        </dl>
        {evidence(product.evidence)}
        <h3 className="ph-section-title">Explicit unit conversions</h3>
        <div className="ph-info-grid">
          {product.units.map((unit) => (
            <div className="ph-stat-line" key={unit.unit}>
              <span>1 {unit.unit}</span>
              <strong>
                {number(unit.factor)} {product.baseUnit}
              </strong>
            </div>
          ))}
        </div>
        <p className="ph-dense-note" style={{ marginTop: 10 }}>
          Quantity precision: {product.quantityPrecision} decimal places.
          Strength metadata is never used for inventory conversion.
        </p>
        <h3 className="ph-section-title">Registered batches</h3>
        {workspace.batches
          .filter((item) => item.productId === product.id)
          .map((item) => (
            <div
              className="ph-list-item"
              key={item.id}
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              <span className="ph-list-icon">
                <Package size={15} />
              </span>
              <div>
                <button
                  className="ph-row-button"
                  onClick={() => onDetail({ type: "batch", id: item.id })}
                >
                  <strong className="ph-mono">{item.code}</strong>
                </button>
                <p>
                  Expiry {shortDate(item.expiry.value)} ·{" "}
                  {item.held ? "Batch held" : "No batch hold"}
                </p>
              </div>
              <button
                className="ph-text-button"
                onClick={() => onDetail({ type: "batch", id: item.id })}
              >
                Trace <ArrowUpRight size={12} />
              </button>
            </div>
          ))}
      </>
    );
    actions = (
      <>
        <button
          className="ph-button"
          disabled={!canAdmin}
          onClick={() =>
            onForm({ kind: "product-archive", productId: product.id })
          }
        >
          {product.archived ? "Restore product" : "Archive product"}
        </button>
        <button
          className="ph-button"
          disabled={!canAdmin}
          onClick={() =>
            onForm({ kind: "product-edit", productId: product.id })
          }
        >
          Edit catalogue
        </button>
        <button
          className="ph-button ph-button-primary"
          disabled={!canAdmin || product.archived}
          onClick={() => onForm({ kind: "batch", productId: product.id })}
        >
          Add batch
        </button>
      </>
    );
  }
  if (detail.type === "batch" && batch) {
    const trace = traceBatch(workspace, batch.id);
    title = batch.code;
    eyebrow = `${productLabel(trace.product)} · ${trace.product.sku}`;
    body = (
      <>
        <dl className="ph-detail-grid">
          <DetailValue
            label="Original printed code"
            value={batch.originalCode}
          />
          <DetailValue label="Manufacturer" value={batch.manufacturer} />
          <DetailValue
            label="Expiry label"
            value={`${batch.expiry.sourceText} (${batch.expiry.precision} precision)`}
          />
          <DetailValue
            label="Recorded receipts"
            value={`${number(trace.received)} ${trace.unit}`}
          />
          <DetailValue
            label="Historically dispatched"
            value={`${number(trace.shipped)} ${trace.unit}`}
          />
          <DetailValue
            label="Recorded on hand"
            value={`${number(trace.onHand)} ${trace.unit}`}
          />
        </dl>
        {batch.held && (
          <div className="ph-notice ph-warning">
            <LockKeyhole size={18} />
            <div>
              <strong>Batch hold is active</strong>
              <p>{batch.holdReason}</p>
            </div>
          </div>
        )}
        <div className="ph-flow">
          <div className="ph-flow-node">
            <Building2 size={22} />
            <div>
              <strong>
                {number(trace.received)} {trace.unit} received
              </strong>
              <span>
                {
                  trace.movements.filter((item) => item.kind === "receipt")
                    .length
                }{" "}
                receipt records
              </span>
            </div>
          </div>
          <ArrowRight className="ph-flow-arrow" size={20} />
          <div className="ph-flow-node">
            <Boxes size={22} />
            <div>
              <strong>
                {number(trace.onHand)} {trace.unit} on hand
              </strong>
              <span>{number(trace.inTransit)} in transit</span>
            </div>
          </div>
          <ArrowRight className="ph-flow-arrow" size={20} />
          <div className="ph-flow-node">
            <Truck size={22} />
            <div>
              <strong>{trace.shipments.length} dispatches</strong>
              <span>
                {number(trace.returned)} {trace.unit} returned
              </span>
            </div>
          </div>
        </div>
        <h3 className="ph-section-title">Stock by location and status</h3>
        <div className="ph-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Status</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {trace.balances.map((row) => (
                <tr key={`${row.locationId}-${row.status}`}>
                  <td>
                    {
                      workspace.locations.find(
                        (item) => item.id === row.locationId,
                      )?.name
                    }
                  </td>
                  <td>
                    <Badge tone={badgeTone(row.status)}>
                      {friendly(row.status)}
                    </Badge>
                  </td>
                  <td>
                    <NumberValue value={row.quantity} unit={row.unit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="ph-section-title">Customer destinations</h3>
        {trace.shipments.length ? (
          <div className="ph-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Recipient / dispatch</th>
                  <th>Dispatched</th>
                  <th>Returned</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {trace.shipments.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.partnerName}</strong>
                      <small>{row.reference}</small>
                    </td>
                    <td>
                      <NumberValue value={row.quantity} unit={row.unit} />
                    </td>
                    <td>
                      <NumberValue value={row.returned} unit={row.unit} />
                    </td>
                    <td>{evidence(row.evidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ph-dense-note">
            No dispatches are recorded for this batch. This describes the
            records available; it is not a safety conclusion.
          </p>
        )}
        <h3 className="ph-section-title">Movement history</h3>
        <ul className="ph-timeline">
          {[...trace.movements].reverse().map((row) => (
            <li key={row.id}>
              <time>
                {shortDate(row.at)} · {row.actor}
              </time>
              <button
                className="ph-row-button"
                onClick={() => onDetail({ type: "movement", id: row.id })}
              >
                <strong>
                  {friendly(row.kind)} · {number(row.quantity)} {row.unit} ·{" "}
                  {row.reference}
                </strong>
              </button>
              <p>{row.reason}</p>
            </li>
          ))}
        </ul>
        <h3 className="ph-section-title">Source records</h3>
        <div className="ph-actions">
          {trace.sources.map((item) => (
            <button
              key={item.id}
              className="ph-button"
              onClick={() => onDetail({ type: "source", id: item.id })}
            >
              <FileText size={13} />
              {item.name}
            </button>
          ))}
        </div>
        {batch.serials?.length ? (
          <>
            <h3 className="ph-section-title">Serialized stock</h3>
            <p className="ph-dense-note">
              Each serial has a recorded stock position. These identifiers do
              not authenticate a medicine.
            </p>
            <DataTable
              id={`serials-${batch.id}`}
              rows={serialLedger(workspace, batch.id)}
              rowKey={(row) => row.serial}
              searchable={(row) =>
                `${row.serial} ${row.status} ${workspace.locations.find((item) => item.id === row.locationId)?.name || ""}`
              }
              placeholder="Search serial or position…"
              columns={[
                {
                  key: "serial",
                  label: "Serial identifier",
                  render: (row) => (
                    <strong className="ph-mono">{row.serial}</strong>
                  ),
                  value: (row) => row.serial,
                },
                {
                  key: "position",
                  label: "Position",
                  render: (row) =>
                    workspace.locations.find(
                      (item) => item.id === row.locationId,
                    )?.name ||
                    workspace.partners.find((item) => item.id === row.partnerId)
                      ?.name ||
                    "Not received",
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Badge tone={badgeTone(row.status)}>
                      {friendly(row.status)}
                    </Badge>
                  ),
                },
                {
                  key: "movement",
                  label: "Record",
                  render: (row) =>
                    row.movementId ? (
                      <button
                        className="ph-text-button"
                        onClick={() =>
                          onDetail({ type: "movement", id: row.movementId! })
                        }
                      >
                        Inspect movement
                      </button>
                    ) : (
                      "—"
                    ),
                },
              ]}
            />
            <h3 className="ph-section-title">Recorded package relationships</h3>
            <div className="ph-actions" style={{ marginBottom: 15 }}>
              <button
                className="ph-button"
                disabled={!canOperate}
                onClick={() => onForm({ kind: "package", batchId: batch.id })}
              >
                <Plus size={13} />
                Group units
              </button>
              <button
                className="ph-button"
                disabled={!canAdmin}
                onClick={() => onForm({ kind: "serials", batchId: batch.id })}
              >
                Register more serials
              </button>
            </div>
            {(workspace.packages || [])
              .filter((item) => item.batchId === batch.id)
              .map((item) => (
                <div
                  className="ph-list-item"
                  key={item.id}
                  style={{ paddingLeft: 0, paddingRight: 0 }}
                >
                  <span className="ph-list-icon">
                    <Package size={16} />
                  </span>
                  <div>
                    <strong>{item.code}</strong>
                    <p>
                      {packageSerials(workspace, item.id).length} serialized
                      units · {item.childPackageIds.length} child packages ·{" "}
                      <span className="ph-mono">{item.id}</span>
                    </p>
                    <small>
                      {item.status === "opened"
                        ? `Opened: ${item.openReason}`
                        : "Recorded as sealed"}
                    </small>
                  </div>
                  {item.status === "sealed" ? (
                    <button
                      className="ph-text-button"
                      disabled={!canOperate}
                      onClick={() =>
                        onForm({ kind: "package-open", packageId: item.id })
                      }
                    >
                      Record opening
                    </button>
                  ) : (
                    <Badge>Opened</Badge>
                  )}
                </div>
              ))}
          </>
        ) : (
          <div className="ph-actions" style={{ marginTop: 20 }}>
            <button
              className="ph-text-button"
              disabled={!canAdmin}
              onClick={() => onForm({ kind: "serials", batchId: batch.id })}
            >
              Register serial identifiers
            </button>
          </div>
        )}
      </>
    );
    actions = (
      <>
        <button
          className="ph-button"
          disabled={!canAdmin}
          onClick={() => onForm({ kind: "batch-correct", batchId: batch.id })}
        >
          Correct label
        </button>
        <button
          className="ph-button"
          disabled={!canQuality}
          onClick={() =>
            onForm({
              kind: batch.held ? "batch-release" : "batch-hold",
              batchId: batch.id,
            })
          }
        >
          {batch.held ? "Release hold" : "Hold batch"}
        </button>
        <button
          className="ph-button"
          disabled={!canQuality}
          onClick={() => onForm({ kind: "recall", batchId: batch.id })}
        >
          Open recall
        </button>
        <button
          className="ph-button ph-button-primary"
          disabled={!canOperate || batch.held}
          onClick={() => onForm({ kind: "dispatch", batchId: batch.id })}
        >
          Dispatch stock
        </button>
      </>
    );
  }
  if (detail.type === "source" && source) {
    title = source.name;
    eyebrow =
      source.mode === "ai"
        ? `AI-assisted · ${source.provider} · ${source.model}`
        : source.mode === "template"
          ? "Guided example · No AI request"
          : source.mode === "sample"
            ? "Sample source record"
            : "Structured / manual source";
    body = (
      <>
        <dl className="ph-detail-grid">
          <DetailValue label="Document type" value={source.kind} />
          <DetailValue label="Added" value={shortDate(source.createdAt)} />
          <DetailValue
            label="Linked movements"
            value={String(
              workspace.movements.filter(
                (item) => item.evidence?.sourceId === source.id,
              ).length,
            )}
          />
        </dl>
        <div className="ph-source-text ph-source-lines">
          {source.text.split(/\r?\n/).map((line, index) => (
            <div
              key={index}
              className={`ph-source-line ${index + 1 === detail.line ? "is-highlight" : ""}`}
            >
              <span>{index + 1}</span>
              <code>{line || " "}</code>
            </div>
          ))}
        </div>
        {source.hash && (
          <p className="ph-dense-note" style={{ overflowWrap: "anywhere" }}>
            SHA-256 · <span className="ph-mono">{source.hash}</span>
            <br />
            This hash identifies the saved content, not its factual accuracy.
          </p>
        )}
      </>
    );
    actions = (
      <a
        className="ph-button"
        href={`/api/pharma/document?id=${encodeURIComponent(source.id)}`}
        target="_blank"
        rel="noreferrer"
      >
        <Download size={14} />
        Open original source
      </a>
    );
  }
  if (detail.type === "movement" && movement) {
    title = movement.reference;
    eyebrow = `${friendly(movement.kind)} · ${shortDate(movement.at)}`;
    body = (
      <>
        <dl className="ph-detail-grid">
          <DetailValue
            label="Product"
            value={`${workspace.products.find((item) => item.id === movement.productId)?.name} · catalogue v${movement.productVersion}`}
          />
          <DetailValue
            label="Batch"
            value={
              workspace.batches.find((item) => item.id === movement.batchId)
                ?.code || movement.batchId
            }
          />
          <DetailValue label="Recorded by" value={movement.actor} />
          <DetailValue
            label="Source quantity"
            value={`${number(movement.originalQuantity)} ${movement.originalUnit}`}
          />
          <DetailValue
            label="Ledger quantity"
            value={`${number(movement.quantity)} ${movement.unit}`}
          />
          <DetailValue label="Time" value={movement.at} />
          <DetailValue
            label="From"
            value={
              movement.from
                ? `${workspace.locations.find((item) => item.id === movement.from!.locationId)?.name} · ${movement.from.status}`
                : "External"
            }
          />
          <DetailValue
            label="To"
            value={
              movement.to
                ? `${workspace.locations.find((item) => item.id === movement.to!.locationId)?.name} · ${movement.to.status}`
                : "External"
            }
          />
          <DetailValue
            label="Partner"
            value={
              workspace.partners.find((item) => item.id === movement.partnerId)
                ?.name || "Internal movement"
            }
          />
        </dl>
        <p className="ph-form-notice">{movement.reason}</p>
        {evidence(movement.evidence)}
        {movement.reversalOf && (
          <p className="ph-dense-note" style={{ marginTop: 15 }}>
            Linked reversal of {movement.reversalOf}
          </p>
        )}
      </>
    );
    actions = (
      <>
        {movement.kind === "reserve" && (
          <button
            className="ph-button"
            disabled={!canOperate}
            onClick={() =>
              onForm({ kind: "reservation-cancel", reservationId: movement.id })
            }
          >
            Cancel reservation
          </button>
        )}
        <button
          className="ph-button"
          disabled={!canQuality}
          onClick={() => onForm({ kind: "reverse", movementId: movement.id })}
        >
          Record reversal
        </button>
        <button
          className="ph-button ph-button-primary"
          onClick={() => onDetail({ type: "batch", id: movement.batchId })}
        >
          Trace batch <ArrowRight size={13} />
        </button>
      </>
    );
  }
  if (detail.type === "report" && report) {
    title = report.title;
    eyebrow = `Fixed snapshot · Revision ${report.revision}`;
    body = (
      <>
        <dl className="ph-detail-grid">
          <DetailValue label="Created" value={report.createdAt} />
          <DetailValue label="Recorded by" value={report.actor} />
          <DetailValue label="Reference date" value={report.asOf} />
          <DetailValue
            label="Historically dispatched"
            value={`${number(report.summary.shipped)} ${report.summary.unit}`}
          />
          <DetailValue
            label="Returned"
            value={`${number(report.summary.returned)} ${report.summary.unit}`}
          />
          <DetailValue
            label="Outstanding"
            value={`${number(report.summary.outstanding)} ${report.summary.unit}`}
          />
        </dl>
        <Badge tone={report.summary.accountingComplete ? "good" : "warning"}>
          {report.summary.accountingComplete
            ? "Recorded quantities accounted for"
            : "Accounting in progress"}
        </Badge>
        <p className="ph-dense-note" style={{ marginTop: 18 }}>
          {report.note || "No operator note."}
        </p>
        <h3 className="ph-section-title">Captured evidence</h3>
        <p className="ph-dense-note">
          {report.sources.length} sources · {report.movements.length} stock
          movements · {report.audit.length} audit events. These are the records
          captured at this revision.
        </p>
        {report.summary.exceptions.map((message) => (
          <p className="ph-form-notice" key={message}>
            {message}
          </p>
        ))}
      </>
    );
    actions = (
      <>
        <a className="ph-button" href={reportUrl("json", report.id)}>
          JSON
        </a>
        <a className="ph-button" href={reportUrl("csv", report.id)}>
          CSV
        </a>
        <a className="ph-button" href={reportUrl("evidence", report.id)}>
          Evidence ZIP
        </a>
        <a
          className="ph-button ph-button-primary"
          href={reportUrl("pdf", report.id)}
        >
          <Download size={14} />
          PDF report
        </a>
      </>
    );
  }
  if (detail.type === "audit" && audit) {
    title = friendly(audit.action);
    eyebrow = `${audit.actor} · ${audit.role} · ${shortDate(audit.at)}`;
    body = (
      <>
        <p className="ph-form-notice">{audit.reason}</p>
        <h3>Before</h3>
        <pre className="ph-source-text">{audit.before || "—"}</pre>
        <h3>After</h3>
        <pre className="ph-source-text">{audit.after || "—"}</pre>
        <p className="ph-dense-note">
          Entity {audit.entity} · {audit.at}
        </p>
      </>
    );
  }
  if (detail.type === "notice" && recall && partner && affectedBatch) {
    const selectedProduct = workspace.products.find(
      (item) => item.id === recall.productId,
    );
    const recipient = recallSummary(workspace, recall.id).recipients.find(
      (item) =>
        item.partnerId === partner.id && item.batchId === affectedBatch.id,
    );
    const notice = `Subject: ${recall.reference} — ${productLabel(selectedProduct)} — batch ${affectedBatch.code}\n\nTo: ${partner.name}\n\nWe are coordinating a recall concerning the following recorded product and batch:\nProduct: ${productLabel(selectedProduct)}, ${selectedProduct?.dosageForm}\nSKU: ${selectedProduct?.sku}\nBatch: ${affectedBatch.code}\nReason recorded: ${recall.reason}\n\nOur records show ${recipient?.shipped || 0} ${selectedProduct?.baseUnit} dispatched to your site and ${recipient?.returned || 0} ${selectedProduct?.baseUnit} returned.\n\nPlease review your records, confirm receipt of this notice, and provide an evidenced current stock balance and any return or disposition details. Coordinate the next operational steps with the responsible contact.\n\nCase owner: ${recall.owner}\nCase reference: ${recall.reference}\n\nDraft prepared from recorded workspace data. Verify recipient details and authorised instructions before sending.`;
    title = `Notice for ${partner.name}`;
    eyebrow = "Notice draft · Nothing has been sent";
    body = (
      <>
        <div className="ph-notice">
          <Mail size={18} />
          <div>
            <strong>Prepared for operator review</strong>
            <p>
              This document is a draft. Copy or download it, verify
              instructions, then use your own approved communication channel.
            </p>
          </div>
        </div>
        <pre className="ph-source-text">{notice}</pre>
      </>
    );
    actions = (
      <>
        <button
          className="ph-button"
          onClick={() =>
            navigator.clipboard.writeText(notice).then(
              () => onToast("Notice draft copied. Nothing was sent."),
              () =>
                onToast(
                  "Clipboard unavailable. Select the notice text to copy it.",
                ),
            )
          }
        >
          Copy draft
        </button>
        <button
          className="ph-button ph-button-primary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([notice], { type: "text/plain;charset=utf-8" }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${recall.reference}-${partner.id}-draft.txt`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download draft
        </button>
      </>
    );
  }
  return (
    <Dialog title={title} eyebrow={eyebrow} onClose={onClose} wide>
      <div className="ph-dialog-body">
        {body || (
          <Empty
            title="Record unavailable"
            description="Refresh the workspace to load its latest records."
          />
        )}
      </div>
      <footer className="ph-dialog-footer">
        <button className="ph-button" onClick={onClose}>
          Close
        </button>
        {actions}
      </footer>
    </Dialog>
  );
}
function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
