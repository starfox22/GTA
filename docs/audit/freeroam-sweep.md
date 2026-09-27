# Free-roam sweep (QA, September 2026)

A systematic pass over free roam on every island, mostly on the no-render dev page
(`node tools/dev.mjs`, named console methods), with rendered shots at 1280x800 and at
390x844 in touch mode, and one boot of the demo build (`--nodev`, `?test`).

## Method

- **Islands**: `godTeleport` + `simulate` + `status` / `promptState` on Northbank (Old
  Quarter, Midtown, North Point, the Reclamation), North Point Key, Sunset Pier, Palm Keys
  and its beach, the airport and Southport, Stonecreek, Northridge, Eastgate, the Ridgeline
  peaks, Oceanview, Palmshore, Fort Sentinel, Crown Avenue and Regency on Monarch Isle.
- **Doors**: all 38 `PLACES` doors (`layout().doors`): prompt text and key, E opens the
  service panel (or the Blue Hour lift), Escape closes it.
- **Vehicles**: enter, drive, reverse, exit for sedan, bike, bicycle, SUV, bus, truck,
  police, taxi, speedboat, jet ski, workboat, helicopter, plane; aircraft refuse an exit in
  the air; the player's car blown up with the driver inside (god mode).
- **Police**: `wanted(1..5)` escalation (patrols, SWAT, FBI, army, air, roadblocks),
  `godLosePolice`, units going home once out of sight, BUSTED (a stolen patrol car), a
  respray while seen (kept the stars, by design), the cool-down search.
- **Services**: bike share (72 stations on every island; rent, ride, dock rule), a cab with
  the ride skip, the car radio, MONARCH MOTORS purchase, Sunset Pier rides (the Falcon and
  the Eye), pickups (all reachable), swimming off the Palm Keys beach.
- **GPS**: `route()` from Northbank to every island (all reach the destination or the
  nearest road approach: Sunset Pier, the airport apron, Fort Sentinel's gate).
- **Settings**: rebinding interact / bail / ascend changes every prompt (payphone, TAKE OFF,
  plane hints); `reload --keep` (new) shows cash, clock, bindings and settings restored.
- **Long idle**: 12 game hours in 60 s steps (day, night, dawn, a front coming in, a forced
  night storm): vehicles 251-254, pedestrians 495-627 by time of day, dogs 4-42 (morning
  walkers), browser RSS flat at ~1.53 GB, no NaN in 45 report methods, no console errors.
- **Text**: literal key names, common misspellings, debug output, place-name variants.
- **Tools**: `layout-audit` (59 oblique county / Monarch junction notes, no overlaps; the
  documented 28-39 predates the scenic-road fillets), `media-check` (9 tracks, 0 failed).

## Found and fixed

- WASTED always woke the player at Saint Marlow, even beside Riverside Medical on Palm Keys
  or on Monarch Isle: now the nearest hospital, named in the toast (`nearestHospital`).
- A swimmer out of strength lost 8 hp/s and drowned before the 14 s harbor patrol rescue
  unless armored: 5 hp/s lets an unhurt swimmer be fished out ($100).
- Nothing saved free-roam cash, ammo or the clock until the next event save: pausing (and
  leaving the tab, which pauses) now saves.
- The god teleport put the player on a mountain face (Ridgeline 8000, 1500) where they slid
  and fell to their death: `godWalkable` refuses ground steeper than `SLIP_GRADE`.
- Literal keys in text: free-roam toasts (over the side, a sinking car, cab and rail fares,
  the pitch invader, touchdown, engine fire), 20 mission stage lines, the landing divert (V)
  and the rail panel now use `keyName()`.
- The player climbed out of the passenger side; NPC drivers and carjacks use the driver's
  door (a - 90 degrees): the player now does too.
- Touch: a tapped radio kept `:hover` / `:focus-within`, so after its pop it stayed unfolded
  in the 150 px chip with every label cut; only `.open` unfolds pop boxes in touch mode.
- Phone settings: short labels kept their keys beside them, long ones below (zig-zag).
- Phone HUD: "HEALTH 100" wrapped onto two lines under the minimap; the police escape
  timer covered the mission card while it was unfolded (it steps aside until the card
  folds; the stars stay); a docked headline sat under the minimap and weapon row (it fades
  on phones).
- Flight HUD: the IAS / ALT captions were unreadable over pale paving (text shadow).
- God panel said "armour", the HUD "ARMOR"; `places()` gave NaN for YOUR SAFEHOUSE; the
  superyacht comment said 105 m for a 66 m deck.
- Pickups stood only on Northbank (13): 13 more on the other islands and county towns.
- The Blue Hour lift moved the player with `Object.assign`, not `teleportPlayer` (the one
  way to move the player).

## Checked, fine

Island spawns and districts; every door prompt; enter / exit of every class; boats need
open water ahead to throttle up (a boat spawned facing a quay only reverses: by design);
wanted escalation and cool-down; BUSTED fines and confiscation; the respray police rule;
the bike-share dock rule (no DOCK BIKE at the station just rented from); cab fare and skip;
the dealership purchase; the Falcon ride ends at its station; routes to every island;
key rebinding; weather and day cycles; the demo build boots into free roam with no errors.

## Left (in docs/BACKLOG.md)

- Phone: the car radio unfolds mid-screen for 4 s on getting in; a toast can sit over it.
- Touch: toasts and the radio chips name keyboard keys (`keyName` has no touch labels).
- The demo's mission card counts "MISSION 01 / 11" with two jobs open (design question).
- MIDTOWN, SOUTH BANK, IRONWORKS DOCKS and PALM KEYS · ART DECO have no label on the map;
  MONARCH HARBOUR is spelled the British way (a proper name on the island's signs).

## For other agents

Nothing in driving, traffic / police AI or the renderers needed a fix beyond one-line text
changes (`physics-update.js` engine-fire toast key).
