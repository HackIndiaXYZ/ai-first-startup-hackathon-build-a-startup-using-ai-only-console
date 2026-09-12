# Validation record
Date: 12 September 2026

## Automated checks

- 40 domain, import and provider tests: expected synthetic totals; immutable original sources; missing source protection; unknown quantities; duplicate dispatches; alternate-lot isolation; dangling links; unresolved report recipients; snapshots; reassignment history; quantity conservation; CSV quoting; strict identifiers; evidence quotes; mixed-data disclosure; supplier identity; unknown batch placeholders; reviewed delivery references; provider selection/secret omission; truncated/malformed AI responses; PDF page limits, ordering, original-page-count checks, image budgets and provenance in reports.
- TypeScript type check passed.
- Production Worker/client build passed.
- HTTP integration flow passed against both the development server on port 5173 and the built production Worker preview on port 8787: separate sessions, required request origin, stale-write rejection, report snapshots, pending extraction, explicit import review, original file recovery, duplicate-source rejection, unsupported files, missing AI configuration, and cross-session draft/file isolation.

Automated adapter tests use controlled responses and make no paid API calls. Separate real Fireworks requests and browser review are documented in [LIVE-AI-VALIDATION.md](LIVE-AI-VALIDATION.md). These small synthetic checks do not establish general OCR accuracy or real manufacturer performance. OpenAI remains live-untested.

## Browser checks

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
10. Reset restores the initial demonstration.

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

## What still needs real-world evidence

- Broader PDF/image extraction testing against difficult real document layouts, beyond the labelled synthetic fixtures.
- At least one permissioned manufacturer's source set and operator review.
- Extraction completeness, identifier accuracy and review workload measurements.
- Manual-versus-assisted timing using the same inputs and outcome criteria.
- Deployed-app access, retention, cost controls and judge access.

Production operational use is outside this prototype's validated scope.
