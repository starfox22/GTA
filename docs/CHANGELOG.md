# Changelog

## Unreleased — stadium sound and screens

Stadium sound (sports-audio.js, sports.js)
- The continuous crowd bed (looping white noise through a wandering band-pass), the synthetic
  chants and clapping, the "ooh" at saves and misses and the full-time roar are gone: from
  the street the bed read as white noise. The stands are now silent between goals.
- A goal plays a recorded football crowd (`stadium-goal-cheer.ogg`, 68 KB, 8 s: the swell,
  the roar, the decay) from the scoring club's end with the other end's groan
  (`stadium-goal-groan.ogg`, 30 KB) under it; the player's goal (and a kickabout goal in front
  of a crowd) has the whole ground cheering. Both are from Sandermotions' "Soccer match
  stadium sounds" pack (Freesound, CC0 1.0; credits in THIRD_PARTY_CREDITS). The level is
  the attendance times the player's distance to the stadium lot (full inside and on the
  plaza, half at 280 units, silent past 1700), and each voice keeps following the player
  (gain, pan, a distance low-pass) through the ambience bus: the effects volume, silent while
  paused. The air horns and noise bursts of the old roar and the panic noise bursts are gone
  (panic keeps its recorded screams).
- Console: `stadiumGoal(team, byPlayer)`, `stadiumSound()`.

Stadium screens (sports-world.js)
- The two end-stand screens, turned towards the pitch and tilted up at the sky, are removed.
  The north stand's screen, the entrance board and the two south facade screens facing the
  plaza and the street stay (live score, lit at night).

## Unreleased — skip the ride

- Taxi, train and liner passengers can skip the ride (ride-skip.js), as in GTA IV / V: Y
  (`skipRide`, remappable in Settings · Controls, in the help card and a SKIP RIDE touch
  button). The screen fades to black in 0.6 s with an arrival card (destination, fare, the
  clock on arrival), the world moves on, and it fades back in at the destination.
  - Taxi: SKIP RIDE · $fare while a drop-off is set. The cab stops at the drop-off kerb facing
    along the road; the full fare is paid (no surcharge). Refused with a wanted level, during
    a timed job, in a damaged (under 60% health) or burning cab, or without the fare.
  - Train: SKIP TO <destination>; U (`skipStop`) picks any call on the way instead. The train
    stands at that platform and you step off as on any arrival. City rail stays free.
  - Liner: aboard the Meridian Star at sea, SKIP THE VOYAGE puts her at anchor off the cruise
    terminal with you where you stood on deck. The Falcon and the Eye cannot be skipped.
- The clock moves by the ride's own length at the game's rate (a game minute per ride
  second), so a skip lands at the hour riding would. Measured: the hired cab averages 34-85
  units a second over 1.4-9 km (holding for traffic and people), so a skip uses half its
  65 km/h cruise (about 32 km/h); a train's estimate from its speed profile is within 3% of a
  ridden trip (Cruise Terminal to Oceanview 204 s estimated, 198 s ridden; Harbor Point to
  Broadway 114 / 111 s).
- Across the gap the weather machine steps second by second (no sudden sky), the scenic
  trains and the liner keep their timetables, and the street is filled under the black. The
  fade runs on simulation time, so pausing holds it; engines, rain and ambience duck under it
  while the radio plays on. The radio now plays in a hired cab (N / B work there).
- Console: `skipRide()`, `skipStop()`, `rideSkip()`, `boardTrain(from, to)`, `setCash(dollars)`.

## Unreleased — real speeds

World scale (game.js WORLD SCALE, SOURCE_GUIDE 2a)
- Measured from the models: `UNITS_PER_METRE` = 8 (a sedan is 43 units = 4.5 m, a person 17.4
  = 1.75 m, a lane with its gutter 44 = 6 m; aircraft and boats agree; doors and storeys are
  drawn squat). It replaces "512 units = 100 m" (5.12 u/m), which made everything read 1.6x
  too fast and too far. `KMH`, `KNOTS`, `GRAVITY` and `speedKmh()` derive from it, and every
  readout uses them: the speedometer (boats now read knots), the flight HUD, metres in
  prompts, the map's scale bar ("64 m · 1 block"), the Falcon (41 m, its own top speed) and
  the Sunset Eye.

Speeds, measured headless with `simulate` (old = u/s and what the old HUD showed, then true
km/h at 8 u/m; new = km/h and 0-100 s)

