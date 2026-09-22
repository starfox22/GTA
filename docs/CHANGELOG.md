# Changelog

## 28.0.0 — Water, pedalling, one shore, and the camera back where it was

The view
- The perspective camera is out: the lean it gave tall buildings cost more in
  legibility than the sense of height was worth. Orthographic and overhead again,
  with its original framing, and the two markers that existed only to cope with
  perspective -- the sight-line marker and the column drawn from an aircraft down
  to the ground -- go with it.
- Cloud was billboards, which is the wrong primitive for a view that looks straight
  down: sprites face the camera, so a deck of them read as grey smears over the sea.
  Cloud is two horizontal layers now. The deck sits at flying height and is only in
  frame when you are above it. What you see from the street is the second layer: the
  shadows those clouds throw, drifting on the wind, with the sun dimmed by the same
  field sampled under the camera so the light breathes in step with them.

Water
- You can swim. Water stops counting as solid for the player on foot and for nobody
  else, so step off the quay and you are swimming -- slower, unable to shoot, and on
  a clock; breath comes back on land and running out of it drowns you.
- The quay edge stops every vehicle except the player's own, so you can put a car in
  the bay. It floods: the drag takes it to a stop, it settles under the surface, and
  after a little over three seconds anyone still inside drowns with it.

Getting about
- Bicycles are pedalled, not throttled. Holding the key does nothing; each fresh
  press is one turn of the cranks and your tapping speed is the gear you are in.
- The railway ran down both shores. The western route is gone: the Bay Line comes
  down the east side and the Coast Line carries on south from Exchange Quay, so the
  track is on one shore only. It also runs properly now.

The city
- The seafront walk stopped dead at every street mouth. It runs straight through: the
  paving and the sea railing carry across and only the furniture steps aside. It is
  also half again as wide, with a cycle strip along the landward side.
- Central Garden sat hard against the Ironworks docks and read as the harbour's back
  garden. It has moved a block west and two blocks south.
- Streets that stop at a park or the stadium get a forecourt and gate piers instead of
  a painted circle in the middle of nowhere.

Elsewhere
- Losing the police means losing all of them: a respray used to leave the helicopter
  overhead, which is the one unit a change of paint fools best.
- Typing "godmode" in play toggles invulnerability, every weapon and a map that
  teleports. Keys are swallowed while a code is being spelled.

Bug fixes
- The bicycle code added in 27.0.0 went into boatControl rather than the branch that
  drives the player's road vehicle, so neither the sprint nor anything else it did
  ever ran.
- The train braked for the next point on the line; rounding the corners had filled the
  path with points a few units apart, which held it to a crawl round every curve. It
  brakes for the next stop instead.
- Pedal strokes are taken from the key event rather than sampled off the key map each
  frame: a quick tap can begin and end between two frames, and losing those would have
  made fast pedalling slower than slow pedalling.

## 27.0.0 — The reclamation, the railway, the weather and a real camera

The city
- The street grid only ran south from y=128 and the island's north coast sat hard
  against the top of the world, so there was nowhere left to grow. Rows now run
  from -3968 and the coastline carries a northern lobe: map coordinates north of
  the old shoreline are negative. Block indices keep their old meaning, so every
  place, park and landmark recorded before the reclamation still points at its
  block. ROAD_CENTERS stays the column list and ROAD_ROWS is the new row list, and
  everything that walked the grid on both axes now picks the list for its axis.
- The tower core moved to the north-east point, built as setback towers on plazas.
  The old exchange district keeps its density but loses its towers.
- Harbor Point marina: a yacht basin cut into the north-west shore with four finger
  pontoons, sixteen moored boats, a club house and a fuel dock. The north apron is
  the cruise terminal.
- Two cruise liners, walkable rather than scenery. The Coral Dawn lies alongside the
  terminal and is boarded down the gangway; the Meridian Star rides at anchor out in
  the bay and has to be reached by boat or jetski from the new Harbor Point docks.
  Both carry a crowd of tourists.
