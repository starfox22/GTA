# Motorcycle wheel axle, steering and tyre animation

- NOMAD CRUISER and KR 500 wheels roll around their measured source axles, removing the remaining sideways
  wobble after their bars had already been straightened. Wheel rest geometry, materials and normal handling stay intact.
- Front flat tyres lower and squash in an un-raked axle frame rather than slipping forward along the fork;
  nested fronts are identified correctly for damage. Repairing a burnt special vehicle restores its hidden tyres.
- Forks follow the tyre model's steering ramp; wheel roll follows braking lock, signed reverse and real rear
  wheelspin. Motorcycle wheels advance once per frame at their own radius.
- Mud/spray uses the bikes' actual body-space tyre contacts and widths; the front is no longer treated as driven.
- Low side gunshots can puncture motorcycle tyres; this was accidentally gated by the car glass-band check.
  Engine/body hits stay off the tyres; either side's hit is drawn and the one physical tyre is counted once.
- Added actual packed-mesh/production-function Three.js checks and an offline source-axle audit; constant rig groups
  add no draw calls and geometry normalization happens once per cached kit.
