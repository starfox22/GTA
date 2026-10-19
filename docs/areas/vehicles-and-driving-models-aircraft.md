# Vehicles and driving: downloaded aircraft

Aircraft drawn from downloaded ready-made models: assets/aircraft-models.bin (+ aircraft-skin.webp), made offline by
`tools/aircraft_models.py SRC_DIR` (the vehicle converter's glTF reader, decimation and DECVM001 container; a
separate file, so the car converter's vehicle-models.bin / vehicle-atlas.webp are untouched). Runtime:
aircraft-assets3d.js (ASSET AIRCRAFT). Credits in docs/THIRD_PARTY_CREDITS.txt. Console `aircraftAssets()`,
`aircraftAssetsOn(false)` (helicopters and planes built from then on are procedural: before/after rows),
`civilHelicopters()`, `drive('helicopter', 0, a, 'bell429')`, `drive('plane', 0, a, 'skyhawk')`.

## SKYRANGER 429 (a Bell 429; civil-helicopters.js, aircraft-assets3d.js)

- An extra civil helicopter, not a replacement: the police, news, executive, civil and military machines stay
  procedural (their painted liveries, the Nightsun, the door guns). `airframe: 'bell429'` in HELICOPTER_AIRFRAMES
  (real size 98 x 26 units, 4.25 m tall), so helicopterControl, roofs, bail-outs, wrecks and retirement are the
  helicopter's own. `rotorRadius` 44 / `rotorX` 10 are its main rotor for `rotorStrikes` (an airframe without them
  keeps half its length about the centre).
- Parked by `populateCivilHelicopters()`: from populateWorld (the roof helipads are geometry, chosen before the first
  populate at boot: game.js runs chooseRoofHelipads and addMonarchHelipads first, so Monarch One's helicopter and
  these are there from boot and every reset replays the same entities), on the first two office-roof pads (never the Police HQ, a hospital or a tower deck) and
  on Southport's apron. No randomness drawn. There are no civil helicopter flight routes in the game yet.
- The converter splits the model by its flat-colour texture: `paint` (white panels), `accent` (orange stripes),
  `trim` (vertex colours), `glass`, `rotor` (pieces wholly above the mast) and `tail` (the tail rotor's box), and
  measures rotor centre, height, radius, tail hub, stabiliser tips, fin, roof, belly and nose. No texture ships.
- Look: `pickHelicopterLook` gives kind `bell` with a HELI_BELL_SCHEMES scheme (base + stripe) when the build carries
  the model, else the procedural civil look. The skin's colours are per scheme (one geometry per scheme sharing the
  positions, `acSkinFor`) on a white paint material, so wear, soot and the burnt wreck work through paintVehicle.
- `makeAssetHelicopter` returns makeHelicopter's object (rotor, blades, disc, tail, tailBlades, tailDisc, glass,
  levels, halos, pilot / observer stand-ins): animateHelicopter spins, blurs, banks and lights it unchanged. The model
  has no cabin inside, so its glass is darker (`m.glassOpacity` 0.82). 13.2k triangles, 6 draws, 3 shadow casters.

## SKYLARK 172 (a Cessna 172; aviation-flight.js, aircraft-assets3d.js)

- A new flyable airframe `skyhawk` in AIRFRAME_SPECS (8.3 m, 11 m span, fixed gear: `fixedGear` makes L say FIXED
  GEAR; lift-off ~100 km/h). Three stand on Southport's GA apron where the static procedural couriers were (their
  AIRPORT_SCENERY_SOLIDS boxes went with them: the planes collide as vehicles). The courier and flyable airliner keep
  their procedural models. The jet and terminal transports now use the separate
  [downloaded jet pack](vehicles-and-driving-models-jets.md). Courier/jet/airliner dimensions, thrust and spool profiles are retained; revised glide/turn/stall
  contracts are in [fixed-wing flight](vehicles-and-driving-flight.md). Earlier taxi steering and collision changes are recorded in
  the [flight audit](../audit/police-aviation-review-2026-10-15/flight-and-parking.md).
- The converter maps the source's own nodes: Aileron/Flaps/Elevator Left and Right, Rudder (hinge = the part's
  leading edge, `hinges`), the propeller and spinner (spun about the spinner's axis); cockpit instruments and switches
  are left out, seats and cabin reduced and vertex coloured. `makeAssetPlane` returns buildAircraft's object, so
  animateAircraft moves the surfaces, prop, blur disc and lights unchanged; `gears` is empty (fixed gear).
- 9.7k triangles; the exterior texture is aircraft-skin.webp (1024 px). Without the model it draws as the courier.

## Exterior enclosure and animated controls (October 19)

The procedural courier, flyable airliner and fallback jet have outward-wound
closed fuselage skins and end caps. Keep ordinary `FrontSide` paint: two-sided
materials would conceal reversed geometry and leave incorrect lighting/shadows.
Their original lifting surfaces already had correct mirrored winding. Procedural
jet nacelles likewise run aft-to-forward on the outside, with separate inward
intake liners, recessed opaque fan backwalls and exhaust backwalls. Twenty-eight
swept fan blades plus the hub merge to one animated mesh per engine (formerly
19 separate fan meshes); the engine cannot show sky/ground between its blades.

The Skylark's shared kit fits each control hinge at both ends of its full
spanwise/vertical leading edge, then rebases that control's unchanged geometry.
The old global-foremost-point fit collapsed its aileron axes at the wingtip and
shortened elevator/rudder hinges. Runtime fitting supports the existing pack;
`tools/aircraft_models.py` applies the same measurement on future conversions.
This is an estimated adaptation, not an authored animation. Neutral source
vertices, triangles, materials, texture, names and licence are unchanged.
`aircraft-geometry.mjs` checks single-sided exterior rays, positive closed volumes,
engine opacity, fan draw count, actual decoded control axes and neutral source
reconstruction on native Three.js without a GPU.

## Surveyed, not used (preview sheet scratchpad aircraft/sheet-1.jpg)

This is the original October 9 survey. The October 15 Citation/737 integration
and its verified source evidence are documented in [downloaded jets](vehicles-and-driving-models-jets.md).

- Airliners (737-800 Qantas / Lufthansa, ATR 72-600, CRJ-900 CityJet): real airline liveries and logos baked in, and
  sizes far from the Meridian 220's footprint; the procedural airliner and jet stay.
- Fighters (F-16, F/A-18C/E): no game airframe flies one; Fort Sentinel has no fixed-wing jets to replace.
- The low-poly Gulfstream and Cessna replica are cruder than the procedural jet and courier; the Cessna 421 Golden
  Eagle was left for a later round (a twin for the courier's role would change mission 11's aircraft).
- The MD-500 Defender (camouflage, gun pod) is not the Black Hawk the military type and MOUNTED_GUNS are.
