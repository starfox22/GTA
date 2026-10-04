# Free-roam bug pass: a clear view of the player, rides that let go
- The mission card never covers the player: on a small window a bus or a fast car heading up the screen sits
  centre-low, and the open INCOMING CALL card covered it. The card now folds to its one-line strip while it would,
  and opens for the rest of its reading time once the player is clear (O still opens it on purpose). Mission
  dialogue sits just above the card as it stands, so it drops with it.
- Short windows (960x600): the open car radio no longer reaches down over the speed box (it opens upward from just
  above it); a long notice no longer runs under the waypoint pill.
- Restarting a job while riding a CITY RAIL train no longer pulls the player straight back aboard (any move of the
  player now ends the ride).
- Internals: src/hud-clearance.js (`hudPlayerBox`, `missionCardFolded`, `measureMissionCard` with the dock line);
  `dropTransitRide()` (transit-network.js) from `teleportPlayer`; the console's `drive()` ends a cab ride first.
- Console: `hudClearance(action)`, `hudOverlaps(slack)`. Tests: hud-clearance, restart-carriers (train and cab).
- Bot: a wanted player turned away at a door is no longer a "rebind" finding.
