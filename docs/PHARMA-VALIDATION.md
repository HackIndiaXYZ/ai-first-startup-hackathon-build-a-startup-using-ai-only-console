# Pharmaceutical edition: verification record

Work dates: **3–4 October 2026**. All pharmaceutical examples are fictional. These checks evaluate software behavior, not industrial use, medicine safety or regulatory certification.

## Reproducible scenarios

| Scenario | Expected result |
| --- | --- |
| Fresh guest workspace | Six products and nine product-specific batches; the serialized batch contains eight units grouped in a three-package hierarchy |
| Complete default case | 1,000 boxes received; 600 historically dispatched to four customers; 600 returned; 1,000 recorded in quarantine; zero outstanding |
| Active recall | 600 historically dispatched; 100 returned; 500 current on-hand, including 400 originally held and 100 returns; 500 outstanding |
| Guided receipt | Available paracetamol batch PCR-261001 increases from 400 to 440 boxes after reviewed receipt; preview alone leaves stock unchanged |
| Guided partial return in active case | 20 boxes linked to DSP-001; returns become 120; outstanding becomes 480; returns stay quarantined |
| Separate browser-created recall | Guided receipt increases PCR-261001 from 400 to 440 boxes; dispatch/delivery of 10 followed by a scoped recall and return of 10 produces a saved report with 10 shipped, 10 returned, 440 in quarantine and zero outstanding |
| Duplicate printed code | AMX-500-100 / PCR-260901 remains separate from PAR-500-100 / PCR-260901 |
| Snapshot integrity | The partial recall report remains unchanged when later returns complete the case |
| Public route policy | The pharmaceutical workspace is the sole public product interface; the former `/bakery` URL redirects to `/` and Settings has no earlier-edition link |

The original 600 dispatched boxes measure historical exposure. They must not be added to the 1,000 on-hand boxes in the completed case.

## Recorded checks

| Check | Evidence/status |
| --- | --- |
| Intake + interoperability unit tests | **20 passed** using `node --import tsx --test tests/pharma-intake.test.ts tests/pharma-interop.test.ts`; includes a real core-domain guided receipt against the complete seed |
| Full API integration | **Passed:** `npm run test:api` against `http://localhost:5173` runs both retained bakery and pharmaceutical suites. Pharma checks cover independent sessions, source isolation, origin rejection, preview without posting, reviewed +40 receipt, replay/duplicate protection, stale writes, report exports, immutable snapshots, backup restore, active partial return and local account claim/protection. No live AI call |
| EPCIS normative JSON-schema check | The earlier supported-profile active fixture had **17 events accepted**, with **2 internal status events explicitly excluded**. Checked against GS1 EPCIS **2.0.1** `epcis-json-schema.json` using Ajv and ajv-formats, including URI and date-time formats; this is a fixture-specific schema check |
| Store, access, health and retention tests | **25 passed** against production route/query code with an in-memory SQLite D1 adapter and scoped object-store stub. Includes concurrent save, rollback, permission races, claim/accept replay, role audit accuracy, bounded cleanup, protected evidence, unconfirmed object-deletion outcomes, live-date projection and reserved storage-field rejection |
| PDF/CSV/ZIP export tests | **6 passed**. PDF loaded and text streams inspected; ZIP independently decoded with fflate, UTF-8 entries and CRC known vector; snapshot names and spreadsheet formula escaping retained |
| History collision regressions | **3 passed**: reset/restore keeps historical evidence on its original source, identical history is reused, and conflicting source/decision identities remain distinct |
| Whole-project unit suite | **143/143 passed** in the final integrated `npm test` run, including retained functionality and the pharmaceutical domain, intake, interoperability, corpus, storage, exports and history checks |
| Type checking | `npm run typecheck` **passed**, including the final reserved storage-field and date-projection changes |
| Production build | **Passed:** final integrated `npm run build`, then the successful release build including the PDF pagination adjustment. Sites confirmed version 2 deployed successfully at 2026-10-03 16:36 UTC |
| Browser journeys | **Passed:** the complete receipt → dispatch/delivery → selected-batch recall → return → saved-report journey, report comparison, serialized dossier, mobile layout, keyboard dialog behavior and light/night themes; details below |
| Secret inspection | **Zero findings:** candidate Git files, Office archive contents and production browser output checked for credential patterns and actual configured local secrets. The bounded scan is recorded in `product/verification/release-secret-scan.json`; [rotation procedure](SECRET-HANDLING.md) documented |
| Paid pharmaceutical extraction | No paid pharmaceutical provider call made during this work. Both provider adapters were exercised with controlled responses |
| Industrial tests or outreach | Outside the requested scope; none performed |

