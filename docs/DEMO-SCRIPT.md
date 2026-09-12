# RecallScope showcase script

A four-minute walkthrough of the complete fictional bakery workspace. These timings guide narration and editing; they are not application performance measurements. This document is the recording script.

## 0:00–0:25 · One ingredient, a clear delivery scope

Open the supplied workspace with **FL-260901-A** selected.

“A quality lead starts with one ingredient lot and needs to follow it through production to customer deliveries.

This is RecallScope. In our fictional bakery showcase, this lot connects to four production batches and four destinations: 1,440 delivered packs, with source records explaining the route.”

Keep the sample-data label visible.

## 0:25–1:10 · Follow the trace

Show the selected lot, four production branches and customer deliveries. Select a batch, then its destination, so the corresponding path and record details are visible.

“The map connects the receiving lot, the batches that used it and the deliveries that followed. Selecting a batch brings its part of the trace into focus.

All deliveries in this supplied scenario have supported ingredient links. The totals come from the recorded quantities and relationships.”

Point to **1,440 packs, four batches and four destinations**. Do not describe these as real manufacturer transactions or results from a new AI request.

## 1:10–1:55 · Inspect the documents

Open the selected batch's source, then **Documents**. Show the receiving, production and dispatch records. The whole workspace contains **seven source documents**. Search one visible batch code and open its result.

“The evidence stays close to the trace. I can read the production record, follow its batch code into a dispatch and inspect the receiving record behind the ingredient lot.

The document library keeps the source material together. Search and categories help me reach the record I want without changing any totals.”

## 1:55–2:40 · Save the scope

Choose **Create report**, then **Open report**. Show the lot code, pack total, four batches, four destinations and source references. Reload and reopen the saved report if the capture allows.

“I save this scope as a report. It brings together the deliveries, quantities and supporting references in a snapshot I can return to.

Saved reports keep their original scope. The workspace can compare reports for the same lot as records change.”

Use the report ID from the actual recording. Do not imply a changed comparison when both snapshots contain the same data.

## 2:40–3:15 · A workspace for the operator

Show night mode, then open **Preferences** briefly to demonstrate appearance and density. Return to the trace. Use **Find in workspace** to locate a visible record or customer.

“The workspace adapts to the person using it: light, night or system appearance, comfortable or compact spacing, and names that make this workspace familiar.

Search brings lots, batches, customers and document text into reach. These choices change the view; the source records stay intact.”

## 3:15–3:45 · From documents to records

Open **Add records** and show the CSV and AI intake choices. If showing AI, let the selected provider name and consent text remain readable.

“New records can come from CSV or AI-assisted document reading. AI proposes the fields; the operator reviews them against the source before approval. Code then calculates the trace from those recorded relationships.

The original document remains available alongside the extracted information.”

This segment explains the implemented intake flow. The preloaded bakery dataset is authored sample data. Only show a fresh extraction result if an actual request is captured; do not substitute seeded records for that result. The separate [live AI evidence](LIVE-AI-VALIDATION.md) records the observed Fireworks text and PDF checks.

## 3:45–4:00 · Close

Return to the complete lot trace or the saved report.

“One ingredient lot. Four batches. Four destinations. A report with the records behind it.

RecallScope brings a practice recall drill into one workspace—from source documents to an inspectable delivery scope.”

## Capture notes

- Start from the complete supplied bakery dataset and keep its fictional provenance visible. The showcase has 1,440 confirmed packs, four batches, four destinations and zero unresolved deliveries for FL-260901-A; seven documents is the workspace-wide count.
- Follow the main trace, documents and report workflow. No review-example selection or deliberately incomplete dataset is part of this walkthrough.
- Capture actual interactions and the report created in that run. Verify displayed figures against the final build before recording.
- Keep credentials, private configuration and unrelated browser content out of the capture. If provider waiting time is shortened, label the edit.
- Use the official repository link and only include application/video links that have actually been published. A local preview can be identified as a local preview.
- Describe a fictional showcase and implemented features. Do not claim manufacturer trials, measured savings, general extraction accuracy or operational recall certification.

The historical O/0 correction fixture remains documented in [LIVE-AI-VALIDATION.md](LIVE-AI-VALIDATION.md) as a separate software QA exercise. It is not the default showcase or a required recording branch.
