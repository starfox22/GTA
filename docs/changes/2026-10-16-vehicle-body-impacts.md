# Vehicle strikes launch people into the air

- Fast car strikes now launch the player and pedestrians into a shared gravity-driven flight, followed by a bounce, tumble, slide and animated get-up. Speed, corner contact and the vehicle's front height shape the launch.
- Fatal strikes keep moving through the air and land before their blood pool forms, including the player's WASTED screen. Walls and vehicles block flight; recovery waits while a car covers the casualty.
- Retained harmless walking-pace nudges and the separate downed second-pass rules; a second pass owns the casualty's recovery/death timing.
- Player first-hit damage now shares the existing pedestrian speed curve; landing and wall injuries still use the shared fall/rider scales.
- Added regression `vehicle-body-impacts` and named `vehicleImpactScene`, `vehicleImpactAdvance`, `vehicleImpactState` fixtures for deterministic flight, death and recovery checks/screenshots.
