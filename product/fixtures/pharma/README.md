# Pharmaceutical verification corpus

All organisations, documents and events are fictional software fixtures. These files do not represent actual supplies, recall instructions or patient records.

The corpus includes 10 structured CSV cases and six PDFs: clean text, month-only expiry, the same batch code across two products, an ambiguous printed date, a rotated page and an image-only scanned page. The matching PNG is a raster rendering of the clean authored PDF.

Run `npm run test:pharma-eval` to compare parsed fields, exact identity matching, review flags and mocked Fireworks/OpenAI response handling against `manifest.json`. The expected answers and mock transcripts are authored fixtures. **No live model or OCR accuracy is measured, and no API key or network request is used.**

Run `npm run fixtures:pharma` to regenerate with the existing pdf-lib dependency and Poppler's `pdftoppm` on PATH (or `PDFTOPPM_PATH`). Reproduction is deterministic for the supplied reference date.

Run `npm run benchmark` for measured 1,000- and 10,000-movement synthetic receipt and mixed distribution workloads. Benchmarks report the execution environment and do not assert industrial performance.
