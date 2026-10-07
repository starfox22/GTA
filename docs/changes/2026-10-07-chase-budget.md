# Chase view: fewer draw calls on every tier
- The chase view no longer draws the small things deep in the haze that nobody can see: a static group's
  small parts and glows, signs, small merged batches, a car's small parts and distant sparks and puffs step
  out by their size against their distance, more where the haze has taken most of their contrast (lights
  stay down to about a pixel at night, a car's lamps always). Royal Ave looking west: LOW 543 -> 474, MEDIUM 1304 -> 913, HIGH
  1461 -> 989, ULTRA 1553 -> 1117 calls (camera and shadow passes), with the same picture; about 18% less
  renderer CPU a frame at MEDIUM.
- Shadow pass: each batch, breakable or tree pool and prop is tested on its own box inside a cell that can
  cast; a small batch casts only within its size times the props' shadow distance.
- Console: `lookSwitches({ chaseBudget: false })` (the old rules in the same page, an A/B);
  `chaseCamera().view.props` counts parts and signs; `view.draws` has a size-on-screen band (`px<N`).
- Docs: areas/rendering-chase-budget.md.
