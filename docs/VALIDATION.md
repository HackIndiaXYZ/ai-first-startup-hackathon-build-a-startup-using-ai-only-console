# Validation record
Date: 12 September 2026

## Automated checks

- 45 domain, import and provider tests: complete-sample source coverage and totals, independent regression fixtures, report presentation, saved-report comparison, chained delivery/ingredient decision preservation; immutable original sources; missing source protection; unknown quantities; duplicate dispatches; alternate-lot isolation; dangling links; snapshots; reassignment history; quantity conservation; CSV quoting; strict identifiers; evidence quotes; mixed-data disclosure; supplier identity; reviewed delivery references; provider selection/secret omission; malformed AI responses; PDF page validation and provenance in reports.
- TypeScript type check passed.
- Production Worker/client build passed.
- HTTP integration flow passed against both the development server on port 5173 and the built production Worker preview on port 8787: separate sessions, required request origin, stale-write rejection, report snapshots, pending extraction, explicit import review, original file recovery, duplicate-source rejection, unsupported files, missing AI configuration, and cross-session draft/file isolation.

Automated adapter tests use controlled responses and make no paid API calls. Separate real Fireworks requests and browser review are documented in [LIVE-AI-VALIDATION.md](LIVE-AI-VALIDATION.md). These small synthetic checks do not establish general OCR accuracy or real manufacturer performance. OpenAI remains live-untested.

## Complete showcase release

The default for new sessions and the confirmed Load sample action is a separate complete fictional bakery dataset. Lot A has 1,440 delivered packs, four batches, four destinations and 96 kg recorded ingredient use; lot B has 360 packs, one batch, one destination and 24 kg use. The workspace contains seven source documents. All links have source evidence and no operator decisions are invented. Removing production-04's evidence in a regression test returns its 360 packs to unresolved exposure.

All 45 automated tests, the type check, production build and development API integration passed after this change. API checks verify that existing reviewed and imported sessions survive GET unchanged; new sessions and sample resets get the complete example. Browser interaction verified the complete totals, the production-04 source at line 4, report creation and saved content. The complete interface shows customer destinations and connected records without a review queue or zero-unresolved counters. Actual imported uncertainty still follows the domain's evidence rules. The pitch and main walkthrough use the new complete sample.

## Historical browser checks

Verified by actual UI interaction:

1. Initial sample scope: 720 confirmed packs, 720 unresolved, two customers.
2. Open ambiguous CK-0904-01 source; confirm with a review note.
3. Result changes to 1,080 confirmed packs, 360 unresolved, three customers.
4. A saved report appears with those counts.
5. Reload preserves the reviewed result.
6. Upload the synthetic CSV through the file chooser, inspect three proposals, and approve.
7. Imported DEMO-FL-01 traces to 180 packs.
8. Mixed demo/custom uploads keep a sample-data disclosure.
9. Desktop and mobile layouts checked. At 390px viewport, the document itself does not overflow horizontally; the trace diagram and wide tables intentionally scroll within their panels.
10. At that development stage, reset restored the original review demonstration. The complete showcase release above supersedes that default.

Dialog focus management, explicit button labels, visible focus styles and reduced-motion support are implemented. No independent accessibility certification is claimed.

## Interface refinement checks

- Light and night appearance verified; the selected theme and compact density survived reload. A workspace-name edit survived reload without changing source data.
- System appearance followed emulated light and dark device settings. The emulation was cleared after verification.
- Desktop and 390 CSS-pixel layouts checked. At 390 pixels the page did not overflow horizontally; the trace map remains an intentionally scrollable region. Mobile navigation has text labels.
- Search found a production batch on another lot and changed both selected lot and inspected batch correctly. Search focuses its input, opens with Ctrl K, and closes with Escape.
- Combined document search/category filtering produced an explicit empty result; Clear filters restored the full list.
- Review filtering showed the unmatched-ingredient item. Confirmation remained disabled with a note but no selected lot. Selecting the supported sample lot and confirming changed 720 confirmed / 720 unresolved packs to 1,080 / 360. The original O code stayed visible.
- Source/document intake and the report reader were checked in the refreshed interface. Provider consent remains visible before extraction. No additional paid AI requests were needed for this UI-only change.
- All 40 existing domain/provider tests, the type check, production build and HTTP integration suite passed after the interface changes.

## Championship-readiness refinement checks

- All 42 domain/provider tests, type checking and the production build passed after the final changes. The HTTP integration suite passed again against the local development server; the earlier production-preview run is recorded above and was not repeated for this refinement.
- New regression coverage verifies that delivery-review evidence remains in both unresolved and subsequently confirmed reports, preserving raw source codes and unchanged 1,080/360 sample totals.
- Report comparison checks use the nearest earlier revision of the same exact lot, ignore a different lot, preserve snapshot data, and correctly identify added/removed customers and positive/negative quantity changes.
- Browser verification created two fixed sample reports, displayed the unchanged 1,080/360 comparison, opened the earlier report and showed the first-snapshot explanation. The 390 CSS-pixel comparison had no page overflow and stacked its two quantities vertically.
- Selecting CK-0904-01 highlighted that batch, its Harbor Grocer delivery and one corresponding edge group. At 390 CSS pixels the page did not overflow. Emulated reduced motion disabled both edge and inspector animations. Light-mode path contrast was visually reviewed; the workspace was returned to night mode and browser emulation cleared.
- The document reader now has an elapsed timer, stage message, slow-response guidance and a 110-second browser request deadline. These controls passed type/build review; no additional paid live extraction or full 110-second browser timeout run was performed for this change. The pre-existing real provider timeout and sanitized error evidence remain in LIVE-AI-VALIDATION.md.
- Reset/clear errors now render inside their confirmation dialog. Existing review dialogs already did so.
- The 14-page readiness PDF was rendered and visually checked; all 76 checklist identifiers are present. Its status labels deliberately retain incomplete real-world, deployment and accessibility checks.

## What still needs real-world evidence

- Broader PDF/image extraction testing against difficult real document layouts, beyond the labelled synthetic fixtures.
- At least one permissioned manufacturer's source set and operator review.
- Extraction completeness, identifier accuracy and review workload measurements.
- Manual-versus-assisted timing using the same inputs and outcome criteria.
- Deployed-app access, retention, cost controls and judge access.

Production operational use is outside this prototype's validated scope.

## GitHub release verification

Before the first source publication on 12 September 2026, all 42 domain/provider checks, type checking, production build and local API integration passed again. The full reachable Git history was scanned for the configured private API keys and recognized private-key/token patterns; none were found. The source package excludes private environment files and local workspace state. GitHub Actions is configured to install, test, build and typecheck from a clean Linux checkout; its live badge is in the README. The pitch deck's pending-publication text was updated, preserving its eight slides and native tables, and the final render was inspected.
