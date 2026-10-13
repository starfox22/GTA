# KR 500 model, straight motorbike wheels, wheelie hint

- The KR 500 enduro is now a downloaded, detailed dirt-bike model (CC-BY, credited): spoked wheels, knobbly tyres,
  long-travel fork, orange plastics with white and black graphics (a respray still recolours the plastics).
- Motorbike wheels no longer wobble while riding: the VORTEX 900's and NOMAD CRUISER's source models came with their
  bars and front wheel turned, so the front wheel spun about an axle that was not its own. They are turned straight;
  fork feet, brake calipers and chain links no longer spin with the wheels, the front fender, fork feet and levers
  turn with the steering, and the stands modelled down are gone.
- RANGER 4X4 and the Sheriff/patrol SUVs: a strip of the wheel arch no longer spins round with each wheel; off road
  every car's wheels now follow their springs (ride-wheels3d.js) instead of sinking into rocks or hanging in the air
  while the body pitches and rolls (the 4x4 club trucks already did).
- First rides on a motorbike that can wheelie show a short hint in the device's own names ("WHEELIE · HOLD W + ↑ to
  lift the front"; RT + L-STICK ↑ on a pad; GAS + STEER ↑ on touch), up to three rides a session until one is pulled.
  On touch the steering stick pushed well up is now the climb action on a two-wheeler (as the pad's left stick).
- Internals: tools/vehicle_models_moto.py `unsteer`, `fork`, `barsWide`, `dropBox`, `grip`, `baseColor`, `paintTex`,
  whole-piece wheel rule; tools/vehicle_models.py wheels stop at the tyre's inner wall; `wheelieState().hint`;
  tools/tests/wheelie-hint.mjs.
