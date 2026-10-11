# Bloodier hits, directional blast blood, a jump grunt, no Exchange underpass

- A round now throws a visible spray of blood into the air along the shot (fine droplets on top of the drops that
  land), and flying drops are drawn streaked and at least a couple of pixels across, so the spray reads from the
  street camera as well as the chase view. A slightly larger entry puff.
- A car or rocket blast beside someone drives the blood out of the far side of the body, away from the blast, in a
  cone that tightens and carries further the closer it went off (spatter fanning up to ~3 m beyond, splashes on a
  wall or car behind); no more burst in all directions. The player's own blood from a blast goes the same way.
- Jumping on foot gives a short breathy "huh" (a recorded LibreQuake grunt, BSD-3, credited), pitch and level varied.
- The Exchange underpass (the cut-and-cover tunnel on the street at x 2688) is gone: an ordinary street again, with
  no walls, roof, portal signs, map "U" or air-cover volume. The misplaced CENTRAL GARDEN sign in Midtown is gone.
- Internals: `bloodShotPlan().air`, `bloodBlastPush` / `BLOOD_BLAST_CONE` / `BLOOD_BLAST_REACH` (blood.js),
  goreHit's `power`, `hurt(d, kind, a)`, `FX_BLOOD_MIN_PX` / `FX_BLOOD_STREAK` (fx3d-particles.js),
  player-jump-audio.js `jumpEffortSound` (`jumpReport().effort`); console `bloodFlight(x, y, a, radius)`; test
  tools/tests/blood-spray.mjs.
