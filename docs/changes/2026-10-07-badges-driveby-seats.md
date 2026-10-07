# Badges on every vehicle, the drive-by gun where the bullet leaves
- Police cars read POLICE (SHERIFF in the county) across a marked trunk and their model on the right (PURSUIT,
  INTERCEPTOR, UTILITY, COMMAND); motorbikes carry their maker on both tank or fairing sides; the 4x4 club trucks their
  maker on the tailgate; the box truck ATLAS, the ambulance PARAMEDIC and the bus a lit METRO sign on their tails; the
  flatbed ATLAS on the cab's back wall; the army's jeep, LAV-8 and trucks a cream stencil. No draw call added anywhere.
- Drive-bys from any car the cabin seats people in fire from the drawn gun: the game takes the model's own seat
  (low and laid back in supercars, the police bodies' own) and keeps the grip within the arm's reach.
- Internals: driveby-seats.js (DRIVEBY_SEATS recorded from carSeatPlan, policeLookChoice, driveByReachClamp);
  police and club trims read the trim atlas; military marks share one texture with the stars.
- Console: `carBadges()`, `driveBySeatReport()`; `cabinHeadroom()` reports `seat` / `gameSeat` / `seatGap`.
- Tests: driveby-seats (suite); rear-badges and cabin-headroom extended (rendered page).
