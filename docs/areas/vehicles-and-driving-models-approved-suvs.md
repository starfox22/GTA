# Approved SUV replacements

The owner approved all five free candidates on 14 October 2026. The three SUV bodies
are S1 Suzuki Jimny (tonielpro520), S2 Generic SUV and S3 Generic Offroad (Comrade1280).
Source licences and credits live in `docs/THIRD_PARTY_CREDITS.txt`. These modern body
styles were explicitly shown before approval; the game still uses the Ranger/patrol
gameplay roles.

## Selection and packed data

- `approvedSuvKey(c)` in `driveby-seats.js` maps civilian `suv` IDs modulo three to
  `s1_jimny`, `s2_suv`, `s3_offroad`. It consumes no random numbers and stores no new
  per-car state. `vehicleAssetModel('suv')` is the builder-availability gate; the
  actual per-car choice happens in `makeAssetCar`.
- Patrol `utility` and federal `tahoe` bodies use S2, a four-door body with a rear
  bench. The Jimny/offroad two-door bodies keep their rear bench and four-seat role.
- The independent `assets/approved-vehicle-models.bin` has DECVM001 headers and
  source-preserving close/far parts. `lodParts` must name every packed near/Far pair;
  the host budget assertion rejects a missing map rather than silently drawing near parts. Existing `vehicle-models.bin` and all its 23
  models remain intact. `tools/approved_vehicle_models.py` is the offline converter.
- `vaGeometry` supports `u4` indices and optional normalized-byte `.f` vertex
  roughness/metalness, raw `.a` UVs and normalized `.t` atlas rectangles. Source
  repeat UVs are sampled within their material tile. `vaJoin` retains all common attributes and decodes normalized
  attributes correctly, including finish. No source UVs are overwritten for paint.
- Every approved civilian body draws at its native, uniform metre scale. Collision
  footprints use the same stable per-style dimensions. Handling parameters remain
  the existing Ranger's; no new gameplay vehicle type was introduced.

## Renderer and mechanics

- `vaKit` and `policeAssetKit` keep the shell, panels, hinged hood, five grouped
  panes, four damageable lamps, first-child tyre and measured wheel pivots expected
  by damage, tyres, suspension, occupants and drive-by code. Geometries are shared
  per style/size; each spawned vehicle has independent transform nodes.
- `approvedSuvFarKit` constructs immutable geometry pairs and `approvedSuvLodParts`
  registers them. `approvedVehicleLod` swaps mesh references with tier-dependent
  distance hysteresis and restores close parts before damage or trunk changes.
  Near-only pristine merging is disabled for these models so it cannot defeat LOD.
- `flight-view3d.js` pools bodies per approved style, takes the explicit far geometry,
  and shares a white-base PBR material with per-instance colour. Immutable far shells
  can initialize a pool before any near model is drawn; deformed per-car shells
  remain excluded. A street of Ranger
  variants no longer inherits the first vehicle's body or colour.
- `animateApprovedSuvWheels` changes approved civilian steering after the existing
  civilian rolling pass, so it does not animate roll twice. Police SUV tyres now
  roll and steer, including reverse, brake locking, rear wheelspin and the police
  draw scale. Approved wheel order follows explicit front/side metadata, so tiny
  source offsets do not swap left/right tyre flags. The renderer only reads physics state.
- The marked patrol S2 has a fitted roof bar, mounting feet, red/blue/takedown lenses,
  grille strobes, halo anchors and aerial number placement. Unmarked S2 keeps dash,
  grille and rear-deck lights. Existing police patterns/wig-wag and crew still work.
  `policeApprovedDecalAnchors` omits the SUV's unsupported sedan trunk number,
  fits its aerial unit number between the source rails above the bowed roof, and
  places both side unit numbers wholly on rear-quarter paint below the glass.
  It reads source geometry without changing any source attributes or indices.
