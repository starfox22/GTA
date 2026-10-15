# Downloaded jet evidence

The flyable AURELIA J8 now uses the licensed Citation exterior; Oceanview's three
terminal transports use the licensed Boeing 737 in a fictional material livery.
The original Bell/Cessna binary and skin are unchanged. Source details,
attribution, reproduction and adaptation limits are in
[downloaded jets](../../areas/vehicles-and-driving-models-jets.md).

Source intake uses actual downloaded ready-made models from pinned public
mirrors of Sketchfab exports. Neither repository's general software licence is
used as a model grant. The Citation's embedded licence matches its per-model
mirror attribution; the 737's exported licence file matches its embedded metadata.
Original Sketchfab listings are inaccessible here, a retained evidence limit.

## Exact candidate and numeric comparison

- `jet-models.bin`: SHA-256
  `a8f911de36c3d7a8a97b4b0a0ee0ef855fed15ee9415d0f505edbdd7967b092b`,
  6,143,692 bytes.
- `jet-skin.webp`: SHA-256
  `116993dd172cc53a8e580e0088ca1f755c7d78a4214521c12db9abde696bccf6`,
  11,136 bytes, identical to the mirror's embedded 256 × 256 image.
- [Pinned intake and every input hash](../../../tools/jet_models_source.json).
- [Conversion receipt and unchanged old aircraft hashes](verification/jet-conversion-receipt.json).
- [Independent original-source reconstruction](verification/jet-source-verification.json).
- [Rig measurements](verification/jet-rig-source-audit.json).
- [Production runtime and retirement host checks](verification/jet-runtime-host.json).
- [Verifier corruption rejection checks](verification/jet-verifier-rejections.json).
- [Branding shared-edge audit](verification/jet-branding-seam-audit.json).
- [Full source bounds and normals](verification/jet-source-bounds-normals.json).
- [All source primitive roles and collision footprints](verification/jet-role-footprints.json).

| Model | Original / retained near triangles | Far triangles | Source vertices checked | Maximum position error | Minimum authored normal dot |
| --- | ---: | ---: | ---: | ---: | ---: |
| Citation | 20,131 / 20,131 | 6,929 | 13,932 | 0.1192 mm | 0.999999999694 |
| 737 | 162,629 / 162,629 | 17,319 | 187,795 | 0.2993 mm | 0.999999999668 |

Every original triangle belongs to one near part. No source normal is zero; no
packed normal is zero. Citation UV error is at most 0.000007629; the 737's
original UVs, including repeated fan UVs, are retained exactly. Far vertices are
surviving source attributes. The source topology, neutral reconstruction and
shading were compared directly; no ratio-one smoothing was used.

The source branding is an inlay in the shell. Recoloring exactly 4,140 original
faces preserves all source topology. The shared-edge evidence shows why removing
the lettering would cut holes. The complete cabin, 76,646 triangles, stays in
the near source and is omitted only by distant LOD.

`tools/tests/jet-assets-rig.mjs` passed 26 native Three.js assertions against this
pack: actual builder dimensions/contact, three gear groups, seven adapted
controls, repair map restore, shared geometry, player near/distant non-player
selection, actual static near/far scene counts, and static construction before
later resource initializers. These host checks establish geometry and lifecycle
behavior; the separate native game captures below establish rendered appearance.

`jet-assets-lifecycle.mjs` passed 43 additional native assertions using the actual
`collectResources`, `pruneModels` and `disposeRetiredModels` production functions.
All 29 source geometries, including hidden far levels, and four static materials
remain shared. Retiring two instances disposes their four private paint materials
and zero shared resources. A later instance reuses the intact source kit. Static
near/far selection and its quality-scaled distance also pass. The bounded caches
hold two model kits and one native Citation texture per renderer; LOD changes
allocate or dispose no source buffers.

## Source and pack inspection images

The files in `source-previews/` are **Blender CPU source/pack inspection renders,
not in-game screenshots**. Source mode imports the native source and applies only
the same uniform coordinate/size fit. Near/far modes independently decode the
shipped binary and use its original split normals and UVs. The same camera and
lights are used for a model's direct source/pack comparison. The 737's palette
change and material adaptation are intentional and documented.

| Aircraft | Native source with uniform frame/size fit | Shipped near pack |
| --- | --- | --- |
| Citation exterior | [Source inspection](source-previews/citation-source-inspection.jpg) | [Decoded pack inspection](source-previews/citation-near-inspection.jpg) |
| Boeing 737 | [Source inspection](source-previews/airliner-source-inspection.jpg) | [Decoded fictional-livery pack](source-previews/airliner-near-inspection.jpg) |

