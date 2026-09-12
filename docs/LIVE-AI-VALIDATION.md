# Live AI validation

Date: 12 September 2026

Provider: Fireworks

Model: `accounts/fireworks/models/kimi-k2p6`

**These are limited software QA checks using entirely synthetic records.** They establish observed outcomes on the named fixtures, not general OCR accuracy, speed, customer validation or suitability for operational recalls. Credentials are not included.

## Observed runs

| Check | Observed result |
|---|---|
| Fireworks connection | Authentication succeeded. |
| Text fixture | A real request returned three correct records, including a dispatch of 180 packs. |
| [Single-page PDF](../sample-records/ai-extraction-fixture.pdf) | The actual browser workflow rendered the page, sent it to Fireworks, returned three correct proposals and required review before import. Reviewed result: **180 confirmed packs, 0 unresolved**. Saved report: **RS-FC609B48**. Expected fields are in [expected-ground-truth.md](../sample-records/expected-ground-truth.md). |
| [Two-page PDF](../sample-records/synthetic-two-page-lot-code.pdf), successful retry | Returned three records and preserved the raw production lot code **FW-FL-O1**, including the letter O. After initial reviewed import: **0 confirmed packs, 180 unresolved** for receipt lot FW-FL-01. |
| Two-page operator correction | The operator explicitly assigned the production relationship to FW-FL-01 and recorded the synthetic ground-truth basis. Result: **180 confirmed packs, 0 unresolved, 1 batch, 1 customer**. Saved report: **RS-ED686CD1**, workspace revision **9**. The original source retained FW-FL-O1. |
| Persistence | Reload preserved the correction and saved report. The [persisted synthetic report](SYNTHETIC-LIVE-REPORT.md) contains the reviewed outcome. |
| Source retrieval | The retrieved original PDF hash matched the shipped fixture. Both JPEG page endpoints returned HTTP 200 with matching stored hashes. A request for nonexistent page 3 returned HTTP 404. |
| Seven-page PDF | The browser rejected it at the six-page limit before extraction submission. |
| Password-protected PDF | The browser rejected it before extraction submission. |

The two-page [fixture ground truth](../sample-records/fireworks-ground-truth.md) authorizes the intended relationship solely for this QA exercise. The PDF alone does **not** prove that FW-FL-O1 and FW-FL-01 identify the same lot. The successful correction tests an explicit, documented human decision, not an AI inference of lot equivalence.

An earlier two-page request reached the application's 90-second timeout and added no saved records. The development request now sets `reasoning_effort: "none"`, and a later retry succeeded. This sequence is not a latency benchmark or proof that the configuration change alone caused the success. Future requests may still time out or fail.

The report artifact was exported directly from persisted application data. Report contents and source-download endpoints were verified. The browser's **Download report** click did not produce a captured file-save event, so a successful browser report download is not claimed.

## Input and evidence handling

Fireworks receives text directly or images for visual inputs. For a PDF, RecallScope renders each page in the browser and sends the page images in order. The application limits this path to six pages and checks the original PDF page count against the submitted image count on the server. It rejects the whole unsupported document instead of selecting or silently skipping pages.

The application retains the original PDF, the supplied AI page images, the transcript, provider/model identity and SHA-256 fingerprints. A fingerprint establishes the identity of stored bytes. It does **not** establish that an image faithfully represents its source PDF, that all text is legible, or that the extracted fields are correct. Reviewers must compare the original, rendered images and proposals. The page-count check alone cannot establish visual correspondence.

Proposals stay outside the trace graph until the operator approves them. The reviewed relationships drive deterministic trace calculations. Source text stays separate from corrected relationships and decision notes. A saved report records a fixed scope snapshot rather than a live view of later edits.

## Remaining validation

- Live OpenAI extraction is untested. The OpenAI provider remains configurable alongside Fireworks.
- The Fireworks checks used small, deliberately authored fixtures. Handwriting, poor scans, complex layouts and larger supported documents need separate tests.
- No manufacturer records, customer interviews, field pilots, accuracy percentages, cost benchmarks or time-saving measurements support this report.
- Public deployment, a judge-accessible application URL, GitHub push and the final 3-5-minute video remain pending. A prepared [demo script](DEMO-SCRIPT.md) is not a recorded video.
- Repeat the chosen demo on the eventual deployed app and preserve actual outputs and failures. Do not generalize fixture success into a claim of production readiness.

## Official implementation references

These references describe API capabilities, not evidence that RecallScope passed its tests.

- Fireworks documents image inputs and conversion of PDF pages to images in [Vision Models](https://docs.fireworks.ai/guides/querying-vision-language-models).
- [Structured Outputs](https://docs.fireworks.ai/structured-responses/structured-response-formatting) describes JSON-schema response formatting. Conforming to a schema does not establish factual correctness.
- The [Chat Completions API reference](https://docs.fireworks.ai/api-reference/post-chatcompletions) documents request and response fields, including structured output and reasoning settings.
- The [Kimi K2.6 model page](https://fireworks.ai/models/fireworks/kimi-k2p6) identifies the model path and image-input support.
