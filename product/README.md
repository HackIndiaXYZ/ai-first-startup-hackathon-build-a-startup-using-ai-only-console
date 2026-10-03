# RecallScope application

Follow the [project README](../README.md#run-locally) for first-time setup and the pharmaceutical source-record walkthrough. A normal clone runs on Windows, macOS or Linux with Node.js 24 LTS (minimum 22.15), without a Codex or Sites plugin.

The public product is pharmaceutical-only. `/` opens the distribution workspace and the former `/bakery` route redirects there. Legacy records and their schema remain preserved separately; the former interface remains in Git history.

## Commands

Run these from this directory after installing dependencies and applying the initial local database schema as described in the project README:

- `npm run dev` - start the local app with live updates.
- `npm test` - run the domain and provider checks without paid API calls.
- `npm run build` - build the Worker and browser assets.
- `npm run typecheck` - check TypeScript (build first in a clean checkout).
- `npm start` - preview the built Worker locally; this does not deploy it.
- `npm run test:api` - check the running app's API in isolated sessions.

The AI connection is optional for guided examples and reviewed CSV import. See [provider configuration](../README.md#optional-live-ai-extraction) for Fireworks and OpenAI. Keep keys in ignored local configuration or private hosting secrets.

## Code map

| Location | Responsibility |
|---|---|
| `app/pharma/` | Pharmaceutical catalogue, stock, trace, intake, recall and report interface |
| `app/api/pharma/` | Workspace, intake, team access, evidence and exchange routes |
| `lib/pharma/domain.ts` | Product-specific stock ledger, serial custody, recall accounting and fixed reports |
| `lib/pharma/intake.ts`, `templates.ts` | Reviewed CSV records and no-key guided examples |
| `lib/pharma/providers.ts` | Optional Fireworks/OpenAI extraction proposals |
| `lib/pharma/store.ts` | Versioned D1 records, protected R2 files and hosting-backed access |
| `db/`, `drizzle/` | Database schema and migration |
| `tests/` | Domain, provider and API verification |

## Framework and local state

The app retains the Vinext/Cloudflare Worker starter and its supporting components. Local D1/R2 data is stored in ignored `.wrangler/`; tool metadata is stored in ignored `.sites-runtime/`. Do not publish either directory.

A clean checkout defaults to the portable execution profile. Only when working through the Sites plugin should its owner follow that plugin's execution-profile and hosting workflow. No plugin path is required for ordinary local setup or GitHub Actions.

The `.openai/hosting.json` identifies the Site and declares the logical D1 and R2 bindings. Hosting manages audience and server-side provider secrets separately. A global daily AI request allowance is enforced atomically in D1 and configured with `AI_DAILY_REQUEST_LIMIT` (default 30; 0 pauses requests). Guest workspaces are isolated; organisation membership and server-enforced roles use the hosting sign-in integration.

See [how it works](../README.md#how-it-works) and the [pharmaceutical verification record](../docs/PHARMA-VALIDATION.md) for supported behavior. Legacy modules and regression checks preserve earlier records without adding another public product interface.
