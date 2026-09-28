# The Blue Hour hotel (mission 2's set)

The hotel on Palm Keys block (-4, 4): `ROOFTOP` (geography-regions.js), door on its south
face at (-1664, 2622). Game logic: roofmission-*.js (missions-and-demo.md). Meshes:
world3d-bluehour-terrace.js, world3d-bluehour-table.js, world3d-bluehour-entrance.js,
included from world3d-resort.js inside one IIFE (their helpers are private; only
`updateBlueHourVisuals` comes out, called from `updateWorldVisuals`).

## Terrace (world3d-bluehour-terrace.js)

- One look: teak deck, travertine, brass, navy velvet, cream. Roof-local units, deck top at
  y 2.8, a guest's feet at 3; `PERSON_HEIGHT` 14 units, table tops ~0.78 m, seats 0.5 m.
- Every solid piece stands inside its `roofCover` footprint (collision and the guards'
  sight). Loungers, troughs and lanterns stand only in the 14-unit band along the
  balustrade, which `roofPointFree` keeps everyone out of. New furniture elsewhere would be
  walked through: add a `roofCover` entry (a gameplay change: sight and routes) or keep it
  in the band.
- The group is in `batchGroups` (one draw per material). Anything that moves or hides must
  sit under a `userData.dynamic` group (the reserved glass does). Clear glass (balustrade,
  canopy, door) is transparent and so not batched: a handful of draws. Halos are sprites
  (one draw each): keep them few.
- Glassware is opaque `crystal` (double-sided, batched) with an open bowl so the drink
  shows from above.

## The VIP table and the reserved glass (world3d-bluehour-table.js)

- Centre of the `table` cover (273, 131 roof-local), 1.85 m across, cloth to the deck,
  four settings, flowers, two hurricane candles, champagne in a bucket, four velvet chairs.
  East is left open: Vescari stands at `ROOF_HIT.seat`/`sip` to lift the glass.
- The reserved glass sits at `ROOF_HIT.drink` and is drawn a little large on a gold
  coaster; a pulsing gold ring and the RESERVED label show while it is the target (on the
  roof, not yet spiked, Vescari alive) and hide with it (`glassTaken`).

## Street entrance (roofmission-entrance.js, world3d-bluehour-entrance.js)

- One plan, `BLUE_HOUR_ENTRANCE`: forecourt, glass canopy (cantilevered, no posts), red
  carpet, topiary planters, rope posts, kerb bollards, lantern standards, valet stand, the
  staff posts and the two limousine bays. The renderer, the collision and the kept-clear
  pavement all read it.
- `blueHourForecourt(x, y)` keeps street furniture off the forecourt (cityscape3d-roofs.js
  `clearSidewalk`): a bus shelter with its painted bus box, news boxes, a bin and meters
  stood at the door before. Every forecourt spot is tested before any `cityRandom()` draw,
  so the rest of the city's furniture is unchanged.
- The fixtures are foot obstacles (registered once from `populateBlueHourEntrance`); the
  pavement between the planters and the kerb stays open for the walk past the door.
- Two doormen and a valet are North Point Key-style staff (`spawnKeyStaff`, their own
  `keyPerson.lines`), fixed to their posts.
- The limousines (black and pearl) are ordinary parked cars (`blueHourLimo`) nose to tail
  west of the door; the east kerb stays free for mission 2's ambulance (stop x -1618).
  The player may steal one like any parked car. A missing one is parked again at a new
  game and when mission 2 starts, only out of view. Console `blueHourEntrance()`.
