# RecallScope pitch source

`build.mjs` authors the eight-slide pharmaceutical pitch using editable native PowerPoint text, shapes and three tables. It contains the complete layout and slide copy, including speaker-note sources. It uses no screenshots or raster artwork. The pitch is a separate deliverable from the narrated product video.

The published files are [the editable deck](../../RecallScope-Pharma-Pitch.pptx) and [the PDF](../../RecallScope-Pharma-Pitch.pdf). They open without the authoring runtime. The PDF retains selectable text and vector graphics.

## Authoring dependencies

Rebuilding requires the **Codex bundled artifact runtime** and the Codex **Presentations skill**. The original build used bundle `26.930.11008` and `@oai/artifact-tool` version `2.8.84`. That package declares itself private. It is not vendored here, and this repository does not assume a public `npm install` is available.

Use Codex's `load_workspace_dependencies` tool to locate the supplied Node executable, Python executable and Node package directory. Locate the installed Presentations skill separately through the skill inventory. The source resolves these paths from environment variables and does not change the product's dependencies.

The native typefaces are **Segoe UI** and **Georgia**. Install or provide these fonts in the authoring/rendering environment before reproducing the intended typography. The application keeps its existing fonts and CSS.

Set these environment variables to the paths supplied by the local runtime and skill inventory:

| Variable | Value |
| --- | --- |
| `RUNTIME_NODE_MODULES` | Bundled Node package directory containing `@oai/artifact-tool` |
| `CODEX_ARTIFACT_PYTHON` | Bundled Python executable used by the validators |
| `CODEX_PRESENTATIONS_SKILL_DIR` | Installed Presentations skill directory containing `container_tools/` |

No API credential is required. No network request, application deployment or Git operation occurs during this build.

## Build

Run with the bundled Node executable, from the repository root:

```sh
node docs/media-source/pitch/build.mjs --check
node docs/media-source/pitch/build.mjs revision-1
```

Here `node` means the executable returned by the runtime inventory. `--check` validates runtime imports and validator paths without authoring files. Use a new revision name for each build. The finalizer intentionally refuses to overwrite an existing final revision.

The source writes drafts, per-slide previews, layout records and a checked PPTX under the ignored `.cache/pharma-pitch/` directory. It does not overwrite the published pitch automatically.

The build performs package integrity, geometry, typeface and import checks. Inspect every rendered slide before copying a new revision into `docs/RecallScope-Pharma-Pitch.pptx`. The quantitative example uses one product and batch, with all quantities in boxes: 1,000 received, 600 historically dispatched, 600 returned, 1,000 current stock in quarantine and zero outstanding. Returned stock is already included in current stock.

## PDF export

The published PDF was exported from the finalized PPTX by the installed Microsoft PowerPoint application, then rendered with Poppler for visual inspection. To reproduce it, open a validated PPTX and use PowerPoint's PDF export. Preserve native text and vectors. Do not print slide previews or convert screenshots to PDF.

All eight pages were inspected in both the artifact renderer and the native PowerPoint PDF output. Package inspection found no embedded media assets, and PDF inspection found no embedded images. These authoring checks are separate from the product's software test results.
