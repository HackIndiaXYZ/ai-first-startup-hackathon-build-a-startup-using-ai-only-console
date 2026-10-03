"use client";

import { useState } from "react";
import { Download, FolderClock, RefreshCw, Trash2 } from "lucide-react";
import type { PharmaAccess } from "@/lib/pharma/store";
import type { PharmaWorkspace } from "@/lib/pharma/types";
import { Panel } from "./ui";

type PreviewPage = { revision: number; candidates: { id: string; createdAt: string; bytes: number }[]; scanned: number; nextCursor: string | null };

export default function RetentionPanel({ access, onUpdate }: { access: Pick<PharmaAccess, "role" | "signedIn" | "secured">; onUpdate: (workspace: PharmaWorkspace) => void }) {
  const [page, setPage] = useState<PreviewPage | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const canClean = access.role === "admin" && access.signedIn && access.secured;

  async function inspect(nextCursor?: string) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/pharma/retention${nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : ""}`);
      const result = await response.json() as PreviewPage & { error?: string };
      if (!response.ok) throw Error(result.error || "Retained previews could not be read.");
      setPage(result); setCursor(nextCursor);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Retained previews could not be read."); }
    finally { setBusy(false); }
  }
  async function clean() {
    if (!page?.candidates.length) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/pharma/retention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: page.revision, requestId: crypto.randomUUID(), ids: page.candidates.map(candidate => candidate.id), confirm: "REMOVE_EXPIRED_PREVIEWS" }) });
      const result = await response.json() as { workspace?: PharmaWorkspace; error?: string; replayed?: boolean; notice?: string; removed: number };
      if (result.workspace) onUpdate(result.workspace);
      if (!response.ok) throw Error(result.error || "Preview cleanup could not be completed. Review the list before retrying.");
      setPage(null);
      setNotice(result.replayed ? result.notice || "This cleanup request was already recorded. Review retained previews again." : `${result.removed} expired preview${result.removed === 1 ? "" : "s"} removed. Original documents and posted records are retained.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Preview cleanup could not be completed."); setPage(null); }
    finally { setBusy(false); }
  }

  return <Panel title="Retention & recovery" description="Your records remain available until you choose a supported data-management action.">
    <div className="ph-setting-row">
      <div><h3>Workspace history</h3><p>Saved records, audit history, source documents and report snapshots have no automatic expiry in this release, within workspace storage limits. Archived sources remain available as evidence.</p></div>
      <a className="ph-button" href="/api/pharma/export?format=json"><Download size={14} /> Download backup</a>
    </div>
    <div className="ph-setting-row">
      <div><h3>Backup contents</h3><p>JSON includes records, source text and report snapshots. Original PDF and image bytes are downloaded separately in evidence packages or Documents. Restoration validates the records, keeps the current audit history and strips file pointers from the backup.</p></div>
    </div>
    <div className="ph-setting-row">
      <div><h3>Expired document previews</h3><p>Unposted previews expire after 7 days. A signed-in administrator can review and remove up to 20 expired preview metadata files at a time. This action preserves original files, posted records and every report source.</p></div>
      <button className="ph-button" disabled={!canClean || busy} onClick={() => void inspect()}><FolderClock size={14} />{busy ? "Working…" : "Review expired previews"}</button>
    </div>
    {!canClean && <p className="ph-muted">Save the workspace to your account and use an administrator role to manage expired previews.</p>}
    {page && <div className="ph-form-notice">
      <strong>{page.candidates.length} expired preview{page.candidates.length === 1 ? "" : "s"} in this group</strong>
      <p>{page.scanned} preview files inspected. {page.candidates.length ? `Oldest eligible preview: ${page.candidates.map(item => item.createdAt).sort()[0].slice(0, 10)}. Removing these previews cannot be undone; their original documents are retained and can be prepared again.` : "No eligible expired previews are selected."}</p>
      <div className="ph-actions">
        <button className="ph-button" disabled={busy || !page.candidates.length} onClick={() => void clean()}><Trash2 size={14} />Remove {page.candidates.length} expired previews</button>
        {page.nextCursor && <button className="ph-button" disabled={busy} onClick={() => void inspect(page.nextCursor!)}>Review next group</button>}
        <button className="ph-button" disabled={busy} onClick={() => void inspect(cursor)}><RefreshCw size={14} />Refresh group</button>
      </div>
    </div>}
    {notice && <p role="status" aria-live="polite" className="ph-form-notice">{notice}</p>}
    <div className="ph-setting-row"><div><h3>Permanent organisation deletion</h3><p>No automatic purge or in-app organisation deletion runs in this release. The workspace owner must explicitly request permanent data removal from the deployment administrator. Download needed records first; retention requirements remain the organisation’s responsibility.</p></div></div>
  </Panel>;
}
