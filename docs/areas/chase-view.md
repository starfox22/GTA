# The chase view (third-person camera)

Two views of one game: the overhead STREET view the game was built on, and the CHASE view behind the
player at street level, the way GTA IV frames it. V (action `cameraView`; R3 on a pad; Settings ·
Gameplay · Camera view) switches them, and the choice is saved (`dead-end-city-view` in localStorage;
console `viewMode('chase'|'street')`, `settings({ cameraView })`). Rides on the Falcon and the Eye keep
their own camera in either view. The rest of the renderer: rendering.md; the street camera's follow:
rendering.md Cameras and view.

## Where the camera stands (game state: chase-camera.js)

- `chaseCam` is game state, not the renderer's: position `x`, `y`, `z` (map units, `z` the elevation),
  the heading `viewYaw` (a map heading like `player.a`) and pitch `viewPitch` (radians below level) the
  lens looks along, the vertical lens `fov` (degrees) and the boom (`dist`, `wantDist`), round a pivot
  (`px`, `py`, `pz`: the shoulders on foot, above the middle of a vehicle). `updateChaseCamera` runs in
  `updateCameraFollow` every simulation step, so `simulate()` and the no-render test page move it.
- **The projection is the game's**: `chaseProject(x, y, z, out)` (screen px, depth, behind),
  `chaseRay(sx, sy, out)`, `chaseSees(x, y, z, r, insetPx, reach)` (inside the frustum),
  `chaseAimPoint(out, sx, sy)` (the first person or vehicle near the reticle's ray, else the ground,
  else 70 m out) and `chaseAimHeading(from)`. chase-view3d.js copies the same numbers into a
  three.js PerspectiveCamera (`chaseCamera`); never place that camera any other way, or the game's
  rules (what is on screen, where the aim points) and the picture disagree.
- On foot (`CHASE_FOOT`): 3.5 m boom, 0.42 m over the right shoulder, 52° lens; the right mouse
  button (LT on a pad) aims over the shoulder (`CHASE_AIM`: 1.85 m, 0.66 m, 44°) with `aimBlend`.
  The camera turns only when the player looks round, except that it eases behind a run after two
  seconds without looking. In a vehicle (`chaseShapeFor`): the boom by the vehicle's length, a
  critically damped heading spring after the way it goes (`chaseVehicleHeading`: the nose, blending to
  the velocity in a slide), the pitch following the slope, the lens widening 7° and the boom 12% with
  speed. Looking round in a vehicle (`lookYaw`, `lookPitch`) eases back `CHASE_LOOK_RETURN` s after the
  last look. Getting in or out is a HAND-OVER: the pivot slides over `CHASE_HANDOVER` s, the heading
  and pitch carry on (no snap); a teleport or a switch of view (`resetChaseCamera`) starts it behind.
- Walls: the boom is marched against building footprints and heights (`chaseBoomReach`,
  `chaseInsideBuilding`); it comes in at once and backs out at ~4 m/s. CLOSE QUARTERS: a boom a wall
  cut shorter than 1.6 m cranes the camera up to 0.55 m over the head (`CHASE_CRANE`, eased; never
  while aiming), so the head drops out of the frame. The camera never goes below the ground or the
  water (`chaseFloor`), and then looks down at the shoulder instead.
- MOTION COMFORT (`motionComfortOn()`): the lens and boom do not change with speed, the heading spring
  is slower, no auto-follow on foot, and the renderer takes 0.12 of the kicks and tremor (none with
  comfort on, as in the street view).

## Input

Mouse (pointer lock, CURSOR LOOK), LOOK BEHIND, pad, touch and the camera-relative movement keys:
chase-view-input.md.

## Drawing it (chase-view3d.js)

- `updateChaseView` runs in `render()` after `updateFlightView` and before the ride camera, sets
  `camera = chaseCamera` and `chaseViewActive`. `flightViewActive` keeps meaning "in the air".
- Draw distance `CHASE_DRAW` by tier; the haze (aerial-perspective fog) closes over the far part of
  it so the far clip is never seen. The haze's colour and height falloff, the sky, the clouds from
  below and the sun glare: rendering-sky.md and rendering-clouds.md.
- Culling: `viewCenter` / `viewReach` hold the box round the visible wedge; scenery cells and loose
  statics are also tested against the frustum (`chaseCellShown`), keeping cells within
  `CHASE_SHADOW_KEEP` behind the camera, whose buildings shade the street in front of it.
  `chaseZoomAt(x, y)` is the street zoom a thing is drawn at (for LOD switches tuned on the street
  view: vehicle impostors, small statics).
- CHASE SHADOWS: the sun's shadow box is fitted to the bounding sphere of the frustum's slice out to
  `CHASE_SHADOW_REACH` (one size whatever way the camera turns, centre snapped to texels), and lit
  materials fade the shadow out over the last part of that depth (`cityShadowFade`, the
  `cityShadowReach` uniform in `cityLightUniforms`; 0 in the other views: no fade there).
- Level of detail (far cells drawn from the far copy, shadow casters and proxies, small props and
  pools, people and vehicles by distance): rendering-chase.md.
- The reticle (chase-hud.js, chase-view.css): on foot with a gun; red over a target, a flash on a
  shot, a ring while aiming. LOCK-ON (Settings · Gameplay · Aim assist, on by default): aiming with a
  threat within 0.3 rad of the reticle and 70 m turns the camera onto their chest and holds it; a clear
  look (mouse, stick) breaks it to free aim; passers-by never lock (`chaseLockOn`, `updateChaseLock`). `body.chase-locked` hides the cursor while the pointer is captured.

## Game rules in the chase view (chase-rules.js)

- In view (`crowdInView`, so every caller; `beachInView`, the wreck limit): the frustum within
  `CHASE_SIGHT_REACH` (200 m), the margin a world radius; per entity, no building march.
- Spawn spots (`spotUnseen(x, y, margin, SPOT_*)`; exactly `!crowdInView` in the street view): off the
  frustum turned out `CHASE_SPAWN_TURN` either side, or hidden behind a building from everywhere the
  camera can swing to. The crowd and traffic streams lean their centre up the camera's heading.
- Fire (`shooterInView`): chest in the frame, within `CHASE_FIRE_REACH` (150 m), not behind a building.
- Aim: `aim()` is `chaseAimHeading` for every device (`chaseAim`); the soft lock, drive-by, tank,
  mounted guns, Apache and volleyball follow the reticle. HUD: `hudPlayerBox` projects the box corners.
- Details where each rule lives: police-and-combat-ammo.md (ON-SCREEN RULE), people-and-crowd-living-
  city.md (streams, wrecks), police-and-combat-driveby.md, ui-and-settings.md (card clearance).
  Console `viewRules(x, y, margin)`, `viewPopAudit(seconds, keys, turn)` (what pops into view: keep 0).

## Gotchas

- Anything that asks "is this on screen" or "where does the aim point" must ask the chase camera when
  `chaseCameraLive()` (shooterInView, crowd and traffic spawning, the wreck limit, the HUD's player
  box, the aim): never `cameraTarget` and the street footprint alone; the helpers are in chase-rules.js.
- `chaseCameraLive()` is false on the coaster and the Eye (the ride camera draws), and `chaseCam.ready`
  is false for the first step after a reset: the renderer keeps the street camera until it is placed.
- Console: `viewMode`, `chaseCamera()` (with the renderer's `view`), `chaseLook(dx, dy, headingDeg,
  pitchDeg)`, `chaseProject(x, y, z)`. Tests: tools/tests/chase-*.mjs.