## What the tests cover

The intake fixtures cover quoted CSV fields/newlines, explicit column mapping, duplicate headers/rows, row limits, missing facts, ambiguous or impossible dates, month precision, source-preserving quantities, product-specific identifiers and exact evidence quotes. A same-looking O/0 batch is not automatically linked. Provider mocks exercise strict output shape, unsupported output, truncation, refusal, authentication/credit errors, timeout sanitisation and no-key behavior.

The domain suite covers quantity conservation, product-specific conversions, held/expired stock, transfer receipt, in-transit holds, reservation dispatch, partial returns, stale customer-held statements, evidence-backed closure, stocktakes/reversals, FEFO, serial custody/package grouping, report snapshots and validated restore. Live workspaces use the current UTC operational date; sample scenarios retain their reference clock and saved reports retain their captured date. An operator action cannot silently turn a temperature observation into a safety decision.

Persistence rejects the reserved `$recordBlob` field anywhere in supplied workspace data, including restored metadata and nested report sources. Stored references must be exact, single-field envelopes containing a UUID JSON key within the same workspace; loaded record identity must match the database row. Regression checks confirm malformed references trigger no object-store read and that failed imports leave saved data unchanged.

The API checks use separate guest sessions and fictitious data, not the user's interactive workspace. The local sign-in shim provides an integration check; production identity is supplied by the hosting authentication system.

The legacy API suite protects preserved historical records; it does not expose a second product interface. The former page implementation remains in Git history. Source inspection of the active pharmaceutical seed and guided templates found no wheat, flour, bakery or other food-production records; catalogue ingredients are medicine active-ingredient metadata.

The persisted document corpus contains ten CSV cases, six PDFs and a corresponding scanned PNG. `product/verification/pharma-evaluation.json` records 187 deterministic field checks across 11 rows, hashes of 17 fixture files, and separate controlled-provider results. Rotated/image-only PDF fixtures have authored expected answers; this does not establish live OCR/model accuracy.

`product/verification/pharma-benchmark.json` records one warmup and seven timed runs per synthetic workload on Node 24.14.0, Windows x64, Intel i5-11400H. The 10,000-movement mixed-distribution fixture has 2,500 shipments: median validation 75.955 ms, trace 5.724 ms and reconciliation 6.079 ms. These are in-process observations excluding database, network, UI rendering and fixture construction, not industrial throughput promises.

See [Data retention and recovery](DATA-RETENTION.md) for the precise backup and deletion behavior. No automatic purge is enabled; expired preview cleanup preserves original files, posted sources and report evidence.

## Observed browser results

The browser checks used the local pharmaceutical application and fictional records. The selected-batch journey below is separate from the seeded 1,000-box completed case.

| Journey | Observed result |
| --- | --- |
| Guided receipt | The proposed receipt displayed its source and no-AI notice; explicit approval increased the unaffected batch from 400 to 440 boxes |
| Dispatch and recall | Ten boxes were dispatched and marked delivered; a new case was opened for that selected batch, and the ten boxes were returned |
| Saved report | The resulting report showed 10 shipped, 10 returned, 440 in quarantine and zero outstanding; historical shipment totals remained separate from on-hand quantities |
| Earlier/current comparison | The earlier snapshot remained 600 shipped / 100 returned / 500 outstanding; comparison with the completed snapshot showed 600 / 600 / 0 |
| Report rendering | Exported PDFs rendered as two A4 pages for visual inspection |
| Serial dossier | The ninth batch showed eight individually tracked units and three packages in the recorded hierarchy |
| Responsive layout | The 390-pixel mobile viewport had no horizontal page overflow |
| Keyboard | Dialog focus wrapped within the open dialog; Escape closed it and restored focus |
| Appearance | Light and night themes were inspected with the pharmaceutical views |

