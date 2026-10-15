# Door transitions and planted exit feet

Door motion is covered in `vehicles-and-driving-doors.md`. This page covers the
player's short exit pose, which shares the ordinary crowd skeleton and the shipped
player mesh.

## Ground contract

`exitCar` places the player beside the vehicle at the real terrain floor.
`trackCarTransition` observes that change on a rendered frame; `specialSpec` then
requests the existing half-second `exitCar` pose. Its original crouch lowers the
hips while bending the legs. The hip drop was larger than the leg shortening, so
the shoes and lower pants passed through the ground midway through the exit.

`carExitFootTargets` in `carjack3d.js` supplies two cached world-space targets to
the existing `legTargets` inverse kinematics. It uses the actual compiled body
height/hip width, facing and actor/terrain floor. The pose keeps its original hip
drop, lean and timing; the knees adjust to put both shoes on the floor. Only the
existing exit-transition branch in `specialSpec` sets these targets. `resetSpec`
clears them on the next standing, entry or completed-transition frame; the seated
and drive-by plans are unchanged. No simulation fields or colliders change.

Targets allow 2.1cm above the collision floor for the source shoe's ankle/sole
offset and thin rendered ground overlays. Southport's runway surface is 1.5cm
above its collision floor. The actual shipped shoe vertices end about 1.56cm above
that collision floor, just 0.6mm above the runway; this is not a 2.1cm visible gap.

## Verification

`tools/tests/car-exit-feet.mjs` uses production `specialSpec` and pose targets. It
extracts the actual leg-target branch and pose-easing block from `crowd3d-draw.js`,
then uses production `solveLeg` and the existing player-body test's dual-quaternion
skinning on `assets/player-model.bin`. Assertions inspect every actual shoe vertex
rather than ankle targets alone.

The sweep covers 30 exit phases, four headings, two floor elevations, and both
direct targets and the real eased pose. All 395 shoe vertices must clear the
runway plane, and each foot must remain within 4cm of the collision floor. It also
checks cached target reuse, original pose targets and override clearing outside
the exit. The existing player-body test helpers are exported for reuse; its
assertions remain unchanged.

`verification/exit-feet-before.json` in the 15 October vehicle audit records the
actual before screenshots, source hashes and failing mesh measurements. At the
0.22s exit target, 393/395 shoe vertices were below the runway and the lowest sole
was 17.8cm below terrain; the eased pose reached 21.4cm below. These are CPU mesh
measurements, not claimed browser bone telemetry. `exit-feet-host.json` records the
corrected sweep and exact inputs. The final native GPU exit/settled screenshots
are recorded separately against their actual frozen HTML.
