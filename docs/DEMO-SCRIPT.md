# RecallScope pharmaceutical walkthrough

**Current edition: pharmaceutical distributors and wholesalers.** This is a planned three-minute live walkthrough script, not a claim that a new video has already been produced. Video production is on hold at the owner's request.

The presenter uses the labelled fictional Asterbridge Distribution workspace. Start with a fresh **completed** sample scenario so the known quantities below are reproducible. No API key or paid request is required.

## 0:00–0:25 · One batch, one operational question

**Show:** product identity, batch and recall summary.

**Narration:** “When a distributor receives a recall notice, the first question is where this product batch went. The next is what has come back. RecallScope connects stock, shipments, returns and source records in one workspace for the operations and quality team.”

Briefly identify the records as the supplied fictional scenario.

## 0:25–0:55 · Explain the accounting

**Show:** paracetamol 500 mg, batch PCR-260901; Central/North; the four customer destinations.

**Narration:** “This batch began with one thousand boxes. Six hundred went to four customer sites. In the completed case, all six hundred were returned and the recorded thousand boxes remain quarantined. Historical deliveries and current stock are different measures, so the app does not add them together.”

Open the amoxicillin product with the same printed batch code. Show that it remains outside the paracetamol case.

**Narration:** “A batch code alone is not a product identity. The same printed code on a different medicine stays separate.”

## 0:55–1:35 · Let the judge use the workflow

**Show:** Document intake → Guided examples → Goods received.

Read or leave visible: **“Guided example — pre-filled records; no AI request is made.”**

**Narration:** “Judges can use the complete document workflow without sharing a key. This guided source is pre-filled. The original CSV stays beside the proposals; product, batch, quantity, unit and warehouse are matched explicitly.”

Inspect the 40-box receipt for PAR-500-100 / PCR-261001, expiry 2028-01, supplier-northstar, loc-central.

Enter review note: “Compared the source receipt, exact product batch, quantity, unit and receiving location.”

Confirm the review and post. Show the available batch increase from **400 to 440 boxes**. Reload if the available recording time allows.

**Narration:** “The preview does not change stock. A reviewed posting does. Reusing the same document cannot create a second receipt.”

## 1:35–2:10 · Account for a partial return

For a live presentation, load the **active recall** sample before this segment. A reset replaces the working sample; export any wanted changes first. In an edited recording, make the scenario switch visible rather than implying continuous state.

**Show:** active case has **100 returned / 500 outstanding**. Open the partial customer-return example. Inspect its link to DSP-001 and approve 20 boxes with a source review note.

**Narration:** “A partial return stays tied to its original dispatch. These twenty boxes change returns to one hundred and twenty and outstanding quantity to four hundred and eighty. Returned stock stays quarantined; the software does not turn an accounting update into a medicine-safety decision.”

## 2:10–2:40 · Take the evidence with you

**Show:** saved report, PDF preview and evidence-package download; original source and decision history.

**Narration:** “A report is a fixed snapshot of the case, its source records and quantities. Later changes do not rewrite the earlier report. The evidence package includes the source files and a content-hash manifest.”

Show light/night appearance and the readable stock/expiry table briefly. Use movement to explain the selected path; do not spend this time on decorative transitions.

## 2:40–3:00 · What AI contributes

**Show:** three intake choices; live AI remains an optional separate mode.

**Narration:** “Fireworks and OpenAI can propose fields from documents when a private server connection is configured. Operators review the evidence; deterministic code controls quantities and posting. The project itself was developed with AI assistance across product design, implementation, research and verification. Its strength is a specific distributor workflow that judges can inspect and use.”

End on: **“Know where every affected batch went. Account for what comes back.”**

## Presenter checks

- Use the correct completed or active scenario for each segment.
- Keep the sample-data disclosure and template notice visible where relevant.
- Do not call a template an AI extraction result.
- Controlled-provider checks are not a live pharmaceutical extraction accuracy benchmark.
- Demonstrate a real posted action, a real report and its source, rather than substituting animated numbers.
- Keep claims aligned with [software verification](PHARMA-VALIDATION.md) and the [official-source market comparison](PHARMA-ALTERNATIVES.md).
- Label any future edited footage as selected moments from the workflow; editing length is not a measured task-completion time.
