# Bullet holes stay on the panels of downloaded cars

- Close up, a bullet hole on a downloaded car no longer hangs half over a panel seam or edge (the hood's gap, a door
  line): it goes on to the panel, shrinks or is hidden as on the procedural bodies.
- damage3d-marks.js: the ring check (`markRingHolds`) samples 16 points on the decal's own axes and roll (`markRoll`)
  in its lifted plane, instead of 8 points in a fixed world frame that a thin seam could pass between.
