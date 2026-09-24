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

## Iteration 4: second merge (v30 HUD, controls, stadium), chase fairness, CPU

- Merged the lead branch again: the v30 HUD draws stars through `renderStars()`
  (hud.js); it now takes the pending star (flashing red) and the search state (earned
  stars grey and pulse), and the heat meter and body count sit under the stars in the
  new status column. Stadium kills by the player now go through `recordKill` (a
  civilian death in the heat model) instead of a flat `crime(0.35)`.
- Weak: 3-star avenue run in a muscle car: cruisers coming the other way drove nose to
  nose into it at full speed (160 to 100 health in one hit), then five spin-outs in 15 s.
  Fixed: a cruiser facing the runner head-on brakes to a crawl and angles across the lane
  (a rolling block to swerve round); after any spin-out no unit tries contact for 3.5 s.
  Re-run: the same run met a Union St roadblock at full speed, stopped dead (a muscle car
  cannot shove a braced cruiser) and the cut's crew shot the car apart: working as
  designed; a runner has to turn off.
- Weak: the tank at 5 stars killed its own SWAT and agents (S3 F2 to S1 F1 in 6 s). It now
  holds fire while any officer or police vehicle is within 150 units of the player.
- Weak: after a clear, police helicopters could not relaunch for 45 s, so a player who
  stole a helicopter at 4 stars in a new incident flew away unopposed in 21 s. A
  stand-down now costs 12 s; only a helicopter shot down costs 45. Re-run: first air
  unit on scene in ~9 s, second at ~15 s, the marksman hit the player's helicopter
  (220 to 112 in 12 s). Police rounds no longer hit their own helicopters.
- Weak: two quick civilian kills out of sight in Palm Keys (the relocated district)
  stayed at 1 star: the search cooled the heat below the second star's threshold during
  the 1.5 s escalation. Fresh heat (last 8 s) is no longer cooled. Re-run: 2 stars 1.5 s
  after the second kill, four cruisers and five officers in Palm Keys within 8 s.
- Law units stood down by a clear were counted again by a later incident and never sent
  home; recalled traffic patrols vanished after a clear. Both fixed.
- WASTED/BUSTED: 4.2 s slow-motion sequence (grey world, red WASTED / blue BUSTED title
  above the v30 HUD styles). Headless screenshots cannot catch it (a capture takes longer
  than the sequence); verified from the page's computed styles at the moment of death.
- CPU, idle machine: police logic at 5 stars (23 officers, 16 cruisers, 2 SWAT vans,
  2 agents' SUVs, a tank, 2 helicopters, 3 roadblocks) was 7.7 ms per step, mostly
  line-of-sight tests every frame for every unit. Sight and gang checks are now staggered
  at about 7 Hz per unit: 2.3 ms per step (vehicle physics is 14.7 ms of a 24 ms step).
- No-god run through Broadway with the assault rifle: 3 civilians 1 star; 3 officers
  2 stars at 8 s (the next stars land after their escalation delays); 9 officers 4 stars;
  10 officers 5 stars at 23 s; dead at 25 s under two helicopters, SWAT and agents. A
  second run in Midtown reached 5 stars alive with 32 health.
- Harbor: the Ironworks guards stand behind cargo stacks that stop rounds but not the
  sight test used by the play-test helper, so the scripted harbor fight could not land
  hits; not a combat bug, noted for anyone scripting harbor tests.

## Screenshots

Taken with `graphics('high')` on the persistent headless page and copied to
`dist/combat-qa/` (git-ignored): `star2-onfoot.png` (2 stars, patrol crews out),
`star2-palmkeys.png` (v30 HUD with heat meter and body count), `star3-carchase.png`
(flank and PIT cruisers on Royal Ave, roadblock notice), `star4-swat-onfoot.png` (SWAT
vans, searchlight, marksman warning), `star5-tank-feds.png` (tank, agents' SUVs, SWAT,
two helicopters), `busted.png`.

## Honest assessment (end of this pass)

- Escalation: proportional and legible. Stars follow the body count and who died; each
  new star flashes before it lands and brings a visibly different response.
- Combat on foot: fair and readable (firing tokens, peeking cover, hit markers, damage
  direction arc, staggers, headshots); limited by the top-down aim and by the crowd
  renderer's pose set (no crawl or limp animation for the wounded).
- Chase: cruisers intercept, flank, block, PIT, recover when stuck and search the
  area; roadblocks, helicopters with a marksman, SWAT and a tank arrive by tier. Still
  grid-bound: no off-road shortcuts, county roads use the simpler county router, and
  there is no police boat.
