# Synthetic QA fixtures

These fixtures are authored synthetic test inputs. The two-page PDF passed a live Fireworks extraction and reviewed import on 12 September 2026. No real business records were used. See [live validation](../docs/LIVE-AI-VALIDATION.md) and the [saved report](../docs/SYNTHETIC-LIVE-REPORT.md).

## Two-page extraction fixture

File: `synthetic-two-page-lot-code.pdf`

| Page | Record | Expected source values |
|---|---|---|
| 1 | Receipt | Lot `FW-FL-01`, wheat flour, Synthetic Test Milling, 60 kg received, 2026-09-08 |
| 2 | Production | Batch `FW-CK-01`, raw ingredient lot `FW-FL-O1`, wheat flour, Synthetic flour test packs, 12 kg consumed, 200 packs produced, 2026-09-09 |
| 2 | Dispatch | `FW-DIS-01`, batch `FW-CK-01`, Synthetic Test Café, 180 packs, 2026-09-10 |

The character before `1` in the production lot code `FW-FL-O1` is the letter **O**. The receipt instead contains a zero in `FW-FL-01`. The PDF does not call attention to this difference or tell the extractor to correct it.

Expected AI behavior: exactly three supported proposals, preservation of raw source identifiers including `FW-FL-O1`, dates and explicit units, and evidence quotes that are exact substrings of the transcript. The model must not silently normalize the production lot to the receipt lot.

After reviewed import into an **empty workspace**, before any lot reassignment:

- Selected receipt lot: `FW-FL-01`.
- Confirmed delivered packs: **0**.
- Unresolved delivered packs: **180**.
- The production record retains `FW-FL-O1` in the original source.

After the operator explicitly reviews and assigns the production relationship to `FW-FL-01`, with a recorded review note:

- Confirmed delivered packs: **180**.
- Unresolved delivered packs: **0**.
- Confirmed production batches: **1**.
- Confirmed customers: **1**.
- The source transcription and uploaded PDF still preserve `FW-FL-O1`. The correction belongs in the reviewed relationship and decision history.

The live run matched these expected outcomes: three proposals, raw `FW-FL-O1` preserved, 0 confirmed / 180 unresolved packs before explicit review, then 180 confirmed / 0 unresolved afterward. Report `RS-ED686CD1` at revision 9 records the decision. The operator note explicitly states that the authored test ground truth defines the intended assignment; the PDF alone does not establish that the two codes represent one lot. Original PDF bytes, both supplied page-image fingerprints, source text and the review decision survived persistence checks. Production-minus-dispatch quantities do not establish physical stock.

## Browser rejection fixtures

| File | Structure | Expected check |
|---|---|---|
| `synthetic-seven-pages.pdf` | 7 A4 pages, no business records | Reject in browser for page-count limit, with **0 API requests** |
| `synthetic-password-protected.pdf` | Encrypted 1-page PDF | Reject in browser for password protection, with **0 API requests** |

These two rejection fixtures were used locally and are not included in the source package. The browser showed the expected page-limit and unreadable-PDF errors. The encryption used the public QA password `fixture-only`, not an account credential. No password was entered during that check. The rendering guard runs before submission; a separate network-counter assertion was not captured, so no measured request-count claim is made here.

## File checks completed

- Confirmed exact IDs, units and dates in extracted PDF text.
- Confirmed the normal fixture has 2 pages and the page-limit fixture has 7 pages.
- Confirmed the password fixture is encrypted and opens with its test password.
- Rendered and visually inspected the two-page fixture.
