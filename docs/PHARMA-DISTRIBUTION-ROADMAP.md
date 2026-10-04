# RecallScope for pharmaceutical distribution

Decision, implementation register and development roadmap · Updated 4 October 2026 · Team Console

## Direction

The owner selected **pharmaceutical distributors and wholesalers**. Keep RecallScope as the brand and develop a focused product for operations and quality teams that need to identify affected product batches, locate their recorded stock and deliveries, coordinate recall work, and reconcile quantities against evidence.

Proposed positioning: **“Know where every affected batch went. Account for what comes back.”**

The main workflow is:

**Receive → identify product and batch → store or transfer → dispatch → trace → manage recall → reconcile → export evidence.**

This is a distribution workflow. Manufacturing recipes, ingredient consumption and production yields do not represent it correctly. The pharmaceutical edition needs its own versioned data model; changing the existing bakery names alone would leave incorrect quantity calculations and relationships.

The initial market jurisdiction is not yet selected. Store jurisdiction and registration identifiers explicitly, and keep local policy configurable. Malaysian references inform this proposal without making Malaysia, India or US regulatory compliance a product claim. No real industrial trial, customer outreach, warehouse deployment or paid media generation is required by this roadmap.

## What is restored today

The existing local checkout and dependencies survived the earlier attempted cleanup. Development is running again at [http://localhost:5173/](http://localhost:5173/).

- Repository: `C:/Users/kingy/Documents/Codex/2026-09-12/find-first-prize-hackathon-idea-thread/outputs/recallscope`
- Application directory: `product/`
- Restored baseline commit: `0c40f20bdc22f330cc655a7300d358777c12e6b5`
- Restored baseline product: bakery ingredient-to-batch-to-customer tracing, source documents, reviewed imports, saved reports, search and appearance preferences.
- Reusable foundations: Fireworks extraction, configurable OpenAI adapter, evidence preservation, explicit review decisions, session isolation, stale-write protection, saved report snapshots, light/night/system themes.
- Restored baseline persistence: bounded workspace JSON in D1, original files in R2, browser-session identity. Product catalogues, stock ledgers and team accounts were subsequent pharmaceutical work.

This restoration section records the starting baseline. The pharmaceutical schema, movement ledger, recall accounting, template-first intake and evidence exports are now published, with the interface follow-up in version 3. The public workspace is pharmaceutical-only: the former route redirects to `/`, and the earlier-edition Settings link has been removed. Legacy records remain preserved separately, with the former interface in Git history. Current presentation materials use coded pharmaceutical visuals, a separate native vector pitch and the corresponding narration script. See the current [pharmaceutical verification record](PHARMA-VALIDATION.md).

### Restoration verification

| Check performed on 3 October 2026 | Result |
| --- | --- |
| `npm test` | 47 tests passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; framework reports a non-failing route-classification notice |
| `TEST_BASE_URL=http://localhost:5173 npm run test:api` | Passed: session isolation, origin checks, stale writes, reports, reviewed import, document isolation and provider guards |
| HTTP readiness | Local root returned 200 |
| Browser inspection | Trace workspace rendered 1,440 packs across four customers; source evidence opened; document search narrowed seven records to one delivery register |

No live AI request or paid generation was made for these checks. These results verify restoration of the existing release, not the future pharmaceutical edition.

To start a later local session in PowerShell:

```powershell
Set-Location 'C:/Users/kingy/Documents/Codex/2026-09-12/find-first-prize-hackathon-idea-thread/outputs/recallscope/product'
npm run dev
```

Keep that process running while using the local preview. The development URL is not a permanent hosted deployment. Retain the current lockfile and ignored local secrets; do not copy API keys into documentation, client code or Git.

## Why this is a stronger direction

This gives RecallScope a defined buyer, recognisable records and a complete operational task. The proposed differentiation is **document-to-recall reconciliation with inspectable evidence**: import a dispatch record, establish its batch connection, identify affected recipients, account for returns, and explain every reported quantity.

That is a product hypothesis, not evidence of customer demand or uniqueness. Pharmaceutical inventory and traceability products already exist. The case for RecallScope should rest on a focused workflow, low-friction document intake and demonstrable correctness rather than claiming to invent pharmaceutical traceability.

NPRA's public recall records distinguish product, registration number, active ingredient, batch and registration holder. Its recall information includes distribution to wholesalers, pharmacies, clinics and hospitals. These are useful inputs to the proposed product and recipient model. [NPRA product recall information](https://www.npra.gov.my/index.php/en/consumers/safety-information/product-recall.html)

NPRA's GDP guidance discusses expiry-based stock rotation, stock reconciliation, quarantined returns and recording recall progress. Those concerns motivate expiry, stock status and recall accounting in this roadmap. The guidance does not validate RecallScope or make the software compliant. [NPRA GDP, third edition, sections 4 and 7](https://www.npra.gov.my/~npraweb/images/Guidelines_Central/Guidelines_on_Regulatory/2018/GUIDELINE_ON_GDP_3rd_Edi_2018.pdf)

## Improvement backlog

**P1** is needed for a coherent first pharmaceutical edition. **P2** strengthens daily use and a credible demonstration. **P3** is an expansion. Checked items have implementation and direct domain/API/source evidence at this checkpoint. Unchecked items can be partial, undergoing interface/release verification, or deliberately bounded; the scope table below identifies those distinctions. A checkbox does not imply industrial validation or certification.

### Implementation scope at this checkpoint

| Area | What is implemented and what the boundary means |
| --- | --- |
| Key-free intake | Four guided source/record examples and mapped CSV import, with explicit provenance and review before stock posting. Live Fireworks/OpenAI remains optional |
| Core accounting | Product-specific batches, explicit unit factors, stock statuses, transit/reservations, expiry gates, dispatch/return accounting, case closure and fixed reports. Verification now includes serial custody and package aggregation |
| Interface and visual checks | Pharmaceutical navigation, catalogue/dossiers, expiry controls, operational tables, saved views, recall graph, report comparison and quantity drilldowns are integrated. The complete receipt-to-report browser journey, 390-pixel layout, keyboard dialog behavior and light/night themes passed |
| Provenance | Exact source text/quote, line and supplied page; field values are checked against the quote. Pixel bounding boxes are not fabricated |
| Extraction evaluation | Ten labelled CSV cases, six PDFs including rotated and image-only pages, and authored expected/provider responses. The corpus measures parser and controlled-adapter behavior; no live model or OCR accuracy is claimed |
| Registration metadata | Registration identifier type, ID, jurisdiction, holder and source fields exist. These operator-supplied facts do not certify registration status |
| Shipment model | Per-batch shipment lines may share a dispatch reference. A separate commercial sales-order system is not implied |
| Accounts | Guest isolation and organisation claim/recovery via hosting sign-in; roles checked on the server. No standalone password service is claimed |
| Standards | GS1 AI subset decoder and EPCIS 2.0 ObjectEvent count-profile export/preview. The exported fixture passed the official 2.0.1 JSON schema with URI/date formats checked |
| Serialisation / ERP | Serial-level stock custody, selected-unit movements/returns, sealed package grouping and parent/child aggregation are implemented and the eight-unit/three-package dossier was inspected. First-phase CSV/EPCIS contracts are available; native vendor ERP connections remain a future scoped expansion |
| Temperature / public notices | Source-linked Celsius observations and explicitly supplied policies; public-notice retrieval is read-only and human-reviewed. No medical safety decision or automatic recall action |
| Processing and retention | Indexed record persistence and bounded document jobs; tables paginate the current bounded workspace in the browser. Manual backup/restore and administrator-approved expired-preview metadata cleanup are available. [Retention policy](DATA-RETENTION.md) |
| Operational evidence | Database-only `/api/health`, actual SQLite transaction/race checks, independently decoded evidence ZIPs and parsed PDF exports. Environment-labelled synthetic 1,000/10,000-movement timings are saved under `product/verification/` |
| Presentation / release | Pharmaceutical application version 3 is published. README, product references, native vector pitch, AI record, coded video and narration describe this edition. Final video inspection is tracked in the release evidence |

The final integrated unit run passed **143/143** checks. Both retained bakery and pharmaceutical API suites passed on localhost without a live AI call. Browser evidence covers the complete selected-batch workflow and presentation behaviors described above. Final production-build completion and the release secret scan are tracked separately in [PHARMA-VALIDATION.md](PHARMA-VALIDATION.md).

### 1. Product catalogue

- [x] **01 · P1 — Product identity.** Add SKU, display name, generic name, manufacturer and dosage form. Keep different strengths and presentations as different catalogue entries.
- [x] **02 · P1 — Strength metadata.** Store active ingredient and strength separately from inventory quantities. Milligrams of active ingredient must never become a stock unit conversion.
- [x] **03 · P1 — Packaging.** Define each SKU's stocking unit, packaging hierarchy and explicit conversion factors; preserve the units printed on each source record.
- [x] **04 · P1 — Registration identifiers.** Store identifier type, issuing jurisdiction, registration holder and source. Unknown values stay unknown; fixture IDs must not impersonate real registrations.
- [x] **05 · P2 — Catalogue maintenance.** Add search, filters, product detail pages, controlled edits and archival. Historical movements retain the product version they used.
- [x] **06 · P2 — Storage metadata.** Record product-specific storage instructions and supporting sources. Avoid inventing a temperature range from a medicine name.

### 2. Batches and dates

- [x] **07 · P1 — Batch identity.** Use stable IDs scoped to the product and manufacturer. Identical printed batch codes on different medicines must not merge.
- [x] **08 · P1 — Source fidelity.** Preserve original batch codes, leading zeros, punctuation and OCR variants. Any approved normalisation retains the original and the reason.
- [x] **09 · P1 — Expiry precision.** Store source text, parsed value and precision for full-date and month-only expiry labels. Apply an explicit documented policy instead of silently inventing a date.
- [x] **10 · P1 — Date validation.** Detect ambiguous date formats, impossible dates and expiry before manufacture. Use date-only values for labels and timestamps for events.
- [x] **11 · P1 — Expiry views.** Add expired and configurable near-expiry filters, with a visible reference date and recorded-stock quantities. The showcase uses a controlled clock so results are reproducible.
- [x] **12 · P2 — Batch dossier.** Show receipts, locations, dispatches, returns, documents and recall history together, with direct links to the underlying records.

### 3. Inventory accounting

- [x] **13 · P1 — Movement ledger.** Introduce receipts, dispatches, transfers, returns and adjustments. Calculate recorded stock from these movements rather than production minus deliveries.
- [x] **14 · P1 — Warehouse locations.** Track warehouse and location IDs. Keep transfer-out, in-transit and transfer-in quantities distinct without duplicating enterprise stock.
- [x] **15 · P1 — Stock status.** Separate available, reserved, quarantined, rejected and disposed quantities. Changing status moves quantity between categories; it does not create stock.
- [x] **16 · P1 — Quantity rules.** Enforce allowed precision, supported units and non-negative balances. Missing quantities and unsupported conversions block confirmation rather than becoming zero.
- [x] **17 · P1 — Corrections and stocktakes.** Preserve posted events; record linked reversals and replacement entries. Store counted stock separately from ledger stock and explain any adjustment.
- [x] **18 · P2 — Expiry-aware allocation.** Suggest eligible batches by earliest expiry. Exclude held or expired stock, record overrides and apply customer remaining-shelf-life rules only when explicitly configured.

### 4. Distribution records

- [x] **19 · P1 — Trading partners.** Maintain suppliers and customer sites, including pharmacies, clinics, hospitals and other distributors. Store business contacts separately from product facts.
- [x] **20 · P1 — Goods receipt.** Capture supplier, receipt reference, product, batch, expiry, quantity, unit, warehouse and original document. Detect duplicate receipt lines.
- [x] **21 · P1 — Dispatch lines.** Capture customer site, shipment reference, batch, quantity, unit and date; allow multiple products and batches per shipment.
- [x] **22 · P1 — Shipment lifecycle.** Distinguish reserved, dispatched, delivered and cancelled records. Select a documented stock-posting point and reverse cancellations consistently.
- [x] **23 · P1 — Customer returns.** Link each return to the original dispatch and batch. Support partial returns and reject accidental return quantities greater than the eligible delivered quantity.
- [x] **24 · P2 — Supplier returns and attachments.** Record supplier return movements, delivery acknowledgements and related documents without conflating a credit note with physical receipt of stock.

### 5. Recall operations

- [x] **25 · P1 — Recall cases.** Add a case ID, initiating source, selected product/batches, reason, responsible person and dates. Scope and classification require an explicit authorised operator decision.
- [x] **26 · P1 — Impact calculation.** List affected recorded stock, shipments and recipients, keeping confirmed connections separate from incomplete records. A missing connection is not evidence of safety.
- [x] **27 · P1 — Quarantine actions.** Record a hold with actor, reason and time, and prevent new allocation or dispatch against held stock in the software. Do not claim the software physically quarantined goods.
- [x] **28 · P1 — Reconciliation.** Show shipped quantity, returned quantity, customer-reported balances, other evidenced dispositions and unresolved quantity in compatible units. Each quantity must have one accounting role.
- [x] **29 · P2 — Follow-up workflow.** Add recipient acknowledgements, assigned tasks, due dates and notice drafts. A generated draft is not a sent notice; a sent notice is not an acknowledgement.
- [x] **30 · P2 — Case completion.** Require evidence and an explicit recorded closure decision. Preserve partial returns, non-response and accounting exceptions; completion of accounting must not imply a medical safety decision.

### 6. AI-assisted document intake

- [x] **31 · P1 — Pharmaceutical extraction schema.** Support supplier invoices, goods-received notes, dispatch notes, returns and recall notices with product, strength, batch, expiry, quantity and unit fields.
- [x] **32 · P1 — Field provenance.** Attach source document and page/line evidence to proposed fields; add highlighted page regions where extraction can provide reliable coordinates.
- [x] **33 · P1 — Review before posting.** Let operators inspect, correct and approve proposed records before they affect stock or confirmed recall totals. Preserve correction history.
- [x] **34 · P1 — Deterministic validation.** Check product/strength mismatches, ambiguous batch codes, invalid dates, inconsistent units, duplicate lines and missing quantities independently of the model.
- [x] **35 · P2 — Batch import experience.** Add multi-file intake, row mapping, progress, partial failure recovery, deduplication and explicit retries. Retrying a request must not post a movement twice.
- [x] **36 · P2 — Provider and cost controls.** Keep Fireworks for development and retain OpenAI configuration. Add timeouts, per-workspace budgets and visible provider status; measure extraction quality on labelled fixtures instead of displaying invented confidence percentages.

### 7. Interface and visual design

- [x] **37 · P1 — Distribution navigation.** Organise around Overview, Products & Batches, Stock, Deliveries, Recalls, Documents and Reports, with direct links that preserve selected records.
- [x] **38 · P1 — Operational tables.** Add useful default columns, sort, filters, pagination, saved views and a detail drawer. Show batch, expiry, available stock and held stock together.
- [x] **39 · P1 — Trace visualisation.** Draw supplier → warehouse → customer movements, linked to the table and evidence drawer. Provide a table alternative when the graph becomes dense.
- [x] **40 · P2 — Personalisation and appearance.** Extend existing light/night/system themes, display names and density preferences to every new view; maintain clear contrast for statuses, charts and forms.
- [x] **41 · P2 — Useful motion.** Use short transitions to explain selected paths, progress and changed quantities. Respect reduced-motion preferences. Keep decorative motion and luxury stock photography off the operational workspace.
- [x] **42 · P1 — Accessible interaction.** Provide keyboard navigation, focus restoration, labelled controls, non-colour status cues, responsive layouts and specific empty/loading/error states with a clear next action.

### 8. Reports and evidence

- [x] **43 · P1 — Fixed case reports.** Save an immutable report snapshot with case scope, reference date, data revision, quantities and actor; later edits must not rewrite the old report.
- [x] **44 · P1 — Quantity explanations.** Let every metric open its contributing rows. Keep incompatible units in separate totals and distinguish recorded stock from physical stock counts.
- [x] **45 · P2 — Export formats.** Produce readable PDF summaries plus CSV/JSON detail, with product/batch identifiers, units, timestamps and properly escaped spreadsheet cells.
- [x] **46 · P2 — Evidence package.** Bundle a manifest, permitted source documents, hashes and decision history. A hash establishes content identity; it does not establish that the document is true.
- [x] **47 · P2 — Change comparison.** Extend existing report comparison to show new recipients, returns, corrections and changed balances between snapshots of the same case.
- [x] **48 · P2 — Audit record.** Record actor, timestamp, action, reason and before/after values in an append-only application log. Do not describe ordinary editable database records as tamper-proof.

### 9. Accounts and data protection

- [x] **49 · P2 — Persistent organisations.** Add recoverable accounts and organisation workspaces so a lost or expired browser cookie does not orphan business data.
- [x] **50 · P2 — Roles.** Enforce viewer, operations, quality and administrator permissions on the server, including import, stock adjustment, hold/release, case closure and export.
- [x] **51 · P1 — Isolation.** Extend existing session isolation to every new product, movement, file, case and report endpoint. Reject cross-workspace IDs regardless of UI visibility.
- [x] **52 · P1 — Secret handling.** Provider keys stay server-side; errors are sanitized. Candidate Git files, Office archive contents and the production browser bundle were scanned against credential patterns and configured local secrets with zero findings. [Rotation runbook](SECRET-HANDLING.md); bounded scan evidence is recorded in `product/verification/release-secret-scan.json`.
- [x] **53 · P1 — Upload boundaries.** Enforce file type, size, content and page limits; render untrusted text safely; treat instructions inside uploaded documents as data, never application commands.
- [x] **54 · P2 — Retention and recovery.** Define deletion, export, backup and restore behaviour; verify a restore on synthetic data. Do not collect patient records for this distribution workflow.

### 10. Engineering reliability

- [x] **55 · P1 — Versioned pharma schema.** Introduce explicit products, batches, locations, movements, partners, cases and evidence links. Preserve legacy stored records and their schema without silently reinterpreting them as pharmaceutical data. The public interface is pharmaceutical-only; the former route redirects to the main workspace.
- [x] **56 · P1 — Atomic writes.** Post multi-line movements and balance checks in transactions; use idempotency keys and concurrency checks for imports, returns and holds.
- [x] **57 · P1 — Separation of concerns.** Extract domain calculations and focused UI components from the large workspace page, with schema-validated API boundaries.
- [x] **58 · P2 — Bounded processing.** Add pagination, indexed queries and bounded document jobs. Keep large binaries out of workspace JSON and stream files where supported.
- [x] **59 · P2 — Recoverable failures.** Make interrupted uploads, extraction timeouts, unavailable providers and failed exports recoverable without data loss or duplicate posting.
- [x] **60 · P2 — Measured operation.** Add redacted error reporting, health checks and benchmark records, including dataset size and environment. Verify migrations and rollback on disposable synthetic databases.

### 11. Software verification without industrial trials

- [x] **61 · P1 — Domain invariants.** Verify conservation of quantities, valid unit conversions, status transitions and no duplicate return accounting with deterministic tests.
- [x] **62 · P1 — Identifier/date fixtures.** Cover duplicate batch codes across products, different strengths, leading zeros, O/0 confusion, month-only expiry, leap days and missing fields.
- [x] **63 · P1 — API/concurrency checks.** Exercise stale edits, duplicate imports, simultaneous dispatches, quarantine races, permission denial and cross-workspace file access.
- [x] **64 · P1 — Browser journeys.** Verify receipt → dispatch → trace → recall → return → report, as well as keyboard use, mobile layouts and both themes. The observed selected-batch report reconciled 10 shipped, 10 returned, 440 quarantined and zero outstanding; [browser results](PHARMA-VALIDATION.md#observed-browser-results) include the 390-pixel viewport and focus behavior.
- [x] **65 · P2 — Extraction evaluation.** Maintain expected field-level answers for varied synthetic PDFs/CSVs, including scans and inconsistent layouts. Separate parser tests, mocked-provider tests and actual paid provider results.
- [x] **66 · P2 — Scale and recovery checks.** Measure representative 1,000- and 10,000-movement datasets, interrupted work, backup restoration and report reproduction. Report observed timings instead of claiming industrial readiness.

### 12. Later integrations

- [x] **67 · P3 — Barcode input.** Add supported GS1 DataMatrix capture and decoding with validated examples, keyboard-scanner fallback and an explicit unsupported-code state. A readable barcode is not proof of authenticity.
- [x] **68 · P3 — Serialised units.** Add serial numbers and packaging aggregation only when package-level traceability is a selected requirement; retain batch-level operation for simpler records.
- [x] **69 · P3 — EPCIS exchange.** Map the ledger to a declared supported EPCIS version and validate import/export fixtures; do not claim compatibility based on a similarly named JSON field.
- [ ] **70 · P3 — ERP connectors, first phase implemented.** Documented CSV fields and column mapping, source-preserving previews, reviewed/idempotent posting and the declared EPCIS export/preview contract are available. Native vendor ERP authentication, synchronization and unattended retries remain a future scoped expansion; no connected ERP is claimed.
- [x] **71 · P3 — Cold-chain evidence.** Import recorded temperature observations and source timestamps; compare with explicitly supplied product policies. Route exceptions to authorised review rather than inferring medicine safety.
- [x] **72 · P3 — Public recall monitoring.** Retrieve attributed public notices with timestamps and human-reviewed product/batch matching. Do not automatically classify risk, declare a recall or send notices from a feed match.

The implementation exposes explicit GS1 and EPCIS subsets described in the verification record; the broader standards remain reference material. [GS1 healthcare GTIN rules](https://www.gs1.org/1/gtinrules/en/healthcare), [GS1 DataMatrix explanation](https://support.gs1.org/support/solutions/articles/43000734222/), [GS1 EPCIS](https://www.gs1.org/standards/epcis)

### 13. Product story and competition materials

- [x] **73 · P1 — Specific buyer and job.** Describe the user as a distributor's operations or quality team and lead with locating and reconciling an affected batch.
- [x] **74 · P2 — Alternatives research.** Compare current distributor software, document processes and traceability tools using dated primary sources. Distinguish observed features from our proposed advantages.
- [x] **75 · P2 — Commercial model.** Build a transparent cost model for hosting, extraction, storage and support. Treat pricing, adoption, savings and willingness to pay as hypotheses until measured.
- [x] **76 · P1 — Coherent sample scenario.** Create a labelled fictional distributor dataset with internally consistent products, batches, receipts, transfers, dispatches and returns. Maintain separate difficult fixtures for correctness checks.
- [x] **77 · P2 — Matched submission assets.** README, pharmaceutical [vector pitch](RecallScope-Pharma-Pitch.pptx), [PDF](RecallScope-Pharma-Pitch.pdf), [narration script](DEMO-SCRIPT.md) and AI usage record are updated. The [pharmaceutical walkthrough](RecallScope-Pharma-Demo.mp4) follows the implemented workflow, with final audio/visual and duration verification tracked in [release evidence](../product/verification/pharma-release.json). Superseded media links are absent from current materials.
- [x] **78 · P2 — Release evidence.** [Build record](BUILD-STATUS.md) records the published application revision, successful deployment, checks, live URL and bounded feature scope. Official competition requirements were rechecked before release; no organizer submission receipt, invented customer, certification or guaranteed prize is claimed.

## Proposed replacement for the item list

These catalogue examples now appear in the fictional distributor seed; they are not treatment guidance or verified commercial SKUs. Manufacturer names and storage policies are authored fixtures, and optional registration identifiers remain empty rather than impersonating real registrations.

| Example product presentation | Inventory unit for the fixture | Detail the model should demonstrate |
| --- | --- | --- |
| Paracetamol 500 mg tablets, 10 blisters × 10 tablets | Box | Box/blister/tablet conversion with explicit factors |
| Paracetamol 250 mg/5 mL oral suspension, 100 mL | Bottle | Same ingredient, different strength/form; keep volume separate from bottle count |
| Amoxicillin 500 mg capsules, 10 blisters × 10 capsules | Box | Product-scoped batch identity |
| Cetirizine 10 mg tablets, 10 blisters × 10 tablets | Box | Near-expiry ordering in a controlled-date scenario |
| Metformin 500 mg tablets, 10 blisters × 10 tablets | Box | Multiple batches and multiple warehouse locations |
| Sodium chloride 0.9% infusion, 500 mL | Bag | Different inventory unit and packaging presentation |

The first interface should show **product, strength/form, SKU, batch, expiry, location, available quantity, held quantity and source**. Registration and detailed packaging belong in the detail panel when the table would otherwise become too wide.

## Acceptance scenario with known totals

The implemented seed contains one labelled fictional scenario around one product and one affected batch. All quantities below are **boxes of the same product**. Domain and API checks verify these fixture expectations.

| Step | Recorded result |
| --- | --- |
| Receive at Central | 1,000 boxes |
| Transfer Central → North, receipt confirmed | Central 800; North 200; enterprise total remains 1,000 |
| Dispatch from Central | Customer A 250, B 150, C 100 |
| Dispatch from North | Customer D 100 |
| Before returns | 600 dispatched; Central 300 + North 100 = 400 recorded on hand |
| Open recall and record hold | 400 on-hand boxes held; four affected customer sites |
| Record partial returns | A 50 + B 30 + D 20 = 100 returned; 500 dispatched boxes still unreconciled |
| Complete the return scenario | A further 500 returned; total returns 600; held original stock 400; all 1,000 boxes accounted for |

At the partial stage, recorded enterprise stock is 500 boxes: 400 original on-hand plus 100 returned. The original 600 dispatched boxes are a historical exposure measure, not an additional on-hand quantity. Never add exposure and stock together as if they were disjoint stock balances.

Case accounting completion is distinct from disposition approval and formal closure. The scenario should include an explicit operator decision and evidence for each step. Do not invent destruction, customer acknowledgements or official authorisation to make a progress bar reach 100%.

Add a second product with the same printed batch code and confirm it remains outside this case. Add an import with a mistyped batch identifier and show that review is necessary before it affects confirmed accounting. These checks make the demonstration credible without real industrial records.

## Build sequence

| Milestone | Deliverable | Acceptance gate |
| --- | --- | --- |
| 0 · Restored baseline | Existing app running locally, current source and checks preserved | Completed as recorded above |
| 1 · Pharma foundation | Versioned products/batches, expiry handling, movement ledger, warehouse and stock tables; first fixture | Receipts, transfers and dispatches balance; duplicate batch codes cannot cross products; legacy stored records remain intact and separate from the pharmaceutical model |
| 2 · Complete recall workflow | Cases, holds, affected recipients, returns, reconciliation and fixed report | The known-total scenario and partial-return scenario pass in domain, API and browser checks |
| 3 · Document intelligence | Pharma extraction schema, evidence-linked review, deduplication, provider controls and import recovery | Approved imports produce the expected movements; malformed/ambiguous proposals do not silently change stock |
| 4 · Product hardening | Team access, exports, audit history, recovery, accessibility and measured scale | Isolation, roles, backup restore and representative browser journeys pass with recorded evidence |
| 5 · Presentation and release | Coded animated walkthrough, separate native vector deck/PDF, documentation and deployment matching the built scope | Every showcased feature is usable, each authored scenario is identified and every factual claim maps to evidence |
| Later · Integrations | Barcode, serialisation, EPCIS, ERP and temperature data | Add independently after the core workflow is stable and supported format/scope is explicit |

**Current sequence:** milestones 1–4 are implemented with bounded integration profiles, 143 passing unit checks, both API suites and the observed browser journeys. Build and release scan passed; application version 3 is live. The native vector pitch/PDF and documentation are updated. Milestone 5 is complete: the 4:11 coded video passed the frame, narration, caption and full-decode checks recorded in release evidence. Native vendor ERP adapters remain a future scoped integration.

## Visual decision

Keep the current restrained visual style and night mode. Add a clear product identity, readable tables, a compact stock movement graph, an expiry timeline and an evidence-linked reconciliation breakdown. Animate only selection and state transitions. One restrained illustration could help a future landing page, but generated luxury imagery has lower priority than a working recall workflow and is unnecessary for this build.

Presentation media has its own motion design. The video uses coded product layouts and animated trace paths, reviews and quantities; the separate pitch uses editable text and vectors. Product fonts stay unchanged. Editorial media headings can use a restrained contrasting typeface, and no webpage screenshot supplies the video or pitch layout.

## How this could improve the competition entry

- **Specific problem:** a judge can understand who uses it and what they must accomplish.
- **Visible AI contribution:** documents become proposed structured records with inspectable evidence.
- **Technical depth:** identity, quantities, dates, concurrent writes and reconciliation require substantive engineering.
- **A complete demonstration:** the story reaches an evidence-backed accounting outcome instead of ending at a dashboard.
- **Trustworthy claims:** software checks, measured fixture results and an honest scope are easy to defend during questions.

These are reasons the entry could become stronger. Neither a pharmaceutical theme nor a longer feature list guarantees first prize; the value comes from executing the selected workflow well.
