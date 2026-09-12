# RecallScope demo script
Target recording: approximately 4 minutes. **Script prepared; final video not yet recorded.**

Record the final competition video only after live AI extraction is configured and checked. This script makes the current synthetic demonstration explicit. Do not imply preloaded records were extracted live. Replace the clearly marked AI-read segment with a real captured request once verified.

## 0:00–0:25 · Open the trace workspace

“An ingredient supplier flags a lot. A small food manufacturer now needs to find every product batch and customer delivery connected to it. The information may exist, but it is scattered across invoices, production sheets and delivery records.

We are Console, and this is RecallScope: evidence-first traceability for practice recall drills.”

## 0:25–0:55 · Select FL-260901-A

“This bakery and these records are synthetic, so the expected answers can be checked. We are investigating this flour lot. The available evidence confirms two production batches, 720 delivered packs and two customers.

Another 720 delivered packs remain unresolved across the workspace. That does not mean they are safe, or that they definitely contain this ingredient. It means their ingredient connection is not established.”

## 0:55–1:25 · Open one batch and source

“Each confirmed connection has a source. Here is the production sheet, and here is the lot code it records. Customer exposure comes from the delivery register. The quantities are calculated by ordinary code from those relationships.

AI's role is reading and proposing structured information. It does not get to invent missing paperwork or decide whether a shipment is safe.”

## 1:25–2:00 · Document intake

CURRENT LOCAL DEMO: Open Add records and show the CSV template/import review. Say:

“Our document intake stores the original file and brings proposed fields into a review screen. This is a structured CSV import, not a live AI extraction. The same review boundary is used by our server-side AI adapter for PDF, image and text records. The live API connection still needs validation before the final submission.”

FINAL VIDEO AFTER LIVE VALIDATION: Upload a small labelled PDF/image fixture through Read with AI. Show the original and returned fields, correct any actual error, then approve. State the actual model and measured response result only if verified. Do not fabricate an OCR mistake for the video.

## 2:00–2:45 · Review the ambiguous production record

“In this record, a letter O appears where the supplier lot uses a zero. RecallScope keeps that relationship unresolved.

I compare the production sheet with the supplier record, choose the supported lot, and document my reasoning. Now the confirmed scope changes: three batches, 1,080 delivered packs and three customers. The original record stays unchanged, and the decision is recorded.

The other batch still has no consumption sheet. Its 360 delivered packs remain unresolved. We cannot solve missing evidence with a confident guess.”

## 2:45–3:15 · Save a report and open decision history

“This drill report captures the selected lot, confirmed customers, unresolved customers and source references. It is a fixed snapshot. A later correction will not rewrite what was known when this report was saved.

The decision history records what changed and why. No customer notifications or recall notices are sent.”

## 3:15–3:45 · Show buyer and pilot slide

“Our first buyer is a quality or operations lead at a small packaged-food manufacturer that already keeps batch records. We want to make those existing records useful for recurring traceability exercises and document-gap checks.

A per-site subscription is the hypothesis. We have not yet validated pricing or customer demand. Our next step is one permissioned manufacturer pilot with an independently verified trace map.”

## 3:45–4:00 · End on the trace result

“We will measure missed links, unresolved links, operator corrections and drill completion time. The aim is a trace people can inspect and challenge.

RecallScope: evidence before certainty.”

## Recording checklist

- Reset the synthetic drill and verify initial 720/720 counts.
- Keep text readable at a desktop viewport; avoid fast pointer movements.
- Show real application interactions, source records and the saved report.
- Label synthetic records throughout.
- Verify live AI before claiming a live AI read.
- Never claim actual manufacturer adoption, compliance or measured time savings without evidence.
- Include the final GitHub and deployed-app URLs only after they exist.
