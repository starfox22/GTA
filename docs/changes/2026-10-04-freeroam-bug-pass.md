# Free-roam bug pass: a clear view of the player, rides that let go
- The mission card never covers the player: on a small window a bus or a fast car heading up the screen sits
  centre-low, and the open INCOMING CALL card covered it. The card now folds to its one-line strip while it would,
  and opens for the rest of its reading time once the player is clear (O still opens it on purpose). Mission
  dialogue sits just above the card as it stands, so it drops with it, and between the minimap and the equipment
  column (it ran over both, and over the card, on a 600 px window); with no room for both, the card folds for it.
  The waypoint pill fades when a long vehicle heading down the screen reaches it.
- Short windows (960x600): the open car radio no longer reaches down over the speed box (it opens upward from just
  above it); a long notice no longer runs under the waypoint pill.
- Touch (tablets): getting in a car no longer opens the radio over the GAS / BRAKE buttons for 4 s (it flashes its
  chip, as on phones), and the chip no longer sits on the weapon chip.
- Restarting a job while riding a CITY RAIL train no longer pulls the player straight back aboard (any move of the
  player now ends the ride).
- Internals: src/hud-clearance.js (`hudPlayerBox`, `missionCardFolded`, `measureMissionCard` with the dock line);
  `dropTransitRide()` (transit-network.js) from `teleportPlayer`; the console's `drive()` ends a cab ride first.
- Console: `hudClearance(action)`, `hudOverlaps(slack)`. Tests: hud-clearance, hud-layout (no HUD overlaps at
  960x600, keyboard and touch), restart-carriers (train and cab), world-edge (integrity while WASTED out there).
- Bot: a wanted player turned away at a door is no longer a "rebind" finding.
