# Military vehicle fidelity proposal — 15 October 2026

Proposal only. This pass has not imported or replaced a military model, changed its
handling, or purchased anything. Keep the current M4 utility and M35 until a replacement
proves better in the actual game. A larger triangle count alone will not solve their
materials, cabin or moving-panel limitations.

## What is actually present

Counts below come from the shipped `assets/vehicle-models.bin` header and count one
active level, including wheels and panes. They exclude the M4 gun variant's existing
procedural mount. The near/far alternatives are not drawn together.

| Game model | Existing licensed source | Active geometry | Current constraints |
| --- | --- | --- | --- |
| SENTINEL M4 UTILITY | [HMMWV M998A1 soft top](https://sketchfab.com/3d-models/hmmwv-m998a1-soft-top-ffbc4b053628413fb84acf5b89595d96), 42manako, CC BY 4.0 | 17,459 triangles near; 7,203 far before runtime redistribution of fixed wheel components (triangle totals conserved) | One atlas body; material groups, not authored door hinges; no cabin/door animation contract. The source has 20,702 triangles, eight material-group meshes, six base-colour images, zero normal/metallic-roughness texture maps and no animations. |
| SENTINEL M35 CARGO TRUCK | [Military Truck 1/2 Ton](https://sketchfab.com/3d-models/military-truck-12-ton-5d19c751b12849eeb390d637b2b686a1), Arion Digital, CC BY 4.0 | 11,371 triangles; six rolling wheel groups; no body far level | The packed body has no independent glass, cabin or door part. The source title is ambiguous about tonnage; do not treat it as a manufacturer specification. Raw source and cabin detail were not independently inspected in this pass. |

The HMMWV licence was retrieved with its original source metadata from a pinned
[mirror](https://github.com/jstxw/CyberSea/tree/54322bd29eb43082ba49dbd4e96554c69fdb0651/main/public/models/hmmwv_m998a1_soft_top).
It explicitly permits commercial use with attribution. This is the **same** asset
already in the game, not a new higher-detail discovery. See the saved
[inspection](source-evidence/hmmwv-source-inspection.json),
[receipt](source-evidence/hmmwv-source-receipt.json) and
[licence](source-evidence/hmmwv-license.txt). Only metadata/licence were downloaded
for this audit; the source binary was not rendered or visually certified here.
The existing M35 credit is in `docs/THIRD_PARTY_CREDITS.txt`.

## Recommended work, in order

1. **Preserve the source correctly.** Compare source/packed normals, silhouette,
   thin canvas and winding before any detail work. The M4 near body must remain
   unclustered: its previous clustered hood and canvas folded together. Preserve
   the corrected tyre circles, fixed running gear and source UVs. This is a
   converter/QA prerequisite, not a request to replace sound measured geometry.
2. **Give the cabin and doors a real asset contract.** Audit what interior surfaces
   the source actually contains, then segment the real doors and windows, measure
   hinge axes, and add missing inner door faces, seats, dashboard and floor only
   as separately authored work. The current military special builder does not
   use the civilian car's opening-panel rig. A texture pretending to be an interior
   would still fail close chase views. Check driver hands/feet, seat position,
   entry/exit clearance and the M4 gunner's unchanged mount in both views.
3. **Author material separation rather than inventing PBR maps.** Keep coated paint,
   canvas and rubber matte; separate bare fittings and optical glass. The current
   HMMWV source supplies base colour only. Normal/roughness/metallic maps would
   have to be authored and reviewed, not inferred to exist or generated from a
   colour image and described as source detail. Preserve camouflage markings,
   independent broken lamps, grime, scorch and repair.
4. **Add an M35 far level and screen-size budgeting.** Share immutable geometry and
   materials; retain the player's complete model. Bake a conservative far body
   with protected silhouette/wheels and test it in the fort motor pool. Do not
   subdivide every vehicle across the city just to improve a close-up.

Initial **proposed caps**, to measure rather than claim achieved: M4 25–35k triangles
near and 6–8k far; M35 25–40k near and 5–8k far, including rolling wheels. Start with
one shared 2k material set, consider 4k only for HIGH/ULTRA after actual VRAM/fill-rate
measurement, and keep separately drawn moving doors/glass near only. Cabin work
can add several draws per nearby vehicle, so the gate is measured whole-scene cost
and a visible improvement, not hitting the top of a triangle allowance. Neither
these caps nor cloud renderer measurements prove M4 Max/browser frame rates.

## Other free sources considered

No different HMMWV or M35 with both a verified reusable licence and verified usable
source has been established as a better replacement. A repository's code licence
does not establish the licence of models copied into it. Keep searching only if
the existing source audit shows the cabin cannot be upgraded economically.

[Chieftain MK-5 Main Battle Tank](https://sketchfab.com/3d-models/chieftain-mk-5-main-battle-tank-1afc838ca30c4dac99c15e731d0d2ab8)
by Muhamad Mirza Arrafi is a concrete **separate tank proposal**. Its pinned original
source was downloaded and checked by the converter reviewer: CC BY 4.0,
55,147 triangles, 11 meshes, ten materials, nine base-colour maps, no authored normal/ORM maps or
animations. [Pinned source](https://github.com/sannzana/Graphics_project_military_base/tree/523e7e7197c36655b3b8b3b17d99db9eab87c7c5/Tank_model)
includes the licence. Hull/turret/cannon/track/wheel material groups are available,
but a usable track rig and full cabin have not been verified. A British 1970s
Chieftain would change the current tank's identity; it is not an Abrams model.
It needs approval, a source preview, measured turret/muzzle pivots, track motion,
damage compatibility and LOD proof before import.

[Native source preview](source-evidence/chieftain-native.png) — proposal only,
rendered from the downloaded source in Blender on the CPU, not an in-game capture
or an imported replacement. Credit: Muhamad Mirza Arrafi, CC BY 4.0. Saved
[licence](source-evidence/chieftain-license.txt),
[receipt](source-evidence/chieftain-source-receipt.json),
[inspection](source-evidence/chieftain-source-inspection.json) and
[preview script](source-evidence/chieftain-preview-script.py) preserve the evidence.
The original Sketchfab page was inaccessible here: attribution and permission are
supported by the matching exported metadata/licence, rather than an independent
ownership investigation.

The Bradley simulator repository was also inspected as a lead. Interior/exterior
Blender files exist, but their Blender 5.0 format is not readable in the installed
4.3 tool and the vehicle files' provenance has not been independently established
by the repository's MIT code licence. It is not an approved asset candidate.

Acceptance for any future replacement: source/licence receipt, matched close and
normal-distance captures in both cameras, moving/steering/reversing wheels, opened
doors and visible occupied cabin, night/broken lamps, burn/repair, near/far stability,
all graphics tiers, plus actual laptop profiling. Full AAA production readiness
is not established by this proposal.
