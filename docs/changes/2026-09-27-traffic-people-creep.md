# Traffic no longer waits for ever behind a person in the road

- City traffic stopped for the same person (not the player) for 4 s eases round them at walking pace instead of queueing until they move.
- North Point Key visitors only stop for people in their own swath (not walkers at the lane's edge or on the pavement); one who stays gets a toot, then the car creeps round them.
- Console: `keyVisitors()` reports each visitor's `heldBy` and `waited`, and `handed` (the last car handed back to city traffic); `roofPoison()` gives the ambulance's `id`; new `vehicleById(id)`.
- Tests: drive-no-nan runs on the airport test track (city traffic took the bike out on a big screen); mission2-ambulance follows its own ambulance by id and walks out of sight; living-key retries when the Key's own spawner holds the start.
