# Parachute: a real deployment you have to time
- Pulling the ripcord no longer means an open canopy: the pilot chute goes out, the bag and
  lines pay out, the canopy snivels under the slider, then snaps open with a 4 g shock. From
  full freefall speed that takes about 4.5 s and 175 m; pulled right off a hovering
  helicopter about 3.6 s and 55 m. Pull too low and you meet the ground still fast.
- The freefall cue works from the real height the opening needs at your current speed:
  OPEN SOON, then OPEN NOW (still time for a full opening), then TOO LOW; it shows that
  height in metres, and after the pull follows the opening (stage, height left, seconds to
  fully open) until the canopy flies.
- The rig draws each stage: the throw, the pilot chute and bridle, the bag climbing the
  lines, the snivelling canopy, the snap and slider run; the jumper swings upright at line
  stretch and the view jolts on the shock. Each stage has its own sound.
- Until the canopy is open the jumper steers as in freefall, and a roof below is an impact.
- Console: `parachuteFallTo(target)`; `parachuteState()` reports the phase, load and where
  it opened. Test: tools/tests/parachute-deploy.mjs.
