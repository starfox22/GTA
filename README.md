# Dead End City

An original, self-contained top-down crime game in the spirit of GTA 1 and 2, set on the
South Coast in 1997. One HTML file, no server, no build step to play: open
`dead-end-city.html` in a desktop or mobile browser and press **ENTER THE CITY**.
Version 30.0.0 (see `docs/CHANGELOG.md`).

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
- Cars that crumple (with layered, recorded crash sounds), lose panels, glass and lamps,
  burst tyres, catch fire and explode;
  bullet holes, broken shop windows and street furniture you can flatten.
- Helicopters and three detailed airframes of plane (flaps, retracting gear, working control
  surfaces) with a perspective flight camera, a glass-cockpit flight HUD (attitude, airspeed
  and altitude tapes, vertical speed, heading, power, flaps, gear, g, stall warnings),
  volumetric clouds, and helicopter landings on helipads and flat roofs.
- A 3D renderer (Three.js r160, embedded): HDR post-processing (ambient occlusion, bloom,
  filmic grade), a sun that follows the clock, sky reflections, a night light map for every
  lamp and shop, weather, and four graphics quality tiers. Without WebGL a 2D renderer
  takes over.

## Play

| Action | Keys |
| --- | --- |
| Move / drive | W A S D or arrows (in an aircraft ↑ / ↓ climb and descend instead) |
| Interact: enter or leave a vehicle, payphone, shops, stations, boarding | E |
| Stadium pitch: dribble by walking into the ball; kick it the way you face | E (hold Shift for a harder, higher strike) |
| Fire | F, Space or mouse click (on foot); F fires the pistol from a vehicle |
| Handbrake (in a vehicle) | Space |
| Sprint | Shift |
| Bicycle | hold W to pedal, Shift stands on the pedals, S brakes |
| Helicopter | ↑ rise, ↓ descend (T / G also work), W/S fly, A/D turn; land on open ground, helipads or flat roofs |
| Plane | W/S throttle (the engine spools up), A/D bank (steer on the ground), ↑/↓ nose up/down (T / G also work), X / Z flaps down / up, L landing gear, S at idle brakes on the ground |
| Bail out / parachute; dive off a boat | J (then Space opens the canopy) |
| Weapons | 1 to 6, Q cycle (ends on FISTS, no weapon), K knife, ` or 8 fists, R reload, I arsenal |
| Tank | the mouse (or the touch aim stick) lays the turret; F / click fires the selected gun, Q switches main gun and machine gun, right click fires the machine gun |
| Surrender | stand still (or stop the car) with the police close, at one to four stars |
| City map | Tab |
| Car radio (also on the Falcon coaster and the Sunset Eye) | N power, B next station |
| Horn, mute | H, M |
| Show the mission card again | O (or click the objective strip) |
| Street zoom | mouse wheel or pinch; + / − and 0 |
| Minimap zoom | mouse wheel or pinch over the minimap; its − button folds it away |
| Pause | Escape |

Typing `godmode` during play toggles god mode: every weapon, invulnerability, every
mission open in the mission picker, and there a time-of-day chooser (presets from dawn to
3 AM, a slider over the whole day) and the weather, applied at once.

Every key can be rebound in **Settings · Controls** (from the title menu or the pause
menu), which also warns about clashes and offers to swap. Settings has four tabs:
GRAPHICS (quality tier, FPS counter, character see-through), AUDIO (sound on/off; master,
effects, radio music and voice volumes; radio voices), GAMEPLAY (NPC chatter, minimap,
GPS route on the minimap, control hints) and CONTROLS (touch controls, key bindings). Touch controls appear
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
