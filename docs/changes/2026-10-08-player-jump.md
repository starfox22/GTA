# Jump on foot
- Space now jumps on foot: a short crouch, a 0.5 m hop of about 0.65 s carrying the run, the legs tucked (lead leg
  forward, trail leg folded) and a knee-bent landing with a soft footfall. Low walls, benches, loungers, bins,
  hydrants, bike racks, bollards and railings up to about 1 m are cleared (a 1 m railing only at the top of a
  well-timed running jump); walls, fences and guardrails taller than that still stop him. No double jump, a short
  cooldown, and no jump while aiming over the shoulder, swimming, seated, carjacking, looting or aboard anything.
- Space on foot no longer fires (the mouse, F and the pad's RT still do); in a vehicle it is still the handbrake and
  in the Apache the rockets. The jump is its own action (Settings · Controls · Jump), the pad's Y on foot (it still
  skips a ride), and on touch the JUMP button beside ACTION. A jump off a quay or a drop carries on as a fall.
- Fort Sentinel's barriers, the theme park's pools and the Marea club's ropes and glass stay solid at any height.
- Internals: player-jump.js (`player.jump` carrier, released by `teleportPlayer`/`die`; `playerJumpPose()` for the
  rig, `applyJumpLimbs` in crowd3d-special.js); solid() skips heighted solids below `solidSkipBelow` only inside the
  jumping player's own step (game-collision.js `footSolid`/`footFurnitureBlocked`); foot furniture takes a `jumpH`.
- Console: `jumpReport()`, `jumpObstacles(x, y, radius, count)`; integrity's carriers list `jump`; test
  tools/tests/player-jump.mjs.
