      // BEGIN SUBSYSTEM: src/sealife3d.js — Sea life meshes
      /**
       * Sea life meshes
       * Source: src/sealife3d.js
       * Scope: createCityRenderer() closure (included after wakes3d.js: it draws
       * foam rings into the wake map and uses its spray light).
       *
       * MODELS: three procedural models built once at real size (a 2.6 m
       * bottlenose dolphin, a 5 m great white, a herring gull with a 1.4 m span),
       * lofted from cross sections with fins triangulated from outlines, painted
       * in vertex colours (the dolphin's dark cape, grey flanks and pale belly;
       * the shark's slate back sharply over a white belly, five gill slits and a
       * black eye; the gull's white body, grey mantle and black wingtips with
       * white mirrors). Each species is ONE InstancedMesh; the animation is done
       * in the vertex shader from a per-instance vec4 (`iAnim`), so the CPU only
       * writes a matrix and four numbers per animal:
       *   dolphin  dorso-ventral body wave (the flukes beat up and down)
       *   shark    lateral tail sweep; the jaw drops and the snout lifts as the
       *            mouth opens on the mouth cavity and two rows of teeth
       *   gull     wingbeat about the shoulder with the hand lagging, folding
       *            back along the body when perched; legs only when perched
       * Gulls cast shadows (a depth material with the same deformation).
       *
       * UNDER THE SURFACE: the sea is opaque, so what swims under it is drawn
       * into a small LIFE MAP round the view (the same meshes, top down, with a
       * shader that writes how dark each point of the body makes the water:
       * strong just under the surface, fading with depth) that the water shader
       * (world3d.js) darkens its body colour with. Blood clouds go into the same
       * map's green channel and tint the water red.
       *
       * SURFACING: splashes, blows and the breach throw lit water particles (one
       * Points object, white spray, mist, red spray), foam rings and splash foam
       * are drawn into the wake map (wakes3d.js), and a fin or a dolphin at the
       * surface leaves a wake through `wakeEmit`.
       *
       * HUD: `drawSealifeOverlay3D` draws the SHARK! warning and the arrow to the
       * fin over the view.
       */
      // @include src/sealife3d-models.js
      // @include src/sealife3d-effects.js
      // END SUBSYSTEM: src/sealife3d.js
