# Provider secrets and rotation

The pharmaceutical workflow works without a provider credential. Guided examples and CSV import do not make an AI request. Live extraction is optional and requires explicit document-sharing consent in the interface.

## Storage boundary

Configure `FIREWORKS_API_KEY` or `OPENAI_API_KEY` only in ignored local runtime configuration or the deployment's private secret store. `AI_PROVIDER` explicitly chooses `fireworks` or `openai`; `FIREWORKS_MODEL` and `OPENAI_MODEL` select the corresponding model. An explicitly selected provider does not silently fall back to the other provider.

`publicAIConfig` returns only provider, label, model and availability. The key is passed server-side to the selected provider adapter. It must never be copied into browser variables, source code, Git, a screenshot, a recorded demonstration, an exported workspace or a downloadable fixture. Local `.env*` and `.dev.vars*` files are ignored; the checked-in example contains variable names and empty placeholders only.

Provider adapters return bounded operator-facing errors instead of provider response bodies. Storage logging redacts recognized credential patterns and limits text length; this is a guard, not permission to log credentials. Inspect diagnostics for accidental secrets before sharing them.

## Rotation procedure

1. If a credential was disclosed, revoke it in the provider account promptly. Removing a visible message or Git file does not revoke the credential.
2. Generate a replacement credential in the correct provider account with the intended usage controls. Place it directly in the private local/deployment secret store without printing it to a terminal or passing it in a command recorded in history.
3. Update each intended environment independently. Keep `AI_PROVIDER` explicit. Restart the local runtime or apply the hosting service's secret configuration so new requests use the replacement.
4. Check that the app exposes only provider/model/availability and that guided examples and CSV still work. These checks require no paid provider request. A live extraction can be verified separately when explicitly authorized and budgeted; do not infer a valid credential solely from the availability indicator.
5. Revoke any superseded credential still active, and review provider usage for unexpected requests. Remove obsolete private configuration copies according to the owner's retention policy.
6. If the value entered Git history, rotate first, then coordinate history cleanup and downstream copies with repository owners. Do not force-push or rewrite shared history without explicit authorization.

## Release inspection

Before publication, inspect tracked source, newly added files, generated client assets and the release archive for real credential values and known token patterns. Report matches by filename and category without printing secret values. Exclude private configuration, local databases, object-store state and generated diagnostic logs from the release.

The release verification record should state the date, scope and result of the actual scan. This document describes the procedure and does not claim a scan has run.
