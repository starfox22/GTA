# Repeatable branch reviews and rendered evidence

- Codex continues on `codex/chase-clouds-polish-2026-10-12` for future prompts, per the owner's instruction. Updated main is brought into this branch; main itself requires explicit owner approval.
- `tools/test.mjs --exact` selects complete test names/filenames so two manifests cover all 208 tests without substring overlap. `--shadercheck` now forwards Three.js shader-error reporting into rendered pages, including fresh reloads.
- `tools/military-render-review.mjs` and `tools/motorcycle-render-review.mjs` capture real frozen-build frames through named developer methods, with input hashes, console errors and frame-fault reports. The military tool also checks every preset in both cameras and the actual wheel-finish char shader.
- Production-function tests cover triangle conservation, rolling centres, source axle calibration, punctures/handling, military kit sharing, damage material lifecycle, mission-world preservation and job/modal cleanup. New offline axle/metadata tools retain the full existing vehicle pack and atlas.
- Split oversized HUD, campaign and model documentation into linked area files; record credits, contracts, exact test evidence, normal-play outcomes and remaining hardware/human acceptance work in the October 13 audit and handoff.
