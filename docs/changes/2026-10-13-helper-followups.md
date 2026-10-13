# Follow-ups: the Varga meeting on E, doors on long bodies, flat tyres, steadier tests

- The meeting with Varga at CIRRUS runs on the action key: besides each line, E now skips every beat where nobody
  speaks. GO UP WITH VARGA takes the lift from the pavement after the door talk, E cuts the ride short, SIT WITH VARGA
  from anywhere on the terrace puts both at his table under a fade, and SKIP AHEAD brings the waiter at once and
  moves the folder hand-over on. Pressing E repeatedly gets through the whole scene in about 12 s of game time.
- A car's front door (sprung in a crash, yanked open in a carjack, swung as the player gets in or out) is cut where the
  driver sits on every body: a van's, pickup's or truck's door is its cab's, no longer the middle of the body.
- A flat tyre keeps its flat spot at the bottom as the wheel rolls (it spun like an egg), on downloaded and procedural
  wheels and on motorbikes.
- Monarch One's roof helicopter is there from the start, not only after the first WASTED, BUSTED or new game (the
  roof helipads are chosen before the world is first populated, so boot and every reset bring the same entities).
- A pedestrian nudged at walking pace goes down beside the car, not in front of it: driving on no longer runs them
  over and turns the accident into a crime (it brought the stars back at a respray shop's door now and then).
- Tests: wheelie.mjs holds the real keys for the game time it needs (a loaded machine ran the page at a quarter of
  real time) and checks the real-key lift on every motorbike that can wheelie; sky-meeting-talk.mjs runs the whole
  meeting on real E presses; nudge-aside.mjs; carjack-traffic.mjs takes a car whose spot offers PULL OUT THE DRIVER
  (a bike-share dock by the junction rented a bike instead); respray-lose-police.mjs stops the car at the kerb.
- Console: `doorSwing(id, open)`; `carjackScan` lists `nearer`; `carModels(true)` cabins list `door`; `wheelieState()` reports the game clock `at`.
- Docs: world-and-map-shores.md, missions-summit-and-fort-kessler.md and missions-summit-and-fort-fort.md split out.
