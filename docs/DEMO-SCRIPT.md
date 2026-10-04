# RecallScope pharmaceutical demonstration

**Current edition: pharmaceutical distributors and wholesalers.** The [video](RecallScope-Pharma-Demo.mp4) uses coded animation and pharmaceutical product visuals with Higgsfield Grady narration. Its visual identity follows the current application. The pitch is a separate [editable deck](RecallScope-Pharma-Pitch.pptx) and [vector PDF](RecallScope-Pharma-Pitch.pdf).

The film illustrates the labelled fictional Asterbridge Distribution scenarios. Its transitions show the implemented workflow and known record states, rather than recorded browser interactions. Guided intake uses pre-filled proposals without an AI request. Live Fireworks/OpenAI extraction remains a separate optional path.

## Narration

Eight editorial sections follow the selected speech. Visual timing is aligned to the measured narration, so this script does not substitute estimated timecodes for the final media duration.

### Every box has a story

A medicine recall begins with a simple question: where did this batch go? For a distributor, the answer can be scattered across receipts, warehouse records, delivery notes and returned boxes. RecallScope brings that story together, so the team can trace each movement and account for what comes back.

### One operational workspace

This is RecallScope for pharmaceutical distributors and wholesalers. We are following Asterbridge Distribution, a fictional workspace with six medicines and nine product-specific batches. The overview connects stock, deliveries, recalls and evidence in one place. Open a product to see its strength, presentation, expiry and recorded quantities, then move directly to the batch, warehouse or recipient behind the number. The familiar workspace stays consistent in light and night mode.

### Identity before matching

Here is the paracetamol batch. One thousand boxes were received, and six hundred were dispatched to four customer sites. The trace connects the supplier, two warehouses and those destinations. Now compare amoxicillin: its printed batch code is identical. RecallScope keeps the two medicines separate because product identity matters as much as the batch label. A matching string alone must never merge stock or expand a recall.

### AI interprets. People approve.

Document intake offers guided examples, structured CSV import and live AI assistance. Fireworks and OpenAI can interpret text, images and PDFs into proposed receipts or dispatches. The original source remains alongside every proposal, and deterministic checks validate identifiers, quantities and units before an operator approves. For this walkthrough, the guided receipt is pre-filled and needs no API key. Review forty boxes of a separate available paracetamol batch, compare the source, and save the decision. Only then does available stock rise from four hundred to four hundred and forty. Repeating that document cannot post the same receipt twice.

### Account for every return

We switch to the active recall scenario, with one hundred boxes returned and five hundred outstanding, then review twenty more returned boxes against their original dispatch. Approval raises returns to one hundred and twenty and reduces outstanding quantity to four hundred and eighty, while the boxes stay quarantined; the completed scenario accounts for all six hundred dispatched boxes returning and all one thousand boxes remaining in quarantine, with historical dispatches kept separate from current stock and no automatic release decision.

### Evidence that travels

Reports preserve the case as a fixed snapshot, so later movements cannot rewrite the earlier record. The original documents, review notes and decision history stay available alongside PDF and ledger exports, with an evidence package and content-hash manifest connecting quantities back to their sources, ready for the operations and quality team to explain and hand over.

### Built through agentic AI

Codex agents helped build the system across idea generation, market research, interface design, custom code, testing, deployment and pitch creation, with one hundred and forty-three passing automated tests recorded. Live models interpret documents while explicit operator review and deterministic accounting govern the operational record, bringing agentic AI development and practical AI assistance into one focused product.

### Trace. Review. Account.

Open RecallScope to follow a batch, review a receipt and inspect its evidence, using the complete guided workflow without your own key or choosing live AI through the private server connection. Know where every affected batch went, and account for what comes back.

## Scenario continuity

| Segment | Record state |
| --- | --- |
| Batch trace | PAR-500-100 / PCR-260901: 1,000 boxes received, 600 historically dispatched through two warehouses to four recipient sites |
| Duplicate printed code | AMX-500-100 / PCR-260901 stays outside the paracetamol case |
| Guided goods receipt | Separate available batch PCR-261001 increases from 400 to 440 boxes only after reviewed approval of 40 boxes |
| Active recall | Scenario switch starts with 100 returned and 500 outstanding boxes |
| Partial return | Approved 20-box return linked to DSP-001 makes totals 120 returned and 480 outstanding |
| Completed recall | Explicit scenario change shows all 600 dispatched boxes returned, 1,000 boxes in quarantine and zero outstanding |
| Reports | Fixed snapshots retain the quantities and sources captured at creation |

Historical dispatches and current stock are distinct measures. Returned boxes already form part of stock on hand. Accounting completion does not authorize release, disposal or medicine use.

## Reproduce the workflow in the app

The [README walkthrough](../README.md#walkthrough-without-an-api-key) gives the interactive steps. Use the completed or active sample named above. Sample reset replaces the working scenario, so export a backup first if retaining changes matters.

The recorded application checks appear in [pharmaceutical verification](PHARMA-VALIDATION.md). Film length is not a measured task-completion time, and controlled-provider tests are not a live extraction accuracy benchmark. Final video inspection and duration belong to the [release evidence](../product/verification/pharma-release.json).
