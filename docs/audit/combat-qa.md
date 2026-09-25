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

## Iteration 5: wounds, pursuit off the grid, five-star CPU

Wounded bodies (new `src/wounds.js`, poses in crowd3d.js and render3d.js):

- Every damaging hit records a zone (head 12%, torso 58%, legs 30%; a precision-rifle
  headshot is always the head) and the direction of the round. Pedestrians and the box
  models of officers, gangs and guards play a 0.4 s flinch: the torso knocked away from
  the round (forward when shot from behind), a head snap for a head hit, a buckled knee
  for a leg hit. A leg hit (or dropping under 30% health) leaves a limp: officers move at
  60% speed with a short stride on one leg; pedestrians use the existing limp gait.
- Deaths used to snap flat in one frame, all the same way. They now fall over 0.55 s
  (accelerating) along the line of the shot: over backwards when facing the shooter,
  face down with the arms thrown forward when facing away, one in three spun round as
  they drop; with a wall within 30 units behind them they stagger back into it and slide
  down into a sitting slump. A blast or a car throws the body; a round only knocks it
  back a step.
- About one fatal-looking body hit in three leaves an officer (one in four a bystander)
  alive on the ground instead, for most of a kill's heat and none of the body count
  (a later death adds the rest). Downed officers stop shooting and crawl for their
  cruiser on their elbows; a partner without a firing token runs over and drags them
  backwards into cover behind the car, facing the threat. Downed bystanders crawl away
  from the shooter for a few seconds (prone crawl pose) and then lie groaning.
- Anyone wounded who keeps moving leaves a trail of drops (one every 13 units, for 40 s).
- Play-test (Old Quarter, pistol, 2 to 5 stars, 10 officers shot): `wounds` in
  `policeReport()` showed 19 dead on their backs, 3 face down, 6 spun, one officer downed
  and dragged into cover by his partner, limping and bleeding officers. No slumps in that
  street fight (the shooting was mid-road, walls over 30 units away).

Pursuit off the grid:

- Off-road shortcuts: a cruiser drives straight at the runner or its search point when
  the whole line within 700 units is open ground (sampled every 24 units: land, nothing
  solid), across parks, plazas and lots. The escalation test counted 16 shortcuts in
  28 s of city pursuit; the county test 10 in 24 s.
- County roads use the map's GPS graph (`navigationGraph` and A*, navigation.js) instead
  of the old county node BFS. Stonecreek test: a shot fired, 2 stars; four cruisers came
  in from 700-840 units along the county roads and deployed eight officers within 9 s.
- Water pursuits: police launches (1 at two stars, 2 at three, 3 from four) spawn out of
  sight on open water, ahead of a boat under way; they lead the boat, feel ahead for the
  shore and turn to open water, back off a quay when pinned, run 15% faster than a
  speedboat, come alongside 70 units off the beam at two stars and ram from three, and
  the deck crew fires (5.5 per round to the player). A helicopter joins from two stars on
  the water. Marlow Bay test at full throttle: the first run (launch spawned behind) let
  the speedboat escape in 12 s; after spawning launches ahead, the helicopter and launch
  kept contact for the whole 30 s run and the launch closed to 290 units and fired.

Five-star CPU (the coordinator measured vehicle physics at 14.7 ms of a 24 ms step):

- Contact relaxation ran all seven passes over every pair and every static candidate.
  Passes after the first now revisit only bodies a contact moved in the pass before.
  Parked roadblock and deployed cruisers and cold wrecks sleep like parked cars. Barrier
  bodies are built once per step instead of per vehicle per pass. Static contact
  candidates are cached per car until it moves 8 units.
- Each bullet tested every vehicle on every 7-unit sub-step, and `shotBlocked` spread
  five solid lists into a new array per sub-step. Bullets now test only vehicles near
  their flight segment and walk the lists in place.
- `solid()` with a radius above 8 (pursuit whiskers, spawn checks) scanned every building
  in the city; it now walks the building grid cells the box touches. `countyBlocked`
  no longer spreads arrays. Cruisers over 800 units away plan at 3 Hz instead of 10.
- Same 5-star scene (16 cruisers, 2 SWAT, 2 agents, 2 helicopters, 3 roadblocks, ~20
  officers, 212 vehicles), same load band (load average 13-18 on 4 shared cores):
  before, 20.2 ms per step with `cars` 11.0 ms (contacts 4.0, control 2.9, broadphase
  1.1) and `bullets` 2.1 to 8.1; after, 15.0 ms per step with `cars` 7.6 ms (contacts
  1.1, control 2.5, broadphase 1.5) and `bullets` 0.5. Later samples on the same page
  swung between 20 and 45 ms as other agents' browsers loaded the machine, but contacts
  stayed at a quarter to a third of control time (before: 1.4 times it).

