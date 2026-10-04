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
- **Search clock** (citylife-civic.js SEARCH CLOCK, `PURSUIT_SEARCH_SECONDS` 5/7/10/14/19 s by
  stars): it runs out of sight once the first unit reached a reported scene; at full speed outside
  the search circle, at `SEARCH_ZONE_RATE` (0.25) inside it, not at all while units are still on
  their way to a 911 call (`policeResponseHolding`). The HUD countdown shows only while it runs at
  full speed (`searchClockShown()`); otherwise the panel says why (LEAVE THE SEARCH AREA, UNITS
  RESPONDING). Sight is debounced: a sighting restarts the clock after 0.3 s of sight (a glimpse
  only re-centres the circle on the player), a search starts after 0.6 s out of sight. A crowd tip
  or a witness who sees the player re-centres the circle (and adds a little time).
- Wanted chips (NEED TO LOSE POLICE, POLICE CLEARED) only on a real drop;
  `policeBlocksMissionDelivery` lists the mission stages that need zero stars.

## Witnesses and 911

- Moved to docs/areas/police-and-combat-witnesses.md (who calls, the call, the response to
  a report, `witnessReport`).

## Response (pursuit.js)

- `POLICE_TIERS[stars]` says what each star sends: patrols that arrest (1), contact tactics
  (PIT, box) and shooting (2), the unarmed helicopter and a roadblock (3), SWAT vans (4),
  federal agents, army jeeps, an APC, a truck and after `TANK_AFTER_SECONDS` the tank (5).
- `OFFICER_KINDS` (patrol, road, swat, fed, soldier, sniper): hp, vest (`plate`), fire rate, damage to
  NPCs vs the player (`playerDmg`), `run` pace (the player's 25 km/h run outpaces them all).
- `dispatchPolice` / `spawnPursuitUnit` spawn off-camera on roads ahead of the player;
  `pursuitControl` drives (lead, PIT, flank, block, search along routes, off-road shortcuts);
  county pursuits use the GPS road graph (`policeNavRoute`).
- **Steering aids** (pursuit-steering.js): a straight run at a destination (in sight within
  420, or a shortcut) only when `roomToTurn` (within ~60° of the nose, and the way ahead open
  for the braking distance), else the road route; `routeCornerSpeed` brakes for the route's
  corners (a roundabout ring's polyline gives its own radius; full brakes when over it);
  `carInPath` makes a unit aim past traffic in its path (never the quarry) and back out of
  one it is shoving. A unit backing out swings its nose toward the target (the yaw follows
  the steer whichever way the car rolls).
- **The police helicopter is unarmed** (combat-rules.js POLICE HELICOPTER, `AIR_UNITS_MAX`
  one at a time): it tracks, lights and reports, never fires, and is blind to a player under
  overhead cover (`airCanSee`). Its searchlight lands on the roof over a covered player
  (rendering-lighting.md, Searchlights).
- **Rooftop snipers are off**: `SNIPERS_ENABLED = false` (swat.js) gates every spawn, laser,
  beep and caption; true restores them (rules: combat-rules.js SNIPER FIRE).
- Roadblock cruisers are plain 1.6 t bodies on locked brakes (`parkedFriction`): momentum
  decides who gets through; one shoved > 1 m is knocked loose.
- **Sight** (`policeSightRange`, citylife-police.js): 440 units (55 m) by day; after dark a
  figure on foot is picked out from ~40 m on the lit city streets and ~32 m in the county, a
  car from ~51 m; heavy rain takes up to a fifth off; a unit already on the player keeps
  them 20% further in the dark or rain, never past the day's 55 m. The air unit keeps its own rule (`airCanSee`). `policeReport().sightRange`.
  Traffic pulls over for units under lights (people-and-crowd-living-city.md).
- Radio (`policeRadioEvent`, pursuit-dispatch.js): besides the tier lines, `lost` when the
  search starts, `spotted` when it finds the player again (street and what they are in), and
  `policeDescribeSuspect`: a new car (or the player out of one) seen for 1.5 s while wanted
  is called in once ("SUSPECT SWITCHED · NOW IN A RED PICKUP"); 5 s between captions.
- Rain affects pursuit drivers too (vehicles-and-driving.md). A respray clears the stars only
  if no unit saw the player drive in.

## Shooting and wounds

- Shooting from a vehicle (arcs per window, the rear screen, the pose): docs/areas/police-and-combat-driveby.md.
- One 3D world for all gunfire: elevation-aware shots (combat-rules.js), `shotBlocked()`
  against the building grid, `bulletTargets` from the 64-unit pedestrian grid plus
  `sportsTargets()` and other venue lists.
- LETHALITY (combat-rules.js): firearms are lethal (one or two torso rounds). NPC vests by
  calibre and hit zone, shots to kill: docs/areas/police-and-combat-armour.md; the player's
  `player.armor` keeps `VEST_SHARE` per damage kind.
- Wounds (wounds.js): hit zones, flinch, limp, blood trail (blood itself: police-and-combat-blood.md), downed officers dragged to cover,
  `chooseDeathFall` (backwards, face down, slumped against a wall). A round never moves anyone (no shove alive, no
  step back when killed); only blasts, vehicles, knives and punches do.
- Firing kicks the view against the aim (`kickCamera`, by the round's weight; camera-feel.js).
  Nobody shoots the player from off screen: `shooterInView` (police-and-combat-ammo.md).
- Melee and FISTS live in arsenal.js (`meleeAttack`; `playerUnarmed()` tells the crowd the
  player is harmless).
- Carjacking: carjack.js (occupants with sex, age and temper, locked doors, the ejection,
  lines; the driver's 911 call is `witnessReport(driver, 'carjack', ...)` when they appear)
  and carjack-struggle.js (`player.carjack` phases approach > door > reach > tug > pull >
  enter, then `enterVehicle`). `crime(0.8, 'carjack')` fires when the door is yanked open,
  plus enterVehicle's own; the street gets `crowdAlarm('carjack')`. Over 24 km/h or no way
  to the door (`planCarjack`): the same phases cut short (`job.quick`), the car braking;
  only bikes, boats and aircraft get the instant `ejectDriver`. Gotcha: about a third of
  traffic is locked (E says LOCKED), which is not the carjack failing. Anything that moves
  or resets the player calls `cancelCarjack()` (teleportPlayer, die, resetMissionState).
- Armour: `vehicleArmorShare` (the Apache takes 30% of small arms). The tank turret
  (`traverseTurret`) is shared by the player, the pursuit tank, army gunners and the mounted
  guns (police-and-combat-mounted.md).
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
