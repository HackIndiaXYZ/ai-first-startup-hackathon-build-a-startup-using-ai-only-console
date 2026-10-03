# Data retention and recovery

Scope: the pharmaceutical edition as implemented on 4 October 2026. This is the application's current behavior, not a claim that it satisfies a particular legal retention period. This workflow is for distribution records, not patient records.

## Saved records

The application does not automatically expire posted products, batches, movements, source documents, audit history or report snapshots. Data remains in the deployment's database and object store, subject to workspace limits and the deployment administrator's operation of the service. This is not a promise of permanent hosting or a substitute for an independent backup.

Archiving a product is a reversible catalogue action and preserves its history. Source documents retained during a sample reset or a backup restore remain archived evidence. A sample reset replaces the operational scenario after an explicit confirmation; export a backup first. There is no whole-workspace archive or in-app permanent organisation purge in this release.

## Backups and reports

Settings → Backup JSON downloads the versioned workspace, including records, source text, report snapshots and audit entries. A JSON backup does **not** embed uploaded PDF/image bytes. Download original documents separately from Documents, or download the evidence package for each relevant saved report. An evidence ZIP includes that report's permitted source files, PDF, CSV/JSON detail and a content-fingerprint manifest; it is not a complete database backup.

Restoration requires an administrator, a reason and successful identity/balance validation. It restores into the current workspace with a revision higher than both the current and imported revisions, and retains the existing audit history. Imported source/report file pointers are removed so a backup cannot grant access to another workspace's stored files. Source text remains available; retain original binaries separately. Current source records absent from the imported backup remain archived evidence.

Store downloaded backups in an access-controlled location managed by your organisation. There is no scheduled off-site backup or automatic recovery guarantee in this release.

## Document previews

Unposted intake previews become ineligible for posting after seven days. Expiry does not trigger automatic deletion. Settings → Retention & recovery lets a signed-in administrator of an account-backed workspace inspect and explicitly remove eligible expired preview **metadata** in groups of at most 20.

The cleanup endpoint:

- scopes object listing and deletion to that workspace's `drafts/` prefix and valid preview IDs;
- checks both object-upload age and the recognized draft's creation time;
- retains malformed, oversized, recent or unrecognized objects;
- protects references held by all source documents, including archived sources, and report snapshots;
- preserves every original file and all posted ledger/audit/report records;
- rejects stale workspace revisions and records the administrator's cleanup authorization before object removal.

Database audit persistence and object deletion do not share a transaction. The audit states that removal was **requested**. The response reports confirmed removal; an unavailable response does not prove deletion failed. Reinspect the list before retrying. Replaying the same request ID does not repeat deletion.

This intentionally narrow cleanup does not remove unreferenced original uploads or historical large-record blobs. Those remain subject to explicit deployment administration; no unattended garbage-collection job is enabled.

## Accounts and permanent removal

An account-backed workspace is recoverable through its signed-in membership. A guest workspace depends on its browser session cookie; a backup is important before losing that session. Session cookies expire after 30 days; expiry does not delete the workspace. Invitations expire after seven days.

For permanent organisation-data removal, the owner must explicitly request it from the deployment administrator. The administrator must identify the exact workspace, confirm the requested scope, account for records the organisation is required to retain, and remove its database records and object-store prefix through controlled administration. The app does not silently turn an account sign-out, cookie expiry or preview cleanup into a workspace purge.

## Verification

SQLite-backed tests execute the production retention and storage queries against disposable synthetic databases. They check role restrictions, foreign workspace isolation, protected archived/report references, age and format checks, the 20-object bound, stale approval, request replay, and an audit failure before deletion. Recovery is also exercised by the pharmaceutical API integration suite. Tests create no real organisation data and make no paid AI call.