Each image has a matching JSON receipt with native PNG and review JPEG hashes,
the precise pack hash and unchanged native render dimensions. JPEG encoding is
the only image conversion; no source feature is painted into a preview.

Reproduce each image (substitute `jet` / `airliner` and `source` / `near` / `far`):

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 blender -b --threads 1 \
  -P tools/jet_models_preview.py -- /tmp/jet-source /tmp/jet-previews \
  --assets assets --model jet --mode source
```

The Citation remains an exterior-only 256px derivative with painted windows and
no independent turbine blades. Its adapted hinges/gear are measured spatial
partitions, not source-authored pivots; seven small bay triangles remain fixed.
Those limits are preserved rather than describing the import as a complete
high-end aircraft simulation.

## Native game appearance

The final captured candidate is identified by
[its complete input hashes](verification/final-runtime-candidate.json), HTML
SHA-256 `719a535fe3905275c381737acb7fc3e80ee1ab4378c0d5736a4595096b16c03c`.
The jet source, loader/API registrations, both new assets and unchanged original
aircraft inputs match that candidate. These are original game viewport pixels
from the parent-run software WebGL capture, separately inspected against the
source/pack images above; they are not Blender previews.

| Actual game view | Observations | Native PNG SHA-256 |
| --- | --- | --- |
| [Flyable Citation](images/after/plane-jet-front.png) | Source rear nacelles, T-tail, swept wings, painted windows and extended gear are visible. The original 256px exterior texture remains visibly soft. | `b4bcb9f909b37a62b08fbf2751c370c92ccc2f4eca5a887d4a1692e361a5bedf` |
| [Oceanview source 737](images/after/airport-static-jet.png) | Rounded fuselage, swept wings/winglets, fin, modeled gear and fictional white/navy/teal livery are visible. The retained shell has no lettering holes. | `ccd083698d4d6107b6bcd114ab47ffd8d884774240546d30f6573b94486bd8b8` |

Both captures report HIGH quality, 3D play, zero frame faults and zero GPU context
losses. They establish the source models' visible integration at the documented
viewpoints; they do not measure hardware frame rate or expose live hinge/LOD
transforms. The exact geometry budgets and shared-resource retirement remain
covered by the production host checks above.

## Native jet controls and quality phase

The jet phase of the parent-run `aviation-vehicle-runtime.json` has reached its
two native control screenshots on the same frozen candidate. Its recorder
SHA-256 is `2ac7d987c18fcbf796951aa80c11e49f738684572d967ce9d7c6ab9e4cd3d73f`.
At inspection the overall extended runtime was still running: 110 assertions
had executed, with no recorded errors or failure. This records the completed jet
phase, not a final pass for the whole runtime review.

For each requested setting (`low`, `medium`, `high`, `ultra`, `auto`), the actual
player jet, ID 286, retains downloaded asset identity `jet`, both loaded model
kits, measured dimensions 15.62 × 14.75 × 5.66 m, zero frame faults and zero GPU
losses. Each camera draw profile submits 20,131 vehicle triangles: the original
near source remains selected for the player across all five quality requests.
This does not establish a browser measurement of distant non-player LOD; its
threshold, geometry sharing and retirement are covered by the host checks.

| Actual game control view | Observed state after real mapped keys | Native PNG SHA-256 |
| --- | --- | --- |
| [Ground source jet with flaps](images/runtime/jet-ground-flaps-source.png) | ID 286 at rest. `KeyL` respects the weight-on-wheels interlock: gear remains DOWN / 1. `KeyX` and 1.1 simulated seconds select flap stage 1 / position 0.33. | `83f49fd1dd8af62949fc06389c316b9436ea4a1a73705a689ef61e008b65ce15` |
| [Airborne source jet in chase](images/runtime/jet-cruise-gear-flaps-chase.png) | ID 287 begins in a 100 m cruise fixture with gear UP. Mapped flap/gear keys and 4.8 simulated seconds produce gear DOWN / 1 and flap stage 1 / 0.33. The actual screenshot records 313.4 km/h and 101.13 m AGL; projection reports visible and in front of the camera. | `2257eca408de61e5d25aaf7150ba55bff56d185c9e114dc20194c6e35ea8b289` |

Both original 960 × 600 PNGs were visually inspected and their retained audit
copies match the runtime hashes. The source model, modeled gear and controlled
flap regions remain visible. Deflected flaps expose small jagged seams at the
adapted triangle boundaries: this merged exterior has no source-authored flap
cut edges or rig. A source with authored movable surfaces and a higher-resolution
native exterior texture remains a polish opportunity. Public runtime reports
expose actuator state and actual source geometry, not individual live hinge
transforms; the host rig checks provide the latter numeric deformation evidence.
