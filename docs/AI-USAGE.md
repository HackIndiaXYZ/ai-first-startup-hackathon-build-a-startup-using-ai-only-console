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
| Fireworks / Kimi K2.6 | User-selected development provider; actual synthetic text and PDF extraction tested with explicit review before import |
| PDF.js and pdf-lib | Existing open-source libraries for browser page rendering and independent server page-count checks; these libraries are not claimed as AI-authored code |
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
8. Refine the interface into an operator-focused workspace: night/system appearance, personalization, record search/filtering and report reading. Development slogans were removed from application navigation; source provenance and sample-data disclosures were preserved. No generated imagery was needed for this data workspace.

## Runtime extraction prompt

The full executable prompt and JSON schema are versioned in `product/lib/ai-extract.ts`. The prompt treats uploaded documents as untrusted data, preserves O/0 ambiguities, forbids invented records and silent truncation, retains unknown values, requires literal evidence quotes, and requests human-review proposals. Both providers use structured outputs. Only the OpenAI request uses `store:false`.

The participant subsequently requested Fireworks for development while keeping OpenAI support. `AI_PROVIDER` selects the service; `FIREWORKS_MODEL` defaults to `accounts/fireworks/models/kimi-k2p6`, and `OPENAI_MODEL` defaults to `gpt-5.4-mini`. The live Fireworks tests are documented in [LIVE-AI-VALIDATION.md](LIVE-AI-VALIDATION.md). The OpenAI adapter has controlled-response tests but no live OpenAI test. Seeded demo records remain pre-authored and labelled. The user-supplied key is kept in ignored local configuration and omitted from all reports and source packages.

## AI errors found and corrected

- Missing quantities initially became zero; they now remain explicitly unknown.
- Identical duplicate dispatch references could inflate totals; identical duplicates now count once and conflicting duplicates fail.
- Unresolved customers were missing from early reports; all unresolved delivery details are now exported.
- Early map lines visually implied a lot connection to unrelated batches; only confirmed lot relationships now receive those edges.
- Importing a custom file could remove the sample-data warning; mixed data now retains disclosure.
- Explicit supplier/ingredient conflicts and post-save cleanup failure handling were tightened.
- A named batch without a production sheet now creates a visible unresolved placeholder.
- Runtime source-size instructions now explicitly forbid silent AI truncation.
- PDF worker loading initially encountered a development-overlay error; the pinned worker now loads as an unmodified static asset.
- Fireworks batch fields that could trigger a validation conflict are now editable in the review screen.
- Server PDF page-count validation now detects a submitted image set that omits an original page.
- A two-page request reached its timeout without changing saved records; the development request now explicitly disables reasoning for structured extraction, with the retry outcome recorded separately.

## Evidence and limitations

Domain and adapter tests, route integration checks, UI observations, the pitch deck and sample sources are included. Synthetic scenario correctness is not real-world OCR accuracy, customer validation, a food-safety claim or measured time savings.

Official requirement source: https://hackindia.org/2026/ai-first-startup-hackathon-build-a-startup-using-ai-only
OpenAI structured output guidance: https://developers.openai.com/api/docs/guides/structured-outputs
OpenAI file input guidance: https://developers.openai.com/api/docs/guides/file-inputs
Fireworks vision input guidance: https://docs.fireworks.ai/guides/querying-vision-language-models
Fireworks structured output guidance: https://docs.fireworks.ai/structured-responses/structured-response-formatting
Fireworks Chat Completions parameters: https://docs.fireworks.ai/api-reference/post-chatcompletions

## Reference-checklist audit and refinement - 12 September 2026

User instruction: treat an attached championship checklist as optional reference, decide worthwhile improvements and visuals, and provide a fuller post-build checklist. Codex reviewed all four pages, compared official requirements, and used read-only strategic/product reviews. It selected functional path feedback, same-lot report comparison and clearer document-reading status, rather than adding arbitrary charts or luxury imagery. A review found and fixed omitted delivery decisions after later ingredient resolution. Codex implemented and verified the changes, generated a 76-item evidence checklist and prepared a cited alternative comparison, neutral interview plan and unit-economics formulas. No customer interviews, pilot, ROI, paid extraction benchmark, publication or submission was invented or performed in this refinement. Forty-two automated checks pass; remaining gaps are explicitly listed in the readiness packet.

## GitHub release preparation - 12 September 2026

After the owner explicitly authorized publication to the official Team Console repository, Codex verified the destination and fast-forward relationship, inspected all reachable Git objects for configured secrets, refined the README/navigation/architecture summary and clarified which submission artifacts remain pending. The original Git history and MIT license are preserved. GitHub Actions runs the project checks from a clean checkout. This authorization covers the source release; it does not claim a public app, final video or completed competition submission.

## Complete showcase - 12 September 2026

The owner requested a polished complete fictional scenario without a real manufacturer trial. Codex authored a separate complete dataset with matching production evidence, kept the original ambiguity fixture for regression coverage, and made the complete dataset the default for new sessions and sample resets. Existing sessions remain unchanged. The main experience, reports, README, walkthrough and editable pitch now focus on the complete trace: 1,440 delivered packs across four batches and four destinations. Forty-five automated tests and the application/API checks passed. Codex generated an example report directly from the same domain code. The pre-authored sample is not presented as a new AI extraction or real customer outcome; Fireworks and OpenAI support remain intact.
