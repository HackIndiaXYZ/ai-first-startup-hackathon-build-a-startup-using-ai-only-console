# Build record · RecallScope pharmaceutical distribution

Released 4 October 2026 · Team Console

RecallScope now focuses on pharmaceutical distributors and wholesalers. Its primary workflow follows product batches through receiving, warehouse stock, dispatches, returns, recall reconciliation and fixed evidence reports. The earlier bakery edition remains separately available at `/bakery`.

## Published application

[Open RecallScope](https://recallscope.console3096.chatgpt.site)

Sites confirmed successful public deployment on **3 October 2026 at 16:36 UTC / 4 October at 00:36 MYT**. Application source revision: `97b74a6055e8b82b21a4613fc2520a88a6d632c6`. Saved version: **2**. Existing public access was preserved.

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

Browser verification covered receipt → dispatch/delivery → scoped recall → return → saved report; report comparison; serial/package dossiers; night mode; 390-pixel mobile layout; keyboard focus and the retained bakery page. The two-page exported report retains receipt, dispatch, delivery and return decisions. The browser reported no captured errors or warnings in the pharmaceutical journey.

The release scan inspected candidate Git files, Office archive contents and the production browser bundle for token patterns and actual configured local secret values, with **zero findings**. This is a bounded release check, not a claim of exhaustive security certification.

Detailed evidence: [Pharmaceutical verification](PHARMA-VALIDATION.md), [secret handling](SECRET-HANDLING.md), [retention and recovery](DATA-RETENTION.md).

## Presentation and submission materials

Use the [pharmaceutical pitch](RecallScope-Pharma-Pitch.pptx), [current demonstration script](DEMO-SCRIPT.md) and [AI usage record](AI-USAGE.md). The pharmaceutical walkthrough video is **on hold at the owner's request**. Existing narration and draft chapters are preserved locally; they are not presented as a completed current film. September bakery materials remain labelled historical evidence.

The [official event page](https://hackindia.org/2026/ai-first-startup-hackathon-build-a-startup-using-ai-only) was checked on 3 October before publication. It listed the code-freeze deadline as **1 November 2026, 08:03 IST** and requested a public repository, live app, 3–5-minute demo, pitch and AI workflow documentation. Publishing assets is distinct from an organizer's entry receipt; no new portal submission is claimed.

[September build record](BUILD-STATUS-2026-09.md) preserves the earlier release. No real industrial trial, customer adoption, revenue, medicine-safety result or certification is claimed.