Re-verified natural escalation on this build (Old Quarter, rifle, god mode): 2 civilians
1 star; 3 officers 2 stars at 6 s; 5 officers 3 stars at 11 s; 4 stars at 17 s; 5 stars
at 21 s with SWAT, agents, two helicopters and three roadblocks.

## Iteration 6: one helicopter at a time

Owner request: never more than one helicopter chasing the player. `AIR_UNITS_MAX = 1` in
`src/combat-rules.js` caps every source: the wanted tiers, the chase at sea (from two
stars) and mission air support (mission 1's cargo chase takes over the helicopter already
overhead instead of launching a second). Four and five stars now escalate on the ground and
through the marksman instead of a second airframe.

Police response by wanted level (`POLICE_TIERS`, src/pursuit.js; updated in iteration 7):

| Stars | Patrols | SWAT vans (team) | Agents' SUVs | Army (5 stars) | Tank | Rooftop snipers | Helicopter | Marksman lock / lead / rest | Roadblocks | Officer accuracy | Surrender |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 0 | 0 | - | 0 | 0 | 0 | - | 0 | 0.42 (no deadly force) | always arrested |
| 2 | 4 | 0 | 0 | - | 0 | 0 | 0 (1 at sea) | 1.6 s / 0.85 / 2.4-3.4 s at sea | 0 | 0.46 | always arrested |
| 3 | 5 | 0 | 0 | - | 0 | 0 | 1 | 2.6 s / 0.75 / 5-7 s | 1 | 0.50 | stand still: hold fire, cuff (2 officers) |
| 4 | 5 | 2 (4: shield + stack) | 0 | - | 0 | 0 | 1 | 2.4 s / 0.85 / 4.5-6.5 s | 2 | 0.55 | stand still: hold fire, cuff (2 officers) |
| 5 | 5 | 3 (5: shield + stack) | 2 | 2 gunner jeeps, then 1 APC (4 soldiers), 1 truck (5) | 1, after 45 s at 5 stars | 1 now and then (2 after 150 s) | 1 | 2.2 s / 0.90 / 4-6 s | 3 | 0.60 | only a player under 25 health |

Since the prompts-and-HUD pass the marksman and the rooftop snipers fire a visible tracer at
where they guess the player will be (`lead`: the most of the player's motion over the flight
time they lead, drawn from 0.3 upwards), so standing still is a hit and running, zigzagging
or turning usually a miss; breaking line of sight still resets the lock. A hit takes 50
health before armour (combat-rules.js SNIPER FIRE). Headless, 3 stars, helicopter marksman,
90 s each (god mode): standing 8/8 hits, running in circles 0/10, zigzag sprint 0/7,
walking straight 3/6. A 3-minute five-star run: one rooftop sniper (at most one on the
roofs), two rounds, then gone.

Verified headlessly (`wanted`, `simulate`, `policeReport`):

- 5 stars on foot in the Old Quarter, 64 s sampled every 8 s: exactly one air unit
  throughout (arriving at 0 s, tracking from 8 s) alongside 17 cruisers, 3 SWAT vans,
  2-3 agents' SUVs, the tank and 3 roadblocks.
