# Validation record
Date: 12 September 2026

## Automated checks

- 33 domain, import and AI-adapter tests: expected synthetic totals; immutable original sources; missing source protection; unknown quantities; duplicate dispatches; alternate-lot isolation; dangling links; unresolved report recipients; snapshots; reassignment history; quantity conservation; CSV quoting; strict identifiers; evidence quotes; mixed-data disclosure; supplier identity; unknown batch placeholders; reviewed delivery references; AI response failure handling.
- TypeScript type check passed.
- Production Worker/client build passed.
- HTTP integration flow passed against both the development server on port 5173 and the built production Worker preview on port 8787: separate sessions, required request origin, stale-write rejection, report snapshots, pending extraction, explicit import review, original file recovery, duplicate-source rejection, unsupported files, missing AI configuration, and cross-session draft/file isolation.

AI adapter tests use controlled responses. **No live OCR/extraction accuracy or latency measurement has been made.**

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

## What still needs real-world evidence

- Live PDF/image extraction against known ground truth and difficult document layouts.
- At least one permissioned manufacturer's source set and operator review.
- Extraction completeness, identifier accuracy and review workload measurements.
- Manual-versus-assisted timing using the same inputs and outcome criteria.
- Deployed-app access, retention, cost controls and judge access.

Production operational use is outside this prototype's validated scope.
