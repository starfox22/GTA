# Map icons and GPS efficiency

- Bike-share icons stay visible at the minimap's edge and during driving pullback; zoomed and panned city maps skip icons outside their actual window, including room for an icon's outline.
- GPS nearest-road-node searches keep an ordered shortlist of 18 candidates instead of allocating and sorting a record for every graph node. Distance ties, visibility-probe order and fallback remain unchanged.
- Added `navigationAudit(samples)` and its regression for the generated world, plus `node tools/map-navigation-check.mjs` for browser-free visibility, tie and selection checks. Full simulation A/B hashes and browser captures are recorded with the combined review.
