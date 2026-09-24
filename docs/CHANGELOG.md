# Changelog

## Unreleased — The islands rearranged

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
