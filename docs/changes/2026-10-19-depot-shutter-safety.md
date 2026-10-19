# Warehouse shutter safety

- Vinny's warehouse shutter now stays open when a long vehicle straddles the doorway,
  even when both bumpers and all four corners are outside its safety strip.
- Preserve the existing reversing-vehicle prediction, pedestrian safety and pursuing
  police push-back. Regression coverage checks the production controller and 3,360
  independent vehicle/door polygon overlaps.
- Normal police and SWAT arriving from wanted dispatch also yield to the shutter;
  they could previously hold it open indefinitely and prevent the delivery. Wrecks,
  idle, stolen and crewless cruisers and the player's car still keep the safety edge open.
