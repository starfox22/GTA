      // Car blood 3D: stains on a vehicle's bodywork, decal geometry clipped to the model's own surface and painted once per hit.
      /**
       * CAR BLOOD
       * car-stains.js keeps `c.stains` (plain records: where the person was struck,
       * how hard, the direction the blood is carried); this only draws them. One
       * stained car owns ONE mesh (child of `m.body`, so it rides the suspension
       * and the hood hinge), ONE material and ONE canvas
       * (thickness and run timing) shared by all its stains.
       *
       * Fitting: a stain is two "panels", a box aimed at the body. The TOP panel
       * looks down onto the bonnet, fender tops and windscreen base, the FACE panel
       * in at the bumper and grille (or a flank). Every triangle of the model's
       * visible meshes that falls inside a panel's box is clipped to it (Sutherland-
       * Hodgman), pushed 1 mm along its own normal and given the panel's UVs, so the
       * decal IS the bodywork (no floating, no sinking, it follows any body type),
       * and it is re-fitted when the crumple changes the shell (damageVersion /
       * shapeVersion). Surfaces another mesh covers (the bonnet panel over the shell)
       * are left out, so layers never z-fight. Where the two panels meet on a bevel
       * they trade weight by the vertex normal.
       *
       * Look: each stain is painted ONCE (carblood3d-paint.js), seeded by `seed`, as a
       * THICKNESS FIELD into a 512 px tile pair (top, face) of the car's one canvas: an
       * impact mass with fingers, a thrown spray of round and teardrop drops along the
       * hit direction, fine mist, the airflow's smear (longer with speed), and on the face
       * runs that follow gravity (the green channel is when a run reaches each pixel, so
       * they creep down the grille for ~25 s). The shader turns thickness into colour,
       * cover, gloss and normals (beads are domes with a meniscus) and the stain's age
       * into wet crimson drying to matte brown-black over ~2 min (thick cores last
       * longer), fading slowly over minutes; `wash` (rain) thins the weight. Lit like the
       * paint (city lights, headlights), never emissive.
       *
       * Bounds: CB_MAX_CARS stained models at a time (the oldest give up theirs),
       * three stains a car, everything disposed with the model (updateCarBlood
       * sweeps) or when a respray or repair clears the records.
       */
      const CB_TILE = 512,
        CB_COLS = 3,
        CB_ROWS = 2,
        CB_MAX_CARS = 5,
        CB_LIFT = 0.1, // world units the decal stands off the paint
        carBloodSkins = new Map();
      let carBloodSweepAt = 0,
        carBloodPaintMs = 0,
        carBloodBuilds = 0,
        carBloodBuildMs = 0;
      const cbSmooth = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      function cbRandom(seed) {
        let a = seed >>> 0;
        return () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      // @include src/carblood3d-paint.js

      // @include src/carblood3d-fit.js

      // ---- The skin: one mesh, one material, one canvas per stained car --------------------------
      function cbMaterial(texture) {
        const uniform = { value: 0 },
          material = new Three.MeshStandardMaterial({
            bumpMap: texture,
            bumpScale: 0.06,
            transparent: true,
            depthWrite: false,
            roughness: 0.3,
            metalness: 0,
            envMapIntensity: 1,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          });
        material.userData.now = uniform;
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.uniforms.uBloodNow = uniform;
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 aBlood;\nvarying vec2 vBlood;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlood = aBlood;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uBloodNow;\nvarying vec2 vBlood;\nfloat bThick = 0.0;\nfloat bDry = 0.0;')
            .replace(
              '#include <map_fragment>',
              `{
                float bAge = max( uBloodNow - vBlood.x, 0.0 );
                vec4 bField = texture2D( bumpMap, vBumpMapUv );
                bThick = bField.r;
                // Runs creep down for ~25 s: a pixel shows once its arrival time has passed.
                float bRun = bAge / 25.0;
                float bShow = 1.0 - smoothstep( bRun, bRun + 0.06, bField.g );
                bDry = smoothstep( 8.0 + 55.0 * bThick, 75.0 + 120.0 * bThick, bAge );
                // Thickness to colour: a thin film is bright and translucent, a deep pool nearly black.
                float bCover = smoothstep( 0.03, 0.1, bThick );
                float bDeep = smoothstep( 0.1, 0.75, bThick );
                vec3 bWet = mix( vec3( 0.36, 0.012, 0.016 ), vec3( 0.055, 0.0016, 0.0034 ), bDeep );
                vec3 bDried = mix( vec3( 0.105, 0.036, 0.02 ), vec3( 0.026, 0.0075, 0.0052 ), bDeep );
                diffuseColor.rgb = mix( bWet, bDried, bDry );
                float bFade = 1.0 - 0.9 * smoothstep( 200.0, 1500.0, bAge );
                diffuseColor.a = bCover * mix( 0.5, 0.97, smoothstep( 0.06, 0.4, bThick ) ) * bShow * vBlood.y * bFade;
                if ( diffuseColor.a < 0.004 ) discard;
              }`,
            )
            .replace(
              '#include <roughnessmap_fragment>',
              '#include <roughnessmap_fragment>\nroughnessFactor = mix( mix( 0.3, 0.05, smoothstep( 0.04, 0.5, bThick ) ), 0.68, bDry );',
            )
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize( mix( nonPerturbedNormal, normal, smoothstep( 0.2, 0.75, diffuseColor.a ) * ( 1.0 - bDry * 0.85 ) ) );');
        };
        material.customProgramCacheKey = () => 'car-blood';
        return material;
      }
      function cbNewSkin(c, m) {
        const canvas = document.createElement('canvas');
        canvas.width = CB_TILE * CB_COLS;
        canvas.height = CB_TILE * CB_ROWS;
        const g = canvas.getContext('2d');
        g.fillStyle = '#000';
        g.fillRect(0, 0, canvas.width, canvas.height);
        const texture = new Three.CanvasTexture(canvas);
        texture.anisotropy = 4;
        texture.wrapS = texture.wrapT = Three.ClampToEdgeWrapping;
        const material = cbMaterial(texture),
          mesh = new Three.Mesh(new Three.BufferGeometry(), material);
        mesh.userData.carBloodSkin = true;
        mesh.frustumCulled = false;
        mesh.renderOrder = 6;
        mesh.receiveShadow = true;
        mesh.raycast = () => {};
        mesh.name = 'car blood';
        m.body.add(mesh);
        return { c, m, mesh, material, g, canvas, texture, events: [], sig: '', builtAt: -99, washSig: -1, weights: null, ranges: [], triangles: 0 };
      }
      function cbRetire(skin) {
        carBloodSkins.delete(skin.c);
        if (skin.m.bloodSkin === skin) skin.m.bloodSkin = null;
        skin.mesh.parent?.remove(skin.mesh);
        skin.mesh.geometry.dispose();
        skin.material.dispose();
        skin.texture.dispose();
        skin.canvas.width = skin.canvas.height = 1;
      }
      // Gives up the stained model that is out of sight, else the one stained longest ago.
      function cbEvict() {
        let victim = null,
          rank = Infinity;
        for (const skin of carBloodSkins.values()) {
          const newest = skin.events.reduce((t, e) => Math.max(t, e.stain.t), 0) + (skin.m.group.visible ? 1e6 : 0) + (skin.c === player.car ? 1e7 : 0);
          if (newest < rank) {
            rank = newest;
            victim = skin;
          }
        }
        if (victim) cbRetire(victim);
      }
      function cbRebuild(skin, m) {
        const t0 = performance.now(),
          built = cbBuild(skin, m),
          geometry = skin.mesh.geometry,
          count = built.pos.length / 3;
        skin.triangles = count / 3;
        skin.ranges = built.ranges;
        skin.weights = Float32Array.from(built.weights);
        geometry.setAttribute('position', new Three.BufferAttribute(Float32Array.from(built.pos), 3));
        geometry.setAttribute('normal', new Three.BufferAttribute(Float32Array.from(built.nor), 3));
        geometry.setAttribute('uv', new Three.BufferAttribute(Float32Array.from(built.uv), 2));
        const blood = new Three.BufferAttribute(Float32Array.from(built.blood), 2);
        blood.setUsage(Three.DynamicDrawUsage);
        geometry.setAttribute('aBlood', blood);
        geometry.setDrawRange(0, count);
        geometry.computeBoundingSphere();
        skin.washSig = -1;
        skin.mesh.visible = count > 0;
        carBloodBuilds++;
        carBloodBuildMs = performance.now() - t0;
      }
      // Rain thins a stain's weight: only the vertices of a washed event are touched.
      function cbApplyWash(skin) {
        let sig = 0;
        for (const e of skin.events) sig = sig * 101 + Math.round(e.stain.wash * 100);
        if (sig === skin.washSig) return;
        skin.washSig = sig;
        const attribute = skin.mesh.geometry.attributes.aBlood;
        if (!attribute) return;
        for (const r of skin.ranges) {
          const keep = 1 - r.event.stain.wash;
          for (let i = r.start; i < r.end; i++) attribute.array[i * 2 + 1] = skin.weights[i] * keep;
        }
        attribute.needsUpdate = true;
      }
      // Called from the vehicle pass for a car that has stains (or had a skin).
      function updateCarBlood(c, m) {
        let skin = carBloodSkins.get(c);
        const list = c.stains;
        if (!list?.length || !bloodOn || m.body === undefined || m.heli || m.helicopter || m.plane || m.boat) {
          if (skin) {
            if (!list?.length) cbRetire(skin);
            else skin.mesh.visible = false;
          }
          return;
        }
        if (!m.group.visible) return;
        if (skin && skin.m !== m) {
          cbRetire(skin);
          skin = null;
        }
        if (!skin) {
          while (carBloodSkins.size >= CB_MAX_CARS) cbEvict();
          skin = cbNewSkin(c, m);
          carBloodSkins.set(c, skin);
          m.bloodSkin = skin;
        }
        let changed = false;
        for (let i = skin.events.length - 1; i >= 0; i--)
          if (!list.includes(skin.events[i].stain)) {
            skin.events.splice(i, 1);
            changed = true;
          }
        for (const stain of list)
          if (!skin.events.some((e) => e.stain === stain)) {
            const used = new Set(skin.events.flatMap((e) => e.slots)),
              free = [];
            for (let s = 0; s < CB_COLS * CB_ROWS && free.length < 2; s++) if (!used.has(s)) free.push(s);
            if (free.length < 2) continue;
            skin.events.push({ stain, slots: free, panels: [], painted: false });
            changed = true;
          }
        const sig = (m.damageVersion | 0) + ':' + (m.shapeVersion | 0);
        if (sig !== skin.sig && gameTime - skin.builtAt > 0.4) changed = true;
        if (changed) {
          skin.sig = sig;
          skin.builtAt = gameTime;
          cbRebuild(skin, m);
        } else {
          // The next frame paints what is new (one stain a frame: the fit and the paint never share one).
          const fresh = skin.events.find((e) => !e.painted && e.panels.length);
          if (fresh) {
            fresh.painted = true;
            cbPaintEvent(skin, fresh);
          }
        }
        cbApplyWash(skin);
        skin.material.userData.now.value = gameTime;
        skin.mesh.visible = skin.triangles > 0;
        if (gameTime > carBloodSweepAt) {
          carBloodSweepAt = gameTime + 3;
          for (const other of [...carBloodSkins.values()]) if (carModels.get(other.c) !== other.m) cbRetire(other);
        }
      }
      // What the console reports: the skins alive and, for one car, what it draws.
      function carBloodInfo(c) {
        const skin = c ? carBloodSkins.get(c) : null;
        return {
          skins: carBloodSkins.size,
          maxSkins: CB_MAX_CARS,
          builds: carBloodBuilds,
          paintMs: +carBloodPaintMs.toFixed(1),
          buildMs: +carBloodBuildMs.toFixed(1),
          triangles: skin ? skin.triangles : 0,
          sourceTriangles: skin ? skin.sourceTriangles : 0,
          gatherMs: skin ? +skin.gatherMs.toFixed(1) : 0,
          events: skin ? skin.events.length : 0,
          visible: skin ? skin.mesh.visible : false,
          panels: skin ? skin.events.flatMap((e) => e.panels.map((p) => ({ kind: p.kind, slot: p.slot, tiles: [+p.Wm.toFixed(2), +p.Hm.toFixed(2)] }))) : [],
          textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries,
        };
      }
