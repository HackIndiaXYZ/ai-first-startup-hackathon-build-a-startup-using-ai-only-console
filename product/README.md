# RecallScope application

Follow the [project README](../README.md#run-locally) for first-time setup and the source-record walkthrough. A normal clone runs on Windows, macOS or Linux with Node.js 24 LTS (minimum 22.13), without a Codex or Sites plugin.

## Commands

Run these from this directory after installing dependencies and applying the initial local database schema as described in the project README:

- `npm run dev` - start the local app with live updates.
- `npm test` - run the domain and provider checks without paid API calls.
- `npm run build` - build the Worker and browser assets.
- `npm run typecheck` - check TypeScript (build first in a clean checkout).
- `npm start` - preview the built Worker locally; this does not deploy it.
- `npm run test:api` - check the running app's API in isolated sessions.

The AI connection is optional for the sample workflow and reviewed CSV import. See [provider configuration](../README.md#connect-live-ai) for Fireworks and OpenAI. Keep keys in the ignored `.env` file.

## Code map

| Location | Responsibility |
|---|---|
| `app/` | Trace workspace, source review, import and reports |
| `app/api/` | Session-scoped workspace, extraction, import and source-file routes |
| `lib/domain.ts` | Trace calculations, reviewed ingredient links and fixed reports |
| `lib/import-records.ts` | CSV parsing, validation and reviewed record import |
| `lib/ai-extract.ts` | Fireworks/OpenAI extraction adapters |
| `lib/store.ts` | D1 snapshots and R2 originals |
| `db/`, `drizzle/` | Database schema and migration |
| `tests/` | Domain, provider and API verification |

## Framework and local state

The app retains the Vinext/Cloudflare Worker starter and its supporting components. Local D1/R2 data is stored in ignored `.wrangler/`; tool metadata is stored in ignored `.sites-runtime/`. Do not publish either directory.

A clean checkout defaults to the portable execution profile. Only when working through the Sites plugin should its owner follow that plugin's execution-profile and hosting workflow. No plugin path is required for ordinary local setup or GitHub Actions.

The existing `.openai/hosting.json` declares the logical D1 and R2 bindings. Runtime access controls, hosted resources and provider secrets still need to be configured before a public deployment. The implemented browser session is not a team authentication system.

See the root [architecture and limits](../README.md#architecture-and-limits) and [validation record](../docs/VALIDATION.md) for the actual supported behavior. Retained starter examples and optional sign-in helpers do not imply that RecallScope uses those features.
