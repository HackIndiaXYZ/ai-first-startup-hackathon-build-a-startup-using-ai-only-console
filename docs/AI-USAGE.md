# AI usage report · RecallScope
Prepared for HackIndia's AI-first workflow documentation requirement.

## Participant instruction

The participant selected RecallScope after AI-assisted project research, then authorised autonomous implementation: “ok, can start now, all you decide for first prize … continuously until before push to github or where you think critical issue to stop”.

The participant supplied the required team repository and GitHub identity. The build remains local, before push.

## Tools and roles

| Tool | Actual role |
|---|---|
| Codex | Product scoping, implementation, synthetic source construction, tests, debugging, visual review, build packaging and documentation |
| Delegated Codex reviewers | Independent competition-requirement checks and adversarial traceability review |
| OpenAI Responses API adapter | Implemented runtime extraction from PDF/image/text into a structured review proposal; live credentials and validation pending |
| Browser tooling | Actual interaction checks: review, recalculation, reload persistence, import approval, reports and responsive layouts |
| Presentation tooling | Editable pitch deck creation and rendering checks |

Task-specific application code was authored by Codex under participant direction. The project also contains an existing MIT-licensed starter and third-party packages. No audited numerical percentage of the entire dependency tree is claimed. The working history and source identify AI-produced custom work and reused dependencies separately.

## Evidence for the 80% AI-driven execution requirement

The event asks for at least 80% AI-driven execution. For the new work in this build, Codex authored the custom application implementation, tests, synthetic records, documentation and presentation. The participant selected the project direction, supplied the repository and authorised the work; no participant-written application code was supplied during this build. These are the actual roles evidenced by the task history and source, not a stopwatch measurement or a percentage calculated from bundled dependencies. The organiser's interpretation of the requirement remains authoritative.

## Development prompts and decisions

The following are concise records of development instructions, not a verbatim dump of private task history:

1. Build RecallScope around supplier ingredient lots, production batches and customer deliveries, with source evidence for every confirmed relationship.
2. Make an ambiguous code correction change the synthetic result from 720 to 1,080 delivered packs, while keeping a second missing-record case unresolved.
3. Review the domain for duplicated dispatches, missing quantities, false links, incomplete reports and snapshot integrity.
4. Keep AI-generated proposals outside confirmed traceability until the operator reviews them.
5. Preserve exact identifiers, original files, source references, review notes and evidence of field edits.
6. Test the application through its actual interface and HTTP routes, including session isolation and failed writes.
7. Prepare a pitch with synthetic results and unvalidated commercial assumptions labelled honestly.

## Runtime extraction prompt

The full executable prompt and JSON schema are versioned in `product/lib/ai-extract.ts`. The prompt treats uploaded documents as untrusted data, preserves O/0 ambiguities, forbids invented records and silent truncation, retains unknown values, requires literal evidence quotes, and requests human-review proposals. The API request uses structured outputs and `store:false`.

The model is configurable with `OPENAI_MODEL`; the default is `gpt-5.4-mini`. The adapter is implemented but **has not yet been tested against the live API** in this build. Seeded demo records are pre-authored and are labelled accordingly.

## AI errors found and corrected

- Missing quantities initially became zero; they now remain explicitly unknown.
- Identical duplicate dispatch references could inflate totals; identical duplicates now count once and conflicting duplicates fail.
- Unresolved customers were missing from early reports; all unresolved delivery details are now exported.
- Early map lines visually implied a lot connection to unrelated batches; only confirmed lot relationships now receive those edges.
- Importing a custom file could remove the sample-data warning; mixed data now retains disclosure.
- Explicit supplier/ingredient conflicts and post-save cleanup failure handling were tightened.
- A named batch without a production sheet now creates a visible unresolved placeholder.
- Runtime source-size instructions now explicitly forbid silent AI truncation.

## Evidence and limitations

Domain and adapter tests, route integration checks, UI observations, the pitch deck and sample sources are included. Synthetic scenario correctness is not real-world OCR accuracy, customer validation, a food-safety claim or measured time savings.

Official requirement source: https://hackindia.org/2026/ai-first-startup-hackathon-build-a-startup-using-ai-only
OpenAI structured output guidance: https://developers.openai.com/api/docs/guides/structured-outputs
OpenAI file input guidance: https://developers.openai.com/api/docs/guides/file-inputs
