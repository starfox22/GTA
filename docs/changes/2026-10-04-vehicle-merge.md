# Fewer draw calls per car
- An untouched civilian car draws in 13 calls instead of 22, a police car in about 12 fewer, with the same picture:
  its static parts are merged per material while nothing has touched it (damage, blood, mud, fire or the player at
  the wheel bring the separate parts back). A street full of parked and passing cars costs about a third fewer
  vehicle draw calls on every graphics tier.
- Console: `vehicleMerges()`, `vehicleMergeAudit()`, `lookSwitches({ vehicleMerge })`; `hitchRun(..., draw)`;
  `node tools/merge-scenes.mjs` (draw counts with the merge on and off).
