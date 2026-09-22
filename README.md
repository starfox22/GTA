# Dead End City

An original, self-contained top-down crime game in the spirit of GTA 1 and 2, set on the
South Coast in 1997. One HTML file, no server, no build step to play: open
`dead-end-city.html` in a desktop or mobile browser and press **ENTER THE CITY**.

- 16 missions: an 11-chapter story (harbor heists, a rooftop hit, car chases, a flight
  finale) followed by 5 open contracts (a hot-car checkpoint run, bomb defusal across the
  Keys, a district-wide blackout, an aerial ring time-trial, and a repo job).
- A living city whose day has a shape: pedestrians who commute, window-shop at lunch, sit
  on benches, work out at the Central Garden gym and queue at food trucks; traffic with
  drivers you have to pull out of the seat, some of whom fight back; police who close
  bridges and lay spike strips instead of only following you.
- Gunfire is lethal. Two rounds put anyone down unless they are wearing a vest — you
  included. A car that goes up with you inside it kills you.
- Central Garden, a north-east financial point of setback towers, Harbor Point marina and
  its cruise terminal with two walkable liners, Sunset Pier with a looping rollercoaster
  you can actually ride, a mountain you have to trek rather than stroll, a coastal
  railway on its own viaduct, sports matches and a casino.
- Get around on foot, in the water, in anything you can steal, on a bike-share bicycle you
  pedal by tapping, by rail, or by hailing a cab and picking your drop-off on the map. Drive
  into the bay and the car floods and takes you with it.
- A 3D city renderer (Three.js r160, embedded) with district zoning, procedural roofs,
  windows that light up at night, shopfronts, billboards, street furniture, a shore-aware
  wave shader, a full day/night cycle, and weather that clouds over, rains, wets the roads
  and clears again.

## Play

| Action | Keys |
| --- | --- |
| Move / drive | W A S D or arrows |
| Interact, enter or leave a vehicle | E |
| Fire | F, Space or mouse click |
| Run / handbrake | Shift |
| Weapons | 1 to 6, Q cycle, K knife, R reload, I arsenal |
| City map | Tab |
| Car radio | N power, B next station |
| Bail out / parachute | J then Space |
| Ride the Sunset Pier coaster | E at the station |
| Hail a cab | E beside an occupied taxi |
| Stand on the pedals | Shift while cycling |
| Board a liner | E at the gangway or the stern platform |
| Pedal a bicycle | Tap W repeatedly; faster taps, more speed |
| Swim | Walk into the water; Shift to swim harder |
| Pause | Escape |

Touch controls appear automatically on phones and tablets. Progress saves to the browser's
local storage. The game runs offline; nothing is fetched from the network.

## Repository layout

```
dead-end-city.html    The playable, self-contained build (the deliverable).
src/                  Game source, one file per subsystem (see docs/SOURCE_GUIDE.md).
src/shell.html        HTML shell: CSS, DOM and include directives.
vendor/three.r160.js  Unminified Three.js r160 with its MIT license.
assets/               Decoded images and audio plus manifest.json (embedded at build time).
tools/build.py        Reassembles dead-end-city.html from the pieces above.
tools/check.sh        Fast syntax gate (assemble + `node --check`).
tools/smoke.mjs       Headless Chromium boot test with screenshots.
docs/                 Source guide, audit notes and third-party credits.
```

## Build and verify

```
python3 tools/build.py          # writes dead-end-city.html
sh tools/check.sh               # parses the assembled script with Node
node tools/smoke.mjs            # boots the build headlessly (needs Playwright + Chromium)
```

Only Python 3 is needed to build. The assembled file is plain, readable source: nothing is
minified, packed or evaluated, and every media block is labeled with its path, byte count
and SHA-256.

## Credits

Original game code © the Dead End City authors. Three.js is MIT licensed. Audio samples and
music are Creative Commons or CC0 and are credited in `docs/THIRD_PARTY_CREDITS.txt`, which
is also embedded in the game file.
