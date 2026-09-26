# Changelog

## Unreleased — the car and motorbike redesign, and the flagships

Civilian cars (cars3d.js) and motorbikes (motorbikes3d.js), rebuilt at real size to the police
models' standard: lofted curved bodies with wings, arches and tumblehome, five-pane glass with
sky reflections, LED lamps and light bars, grilles, mirrors, real wheels with brake discs and
calipers, clear-coated paint in each class's real colours (`palette`), livery decals.

- **Redesigned** (all `modelScale` 1): REGENT (mid-size saloon), CITY CAB (Crown Vic cab: checker
  band, lit TAXI sign), VOLT COUPE (electric fastback, glass roof), DUKE V8 (Challenger: quad
  halo lamps, stripes, racetrack tail), COMET GT (911: frog eyes, louvred lid), SOLSTICE SPIDER
  (MX-5 top down: cockpit, hoops), KODIAK RS (rally hatch: scoop, roof wing, light pod),
  HELLFIRE CUSTOM ('32 coupe: blown V8, zoomies, whitewalls, flames), V12 TEMPEST (front-mid GT),
  MONARCH V12 (Phantom-style saloon), SOVEREIGN STRETCH (Town Car limo), RANGER 4X4 (Range Rover:
  floating roof), MULE VAN (high-roof panel van), WORKHORSE (crew-cab pickup with an open bed),
  VORTEX 900 (naked triple), NOMAD CRUISER (V-twin: chrome, whitewalls, shotgun pipes).
- **New flagships**: CHEVETTE Z06 (mid-engined flat-plane V8 after the C8 Z06: stripes, flank
  intakes, engine glass, wing), BRUTINI SVJ (V12 wedge after the Aventador SVJ: Y lamps,
  hexagons, big wing, high hex pipes), CAVALINO 458 (berlinetta after the 458 Italia: boomerang
  lamps, twin round tails, triple pipes; nearly always red), DOLCATI V4 (Panigale V4-style
  superbike: slit LEDs, winglets, single-sided arm), YAMASAKI 1000RR (R1 / ZX-10RR-style, blue or
  green), KR 500 (500 cc enduro after the KTM 500 EXC: orange plastics, knobbly tyres, long
  forks, high fender).
- **Riders**: one merged rider per riding pose (crouched on the superbikes, upright on the
  cruiser, standing tall on the enduro) inside `model.rider`, the anchor riders.js's throws hide.
  The fork steers; the KR 500 wheelies under full throttle below 70 km/h (the superbikes a little
  off the line).
- **KR 500 handling**: full traction on dirt, grass and the trails, climbs grades a 4x4 slides
  back down, 60 km/h off the trail and 85 on it (terrain.js `dirt`), little rolling drag off the
  tarmac; the knobblies lose up to a fifth of their grip on tarmac by 120 km/h
  (physics.js `tyreSurfaceGrip`); light (190 kg with rider) and quick to turn.
- **Engines**: flat-plane V8 set (Chevette, Cavalino), V12 set (Brutini), single (KR 500); the
  superbikes use the bike set pitched lower (Dolcati) and higher (Yamasaki).
- **Where**: one traffic car in forty is a flagship; SHOWCASE PARKING (game.js) puts them at North
  Point's avenue, the marina, the Marea valet line and the Sunset Pier VIP bays, kerbside or in
  the bays; KR 500s wait at the Mount Ascent and Needle Ridge trailheads and Stonecreek Lodge.
  Respray garages class the flagships as performance cars and every motorbike as a motorcycle.
- **Damage**: the new models keep the contract (crumpled shell and panes, sprung hood over the
  engine bay, hanging bumpers, sprung doors from the real sill, cracked and burst glass, broken
  lamps, flat tyres, soot and embers); bullets find the new glasshouses (damage.js
  `CAR_GLASS_BANDS`).
- **Console**: `carLineup`, `showcase`, `carModels`, `accelTest`.

Measured with `DeadEndCity.accelTest` (0-100 and 0-200 from a standstill, top speed rolling from
90% of the spec's):

| Vehicle | Length · mass | 0-100 km/h | 0-200 km/h | Top speed |
| --- | --- | --- | --- | --- |
| REGENT | 4.85 m · 1.45 t | 9.03 s | | 180 km/h |
| CITY CAB | 4.9 m · 1.5 t | 9.53 s | | 175 km/h |
| VOLT COUPE | 4.4 m · 1.25 t | 6.53 s | | 205 km/h |
| DUKE V8 | 5.0 m · 1.65 t | 5.03 s | 20.6 s | 245 km/h |
| COMET GT | 4.5 m · 1.1 t | 3.83 s | 14.1 s | 290 km/h |
| SOLSTICE SPIDER | 4.2 m · 1.12 t | 4.83 s | 19.3 s | 250 km/h |
| KODIAK RS | 4.35 m · 1.38 t | 4.03 s | 16.8 s | 230 km/h |
| HELLFIRE CUSTOM | 4.5 m · 1.5 t | 4.33 s | 16.2 s | 235 km/h |
| V12 TEMPEST | 4.7 m · 1.35 t | 2.93 s | 9.27 s | 330 km/h |
| MONARCH V12 | 5.3 m · 2.05 t | 5.03 s | 19.9 s | 250 km/h |
| SOVEREIGN STRETCH | 8.8 m · 3.4 t | 9.53 s | | 190 km/h |
| RANGER 4X4 | 4.95 m · 2.3 t | 9.03 s | | 175 km/h |
| MULE VAN | 5.25 m · 2.35 t | 13.03 s | | 150 km/h |
| WORKHORSE | 5.6 m · 2.7 t | 10.03 s | | 165 km/h |
| **CHEVETTE Z06** | 4.69 m · 1.56 t | 2.73 s | 9.13 s | 315 km/h |
| **BRUTINI SVJ** | 4.94 m · 1.53 t | 2.83 s | 9.40 s | 350 km/h |
| **CAVALINO 458** | 4.53 m · 1.48 t | 3.03 s | 10.2 s | 325 km/h |
| VORTEX 900 | 2.1 m · 0.3 t | 3.23 s | 11.6 s | 225 km/h |
| NOMAD CRUISER | 2.45 m · 0.44 t | 5.03 s | | 180 km/h |
| **DOLCATI V4** | 2.11 m · 0.28 t | 2.93 s | 6.47 s | 300 km/h |
| **YAMASAKI 1000RR** | 2.07 m · 0.28 t | 3.03 s | 9.23 s | 295 km/h |
| **KR 500** | 2.2 m · 0.19 t | 4.43 s | | 150 km/h |

Performance (HIGH, street zoom, 24 cars of the traffic mix parked in view on the Oceanview
runway, minus the empty scene; before = the old box-built models at `modelScale` 0.8): view draw
calls +989 -> +462 (41 -> 19 a car), shadow draw calls +554 -> +72 (23 -> 3), triangles +82k ->
+249k (3.4k -> 10.4k a car, shadow pass included). Per model (`carModels`): cars 19-23 draws,
3 shadow casters, 6.6-9.6k triangles; motorbikes 11 draws.

## Unreleased — Monarch Isle: a rich island district north of the mountains

- **A new island** (monarch.js, monarch-life.js, monarch*3d.js; SOURCE_GUIDE section 4,
  "Monarch Isle"): x 5460..10150, y -5272..-468, about 580 x 600 m, north of the Ridgeline
  Range across the Regency Channel and east of North Point across Sovereign Sound.
- **Blocks are strictly 100 m**: street centrelines 800 units apart both ways (columns 5600 to
  9600, rows -4544 to -1344); two divided boulevards (Crown Avenue, Monarch Boulevard) with
  lime medians, two roundabouts with fountains (Crown Circus, Harbour Circle), a waterfront
  Marina Drive, street trees and triple lanterns down every pavement.
- **Two new bridges**, both on the GPS, traffic and police road graphs: the SOVEREIGN BRIDGE
  (North Point's Crown Ave to the island; a harp cable-stayed bridge with a pylon leaning 60
  degrees back over the landing) and the REGENCY BRIDGE (Harbour Circle to the range's west
  coast; three white bowstring arches), with Regency Road on to Eagle Pass.
- **Fourteen villas** in nine styles behind walls, hedges and open gates with guards, drives
  with two luxury cars each, pools, terraces and tennis courts; five on Monarch Beach with
  their own strands of loungers and parasols, three on the east cliffs.
- **Two supertall towers**: THE SOVEREIGN (57 storeys, ~186 m, bronze fins, a lit lantern and
  spire) and MONARCH ONE (48 storeys, twisting, balcony bands, LED crown, rooftop helipad with a
  helicopter), on plazas with lawns, plane trees, reflecting pools and bronze sculptures.
- **27 businesses** with their own signs: fashion, jewellery, watches, a tailor, a florist, a
  private bank, a gourmet grocer, CAFÉ ROYALE, a wine bar, a gallery, a private clinic and spa,
  L'ÉTOILE, THE REGENT HOTEL, a supercar showroom with a premium fuel station, a country club
  with courts, pool and putting green, an academy and chapel, a police substation and the
  harbourfront (oyster bar, gelateria, yacht broker, chandlery, champagne bar, boutique).
- **Monarch Harbour**: seven pontoons of berthed yachts, three superyachts at the mole, a fuel
  pontoon, yacht club, harbour master's tower and lighthouse; boats come and go in the basin.
- **Royal Botanic Garden**: a Kew-style Palm House (translucent glass, palms, banana and tree
  ferns inside, warm glow at night), giant water lilies, parterres, cacti, dragon blood trees,
  bird of paradise, bamboo, topiary, bougainvillea arches, flowering cherries; visitors taking
  photos.
- **Life**: island traffic on its own lane graph (junction boxes, anticlockwise roundabouts,
  hand-over with city traffic on the Sovereign Bridge), well-dressed walkers who cross at the
  zebras and look both ways, joggers, dog walkers, doormen, valets and guards, two payphones,
  bike-share stations, fountains, rigging, gulls and garden birds.
- **Night light**: the island has its own lamp light map beside the city's (lighting3d.js).
- Console: `DeadEndCity.monarch()` (plan, traffic, walkers, walk-graph audit).

## Unreleased — one character rig for everyone: the player, police, NPCs

Characters (character-rig3d.js new, crowd3d.js rewritten; render3d.js, beach3d.js, sports3d.js,
base3d.js, parachute3d.js, flight-view3d.js, lighting3d.js)
- **One modern rig for everyone on foot.** The player, patrol and traffic officers, SWAT,
  agents, soldiers (in pursuit and at Fort Sentinel), gangs, mobsters, party guests, mission
  characters, pedestrians, beachgoers, footballers, basketball players, referees, stewards
  and riders are all drawn from one set of sculpted instanced parts. The old boxy per-person
  models (the player's was the oldest code in the game, ~20 meshes each), the beach's box
  figures and the athletes' box models are gone.
- **Real proportions at real size**: modelled at `PERSON_HEIGHT` (1.75 m, 14 units), about 7.5
  heads tall (crown 14, chin 12.2, shoulders 11.3, hips 7.3, knees 4.0 units); male and
  female bodies; adults 1.6-1.9 m, the player 1.80 m, basketball players ~1.95 m. The rig is
  never scaled again (`PERSON_SCALE` only converts old offsets).
- **Smooth low-poly forms** lofted from rings: a head with jaw, ears, nose and a face hint
  (eyes, brows, lips, stubble or beard), seven hair styles, cap / patrol cap / helmet / sun
  hat / hard hat, neck and trapezius, chest, waist, hips, deltoids, elbows, hands with a
  thumb, knees, calves, shoes and boots. A close-up set and a street set (about a quarter of
  the facets) are built; one is drawn per frame.
- **Clothing through paint, not draw calls**: each instance carries four packed colours and
  a region mask, so one torso is a tee, V-neck, tank, crop top, bikini, one-piece, open
  jacket over a tee, suit and tie, police shirt with badge, hoodie or dress; procedural
  camouflage, denim, check, floral and Breton patterns, leather and satin sheen, club kits
  (stripes, hoops, halves, sash). Beachwear on the beach and in the resort districts, suits
  downtown, hi-vis on workers.
- **The player**: dark leather jacket with HUD-gold shoulder yokes over a white tee, dark
  denim, brown boots, a short dark crop and stubble; readable from above in a crowd; the
  night rim now lives in the rig's shader. The rooftop disguise is a cream suit.
- **Police**: LAPD-style navy uniforms with badge, duty belt (holster, pouches, radio, cuffs),
  shoulder radio, patrol cap on some; traffic officers in a hi-vis vest and white cap; SWAT in
  black with helmet, plate carrier, gloves, knee pads and POLICE across the upper back; agents
  in dark suits with FED on the back; soldiers in woodland camouflage with helmet, plate
  carrier and gloves (military police with a white helmet band).
- **Weapons held properly** by two-bone IK: pistol two-hand isosceles grip, rifles and the
  shotgun shouldered with the support hand on the handguard, the SMG at the chest, the rocket
  tube on the shoulder, a low-ready pistol, a rifle carried across the chest, the knife
  slash, the fist guard and punch, the SWAT shield; recoil kicks, the reload drops the
  magazine hand; the player carries a pistol or SMG at the side until firing.
- **Animation**: a planted-foot gait (each foot is fixed on the ground for its stance and
  swung forward in an arc, hip and knee by IK), heel strike and toe-off, the pelvis rising
  over the planted leg, arms against the legs, a forward lean and a flight phase at the run,
  strafing and backpedalling (hips follow the travel, the upper body the aim), stepping round
  on the spot when turning, breathing and weight shifts; car get-in and get-out, the Marea
  pool dive and climb-out, front crawl, breaststroke, treading water and floating, freefall
  and canopy under the parachute, the tumble; riders sit on bicycles, share bikes,
  motorbikes and jet skis with hands on the grips and feet on the turning pedals; beach
  poses (sunbathing on the back or front, sitting, reclining, kids digging, wading) and the
  volleyball and match-day touches (kicks, saves, dribbles, jump shots, rebounds, the
  assistant's flag).
- **Size parity**: the see-through hole round the player follows `PERSON_HEIGHT`; the gun's
  aiming plane is at shoulder height; the parachute pack and harness sit on the new body.
- **Performance**: everyone costs one instanced draw per part in use (about 30 camera calls
  and 12 shadow calls for all the people in view), fewer than before once officers, gangs,
  guards, athletes or beachgoers are on screen (each old figure was a dozen or more draws;
  22 footballers alone were hundreds). Far away, anyone just standing or walking is a
  three-instance figure. Anyone lying or sitting still (sunbathers, bodies) is recorded once
  settled and copied back each frame instead of re-solving the skeleton, and packing
  allocates nothing per person.
- Measured headless (SwiftShader, HIGH, 13:00, zoom 1; before = the lead branch): downtown
  251 / 341 camera / shadow calls before, 244 / 336 after (people: 28 + 12); the beach 221 /
  246 before, 222 / 243 after; a 3-star pursuit 503 / 490 before with 7 officers, 561 / 434
  after with 8 (people: 33 + 12, the rest is the chase). Packing everyone costs 0.6 ms
  downtown and about 4 ms at the busiest beach (150 people, 3200 instances) on that throttled
  machine (`crowdBenchmark`).
- Console: `characterLineup(stance, spacing)`, `inspectView(yaw, pitch, lift)`,
  `crowdStats(byPart)`, `crowdBenchmark(frames)`; `closeUp` goes to 24; `scaleReport().crowd` reads the rig's statures.
## Unreleased — the 4x4 club, trail mud and the hill climb

World (offroad.js, offroad3d.js, terrain.js, county3d.js)
- **RIDGELINE 4X4 CLUB**: a gravel lot cut level into the foot of Mount Ascent across Eagle Pass
  from the trailhead (x 7410..7700, y 2034..2194; 3.75 m clear of the road, 7 m of the trail):
  log rails, a carved 4X4 CLUB board on log posts with a rusted steel emblem and lamps, a pop-up
  canopy with a table and a lantern, camp chairs round a fire ring, a cooler, a kettle grill that
  smokes, the club flag flying, string lights and lanterns after dark. Seven members stand about,
  grill, sit by the fire and talk shop ("Aired down to 15 psi!", "Lockers engaged?", "Last one to
  the summit buys the beers.", rain, night and theft lines, remarks on a muddy truck or a road car).
- **Seven club trucks** at real size (modelScale 1), each its own lofted body, livery and kit:
  | Truck | Size (m) | Mass | Top / 0-100 | Tyres, drive | Kit |
  | --- | --- | --- | --- | --- | --- |
  | ROVER SERIES III SAFARI | 4.45 x 1.68 | 1.75 t | 110 / 0-80 in 19 s | MT, 4x4, low range | safari double roof, alpine lights, bonnet spare, rack and jerry cans, rear ladder, zebra livery |
  | BADGER RUBICON CRAWLER | 4.33 x 2.00 | 2.1 t | 150 / 10.8 s | 37" MT on beadlocks, 4x4, lockers | no doors, sport cage and bikini top, seats, winch bumper, sliders, tube fenders, screen light bar |
  | MUSTANG RIDGE BRONCO | 4.20 x 1.86 | 2.05 t | 155 / 9.8 s | AT with raised letters, 4x4 | teal and white two-tone, chrome bumpers, swing-away spare, rack |
  | HIGHLANDER 70 EXPEDITION | 5.22 x 1.94 | 2.75 t | 150 / 15.5 s | MT, 4x4, lockers | roof tent, sand ladders, jerry cans, snorkel, bull bar and winch, light bar, rear ladder and spare |
  | TAURO HX35 ARCTIC | 5.33 x 1.94 | 2.2 t | 175 / 10.5 s | AT, 4x4 | flares, snorkel, roof light bar and pods, sports bar, loaded bed |
  | OKTAV 6×6 EXPEDITION | 5.87 x 2.11 | 3.85 t | 160 / 7.8 s | MT on beadlocks, three axles, lockers | wing indicator pods, side pipes, rack and light bar, bed rollbar with pods |
  | SIDEWINDER TROPHY TRUCK | 5.80 x 2.24 | 2.75 t | 210 / 5.4 s | desert, 4x4, long travel | race livery #88, bed cage over two spares, coilovers and bypass shocks, louvered hood |
  Tyres are modelled (lathed carcass, staggered lugs: mud-terrain, all-terrain, desert); every
  wheel steers, spins at the wheel speed (ahead of the truck when it spins) and follows the ground
  within its travel. Taken or wrecked trucks are replaced while nobody watches.
- **Trail mud**: every trail vertex carries mud and rock (baked with the trail's own distance
  along and across): muddy dirt on the lower switchbacks, THE BOG and the MUDDY HAIRPIN on Mount
  Ascent, rock steps higher up; deepest in the ruts, firmer on the crown and the edges. The
  terrain shader draws dark wet mud, churned ruts and brown puddles that mirror the sky, wetter
  after rain (weather.wet), and pale rock ledges (with slabs) on the steps.
- **Hairpins**: four Chaikin passes round each hairpin (two left a right angle at the apex) and
  the legs are evenly spaced up the face (bunched at the top, the last two were 6 m apart); the
  hairpin pads are found in order along the curve (the third pad had landed on the first).
  Steepest graded pitch 0.37 (was 0.53).

Physics (offroad.js `offroadDrive`, called from physics.js)
- On the range the driven wheels push at most mu x their load: surface (packed dirt 0.68, grass
  0.58, mud down to ~0.3, wet mud lower, rock 0.8) x tyre (mud-terrain, all-terrain, desert, road)
  x driven share (1 for 4x4; ~0.5 for two-wheel drive, shifting with the grade). Past it the wheels
  spin (the wheel speed runs ahead of the ground: drawn, heard in the revs) and grip drops to
  sliding friction. Low range multiplies the pull under 35 km/h. The brakes hold a stopped truck
  up to the same friction; steeper, it slides back. Mud adds rolling resistance (heavier trucks
  sink further); rough ground above a truck's suspension speed bounces and scrubs it; rock ledges
  jolt it, and hurt anything taken over them fast. Sideways grip follows the surface. Replaces the
  old flat traction factors, speed caps and heavy drag on terrain.
- Body pitch and roll come from the ground under the four wheels, not the slope at the middle.
- Measured with `trailDrive` (line-following pilot, dry): road cars stop spinning in the first mud
  (sample ~55 of 401); the crawler reaches the summit in 1:39, the Series in 2:01, the Hilux and the
  Ranger in 2:10-2:15; in the wet the bog stops a 4x4 driven up the middle of the ruts.

Effects (offroad3d.js)
- Mud clumps thrown rearward and up from spinning or fast tyres in mud (lit, instanced, ballistic,
  splatting where they land), a finer mist, pale dust on dry dirt; tyre tracks behind every wheel
  on dirt that fade over minutes. Pools: 640 clumps, 360 mist, 700 splats, 1800 track prints; no
  per-frame allocation.
- Mud on bodies (`c.mudCoat`, `c.mudWet`): a shader layer on the paint (every vehicle), trim and
  tyres (club trucks), heaviest low down, dark and glossy when fresh, pale when dry; washed off by
  rain and by driving through water (the sea, lakes, streams).
- Engine audio revs with wheelspin and pulls low-range revs at crawling speed.

Hill climb
- Crossing a trail's start gate starts the clock; three checkpoints in order; SUMMIT REACHED shows
  the time and the best clean run (localStorage `dead-end-city-hillclimb`). E at the club sign in a
  vehicle arms the Mount Ascent challenge: beat 2:30 for $1,000. A running clock (with 4LO) shows
  during a climb.

Console: `offroad()`, `clubLineup(x, y)`, `hillClimb(action, trail)`, `trailDrive(seconds, maxKmh,
trail)`, `trailProfile(trail, step)`, `mud(amount, wet)`.

## Unreleased — the respray garages: real-scale workshops, prices and a drive-in show

- **The helicopter loses you inside.** Every garage bay and office is overhead cover
  (garages.js `registerGarageCover`, air-cover.js): drive into Eastside Garage with the
  helicopter overhead and it reports HIDDEN FROM AIR at once; with no ground unit in sight
  the lose-police timer runs. Measured on a 3-star chase: helicopter `seesPlayer` true on the
  apron, false from the moment the car is under the roof, search timer counting down inside.
- **Where the searchlight lands:** `overheadCoverHeight(x, y, elevation)` (air-cover.js)
  returns the top of the roof over a target (map units; 55.2 = 6.9 m for a garage) or null in
  the open, for the helicopter's pool to sit on the roof instead of the car.
  `DeadEndCity.cover()` reports it as `roofHeight`.
- **Renamed and signed:** EASTSIDE CUSTOMS is now EASTSIDE GARAGE; PALM AUTO PAINT is PALM KEYS
  AUTO, BATTERY MOTOR WORKS is SOUTH BANK MOTOR WORKS, STONECREEK GARAGE stays. Every shop has
  its rooftop billboard (with MECHANICS on its tagline), a lit fascia over the door
  ("MECHANICS · RESPRAY · REPAIR" and the like) and a MECHANICS lightbox over the office; the
  city map shows the name and MECHANICS · RESPRAY under each R badge. Mission 2's objective,
  the billboard ad and the story's proper nouns follow the new name.
- **Prices** (`garageOffer`): respray by class (motorcycle $200, compact $250, saloon $300,
  performance or SUV / van $400, truck / bus $500), repair by damage ($100 plus up to $1,400,
  so $100-1,500), both together 15% off. The prompt shows the bill ("RESPRAY + REPAIR · $580").
  Short of the full bill the shop does the respray alone; short of that, "Sorry, friend … Come
  back with cash" and no service. Vinny still pays for the cargo truck on the first job.
- **The police rule:** a respray clears the stars only when no unit, on the ground or in the
  air, had eyes on you from the order until the door was down (`policeHaveEyesOnPlayer`,
  citylife.js). Seen driving in, you get the paint but keep the stars ("They saw you drive in").
- **The building** (garage3d.js, `GARAGE_PLAN`): a brick and clad-steel workshop, bay 10 m
  wide and 15 m deep, eaves 6.4 m, a sectional roll-up door 6 m wide and 5 m high (the 12 m bus
  and the 10 m box truck fit with 1.5 m to spare), side windows, a parapet with AC units,
  skylights and an extract stack, and a 6 x 8 m office. Inside: an epoxy floor with bay lines,
  hatching and oil stains, a two-post lift, two red rolling tool chests, a workbench with a
  vice and a pegboard, a compressor and hose reel, a tyre stack, an engine hoist with an engine
  on the chain, oil drums, a paint cart, the paint zone (extraction fan, filter banks, a spray
  gun on a gantry trolley), fluorescent tubes, a NO SMOKING sign, a calendar and a fire
  extinguisher. Two mechanics in navy overalls work there (crowd scene members).
- **The drive-in show** (about 11 s; E skips to the bill): the car rolls in at walking pace to
  the lift, the door rattles down (animated slats, amber beacon), the camera frames the bay
  and the roof and front lift off, paint mist in the new colour and the new colour creeping
  over the body, grinder sparks when there is damage to mend, a dip to black with the bill
  ("RESPRAYED · REPAIRED · SALOON · $580 paid"), the door rolls up and the car rolls out onto
  the apron. `DeadEndCity.garage()` reports the shops, the offer, the job and the last service.
- The car's paint follows `vehicle.color` live (damage3d.js paint key), so a respray shows
  without waiting for new damage.

## Unreleased — tighter steering, rain for every driver, riders thrown, helicopters that break up, the drawbridge launch

Steering (physics.js STEER_LOCK, TYRE STIFFNESS, UNDERSTEER SKID; measured with `turnTest`)
- Low-speed lock 13% tighter (`STEER_LOCK`, a game's allowance on each class's `turn`); the
  player's car takes up the yaw in 0.12 s (`PLAYER_YAW_RESPONSE` 8.5/s, was 5); the tyres'
  sideways force now peaks at a 7-degree slip (`TYRE_PEAK_SLIP`), so a car follows its nose
  (7 degrees of body slip at the limit at 30 km/h, was 13-14) instead of drifting wide.
- Held against the grip limit above 28 km/h for over half a second, the front tyres scrub:
  howl, marks, up to 0.12 g off, so a corner taken too fast tightens as the car slows. Taps,
  lane changes and sweeping bends are untouched. Skid marks also for slides past ~10 degrees.
- Handbrake: full swing by 15 km/h (was 30) and the yaw carries on through the slide, so a
  30 km/h handbrake turn goes round. Counter-steering into a slide makes the fronts bite 1.5x.
- Grip-limited cornering (g at 40/60 km/h) is unchanged: at speed the tyres still decide.

| Class | Min radius m (kerb-to-kerb) before -> after | 20 km/h radius | 40 km/h radius (g) | 60 km/h radius (g) | 90° corner from 35 km/h coasting, forward x sideways m | Handbrake from 30 km/h, degrees |
| --- | --- | --- | --- | --- | --- | --- |
| Sedan | 3.9 (10.5) -> 3.4 (9.6) | 4.2 -> 3.5 | 10.4 -> 10.2 (1.23) | 22.3 -> 20.6 (1.25) | 9.2 x 4.7 -> 8.2 x 5.3 | 85 -> 90 |
| Coupe | 3.4 (9.2) -> 3.0 (8.4) | 3.7 -> 3.0 | 9.4 -> 9.2 | 20.1 -> 19.1 | 8.7 x 4.3 -> 7.7 x 4.9 | 92 -> 94 |
| Sport | 3.0 (8.6) -> 2.6 (7.9) | 3.3 -> 2.7 | 8.4 -> 8.0 | 17.8 -> 17.6 | 7.7 x 3.5 -> 6.7 x 4.3 | 94 -> 96 |
| Supercar | 3.4 (9.6) -> 3.0 (8.8) | 3.5 -> 3.0 | 7.8 -> 7.5 | 16.9 -> 16.9 | 7.4 x 3.7 -> 6.5 x 4.2 | 89 -> 94 |
| Muscle | 4.1 (11.0) -> 3.6 (10.1) | 4.3 -> 3.6 | 10.0 -> 9.9 | 21.3 -> 20.9 | 9.0 x 4.4 -> 8.1 x 5.0 | 81 -> 87 |
| Patrol car | 3.4 (9.6) -> 3.0 (8.8) | 3.7 -> 3.0 | 9.5 -> 9.2 | 20.3 -> 19.3 | 8.3 x 4.0 -> 7.4 x 4.6 | 90 -> 93 |
| SUV | 4.7 (12.6) -> 4.1 (11.4) | 4.9 -> 4.2 | 11.9 -> 11.6 | 25.7 -> 23.3 | 10.1 x 5.1 -> 9.1 x 5.8 | 77 -> 84 |
| Van | 5.2 (13.7) -> 4.6 (12.5) | 5.4 -> 4.7 | 12.8 -> 12.2 | 28.1 -> 24.9 | 10.5 x 5.8 -> 9.6 x 6.1 | 70 -> 78 |
| Box truck | 8.0 (19.8) -> 7.0 (17.9) | 8.1 -> 7.1 | 17.2 -> 15.5 | 37.0 -> 30.3 | 13.3 x 7.5 -> 12.1 x 7.6 | 50 -> 61 |
| Bus | 9.5 (22.8) -> 8.4 (20.6) | 9.6 -> 8.4 | 16.7 -> 14.3 | 37.1 -> 29.9 | 14.1 x 8.5 -> 12.8 x 8.3 | 42 -> 52 |
| Motorbike | 2.7 (6.7) -> 2.4 (6.0) | 3.0 -> 2.5 | 10.0 -> 9.9 | 21.9 -> 22.2 | 8.8 x 4.9 -> 7.9 x 4.9 | 98 -> 96 |
| Bicycle | 2.2 (5.4) -> 1.9 (4.9) | 3.4 -> 3.3 | (35 km/h) 11.2 -> 11.1 | - | 11.7 x 7.6 -> 10.9 x 7.6 | - |

  A 2-lane street is 11 m kerb to kerb: every car now U-turns in one sweep (a sedan in 9.6 m),
  vans and pickups with one shunt; trucks and buses need the junction.

Rain for every driver (physics.js controlVehicle; `aiDriving(reset)` counts)
- Traffic's cornering, brakes and traction shrink with `wetGrip()`, and it drives 15% slower on
  a soaked road (sqrt of the grip: the same factor makes trafficControl's stopping and
  following distances allow for braking at 72%); one driver in eleven keeps dry habits.
- Police in pursuit steer to 1.1 x the dry limit x (0.7 + 0.3 grip) with wet tyres, and their
  brakes and traction shrink: a cruiser thrown into a corner in a downpour can slide or spin.
- Measured downtown (3.3 min of traffic, 2.5 min of a 3-star pursuit on foot; dry -> storm):
  moving traffic's mean speed 30.5 -> 24.7 km/h, traffic crashes 1 -> 0; police crashes
  3 -> 6, police slides 0 -> 2 (closing speeds 63-80 -> 58-104 km/h).

Riders thrown off motorbikes and bicycles (new riders.js; physics.js, carjack.js, drawbridge.js)
- A crash delta-v over 24 km/h on a motorbike (18 on a bicycle), or a drawbridge landing into
  the road over 6.5 m/s, throws the rider over the bars with the bike's speed going in: a real
  ballistic arc (climb 0.22 x speed, up to 6 m/s), a somersault, strikes on walls, trunks and
  tall vehicles (a car's roof is vaulted), a landing and bounces, a slide at 0.62 g (less in
  the wet), a moment lying still, then up. Damage by the speed into each thing, the landing and
  road rash, on top of the crash's own injury; god mode survives. The bike slides on alone,
  cartwheeling while quick, and lies on its side until someone gets on. Traffic's riders do
  the same as pedestrians. Wanted and crime rules are the crash's own.
- Measured (`rideInto`, speeds at impact): 15-22 km/h into a car, bicycle 12, 90 km/h on open
  road: stays on. Motorbike 26 / 34 km/h into a sedan's side: thrown into it, 10 / 21 hp;
  52 / 77 km/h: over the roof, 7 / 19 hp from the landing and slide plus the crash's 7 / 20,
  about 30 m from the bike. 35 km/h into a box truck's side: 26 hp; 51 km/h (cruiser): 50 hp
  plus 8; 76 km/h: dead (god mode: unhurt). Bicycle 17 / 25 km/h: 3 / 10 hp. A traffic rider
  at 58 km/h lands 32 m on with 49 of 70 hp.

Helicopters and planes break up (physics.js AIRCRAFT STRIKES; `heliInto`)
- Airborne and faster than 40 km/h into a building, a structure, a big vehicle or a hillside
  (or touching the ground above 40 km/h, or any terrain contact above 60): destroyed, the
  usual vehicle explosion, debris and fire, the burning wreck falls; the player dies, or in
  god mode is thrown clear and lands unhurt. Slower is the ordinary crash damage.
- The rotor disc (the airframe's length) against a wall: more than 15 km/h toward it is a
  rotor strike and the same break-up; slower, the tips chip (6 hp), the helicopter is shoved
  clear and the pilot warned.
- Measured into a tower's face at 15 m: 10 / 25 / 35 km/h: 0 / 5 / 10 hp; 45 / 60 / 120 km/h:
  destroyed (mortal at 60: dead). Past the corner with the mast 2.5 m clear: 8 / 12 / 20 km/h
  grazes (6-12 hp), 40 km/h (28 km/h into the corner) rotor strike. Hillside at 25 km/h: stops
  against it unhurt; 50 / 100 km/h: destroyed.

Drawbridge (drawbridge.js; `bridgeJump`)
- Real gravity kept. Leaf geometry checked: the gap is 2 (leaf (1 - cos a) + drop sin a) and
  the tips stand leaf sin a - drop (1 - cos a) high (12.5 m leaves on trunnions 1 m below the
  road). New: the kink at the trunnion takes the speed square to the leaf off (a car keeps
  cos(angle) of its speed up the slope) and hurts above 5 m/s into it; the wheels' push on a
  leaf enters as its horizontal part; the nose (half the car ahead, pitched) must reach the
  far tip above it or strikes the leaf's end; a long jump lands on the approach span instead
  of splashing into "the Sound" beyond the far leaf.
- Sedan, speed held from 25 m out (throttle floored up the leaf when the slope pulls it under):

| Leaves | Gap / tip height | 20 km/h | 30 | 40 | 60 | 80 | 100 | 140 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5° | 0.3 / 1.1 m | clears | clears | clears | clears | clears | clears | clears |
| 10° | 0.8 / 2.1 m | clears | clears | clears | clears (12 hp) | clears (14) | clears (17) | clears (33) |
| 15° | 1.4 / 3.3 m | clears | clears | clears | clears (22) | clears (30) | clears (43) | clears (70) |
| 20° | 2.3 / 4.3 m | clears | clears | clears (28) | clears (35) | clears (50) | clears (68) | clears (103) |
| 25° | 3.3 / 5.3 m | clears | clears | clears (34) | clears (50) | clears (69) | clears (90) | clears (136) |
| 30° | 4.4 / 6.1 m | clears (just) | clears | clears (43) | clears (62) | clears (85) | clears (110) | lands wrecked (150) |
| 35° | 5.6 / 7.0 m | strikes the far leaf | clears (just) | clears | clears (74) | clears (100) | clears (129) | lands wrecked |
| 40° | 7.1 / 7.8 m | falls short | strikes the far leaf | strikes the far leaf | clears (85) | clears (112) | clears (143) | lands wrecked |
| over 40° | | can't climb (a wall) | | | | | | |

  With leaves this short (a 25 m channel), a car that can climb the leaf clears the gap below
  about 30 degrees: that is the physics, not a fake gravity. Slow cars fall short from 35
  degrees. Landings, not the gap, decide the damage: 9-20 m/s into the road.

Console: `turnTest`, `pose`, `aiDriving`, `rideInto`, `riderReport`, `heliInto`, `bridgeJump`,
`holdSimulation` (docs/DEVELOPMENT.md).

## Unreleased — wet streets, the ULTRA band, phantom shadows

Graphics (postfx3d.js, surfaces3d.js, lighting3d.js, weather3d.js, signage3d.js)
- **Bug: a faint horizontal band across the road under the player on HIGH / ULTRA.** The
  half-resolution AO pass read depth at texel corners; which texel came back flipped with
  float rounding across the middle row of the screen. Depth is now read at texel centres.
- **Wet streets**: soaked, darker, more saturated tarmac and paving; a glossy film; puddles in
  dips and gutters with raindrop rings (HIGH / ULTRA); lamps, shop windows and neon streaked
  down the wet road at night (MEDIUM and up); screen-space reflections of facades, signs,
  lamps, cars and people (HIGH / ULTRA); patchy drying after the rain. LOW darkens only.
- **Bug: elongated "shadows" on the streets with nothing casting them.** They were dark ellipses
  painted into the road sheet; removed.
- Settings · Graphics · **Player outline at night** (on by default).
- Console: `wetness(value)`, `shadowProbe(x, y)`, `shadowCasters(limit, everywhere)`,
  `postView('reflect')`, `settings({ playerOutline })`.

## Unreleased — true scale: vehicles, people, buildings and street furniture

At 8 units to the metre (unchanged; blocks, roads and the map are as they were) every thing in
the street is now its real size. Measured with `DeadEndCity.scaleReport()` (models from their
meshes, metres; real references in brackets):

| Item | Before | After | Real |
| --- | --- | --- | --- |
| Sedan (REGENT) l x w x h | 5.41 x 2.68 x 1.87 | 4.88 x 2.08 x 1.50 | 4.85 x 2.1 (mirrors) x 1.47 |
| City cab | 5.41 x 2.79 x 2.14 | 4.93 x 2.08 x 1.71 (sign) | 4.9 |
| Coupe / sports / supercar | 5.03 / 5.28 / 5.66 | 4.43 / 4.53 / 4.72 | 4.4 / 4.5 / 4.7 |
| Muscle / luxury / limousine | 5.91 / 6.53 / 9.53 | 5.03 / 5.33 / 8.83 | 5.0 / 5.3 / 8.8 |
| SUV / van / pickup | 6.16 / 6.03 / 7.37 | 4.97 / 5.28 / 5.57 | 4.95 / 5.25 / 5.6 |
| Patrol car (charger / utility / Crown Vic) | 5.86 x 2.76 | 5.29 x 2.12 (1.84-2.2 tall) | 5.1-5.2 |
| Ambulance / box truck / flatbed | 7.32 / 10.6 / 11.82 | 6.63 / 9.85 / 9.57 | 6.7 / 8-10 / 9.5 |
| Bus | 11.81 x 3.79 x 3.88 | 11.78 x 2.79 x 3.18 | 12 x 2.55 x 3.2 |
| Bicycle | 4.05 x 1.13 x 2.4 | 1.90 x 0.53 x 1.13 | 1.8 x 0.6 x 1.1 |
| Sport bike / cruiser | 3.84 / 4.17 | 2.14 / 2.38 (1.17 tall) | 2.1 / 2.4 |
| Tank (hull; gun and whip past it) | 10.5 collider, 12.8 model | 7.9 collider, 9.0 model | 7.9 hull, 9.8 with gun |
| Army jeep / APC / cargo truck | 6.84 / 9.75 / 10.62 | 4.6 / 6.4 / 6.7 specs | 4.6 / 6.4-7 / 6.7 |
| Person (crowd rig, average) | 2.17 (2.02-2.32) | 1.74 (1.63-1.87) | 1.75 (1.6-1.9) |
| Player | 2.13 | 1.71 standing (1.75 rig) | 1.75 |
| Storey / ground floor | 1.9 / 1.9 | 3.2 / 4.5 | 3.0-3.5 / 4-5 |
| Shop door / entrance doors | 1.5 / 2.0 | 2.3 / 2.6 | 2.1-2.4 |
| Buildings (median / 90% / tallest) | 7.7 / 12.8 / 144 m | 14.0 / 23.2 / 247 m | |
| Street lamp | 4.25 | 9.0 | 8-10 |
| Street tree (r 15) / palm | ~4.5 / 3.9 | ~7 / 9 | 6-12 / 8-15 |
| Bus shelter / bench seat, back | 2.0 / 0.53, 1.16 | 2.5 / 0.45, 0.85 | 2.4-2.6 / 0.45, 0.85 |
| Mailbox / meter / bollard | 1.0 / 1.1 / 0.65 | 1.3 / 1.3 / 0.9 | 1.3 / 1.2-1.4 / 0.9-1.0 |
| Lane with gutter / sidewalk / block | 5.5 / 3.5 / 64 | same | (Portland block 61) |
| Boats, planes, helicopters | true | unchanged | |

Vehicles (game.js VEHICLE_DEFINITIONS, render3d.js DESIGN SIZE)
- `l` / `w` are written in metres. Each model is built at its design size, (l, w) / `modelScale`,
  and drawn at `modelScale` (0.8 for cars, 0.47 bicycle, 0.55 sport bike, 0.65-0.9 trucks), so
  roofs, beltlines, wheels, lamps, lightbars and riders come out real without restyling the
  models. Dents, loose panels, glass bursts, engine smoke, wheel spin and the body impostors work
  in design units. Physics reads the new sizes as they are (inertia, the collider, traffic's
  look-ahead and following gap, which are in metres of bumper-to-bumper space); physics.js is
  unchanged. The share bike is drawn at its collider already and is not scaled again.
- Roadblock V: the carriageway cruisers stand 19 units either side of the line (were 22) so the
  shorter cruisers still overlap past the centre.

People (game.js PEOPLE)
- `PERSON_HEIGHT` 1.75 m, `PERSON_SCALE` on every rig (crowd, player, officers, actors; officers
  and actors vary 0.94-1.06 like the crowd's looks). A round hits within `PERSON_HIT_RADIUS` (1 m,
  was 1.25). Name tags, speech bubbles, dizzy stars, the sniper laser, the aim plane and the
  crowd impostors follow the height. Cafe chairs lowered to a 0.45 m seat.

Buildings (game.js BUILDINGS, cityscape3d.js, skyline3d.js, civic3d.js, world3d.js)
- `realBuildingHeight()` turns the plan's heights into real storeys (`STOREY` 3.2 m over a
  `SHOP_FLOOR` 4.5 m ground floor): towers are 1.7x taller. The Blue Hour roof is 30 m (was 17),
  its elevator counts 10 floors. Height thresholds (archetypes, setbacks, fire escapes, rooftop
  helipads, SWAT sniper roofs, wall decals) use the same conversion. Facade textures, curtain
  walls, balconies, hotel floors, fire escapes and brick courses repeat per real storey.
- Shopfronts: a 2.3 m door with a transom light, glazing to 3.6 m, awnings at 3.2 m (their air
  cover and rain drips moved up with them), the sign on the fascia at 5 m. Business entrances:
  2.6 m doors under a 3.2 m canopy; business signs no lower than the fascia.
- The sun's shadow box reaches the tallest roof; the police helicopter flies 8 m over the roofs
  near it (at least 35 m up); the flight HUD's roof clearance reads the real roofs.

Street furniture: lamp posts 9 m (`LAMP_HEIGHT`), street trees about 7 m (`TREE_RISE`), palms
9 m, bus shelters 2.5 m, benches, mailboxes, meters, news boxes and bollards at real heights.

Camera: the street view starts at `STREET_ZOOM` 1.2 (the wheel reaches 1.8), so a true-size car
and person read about as large as the old oversized ones.

Checked: layout audit clean (only the known oblique junction notes), smoke test clean, no
console errors; a drive up Harbor Ave through North Point, a 3-star chase (9 patrols, a
roadblock) and the Blue Hour elevator mission start. Draw calls at the default street zoom
(camera, then shadow map; headless, settled frames): Old Quarter 221 / 372 -> 197 / 298, North
Point towers 166-201 / 284-306 -> 203 / 251, Midtown 533 / 489-588 -> 445 / 454. The taller
towers cost no more: the closer default zoom takes in less of the city.

## Unreleased — the Marea pool, club conversations and beach volleyball

Marea pool (clubpool.js, water.js)
- **SWIM · E** at the pool's edge (inside the club only; at night that means past the door with a
  band): a short dive, a splash and its sound, and a club-goer's remark ("Nice dive!"). In the
  water the sea's stroke runs unchanged (`swimStroke`, split out of `updateSwimming`): the hard
  crawl by default, the easy stroke with Shift, the breath gauge, the crawl pose. `player.pool`
  is a carrier (`movePoolSwimmer` holds the swimmer inside the water; `teleportPlayer` and a far
  jump let go). Out of breath only slows you here; hanging on at the edge gets it back.
  **GET OUT · E** at an edge with open deck beyond it steps up onto the deck, dripping for 12 s.
  No wake on the sea under the pool; the police send no boats for a swimmer in the pool.
- Works by day and at night (the pool is lit after dark); the club's own pool swimmers keep
  swimming by day.

Conversations with club-goers (clubtalk.js)
- Stand next to a club-goer for about a second (or **TALK · E**) and the two of you trade
  alternating speech bubbles, four to six lines: 41 scripts across tourists, influencers,
  bartenders, businessmen, DJ fans, bouncers and swimmers, by day and by night (the DJ, cocktails,
  the sunset, yachts, gossip, a hint of the city's crime, friendly flirting), with alternative lines
  and forked endings. No script repeats until every one that fits the hour has been heard. The
  club-goer turns to the player, waves, talks with their hands; walking away gets a "Catch you
  later!". E moves a conversation on.
- The player's lines use the crowd's bubbles (`clubTalkSpeakers` in speechBubbles); both speakers
  are `inConversation`, which ranks their lines first, so the two bubbles stay with the
  conversation. NPC chatter off: no conversations.

Beach volleyball (beachvolley.js, beachvolley3d.js, beach.js, beach3d.js)
- The small court is now a regulation one (16 x 8 m, net 2.43 m) in a raked sand pit at
  x -2322, y 5450 on the upper sand, with padded poles, guy ropes, antennas, a boundary tape and
  a scoreboard; the clear zone is reserved so towels and umbrellas stay off it
  (`DeadEndCity.volleyCourtCheck()`: clear).
- The four players play 2 v 2 by rally scoring to 15 (win by two) with a physics ball: every touch
  is solved for a target and an apex, so the AI runs to where it will come down; bump to the
  setter, set, jump spike or shot into the open court, with shanks, tight sets, spikes into the net
  and long; the net stops a low ball, the sand swallows the bounce, in / out decides the point.
  Sand kicks, hit and landing sounds, the whistle; the winners cheer, the beach roars.
- **JOIN MATCH · E** on the court: the player takes the nearer player's place (who watches from
  the sideline). E or a left click hits a ball in reach (a press just early is held), aimed with
  the mouse or the movement keys; Shift + hit is a soft set to the partner; running into a high
  ball by the net is a jump spike. A ring marks where the player's ball comes down; a hint card
  shows the score and the controls. Walk off the court or **LEAVE MATCH · E** between points.
- Six beachgoers watch from the sides and cheer the points.

## Unreleased — speed box on foot, km/h / mph, South Coast Cycle bike share

Speed box (hud.js SPEED BOX)
- The vehicle speed box now also shows on foot, swimming and under a parachute, in the same
  style: the movement state (STANDING, WALKING, RUNNING, WADING, CLIMBING, SWIMMING · CRAWL /
  BREASTSTROKE / TREADING WATER, FALLING · FREEFALL / CANOPY) over the speed. On foot it is the
  measured ground speed (`trackPlayerPace`), eased over 0.35 s and held to whole numbers with a
  0.75 hysteresis, so it does not jitter; standing reads 0. Under a parachute: airspeed, rate of
  descent and height.
- Swimming, the big figure used to be the breath percentage; it is now the swimming speed, with
  the breath as the bar under it and in the unit line (BREATH 74%), red under 30%. On foot the
  bar folds away (there is no stamina on foot). A bicycle still shows cadence and LEGS %.
- Settings · Gameplay: **Speed units** (KM/H or MPH) and **Speed box on foot** (on by default;
  the water always shows the breath). The units apply to every speed shown: the speed box, the
  flight HUD's airspeed tape, its stall band and caption, the Falcon's ride card and banner.
  Boats keep knots, distances stay metric. Saved with the HUD state; `DeadEndCity.settings({
  units, footSpeed })`, `DeadEndCity.speedBox()`.

South Coast Cycle bike share (cycles.js, cycles3d.js)
- The free bike stands become docked bike-share stations: a steel dock rack of 4-8 teal and
  white city bikes (step-through frame, mudguards, chain case, front carrier with the brand
  panel, dynamo lamps) and a payment totem with a backlit station map, a RENT A BIKE screen, the
  SOUTH COAST CYCLE header and a lit canopy strip, a night glow and a light pool on the pavement.
- Placed beside every payphone (`phone`, a district's `PAYPHONES`, PLACES of kind 'payphone'), at
  every job's first destination (`missions[i].start`, else `MISSION_STARTS`), at the rail
  stations and where the old stands were (park gates, marina, pier, Exchange, esplanade), on
  kerb-side pavement with a walkway kept behind the bikes, off carriageways, crosswalks, doors,
  rail entrances, the payphone's reach, trees, lamps, benches, colliders, parked vehicles,
  runways, taxiways and helipads; the renderer settles each against the furniture it placed.
- RENT BIKE · $5 on foot undocks a bike and puts you on it (an ordinary bicycle in the livery);
  DOCK BIKE · $2 BACK riding a share bike slowly up to any station with a free dock racks it.
  Stations restock one bike about every 150 s while you are away. Teal bicycle icons on the
  minimap and map (grey when empty), BIKE SHARE in the map legend.
- Rack, totem and bikes are breakable props (`bikerack` 35 kJ, `biketotem` 60 kJ, `sharebike`
  1.2 kJ): bikes go over at walking pace, the rack from ~25 km/h in a sedan, the totem from ~33;
  a fallen rack takes its bikes down; the city stands them up again. Drawn as instanced
  breakables from merged vertex-coloured parts (one instance per bike), a handful of draws per
  map cell. Every size follows the bicycle's length (`SHARE_BIKE_LENGTH`) or the metre.
- `DeadEndCity.bikeShare()` (network, nearest station, rent/dock log), `DeadEndCity.bikeStation(id)`.
## Unreleased — a 90s volume knob, the radio at 100 by default

Radio volume (car-radio.js RADIO VOLUME, shell.html, settings.js)
- **The radio box's slider is now a 90s car-stereo volume knob**: a ribbed black-rubber knob with
  a machined aluminium cap (concentric turning marks, a fixed anisotropic sheen), an engraved
  pointer and a lit amber dot, a specular spot and a drop shadow; around it 20 amber LED
  segments over 270 degrees (one per 5 steps, the last partly lit, the top three hot) and beside
  it an LCD readout in slanted seven-segment digits over their ghost 8s (`OFF` at 0, a blinking
  MUTE annunciator). All CSS gradients and inline SVG: crisp at any DPI, redrawn only when the
  level changes.
- Drag it: straight movement counts right / up as louder (`dx - dy`, 1.6 px a step, 160 px for
  the whole range, Shift four times finer); a drag that circles the centre switches to turning
  with the pointer (270 degrees = the range). Measured from 50: up 10 / 20 / 40 / 80 px -> 56 / 63
  / 75 / 100; down 40 px -> 25; with Shift up 80 px -> 63; pressing on the rim and circling
  clockwise 90 / 120 / 180 degrees -> 62 / 73 / 94, anticlockwise 180 -> 12. A double-click on the
  knob mutes / unmutes (the speaker button stays), the wheel and the focused knob's arrow, Page,
  Home and End keys work, `,` / `.` still step it in a vehicle. Keys and the wheel go to the next
  5-step mark; each mark ticks softly on the effects bus. A soft amber glow while dragging; the
  pointer is captured and nothing reaches the canvas (no shots, no aiming). On touch the knob is
  76 px with a 12 px wider hit area.
- **The radio defaults to 100** (was 80), RESET AUDIO TO DEFAULTS included. A save still at the
  old 80, or without a radio level, moves to 100 once and is written back; a save at any other
  level (0 = muted included) keeps it. From now on every change the player makes marks the save
  (`radioVolumeSet`), so a deliberate 80 stays 80.
- `DeadEndCity.radio()` reports `volumeSet` and `knob` (value, angle, lit LEDs, readout, drag mode,
  the last drag) in place of `slider`.

## Unreleased — speech bubbles seen from above, the Falcon's riders scream and talk

Speech bubbles (crowd.js SPEECH SEEN FROM ABOVE, render3d.js, roofmission.js, flight-view3d.js)
- Every speech bubble (street crowd, drivers, carjacks, police and soldiers, the Falcon's riders,
  the Blue Hour rooftop) fades out between 40 m and 50 m of height between the view and the
  speaker, and a hidden line no longer takes one of the two bubble slots. The HUD log and captions
  are unchanged.
- The height: flying (helicopter, plane, parachute) or riding (the Falcon, the Sunset Eye), the
  player's elevation over the speaker, which for someone on the ground is the AGL the flight HUD
  shows; on foot or driving, the street zoom as a height (`streetZoomHeight`: the height at which
  the flight camera draws the ground at the zoom's scale; zoom 0.8 = 29 m, 0.72 = 38 m, 0.68 =
  43 m, 0.64 = 49 m, 0.5 = 73 m), plus the player's elevation over the speaker (from a roof). The
  pull-back at speed does not count. Measured headless: helicopter at 30 m AGL fade 1, 45 m 0.5,
  60 m 0 (bubbles gone).
- Labels projected behind a perspective camera are skipped instead of drawn mirrored.

The Falcon (themepark.js RIDERS' VOICES, car-radio.js)
- **Radio off by default on the Falcon.** Each ride starts with the radio off; the widget is
  shown and N / B / a click turn it on for that ride only (`player.coaster.radio`); the saved
  radio setting for vehicles and the Eye is untouched.
- **Screams in time with the track.** Each car is read off the circuit (vertical speed from the
  train speed and the track's rise, seat load from the change of rise, inversion). Over the first
  drop every car lets out up to two of the recorded pedestrian screams (pitch 0.9..1.14, own
  level and delay), placed on that car, so the chorus rolls down the train as each car tips over;
  later drops (12 m+), dips (5 m+), airtime (< 0.45 g) and inversions draw a quieter voice from
  some cars. Voices bus (Voices slider and switch), attenuated by the 3D distance from the player,
  so they are heard aboard and from the ground nearby. Replaces the synthesised coaster screams
  (the flume and drop tower keep theirs). No whoop sample exists, so none is played.
- **Rider speech bubbles:** nervous on the lift ("OMG I'm so scared!", "Why did I agree to
  this?", "Don't look down…"), screams over the first drop ("AAAAHHH!"), excited or terrified on
  the elements ("WOOOO!", "Faster!", "Mommy!", "Upside dooown!"), and on the brake run "I'm going
  to throw up!", "Again! Again!", "My legs are jelly…". Two at a time through the crowd's bubble
  limit, first in line while the player rides, subject to NPC chatter and the height rule; seen
  aboard and from the ground nearby. From the chase camera the speakers come from cars 1-4 (in
  frame); no line is said twice at once or twice running.
- Console: `DeadEndCity.coasterVoices(reset)` (every cue with track position, height, vertical
  speed, g, drop depth), `DeadEndCity.speechView()`; `radio()` reports `enabled` (the ride's
  switch on the Falcon) and `saved`.

## Unreleased — ramming roadblocks, crash physics, breakable trees and furniture

Roadblocks (roadblocks.js, physics.js)
- **Bug: a truck stopped dead at a bridge roadblock.** Braced cruisers were infinite-mass
  anchors unless the rammer passed a gate tuned before the real-scale retune: at least 2.2 t
  and mass x closing speed of a box truck at 55 km/h. A pickup (2.7 t) needed 138 km/h, an SUV
  163, a box truck at 50 km/h hit a wall. Now a braced cruiser is an ordinary 1.6 t body on
  locked brakes (`parkedFriction`, 0.8 g) and momentum decides. The V overlaps past the centre
  line so a rammer meets a flank; "ROADBLOCK BUSTED" only when the player comes out the far side.
- Measured (bridge approaches, throttle held from 90 units out; speed going in -> coming out):

| Vehicle | Before | After |
| --- | --- | --- |
| Box truck 50 km/h | stopped dead (2-4 km/h) | through, 48 -> 35-40 km/h |
| Box truck 30 km/h | stopped dead | through, 30 -> 25 km/h, pushing the cruisers aside |
| Box truck 70 / 90 km/h | through, -20 / -25 km/h | through, 74 -> 63 / 90 -> 69 km/h |
| Bus 45-60 km/h | through | through, loses 5-8 km/h |
| Pickup 60-90 km/h | stopped dead | through, 60 -> 32-41 km/h |
| SUV 50-80 km/h | stopped dead | through, 52 -> 27-33 km/h |
| Sedan 30-80 km/h | stopped dead | shoves the first cruiser, crumples, stalls in the V |
| Tank 30-50 km/h | through (-15 km/h) | through, loses 1-3 km/h |

Crash physics (physics.js CRASH SEVERITY, measured headless)
- Damage follows each body's delta-v (mass ratio), not the closing speed, and driver injury
  likewise; restitution 0.3 for a parking knock down to 0.08 in a real crash; spin cap 5 rad/s.
- Sedan head-on into a building face, hit points lost of 150 (before -> after): 30 km/h 2 -> 4,
  50 km/h 9 -> 12, 80 km/h 15 -> 33, 120 km/h 27 -> 66, 160 km/h 46 -> 82. Box truck (of 420):
  50 km/h 7 -> 39, 120 km/h 27 -> 169, 160 km/h 39 -> 293. No penetration at 250 / 330 km/h.
- Side impacts (T-bone into a parked car, speeds just after contact; momentum is conserved to
  1-4%): truck 48 km/h into a sedan -> truck 38.5, sedan 44; the truck took 0 hit points (was 7,
  the same as the sedan), the sedan 9. Sedan into a truck at 48 -> 3.5 / 9, sedan 9, truck 0.
  Two sedans at 100 -> 14 each (was 21). Tank into a sedan: tank 0, sedan 9.
- Tunnelling: a motorbike at 250 km/h into a big tree stops at the trunk; a supercar at 250 /
  330 km/h into a wall or the bridge rail stays out.
- Masses: tank 55 t (was 18), bus 11.5 t (was 9). Unattended vehicles slide on Coulomb
  friction (brakes 0.8 g, parked 0.35 g, sideways 0.85 g).

Handling (physics.js FRICTION CIRCLE AND BALANCE)
- Friction circle, weight transfer under braking, per-class `balance` (trucks push wide,
  muscle cars and roadsters step out under power), rain on every tyre force, kerb strikes,
  and damage: a bent front end steers up to 25% less, flat tyres brake up to 50% worse.
- Measured (sedan): braking while steering at 100 km/h now pulls 0.63 g sideways (was 0.97 g on
  top of a full 1 g stop); 100-0 dry 34.5 m, wet 45.8 m (rain had no effect before); steady
  cornering 1.22 g dry, 0.89 g wet; box truck 0.71 / 0.52 g. Handbrake turns unchanged in
  the dry (112 degrees in 1.5 s from 60 km/h), softer in the wet.

Breakable furniture and trees (damage.js, render3d.js, world3d.js, beach3d.js, damage3d.js)
- Props break by kinetic energy along the contact normal against `breakKJ`: cones, bins,
  crates, news boxes, umbrellas, loungers 0.05-2 kJ; benches 8-10; sea railing 25; hydrants 25;
  lamp standards 45-60; signals 90; young trees 120 (a sedan from ~47 km/h), palms 150,
  planters 200, mature trees 400, big old trees 1200 (a sedan bounces off below ~150 km/h, a
  box truck fells it from ~68, a bus from ~52, the tank always); steel bollards 600 (a sedan
  below ~100 km/h stops). A hit that holds strains the piece for the next one.
- Measured: sedan 45 km/h into a young tree: held, 10 hp; a third ram fells it. Box truck 80
  into a big tree: fells it, leaves at 34 km/h, 52 hp. Bus 60: fells it, 22 km/h. Sedan 250:
  fells it, 112 km/h, 124 hp. Sedan 30 km/h through an esplanade bench: 28 -> 25 km/h, 1 hp.
  Sedan 30 through the sea railing: through (and into the harbour if it keeps going).
- New breakables: every street and park tree, palms, the esplanade's benches, lamp
  standards, planters and sea railing, the beach umbrellas, loungers and boardwalk benches;
  street-scene furniture (carts, cafe tables, menu boards, cases, boxes) is thrown aside.
- Felled trees leave a stump, leaves and dust where the crown lands, and people near them
  scatter; props come back after four minutes out of view. Sounds and debris by material.
- Performance: the breakable scenery is instanced per 2048-unit cell (no per-frame
  allocation; crown lobes 80 faces, limbs share the trunk's geometry). Headless (SwiftShader,
  graphics high, 25 s settle, same views, before -> after): draw calls downtown 228 -> 218,
  esplanade 222 -> 208, Ocean Dr 198 -> 215, park block 255 -> 274, zoomed out (0.35)
  627 -> 629; triangles +6-17%; simulation CPU per frame unchanged within noise (10-33 ms
  before, 12-21 ms after on a shared machine).
- Plan fixes found by the layout audit: kerb lamps planted inside kerb trees, an Ocean Dr palm
  on a junction signal.

## Unreleased — no snipers, an unarmed police helicopter, the Apache

Police (swat.js, combat-rules.js, pursuit.js)
- **Rooftop snipers are off**: `SNIPERS_ENABLED = false` (swat.js) is the one switch.
  `spawnRoofSniper` refuses whoever asks, any marksman already up packs up, and their whole
  telegraph is gated with it: the red laser and scope glint (render3d.js SNIPER SIGHTS), the
  rising lock beep and the red screen-edge glow toward the shooter (hud.js SNIPER WARNING),
  the "SNIPER ON THE ROOFTOPS" and "POLICE SNIPERS" captions. Set it to true to bring them
  back unchanged. The five-star dispatch line no longer says SNIPERS UP.
- **The police helicopter never fires.** Its marksman is gone (the `marksman` entries of
  `POLICE_TIERS`, the lock-on, the led rounds, "MARKSMAN LINING UP"); the red glow players saw
  from the helicopter before a shot was that lock warning. It still pursues, holds the player
  in its searchlight, counts as a unit with eyes on the suspect (the search does not run down
  while it sees you) and radios the sighting to the ground units. Still one at a time.
- **Overhead cover hides you from the air** (air-cover.js `overheadCover(x, y, elevation)`):
  the underpass, the rail decks and station canopies, bus shelters, the Falcon's queue canopy
  and station roof, shop awnings, club and hotel entrance canopies, the cruise terminal's
  drop-off canopy, Vinny's depot, building interiors, a bridge over a boat or swimmer. The
  helicopter loses sight, sweeps its light round the last sighting and circles there; unless a
  ground unit sees you the lose-police timer runs. The HUD's air line reads HIDDEN FROM AIR ·
  UNDER COVER. One grid index over existing cover data plus `registerOverheadCover()` for the
  renderer's roofs (every cutaway roof registers itself).
- **No shots from off screen** (combat-rules.js ON-SCREEN RULE, `shooterInView`): police
  officers (aimed and suppressive fire), army roof and turret gunners, the pursuit tank, marine
  launches and Fort Sentinel's soldiers and armour only fire at a player on the ground while
  they are inside the street view round the player. The long guns (roof gunners 480 units,
  the tank 680, base towers 650) hold fire until they close in. Off in the air.
- `DeadEndCity.shotLog()` lists every hostile round aimed at the player by source (unit kind),
  with hits, damage, the shooter's distance and whether it was on screen;
  `DeadEndCity.heal()` restores health for long tests with god mode off;
  `DeadEndCity.cover(x, y)` reports the cover at a point.

Measured headless: 140 s at five stars, god mode off (health restored under 70), police
helicopter overhead the whole time: 1,877 rounds at the player, none from off screen, from
army jeep roof gunners (647), SWAT (446), the APC turret (355), soldiers (220), agents (96)
and patrol officers (113); zero rooftop-sniper or helicopter rounds, zero snipers spawned.
Under the Falcon queue canopy, a bus shelter, a club entrance canopy and the cruise terminal
canopy the helicopter went blind within a second (searching, searchlight on the last
sighting) and, with no ground unit in sight, the lose-police timer ran.

Fort Sentinel's AH-64 Apache (apache.js, apache3d.js)
- A parked AH-64D-style attack helicopter on the airfield's west helipad (10200, 9365, nose
  south; the olive Maverick keeps the east pad). Tandem stepped cockpit, lofted fuselage with
  sponsons and high engine nacelles, stub wings with a 19-tube rocket pod and a four-missile
  Hellfire launcher on each, chin 30 mm turret, TADS/PNVS nose, four-blade rotor under a
  Longbow dome, swept fin with the scissor tail rotor on the port side, olive drab and dark
  grey, low-visibility markings, red / green / white nav lights and a red beacon in flight.
- Never flown by AI and never sent in a pursuit. It is a `helicopter` with
  `airframe: 'apache'` (vehicleSpec merges HELICOPTER_AIRFRAMES), so it flies with the
  helicopter flight model and controls.
- Stealing it raises the base alarm (as a tank does) and the heat to the top of the scale:
  the stars climb to five, the military response, at the normal pace. No snipers.
- **Chin gun** (Fire: F / left click): the turret follows the mouse like the tank turret
  (120°/s, 110° either side of the nose) and fires where it is laid, down to the ground
  point under the mouse; 320 rounds, 600 rounds a minute, tracers, sparks, a small splash.
- **Rockets** (new action `rockets`: Space / right click, remappable, listed in the controls
  card and settings): salvos of four rippled from the pods along the nose to the aim's
  range; 38 rockets. They explode through `explode()` (cars wrecked, blast effects, the
  explosion sound) and breach facades like tank rounds.
- The weapon chip shows rounds and rockets; the tank reticle serves as the gun sight.
  Landed on a Fort Sentinel helipad it rearms over about twenty seconds (REARMING); the base
  is hostile, and the airframe takes 30% of small-arms damage (rockets and shells in full).
  A wrecked or lost Apache is back on its pad four minutes later, out of sight.
- Console: `apache()`, `apacheAim(x, y)`, `apacheReset()`.

## Unreleased — God mode settings

While the `godmode` cheat is on, **Settings** has a fifth tab, **GOD MODE** (god-panel.js; the
tab is hidden and out of the Q / E cycle otherwise, so the screen without god mode is as before):
- **Time of day**: the mission picker's presets (dawn, morning, noon, golden hour, dusk, night,
  3 am) as chips and a 24 h sky slider in five-minute steps, applied live behind the menu (the
  backdrop is lighter on this tab so the change is seen); **Freeze time** holds the world clock
  (and the weather machine) until it is switched off or god mode ends.
- **Weather**: AUTO / CLEAR / FAIR / CLOUDY / OVERCAST / RAIN / STORM through the picker's
  `setGodWeather` (a sky locks the weather machine, AUTO releases it). There is no fog state.
- **Refill all ammo**: every weapon owned with a full clip and at least the godmode reserve
  (clip x 9, rockets x 5), health and armour 100; in a vehicle it is mended and a tank gets its
  40 shells and full coax belt back.
- **Lose police**: the stars to zero through `clearPolice(true)`, the escape path (POLICE
  CLEARED chip, units stand down and head home, the helicopter leaves, roadblocks lift); witness
  calls already made are dropped and Fort Sentinel's alarm ends. Mission state is untouched.
- **Teleport · pick on map**: closes the menus and opens the city map in pick mode (gold frame,
  crosshair, "Click anywhere to teleport · Esc to cancel", a live line saying what a click there
  would do; zoom, pan and pinch as usual). Esc / Tab / CLOSE go back to the tab.
- The teleport (`godTeleport`, also behind the plain god-mode tap on the map, which used to drop
  the player at the raw point, inside buildings or in the sea) resolves the point safely: on
  foot the nearest walkable ground (a roof or building interior lands in the street outside,
  24 units clear of walls where possible); open water gets a speedboat (or jet ski) to board;
  a car, bike or tank comes along to the nearest clear stretch of road lined up with it; a boat
  comes along on water and stays behind for a click on land; an aircraft comes along airborne
  (at least 50 m, a plane 120 m at cruise speed). Then the other carriers are let go
  (`teleportPlayer`, a train ride too), the ground height is set, the camera snaps and the crowd
  resettles round the spot.
- Console: `godPanel()`, `godTeleport(x, y)`, `godRefill()`, `godLosePolice()`,
  `godFreeze(on)`, `mapScreenPoint(x, y)`.

## Unreleased — run by default, the radio volume slider and the audio mixer

On foot (game.js `FOOT_WALK` / `FOOT_RUN`, `footPace()`; controls.js)
- The player runs by default at 20 km/h (was a jog at 11) and walks while Shift is held
  (5.4 km/h; the action is now "Walk (hold)"). The separate sprint (24 km/h) and the C walk key
  are gone; a save with walk still on C moves to Shift. Measured with `simulate` on Southport's
  runway: 19.95 km/h running, 5.40 km/h with Shift.
- The run still outpaces every officer on foot (16-19 km/h, pursuit.js), and the police's aim
  now reads the real pace (a runner is harder to hit than a walker, as the sprint was).
- Swimming crawls hard by default (5 km/h) and eases into breaststroke with Shift, or by itself
  once breath is under 30%, so the default never spends the last of it.
- The stadium kick is a full, lofted strike; with Shift (walking) a softer pass. The Blue Hour
  terrace stays a walk (a stealth party), so "running near the detail" no longer applies.
- Footsteps and mountain footing follow the pace; the player's legs swing wider and lean in at
  the run (render3d.js `playerRunAmount`). The bicycle keeps Shift as "Pedal hard"; Shift in
  vehicles is unchanged.
- Hints: the bar reads SHIFT WALK on foot and SHIFT EASY STROKE swimming; the on-foot, swimming
  and kick prompts, the remap menu and HOW TO PLAY follow. Touch: the RUN button is a held WALK,
  and a gentle push of the move stick (under half-way) walks.

Radio volume slider (car-radio.js RADIO VOLUME, shell.html)
- The radio box's open rows gain a speaker (click mutes, again unmutes to the level it had), a
  slider and the level. It is the same value as Settings · Audio · Radio & music (one setting,
  saved, redrawn both ways). Hover lights the row and grows the thumb; dragging holds the box
  open even when the pointer leaves it; the wheel anywhere over the box steps it by 5, open or
  resting; muted, the resting chip's bars lie flat with a red crossed speaker.
- Nothing reaches the game: the row stops pointer, click and key events, so a click on the
  slider never fires or turns the camera and the focused slider's arrows never steer. After a
  mouse drag the keys go back to the game.
- Keyboard: `,` / `.` (Radio volume down / up, remappable) in a vehicle, and the focused
  slider's own keys. Touch: a tap opens the box, then the slider drags (a bigger thumb).
- Console: `DeadEndCity.radio()`.

Audio mixer (audio.js THE MIX, settings.js `AUDIO_VOLUMES`)
- Each category has its own gain and slider in Settings · Audio: Master, Radio & music,
  Engines & vehicles, Effects, Voices, Ambience, Sirens, and RESET AUDIO TO DEFAULTS. Every
  slider applies live and is saved. Engines (engine-audio.js, tyres, rotors) default to 65:
  about 3.7 dB quieter than before. The ride-skip duck still dips everything but the radio and
  the callouts; the master volume and the Sound switch moved to one gain after the ear filter.
  A save from before starts ambience at its old "Effects & ambience" value and engines at 65% of
  it.
- Console: `audioMix().buses`, `settings()` with the seven volumes and `audioReset`.

## Unreleased — realistic runways

Aircraft performance (aviation.js AIRFRAME_SPECS, FLIGHT CONTROLS)
- Take-off thrust is now a real share of the weight over the roll (courier 0.28, jet 0.30,
  airliner 0.26; it was 1.15 / 1.0 / 0.85 g) and the parasitic drag came down by the same
  factor, so top speeds hold (measured 392, 713+ and 760+ km/h after two minutes flat out).
  Rolling resistance 0.025 g (was 0.1), wheel brakes 0.42-0.45 g (were 1.7 g), flap and gear
  drag scaled with the airframe. Initial climbs are 6-11 m/s.
- The courier played a turbofan: planes without an airframe are couriers (engine-audio.js).

Measured headless through `simulate` (full throttle from a standstill, rotating at the
airframe's rotation speed; landing roll = touchdown at that speed, idle, full brakes; the old
airliner figure is the flight model replayed offline, its runway was too short to measure)

| Aircraft | Take-off roll, old -> new (flaps 1) | To 15 m | Landing roll, old -> new | Runway it uses, old -> new |
| --- | --- | --- | --- | --- |
| Serrano C200 courier | 70-85 m -> 236 m (223-258 m flaps 2-0; 280 m nose held up from the start) | 336 m | 27-32 m -> 103 m (85 m after a flown approach) | Southport 126 m -> 460 m (1.8x) |
| Aurelia J8 jet | 171-187 m -> 504 m (475-556 m; 598 m) | 646 m | 65 m -> 253 m (233 m) | Southport 126 m (could not lift off) -> Oceanview 1,280 m (2.3x) |
| Meridian 220 airliner | ~267 m -> 794 m (748-888 m; 1,034 m) | 975 m | 92 m -> 368 m (333 m) | Oceanview 310 m (could not lift off) -> 1,280 m (1.44x) |

Runways (airfields.js, airfields3d.js; SOURCE_GUIDE 4, "Airfields")
- **Southport 18/36**: 460 m x 29.5 m, GA strip for the courier. It runs south from the
  airport over the sea on a reclaimed pier (x 196..760, y 5300..8240) with a parallel
  taxiway and four connectors; blast pads 15 / 30 m. The Southport jet moved to Oceanview and
  the apron's two parked airliners and a jet became three couriers (a jet needs 500-600 m).
- **Oceanview 09/27**: 1,280 m x 30 m. The island has room for 550 m, so the runway runs west
  over a reclaimed pier into the open sea (x -4320..2250) plus a short one at the east end;
  blast pads 30 m, turn pad at the west end. The old runway lies under its east part.
- A 1,800-2,500 m airliner runway fits nowhere: the whole map is about 2 km across. 1,280 m is
  London City's class; the airliner's figures are a regional jet's at a light weight.
- Markings (shader, ICAO Annex 14 for the length): threshold stripes, designations matching
  the headings (decals read from the approach), centre line, aiming point (150 / 300 m),
  touchdown zone bars, side stripes, yellow blast pad chevrons, taxiway centre lines and
  runway-holding positions with red holding-position signs; rubber in the touchdown zones,
  paving lanes, wet sheen in the rain.
- Lights in the glow field (one draw call, lit after dark): white edge lights every 50-60 m,
  green threshold / red end rows, approach lights on piles over the sea at both Oceanview
  ends (barrettes, a crossbar, sequenced flashers), blue taxiway edges, PAPIs that turn red or
  white by the player's glide path (two and two on 3 degrees), windsocks that swing with the
  wind, a green / white beacon on each tower. The piers have a rock revetment.
- Missions: mission 11's plane lines up on 09 at the west stub (400 m ahead, lifts off in
  ~250); the Southport approach fix moved out to sea (418, 10400) and the Oceanview diversion
  is now a westbound approach to 27; the escape van waits on Southport's taxiway beside the
  plane. Ring Run starts at the south end of 36 and its first ring moved to 27 m over
  (418, 3500). Saltwater Accounting's (mission 8) boat run goes round the end of Southport's pier (170 s, was 150).
- The flight HUD shows the runway and the metres left while on it (RWY 27 · 1070 M LEFT).
- Console: `drive('plane', altitude, heading, airframe)`, `airfields()`, `flight().runway`.

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
