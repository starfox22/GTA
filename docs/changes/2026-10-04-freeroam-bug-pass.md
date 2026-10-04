# Free-roam bug pass: a clear view of the player, rides that let go
- The mission card never covers the player: on a small window a bus or a fast car heading up the screen sits
  centre-low, and the open INCOMING CALL card covered it. The card now folds to its one-line strip while it would,
  and opens for the rest of its reading time once the player is clear (O still opens it on purpose). The waypoint
  pill, the folded strip and a dialogue line fade when they would still cover the player (a long vehicle heading
  down or up the screen).
- Short windows (960x600): the open car radio no longer reaches down over the speed box (it opens upward from just
  above it); a long notice no longer runs under the waypoint pill, nor a dispatch caption under the notices (it
  wraps, at 1440x900 too).
- Touch (tablets): getting in a car no longer opens the radio over the GAS / BRAKE buttons for 4 s (it flashes its
  chip, as on phones), and the chip no longer sits on the weapon chip.
- Restarting a job while riding a CITY RAIL train no longer pulls the player straight back aboard (any move of the
  player now ends the ride).
- Internals: src/hud-clearance.js (`hudPlayerBox`, `missionCardFolded` beside `missionCardYields`, `measureMissionCard`);
  `dropTransitRide()` (transit-network.js) from `teleportPlayer`; the console's `drive()` ends a cab ride first.
- Console: `hudClearance(action)`, `hudOverlaps(slack)`. Tests: hud-clearance, hud-layout (no HUD overlaps at
  960x600, keyboard and touch), restart-carriers (train and cab), world-edge (integrity while WASTED out there).
- Bot and `integrity()`: a wanted player turned away at a door, a helicopter's own prompt after a teleport, a pilot
  killed past the world edge (WASTED out there until the respawn) and a bonnet over the quay's edge (the shore never
  stops the player's own car) are no longer findings. Test: integrity-shore.
