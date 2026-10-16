# Separate rider weight from acceleration and braking

- Settings · Controls · Vehicles now lists independently remappable Wheelie up / lean back
  and Wheelie down / lean forward, defaulting to ↑ and ↓. Forward and Back default to W
  and S. Only exact saved old movement defaults migrate; custom bindings remain intact.
- Keyboard, gamepad and touch send distinct rider-weight actions. Up does not accelerate;
  Down does not brake or release W. Pad RT/LT and touch GAS/BRAKE remain separate controls.
  Help, boarding notices, the bike HUD and device hints name the rider controls.
- Aircraft keep ↑/T and ↓/G. Separate canopy glide/flare bindings preserve parachute arrows
  alongside W/S, with matching canopy animation inputs.
- `wheelie-bindings` exercises production control migration, physical keys, device inputs,
  context aliases, remapping persistence/key swaps and settings/help rows in 61 host assertions.
