# Airports: airfields, parking and terminal scenery

`airfields.js` / `airfields3d.js` share runway and taxiway plans. SOUTHPORT 18/36 is
a 460 m courier/trainer strip on a reclaimed pier; OCEANVIEW 09/27 is 1,280 m for
jets and the airliner, extending west over `oceanview-pier`. Fort Sentinel also
accepts fixed-wing landings. Runway piers belong to `LAND_REGIONS`, so land, sea,
maps, landing and rendering agree. Console `airfields()` reports the plan.

Free-roam planes park nose out (`aviation-flight.js` `AIRCRAFT_STANDS`). Southport's
three fixed-gear SKYLARK 172s face west onto apron spurs, then taxi north to runway
18. Oceanview's jets, courier and airliner face south along four taxiway stubs to
27; the eastern airliner stand leaves its full take-off distance ahead. No reverse
or pushback is required. `aircraftTaxi(id?)` reports the route and full collision
footprint. Nosewheel steering uses each frame's wheelbase, slows with speed and
cannot pivot at rest. Flight model contracts: vehicles-and-driving-models-aircraft.md.

`geography-regions.js` holds the airport architecture plans beside the original
building footprints. `AIRPORT_APRONS` is ground paint, shared by the maps/baked
ground through `paintAirfieldGround` and by the rendered expansion joints. The
Southport rectangle ends at y=5490 to stay inside the existing coast, including
the third trainer stand at y=5420. It changes no land polygons, buildings, runway,
taxiway, parking poses or mission locations.

`airport-terminal3d.js`, included by `world3d-resort.js` before the county renderer,
dresses existing terminal/hangar walls and roofs. It adds full-height reflective
bays, mullions, aluminium roof edges, clerestories, roof equipment, hangar doors,
tower cabs, signs, apron joints and stand markings. The meshes are ordinary static
parts under the existing `batchGroups`; material/cell merging and far scenery
capture them through the normal renderer. Glass is opaque tinted Standard
material, so broad terminal/window surfaces remain available to the distant LOD.
There is no airport-specific per-frame mesh rebuild or new unculled campus mesh.
Small text canvases are cached by label and held by `bakedCanvases` for the shared
resource lifecycle. No new downloaded media collection is introduced here.

`AIRPORT_JETBRIDGES`, `AIRPORT_TOWERS` and `AIRPORT_CANOPIES` are shared drawing and
collision plans. The two Oceanview glass jetbridges are elevated, including their
angled telescoping arms and docking cabs. `airportBridgeSupports` and canopy posts
enter `AIRPORT_SCENERY_SOLIDS` as exact 6×6 / 3×3-unit ground rectangles. Only those
posts block people at ground level; apron paint is never a collision obstacle.

`airportOverheadVolumes()` returns oriented `minHeight` / `height` slabs for the
walkways, tower-cab overhangs and entrance canopies. `air-cover.js` includes them
in sight/shot queries, indexed overhead cover, chase-camera clearance and the
ordinary numeric static collider grid. Bridge walkways start 22 units (2.75 m)
above the apron; docking cabs start at 20. Pedestrian sight passes underneath,
while elevated rays and aircraft meet the actual structure. Use the same plan
when changing a bridge's footprint or height. Do not add those slabs to the
ground-only airport rectangle list: that would make an invisible wall underneath.

`airport-architecture` is a host test using real Three.js production helper
geometry. It checks every drawn bridge/canopy vertex against the shared volumes
and posts, height-sensitive sight/shot/cover queries, actual numeric collider-grid
registration and dry apron corners. `aircraft-flight-model` checks the production
flight model and all seven host taxi routes; `aircraft-taxi-takeoff` boards existing
planes and drives the routes using normal controls in the full world. Rendered
appearance and performance need native evidence separately from these host tests.
