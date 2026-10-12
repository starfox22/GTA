# Jump fences and into the sea

- A running jump now vaults walls and railings up to 1.5 m (a hand on the top): the Monarch Isle villas' garden
  walls (1.35 m) and railings (1.41 m), the sea railing along the quays (1.49 m), pitch boards, fountains and the
  showroom's counters. A jump at a walk, or a standing hop, still clears only what it did (1.05 m); privet hedges,
  tennis-court and street-end fences and the squares' 1.5 m railings still stop it.
- A jump off a quay, a sea wall, rocks or a dock carries on into the sea: a splash, no harm, and he swims (out again at
  a ladder or a beach as before). Bridges and the fishing pier still keep you on them.
- The jump's take-off grunt is a natural adult male "huh" (arther1974's jump grunt, CC0) in place of the Quake one.
- Internals: `jumpVaultAhead`, `JUMP_VAULT_MAX` (player-jump.js THE VAULT), `villaWallHeight` (monarch-towers.js,
  mirrors what monarch-villas3d.js draws), `PROMENADE_RAIL_HEIGHT`; water.js lets a jump off the shore and
  `updateSwimming` waits for a jump's fall (`fall.jumped`). `jumpReport()` counts `vaults` and `intoWater`;
  `jumpObstacles()` lists sea railing runs and marks `vault`.
