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

## Iteration 2: shooting back, fairness, dispatch

- Weak: at 5 stars a pistol hit nothing for 100 rounds while standing among eight
  officers at 70-130 units. The officers were crouched wholly behind cruiser bodies
  (cover at the car's corner still hid them from a round fired at knee height). Fixed:
  cover is a peek: a patrol officer crouches behind the far corner while waiting and
  steps out past it only while holding a firing token, so they can be shot exactly when
  they are shooting. SWAT and agents hold off the flank at rifle range.
- Hit feedback added: a white cross over the victim (red on a kill) with a tick, a thump
  on a kill, and HEADSHOT for a precision-rifle round on the target it was aimed at
  (one shot, round the vest). Incoming fire shows a red arc on the side it came from,
  with a small camera jolt.
- Too lethal: at 3 stars, standing still in the open with 100 health and no armour, the
  player lasted about 5 s after first contact (100, 84, 18, dead). Tuned: player damage per
  police round (pistol 5.5, SWAT rifle 5 per round of a 3-round burst, agents 6.5, marksman
  14, before the 2.05 lethality scale), accuracy 0.42 (1 star) to 0.6 (5 stars), firing
  tokens 2/3/3/4/5. A first shot at a newly seen target, a fast-moving runner, range and
  a stagger all spoil the roll; misses go visibly wide.
- Weak: 2-star pursuit spawned one cruiser in 18 s while a sports car drove off; the
  player was clear in ~20 s. Fixed: patrol cars already cruising within 1100 units
  are recalled into the pursuit first; each new star sends two units in a burst; spawn
  cadence 7/4.5/3.8/3.2/2.8 s; spawns try the five best road junctions (ahead of a
  moving runner) instead of giving up on one blocked one.
- Weak: 1 to 5 stars took 17 s of shooting (heat 125 by then). Thresholds are now
  12/32/72/125 and each extra star flashes 1.5/2.5/4/6 s before it lands, so a massacre
  still climbs one readable step at a time.
- Law units (SWAT vans, agents' SUVs, the tank) joined city traffic after a clear. They now
  wait where they are and are sent home once out of sight.
- CPU at 5 stars (23 officers, 14 cruisers, 2 SWAT, 2 agents, a tank, two helicopters),
  headless under a load average of ~30: `civic` (all police logic) 8.0 ms per step vs
  `cars` 16.9 ms; at 0 stars on the same machine `civic` was 1.9 ms. Police parts are now
  timed separately in `stats()` (`police:officers`, `police:wanted`, `police:roadblocks`,
  `police:air`). `clearSight` walks the building grid and rejects the county solids by
  bounding box instead of scanning every building.

## Iteration 3: merge of the world relocation (Palm Keys west, BRIDGES in geography.js)

- Merged `claude/compassionate-wright-cu2e1q`; only DEVELOPMENT.md conflicted (both
  console tables kept). Roadblock sites already come from `BRIDGES` and the road grid.
- Re-verified natural escalation on the merged world (Old Quarter, rifle): 2 civilians
  1 star; 2 officers 3 stars at 12 s; 5 officers 4 stars at 16 s; 8 officers 5 stars at
  23 s; SWAT, agents, two helicopters and two roadblocks all present at 5 stars.
- 3-star avenue chase on Royal Ave: two cruisers ran alongside and ahead (flank and block)
  and a third came in on the rear quarter; the sports car was boxed and down to 46/110
  health in 8 s.
- Weak: boxed in by cruisers with the throttle held, the player climbed from 2 to 3 stars
  in 8 s: each shove counted as ramming a police car. Now only a real ram (closing
  speed over 110) counts, once per cruiser per 4 s.
- Evasion: broken contact at 2 stars and left the search area: stars cleared after 9 s.
  Inside the area the clock runs at a fifth of the speed (`LEAVE THE SEARCH AREA`).
- BUSTED at 1 star: one pistol shot into the air, stood still; two cruisers arrived,
  four officers walked up with challenge lines and cuffed the player in 11 s; released at
  Police HQ with the fine.
