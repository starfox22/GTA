# Aircraft engine families and positional sound

- The SKYLARK 172 now has a four-cylinder piston engine and two-blade propeller sound, replacing its incorrect jet voice. The courier retains its turbine/four-blade propeller; the business jet and larger airliner have distinct turbofan voices.
- Engine pitch and load follow actual spooled power. Runway rumble ends after lift-off; abandoned airborne planes have positioned sound with elevation, relative-motion Doppler, occlusion and camera-relative pan.
- The fixed-wing pool reuses at most four voices through the existing engine/master volume and mute controls. `engineSound().aircraft` reports their profiles and parameters.
- Added 60 production-function host assertions, failing-before/passing-after evidence and six small actual Web Audio graph listening previews in the October 15 aviation audit.
- Visual C172/courier propeller RPM now matches the sound, with blade-count-aware blur and smooth stop/start. A further 22 host assertions run the actual animation and preserve jet-fan behavior.
