# Roof lifts, a clear 4x4 club gate, opening villa garages
- Every roof with a helipad or a parked helicopter (the office roofs, Police HQ, Monarch One) now has a lift: a steel
  lift door under a lit HELIPAD sign on the street, the roof's stair house up top; E rides it up or down with the
  same fade as North Point Key's towers.
- The bike-share rack that stood in the RIDGELINE 4X4 CLUB's gate lane has moved off it; racks keep out of vehicle
  entrances and drives from now on.
- Monarch Isle villa garages open: a roll-up door rises as you walk or drive up, a car waits inside, and it drives
  out down the drive and through the gate to the street. The door rolls down behind you. The six villas whose
  garage stood across the gate get a side gate, so the cars before the house can leave too.
- Internals: roof-lifts.js (`ROOF_LIFTS`, `b.roofLift`; the Key's ride now reads the lift's own fields),
  vehicle-entrances.js (`vehicleEntranceAt`), monarch-garages.js (`plan.garageDoor`, `plan.garageDrive`).
- Console: `roofLifts()`, `roofLiftVisit(id, where)`, `vehicleEntrances()`, `villaGarages()`. Tests: roof-lifts,
  club-entrance, monarch-garages.
