# Downloaded RPG-7 held weapon

The existing BAZOOKA weapon uses Polyte's **Low Poly RPG-7**, downloaded from the
original Sketchfab export included in Jeh3no's Godot weapon-system repository.
This changes its appearance and hand placement; ammo, damage, spread, reload time,
projectile origins and blast rules remain in their existing gameplay paths.

## Source and reproduction

- Author: [Polyte](https://sketchfab.com/Polyte).
- Original model: https://sketchfab.com/3d-models/low-poly-rpg-7-de967b52c9794d2995d4606749fcdff7.
- Licence: CC-BY-4.0, explicitly stated in the export's `license.txt`, including
  commercial use and attribution. The repository's MIT code licence does not
  replace this model's CC-BY licence.
- Download mirror pinned at `a7bd56c978c1abe1894e6b3822f8826f0a119cfb`:
  https://codeload.github.com/Jeh3no/Godot-simple-FPS-weapon-system/zip/a7bd56c978c1abe1894e6b3822f8826f0a119cfb.
- Run `python3 tools/rocket_launcher_model.py downloaded.zip`. It writes
  `assets/rocket-launcher-model.bin` and the complete source licence, source file
  SHA-256 values, download provenance, geometry counts, fit and output hash in
  `docs/audit/military-combat-review-2026-10-20/bazooka-source.json`.

The near mesh retains all **3,500 authored triangles, 8,814 split-normal vertices
and 22 mesh primitives**. The six used materials retain their exact linear base
colours, roughness and metallic factors; the scope lens remains the source's
opaque cyan material. This source authors no images, UVs or texture maps. No
procedural detail replaces its scope, trigger guard, sights, wooden heat shield,
wooden handles, metal clamps, olive round or rear venturi.

## Fit and hands

The source has +Z forward, +Y up, +X left. Its two glTF conversion nodes cancel;
the converter verifies their resulting identity transform. The game conversion
is a rigid +Z to +X axis change and uniform scale: the unloaded launcher tube is
0.95 m at 8 units/m; with the loaded round the complete model is 1.280 m long.
The grip and tube do not receive the older procedural `WEAPON_SCALE` enlargement.

The native trigger and guard identify the front wooden pistol grip as the firing
handle. Its measured centre is the weapon origin; the support fist encloses the
rear wooden grip. `PB_GRIPS.rocket` fits the player's normal and disguised hands;
`WEAPON_HOLDS.rocket.support` fits the crowd hands to the same grip. The shoulder
hold, recoil and reload motion use the existing rig and arm IK.

Weapon-space anchors (game units):

| Anchor | x | y | z |
| --- | ---: | ---: | ---: |
| Firing fist | 0 | 0 | 0 |
| Support fist | -1.114081 | 0.106103 | 0 |
| Tube exit | 1.961388 | 0.924611 | 0 |
| Loaded round tip | 4.598803 | 0.924611 | 0 |
| Rear venturi / backblast | -5.638612 | 0.924611 | 0 |

The tube and round face +X and backblast faces -X. The old on-foot projectile
spawn remains 14 units ahead of the player's centre in `game-player-actions.js`;
this pre-existing gameplay offset is separate from the visual model anchors.

## Rendering and limits

`rocket-launcher3d.js` is included before `character-rig3d.js`. It decodes the
pack once. The shared source position, normal, colour, finish and index arrays
remain immutable. The near and far instance buffers have their own attributes;
no holder gets a model, material or texture clone.

The 561-triangle far LOD is a separate per-primitive welded QEM edge-collapse copy
of the downloaded mesh. The player keeps the full source at every zoom; distant
crowd holders use `P.rocketFar`, close holders `P.rocket`. Each LOD is one shared
InstancedMesh, capacity 10. Their single shared MeshStandardMaterial reads the
source roughness and metallic factors from `rocketFinish`, giving at most two
weapon draws however many people hold it. Shader/material creation happens with
the rig at boot, so the ordinary renderer prewarm sees it.

`tools/tests/rocket-launcher.mjs` runs entirely on the host: licence/source and
output identity, every near face and split vertex, bounded far mesh, exact source
material factors, normals/indices, real size and forward/backblast orientation,
actual closed-fist centres against the authored wood surfaces, shared LOD
selection, shader anchors, and arm reach through aim, recoil and reload at
1.60/1.81/1.90 m stature. A rendered review still checks the final shoulder pose
and lighting in the game.
