# Rendering: the chase view's draw distance and level of detail

The chase view (V; chase-camera.js says where the camera stands, chase-view3d.js draws it) looks along
the street to the tier's draw distance (`CHASE_DRAW`: LOW 325 m, MEDIUM 450, HIGH 600, ULTRA 800), so it
sees far more of the city than the overhead view. Everything here only changes what is drawn and how;
the game never reads it. What steps out by its size and the haze (CHASE PROPS, PARTS, HAZE SIZES) and the
draw calls per tier: rendering-chase-budget.md.

## What is drawn at all

- Cells of scenery draw inside the draw distance and the frustum (`chaseCellShown`), plus those within
  `CHASE_SHADOW_KEEP` behind the camera (their shadows fall in front of it).
- Haze closes over the far part of the draw distance (the four "Haze" lines in `updateChaseView`); the
  far clip and every distance step below sit in or behind it.

## Far cells: the far copy beyond the near radius (CHASE FAR CELLS)

- Beyond `CHASE_FAR_NEAR` (LOW 175 m, MEDIUM 200, HIGH 225, ULTRA 275, from the nearest point of a
  1024-unit cell) a cell is drawn from the far copy of the city (FAR SCENERY, flight-view3d.js) instead
  of its full batches: the cell hides its `full` group (the static batch cell's batches the copy stands
  for, render3d-statics.js) and its building blocks, and turns on its run in the 3 km far meshes.
  48 units of hysteresis each way: a cell never flickers on the line.
- Inside each 3 km far mesh the pieces that stand for batches and blocks are ordered by 1024-unit cell
  (serpentine, so neighbours are consecutive) with one draw group per cell; breakable scenery's pieces and
  the far tree blobs come last (the chase view keeps their full models, so the copy never draws them
  twice). The air draws the whole mesh with its single material, exactly as before; the chase view swaps
  in `[material, farSkipMaterial]` and its groups draw the runs of far cells in view (consecutive cells
  as one call, `chaseFarGroups`), the rest skipped (an invisible material is never pushed).
- The copy is the same shapes, so the seam shows only where a piece under `FAR_PIECE_SIZE` (20 units
  across from above) drops out, a few pixels at 175 m and more, in the haze. Shared facades keep their
  own material (the far geometry carries `cityLit`), so window light stays building by building at night;
  a class of one material with plain texture transforms keeps that material (the roof skin too: it reads
  only the uv, the tint and the world position, `farTint`); others use the copy's averaged material (as in
  the air).
- Gotchas: `resetChaseFar()` runs on every far-mode change (it puts every cell's `full` group back);
  anything new that the far copy stands for must hide with its cell; `drawProfile` counts only groups
  whose material is visible. Behind the title (`gameMode` 'menu') the copy stays whole even in the chase
  view: the prewarm draws every far mesh once with its own material to upload it (`uploadMeshes`), and
  the chase view's materials are those programs or the batches' own (no new program).

## Shadows (CHASE SHADOWS, CHASE SHADOW CASTERS)

- The sun's shadow box is fitted to the near slice of the view (`CHASE_SHADOW_REACH`: 112 / 112 / 150 /
  187 m) and fades out by view depth (`cityShadowFade`).
- Before the shadow pass (the shadow map's `render`, flight-view3d.js) every static batch and breakable
  cell, static cell (then each of its groups), far mesh and instanced pool outside the cells is tested:
  its box swept away from the sun by its height (`top`, measured at boot) against the ground under the
  frustum slice (2D hull, `chaseShadowRegion`). Casters that cannot reach it are hidden for that pass only
  (the camera's draw list is made before the shadow map) and shown again after. The sweep is capped at the
  shadow camera's depth. Inside a cell that can cast, each batch, breakable or tree pool and prop or part
  is tested on its own box too, and a small batch casts only within its size times `CHASE_PROP_SHADOW` /
  lodBias (rendering-chase-budget.md).
- Shadow proxies: a near cell whose nearest point is beyond `CHASE_SHADOW_PROXY` (0.47) of the shadow
  reach casts from the far copy: its batches and blocks are hidden for the pass and the far meshes swap
  in `shadowGroups` drawing the casting cells. Pieces under 2.5 m lose their shadow there (70 m on HIGH).
- Never a light's castShadow: only meshes' `castShadow`, `visible` and layer masks change.

## Small props and pools (CHASE PROPS, CHASE PARTS, CHASE POOLS)

- Detail-layer props, the static groups' small parts and glows, signs, small batches, breakable pools and
  vehicles' small parts step out by their own size against their distance and the haze:
  rendering-chase-budget.md.
- Instanced pools outside the cells (forests, lanterns, posts) step out past `CHASE_POOL_REACH` (0.85) of
  the draw distance by the nearest point of their instances' box (made again when `instanceMatrix.version`
  or the pool's place changes; a pool written three frames running is moving and left alone). City-wide
  prop pools (lamp posts, bollards) span the map and are always drawn, in both passes.
- Hiding is by layer mask 0 (nothing else writes those layers) and castShadow; all is put back when the
  chase view ends.

## People and vehicles

- People (crowd3d-frame.js `crowdChaseDetail`): each person's street zoom (`chaseZoomAt`) picks the street
  view's steps (2 full, 1 without hands and props, 0 the three-instance figure) and the body set (the
  near set for the player and up to seven others within ~12 m, people-and-crowd-rig.md; close within
  ~26 m; the street set beyond); under ~3 px (`CROWD_CHASE_LEAST_ZOOM`) they are not drawn. Far
  figures cast no shadow in the chase view (they stand past the shadow reach).
- Vehicles: `vehicleImpostor` by `chaseZoomAt` (body impostor from ~100 m on HIGH, boxes from ~157 m); a
  full model's small parts by their size (CHASE VEHICLE PARTS, rendering-chase-budget.md).

## Console

`DeadEndCity.chaseCamera().view`: `farMetres`, `farCells`, `farMeshes`, `shadowCells` (tested, hidden,
proxies in the last shadow pass), `props` (detail meshes, parts, signs and pools hidden or not casting,
loose pools) and `draws`: the last frame's camera and shadow calls and triangles by kind (batch, far,
static, instanced, crowd, vehicle, sprite, other), by distance band and by size on screen (`px<N`, the
largest side at 720 lines), with the top names. `lookSwitches({ chaseBudget: false })` turns the budget off
in the same page (an A/B).
