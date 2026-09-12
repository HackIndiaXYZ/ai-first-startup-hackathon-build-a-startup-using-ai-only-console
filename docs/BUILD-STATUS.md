# Build record · RecallScope

12 September 2026 · Team Console · AI in any startup

## Current deliverable

The current deliverable is a complete fictional bakery showcase with a working trace workspace, document library, intake review and saved reports. A real manufacturer trial is not required for this showcase release.

The supplied workspace contains seven source documents. Ingredient lot **FL-260901-A** connects to **four production batches, four customer destinations and 1,440 confirmed delivered packs**, with **zero unresolved deliveries**. The records are authored sample data, not actual manufacturer transactions or a live AI extraction result.

## Included capabilities

- Interactive ingredient-to-production-to-delivery tracing with coordinated selection and inspectable source records.
- A document library with search and category filters; CSV and AI-assisted intake with explicit review before import.
- Server-side workspace persistence and original-file storage, with source fingerprints and preserved review decisions.
- Fixed report snapshots, an in-app reader and comparisons between reports for the same lot.
- Light, night and system appearance; device-local names, density settings, workspace search and responsive layouts.
- Handling for ambiguous identifiers, unknown references and quantity conflicts when additional records require it.
- Fireworks text/PDF extraction and a configurable OpenAI adapter.
- Source code, labelled sample files, an editable pitch, showcase script, AI usage report and verification records.

## Verification evidence

The [validation record](VALIDATION.md) is the source for automated checks, type checking, production builds, API integration and observed browser behavior. It distinguishes checks on the current showcase from earlier development scenarios; this document does not substitute a new test claim for that record.

The [live AI record](LIVE-AI-VALIDATION.md) documents actual Fireworks requests on separate synthetic fixtures. A single-page PDF produced three proposed records and, after review, 180 confirmed packs with no unresolved deliveries. A separate two-page fixture preserved an O/0 discrepancy and exercised an explicit, evidence-noted correction. Those historical fixture results remain unchanged by the new complete showcase. OpenAI support is implemented and remains live-untested.

## Release record

The owner authorized publication to the [official Team Console repository](https://github.com/HackIndiaXYZ/ai-first-startup-hackathon-build-a-startup-using-ai-only-console), with the original Git history and MIT license preserved. The latest showcase changes form the source release described here; the remote commit identifies the published revision.

**Public app:** [RecallScope](https://recallscope.console3096.chatgpt.site). Sites reported a successful production deployment on 12 September 2026 with public access, database migrations, document storage and the Fireworks secret configured server-side. The deployed app source revision is `407ebed933c0047b2842b1cc5830e4d93019220c`, extracted from the official repository's application directory. Deployment metadata and keys are managed by the hosting service.

The repository also contains the [four-minute recording script](DEMO-SCRIPT.md). The participant explicitly deferred video production; no finished video or organizer submission receipt is claimed. The public app, GitHub repository, pitch and AI usage report are the completed submission materials.

Earlier checklist documents and PDFs are dated development audits. Their old incomplete sample totals, pilot requests and authorization boundaries do not define the current fictional showcase. The current user request does not require manufacturer outreach or a real-world trial.

## Technical scope

RecallScope supports practice recall drills in a single-operator workspace and one ingredient lot per production batch. Deterministic code calculates recorded quantities; AI proposes fields for review. Source values remain separate from operator corrections. A sample-data disclosure remains when fictional and custom records are mixed.

The application does not send operational recall notices, certify food safety or establish physical stock. It uses bounded workspace snapshots, with browser-session identity rather than multi-user team accounts. Sessions expire after seven days. The public app allows 30 AI requests per UTC day, enforced atomically across all visitors before sending requests to a provider. Operational retention/deletion and shared-user access are outside this showcase's scope.

## Optional future research

If the product is taken beyond this fictional showcase, a permissioned operator study could evaluate document variety, extraction completeness, review effort, usability and willingness to pay. The [alternative comparison and pilot protocol](PILOT-AND-ALTERNATIVES.md) is research preparation, not a release requirement or evidence of a completed trial. Pricing and customer benefit remain hypotheses; no customer adoption, savings or general accuracy claims are made.

The [official event page](https://hackindia.org/2026/ai-first-startup-hackathon-build-a-startup-using-ai-only) lists a 48–72-hour format alongside September 2–November 1 event dates. The team's permitted build interval and final submission procedure are organizer matters; this source release does not establish competition eligibility or guarantee an award.