- Sheriff livery uses one affine sill-to-glass-belt side projection in `liveryUv`, shared by near/far shells;
  sparse per-station vertex envelopes must not change letter height. Source atlas coordinates stay in
  `uv`. `policeApprovedPanels` retains normals, UVs, colours and finish while
  splitting the roof/pillar livery boundary. Close and far parts use the same
  projection. Approved police paint uses `look.paint`, like the legacy police
  builder; using dark gameplay `vehicle.color` would hide white doors/stars/text.
  Approved material/char handling is in `approved-vehicle-assets3d.js`
  and `vehicle-char3d.js`, including source albedo/ORM restoration after repair.
- Jimny retains its actual authored seats/dashboard. S2/S3 have no source interior;
  a bounded shared `carCabinParts` fallback supplies their seats and dash in one
  extra draw using the correct existing trim atlas. It hides at far LOD, chars and
  restores on repair. No source meshes are deleted to fit it.
- Jimny's non-cabin source BLEND optics use `opticalGlass`/`opticalGlassFar`, with
  actual atlas alpha 0.4/0.5, source finish and normals. `m.opticalGlass` adds one
  transparent DoubleSide draw (`forceSinglePass`, opacity 1, alphaTest 0,
  depthWrite false); it casts no opaque shadow over the retained reflectors.
  Its immutable far part also enters LOD and untinted body pools. Char/repair
  preserves its source maps and render flags. The original conversion had made
  black lens covers opaque, hiding intact headlamp geometry.
- S2's verified outer roof/upper-door faces belong to paint, including nonmetal
  Body_7 surfaces. The converter moves only the connected exterior faces proven
  by source rays, retaining RGB/ORM and excluding handles, rails, interior,
  grille/chrome/rubber. A metallic-only paint guess would leave the actual outer
  body in trim, beyond the reach of Sheriff livery and body damage.
- Dynamic door/trunk paint boxes carry valid white-source paint UVs, finish, colour,
  repeat-atlas attributes and separate police livery coordinates. Approved geometry
  without a packed colour receives explicit white vertex colour, avoiding black
  meshes under `vertexColors: true`. Source-backed doors preserve these attributes
  when cutting real apertures and moving the extracted skin/trim/window; see
  `vehicles-and-driving-doors.md`. Preserving only legacy UVs would sample an empty
  atlas rectangle under new paint.
- The damage renderer hides a previously created synthetic trunk lid after repair
  or closure, showing the intact source hatch/window again. Open or sprung lids
  still animate. Native review caught a repaired green paint slab over rear glass.

## Verification

`tools/tests/approved-suv-rigs.mjs` uses real packed geometry, actual production
builders, Three.js, character head geometry and cabin-fit code. It checks style
selection without simulation mutation, independent/shared wheel geometry, measured
centres, source UV preservation, close/far budgets, four-seat cabins, police equipment
and signed/locked wheel animation. The 14 October host run has 438 passing assertions
(including production seated head/fit geometry); `suv-host.json` records exact input
hashes and measurements. The marked/unmarked palette tests use the real production
PBR constructor and compiled livery patch with dark gameplay colour, so white
patrol markings cannot silently inherit it. Forty-five actual builder ray probes
check the outer S2 roof/doors, and real optical material/near/far/pool checks reject
opaque lenses or extra two-sided passes. Ten further assertions call production
`carBodyDamage` on the real marked S2 through open, closed, sprung and repaired
states, retaining the source glass/body. Native WebGL receipts and matching photos
live in `docs/audit/approved-vehicle-integration-2026-10-14`: candidate6 passed all
ten street/chase presets, actual 2048/4096 atlas changes, day/night Jimny optics and
a three-instance far pool, with zero renderer errors, frame faults or context losses.
Its manual repair-photo finding is preserved separately; candidate8's native
clean/fire/repair check restores the source rear glass with zero renderer faults.
These software-GPU checks are not an M4 Max frame-rate benchmark.

`DeadEndCity.assetCars()` reports effective motorcycle replacements and the three
Ranger style keys, close/far triangle counts and their source identities. Console
lineups/dealership cars continue to use existing vehicle types.
