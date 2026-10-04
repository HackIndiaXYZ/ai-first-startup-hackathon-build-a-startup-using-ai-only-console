# AI usage report · RecallScope
Prepared for HackIndia's AI-first workflow documentation requirement.

**RecallScope was built through agentic AI development.** Codex agents translated the owner's pharmaceutical-distribution brief into architecture, frontend workflows, backend schemas, ledger rules, automated tests and presentation materials. The owner set the direction and authorised key decisions; AI agents carried out the custom implementation and verification work documented below.

AI also powers an optional product capability: multimodal Fireworks/OpenAI document extraction. Its proposals pass through source validation and operator review before deterministic code posts inventory changes. The no-key guided path lets judges explore that review and accounting workflow without spending provider credits.

## Pharmaceutical edition — 3–4 October 2026

The owner selected pharmaceutical distributors and wholesalers, asked for the full improvement roadmap to be implemented without industrial trials, and then requested a template-first experience for judges who do not have an API key. The owner authorised parallel implementation agents.

Codex split implementation between the distribution domain, interface, document intake/interoperability, and the server/release work. The resulting pharmaceutical code is distinct from the earlier manufacturing model: products and their batches, warehouse movements, dispatches, returns, recall cases and source evidence replace ingredient consumption as the primary workflow.

### Three clearly identified intake paths

| Path | What actually happens |
| --- | --- |
| Guided example | A selected fictional CSV source becomes pre-filled proposals, with **“Guided example — pre-filled records; no AI request is made.”** The operator reviews and posts through the same ledger rules |
| Structured CSV | An RFC-style parser reads the supplied fields, supports explicit column mapping and retains original source rows; no model or provider is called |
| Live AI assistance | The server sends a consented document to its configured Fireworks or OpenAI provider, obtains schema-constrained proposals and applies source/identity validation before review |

Each path makes its provenance visible. Guided examples provide immediate access to the workflow, CSV offers repeatable structured import, and live AI handles document interpretation. All three share validation and operator review. Provider keys remain private server configuration.

### Custom work in this edition

- Product and batch model, month/day expiry precision, explicit packaging conversions, original identifiers and product-specific matching.
- Movement-led stock, transit confirmation, reservations, held-stock enforcement, delivery/return lifecycles and quantity reconciliation.
- Recall tasks, acknowledgements, fixed reports, evidence exports and decision records.
- Template-first intake, pharmaceutical schemas and prompts, explicit corrections, exact quote/page/line evidence, review-before-posting and duplicate protection.
- D1/R2 persistence, idempotency, revision conflicts, isolated workspaces and roles through the hosting identity integration.
- Pharmaceutical interface, night mode and operational navigation; bounded GS1/EPCIS/temperature helpers.
- Synthetic scenario generation, automated tests and official-source alternatives research.

The runtime pharmaceutical prompt and JSON schema are in `product/lib/pharma/providers.ts`; parsing and catalogue matching are in `product/lib/pharma/intake.ts`. Uploaded content is treated as untrusted data. Missing facts remain empty, identifiers are preserved, mixed unsupported records cannot be silently omitted, and model-proposed recall records require an explicit source notice. The AI is not asked to decide medicine safety or invent a recall.

### Verification and development evidence

The final combined unit suite passed **143/143 tests**, followed by both API suites, TypeScript checks and the production build. Provider responses for the new schema were controlled mocks; no paid pharmaceutical extraction was performed. The [pharmaceutical verification record](PHARMA-VALIDATION.md) distinguishes unit, API, standards-profile and browser evidence.

Codex authored an eight-slide pharmaceutical pitch with real interface captures and editable content. Eight Grady narration sections were generated for a revised walkthrough, using **28.4 net credits** for completed narration. The owner then put the walkthrough video on hold. The final balance change was **29.4 credits deducted/reserved**, including one interrupted 1-credit wording-correction request whose outcome is unknown. Existing draft work is preserved; no completed pharmaceutical film is claimed.

Official-source research compares [TraceLink, SAP and Odoo](PHARMA-ALTERNATIVES.md). No customer interview, industrial deployment result, revenue, savings measurement or compliance certification is claimed.

The pharmaceutical application was published on 4 October 2026 MYT, with the layout and routing follow-up in version 3. The current source, pitch, screenshots and written walkthrough describe the pharmaceutical edition; its video is on hold. Superseded presentation files were removed from the latest project tree and remain recoverable in Git history.

## AI-led work across the seven activities

| Activity | Work and evidence |
| --- | --- |
| Idea generation | AI-assisted scoping of batch traceability and recall reconciliation for pharmaceutical distributors, with the owner selecting this industry |
| Market research | Published-source comparison and commercial hypotheses in [pharmaceutical alternatives](PHARMA-ALTERNATIVES.md) |
| UI/UX design | Product, stock, delivery, recall, evidence and reporting views; light/night themes, responsive layouts and keyboard interaction |
| Coding | Custom React/TypeScript interface, APIs, reviewed intake, product-scoped ledger and persistence in the official repository |
| Testing | Domain, provider, export, SQL and API checks plus observed browser journeys in the [verification record](PHARMA-VALIDATION.md) |
| Deployment | Sites hosting, database migrations, server-side secrets and verified public publication in the [build record](BUILD-STATUS.md) |
| Pitch creation | AI-authored editable [pharmaceutical pitch](RecallScope-Pharma-Pitch.pptx) with application captures; the [written walkthrough](DEMO-SCRIPT.md) is available and video production remains on hold |

## Authorship and reused components

Codex authored the task-specific application implementation, tests, fictional records, documentation and presentation under the owner's direction. The owner selected the project direction, supplied the repository and authorised publication. The commit history, executable tests and linked project materials provide concrete evidence of this AI-led work. The application builds on an MIT-licensed starter and credited third-party packages, including PDF.js and pdf-lib.

## Development decisions

1. Model pharmaceutical products, manufacturer-scoped batches, packaging units, warehouse movements and recipients explicitly.
2. Keep stock conservation and recall accounting deterministic; separate historical dispatch exposure from current stock.
3. Preserve original source text, identifiers, evidence locations and operator decisions.
4. Make guided examples and CSV useful without a provider key; identify their provenance clearly.
5. Offer Fireworks and OpenAI as optional server-side providers, with reviewed proposals rather than automatic posting.
6. Verify duplicate protection, stale-write rejection, workspace isolation, report snapshots and evidence exports.
7. Use actual pharmaceutical interface captures in the pitch and current project materials.
8. Keep commercial assumptions and controlled verification distinct from industrial validation or measured customer outcomes.

## Provider and data boundaries

Runtime prompts and schemas are versioned in `product/lib/pharma/providers.ts`. Uploaded content is untrusted source material. Model output is validated against the original source and remains a proposal until reviewed; it cannot silently authorize medicine disposition or change stock. Provider credentials stay in ignored local configuration or private deployment secrets and never enter presentation materials, browser code or Git.