- Mission 1 cargo chase at 3 stars raised to 5: one air unit (the mission's), never two.
- 4 stars in a speedboat on Palm Sound, 42 s: one air unit, which searched, gave up and
  retreated before a single replacement launched; never two on duty at once.

## Iteration 7: owner requests (fists, fair heat, arrest, five stars, tank gunnery)

Changes: fists (arsenal.js, controls.js, render3d.js), a friendly crowd for an unarmed
player (crowd.js), surrender and arrest (pursuit.js), heat only from crimes (heat.js,
crowd.js, military.js, physics.js), SWAT teams and rooftop snipers (new swat.js,
render3d.js), the five-star army (pursuit.js), tank turret and ammunition (new armor.js),
shell breaches (damage.js, damage3d.js). Verified headlessly on one persistent page
(`simulate`, `policeReport`, `nearbyPeople`, `ride`, `damageStats`, synthetic key and mouse
events).

- Fists: Q from the pistol cycles KNIFE, FISTS, 9MM PISTOL, KNIFE; ` selects FISTS; the chip
  shows the drawn fist (UNARMED · WEAPONS AWAY, PUNCH). Three punches on a civilian: 30 to
  23 health (a combination knocks down, rarely kills), three assaults logged by
  `meleeAttack`, 1 star. Before the damage was tuned two punches killed a civilian.
- Unarmed crowd: sweeping the mouse over a pavement for 19 s with fists: 0 hands up, 0
  fleeing; the same sweep with the pistol drawn: 3 hands up, 5 fleeing.
- Arrest (the reported bug): at 3 stars in a stopped car officers kept shooting (a car was
  only arrestable at one or two stars) and the player died; at 3 and 4 stars on foot a lone
  officer could not cuff; every crew shouted "YOU ARE UNDER ARREST" even at 5 stars. After:
  standing still for 1.5 s is a surrender. BUSTED at 1 star on foot in 9 s and in a car in
  6 s, at 3 stars on foot in 3 s and in a stopped car in 21 s, at 4 stars on foot in 9 s
  and in a car in 15 s. At 5 stars the crews shout DROP YOUR WEAPON / TARGET ENGAGED.
- Heat without crimes: Fort Sentinel added 0.8 heat every 4 s to anyone within 600 units
  while its alarm ran, so stars climbed with no new crime; now nothing adds heat passively.
  Witness calls count only within 30 s of the crime (of the kill, for a body found later).
- Pursuit without crimes: any contact of the player's car with another car was a crime
  (`crime(0.06)`, even being rear-ended), and so was nudging a pedestrian at walking pace;
  a scrape also made an army truck "attacked by the player" (a Fort Sentinel lockdown) and
  a car scraped minutes earlier the player's wreck. Now only ramming an occupied car above
  ~85 km/h closing speed, or hurting someone (20 km/h and up), is a crime. `stageCrash` on
  an avenue at 3, 6, 12 and 45 m/s (the launch decays before contact): 0 heat; at 70 m/s:
  1 star. A 90 s drive and walk through Northbank with no violence: 0 stars (the
  straight-line test pilot then drove over a crowded pavement; those knock-downs are logged
  and do count).
- Five stars, 60 s on foot in Midtown (god mode): 2 gunner jeeps at 6 s, the APC at 12 s,
  the truck at 24 s, the tank at 48 s; 3 SWAT teams with shields, 3 rooftop snipers (34
  rounds in 60 s, each after a 2.4 s laser), 9 or 10 soldiers. A pistol round at a shield
  man from in front: `shieldBlocks` 1, no wound.
- Tank: the turret turned 0 to 142 degrees at a steady 30 deg/s with an eased start (8
  degrees in the first half second) and stop; 40 rounds, a second shot 0.1 s after the
  first refused, the next accepted after 5 s; the right button fires 10 MG rounds a second.
  Three shells into a Northbank facade: 3 breaches, about 130 world decals, rubble in the
  street, 8 windows broken, 700 debris chunks (the pool cap, recycled).
- CPU at 5 stars (44 officers, 17 cruisers, 3 SWAT vans, 3 agents' SUVs, 4 army vehicles,
  3 snipers, a helicopter, 3 roadblocks) under a load average of ~15: police:officers 4.8 ms
  and police:wanted 4.3 ms per frame against cars 31 ms. Gunner and sniper sight tests are
  staggered at about 8 Hz.

Screenshots in dist/combat-qa/iteration7 (not committed): `fists-hud.png`, `swat-van.png`
(doors open, POLICE · S.W.A.T., the stack behind the shield), `rooftop-sniper.png` (the
laser from a roof), `tank-breach.png` (shell impacts on a facade, the reticle ring and pip,
shell ammunition on the chip).

Known limits: kiosks, bus shelters and walls are not separate breakable objects, so a shell
only flattens the street furniture round it (lamps, benches, bins, hydrants); buildings
never collapse. Rooftop snipers are only placed in the city grid.

## Screenshots

Taken with `graphics('high')` on the persistent headless page and copied to
`dist/combat-qa/` (git-ignored): `star2-onfoot.png` (2 stars, patrol crews out),
`star2-palmkeys.png` (v30 HUD with heat meter and body count), `star3-carchase.png`
(flank and PIT cruisers on Royal Ave, roadblock notice), `star4-swat-onfoot.png` (SWAT
vans, searchlight, marksman warning), `star5-tank-feds.png` (tank, agents' SUVs, SWAT,
two helicopters before iteration 6), `busted.png`. Iteration 5 adds
`wounds-closeup.png` and `wounds-falls.png` (bodies down after a pavement shooting, the
pending second star flashing red, LEAVE THE SEARCH AREA).

## Honest assessment (end of iteration 5)

- Escalation: AAA. Stars follow the body count and who died, wounding counts as well as
  killing, each new star flashes before it lands and brings a visibly different response
  (patrols, contact tactics, air and roadblocks, SWAT, federal agents and armor).
- Chase: close to AAA. Cruisers intercept, flank, block, PIT, recover from spins and
  walls, cut across open ground, search the area around the last sighting, follow the
  county roads, and the water is no longer an escape hatch (launches and a helicopter).
  Still missing: police motorbikes, cruisers that shoot from the window while driving,
  and launches have no light bar of their own (boats3d draws them as white speedboats).
- Combat on foot: good, not quite AAA. Fair incoming fire, firing tokens, peeking cover,
  hit markers, directional damage arc, staggers, zone flinches, limps, varied falls,
  crawling wounded and dragged officers all read well; the limit is the top-down aim and
  the box-model officers (no real ragdoll: falls are procedural rotations, so a body never
  folds over a car bonnet or tumbles down steps).
- Performance: five stars no longer dominated by contact passes or bullets; the whole
  police layer costs about as much as the pedestrian crowd.