| Vehicle | Old top (u/s · shown · true) | Old 0-100 shown | New top | New 0-100 |
| --- | --- | --- | --- | --- |
| Walk / jog / sprint | 100 / 100 / 158 · 70 / 70 / 111 · 45 / 45 / 71 | | 5.4 / 11.0 / 24.1 | |
| Swim / hard | 52 / 58 · 37 / 41 · 23 / 26 | | 3.6 / 5.0 | |
| Bicycle cruise / standing | 192 / 246 · 135 / 173 · 86 / 111 | 2.0 s | 22 / 38 | |
| Sedan (REGENT) | 291 · 205 · 131 | 1.1 s | 180 | 9.1 s |
| Taxi | 301 · 212 · 135 | 1.0 s | 175 | 9.6 s |
| Coupe | 356 · 250 · 160 | 0.9 s | 205 | 6.6 s |
| Van | 236 · 166 · 106 | 1.3 s | 150 | 13.1 s |
| SUV | 286 · 201 · 129 | 1.0 s | 175 | 9.1 s |
| Pickup | 271 · 190 · 122 | 1.2 s | 165 | 10.0 s |
| Limousine | 281 · 197 · 126 | 1.4 s | 190 | 9.6 s |
| Luxury V12 | 336 · 236 · 151 | 1.0 s | 250 | 5.1 s |
| Muscle | 391 · 275 · 176 | 0.8 s | 245 | 5.1 s |
| Hot rod | 407 · 286 · 183 | 0.6 s | 235 | 4.4 s |
| Rally | 387 · 272 · 174 | 0.7 s | 230 | 4.1 s |
| Roadster | 436 · 307 · 196 | 0.7 s | 250 | 4.9 s |
| Sport (COMET GT) | 460 · 324 · 207 | 0.7 s | 290 | 3.9 s |
| Supercar | 510 · 359 · 230 | 0.6 s | 330 | 3.0 s |
| Motorbike / cruiser | 456 / 330 · 321 / 232 · 205 / 149 | 0.6 / 0.9 s | 225 / 180 | 3.3 / 5.1 s |
| Patrol car | 370 · 260 · 167 | 0.8 s | 230 | 6.4 s |
| Ambulance | 301 · 212 · 135 | 1.1 s | 155 | 12.1 s |
| Box truck / flatbed | 213 / 207 · 150 / 146 · 96 / 93 | 2.0 / 1.6 s | 115 / 120 | 21 / 22 s |
| Bus | 189 · 133 · 85 | 2.5 s | 100 | 0-50 in 9.1 s |
| Tank | 195 · 137 · 88 | 1.6 s | 55 | 0-50 in 22 s |
| Army jeep / APC / truck | 295 / 240 / 225 (spec) | | 110 / 100 / 90 | 0-50 in 5 / 8 / 14 s |
| Speedboat / jet ski / launch | 310 / 381 / 170 · 218 / 268 / 120 km/h | | 55 / 50 / 14 knots | 0-30 kn 4.8 / 3.2 s |
| Helicopter | 272 · 191 · 122 | | 245 | 0-200 in 15 s |
| Courier plane | lift-off 173-183 km/h, roll 410-463 u, top 368 | | lift-off 126-146, roll 556-719 u, top 396 | |
| Train | 530 · 373 · 239 | | 100 (75 between close stations) | 1.3 m/s² |

Handling (game.js ROAD PERFORMANCE, physics.js)
- Road vehicles are specified by top speed, 0-100, braking, cornering and traction grip;
  `roadPerformance()` bisects the engine power so each makes its 0-100. The engine pulls at
  the tyres' limit, then power / speed, against air and rolling resistance; coasting and
  handbrake decelerations are real (the handbrake is a sliding half-g with the grip let go).
- Steering reaches full lock by 30 km/h; above that the tyres' sideways grip caps the yaw
  rate (`corneringLimit`), for the player, traffic and police alike: corners at 30-40 km/h or
  on the handbrake, sweeping bends at speed.
- The street camera eases back from 60 km/h (to 0.68 of your zoom at 220) and looks about
  0.45 s ahead.

Rebalanced for the new speeds
- Traffic: 40-55 km/h in town, 70-85 on the long bridges, 60 on county roads; follows at about
  0.8 s, brakes for reds at about half a g and drives through greens at speed (it used to
  slow at every junction); junctions are planned from 330 units out.
- Police: patrol cars 230 km/h (the pursuit tiers run them at 84-98%), SWAT vans 150, feds'
  SUVs 175, the police helicopter up to 260; braking and throttle follow the car's own
  numbers. Measured on the Oceanview causeway at two stars: a sedan fleeing at 150 km/h had a
  unit close from 1300 to 690 units in 5 s and was PIT-ted on the East Bay Crossing within
  25 s; a supercar at 250 km/h opened the gap from 260 to 920 units in 5 s and broke sight.
- People: pedestrians walk 4-6 km/h (by the hour), flee at 17-21, officers run 16-19 (a
  sprinting player outruns them, a jogging one does not), park and beach joggers 9-12, club
  guests and park visitors 4.5; strides and footsteps follow the pace. New walk key (C).
- Collisions: damage from 19 km/h, a reckless-driving report above 55 km/h closing; the
  crash-sound bands are documented in km/h (bump to 34, medium to 72, heavy above).
  Roadblock ramming by momentum: a box truck needs ~55 km/h, a bus ~40.
