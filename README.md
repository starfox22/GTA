# Dead End City

An original, self-contained top-down crime game in the spirit of GTA 1 and 2, set on the
South Coast in 1997. One HTML file, no server, no build step to play: open
`dead-end-city.html` in a desktop or mobile browser and press **ENTER THE CITY**.
Version 29.0.0 (see `docs/CHANGELOG.md`).

- 16 missions: an 11-chapter story (harbor heists, a rooftop hit, a jet-ski run, car
  chases, a flight finale) followed by 5 contracts (a hot-car checkpoint run, bomb defusal
  across the Keys, a district-wide blackout, an aerial ring time-trial and a repo job).
- A living city: pedestrians with roles by the hour who walk the pavements, wait at kerbs,
  gather in street scenes, and react to what they see and hear (cower, flee, film, call the
  police); traffic that obeys signals and gets out of the car to argue after a crash; a
  wanted system with helicopters and rammable roadblocks; gangs, wildlife, sports matches,
  a casino and a Sunset Pier theme park on its own island north of the city.
- Four islands and long bridges: Northbank's street grid in the middle, tropical Palm Keys to
  the west across Palm Sound, the forest and mountains of Ridgeline east across Marlow Bay,
  and the Sunset Pier amusement island to the north.
- Palm Keys Beach with swimmers, lifeguards and a fishing pier; you can swim from the sand
  and climb out at beaches, rocks and ladders on the quays.
- Harbor Point marina with sixteen unique yachts and M/Y AURELIA, a 105 m superyacht you can
  walk aboard deck by deck; cruise liners, a freighter, boats and jet skis to drive.
- Three railway lines along the west shore and across the county, 13 stations to ride
  between.
- Cars that crumple, lose panels, glass and lamps, burst tyres, catch fire and explode;
  bullet holes, broken shop windows and street furniture you can flatten.
- Helicopters and three airframes of plane with a perspective flight camera, volumetric
  clouds, and helicopter landings on helipads and flat roofs.
- A 3D renderer (Three.js r160, embedded): HDR post-processing (ambient occlusion, bloom,
  filmic grade), a sun that follows the clock, sky reflections, a night light map for every
  lamp and shop, weather, and four graphics quality tiers. Without WebGL a 2D renderer
  takes over.

## Play

| Action | Keys |
| --- | --- |
| Move / drive | W A S D or arrows |
| Interact: enter or leave a vehicle, payphone, shops, stations, boarding | E |
| Stadium pitch: dribble by walking into the ball; kick it the way you face | E (hold Shift for a harder, higher strike) |
| Fire | F, Space or mouse click (on foot); F fires the pistol from a vehicle |
| Handbrake (in a vehicle) | Space |
| Sprint | Shift |
| Bicycle | hold W to pedal, Shift stands on the pedals, S brakes |
| Helicopter | T rise, G descend, W/S fly, A/D turn; land on open ground, helipads or flat roofs |
| Plane | W/S throttle, A/D bank, T/G nose up/down |
| Bail out / parachute; dive off a boat | J (then Space opens the canopy) |
| Weapons | 1 to 6, Q cycle, K knife, R reload, I arsenal |
| City map | Tab |
| Car radio | N power, B next station |
| Horn, mute | H, M |
| Show the mission card again | O (or click the objective strip) |
| Street zoom | mouse wheel or pinch; + / − and 0 |
| Minimap zoom | mouse wheel or pinch over the minimap; its − button folds it away |
| Pause | Escape |

Every key can be rebound in **Settings · Controls** (from the title menu or the pause
menu), which also warns about clashes and offers to swap. Settings has four tabs:
GRAPHICS (quality tier, FPS counter, character see-through), AUDIO (sound on/off; master,
effects, radio music and voice volumes; radio voices), GAMEPLAY (NPC chatter, minimap,
control hints) and CONTROLS (touch controls, key bindings). Touch controls appear
automatically on phones and tablets. Progress and every setting save to the browser's
local storage. The game runs offline; nothing is fetched from the network.

## Repository layout

```
dead-end-city.html    The playable, self-contained build (the deliverable).
src/                  Game source, one file per subsystem (see docs/SOURCE_GUIDE.md).
src/shell.html        HTML shell: CSS, DOM, subsystem index, audit contracts, include directives.
vendor/three.r160.js  Unminified Three.js r160 with its MIT license.
assets/               Decoded images and audio plus manifest.json (embedded at build time).
tools/build.py        Reassembles dead-end-city.html from the pieces above.
tools/check.sh        Fast syntax gate (assemble + `node --check`).
tools/smoke.mjs       Headless Chromium boot test with screenshots.
tools/tour.mjs        Scripted screenshot tour driven by the developer console.
tools/layout-audit.mjs  Overlap audit of the city plan.
docs/                 Source guide, development workflow, changelog, audit logs, credits.
```

## Build and verify

```
python3 tools/build.py                           # writes dead-end-city.html
python3 tools/build.py --out dist/game.html      # scratch build (dist/ is git-ignored)
sh tools/check.sh                                # parses the assembled script with Node
node tools/smoke.mjs dist/game.html dist/smoke   # boots the build headlessly (Playwright + Chromium)
node tools/layout-audit.mjs dist/game.html       # checks the city plan for overlaps
```

Only Python 3 is needed to build. The assembled file is plain, readable source: nothing is
minified, packed or evaluated, and every media block is labeled with its path, byte count
and SHA-256. The build must stay under 15.5 MB. `docs/DEVELOPMENT.md` explains the test
tools and the `window.DeadEndCity` developer console.

## Credits

Original game code © the Dead End City authors. Three.js is MIT licensed. Audio samples and
music are Creative Commons or CC0 and are credited in `docs/THIRD_PARTY_CREDITS.txt`, which
is also embedded in the game file.
