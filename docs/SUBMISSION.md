# RecallScope · Team Console

Track: **AI in any startup**

RecallScope is an evidence-led pharmaceutical distribution workspace. It helps operations and quality teams follow product batches from supplier receipt through warehouses and customer deliveries, then account for returns and recall decisions. Every reported quantity connects to recorded movements and source evidence.

## Project links

| Material | Link |
| --- | --- |
| Live application | [Open RecallScope](https://recallscope.console3096.chatgpt.site) |
| Source repository | [Official Team Console repository](https://github.com/HackIndiaXYZ/ai-first-startup-hackathon-build-a-startup-using-ai-only-console) |
| Pharmaceutical walkthrough | Video on hold at the owner's request; [written walkthrough](DEMO-SCRIPT.md) available |
| Pitch | [Editable pharmaceutical pitch](RecallScope-Pharma-Pitch.pptx) |
| AI usage report | [Tools, prompts and development evidence](AI-USAGE.md) |
| Market research | [Official-source alternatives and commercial hypothesis](PHARMA-ALTERNATIVES.md) |
| Verification | [Software and browser evidence](PHARMA-VALIDATION.md) |
| Release | [Publication and feature scope](BUILD-STATUS.md) |

## Problem statement

A distributor's recall evidence can be spread across supplier notices, goods receipts, stock movements, dispatch notes and return records. Staff must connect the correct product and batch to its recorded locations and recipients, then explain what has been returned and what remains outstanding. Similar batch codes, packaging conversions and partial returns make an informal spreadsheet reconciliation easy to misread.

RecallScope brings those records into one reviewed workflow. Optional AI extracts proposed fields from documents; deterministic checks enforce identities and accounting, while operators approve records and retain the evidence behind their decisions.

## Judge walkthrough — no API key required

1. Open the live app. The complete fictional case has **1,000 boxes received, 600 historically dispatched, 600 returned, 1,000 recorded in quarantine and zero outstanding**. Historical exposure and current stock are distinct measures.
2. Trace paracetamol batch **PCR-260901** through two locations and four customers. The amoxicillin batch with the same printed code remains separate.
3. Open **Import document → Guided examples → Goods received**. Inspect the source and the proposed 40-box receipt. The notice clearly states that no AI request is made.
4. Record a review note and approve. Available batch **PCR-261001** moves from **400 to 440 boxes**. Repeat posting is blocked.
5. Inspect fixed reports, their comparison and PDF/evidence exports; explore night mode, serial custody and package relationships.
6. The optional active-recall scenario starts with **100 returned and 500 outstanding boxes**. Its guided 20-box partial return produces **120 returned and 480 outstanding** after review.

The supplied organisations and transactions are fictional. Live Fireworks/OpenAI extraction is a separate optional path; keys remain on the server. No judge needs to provide a credential to complete the guided workflow.

## Why this entry is distinctive

The product has a specific operator, a complete end-to-end task and inspectable source evidence. Technical depth lies in product-scoped batch identity, unit conservation, serial custody, stale-write protection and reconciliation that keeps historical shipments separate from stock. AI contributes to development and optional document interpretation without silently changing records. These qualities make the product demonstrable and defensible; they do not guarantee a prize.

## Submission administration

The current materials target the [official event requirements](https://hackindia.org/2026/ai-first-startup-hackathon-build-a-startup-using-ai-only): public code, a live product, pitch, 3–5-minute video and documented AI use. The event page was rechecked on 3 October 2026 before updating the release. The pharmaceutical video is on hold; the September video depicts the earlier bakery edition. Submission through the organizer's portal is a separate action; this file does not assert a new submission receipt.

[September submission record](SUBMISSION-2026-09.md) is retained as historical context.
