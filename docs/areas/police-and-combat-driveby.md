# Drive-bys: shooting from a vehicle

driveby.js (rules, the arm's state, the screens it bursts, the blocked-aim cross),
crowd3d-driveby.js (the pose), the `spec.gunFrame`/`torsoTwist` hook in crowd3d-draw.js and crowd3d-poses.js
('riding'), `c.windowsDown` in damage3d-bodies.js. Console: docs/console/vehicles.md
(Drive-bys).

## Rules

- Only the pistol fires from a vehicle (`enforceVehicleHandgun`, combat-rules.js); tanks and
  the Apache keep their own guns and have no profile.
- **Left-hand drive**: traffic keeps right, so the driver sits on the left (`seat: -1`).
  Angles are off the nose, negative to the left (vehicle space: x ahead, y right).
- `spec.driveBy` (added to every `VEHICLE_DEFINITIONS` entry by `driveByDefaults`; types
  registered later, hypercars.js and offroad-trails.js, get theirs on first use in
  `driveByProfile`; a definition may carry its own, `null` = no drive-by) holds `body`,
  `seat`, `sides` ([near, far] degrees off the nose for both side windows), `front`
  (`'glass'`, null) and `rear` (`'glass'`, `'open'`, null). `driveByProfile(vehicle)` swaps in
  the `partition` body for law units (`policeLook`/`lawUnit`: the prisoner cage).
- Arcs (`driveByArcs`), contiguous so the only gaps are blocked sectors: windscreen +-35 deg
  (`front`), side windows 35-145 deg (`left`/`right`), rear screen 145-215 deg (`rear`).
  **Cars shoot all round** (360). Bodies with no rear window (`box`: box truck, bus,
  ambulance, 6x6; `bulkhead`: panel van; `cabWall`: flatbed; `partition`: police; `engine`:
  mid-engined cars) have sides to 135 deg: **270 deg, the 90 deg straight back blocked**.
  Roadster: all round, back over the open deck. Riders (bikes, bicycles, jet ski): left hand,
  -180..+90 (never back through themselves on the right). Boats: all round. Aircraft
  (`cockpit`): side windows 30-150 only. Tanks and the Apache: their own guns.
- **Blocked aim** (`driveByAim` `blocked`, no clamp or slack): no shot, no arm, no message;
  `driveByShot` records `crossAt`/`crossRel` and `updateDriveByCross` (HUD, game-loop.js)
  shows `#driveByCross`, a small X along the aim a few metres past the body, for 0.5 s
  (projected with `city3D.project`, or the 2D view's transform). There is no aim line or
  ring (the old `#driveByReticle` was removed on the owner's request).
- The arm takes `DRIVE_BY_EXTEND` (0.26 s) to come out before the first shot (the pull is
  kept as `pending` and fires when it is out), goes back in (`DRIVE_BY_RETRACT`) to change
  windows and `DRIVE_BY_HOLD` (2.2 s) after the last pull. The side window it uses is wound
  down first and stays down until a repair (`c.windowsDown`, bumps `damageVersion`;
  `repairVehicle` clears it).
- The first shot through a `'glass'` windscreen or rear screen bursts it
  (`breakDriveByPane`: `shatterPane`, glass sound, `city3D.impact` glass; damage3d's
  `glassBurst` throws the crumbs; `repairVehicle`'s fresh damage puts it back).
- The bullet leaves from `driveByGrip(...).mx/my` (the muzzle out of the window, or inside
  the cabin for the passenger-side, rear and windscreen shots) at the player's elevation;
  `city3D.fire(..., height)` puts the flash at the muzzle's height.
- **Pointer aim at the wheel**: the driving keys do not hand the aim back to the keyboard in
  a vehicle (game-input.js; on foot they still do). They once did on every fresh press, so
  a shot aimed behind with the mouse left through the driver's window after any steering
  touch (the "can't shoot back" report; tools/tests/driveby-mouse.mjs).
- Keyboard aim in a vehicle (`aim()`, no mouse or stick): `driveByAutoAim` takes the nearest
  threat inside the arcs, else straight out of the driver's window.
- **In the chase view** the reticle (or the cursor while the pointer is free) is the aim for every
  device: `aim()` is `chaseAimHeading(player.car)` (chase-rules.js `chaseAim`, kept for the step), so
  the drive-by goes through the same `driveByAim` arcs and clamps toward where the camera looks (no
  `driveByAutoAim`); `driveByScreenPoint` and the cross use `chaseProject` (no cross while it lies
  behind the camera). tools/tests/chase-aim.mjs.
- There are **no NPC drive-bys** (the marine units and gun trucks are deck gunners and
  turrets). A future shooter in a vehicle must go through `driveByAim` with its vehicle.

## Pose (renderer)

- Drawn only while `driveBy.out > 0` (the seated driver is otherwise not drawn: the cabin
  glass is opaque). The rig sits with its hip joint on `driveBySeat` (belt - 0.42 m,
  1.4 m behind the windscreen foot, 0.2 x width left of centre), feet on the pedals, the
  free hand on the wheel rim turning with the steering.
- The pistol blends from the lap to `driveByGrip` (lifted over the sill), its yaw from the
  nose to the aim (the rear shot unwrapped past +PI so it swings round the right); the
  firing hand takes the gun's frame (as `drawHold`) and the arm reaches it by IK, so the
  elbow bends and the wrist follows the aim. Torso roll/twist and head yaw ease through
  the pose joints (no pops). Recoil: `player.recoilUntil` kicks the muzzle up and the hand
  back. Riders: `driveByRiderArm` swaps the left bar grip for the gun.
- The body frame is taken with the slope roll/pitch added, because render3d-frame.js adds
  them after `finishCrowd3D`.

## Gotchas

- `driveByAim` returns one shared object: read it before the next call.
- The side window uses the "empty frame" material, so a wound-down window and a burst one
  look alike; trucks and special bodies (`specialDamage`) have no per-pane glass, so their
  windows do not show as down, and their burst windscreen or rear screen shows only as
  the crumbs (the state is kept on `damage.glass`).
- Tests that aim with the real pointer: `driveByScreenPoint(relDeg, metres)` gives the
  viewport pixel, `t.mouse(x, y, {seconds, down, keys, taps})` (tools/test.mjs) moves it.
  Real-time holds need ~2.5 s: the headless page runs game time slower than the wall clock.
