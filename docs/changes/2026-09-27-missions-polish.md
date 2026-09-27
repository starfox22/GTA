# Missions 1 and 2: truck in view, bug pass
- Mission 1: Vinny's truck now waits at the north kerb of Armory St, nose west in the
  westbound lane, where the camera sees it; on the south pavement the tall block south of
  it hid it. When traffic or a double-parked van holds the spot it waits further along the
  same kerb instead of landing in the middle of the road.
- Mission 2: winning (or failing) before the ambulance arrives no longer leaves it circling
  back through Little Havana or idling in the lane: it pulls up and stays parked, and a
  replay clears the last run's ambulance from the stop instead of queueing behind it.
- RESTART CURRENT JOB and a mission pick no longer leave a helicopter you were flying
  hanging in the air; a pilotless helicopter with no way on no longer freezes mid-fall
  (after a death or a bail-out too).
- Mission 1's drop: a resprayed truck (no police) gets a calm line from Vinny and CLEAN
  GETAWAY at the back door instead of POLICE LOST.
- Exit hints for aircraft and boats, and mission 3's tracker stage, name the bound keys
  instead of J and E.
- Console: `retryMission()`, `chooseMission(i)`; `vehicleAt()` reports altitude.
  Tests: mission1-truck, mission2-ambulance, mission-retry.
