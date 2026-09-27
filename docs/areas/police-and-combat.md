# Police, combat and damage

heat.js, witnesses.js, pursuit.js, citylife.js (officers, `policeSees`, `clearPolice`),
police-feedback.js, swat.js, roadblocks.js, combat-rules.js, game-combat.js, arsenal.js,
wounds.js, carjack.js, damage.js, air-cover.js. `policeReport()` has `wounds` and `crimes`
(`crimeLog`); methods: docs/console/police.md.

## Heat and stars (heat.js)

- `crime(amount, how)` is **the only way heat rises**; nothing adds it passively. Kills count
  by victim (`recordKill`, `recordVehicleKill`) with a spree bonus. Stars are read off heat at
  `HEAT_STARS` (12 / 32 / 72 / 125), one flashing step at a time; heat cools only out of
  sight. `setWantedLevel(n)` forces a level.
- `how`: omitted (or a kind hint such as `'gunfire'`, `'carjack'`) = decide by who knows;
  `'seen'` = scripted, the stars rise regardless (base alarms, mission stages in
  challenges.js, roadblock rams, stealing the Apache); an object `{ x, y, kind, caller }` =
  a witness report reaching dispatch. New scripted crimes that must raise stars need `'seen'`.
- Wanted chips (NEED TO LOSE POLICE, POLICE CLEARED) only on a real drop;
  `policeBlocksMissionDelivery` lists the mission stages that need zero stars.

## Witnesses and 911

- Moved to docs/areas/police-and-combat-witnesses.md (who calls, the call, the response to
  a report, `witnessReport`).

## Response (pursuit.js)

- `POLICE_TIERS[stars]` says what each star sends: patrols that arrest (1), contact tactics
  (PIT, box) and shooting (2), the unarmed helicopter and a roadblock (3), SWAT vans (4),
  federal agents, army jeeps, an APC, a truck and after `TANK_AFTER_SECONDS` the tank (5).
- `OFFICER_KINDS` (patrol, road, swat, fed, soldier, sniper): hp, vest, fire rate, damage to
  NPCs vs the player (`playerDmg`), `run` pace (the player's 25 km/h run outpaces them all).
- `dispatchPolice` / `spawnPursuitUnit` spawn off-camera on roads ahead of the player;
  `pursuitControl` drives (lead, PIT, flank, block, search along routes, off-road shortcuts);
  county pursuits use the GPS road graph (`policeNavRoute`).
- **The police helicopter is unarmed** (combat-rules.js POLICE HELICOPTER, `AIR_UNITS_MAX`
  one at a time): it tracks, lights and reports, never fires, and is blind to a player under
  overhead cover (`airCanSee`). Its searchlight lands on the roof over a covered player
  (rendering-lighting.md, Searchlights).
- **Rooftop snipers are off**: `SNIPERS_ENABLED = false` (swat.js) gates every spawn, laser,
  beep and caption; true restores them (rules: combat-rules.js SNIPER FIRE).
- Roadblock cruisers are plain 1.6 t bodies on locked brakes (`parkedFriction`): momentum
  decides who gets through; one shoved > 1 m is knocked loose.
- Rain affects pursuit drivers too (vehicles-and-driving.md). A respray clears the stars only
  if no unit saw the player drive in.

## Shooting and wounds

- One 3D world for all gunfire: elevation-aware shots (combat-rules.js), `shotBlocked()`
  against the building grid, `bulletTargets` from the 64-unit pedestrian grid plus
  `sportsTargets()` and other venue lists.
- LETHALITY (combat-rules.js): firearms are lethal (one or two torso rounds); `vest` is the
  NPC counterpart of `player.armor`; `VEST_SHARE` per damage kind.
- Wounds (wounds.js): hit zones, flinch, limp, blood trail, downed officers dragged to cover,
  `chooseDeathFall` (backwards, face down, slumped against a wall).
- Melee and FISTS live in arsenal.js (`meleeAttack`; `playerUnarmed()` tells the crowd the
  player is harmless).
- Carjacking: carjack.js (occupants with sex, age and temper, locked doors, the ejection,
  lines; the driver's 911 call is `witnessReport(driver, 'carjack', ...)` when they appear)
  and carjack-struggle.js (`player.carjack`: round the car, door, tug, swing,
  `enterVehicle`). `crime(0.8, 'carjack')` fires when the door is yanked open, plus
  enterVehicle's own; the street gets `crowdAlarm('carjack')`. Over 14 km/h, bikes, or no
  room at the door: the instant yank. Anything that moves or resets the player calls
  `cancelCarjack()` (teleportPlayer, die, resetMissionState).
- Armour: `vehicleArmorShare` (the Apache takes 30% of small arms). The tank turret
  (`traverseTurret`) is shared by the player, the pursuit tank and army gunners.
- Mission vehicles (`mission = true`) burn down to 8% and go out instead of exploding; they
  take 40% of gang small-arms damage.

## Overhead cover (air-cover.js)

- `overheadCover(x, y, elevation)` answers "is there a roof over this point": one grid of
  overhead volumes (rail decks, platforms, the underpass) plus roofs the renderer registers
  with `registerOverheadCover()` (cutaway roofs, awnings, canopies, garage bays).
  `overheadCoverHeight` gives the roof's height. Used by police air sight, searchlights,
  rain shelter and the cutaway. Keep both functions' signatures: other code relies on them.

## Damage and destruction (damage.js, damage3d.js)

- Damage is data on the entity (damage3d.js only draws it). `damageVehicle(vehicle, amount,
  x, y, source, detail)` takes hp, the rest goes to `recordVehicleDamage()`; `detail.kind`:
  `crash` crumples along the normal, `blast` dishes toward the blast, `bullet` marks the skin.
- `vehicle.dents[]` are `{x, y, z, nx, ny, depth, r}` in vehicle space (x forward, y right,
  z up); nearby dents merge. `damage.front/rear/left/right` (0..1) drive panels, glass,
  lamps, tyres and `damage.pull`. `vehicleHandling(c)` turns damage into power, grip and
  steering pull. Below 25% health the engine burns to the explosion; `wreckVehicle` guts once;
  `repairVehicle` / `freshDamage` reset.
- Breakable street furniture and trees register as they are placed
  (`registerStreetProp(kind, x, y, yaw, options)`); a prop breaks when the vehicle's kinetic
  energy along the normal plus earlier strain reaches its `breakKJ` (table in damage.js
  BREAKABLE FURNITURE AND TREES). A tank crushes anything. Props stand again after four
  minutes out of view. Breakables stay instanced (`breakableGroup`, `flushBreakables`);
  toppling rewrites instance matrices (`PROP_FALLS`). Nothing allocates per frame.
- Decals: one procedural atlas; `worldDecals` is a 2400-slot ring buffer; vehicle decals are
  rebuilt from `damage.marks`.
- Console: `park()`, `shootAt()`, `blast()`, `crashTest()`, `damageReport()`, `repair()`.