- Streets that run out at the water now meet an esplanade -- a paved walk with a
  railing, lamps, benches and planting -- instead of the painted turning circle and
  guardrail they all used to end in. Only ends that genuinely stop inland keep it.

Getting around
- The railway is a perimeter system. The Bay Line leaves the cruise terminal, runs
  the length of Marlow Bay on its own viaduct -- crossing the road causeway as a
  flyover, never sharing it -- and swings ashore twice before crossing to the Keys.
  The Coast Line follows the western shoreline, bridges the marina mouth and runs
  south past Southport. Every corner is rounded into an arc before anything reads
  the route, and over water the viaduct stands on its own pile bents.
- Yellow cabs. The action key offers the ride or the hijack; take the ride and the
  map opens to pick a drop-off. The fare is distance-based and two stars gets you
  put out on the pavement.
- Bike-share stands at stations, park gates, the esplanade and the marina. Holding
  Shift stands you on the pedals for a harder gear that costs stamina.

Sky and light
- Weather: a chain from clear to heavy rain walked one step at a time, so it clouds
  over before it rains. Cloud dims the sun and greys the sky, rain falls and hisses,
  and wetness lags both -- the tarmac stays dark and greasy, and tyres let go
  earlier, for minutes after the shower. Heavy rain brings lightning and thunder.
- A broken cloud deck at flying height that you can climb into.
- The camera is perspective rather than orthographic, pulled back to a long lens and
  framed to cover exactly the same world height as before. Towers now lean and their
  flanks open up as you pass them. When one stands between the eye and the player, a
  marker is drawn through it.
- Flying shows a ring on the ground beneath the aircraft with a column joining the
  two, and a readout of the air between you and the nearest rooftops.

The Screamer
- Rebuilt: a lift hill nearly twice as tall, a first drop that reaches 122 km/h,
  airtime hills and a vertical loop carrying about three and a third g over the
  crown. 584 metres of track, 28 seconds, never below 37 km/h.

Bug fixes
- The ride shed speed as a fraction per second, which over a minute-long circuit bled
  it down to the floor of its own clamp; losses are now a deceleration, so the layout's
  energy budget decides what gets taken.
- The Ironworks shed rule read `by <= 2`, which was true of the whole reclamation once
  block rows went negative, so the new financial district was built as warehouses
  capped at fifty units.
- The title screen only offers the offline copy where a browser can actually save one.
- A parked vehicle far from the player with nothing driving it no longer has its
  control and integration stepped.

## 26.0.0 — Lethality, containment, Central Garden and Sunset Pier

Combat and survival
- One shared lethality model (`ballisticDamage` in combat-rules.js): an unprotected
  torso hit puts anyone down in one or two rounds, and a ballistic vest spreads the
  same energy over several and wears out doing it. Patrol officers, base security and
  Vescari wear vests; civilians and club security do not.
- Riding a vehicle when it detonates is now fatal. A vehicle under a quarter health
  warns the driver to bail out first. (The old code called `hurt(22)` immediately
  after `exitCar()`, which grants half a second of invulnerability, so that hit never
  landed at all.)
- Enemy fire is correspondingly heavier: police 17, gangs 14, rooftop security 17,
  base security 13, and the helicopter 12.

Police
- New `src/roadblocks.js`: containment. From four stars, and throughout the first
  job, dispatch cuts chokepoints — the six bridge approaches and mid-block sites on
  the four avenues. Two cruisers park nose-out, officers work from behind the engine
  blocks, concrete barriers close the kerbs and a spike strip covers the gap.
  Roadblocks are only ever built ahead of the runner and out of sight.
- Spike strips shred tyres: no drive, no grip and a constant pull to one side.
- Half of every dispatch now runs as an interceptor, routing to where the runner will
  be rather than joining the tail of the chase. Above three stars patrols close on the
  quarter panel and push instead of trailing.
- Air support now joins at four stars rather than five.

