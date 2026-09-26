---
name: publish-game
description: Build Dead End City and publish it to its claude.ai artifact link (and optionally the zip). Use when the user asks to publish, update the link, release or ship a build.
---

1. `sh tools/quick-check.sh publish` must pass. Run `node tools/smoke.mjs dist/publish/index.html dist/smoke`
   after step 2 when the change touched boot, rendering, input or HUD (0 errors expected; the
   three.js "build/three.js deprecated" warning is normal).
2. `python3 tools/build.py --split-media dist/publish` (page must stay under 16 MB).
3. Artifact tool, action publish:
   - `url`: https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B
   - `file_path`: dist/publish/index.html
   - `files`: `{"media/<name>.mp3": "dist/publish/media/<name>.mp3"}` for each of island-colada,
     island-dub, lofi-freeway, lofi-hooptie, lounge-heists, lounge-martini, oddball, rock, synth
     (list dist/publish/media/ to confirm the set; add any new streamed track).
   - a short `label` naming the release.
   If the tool refuses because this session has not read the live page, do not read the 13+ MB
   page: ask the user whether to overwrite, and only with their explicit yes publish again with
   `force: true`.
4. Release notes: `python3 tools/changelog.py --release <version> "<Title>"` folds
   docs/changes/ fragments into docs/CHANGELOG.md; bump `GAME_VERSION` in src/game-state.js
   when the user asks for a new version number.
5. Zip for downloads (GitHub release): `python3 tools/build.py --zip dist/DeadEndCity.zip`.
6. Commit and push the source changes (never dead-end-city.html), then give the user the link.