- Drawbridge: real gravity on and off the leaves; the arms snap above 50 km/h; landings hurt
  above 5 m/s. At 15° every sedan from 60 km/h up clears the 1.4 m gap; the faster it goes the
  farther it flies (23 m at 60, 101 m at 150) and the harder it lands (27-49 damage of 150).
  At 30° (4.4 m gap, tips 6 m up) landings reach 14-25 m/s.
- Parachute: freefall at up to 50 m/s under real gravity; the canopy opens itself 85 m up and
  descends at 3.5 m/s (2.1 flared). Mountain tumbles and scree slides use real gravity.
- Aircraft: the flight model is in m/s and g; the courier's wing and drag were resized so it
  lifts off at 120-145 km/h inside Southport's 870-unit roll and tops out near 400 (measured);
  the jet and the airliner are sized for lift-off near 180 and 210 km/h.
- The Falcon runs on real gravity (41 m, quoted from the circuit); the liner keeps 19 knots;
  the ketch motors at 7 knots; trains 100 km/h at 1.3 m/s²; the cab 65 km/h.
- Mission clocks: route lengths from the GPS against a pessimistic stop-at-every-corner
  pilot (35 km/h average; old cars averaged 115): No Last Ferry 9,800 units in 210 s, Rush
  Hour 18,200 in 390 s, Fireworks 9,400 (plus three fights) in 360 s, the jet-ski run 6,000 in
  150 s, Paper Trail 460 on foot in 95 s, Ring Run in 300 s all keep their clocks. Repo Man
  (39,500 units and seven car changes) goes from 660 to 780 s.
- Console: `unitsPerMetre`, `repair()`.

## Unreleased — prompts out of the way

Drawbridge (drawbridge.js, drawbridge3d.js, geography.js, physics.js, navigation.js)
- The Palm Sound Causeway is now a working double-leaf trunnion bascule. It opens at 00:50,
  05:30, 10:15, 15:00 and 20:40 for the ketch ALBATROSS, whose masts are too tall for the
  deck: bells and flashing red lamps, the signals go amber then red, striped barrier arms come
  down on both approaches (entry arms first, and never onto a car), the tender waits for an
  empty span, the locks clank, both leaves swing up eased to 78°, the ketch crosses to her
  other anchorage, and it all runs back. About ninety seconds of play.
- Traffic queues at the stop lines and moves off when the arms rise; pedestrians wait behind
  the sidewalk arms. Police can ram through the arms but stop at the gap. Arms snap for
  anything faster than about 50 km/h and leave their boom on the road.
- The leaves are ramps. While they are only slightly open a fast car can launch off the
  rising leaf and jump the gap; land on the far leaf (hard landings hurt) or fall short into
  the Sound, where the car floods as usual. Past about 40° a leaf is a wall.
- The GPS weighs the crossing by how long the bridge will stay closed: short trips wait, long
  ones go round by the Keys Bridge. The minimap and map show the span, the gap and a state
  icon (white down, amber closing, red up).
- The model: steel leaves with open-grid decking over the joint and a finger lock, girders,
  floor beams, bracing, trunnion shafts and counterweights swinging into the pier pits;
  granite piers, four limestone tender's houses with lit lookouts (the control house with a
  red / green vessel signal mast and horn), timber fenders with red-lit dolphins, traffic
  signals, wig-wags and DRAWBRIDGE AHEAD flashers, red / green lanterns on the leaf tips.
- Console: `DeadEndCity.drawbridge('status' | 'open' | 'close' | 'hold', degrees | 'snap',
  degrees)` (the report lists every vehicle on the causeway), `drawbridgeLook(spot, zoom)`,
  `drawbridgeTraffic(count)`.
- Traffic no longer stops at phantom signals out on the Palm Sound bridges: grid columns
  -896 and -384 cross the water, and trafficControl planned junctions there.

Mountains (terrain.js, county3d.js, county.js)
- The two elliptical bumps are replaced by the Ridgeline Range: a generated coastal range
  (ridge network, domain-warped ridged and "erosion" noise, stream-power incision over
  depression-filled drainage, strata, thermal settling) with Mount Ascent's summit horn, the
  rock needles of Needle Ridge, spurs, ravines, sea cliffs on the north coast and foothills that
  run down to Eagle Pass, the reservoir and Northridge. Roads, rail, towns and the helipad stay
  flat, with the ground rising off them as embankments. It is still one shared triangulated
  surface for rendering and contact; it builds in about 1.3 s headless.
- Both 4x4 trails are graded switchbacks up the south faces (at most 0.28), with turning pads
  at the hairpins and a level summit platform. An SUV drives each one to the top.
- A new terrain material: forest floor, meadow, alpine turf, dirt, scree, banded rock with
  triplanar grain and cracks, snow above a ragged snowline (lingering in the gullies, blown off
  the ridges, glinting in the sun), baked AO, bump detail. The foot of the slopes blends
  seamlessly into the county sheet. The terrain is drawn as 64-cell chunks with a
  half-resolution far LOD and skirts.
