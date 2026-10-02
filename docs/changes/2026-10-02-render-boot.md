# Render and boot pass: staged tier switch, cell pre-upload, boot timings
- Player-visible: pressing ENTER no longer stalls for ~0.3 s turning the 65 sound samples from base64 into bytes
  (`initAudio`); changing the graphics tier or the shadow setting on a GPU that compiles in parallel no longer
  relinks ~45 lit programs in one frame (they are compiled behind the frames and the shadows come on 1-3 s later);
  crossing into a new map cell uploads its geometry ahead of the camera in slices of ~1.5 MB; AUTO resolution stops
  hunting between two scales (it holds below the one that was too much, 30 s then longer) and every tier change
  reallocates the post targets once instead of up to four times.
- Memory: each sign's two canvases (2 MB) are freed once uploaded (the pre-upload sends the nearest signs); `onBoulevard` and
  `roadPerformance` cost less at start-up (identical results).
- Internals: lit state (`litStateFor`, `setLitFlags`, `applyLitState`, `stageLitSwitch`, lighting3d-look.js) and
  `prewarmShaders(stage)`; `postWarmPasses(all)`; lazy `sizePostTargets` / `postSceneTarget()`; CELL PRE-UPLOAD
  (`cellWarmTick`, render3d-resources.js); shadow-depth stand-ins for meshes with a custom depth material
  (`prewarmShadowSamples`); `bootMark()` marks; `roadPerformance` stops integrating once a probe is too slow.
- New console: `bootTimings()`, `adaptiveSim(plan)`; `renderHiccups()` gains `litStage` and `cells.preUpload`.
- Docs: docs/areas/boot-and-memory.md (boot timeline, soak results, tier change). Tests: render-tier-switch.mjs,
  render-auto-scale.mjs (they need the 3D renderer and do nothing on the no-render page).
