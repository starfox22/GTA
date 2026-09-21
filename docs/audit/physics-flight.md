# Audit report: physics, combat rules, arsenal, air cover, parachute, aviation

## Fixed
- aviation.js `planeControl` wreck branch: a destroyed plane fell toward absolute altitude 0 instead
  of local terrain, so wrecks over the mountains sank underground and oscillated. Uses terrainHeight.
- physics.js: when the player's aircraft was destroyed mid-air, `hurt(1000)` was silently ignored
  while `player.inv > 0`, leaving the player standing in the sky. Invulnerability is cleared first.

## Noted (fixed later in this pass where marked)
- game.js `die()` in a flying helicopter left the helicopter hovering forever (FIXED: sets abandonedFlight).
- aviation.js `flightMissionStart` index 10 removes nearby planes without excluding the player's (FIXED).
- combat-rules.js: a retreating air unit within 1650 units suppresses replacement dispatch (rare).
- physics.js: some aircraft checks compare absolute altitude to constants rather than clearance;
  harmless while all airfields sit at height 0.
- arsenal.js: a knife swing on the rooftop mission raises the alarm like a gunshot (likely intended).
- physics.js `boxContact`: no NaN guard; no NaN source was found.

## Feel notes
- Courier take-off needs ~390 units of runway at full throttle; climb and trim are stable.
- Idle glide oscillates around stall and repeats the STALL warning every 4 s.
- Helicopter landing refuses within ~5 units of any shoreline segment.
- Abandoned helicopter wrecks rest on collider tops ~22 units above the visible roof.