These are observed browser checks, not a claim of exhaustive accessibility conformance or industrial acceptance. Public deployment and matched presentation assets are tracked separately from local software verification.

## Interoperability scope

**GS1 decoding:** scanner strings with supported symbology prefixes and GS separators, or readable application-identifier notation. The supported AIs are 01 (GTIN), 10 (batch), 17 (expiry) and 21 (serial). GTIN check digits, identifier length, duplicate AIs and calendar dates are validated. Batch/serial characters are an explicit conservative subset. Two-digit expiry years remain unresolved without an explicit century choice. The UI can use an optional camera only when the browser provides BarcodeDetector; typed/scanner input remains available. GS1 identifier allocation, authenticity verification and regulatory verification are not implied.

**EPCIS:** a declared EPCIS 2.0 ObjectEvent/OBSERVE/count profile with receiving/shipping observations. Non-empty quantity entries use positive integer counts; workspace-scoped identifiers preserve their class identity. Internal adjustments/status changes and unsupported fractional counts are listed as exclusions. The import is a validated preview requiring explicit mapping, not an automatic stock import or a complete EPCIS repository. It rejects unsupported event kinds, fields, remote contexts and duplicate event IDs rather than silently discarding them. [GS1 normative artefacts](https://ref.gs1.org/standards/epcis/artefacts)

**Temperature:** CSV preserves source rows and timestamps, uses explicit Celsius values and matches exact product/batch/location identities. Comparison uses only configured product limits. Missing limits remain “no policy”; exceptions require review.

**ERP preparation:** the implemented first phase provides documented CSV fields, explicit column mapping, validated previews and reviewed/idempotent posting, plus the declared EPCIS export/preview profile. Native vendor ERP authentication, synchronization and unattended retries remain a future scoped integration; no connected ERP is claimed.

## 4 October interface follow-up

- All 143 unit tests passed again; TypeScript checking and the production Site build passed.
- The profile remained fully visible at 1536 × 730, 1280 × 600 and 1280 × 480 CSS-pixel viewports, with approximately 19 pixels of space below it. At the shortest height, navigation scrolled independently and Settings remained reachable.
- The long recall-closure reason wrapped within the audit Reason column without touching Time or Inspect. Dates and quantities retained their readable formatting.
- All eight workspace views were checked at 390 × 844 and 1280 × 600. No view introduced page-level horizontal overflow. Mobile tables retained their own horizontal scrolling; minimum column widths kept product names readable.
- Light and night layouts were inspected. Navigation focus uses an inset outline so its scroll container does not clip the indicator. No browser warnings or errors were captured during this pass.
- Direct navigation to `/bakery` returned to `/` and displayed the pharmaceutical overview. Settings exposed no earlier-edition link. The active catalogue contained six pharmaceutical products; source inspection found no food-production examples in the active seed or guided templates.

Viewport checks exercise the page layout; they do not automate the Windows taskbar or operating-system display scaling. No industrial trial or video production was performed.

Current project materials contain the pharmaceutical pitch, screenshots and fixture corpus. Superseded presentation assets and their documentation are recoverable from Git history. Provider verification for this edition uses controlled responses; no live pharmaceutical extraction accuracy result is claimed.

## Re-run

From `product/`:

```sh
npm test
npm run typecheck
npm run build
npm run test:api
```

For the API checks, keep the local server running and set `TEST_BASE_URL` only when its printed URL differs from the script default. These automated checks do not send a paid AI request.
