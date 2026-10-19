# Warehouse shutter safety

- Vinny's warehouse shutter now stays open when a long vehicle straddles the doorway,
  even when both bumpers and all four corners are outside its safety strip.
- Preserve the existing reversing-vehicle prediction, pedestrian safety and pursuing
  police push-back. Regression coverage checks the production controller and 3,360
  independent vehicle/door polygon overlaps.
