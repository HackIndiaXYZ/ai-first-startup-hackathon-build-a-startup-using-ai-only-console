# Build record · RecallScope pharmaceutical distribution

Released 4 October 2026 · Team Console

RecallScope now focuses on pharmaceutical distributors and wholesalers. Its public workflow follows product batches through receiving, warehouse stock, dispatches, returns, recall reconciliation and fixed evidence reports. The former `/bakery` route redirects to `/`, and Settings no longer offers an earlier-edition switch. Legacy records and their schema remain preserved separately; the earlier interface is retained in Git history.

## Published application

[Open RecallScope](https://recallscope.console3096.chatgpt.site)

Sites confirmed successful public deployment on **3 October 2026 at 17:08 UTC / 4 October at 01:08 MYT**. Application source revision: `9e031f7aea1594d6ca59b8c634a3365d5a89551a`. Saved version: **3**. Existing public access was preserved.

This update keeps the profile inside short desktop viewports, scrolls navigation independently, wraps audit reasons within their column and preserves readable table widths on mobile. The pharmaceutical workspace is now the only public product interface.

## What works without a provider key

Guided examples offer pre-filled receipt, dispatch, return and recall-notice records. Mapped CSV imports accept the user's structured records. Both paths preserve their sources and use the same explicit review, matching and movement rules as optional live extraction.

The notice is **“Guided example — pre-filled records; no AI request is made.”** Fireworks and OpenAI remain configurable server-side providers. A guided example is not represented as a live model result, and no key is required from a judge.

## Included scope

- Product-specific batch identities, packaging conversions, expiry precision, configurable expiry views and allocation rules.
- Receipts, reservations, transfers, delivery confirmation, partial returns, supplier returns, quarantine, stocktakes and reversals.
- Serial custody and sealed parent/child package relationships.
- Recall scope, recipient accounting, tasks, acknowledgements, notice drafts and evidenced closure.
- Source-linked intake, corrections, immutable reports, PDF/CSV/JSON and evidence ZIP exports.
- Night/light/system appearance, mobile layouts, keyboard dialogs, search, table sorting, paging and saved views.
- Isolated guests, hosting-backed team accounts, server-enforced roles, revision protection, backup/restore and bounded preview cleanup.
- Supported GS1 decoding, EPCIS quantity-count exchange previews, temperature CSV and human-reviewed public-notice retrieval.

[The roadmap](PHARMA-DISTRIBUTION-ROADMAP.md) records each implemented item and its scope. Native vendor ERP synchronization remains a future expansion; the current starting point is documented CSV/EPCIS exchange. All supplied organisations and transactions are fictional.

## Verification

**143 unit tests passed**, followed by both API integration suites, TypeScript checking and the production build. The final PDF pagination adjustment passed all six export checks and was included in the successful release build.

Browser verification covered receipt → dispatch/delivery → scoped recall → return → saved report; report comparison; serial/package dossiers; night mode; 390-pixel mobile layout; and keyboard focus. The two-page exported report retains receipt, dispatch, delivery and return decisions. The browser reported no captured errors or warnings in the pharmaceutical journey. The earlier route-render check predates the pharmaceutical-only redirect; legacy API regression checks remain separate from the public interface.

The release scan inspected candidate Git files, Office archive contents and the production browser bundle for token patterns and actual configured local secret values, with **zero findings**. This is a bounded release check, not a claim of exhaustive security certification.

Detailed evidence: [Pharmaceutical verification](PHARMA-VALIDATION.md), [secret handling](SECRET-HANDLING.md), [retention and recovery](DATA-RETENTION.md).

## Presentation and submission materials

The separate deliverables are the [coded pharmaceutical walkthrough](RecallScope-Pharma-Demo.mp4), [editable vector pitch](RecallScope-Pharma-Pitch.pptx) and [pitch PDF](RecallScope-Pharma-Pitch.pdf). The [narration script](DEMO-SCRIPT.md), [pitch source](media-source/pitch/README.md) and [AI usage record](AI-USAGE.md) explain how they were produced.

The eight-slide pitch uses native text, diagrams and three editable tables. All slides passed package/layout checks and were visually inspected in artifact renders and native PowerPoint PDF output. The deck contains no embedded media assets, and the PDF contains no embedded images.

The video uses code-rendered pharmaceutical product visuals and animation, with Higgsfield Grady narration. Its scenario changes and quantities follow the implemented workflow; it is not an actual screen recording, a live pharmaceutical extraction benchmark or a measurement of operator speed. The final 4:11 film passed full decoding of all 15,073 frames. Forty scene samples and sixteen encoded key frames were visually inspected; spoken cues and all 54 caption blocks were checked. Audio is normalized to −16.03 LUFS, with no voice-speed or pitch change. Detailed verification is recorded in the [machine-readable release evidence](../product/verification/pharma-release.json). The application source and deployment remain unchanged by this media update. Superseded assets remain recoverable through Git history.

The [official event page](https://hackindia.org/2026/ai-first-startup-hackathon-build-a-startup-using-ai-only) was checked on 3 October before publication. It listed the code-freeze deadline as **1 November 2026, 08:03 IST** and requested a public repository, live app, 3–5-minute demo, pitch and AI workflow documentation. Publishing assets is distinct from an organizer's entry receipt; no new portal submission is claimed.

No real industrial trial, customer adoption, revenue, medicine-safety result or certification is claimed.
