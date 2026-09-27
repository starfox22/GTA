# Drive-bys: shooting from a vehicle

driveby.js (rules, the arm's state, the rear screen, the reticle), crowd3d-driveby.js (the
pose), the `spec.gunFrame`/`torsoTwist` hook in crowd3d-draw.js and crowd3d-poses.js
('riding'), `c.windowsDown` in damage3d-bodies.js. Console: docs/console/vehicles.md
(Drive-bys).

## Rules

- Only the pistol fires from a vehicle (`enforceVehicleHandgun`, combat-rules.js); tanks and
  the Apache keep their own guns and have no profile.
- **Left-hand drive**: traffic keeps right, so the driver sits on the left (`seat: -1`).
  Angles are off the nose, negative to the left (vehicle space: x ahead, y right).
- `spec.driveBy` (added to every `VEHICLE_DEFINITIONS` entry by `driveByDefaults`; a
  definition may carry its own, `null` = no drive-by) holds `body`, `seat`, `own`,
  `across` (degrees) and `rear` (`'glass'`, `'open'`, null). `driveByProfile(vehicle)`
  swaps in the `partition` body for law units (`policeLook`/`lawUnit`: the prisoner cage).
- Arcs (`driveByArcs`): own window 25-155 deg on the left (trucks 25-140); across the
  passenger seat out of the far window 52-125 deg (trucks 55-120); rear screen 155-205 deg
  only for `rear` bodies. **No shot forward through the car's own windscreen** (a
  one-handed driver would be firing through laminated glass at arm's length); once the
  windscreen is shattered (`damage.glass.front === 2`) the hole opens a +-25 deg arc.
  Roadster: over each door 20-165 / 35-150 and back over the deck (nothing to break).
  Riders (bikes, bicycles, jet ski): left hand, -170..+60 (never back through themselves).
  Boats: all round but the console screen ahead (+-20). Aircraft: `cockpit`, no rear.
- No rear shot: box truck, bus, ambulance (`box`), panel van (`bulkhead`), flatbed
  (`cabWall`), police (`partition`), supercar / Brutini / Cavalino (`engine`).
- **Aim clamp** (`driveByAim`): inside an arc fires as aimed; within `DRIVE_BY_SLACK`
  (17 deg) of an edge fires along the edge (a picked auto-aim target is then dropped);
  further out holds fire, `tell`s why once per 4 s (id `driveby`) and the reticle dims.
- The arm takes `DRIVE_BY_EXTEND` (0.26 s) to come out before the first shot (the pull is
  kept as `pending` and fires when it is out), goes back in (`DRIVE_BY_RETRACT`) to change
  windows and `DRIVE_BY_HOLD` (2.2 s) after the last pull. The side window it uses is wound
  down first and stays down (`c.windowsDown`, bumps `damageVersion`).
- The first shot through a `'glass'` rear bursts the screen (`breakRearWindow`:
  `shatterPane`, glass sound, `city3D.impact` glass; damage3d's `glassBurst` throws the
  crumbs).
- The bullet leaves from `driveByGrip(...).mx/my` (the muzzle out of the window, or inside
  the cabin for the passenger-side and rear shots) at the player's elevation as before;
  `city3D.fire(..., height)` puts the flash at the muzzle's height.
- Keyboard aim in a vehicle (`aim()`, no mouse or stick): `driveByAutoAim` takes the nearest
  threat inside the arcs, else straight out of the driver's window.
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
  windows do not show as down.
