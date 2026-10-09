# Downloaded aircraft and dog

- A second civil helicopter, the SKYRANGER 429 (a Bell 429 model): parked on two office-roof helipads and at
  Southport, flown like any helicopter, in five civil schemes; its rotor reaches as far as the real one.
- The SKYLARK 172 (a Cessna 172 model): three flyable light aircraft on Southport's GA apron with moving ailerons,
  flaps, elevators, rudder and propeller; fixed gear.
- Street dogs are a real Labrador model now: trotting, standing, sniffing and sitting, in every coat colour, still
  on their leashes.
- Internals: tools/aircraft_models.py (assets/aircraft-models.bin, aircraft-skin.webp), tools/dog_model.py
  (assets/dog-model.bin), aircraft-assets3d.js, civil-helicopters.js, dog3d.js; HELICOPTER_AIRFRAMES `bell429`,
  AIRFRAME_SPECS `skyhawk` (`fixedGear`), `rotorRadius`/`rotorX` in rotorStrikes.
- Console: `aircraftAssets()`, `aircraftAssetsOn(on)`, `civilHelicopters()`, `dogModel()`, `dogModelOn(on)`,
  `dogLineup()`; `drive()` takes helicopter airframes; `helicopterLineup` shows `bell:<scheme>`.
