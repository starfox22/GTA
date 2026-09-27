---
name: publish-game
description: Build Dead End City and publish it to its claude.ai artifact link (and optionally the zip). Use when the user asks to publish, update the link, release or ship a build.
---

1. `sh tools/quick-check.sh publish` must pass. Run `node tools/smoke.mjs dist/publish/index.html dist/smoke`
   after step 2 when the change touched boot, rendering, input or HUD (0 errors expected; the
   three.js "build/three.js deprecated" warning is normal).
2. `python3 tools/build.py --split-media dist/publish` (page ≤ 16 MB, each media file ≤ 15 MB).
3. Artifact tool, action publish:
   - `url`: https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B
   - `file_path`: dist/publish/index.html
   - `files`: `{"media/<file>": "dist/publish/media/<file>"}` for EVERY file in
     dist/publish/media/ (`ls` it): the nine radio `.mp3`s and the `pack-*.js` media packs
     (images, sounds, model data). A missing pack means missing textures or sounds.
   - a short `label` naming the release.
   If the tool refuses because this session has not read the live page, do NOT read the 13+ MB
   page and do NOT ask: the owner has given standing permission (2026-09-26) to overwrite this
   link. The live page is always an earlier build of this repo (the game never saves itself
   into the page), so publish again at once with `force: true`, and mention in your reply that
   the previous version was overwritten. This permission covers only this artifact URL.
4. Release notes: `python3 tools/changelog.py --release <version> "<Title>"` folds
   docs/changes/ fragments into docs/CHANGELOG.md; bump `GAME_VERSION` in src/game-state.js
   when the user asks for a new version number.
5. Zip for downloads (GitHub release): `python3 tools/build.py --zip dist/DeadEndCity.zip`.
6. Commit and push the source changes (never dead-end-city.html), then give the user the link.
