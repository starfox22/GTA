# Downloaded Apache source and adaptation

The AH-64 uses **AH-64 Helicopter**, by **Andrew Swihart**
([author](https://sketchfab.com/andrewswihart),
[original model](https://sketchfab.com/3d-models/ah-64-helicopter-56f54d3865d247c78b49c2b47454da86)),
licensed **[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)**.
The original download's `asset.extras` explicitly records this author, model URL,
title and licence. [source.json](source.json) preserves those fields and every
authored material. There is no inferred repository-wide model licence.

Downloaded archive:
`https://raw.githubusercontent.com/projeto-arcanjo/modelos/d18428675ef6ca8d71c61e6ea7dc42ffc6691579/ah-64_helicopter.zip`

Archive SHA-256:
`0dfd7de823324fc2de7873338881b6d358c865718183447bf4ae04e284b78d45`.
This pinned GitHub mirror contains the original Sketchfab-exported `scene.gltf`
and `scene.bin`. The original Sketchfab page was inaccessible through this
session's web fetch; licence evidence is the downloaded original glTF metadata.
The model has **no authored image textures**. No external textures, marking
decals or procedural replacement airframe were added.

The [source preview](source-preview.jpg) shows the downloaded geometry before
integration. The owner requested the replacement and the integration review
accepted this source before conversion. Runtime appearance needs its separate
native renderer capture; this source sheet is a geometry preview.

## Conversion and retained detail

`python3 tools/apache_model.py` downloads and verifies the archive and creates
the isolated `assets/apache-model.bin`. `--source <directory>` reuses its
unpacked source. Existing vehicle, military and civil-aircraft packs are not
rewritten. The custom container is `DECAP001`, with aligned typed arrays and a
JSON header. Split-media publication reconstructs its bytes across ordered
chunks as needed.

All **220,711 original aircraft triangles** and their **662,133 source corners**
remain in Near, with authored normals, UVs, double-sidedness and linear base
colour/roughness/metalness factors. Only two fully transparent studio cards
(four triangles) are excluded. PBR factors are vertex attributes on a shared
source shader; clean paint is neutral white, preserving the source colours.
The source's opaque black glazing remains solid geometry with authored
roughness and metalness. The source has no detailed cockpit interior.

The existing eight source Hellfire rounds are independently numbered in one
payload draw. Four additional wingtip air-defense rounds are adaptations of
the downloaded missile geometry, resized to 1.52 m and narrowed, and add 1,936
triangles. They are distinct from the eight rack occupants and both rocket
pods. The final Near kit has **222,647 triangles in seven source draws**.
Spent missile slots are discarded in the source shader and exact ray query;
shared source attributes and indices are never edited.

Far alone uses deterministic source vertex clustering: **14,276 triangles**.
It switches with hysteresis at 650/570 world units (quality-scaled), while the
player keeps Near. A single **4,791-triangle**, shared source-derived neutral
proxy casts the shadow; the seven source meshes do not. The shadow proxy is
a deliberate approximation and retains the neutral full-load silhouette.
The existing shared rotor-blur disc and five small light halos add at most six
visible draws. There are no new point lights or per-frame source conversions.

## Dimensions and rig

The true tilted main-rotor axis is measured from the source mast, retaining
its authored ten-degree forward tilt. Radius is normalized to **7.315 m**
(world radius 58.52 at eight units/metre). Fuselage length is **14.589 m**;
the authored radar top is about 4.92 m above tyre contacts. The unusually tall
thin whip antenna reaches **7.434 m** and is retained. Source tyres rest on
ground y=0; the three fixed landing gear legs are not replaced or retracted.
The main rotor and hub turn about the true source axis, the radar remains
fixed, and the scissor tail rotor turns about its source hub.

Connected source components isolate the 4,393-triangle chain-gun assembly
from the body, wheels and sensors; 568 of those triangles form the recoil
barrel. Its source rest bore is about 6.03 degrees down. Gameplay compensates
that rest angle and the small authored lateral asymmetry, while renderer
yaw/pitch and muzzle transforms use the same measured hardpoints and body
attitude helpers. [source.json](source.json) stores the precise hardpoints.
The nose sensor assembly and stabilator are fixed source geometry; no authored
skeletal animations were present or claimed.

Every exported visual part has an offline median bounding-volume tree over
its exact original triangles. Its shared cached `Mesh.raycast` override tests
only intersected leaves of at most 32 triangles. Ordinary impact-mark callers
keep their existing API and hit the real source skin. Near geometry never
falls through to a 220k-face brute-force damage ray. The shadow and blur meshes
do not participate in cosmetic ray queries.

## Reproduce the receipts

```sh
python3 tools/apache_model.py --source work/military-combat-review/apache-asset/source
python3 tools/apache-model-source-check.py --out work/military-combat-review/apache-asset/verification/apache-source-proof.json
node tools/apache-assets-host-check.mjs --out work/military-combat-review/apache-asset/verification
```

The independent Python receipt reconstructs every original source corner,
normal, UV and material assignment from the packed articulated parts and
requires exactly one owner for every aircraft source face. The production
Three.js host receipt checks source ownership, shader factors, payload
occupancy, fixed gear contact, tilted rotor, articulation, resource sharing,
Far/shadow budgets, repair immutability and cached BVH parity against native
Three.js raycasts. These are CPU correctness receipts, not a hardware FPS claim.

Changes to the source asset: unit/frame normalization; source-part grouping;
animated rotor/gun pivots and recoil; PBR factor packing; four derived wingtip
missiles; reduced Far geometry and shadow proxy. The original author does not
endorse this game or the adaptation.