- About 12,700 instanced conifers and broadleaf trees below a ragged treeline, ~730 boulders,
  stream ribbons with white water on the steep drops, and valley mist at dawn. The 2D map gets
  hill shading, contours, forest and snow. New `DeadEndCity.terrain()` report.

HUD (hud.js, harbor.js, shell.html)
- The mission 1 LOAD CARGO prompt no longer flickers: every system now offers its prompt to one
  owner (`offerPrompt`, hud.js) instead of writing `#interaction`, which the old code set to
  `display: none` and back every UI pass, restarting its fade-in; the loading bay range and the
  ready-to-load test have hysteresis, and prompts have a minimum display time and a short grace
  before hiding. Prompts name keys from the bindings (hold prompts read "HOLD E").
- The same fix steadies every location prompt (the hospital door after a respawn, shops,
  payphone, stations, the harbor barrier): their ranges have hysteresis shared with E.
- Prompts, key hints and headline cards leave the middle of the screen after 3 s: the prompt
  docks as a small chip under the navigation pill (touch: above the action buttons) and pops
  back for a new action; headlines slide up and shrink; touch toasts dim. Reduced motion
  respected.
- The flight HUD is compact and against the screen edges (speed, attitude and power on the
  left, altitude on the right, a thin heading strip at the top), so the centre is clear; a
  new Settings · Gameplay · Flight HUD switch turns the instruments off (warnings stay).

Combat (swat.js, combat-rules.js, pursuit.js)
- Snipers give a fair chance: rooftop snipers and the helicopter marksman lock for 2 s or
  more with a rising beep and a red glow on the screen edge toward them, then fire one
  visible tracer at where they guess you will be; keep moving and it usually misses. A hit
  takes half your health (armour soaks some), never all of it from full, and they rest
  4-9 s between rounds. Rooftop snipers are rare: one at a time, now and then at five stars,
  two rounds each before they pack up.
- No more crosses over the people you hit and no HEADSHOT caption: blood, the victim's
  reaction and a faint tick (a thump for a kill) are the only hit feedback.

## 30.0.0 — The islands rearranged, AAA pass two

Settings, controls and HUD (controls.js, settings.js, hud.js)
- A settings screen from the title and pause menus: Graphics (quality tier, FPS counter,
  character see-through), Audio (master, effects, radio and voice volumes), Gameplay (NPC
  chatter, minimap, control hints) and Controls (touch mode, every key rebindable with clash
  detection and swap, reset to defaults). Everything is saved and applies live.
- Aircraft climb and descend moved to T / G (Shift is sprint, Space the handbrake).
- A new HUD: radio and weapon boxes rest as small chips and pop open on a change or on hover
  with animated transitions; a foldable minimap that zooms with the wheel or a pinch;
  context key hints; a new animated title screen. `godmode` unlocks every mission in the picker.

Radio (car-radio.js)
- Three new stations with licensed tracks: VELVET 91.5 (lounge jazz), PALMS 95.9 (island
  grooves) and BLOCK 101.7 (lo-fi beats); stations play playlists and every station has a
  synthesized ident. Music streams from files beside the page in the published build
  (`tools/build.py --split-media`).

Combat and police (heat.js, pursuit.js, wounds.js; docs/audit/combat-qa.md)
- Heat from every crime and kill (civilians, officers, SWAT, soldiers, destroyed police
  vehicles) drives the stars at 12 / 32 / 72 / 125, one flashing step at a time; a heat meter
  and body count on the HUD; heat cools only out of sight.
- Response per star: patrols that arrest at 1, PIT/flank/box cruisers at 2, a helicopter
  marksman and roadblocks at 3, SWAT vans and two helicopters at 4, federal agents and a tank
  from Fort Sentinel at 5; reinforcements arrive off-camera ahead of the player; a radar search
  area with sight cones; police launches and a helicopter chase boats from 2 stars; cruisers
  cut across open ground and use the county road graph.
- BUSTED as well as WASTED; hit markers, headshots, incoming-fire arcs; hit reactions by body
  area, limping, blood trails, directional death falls and slumps against walls, downed
  officers dragged to cover. 5-star physics about 25% cheaper.

Stadium (sports-fixtures.js, sports-audio.js)
- Players, referees and stewards can be shot, stabbed and run over like anyone else; the match
  is abandoned and the stands empty. Walk onto the pitch through the board gaps, dribble the
  ball and press E to kick (Shift for power): a goal lights every board, pays out and brings
  the stewards. Six scoreboards; 11 football clubs and 6 basketball teams with kits and crests
  on a daily fixture list; procedural crowd sound.

North Point and signage (skyline.js, skyline3d.js, signage3d.js)
- The financial district is a Moscow-City-style cluster of 18 unique supertall towers
  (twisting, stepped copper, twin sails, stacked blocks, curved, needle, crown, diagrid...) on
  landscaped plazas with lit crowns and aircraft lights.
