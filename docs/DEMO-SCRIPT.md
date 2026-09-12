# RecallScope demo script

Target recording: approximately 4 minutes. **This script is delivered. The final 3-5-minute video has not been recorded.**

Use the verified Fireworks workflow and [two-page synthetic fixture](../sample-records/synthetic-two-page-lot-code.pdf). Keep its [ground truth](../sample-records/fireworks-ground-truth.md) available for the review step. The timings below are an editing plan, not measured application performance. If waiting time is shortened in the video, label the cut clearly.

## 0:00-0:25 - The recall-drill question

“A supplier flags an ingredient lot. A food manufacturer's quality lead needs to connect that lot to production batches and customer deliveries, with records that explain every link.

We are Console. RecallScope helps small food makers run practice recall drills and see where their evidence is incomplete.”

## 0:25-1:10 - Upload the synthetic PDF

Start with an empty workspace. Show both pages of `synthetic-two-page-lot-code.pdf`, choose the AI import option, and show Fireworks as the destination before sending.

“Every business and transaction in this file is fictional. Page one records a flour receipt. Page two records production and a customer dispatch.

RecallScope renders every PDF page as an image and sends those images to Fireworks. This run uses Kimi K2.6. The original PDF and the images sent to AI remain available for review.”

Capture a real request and its result. Do not represent seeded records or a replay as a new live extraction. If the request fails, preserve the failure and show an explicitly labelled successful recorded run or retry.

## 1:10-1:50 - Inspect the proposed records

Show all three returned proposals and their evidence before approving the import. Select `FW-FL-01` after approval.

“The model returned a receipt, a production record and a dispatch. Here, the receipt has `FW-FL-01`, with a zero. The production sheet has `FW-FL-O1`, with a letter O. The extraction preserved that difference.

I approve the records as transcribed. The result is zero confirmed delivered packs and 180 unresolved packs. The documents do not yet establish the ingredient connection.”

## 1:50-2:40 - Record a supported test correction

Open the unresolved batch `FW-CK-01`. Show the raw source and fixture ground truth. Assign the reviewed relationship to `FW-FL-01` and enter a note stating the basis.

“The document alone does not prove these are the same lot. This synthetic fixture's ground truth explicitly authorizes the intended relationship, so I can use it to test the correction workflow. A real drill would need supporting operational evidence.

I record that basis and confirm the assignment. Now the code calculates 180 confirmed delivered packs, one batch and one customer, with zero unresolved packs. The source still contains the original letter O.”

Suggested review note: “Synthetic QA: fixture ground truth authorizes the intended assignment to FW-FL-01. The PDF alone does not prove lot equivalence. Preserve the raw FW-FL-O1 source value.”

## 2:40-3:15 - Save the drill report

Save a report and open the decision history and original source.

“This report is a snapshot of the reviewed scope and its supporting records. The decision history records the correction and why I made it. Later edits do not rewrite the saved report.

The stored file fingerprints identify the bytes we retained. They do not prove that AI read the document correctly. The operator can inspect the source, page images and transcript.”

Use the report ID produced in the actual recording. The completed validation run saved `RS-ED686CD1`; do not imply a new run must generate the same ID.

## 3:15-3:45 - Buyer and validation plan

“Our initial buyer is a quality or operations lead at a small packaged-food manufacturer. The proposed subscription is a hypothesis, and we have not validated customer demand or pricing.

We are seeking one permissioned manufacturer pilot. We will compare the same drill manually and with RecallScope, measuring missed links, review effort and completion time.”

## 3:45-4:00 - Close

“These synthetic tests show the workflow working on known examples. They do not establish general extraction accuracy or readiness for a real recall.

RecallScope gives the team a trace they can inspect and a clear record of what still needs evidence.”

## Recording checklist

- Use an empty workspace and verify the actual three proposals, raw `FW-FL-O1`, and initial 0 confirmed / 180 unresolved result.
- Keep the synthetic label visible. Show the source of the correction authority instead of guessing from similar codes.
- Verify the reviewed 180 confirmed / 0 unresolved result and the report created in that run.
- Keep API keys and local configuration out of all captures.
- Keep any waiting-time edits visible. Claim no speed improvement, extraction percentage, customer adoption or compliance result.
- Include public application and GitHub delivery links only after they exist. The official repository is linked from the README. Public deployment and the final video remain pending.
- The OpenAI option remains configurable, but this verified demonstration uses Fireworks. Live OpenAI extraction is untested.

See [LIVE-AI-VALIDATION.md](LIVE-AI-VALIDATION.md) for the observed results, timeout and limitations.
