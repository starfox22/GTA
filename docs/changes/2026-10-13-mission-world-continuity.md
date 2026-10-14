# Preserve the city through mission setup and ambulance recovery

- Dockside Favor no longer revives, heals or moves the ambient Harbor Kings when a job starts or is retried. Their damage and deaths persist under main's world-reset contract; the new job still creates its truck and three cargo crates normally.
- Answering Dockside Favor's payphone call no longer deletes police or their fired rounds already inside the harbor. An inherited wanted chase also keeps its ordinary pursuit rules there and its existing heat when the gate camera calls for cargo units; a clean introductory job keeps its normal cargo-dispatch hold.
- Vinny's depot cleanup now takes only job-owned or explicitly delivered vehicles. Ordinary parked cars and their crews, owned cars, aircraft and the player's current vehicle remain. Dockside Favor, Rush Hour, Repo Man and The Manifest tag successful deliveries so old job vehicles still leave the floor before later deliveries.
- Police crew deployment respects the sealed depot boundary, including SWAT rear-door exits. A cruiser outside the closed shutter can no longer place an officer inside simply because the foot spot past the shutter is clear. Crews already inside stay inside; the ordinary open-shutter approach still permits entry.
- Mission 2's blocked ambulance recovery checks both its current position and its stop against the camera before moving it. A player watching either endpoint no longer sees an ambulance disappear or appear instantly.
- Starting the rooftop job replenishes hotel limousines only into free bays. It no longer removes ordinary or owned vehicles left in a limo bay; initial hotel dressing also always preserves owned vehicles.
- Trying to touch the watched glass can no longer lower an already high suspicion meter. The existing 90-point warning ceiling still applies to a low-suspicion refusal; at 95, the failed attempt now leaves the meter at 95 instead of reducing it to 90.
- Tito Marchetti's rooftop patrol now stops above the DJ booth at (212, 286), rather than at (212, 296) inside its walking-clearance margin. The old waypoint made both adjacent patrol legs unreachable and left him standing at his initial post forever.

`tools/tests/mission-world-preservation.mjs` executes the production functions against
dead/wounded ambient gang members, mixed depot/hotel ownership and crew, inherited
police pursuit, sealed-shutter deployment, every rooftop patrol goal and cyclic leg,
watched-glass refusals and three visibility cases. The 27 failures reproduced on main
are covered by 69 passing assertions
after these fixes. These are focused fixtures, not end-to-end mission playthroughs.
