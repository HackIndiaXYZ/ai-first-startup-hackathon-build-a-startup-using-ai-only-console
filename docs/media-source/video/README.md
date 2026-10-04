# RecallScope coded film source

This is the complete renderer for the separate **4:11 pharmaceutical product film**: 1920 × 1080, 60 fps, H.264 video, professional AI narration, eight chapters and optional English captions. The final film is [here](../../RecallScope-Pharma-Demo.mp4); the [caption file](../../RecallScope-Pharma-Demo.srt) is also available separately.

Every visual is drawn from code. The product scenes reconstruct the implemented pharmaceutical interface using native Canvas text, paths and shapes, with camera movement, highlights and changing record values. No webpage screenshot, raster illustration or slide image is a renderer input. The final MP4 is conventional encoded video, so it can play in ordinary video players. It is a narrated visual demonstration of authored scenarios, not a recording of user interaction or a live AI extraction benchmark.

## Files

| File | Purpose |
| --- | --- |
| `product-ui.cjs` | Faithful coded product views and scenario states |
| `film.cjs` | Eight scenes, motion, cameras and narration anchors |
| `graphics.cjs` | Drawing, typography and animation helpers |
| `timeline.json` | Measured speech, section boundaries and action cues |
| `narration-script.json` | Exact selected narration |
| `narration.wav` | Final edited voice, used as the assembly input |
| `captions.srt` | Optional English captions |
| `render.cjs` | Frame reviews and parallel section rendering |
| `assemble.cjs` | Concatenation, audio normalization, chapters, captions and full decode verification |

## Rebuild

Use Node.js 24. Install these independent media dependencies in this directory:

```sh
npm ci
npm run frames
npm run render
npm run assemble
```

Outputs go to the ignored `.cache/qa/` and `.cache/renders/` directories. The assembled file is `.cache/renders/RecallScope-Pharma-Demo.mp4`. Nothing overwrites the published MP4 or changes the application automatically.

Windows reads Segoe UI and Georgia from `C:/Windows/Fonts`. Other environments must provide licensed copies in a directory specified with `FONT_DIR` (the filenames are listed in `render.cjs`). Fonts are not redistributed. The product keeps Segoe UI; Georgia is used only for editorial video titles.

`FFMPEG_PATH` can select an existing FFmpeg executable instead of the installed `ffmpeg-static` binary. `FILM_WORK_DIR` can select another output directory. Use `node render.cjs --section 4` to rebuild one chapter, or `--from 110 --duration 6 --out preview.mp4` for a short motion review. A two-worker full render is the default.

## Narration and synchronization

The voice was generated with **Higgsfield Seed Audio / Grady** at its natural rate. Four narration clips cover two chapters each. Clean takes were selected, then 20 measured silent gaps were shortened to 0.46 seconds. All retained PCM segments matched their source hashes. No spoken audio was sped up, slowed down or pitch shifted.

The final track contains 0.8 seconds of opening hold and 2 seconds of closing hold, plus frame alignment padding. Eight section boundaries align to 60 fps. Fifteen measured phrase cues and further word anchors drive the approval click, scenario changes and other animation. Captions use measured words with corrected brand spelling. Assembly normalizes the voice toward −16 LUFS with a −1.5 dBTP target and creates a selectable caption track; captions are not burned over the interface.

No API key or provider access is required to reproduce the film from the included voice. Regenerating speech would require a separately authorized provider request and a new timing pass.

## Scenario continuity

All organisations and records are fictional. The film explicitly switches between the completed workspace, an available-batch receipt and an active recall example:

- The traced paracetamol batch has 1,000 received and 600 historically dispatched boxes across four customer sites and two warehouses.
- Amoxicillin has the same printed batch code but remains a separate product identity.
- Reviewing a 40-box receipt for another available paracetamol batch changes available stock from 400 to 440.
- In the active recall, a further 20-box return changes returns from 100 to 120, outstanding from 500 to 480 and quarantined stock from 500 to 520.
- The completed example has 600 returned and 1,000 currently quarantined boxes. Historical dispatches are not added to current stock. Stock disposition remains a separate decision.

The vector pitch is a [separate authoring project](../pitch/README.md).
