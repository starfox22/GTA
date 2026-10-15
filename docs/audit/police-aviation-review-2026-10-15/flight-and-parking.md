# Flight and airport parking review — 2026-10-15

Scope: the four fixed-wing flight identities, normal entry/taxi/take-off, usable runway distance and collision footprints. Rendering and audio have separate audit records. This remains an assisted game model; no full flight-simulator or frame-rate claim is made.

## Findings and changes

- A 64-unit centre-only boarding radius sat inside the business jet and airliner wing collision boxes: a player outside the wings plus foot radius could not reach E. Planes now use the oriented collision-box edge, with a 3 m maximum gap; the prompt and E share `nearestCar()`. Cars, boats and helicopters retain their original centre reach, and grounded/elevation/roof/parachute checks remain. The actual HEAD and changed `nearestCar()` functions were run at the same outside-wing poses: both original jets refused, both changed jets were reachable (see `boarding-host-before-after.json`). Live E verification is listed below.
- Southport's three SKYLARK 172s previously faced away from the parallel taxiway (the third toward the hangar/apron edge). All now face west, with painted spurs leading to taxiway x=700 and the northern runway 18 connector. Their positions remain unchanged, preserving the civil-aircraft/reset fixture.
- Oceanview's jets, courier and airliner previously faced across the apron. They now face south on separate existing taxiway stubs. The airliner uses the eastern stand: after a normal taxi turn, about 1,196 m of runway 27 remains against a measured clean rotation roll of about 1,056 m. The business jets keep at least 939 m; the courier keeps 1,127 m. All seven stand routes avoid a pushback or powered reverse.
- The old nosewheel formula gave every plane the same broad turning circle. At 15% power, the 172 turned only 14 degrees during three seconds of full steering after a 20-second taxi roll. Each frame now has a wheelbase and yaw limit. Under the same fixture the 172 turns about 78 degrees, the business jet about 62 degrees, and the airliner about 26 degrees. Steering tapers with speed, has no pivot at rest, and limits requested ground yaw to a 0.22 g target.
- The 172 inherited the same 0.21-radian climb-input increment as the faster frames. Holding nose-up through rotation drove it into an immediate stall/bounce before reaching 3 m AGL. Its gentler 0.10-radian increment now permits a smooth normal rotation and climb; an idle-power nose-up stall still occurs and recovers after adding power/lowering the nose.
- The 172 used the same constant-thrust assumption as the jets. Its fixed-pitch piston propeller now becomes power limited above the reference speed. The clean take-off roll is unchanged; full-power, fixed-gear level speed settles near 225 km/h in the host fixture (previously about 245 km/h). Courier mission performance and the jets' thrust/spool profiles are preserved.
- Flight throttle and steering read the mapped actions. The pitch arrows remain independent of throttle, as documented by controls.js. S reduces the lever and applies wheel brakes; it does not make a plane reverse. Fixed gear, finite flap/gear travel, lift/drag/bank/stall handling remain in their existing model.
- Oceanview’s three static 737s now have measured compound fuselage/wing/tail/gear colliders, scaled and rotated with the imported source model. The wingtips stop a taxiing aircraft while the empty apron corners remain open. A wing-only negative fixture and an empty-corner positive fixture verify both cases.
- The procedural courier and airliner also exceeded their old collision envelopes at the winglets, tail and fin. Actual production Three.js solid vertices were measured independently and again by the host regression: courier bounds `[-54.900002,0,-51.840801]` to `[52.100000,35.900002,51.840801]`; airliner `[-115,0,-76.028]` to `[107,66.5,76.028]`. Their centred collision envelopes are now `112×104×36` and `230×154×68` units, including the default courier’s base definition. Lights, labels and invisible prop blur are excluded. `procedural-aircraft-bounds.json` records the measurement; the host test rebuilds and checks the actual solid meshes so a later mesh change cannot silently outgrow the box.
- `airfields()` adds stable vehicle ids, stands, headings and collision/dry-footprint status. New read-only `aircraftTaxi(id?)` returns the current pose, full collision-box clearance, dry footprint, taxi points and runway distance. It cannot mutate a vehicle or bypass normal boarding/physics. `parkingStand` is declared in the vehicle factory to preserve the shared object-layout contract.

