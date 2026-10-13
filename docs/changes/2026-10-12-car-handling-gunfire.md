# Realistic brakes, handbrake and reverse; cars survive pistol fire

- Brakes: the everyday fleet brakes like 1990s cars: a sedan stops from 100 km/h in about 46 m (0.86 g) and from
  50 km/h in about 12 m; trucks and the bus need much longer. The Prestige Collection keeps its modern brakes.
- Handbrake: the locked rear slides with real friction instead of skating: a handbrake turn at 50 km/h swings the car
  round and stops it in about 13 m, a straight pull slows at about 0.6 g and the tail wanders a little. No long glide.
- Reverse: the brake key brakes the car to a standstill, then reverse engages a quarter of a second later; it never
  jumps into reverse while rolling. The throttle while rolling backwards brakes first. Reverse tops out at 25 km/h.
- Tyre grip eases off past the slip-angle peak instead of collapsing, so slides scrub speed and end sooner.
- Gunfire on cars depends on calibre and where the rounds land: about 25 pistol rounds into the engine bay set a sedan
  on fire (doors and boot mostly take holes and lose glass); it smokes, smokes harder, burns, and only the engine fire
  sets off the tank after its countdown. Rifles need about 10; heavy machine guns and cannon wreck it outright;
  rockets and explosions are unchanged. Mission vehicles keep their armoured balance.
- Console: `reverseTest`, `vehicleDurability`, `gunfireTest`; `driftTest` reports `metres` and `stoppedAt`.
  Tests: tools/tests/vehicle-gunfire.mjs, brake-distances.mjs bands for the 1990s sedan.
