      // BEGIN SUBSYSTEM: src/base3d.js — Fort Sentinel meshes
      /**
       * Fort Sentinel meshes
       * Source: src/base3d.js
       * Scope: createCityRenderer() closure.
       * Draws the base planned in military.js (SENTINEL): its own detailed ground
       * sheet, double fences with razor wire, watch towers with searchlights, the
       * fortified main gate (animated drop arms, bollards and sliding gates), HQ,
       * barracks, mess hall, motor pool, hangars, control tower, fuel depot,
       * ammunition bunkers, comms mast, radome and radar, water tower, range,
       * obstacle course, parade ground and flags, sandbag nests, camouflage nets,
       * containers, generators, floodlights and CCTV; military vehicle models
       * (`makeMilitaryVehicle`); soldiers are dressed by the character rig (crowd3d.js OUTFITS).
       *
       * Static pieces go into one batched group (merged per material and cell).
       * Anything that moves is under a group flagged `userData.dynamic`. Night
       * light is additive: halos, beams and one merged mesh of ground light pools
       * (the city light map does not reach the county).
       */
      const baseGroup = new Three.Group();
      baseGroup.name = 'Fort Sentinel';
      scene.add(baseGroup);
      batchGroups.push(baseGroup);
      statics.push({ x: 9930, y: 8850, group: baseGroup, radius: 1450 });
      const baseDynamic = new Three.Group();
      baseDynamic.userData.dynamic = true;
      baseGroup.add(baseDynamic);
      // ---- Textures ------------------------------------------------------------------
      // @include src/base3d-materials.js
      // ---- Geometry helpers ---------------------------------------------------------
      // @include src/base3d-helpers.js
      // ---- Night light: ground pools (one additive mesh) and halos ---------------------
      const glowPools = [],
        baseHalos = [],
        blinkers = [];
      function glowPool(x, z, r, color = '#ffe2b0', strength = 1) {
        glowPools.push({ x, z, r, color: new Three.Color(color).multiplyScalar(strength) });
      }
      function baseHalo(x, y, z, size, color, kind = 'lamp') {
        const s = halo(baseDynamic, x, y, z, size, color);
        s.visible = false;
        baseHalos.push({ sprite: s, kind, phase: (x * 0.013 + z * 0.007) % 1 });
        return s;
      }
      function redBeacon(x, y, z, size = 3) {
        const m = mesh(sphereGeo, B.redLamp, baseGroup, x, y, z, size * 0.5, size * 0.5, size * 0.5);
        m.castShadow = false;
        baseHalo(x, y, z, size * 9, '#ff4a36', 'beacon');
        return m;
      }
      // ---- Ground sheet -----------------------------------------------------------------
      // @include src/base3d-ground.js
      // ---- Perimeter: double fence, razor wire, towers, CCTV, signs --------------------
      // @include src/base3d-perimeter.js
      // ---- Buildings -----------------------------------------------------------------
      // @include src/base3d-buildings.js
      // @include src/base3d-facilities.js
      /* ---- Per frame -------------------------------------------------------------------- */
      // @include src/base3d-frame.js
      /* ---- Military vehicle models ------------------------------------------------------ */
      // @include src/base3d-vehicles.js
      // END SUBSYSTEM: src/base3d.js
