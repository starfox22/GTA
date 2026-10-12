# Volumetric chase clouds and camera clearance

- Chase clouds have depth on every preset instead of Low/Medium's flat repeating slices.
- Distant formations use broader, decorrelated sampling to reduce the horizon grid; nearby field,
  cloud heights, top-down/flight rendering and existing cloud shadows retain their appearance.
- Clouds have explicit per-preset pixel/step budgets, lower-cost light on Low/Medium, wind-aware
  history reprojection and resets when weather or quality changes abruptly.
- The chase camera boom and close-wall lift respect canopy/deck slabs without treating the air
  underneath as a solid wall. Near-plane margin queries include adjacent cover-grid cells.
- Added cloud budget/history and cover-clearance regressions and browser comparison captures.