## Verified on the host

`tools/tests/aircraft-flight-model.mjs` loads the production flight model, production collision-box/SAT code and authored airport land polygons. It checks plane edge boarding from outside the wing box plus foot radius, refusal beyond 3 m/on a different floor/in flight, the roof/parachute restrictions, and unchanged car/boat/helicopter reach. It also rebuilds both procedural airframes with real Three.js geometry and verifies that every solid vertex fits the collision envelope. Flat-runway numerical integration is run at both 60 and 120 Hz:

| Airframe | Clean rotation roll | Rotation speed |
| --- | ---: | ---: |
| SKYLARK 172 | 322–325 m | 102 km/h |
| Serrano courier | 286–289 m | 115 km/h |
| Aurelia business jet | 618–619 m | 180 km/h |
| Meridian airliner | 1,055–1,056 m | 210 km/h |

The same host test checks no stationary pivot, braking to a stop without reverse, the trainer's fixed gear, finite flap travel, a warned idle-power nose-up stall and recovery after adding power/lowering the nose with altitude available. Every route is driven with ordinary forward/back/left/right actions; full collision footprint and dry land are checked every 0.2 s. All seven paths passed without damage or clearance failure, continued to at least 3 m AGL within the available runway and remained airborne after releasing pitch for two seconds. A negative fixture inside the Southport hangar verifies that the clearance query detects a solid collision.

Measured taxi times at approximately 8 km/h: Southport 54.8 / 76.0 / 127.4 s; Oceanview courier 51.6 s, jets 51.4 s, airliner 58.4 s. Host fixtures use authored airport solids and parked planes; the full live-world physics check below is needed for generated scenery/traffic and the normal entry path.

## Live-game verification

`tools/tests/aircraft-taxi-takeoff.mjs` uses named console reads and the actual E key to enter an existing parked id, then normal throttle/steering/pitch actions to taxi and take off. It checks every sampled taxi pose for damage, dry collision footprint and contact with statics/other aircraft; checks the real pitch arrow without throttle coupling; and releases pitch after reaching 3 m AGL. It covers one existing aircraft of every flight identity and checks all seven stand footprints at each fresh boot.

The final frozen game (`719a535fe3905275c381737acb7fc3e80ee1ab4378c0d5736a4595096b16c03c`) passed this live-world test in 289.0 seconds. It uses the no-render game through the local HTTP adapter, physical E/Arrow key events and deterministically stepped ordinary taxi/pitch controls; it does not measure rendered FPS. No God mode is enabled. Every fresh boot checks all seven parked wingtip footprints; four existing planes then complete the routes without damage and remain airborne after pitch release.

| Existing stand / id | Taxi time | Distance to 3 m AGL | Runway available |
| --- | ---: | ---: | ---: |
| Southport trainer / 259 | 54.2 s | 388.2 m | 434.8 m |
| Oceanview courier / 122 | 51.2 s | 330.1 m | 1,127.2 m |
| Oceanview business jet / 257 | 50.6 s | 694.4 m | 1,032.5 m |
| Oceanview airliner / 258 | 58.0 s | 1,145.0 m | 1,196.2 m |

The original [runner log](verification/final-focused-suite.log) and [structured results](verification/browser-regressions.json) retain the test outcome. This is four live flights, seven live spawn-clearance checks per boot and seven separate host-driven routes. Rendered appearance and shader checks are recorded in the native capture receipts.

## Reproduce

With the shared dev server stopped or explicitly assigned by the root reviewer:

```sh
node tools/test.mjs aircraft-flight-model aircraft-taxi-takeoff civil-aircraft vehicle-layouts --exact --verbose
```

For manual inspection, `airfields()` lists the ids. `aircraftTaxi(id)` supplies a route. Teleport beside the aircraft, press E, add a little W for taxi power, use A/D to steer and S to idle/brake. The three trainers head west then north along the parallel taxiway to runway 18; the four Oceanview planes head south then turn west onto 27. Line up, hold W and apply T/↑ to rotate; release excessive pitch input after lift-off and use short corrections while climbing. The trainer's gear stays down; retractable frames can raise theirs once airborne.
