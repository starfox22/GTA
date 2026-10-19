# Preserve NPC dodge distance across crowd update rates

- Integrate the existing fading leap speed over each elapsed interval, including a step that crosses
  the leap's end. A default dodge now covers its intended 15.75 units at visible and off-camera cadences.
- Preserve reaction choices, panic/backward outcomes, RNG, directions, durations and collision rules.
  Production-host checks cover trajectory samples and thin-wall, vehicle, overlap-escape and swept-contact
  behavior. Coarse actor scheduling is unchanged; this does not claim the separate live-world awareness
  clearance-rate fixture now passes.