Missions
- Dockside Favor: the gate camera reads the plate on the way out, so units roll
  immediately and the helicopter is five seconds behind them. The drop is no longer
  the end of the job — the front shutter comes down behind the truck, the crates come
  off, the rear dock opens and the way out is on foot through the back alley to a car
  Vinny left there, then losing the tail.
- A Seat at the Table: suspicion climbs from being seen at all rather than only from
  crowding the target, and decays slowly. Cover blown means immediate aimed fire, a
  fourth bodyguard on the terrace stair, and the lift recalled to the lobby for nine
  seconds.

City
- Central Commons is now **Central Garden**, moved east and south (x 2265..3111,
  y 1800..2600) so it is a journey from the Old Quarter and so no train crosses it —
  the City Line runs up Garden St one street west. Rebuilt with the Great Lawn,
  Garden Lake and boathouse, the plaza and fountain, bandshell, rose garden,
  playground, gazebo, an outdoor gym with regulars working sets and talking between
  them, three food trucks with queues, and around 280 trees.
- Reclaimed waterfront: the coastline now runs outside every block of the grid, so all
  eighty land blocks are built city instead of stopping short at a ragged shore.
- A real financial core: heights fall off from the centre, towers step two or three
  times, carry masts, mullion fins and glazed podiums.
- **Sunset Pier**: a new island in the lower bay reached by the Palm Ave causeway off
  the Stadium Way crossing, with a ridable rollercoaster (press E at the station), a
  big wheel, carousel, teacups, a drop tower, a midway and a crowd.
- Street ends are streets: kerbed turning heads, guardrails, chevron boards and a NO
  THROUGH ROAD plate, instead of a road that simply stops.
- Two new venue kinds with real functions: 24-hour diners (a meal and a coffee), and
  outfitters, where a change of clothes ends a search that is running on a description.

People and traffic
- Carjacking: traffic carries drivers. Opening a door hauls one out — thrown clear
  along the door line, landing on their back, getting up dazed, and only then deciding
  what to do: run, plead, chase you shouting, or stand there calling it in (which
  costs you heat). About one car in three is locked and says so; the window has to go
  first, and a couple of drivers answer a gunshot by aiming the car at you.
- A daily rhythm: the mix of walking, loitering, window shopping and sitting, the pace
  people walk at, and how many of them are out all follow the clock. The crowd is
  thinned by removing pedestrians, never by hiding them.

Environment and graphics
- Mountains are trekked, not strolled. The trail is graded and walkable both ways; off
  it, a moderate face slips you sideways, a steep face cannot be climbed, and stepping
  over the lip of one means going down it on your back.
- The shoreline's flat foam and shallow quads are gone. They were fixed planes a few
  units under a surface displaced by four Gerstner swells, so they surfaced through the
  waves as pale rectangles; the water shader already draws the wash, the breaking band
  and the wet sand. What is left is real build: quay edging, coping, bollards and sand banks.
- Warmer key light, cleaner sky, a higher sun, a wider and sharper shadow cascade,
  and street planting on all four kerbs of every block.

Bug fixes
- Shore colliders were stored in the static grid under a string key while every lookup
  uses a numeric one, so coastlines stopped nothing. Cars now meet the shore.
- The radio no longer clicks: playback starts past the MP3 priming frames and fades up
  from silence, and the loop is handled here rather than by the element so the seam is
  clean too. Oddball is preset one and the station the dashboard comes up on.
- Parachuting onto the Blue Hour terrace lands you on it instead of pushing you off the
  parapet — and arriving in street clothes during the hit raises the alarm.
- Tower roof plant is placed on the finished crown and on the terrace the setback
  leaves, rather than buried inside it.
- Death and mission restarts clear an active coaster ride and an active fall.
- Removing a pedestrian clears any companion still following them.
- The title screen only offers the offline copy where a browser can actually save
  one; sandboxed hosts and bare `file://` copies hide the link rather than showing
  one that silently does nothing.


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
