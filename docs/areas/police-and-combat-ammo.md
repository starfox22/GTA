# Guns, ammunition and who may fire

Where the player's weapons and rounds come from (ammo-supply.js), and the rule that nobody
shoots the player from off screen (combat-rules.js ON-SCREEN RULE). Part of
police-and-combat.md.

## Supply (ammo-supply.js)

- **No pickups on the street at all** (no ammo, armour, weapon or health boxes; the
  `pickups` list is gone). Health is bought indoors through the service menus
  (citylife-police.js `serviceAction`): hospital treatment $150 to full (SAINT MARLOW,
  RIVERSIDE MEDICAL, THE HALCYON CLINIC), a diner plate +45 / coffee +12, a bar meal +30, a
  club break +20, a motel, the safehouse or a county LODGE bed to full, and a LODGE's hot meal
  +35 ($25; `countyLodge(p)`). Nothing is sold for nothing: treatment and food
  (`SERVICE_CURES`) at full health and armour already full are refused with a line ("You’re
  already in good shape.", "Your body armor is already full.") and no charge, the counter left
  open, as full ammunition is; sleep and the club are never refused. "Full" is as the HUD rounds
  it (`Math.ceil`). `tools/tests/health-indoors.mjs` checks all of it.
- **Gun shops** sell weapons, refills (`PRICES`, `AMMO_PRICES`, citylife-places.js) and body
  armour ($350): SOUTH COAST ARMORY in Northbank (door 876, 410, a few blocks from missions 1
  and 2) and the county OUTFITTERS (terrain-scenery.js). The door prompt reads
  `<name> · GUNS, AMMO & ARMOR`; the action key opens the counter (not while wanted).
- **Bodies**: anyone who carried a gun can be searched once while the player stands over
  them (`LOOT_REACH` 22 units, same floor) with the action key. `bodyLoot(p)` works out what
  they had once (`p.loot`), so the prompt (`TAKE <GUN> · n RDS`, game-ui.js) and the take
  agree: patrol, roadblock and shield officers a 9 mm with one or two magazines; FBI agents
  the machine pistol; SWAT and soldiers the assault rifle (two to four magazines); a rooftop
  marksman the precision rifle; gang members and mission gunmen the machine pistol with what
  is left in it and at most one spare; the Blue Hour's guards and dealership security a
  pistol. The party's host carries nothing. A gun that fired (`muzzleAt`/`lastShotAt`) is
  part empty. Nothing is drawn on the ground (a dead body has no weapon in the renderer).
  A new gun comes as found and is selected; an owned one takes the rounds in reserve, up to
  ten magazines (`RESERVE_MAGS`). `p.looted` marks the body.
- The take is a 0.6 s crouch (`player.lootUntil`, `lootCrouching()`): the kneel pose
  (crowd3d-special.js), feet held in game-update.js. A clock that went back never holds it.
- **Police vehicles** (`takeVehicleArms`, from `enterVehicle`): the first time the player
  gets into a patrol car (a box of 9 mm: pistol reserve up to 48), a SWAT van (assault
  rifle up to 150, given if not owned; shotgun shells to 24, SMG to 90, pistol to 48) or an
  FBI SUV (machine pistol up to 90, given if not owned; rifle 90, shells 24, pistol 48).
  Only owned weapons are topped up besides the one each gives. `c.armsTaken` makes it once
  per vehicle (set only when something was taken); a `tell` line lists what came aboard.
  Army vehicles and the police marine launches carry nothing for the player.

## ON-SCREEN RULE (combat-rules.js)

- `shooterInView(shooter, inset = 20)`: nobody fires at the player on the ground unless
  they stand inside the street camera's visible ground (`screenViewHalf()`: the orthographic
  frame, `clamp(viewportHeight * 0.68, 430, 630) / worldZoom` tall, laid on the ground by
  the street pitch) round `cameraTarget` (the view leads toward the aim on foot and down the
  road in a car), less the inset. Off screen they may run toward the player; they hold fire.
- Everyone who shoots the player uses it: patrol officers, SWAT, FBI, roadblocks, pursuit
  gunners, Fort Sentinel's soldiers, towers and tanks, gang members and mission gunmen
  (`updateGangFights`, story.js) and the Blue Hour's guards (roofmission-scene.js). Police
  follow the same rule as gangs: one fair rule for every shooter. In the air or under a
  parachute it is off (the flight view shows far more).
- `shotLog()` counts every round aimed at the player with `onScreen` from the same test, so
  `offscreen` should stay 0 for every source.
- **In the chase view** (chase-camera.js; `chaseCameraLive()`) the view is the chase camera's
  frame (chase-rules.js FIRE): the shooter's chest (`chaseChestHeight`: 0.72 of a person, 0.6 of a
  vehicle's height) inside the frustum less the inset in px (`chaseSees`), no deeper than
  `CHASE_FIRE_REACH` (150 m), and not hidden from the camera behind a building (`chaseHiddenFrom`: one
  march through the building grid with heights; a building the camera stands in does not count).
  Behind the camera, off the frame's sides, beyond the reach or round a corner: hold fire. The air
  exemption is unchanged. The soft lock (`playerShotTarget`) is then whoever is within 38 px of the
  reticle (or the cursor) through `chaseProject`, for every device (`chaseShotTarget`). Console
  `viewRules(x, y)` (`shooter`, `shooterInset`, `hiddenFromCamera`); tools/tests/chase-shooter.mjs.
- Gang fire between factions, and at the police, is not limited by the screen.
