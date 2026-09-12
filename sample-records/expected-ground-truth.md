# AI extraction fixture: expected ground truth

Fixture: `ai-extraction-fixture.pdf`

Purpose: a supervised first live extraction check for RecallScope.

Status: Fireworks / Kimi K2.6 extracted all three records in the live browser test on 12 September 2026. Reviewed import produced the expected 180 confirmed / 0 unresolved result. These ground-truth values were authored before the request; see `../docs/LIVE-AI-VALIDATION.md` for the validation scope. The PDF's original pre-test status wording is preserved as source evidence.

All entities, records and quantities are fictional. The PDF has one page and exactly three factual records. It contains explicit links and units, with no ambiguous identifiers. The product is a synthetic flour packing exercise, not a real recipe or manufacturing instruction.

## Expected extracted records

The field names below match the current extraction schema. `null` means the source does not state an applicable value for that record. Preserve the accented character in `Synthetic Test Café`.

| Field | Receipt | Production | Dispatch |
|---|---|---|---|
| `type` | `lot` | `batch` | `delivery` |
| `code` | `AI-DEMO-FL-01` | `AI-DEMO-CK-01` | `AI-DEMO-DIS-01` |
| `lotCode` | `null` | `AI-DEMO-FL-01` | `null` |
| `batchCode` | `null` | `null` | `AI-DEMO-CK-01` |
| `ingredient` | `Wheat flour` | `Wheat flour` | `null` |
| `product` | `null` | `Synthetic flour test packs` | `null` |
| `supplier` | `Synthetic Test Milling` | `null` | `null` |
| `customer` | `null` | `null` | `Synthetic Test Café` |
| `receivedKg` | `60` | `null` | `null` |
| `usedKg` | `null` | `12` | `null` |
| `producedPacks` | `null` | `200` | `null` |
| `packs` | `null` | `null` | `180` |
| `date` | `2026-09-08` | `2026-09-09` | `2026-09-10` |

Each record must also carry a nonempty `evidence` quote that is an exact substring of the returned transcript. A suitable quote includes the record ID and the relevant fields from its labelled section. Transcript whitespace may vary, so compare the meaning and original characters with the PDF rather than requiring a byte-identical transcript.

Useful literal evidence lines include:

- `Receipt / lot ID: AI-DEMO-FL-01` and `Received quantity: 60 kg`.
- `Production batch ID: AI-DEMO-CK-01`, `Ingredient lot used: AI-DEMO-FL-01`, `Ingredient quantity consumed: 12 kg`, and `Finished quantity produced: 200 packs`.
- `Dispatch ID: AI-DEMO-DIS-01`, `Production batch dispatched: AI-DEMO-CK-01`, and `Delivered quantity: 180 packs`.

The transcript should retain the synthetic-data label. The warning, headings, footer, and page number must not become extra receipt, batch, or delivery records.

## Expected result after reviewed import

Start with **an empty workspace**, upload this PDF with the AI option, inspect all three proposals against the page, and explicitly approve the reviewed import. Then select `AI-DEMO-FL-01`.

| Trace measure | Expected result |
|---|---:|
| Ingredient lots in this fixture | 1 |
| Confirmed production batches | 1 |
| Confirmed delivered packs | 180 |
| Confirmed customers | 1 |
| Unresolved delivered packs | 0 |
| Unresolved delivery records | 0 |

Expected path: ingredient lot `AI-DEMO-FL-01`, production batch `AI-DEMO-CK-01`, dispatch `AI-DEMO-DIS-01`, customer `Synthetic Test Café`.

The source records state 60 kg received, 12 kg consumed, 200 packs produced, and 180 packs delivered. The 20-pack production-minus-delivery difference is an arithmetic difference only. It does not prove physical stock, location, sale status, disposal, or safety. The 48 kg received-minus-consumed difference likewise does not establish audited inventory. Do not add an inferred dispatch or inventory record.

## Live validation record to complete later

Record the configured model, request date, extraction result, proposed record count, field differences, actual corrections, and result after review. Save any measured latency only after a real run. A successful authored fixture or local adapter test does not establish live model accuracy.

Pass criteria for this fixture: exactly three supported proposals, preserved IDs/dates/units, evidence quotes grounded in the transcript, explicit review before graph changes, and the trace totals above after approval. If the model differs, preserve the actual output and document the difference rather than changing these expected values to match it.
