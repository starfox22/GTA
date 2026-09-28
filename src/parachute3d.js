      // BEGIN SUBSYSTEM: src/parachute3d.js — Ram-air parachute
      /**
       * Ram-air parachute
       * Source: src/parachute3d.js
       * Scope: createCityRenderer() closure (after render3d.js's person models).
       *
       * The player's parachute (player.parachute, parachute.js) drawn as a modern
       * ram-air wing rather than a dome:
       *
       *  - Canopy (canopy): nine cells, each its own strip of the upper and lower
       *    skins so the panel colours stay crisp; an airfoil section (open cell
       *    mouths along the leading edge, a thin trailing edge), pillowed upper skin
       *    between the ribs, an arched span and closed side stabilisers. It is
       *    rebuilt on the CPU each frame (about 2,300 vertices, only while it is in
       *    the air), so it can pressurise cell by cell, breathe, flog and flutter,
       *    and pull its tail down with the brakes. In cloud the rig is lit by the
       *    cloud around it (chuteCloudLit: flat, dim, diffuse) rather than the sun.
       *  - Rigging (rigging): four groups of suspension lines from the ribs through
       *    the slider's grommets to the four risers, brake lines from the tail down
       *    the rear groups, the bridle from the canopy's top through the bag to the
       *    pilot chute. Every line is a polyline (it can bow, whip and go slack) in
       *    one LineSegments. The slider is a small billowing sheet of cloth.
       *  - Deployment, stage by stage (player.parachute.phase / phaseK, the
       *    DEPLOYMENT of parachute.js, about 4.7 s from terminal speed): pilot, the
       *    right hand goes to the pouch and throws the pilot chute, which inflates
       *    in the burble and climbs on its bridle; lines, the bag lifts off the
       *    container and the lines whip out of their stows behind it, lifting the
       *    shoulders; snivel, line stretch snatches the body upright and the canopy
       *    comes out of the bag as a flogging, streaming bundle held closed by the
       *    slider at the top of the lines while the centre cells pressurise, nose
       *    first; snap, the slider runs down the lines, the wing spreads from the
       *    centre out (the end cells fill last, the span overshoots and settles) and
       *    the jumper swings under the wing. The bag stays on the bridle under the
       *    pilot chute, which the kill-line then collapses.
       *  - Flight: the jumper hangs under the wing on a pendulum driven by the rig's
       *    own accelerations: the canopy leads as it starts to fly, drops back on
       *    its deployment brakes (tails half down) and surges ahead when they are
       *    unstowed; turns bank the whole rig into the turn and pull one toggle
       *    down, the flare slows the wing and swings the jumper forward under it.
       *  - Freefall: a belly-to-earth box position with the pack closed on the back.
       *  - After landing the canopy overflies the jumper, collapses onto the ground
       *    in front of them, lies a moment and is gathered up.
       *
       * poseParachutist(model) is called from the person pass for the player; it
       * poses the body and records the harness point that updateParachute3D()
       * hangs the wing from.
       */
      // @include src/parachute3d-canopy.js
      // @include src/parachute3d-pose.js
      // @include src/parachute3d-rigging.js
      // END SUBSYSTEM: src/parachute3d.js
