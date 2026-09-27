      // BEGIN SUBSYSTEM: src/clouds3d.js — Volumetric clouds and cloud shadows
      /**
       * Volumetric clouds and cloud shadows
       * Source: src/clouds3d.js
       * Scope: createCityRenderer() closure (included after weather3d.js).
       * A cumulus layer high above the city (600-950 m), ray-marched through 3D noise
       * and lit by the sun, and the shadows those same clouds throw on the streets.
       *
       * The layer only exists where it would in life: well above the rooftops. From the
       * street you never see it, only its shadows drifting over the city and the light
       * dimming as one crosses you. You first meet it from an aircraft: wisps slide past
       * as you climb towards the base, you fly through the gaps (or into the murk under
       * an overcast), and above the tops you look down on sunlit cloud with the city
       * showing through the breaks.
       *
       * How it is drawn (WebGL2 only; on WebGL1 the sky simply stays clear):
       *   1. Once, at start-up, a 64^3 tiling noise volume (Perlin-Worley shape plus
       *      Worley detail) is rendered on the GPU into a 3D texture.
       *   2. A coverage map (128^2, CPU, histogram-equalised so `coverage` really is the
       *      fraction of sky with cloud in it) says where clouds may form; weather.cloud
       *      sets the coverage and the wind carries the whole field.
       *   3. Each frame the flight camera is above the cloud base, a full-screen pass at
       *      half resolution marches every view ray through the slab: Beer-Lambert
       *      extinction, a short march towards the sun for self-shadowing, a two-lobe
       *      phase function, sky and ground ambient, city glow under the base at night,
       *      and the scene's distance haze. It writes premultiplied colour + coverage.
       *      Cloud is also thinned in a pocket around the aircraft, so flying inside
       *      the layer shows walls of cloud and the ground below, not a white-out.
       *   4. That image is composited behind the player's aircraft: a camera-facing
       *      quad at the aircraft's depth, so the aircraft always draws over the cloud
       *      beyond it, while cloud between the camera and the aircraft is cut away
       *      (a chase camera must never lose its subject in the murk, and a veil over
       *      the whole frame is exactly the milky look this replaced).
       *   5. A second quad writes depth where the cloud is thick, so transparent effects
       *      on the ground below do not shine through it.
       * Cloud shadows are a plane just above the tallest roof that, for every pixel,
       * follows the view ray down to the ground and samples the same density field
       * along the sun direction. Everything under it (streets, cars, people, low
       * aircraft) darkens together.
       */
      // @include src/clouds3d-field.js
      // @include src/clouds3d-march.js
      // @include src/clouds3d-shadows.js
      // @include src/clouds3d-frame.js
      // END SUBSYSTEM: src/clouds3d.js