- Signage lit as real neon, lightboxes and channel letters with bloom and flicker, LED
  billboards that cycle ads, marquee bulbs, light spill on the street and reflections in rain.

Bridges and the sailing liner (bridges3d.js)
- Every bridge has its own design: green steel truss (Keys Bridge), causeway with a bascule
  span (Palm Sound), white cable-stayed A-pylon (East Bay), red suspension bridge (South Bay),
  LED network arch (Sunset Pier) and distinct county crossings, with lighting and collision.
- The MS Meridian Star sails a 19-minute loop round the islands with a port call, wake, horn
  and a deck the player can ride.

Visual fixes
- Blood stays dark red at every hour; the see-through cutaway only opens a small hole in a
  roof directly over the player (and can be turned off); boats leave real Kelvin wakes, foam
  and spray in the sea (wakes3d.js); no camera jolt under bridges; the half-screen milky veil
  (cloud-shadow plane cut by the camera's near plane) is gone; the player gets a rim light at
  night; Blue Hour rooftop plants no longer sway.

Streets and collision (docs/audit/streets-collision-qa.md)
- Sea railings stand on the quay edge, block people and open at ladders and gangways; street
  ends stop square at a kerb; no painted turning circles, no district boards over the road; stop
  lines, full-width crossings and bus stop boxes; street furniture stops the player; long
  steps are sub-stepped so railings can't be skipped. The layout audit checks all of it.

Graphics review and performance (docs/audit/graphics-review.md)
- Daylight balanced into the tone curve (no more washed-out noon, shadows read), a warm strong
  sun at golden hour, glass towers that reflect the sky, richer lawns, rippling park water,
  a calmer sea from the air, trees and flower beds along Battery Park, picnics on the Great
  Lawn, steel garage roofs, no map labels painted on the lawns.
- The district name appears once: a gold reveal on the location block top left.
- Draw calls: shared facade materials, merged building parts and instanced theme park rides
  (a third fewer draws from the helicopter and at Sunset Pier); match-day players cast torso
  shadows only (the stadium's shadow pass halved); car wheels merged.
- AUTO graphics adapts to the frame rate (dynamic resolution, then a tier down); shader
  compile stalls removed (no info-log read-back, programs compiled behind the title
  screen); ~250 MB of baked canvas bitmaps freed after upload; faster boot.

Marea Beach Club (beachclub.js, beachclub-audio.js, beachclub3d.js; SOURCE_GUIDE section 4)
- On the beach-club plot at the west end of Palm Keys Beach: a street forecourt with a
  snaking roped queue, red carpet, bronze portal and neon sign; a stage with an LED wall and
  speaker stacks; an LED dance floor under a lighting truss; the main bar under white sails;
  a roped VIP terrace; daybeds and cabanas; an infinity pool with a swim-up bar; a sunken fire
  lounge; a deck with a gate onto the club's own sand, sunbeds and parasols.
- Social club 09:30-18:30 (loungers, swimmers, bar guests, waiters with trays, a balearic
  set), sunset sessions with a setup crew, a nightclub 21:45-04:15 (a packed floor dancing to
  the beat, DJ and MC on stage, moving heads, lasers, strobe, searchlights), closing with
  taxis at the kerb, cleaners at dawn. Procedural music on a look-ahead scheduler, muffled
  by the wall from the street and open inside.
- The door: bouncers and a host work the line with spoken exchanges (let in, turned away,
  people walking off complaining); the player pays $40 cover or buys a $250 VIP band with E.
  Gunfire empties the club through the door and the beach gate; the bouncers hold the door,
  call it in and shove the shooter away.
- Crowd: seven beat-synced dance styles and a floor-wide jump on the drop; swim, lounge, DJ,
  bartend, tray, drink, sparkler, sweep, stop and shove poses; cocktail, tray and bottle props.
  `DeadEndCity.beachClub()` reports the club.

Sunset Pier resort (SOURCE_GUIDE section 4)
- The island is a Gulf-style resort: main gate at the bridge, the Fountain Lagoon with a
  musical fountain show (three choreographies to procedural Hijaz-mode music, hourly after
  dark), fireworks two nights in three at 21:00, the crescent Sunset Palace hotel, a beach
  club, palm promenades, a bus bay by the car park.
- The Falcon: a 1.47 km, 64 m steel coaster (125 km/h) with a lift, a 72-degree first drop over
  the shore, loop, camelback, overbanked turn, heartline roll, corkscrew and helix, banked for
  the speed the train really carries, with supports, station, queue hall and a seven-car
  train of riders running all day. Ride it from the platform (E); E cycles chase, front seat
  and trackside cameras.
- The Sunset Eye: a 110 m observation wheel on twin A-frame legs with cable spokes, 48 level
  glass capsules and LED shows at night; ride one turn from the terminal.
- Swing ride, drop tower, carousel, teacups, dodgems, the Arabian Nights dark ride, the Wadi
  Splash log flume with splashes, a souk food court and kiosks; guests walk the promenades and
  queue for the rides; riders scream (procedural voices).

World layout (docs/audit/world-layout.md, SOURCE_GUIDE section 4)
- West to east: Palm Keys (the tropical island) across Palm Sound from Northbank, Northbank
  in the middle, Ridgeline's forest and mountains across a Marlow Bay now 2400..2700 wide.
  The Sunset Pier amusement park has its own island north of the reclamation.
- Palm Keys moved west and was reflected so Ocean Drive and its strand face the open sea;
  every place, the Blue Hour, Vinny's depot, the casino, jetties, gangs and mission points
  moved with it. The public beach (Palm Keys Beach, formerly Southport Beach) is on the
  island's south shore, with a 400 x 300 beach-club plot reserved at its west end.
  Northbank's south shore is a sea wall with Battery Park.
- Sunset Pier's rides stand in the east half of the new island, turned to face the bridge;
  a 1400 x 900 attraction ground is reserved in the west half.
- Every link is a bridge in one list (`BRIDGES`): the Keys Bridge and Palm Sound Causeway,
  the East Bay Crossing and South Bay Bridge (with the new Foothill Road), the Sunset Pier
  Bridge, and the county's four. Decks, rails, pylons, roadblock cuts, cover and the route
  graph all come from it.
- The world box and the city frame grew west and north (`WORLD_LEFT`, `CITY_LEFT`,
  `CITY_RIGHT`); maps, water, ground sheets and the night light map follow.
- Fixed on the way: the airport test swallowed all of southern Palm Keys; Palm Grill was
  never built (Palm Auto Paint's lot deleted it); collinear roads (a street over a bridge)
  never joined in the route graph; long bridges were invisible in the 2D view.
- Rush Hour (390 s) and Repo Man (660 s) clocks grew with the longer crossings.
  `DeadEndCity.route(x, y)` reports the GPS route.

Fort Sentinel (military.js, base3d.js)
- The restricted base is rebuilt as a working coastal army air base: double razor-wire fence,
  eight watch towers with night searchlights, a fortified main gate (funnel, guard booth,
  canopy, drop arms, anti-ram bollards, sliding gates), HQ, barracks, mess hall, clinic, motor
  pool, containers, fuel depot, ammunition bunkers, comms mast, radome, radar, water tower,
  rifle range, obstacle course, parade ground and flags, hangars, control tower, helipads and a
  runway, floodlights, CCTV, sandbag nests, camouflage nets and signage, on its own ground sheet.
- Garrison life: gate MPs who challenge and then fire, tower sentries, foot patrols, patrol
  jeeps on the perimeter road, a platoon drilling by day, range practice, supply trucks
  checked through the gate. Alarm: siren, PA, lockdown, QRF jeeps and crewed armour respond.
- New drivable jeep, APC and army truck; the tank model is merged into a few meshes.

## 29.0.0 — West-shore railway, beach, superyacht, damage, flight view, crowd, HDR

Everything since build 28.1.1 (commit 1b89eba). The audit logs in `docs/audit/`
(missions-qa, systems-qa, visual-qa, world-layout) have the details, symptoms and
verification for each fix.

Railway and city layout
- The railway moved to the west shore on its own right of way: the Shore Line
  (Cruise Terminal, an el down Garden St and along the y -2944 avenue, the west sea wall,
  Viaduct Green, Harbor Ave and Royal Ave to Southport Airport), the Coast Line (sea
  viaduct to Oceanview, Oceanview International, Coral Sound to Palmshore) and the Ridge
  Line (Palmshore, Eastgate, Northridge, Stonecreek); 13 stations. No track rides on a
  road, crosses the harbour ship or the marina mouth.
- Smooth track: circular fillets eased by a smoothing pass, resampled and thinned;
  stations on straights; the viaduct is one swept extrusion per run with mitred joints;
  sleepers, masts and piers placed by arc length; marine piles, portals and straddle bents.
  Trains follow the curve car by car, dwell at stations and no longer crawl at low frame
  rates. Rail decks and county bridge rails now collide (they were stored under keys
  nothing read).
- Layout fixes: one straight west sea wall (a building stood in the sea), West Quay is the
  rail corridor, Airport Way no longer crosses Battery St, the Ocean Drive slip curve and
  the Northbank Quay lane (roads over roads) are gone, the Stadium Way bridge starts off
  the stadium, the esplanade gives way at the Riverside helipad, reclamation blocks no
  longer stack buildings, Commons St no longer runs through the yacht club (pedestrian east
  quay), trees off carriageways. `DeadEndCity.layout()` and `tools/layout-audit.mjs` check
  the plan: no overlaps.

Southport Beach and the water
- A public strand on the south shore with its own sand, swash, sandy shallows and
  breakers, boardwalk, kiosks, beach bar, lifeguard towers, volleyball court, buoyed swim
  zone, pedal boats, jet skis and a fishing pier; ~260 instanced beachgoers who follow the
  hour and the weather and scatter at violence.
- Swimming only from a beach: quays, docks, the pier and bridges are walls. Out at
  beaches, rocks or 54 reachable ladders (lifebuoy posts). J dives off a boat or out of a
  sinking car, parachutes splash down, a spent swimmer is fished out. Procedural water
  sound (splashes, strokes, wading, ladders, surf, gulls, lifeguard whistle).

Harbor Point, the superyacht and ships
- A boat kit (lofted hulls, deckhouses, railings, furniture, name boards, night lights,
  merged meshes). Sixteen unique yachts in the marina, each named on the transom.
- M/Y AURELIA, a 105 m boardable superyacht: five walkable decks and a helipad, pool,
  jacuzzi, saloon, bridge, guests and crew; walk up the passerelle, decks above the player
  lift away. Liners with roof decks and a two-storey cruise terminal; the freighter and
  the drivable speedboat, launch and jet ski rebuilt on lofted hulls with wakes.

Damage
- Cars crumple along the contact normal (merged dents), hoods buckle and tear off,
  bumpers hang, doors spring, glass cracks and bursts, lamps die, tyres go flat, handling
  degrades, engines burn to an explosion; wrecks are gutted. Bullet holes, wall chips,
  shop-glass stars, soot, craters, rubble and flying chunks; breakable street furniture
  (lamps, signals, hydrants that spray, bins, benches...). Mission vehicles burn out
  instead of exploding and take 40% damage from gang small arms.

Flight camera and clouds
- A perspective flight camera with real altitude (dolly zoom from street framing,
  parallax, the aircraft's shadow dropping away) replaces the orthographic view in the air;
  aerial-perspective haze instead of a milky wash; ray-marched volumetric cumulus at
  600-950 m with cloud shadows; ceilings ~1400 m. Far scenery, impostors and detail layers
  keep the air view cheap.
- New: helicopters land on flat roofs and rooftop helipads (Police HQ and six large
  mid-rise roofs); the player climbs out, walks the roof and takes off again.

Crowd and ambience
- Perception-driven pedestrians: roles and dress by hour, sidewalk lanes, kerb signals,
  doors, cower/freeze/flee/film/call reactions with panic contagion, witness calls, hands
  up when aimed at, crash drivers who get out and argue, horns, taxi fares, bus stops and
  street scenes (vendor, busker, cafe, smokers, delivery, nightlife). Drawn as instanced
  bodies with layered poses (about 30 draw calls for the whole crowd). A procedural city
  soundscape (traffic hum, murmur, birds, crickets, sirens, club beat, busker).

Graphics pipeline, lighting and surfaces
- HDR pipeline: half-float target, MSAA, two-scale SAO ambient occlusion, bloom, ACES,
  time-of-day grade, FXAA fallback. Quality tiers LOW / MEDIUM / HIGH / ULTRA with a GPU
  check and a pause-menu GRAPHICS setting.
- The sun follows the clock (moon at night) with a view-fitted shadow box and a far-city
  shadow proxy; a procedural sky and environment map (clear-coat paint, window gloss, wet
  tarmac reflect it); a painted night light map lights every lamp, shop and neon pool;
  headlight cones. Procedural ground detail (asphalt, paving, grass, puddles), county
  ground and hills without seams, foliage sway. A dithered cutaway round the player
  replaces ghosted buildings and the old viaduct and tunnel-roof fades.

HUD and controls
- The mission card folds to one line after six seconds (O or a click reopens it); a small
  police chip replaces the POLICE CLEARED poster and shows only on a real drop; story and
  contracts numbered separately; FPS counter and graphics quality in the pause menu.
- Bicycles: hold W to pedal (Shift stands on the pedals). Space is the handbrake.
- Roadblocks: no spike strips; braced cruisers and loose cones that a heavy vehicle with
  enough momentum rams through (a sedan stops).
- Mission 1 ends in Vinny's warehouse: drive the truck in, the shutter comes down, leave
  by the back door.

Performance (headless, per 1/30 s update with ~650 pedestrians and ~190 vehicles)
- 56-58 ms -> 8-11 ms: cached land test, a static minimap layer, grid-based car and
  bullet contacts, parked cars skipping land and pose checks, cheaper blood-track, pond
  and moored-boat tests. Instanced signals, crowd and car impostors, far city from 500 m.

QA fixes (docs/audit/missions-qa.md, systems-qa.md, visual-qa.md)
- Missions: mission 8's beacon gates were on land and its jet ski exit on the wrong side;
  the mission 1 truck was wrecked while loading; Daniel stuck behind the plane in missions
  10-11; repo cars blocking the warehouse; Fireworks Night labels; "POLICE CLEARED!" with
  no stars.
- Systems: cars through marina and pier buildings, cars into park ponds, docks and boats
  on dry land, unreachable ladders, cars exploding under water, traffic gridlock at
  T-junctions, parked and double-parked cars, pavement walkers and causeway rails; taxis
  crawling; the passerelle; water named MARLOW BAY everywhere.
- Visuals: smeared west-sea foam, no building shadows from the air, cloud-shadow blotches
  and sun pumping, rail glare, the heavy HUD vignette, pale rings round the mountains and
  a snow grid, flat county ground, dark avenues at night, signs over doorways.

Release pass
- Rooftop landing (src/rooftops.js), teleportPlayer() also lets go of the Blue Hour
  terrace, dead code and superseded fades removed, docs brought up to date, version 29.0.0.

## 25.1.0 — Performance, park, stadium, railway and aircraft

- Profiler in the developer console; static geometry batching; building/pier/static spatial
  grids; resting-vehicle and distant-traffic throttling; cheaper pedestrian collision tests.
- Central Commons is now two blocks wide with a lake, boathouse, Great Lawn, station plaza,
  bandshell, rose garden, playground and gazebo; the elevated line runs through it. Eastside
  Customs moved out of the park to Cannery St.
- South Coast Stadium is a real enclosed venue: pitch boards, concourse, turnstiles that only
  people fit through, a bollard row that stops vehicles, ticket booths, flag poles, dugouts;
  stands stop bullets.
- Railway rebuilt: ballasted viaduct with parapets, catenary masts, tapered piers with
  cross-heads; stations with canopies, departure boards, benches, clocks, kiosks, passengers,
  stair towers and turnstiles; trains with lit windows and headlights at night.
- Aircraft rebuilt from lofted fuselages and airfoil wings: courier prop plane, T-tail
  business jet and twin-turbofan airliner with engines, gear, glazing, liveries and nav lights;
  parked apron aircraft share the models.
- Layered tree crowns; arsenal icon sheet stored as WebP (0.5 MB smaller).

## 25.0.0 — City, graphics and contracts overhaul

Repository
- Split the single-file review build into `src/*.js` subsystems, `vendor/three.r160.js`,
  decoded `assets/` with a manifest, `src/shell.html`, and `tools/build.py` that reassembles
  the self-contained `dead-end-city.html` byte-for-byte in content.
- Added `tools/check.sh` (assemble + `node --check`), `tools/smoke.mjs` (headless boot test
  with screenshots) and a documented `window.DeadEndCity` developer console.

City layout
- District zoning drives building heights (`zoneHeight`): a financial core of towers whose
  height falls off from the centre, mid-rise Midtown and South Bank, low brick Old Quarter,
  docks sheds, pastel Art Deco on the Keys with taller Ocean Drive hotels.
- Block patterns by zone: tower-on-plaza blocks in the Financial District, three-lot alley
  blocks in the Old Quarter and Battery Point, courtyard slabs in South Bank.
- Every grid road has a name (`STREET_NAMES`); the HUD shows the current street and district.
- Avenues carry double yellow centre lines; kerb lines, manholes and plazas are painted into
  the ground texture.

Graphics
- New `cityscape3d.js`: eight facade archetypes, seven procedural roof textures, parapets,
  instanced roof equipment (AC, vents, skylights, dishes, solar, planters, water towers,
  bulkheads, helipads, beacons, billboards, neon hotel signs), shopfronts with awnings and a
  32-name sign atlas, fire escapes and balconies.
- Windows light up at night through emissive window masks; lamps, shop glass, neon and
  vehicle head/tail lights follow the night amount.
- Instanced street furniture: hydrants, bins, newspaper boxes, mailboxes, parking meters,
  bollards, cones, dumpsters, crates, benches and bus shelters with ads.
- Shore-aware water shader: distance-to-shore field, four Gerstner swells, noise ripples,
  shallow turquoise, breaking and retreating foam, whitecaps, sun glitter, moon sparkle and
  city-light spill at night.
- Time of day: longer days with a real golden hour; sky, fog, sun and ambient blend through
  night, dawn/dusk and day keyframes.

Gameplay
- Pedestrian life: idling, window shopping, sitting on shared benches, walking pairs, speech
  bubbles (near misses, bumps, panic, gossip about a wanted player), flinching from fast
  cars. More pedestrians and outfit colours.
- Five new contracts after the story: Rush Hour, Fireworks Night, Blackout (the western
  districts go dark until restored), Ring Run (aerial time-trial) and Repo Man.
- Mission menu labels contracts and their contacts; the 0 key selects mission 10.

Bug fixes (see `docs/audit/` for the full reports)
- Ghost vehicles after mission cleanup, soft-lock inside destroyed vehicles, exit velocity
  no-ops, touch/mouse aim conflicts, touch overlay on the death screen, plane wrecks sinking
  below terrain, helicopter hovering after the pilot dies, mid-air destruction ignored during
  invulnerability, plane wheel wobble, mis-drawn harbor crane, per-frame allocations in the
  renderer.
