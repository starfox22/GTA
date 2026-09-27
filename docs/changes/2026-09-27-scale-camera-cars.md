# Closer camera, real-size street furniture and rebuilt cars

- The street camera stands closer on foot (zoom 2.5, was 1.6): people read about 33 px tall
  at 1280x800 instead of 21. Getting into a car glides the view back to about the old framing
  (0.7 of the zoom), bikes, boats, buses and aircraft each frame at their own share, and the
  speed pull-back starts at 45 km/h. The wheel zooms in to 4.5.
- VOLT COUPE rebuilt as a real fastback: one arched roof from a raked screen to a ducktail,
  raised front wings, a shoulder crease, a painted roof with panoramic glass, slim LED lamps,
  a full-width light bar, twin-spoke wheels filling the arches.
- MULE VAN rebuilt as one rounded high-roof box (cab glass only), roof ribs, a swage line,
  rear-door windows and big black mirrors. RANGER 4X4 and WORKHORSE get a shoulder crease;
  the Ranger a painted roof with panoramic glass and silver rails, the Workhorse a bonnet
  dome, clearance lamps and a sliding rear window.
- Every other civilian car's roof now arches and its screen and rear glass curve.
- Hydrants, bollards and cones are drawn at real size (a traffic cone was twice as wide).
- Internals: `glass.crown` / `screenCurve` / `backCurve` (glassPoint, glassCrown), body
  `hoodHinge` and `doorTop`, SEC_CREASE / SEC_TALL_CREASE / SEC_VAN sections. Console
  `cameraView()`; test `camera-framing`. Scale table: docs/audit/scale-audit.md.
