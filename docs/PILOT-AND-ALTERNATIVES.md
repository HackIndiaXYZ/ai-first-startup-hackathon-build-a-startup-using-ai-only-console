# RecallScope alternatives and pilot plan

Research date: 12 September 2026. Draft for submission preparation; no outreach or pilot has occurred. Vendor statements below are published capabilities, not independently measured results. No vendor price, implementation duration or comparative accuracy is assumed.

## Comparison grounded in current sources

| Approach | Capabilities supported by evidence | Fair implication for RecallScope |
|---|---|---|
| Existing paper records and spreadsheets | A spreadsheet can organize lot, event and reference-document data; operators can maintain links and review notes through their own process. FDA publishes an illustrative traceability spreadsheet, and its FAQ explicitly permits paper/electronic records without prescribing a particular technology. This US example demonstrates a credible alternative; it is not a statement of the Indian buyer's legal obligations. [FDA template and explanation](https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods), [FDA technology FAQ, TG.1](https://www.fda.gov/food/food-safety-modernization-act-fsma/frequently-asked-questions-fsma-food-traceability-rule) | Do not describe spreadsheets as inherently incapable, unsafe or noncompliant. Compare the manufacturer's actual workbook/process, including its existing automation. Whether extraction and a shared evidence view reduce work must be measured. |
| Trustwell FoodLogiQ Traceability + Recall | Forward/backward batch-lot tracing, event-data gaps, timeline/map investigations and investigation exports are documented. Recall supports targeted notices, acknowledgements, escalation, mock withdrawals and audit trails. These are substantial capabilities beyond RecallScope's current drill scope. [Traceability](https://www.trustwell.com/products/foodlogiq/traceability/), [Investigations user guide](https://knowledge.foodlogiq.com/hc/en-us/articles/14279295757069-Investigations-in-FoodLogiQ), [Recall](https://www.trustwell.com/products/foodlogiq/recall/) | “Visual tracing,” “exposes missing records” and “practice recalls” are not exclusive inventions. FoodLogiQ also advertises AI-supported document intake; do not claim it lacks AI. [FoodLogiQ platform](https://www.trustwell.com/products/foodlogiq/) |
| TraceGains Supplier Compliance / intelligence | Published capabilities include AI extraction/validation of certificates of analysis, lot-linked compliance history, receiving records, corrective-action workflows and supplier scorecards. TraceGains also describes mapping risk/recall events to affected ingredients, products and formulas. [Supplier Compliance](https://tracegains.com/compliance/supplier-compliance/), [regional product overview](https://tracegains.com/landing/tracegains_eu_overview/) | This is a relevant adjacent supplier-quality and recall-risk alternative. The reviewed pages do not establish an identical ingredient-to-customer dispatch drill, so do not mark that capability absent or claim TraceGains is a like-for-like recall execution system. Its AI document processing is explicit. [AI capabilities](https://tracegains.com/capabilities/intelligence/) |
| RecallScope today | Local software QA demonstrates document proposals, operator review, raw identifier preservation, explicit unknown links, deterministic delivery totals and saved reports. The actual two-page synthetic Fireworks run preserved FW-FL-O1, initially produced 0 confirmed/180 unresolved packs, and produced 180/0 after a correction authorized by fixture ground truth. | Current limits include one ingredient lot per production batch, single-operator workspaces and no operational recall notifications. Manufacturer demand, broader extraction performance, adoption effort and pricing remain unvalidated. See [live AI validation](LIVE-AI-VALIDATION.md) and the [project overview](../README.md). |

No direct vendor trials, commercial quotes or manufacturer purchasing interviews informed this comparison. A feature not described on a reviewed public page is **unknown**, not absent. Do not transfer vendors' published savings or customer results to RecallScope.

## Defensible differentiation hypothesis

RecallScope is testing a narrow starting point: a small food maker brings a bounded set of existing receipt, production and dispatch records, reviews AI transcription against those sources, and finishes one practice drill with supported links and unresolved gaps visible in the report.

The hypothesis is that this focused workflow can be useful before a manufacturer adopts a broader supply-chain platform. “Easier to start,” “less review effort,” “lower total cost” and “worth paying for” are hypotheses to compare against its current process and suitable commercial alternatives. Evidence inspection and explicit uncertainty are design priorities, not proven exclusive features. Do not pitch RecallScope as a replacement for an operational recall platform or as automatically compliant.

Proposed buyer: quality or operations lead at a small packaged-food manufacturer. The existing ₹3,000–10,000 per site/month range remains a pricing hypothesis, not a competitor comparison or validated willingness to pay.

## Six neutral operator interview questions

1. Walk me through your most recent recall drill or ingredient-trace request, from the first instruction to the final report. What records and people were involved?
2. Which tools or workbooks did you use, and what worked well enough that you would want to keep it?
3. Where, if anywhere, did you encounter missing or conflicting information? How was it resolved, and what evidence was accepted?
4. How did you decide the trace was complete? What did the reviewer need to see, and what remained uncertain?
5. Who owns this work and purchases its tools? What time, software and outside-support costs can you actually document, and what approvals would a change need?
6. After trying the workflow, what would you need to observe before using it again or paying for it? What would make you reject it or prefer your existing approach?

Ask about past behavior before showing the product or its proposed price. Record permissioned notes; distinguish observation, quotation, estimate and our interpretation. Interest in a demo is not a purchase commitment.

## One permissioned pilot protocol

**Purpose:** determine whether the current narrow workflow can reproduce an operator-approved trace and expose evidence gaps without creating unsupported confirmed links. This is a practice exercise, not a live recall.

1. **Agree scope and handling.** Recruit one manufacturer only after outreach is authorized. Obtain written permission from a data owner for the exact documents, model/provider transfer, reviewers, storage location, retention/deletion date and any later publication. Use a suitably controlled private environment. If permission or handling controls are unavailable, use synthetic records and label the result software QA. Remove unnecessary personal data consistently without breaking identifiers or relationships.
2. **Freeze the inputs and reference answer.** Select two historical or practice cases that fit the implemented one-ingredient model and six-page-per-PDF limit. A qualified operator prepares the expected batches, deliveries, quantities, unresolved items and supporting evidence independently, before seeing model outputs. Record source IDs and hashes. Missing evidence stays unknown; a similar-looking code alone is not correction authority.
3. **Compare fairly.** Give both approaches the same case inputs and outcome requirements. Prefer two similarly experienced operators: one uses the current process for case A and RecallScope for case B; the other reverses the methods. Neither sees the reference answer. Record experience, familiarization and assistance. With only one operator, record order/learning effects and treat timing differences as exploratory, not a controlled causal result.
4. **Capture the full work.** Log setup, document preparation, active review, provider waiting time, retries, corrections, manual assistance and report completion separately. Record all failed requests. Keep the model/configuration and raw proposals. Reviewers may approve or correct only with recorded supporting evidence; no silent cleaning or invented links.
5. **Assess accuracy before time.** Have the manufacturer review each final report against the reference. Count missed known deliveries, unsupported confirmed links, quantity discrepancies, unresolved items correctly exposed, and fields needing correction. For this bounded pilot, require no unsupported confirmed link and correct accounting of every in-scope delivery as confirmed or unresolved. A failed case is recorded and investigated; one successful pilot does not establish general accuracy.
6. **Decide the next step.** Review usability, report acceptance, actual costs and the operator's preference. Ask the buyer what, if anything, they would commit to next; record the distinction between interest, a planned repeat and a paid commitment. Obtain separate permission for any public quotation or anonymized result, then delete/retain data as agreed. Stop operational conclusions outside the tested scope.

Pilot evidence packet: consent and data-handling scope, frozen input manifest, reference trace, baseline and assisted reports, raw run log including failures, correction evidence, per-case discrepancy counts, measured time categories, actual costs and a manufacturer-reviewed conclusion. Keep confidential source material out of the public submission unless specifically authorized.

## Unit economics without invented savings

Use one reporting period, one currency and actual usage/billing. Keep estimates visibly separate from observations.

`AI cost = sum over every billed attempt(uncached-input units × input rate + cached-input units × cached rate + output units × output rate + other billed charges)`

Units and rates must follow the selected provider's current bill: for token-based prices, divide token counts by the quoted rate denominator. Avoid double-counting cached tokens. Include charged failures/retries; do not infer zero cost from an application timeout. Convert currencies with a recorded date/rate when needed.

`Variable service cost/site/month = AI cost + attributable compute/database/storage/network costs + support hours × loaded support hourly cost + payment fees`

`Monthly contribution/site = actual net subscription revenue − variable service cost/site/month`

`Contribution margin = monthly contribution ÷ actual net subscription revenue` (undefined when revenue is zero)

Track setup/onboarding labor separately, along with fixed operating costs and observed customer acquisition costs. If reporting a fully allocated cost, state the allocation rule and paid-site denominator. Cost per reviewed document should include all service attempts in the numerator; show attempted, failed and accepted document counts so failures cannot disappear from the result.

Any customer labor-value estimate requires measured baseline and assisted time at comparable trace quality:

`Estimated labor value/drill = (baseline labor hours − assisted labor hours) × agreed loaded hourly cost`

Include preparation, review and correction work; a negative value is allowed. Report waiting time separately. This is capacity value, not necessarily cash savings, and excludes unmeasured avoided recall losses. Do not calculate a real ROI from the current synthetic tests or proposed subscription range.
