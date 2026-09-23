# Combat and pursuit QA log

Play-tests of the wanted system, police response, pursuit driving and on-foot combat,
driven headlessly through the developer console (`simulate`, `fireShot`, `nearbyPeople`,
`policeReport`, `steerTo`, `drive`). Natural escalation was verified first (crimes only);
`wanted(n)` was only used afterwards to isolate one tier. Screenshots were taken with
`graphics('high')`; the machine was heavily shared (load average 30 to 90 on 4 cores), so
absolute CPU timings below are only comparable within one measurement.

## Iteration 0: baseline (29.0.0)

- Six pistol shots on an Old Quarter pavement with bodies on the ground: 1 star, still 1
  star forty seconds later. Stars climbed only through `wantedPressure` plus a 16-28 s
  delay per star; a kill counted for nothing by itself (only the gunshot and a witness
  call).
- One patrol spawn every 5 s up to `2 x stars + 1` cars; roadblocks only at 4-5 stars;
  one helicopter at 4 stars; nothing heavier at 5 stars.
- Cruisers steered straight at the target or at a grid route; contact tactics only at 4
  stars; no stuck recovery (a cruiser pinned on a wall stayed pinned).
- Officers stood at 180 units and fired a 35-damage round every 1-1.5 s with a 0.045 rad
  jitter: a stationary player was hit by almost every round, three hits killed.
- No arrest: the police shot at one star; death was the only outcome.
- Ten seconds out of sight cleared any level, wherever the player stood.

## Iteration 1: heat model, tiers, pursuit AI, arrest

Changes: `src/heat.js` (heat by severity, kills by victim, spree bonus, stars from heat,
HUD), `src/pursuit.js` (tiers, dispatch, pursuit driving, officer combat, arrest, tank,
radar search area), multi-helicopter marksman (combat-rules.js), tiered roadblocks with
SWAT crews (roadblocks.js), rifle/helmet/light-bar models (render3d.js).

Findings from the play-tests:

- Old Quarter, on foot: two targeted pistol kills on a crowded pavement dropped three
  civilians (heat 20.5): 1 star at the first kill, 2 stars 1.2 s later, 3 stars 2 s after
  that once five were dead. Proportional, readable (the pending star flashes red).
- 1 star, one shot into the air, no resistance: two patrol cars arrived in ~12 s, four
  officers walked up with the challenge line and cuffed the player: BUSTED, released
  at Police HQ with the fine.
- 3 stars standing still in the open: helicopter overhead with its searchlight, patrol
  crews out of their cars; the player (100 health, no armour) was dead in ~7 s.
- Weak: at 2 stars the player drove away before a single cruiser saw them; the search
  radius (340) was left in two seconds and the stars cleared in ~20 s. Fixed: burst
  dispatch on each new star, spawns 520-1250 away and ahead of a moving runner, a search
  radius of 300 + 120 per star, and the escape clock runs at a fifth of its speed inside
  the search area (`LEAVE THE SEARCH AREA`).
- Weak: search cruisers drove straight at a search point behind a building, hit the wall,
  reversed, repeated. Fixed: `routeToward` drives the road network unless the point is
  close and in plain sight; a route never turns back for a junction already passed.
- Weak: 100 pistol shots at officers killed none. Two causes: auto-aim picked the
  helicopter overhead, and officers crouched fully behind their cruisers. Fixed: auto-aim
  penalises aircraft; cover is at the car's corner (covered, gun arm out). Patrol vests
  lighter (25; two pistol hits), SWAT unchanged (120; four to five).
- Weak: 19 officers at 4 stars all fired at once (firing squad). Fixed: firing tokens,
  three at one star to seven at five, reshuffled every two seconds; officers without a
  token move up on the flanks instead.
- Police pistol rounds wrecked a moving muscle car in ~20 s. Police rounds now do 45% to
  the player's car, and 55% of the rounds that hit a car also wound the driver.
- HUD: the body count overlapped the clock under the stars; moved into the WANTED LEVEL
  eyebrow, heat meter positioned under the stars without adding height.
