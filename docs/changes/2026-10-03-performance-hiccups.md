# Fewer hiccups: a frame-by-frame hunt
- The HUD no longer rewrites unchanged attributes on every refresh (the context strip, the speed box, the radio
  buttons, the contact portrait, the notice feed): about a third of the DOM mutations standing still, half driving.
- Docking a prompt or a headline no longer forces a whole-page layout in the middle of the HUD pass.
- The skid marks and contact shadows send only what is drawn to the GPU (up to 184 KB and 57 KB a frame before).
- New car models are built under a 3 ms budget a frame, so a street full of new traffic never lands in one frame.
- Console: `hitchRun`, `frameTrace` (every frame's sections and what happened in it: collections, uploads, programs,
  models, DOM mutations, audio nodes, storage writes), `uploadChurn`, `cityMap`; `node tools/hitches.mjs` runs a fixed
  tour per tier and `--ab` compares two builds; `node tools/dev.mjs metrics`.
