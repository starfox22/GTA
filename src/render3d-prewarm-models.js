      // PREWARM LISTS: the throwaway vehicles and the sample shadow casters the title-screen prewarm
      // builds, so each model's kit, shared materials and shader programs exist before first use.
      /**
       * A vehicle type seen for the first time builds its kit (a few dozen merged geometries) and
       * compiles the programs of its paint, livery and lamp materials: a hitch on the frame it
       * comes into view. `prewarmModelList()` lists one stand-in per model (every type in
       * VEHICLE_DEFINITIONS, each police look, helicopter look and airframe); the prewarm builds
       * one per step, compiles it against the scene's lights, and takes it out of the scene again
       * without disposing its materials, so their programs stay cached and the kits stay in their
       * caches (civKits and the like). The stand-ins are never in `vehicles`, `carModels` or the
       * scene when a frame is drawn. Only behind the title (render3d-resources.js).
       */
      function prewarmModelList() {
        const list = [],
          base = (type, extra) => ({ id: 1, type, color: VEHICLE_DEFINITIONS[type].color || '#808080', x: 0, y: 0, a: 0, ...extra });
        for (const type of Object.keys(VEHICLE_DEFINITIONS)) {
          if (type === 'police')
            for (const [body, livery] of [['charger', 'bw'], ['utility', 'bw'], ['crownvic', 'bw'], ['charger', 'modern'], ['utility', 'modern'], ['crownvic', 'sheriff'], ['charger', 'unmarked']])
              list.push(base(type, { policeLook: { body, livery } }));
          else if (type === 'helicopter') {
            for (const heliLook of ['police', 'news', 'executive', 'civil', 'military']) list.push(base(type, { heliLook }));
            for (const airframe of Object.keys(HELICOPTER_AIRFRAMES)) list.push(base(type, { airframe }));
          } else if (type === 'plane') for (const airframe of Object.keys(AIRFRAME_SPECS)) list.push(base(type, { airframe }));
          else list.push(base(type, null));
        }
        // The agents' SUV and the SWAT truck are police looks on the 'suv' and 'van' types.
        list.push(base('suv', { policeLook: { body: 'tahoe', livery: 'unmarked' } }), base('van', { policeLook: { body: 'bearcat', livery: 'swat' } }));
        return list;
      }
      /**
       * Shadow depth programs are made the first time a caster of their kind is drawn into the
       * shadow map: one per combination of side (an umbrella or a hedge is double-sided), alpha
       * cut-out and instancing. These samples have one of each; drawn once with the shadow pass
       * on (render3d-resources.js, uploadMeshes) they compile the lot. Empty without shadows.
       */
      function prewarmShadowSamples() {
        const samples = [],
          geometry = new Three.BoxGeometry(1, 1, 1),
          cutout = new Three.CanvasTexture(document.createElement('canvas'));
        for (const side of [Three.FrontSide, Three.BackSide, Three.DoubleSide])
          for (const alpha of [false, true]) {
            if (alpha && side === Three.BackSide) continue;
            const material = new Three.MeshStandardMaterial({ side, map: alpha ? cutout : null, alphaTest: alpha ? 0.5 : 0 });
            samples.push(new Three.Mesh(geometry, material));
            const pool = new Three.InstancedMesh(geometry, material, 1),
              tinted = new Three.InstancedMesh(geometry, material, 1);
            tinted.setColorAt(0, new Three.Color());
            samples.push(pool, tinted);
          }
        for (const mesh of samples) mesh.castShadow = mesh.receiveShadow = true;
        return samples;
      }
