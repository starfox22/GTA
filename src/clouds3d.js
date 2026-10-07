      // BEGIN SUBSYSTEM: src/clouds3d.js — Volumetric clouds and cloud shadows
      /**
       * Volumetric clouds and cloud shadows
       * Source: src/clouds3d.js
       * Scope: createCityRenderer() closure (included after weather3d.js).
       * A cloud layer over the county, ray-marched through 3D noise and lit by the sun,
       * the shadows those same clouds throw on the streets, and what a camera flying or
       * falling through them sees.
       *
       * Where the layer is comes from the game (clouds.js): cloudBaseAt/cloudTopAt by
       * weather and area, from ~400 m on a clear day down to ~300 m under an overcast
       * and ~250 m in a storm, lower over the sea and much lower over the Ridgeline in
       * the wet, a little higher over the city. From the street you never see it, only
       * its shadows drifting over the city and the light dimming as one crosses you.
       * From an aircraft you meet it at a few hundred metres: wisps slide past, you fly
       * through the gaps (or into the murk under an overcast), and above the tops you
       * look down on sunlit cloud with the county showing through the breaks. Falling
       * through it on a jump, the tops rush up, the jumper sinks into the white, rags
       * whip past the lens and bead on it, and the ground opens up again under the base.
       *
       * How it is drawn (WebGL2 only; on WebGL1 the sky simply stays clear):
       *   1. Once, at start-up, a 64^3 tiling noise volume (Perlin-Worley shape plus
       *      Worley detail) is rendered on the GPU into a 3D texture; the game's coverage
       *      map (where cloud may form, drifting with the wind) and area map (sea,
       *      mountain and city weights, the ground) become 2D textures (field).
       *   2. Each frame the flight camera is above the lowest cloud, a full-screen pass at
       *      half resolution marches every view ray through the slab beyond the subject:
       *      Beer-Lambert extinction, a short march towards the sun for self-shadowing
       *      and the cloud above in the column, a two-lobe phase function, sky and ground
       *      ambient, city glow under the base at night, and the scene's distance haze.
       *      Rays stop at the hills (the area map's ground) and at the tallest towers'
       *      boxes, so a peak or a crown standing in the cloud fades into it with depth
       *      and cloud behind it never draws over it. An aircraft keeps a pocket of clear
       *      air round it (walls of cloud, the ground below); a jumper does not (march).
       *   3. That image is composited behind the subject: a camera-facing quad at its
       *      depth, so the aircraft or the jumper always draws over the cloud beyond it;
       *      a second quad writes depth where the cloud is thick, so transparent effects
       *      on the ground below do not shine through it (march).
       *   4. The stretch between the camera and the subject is the veil: marched the same
       *      way and drawn over everything, with a soft cap so the subject stays readable
       *      (near). Rags stream past the lens with the camera's motion (wisps), water
       *      beads on the lens in cloud (lens, in the post composite) and the frame greys
       *      out while the camera is inside (frame).
       * Cloud shadows are a plane just above the tallest roof that, for every pixel,
       * follows the view ray down to the ground and samples the same density field
       * along the sun direction. Everything under it (streets, cars, people, low
       * aircraft) darkens together.
       */
      // @include src/clouds3d-field.js
      // @include src/clouds3d-march.js
      // @include src/clouds3d-near.js
      // @include src/clouds3d-wisps.js
      // @include src/clouds3d-shadows.js
      // @include src/clouds3d-frame.js
      // @include src/clouds3d-sky.js
      // END SUBSYSTEM: src/clouds3d.js
