# Streets and roofs from above: worn asphalt, real roof finishes, wall grime
- Roofs are drawn in world space at their true scale: membrane sheets with welded laps and repairs, gravel ballast
  thinned by the wind, tar roll roofing with mopped cracks and aluminium-painted flashings, clay tile rows, pavers on
  pedestals, sedum, ribbed metal with rust and roof lights; every flat roof has drains with a dished, silted sump and
  grime at the parapet's foot, and holds puddles that ripple in the rain (HIGH and ULTRA). Each building has its own
  tone and age.
- Working roofs: mushroom exhaust fans on curbs, galvanized duct runs on stands, plumbing vent stacks and conduit.
- Roads were laid in stretches of different ages with sealed joints; older stretches crack across (mostly sealed with
  tar), lane joints are sealed in runs, trenches and concrete-capped cuts patch them, oil strips run down the lanes and
  junction boxes are polished and oil-dripped. Zebras and stop lines carry tyre grime along the traffic.
- Pavements darken towards the foot of every wall; relaid slabs and utility covers break up the city's slabs.
- No new draw calls: one roof program (`cityRoof`) for every finish, roof plant in FRONT PAINT, wall grime baked into
  the city's ground sheet. Console `groundDetail().roofs` (finishes, buildings tinted, caps per finish).
