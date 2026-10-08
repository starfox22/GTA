# The sun and its shadows move gradually
- Dawn and dusk: the shadows no longer swing round in a quarter of a minute as the light hands over between the
  sun and the moon. The swing is spread over 90 game minutes and the shadows fade softly while it turns
  (it was ~100 degrees in 16 game minutes at dawn, 11.7 degrees a second at its fastest; now under 1.7).
- A time skip (sleeping, a meal, a change of clothes, the god panel's time, a mission setting the hour, a ride
  skip) no longer snaps the light: the sun, sky and shadows ease over to the new hour in 2-6 seconds.
- Internals: the sun path is game-side math (sun-path.js `sunPathAt`); the renderer draws the light clock
  (`litMinutes`, `litDaylight`), stepped on the frame clock by `stepSunClock`.
- Console: `sunReport(skipMinutes)`; test tools/tests/sun-gradual.mjs.
