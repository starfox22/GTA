      // Car blood 3D: stains on a vehicle's bodywork, decal geometry clipped to the model's own surface, painted and fitted in time slices.
      /**
       * CAR BLOOD
       * car-stains.js keeps `c.stains` (plain records: where the person was struck,
       * how hard, the direction the blood is carried, how far the airflow has dragged
       * it and how far its runs have crept); this only draws them. One stained car owns
       * ONE mesh (child of `m.body`, so it rides the suspension and the hood hinge), ONE
       * material and ONE canvas sheet (the field of thickness and arrival) shared by all
       * its stains, taken from a small pool of ready skins.
       *
       * Fitting: a stain is two "panels", a box aimed at the body. The TOP panel
       * looks down onto the bonnet, fender tops and windscreen base (as long as the blood
       * can be dragged: bumper to roof edge for a fatal hit at speed), the FACE panel in
       * at the bumper and grille (or a flank). Every triangle of the model's visible
       * meshes that falls inside a panel's box is clipped to it, pushed 1 mm along its own
       * normal and given the panel's UVs, so the decal IS the bodywork (no floating, no
       * sinking, it follows any body type), and it is re-fitted when the crumple changes
       * the shell (damageVersion / shapeVersion). Surfaces another mesh covers (the
       * bonnet panel over the shell) are left out, so layers never z-fight.
       *
       * Look: each stain is painted ONCE (carblood3d-paint.js, -streaks.js), seeded by
       * `seed`, as a FIELD into a 512 px tile pair (top, face) of the car's sheet: R how
       * thick the blood lies (an impact mass with fingers, a pad where the body slid, drops
       * and mist thrown along the hit, a band of streaks and a few thick ropes dragged back
       * along the airflow, gravity runs), G and B when the airflow's streaks and the
       * gravity runs reach each pixel. The stain's `flow` and `creep` (car-stains.js) open
       * those up: the streaks grow back along the bonnet while the car runs and stop where
       * it stopped, the runs creep once it has. The shader turns thickness into colour,
       * cover, gloss and normals (beads are domes with a meniscus) and the age into wet
       * crimson drying to matte brown-black over ~2 min (thick cores last longer), fading
       * slowly over minutes; `wash` (rain) thins it. Lit like the paint (city lights,
       * headlights), never emissive.
       *
       * Cost: no frame pays more than ~CB_BUDGET_MS for it (carblood3d-skin.js): the fit and the paint are
       * generators run in slices, the body's surfaces are gathered once per body type, skins are
       * pooled and the program compiled in advance, a painted tile is uploaded as a sub-image.
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
        carBloodPaintSlices = 0,
        carBloodBuilds = 0,
        carBloodBuildMs = 0,
        carBloodBuildSlices = 0;
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

      // @include src/carblood3d-streaks.js

      // @include src/carblood3d-fit.js

      // @include src/carblood3d-skin.js

      function cbStartBuild(skin, m) {
        skin.stage ||= cbOutput(CB_START_VERTICES);
        skin.stage.n = 0;
        skin.stage.ranges = [];
        const job = { skin, m, events: skin.events.slice(), out: skin.stage, gen: null, ms: 0, slices: 0, sourceTriangles: 0 };
        job.gen = cbFitJob(job);
        return job;
      }
      // Brings the skin's records in line with the car's stains; true when one came or went.
      function cbSyncEvents(skin, list) {
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
            skin.events.push({ stain, slots: free, index: free[0] >> 1, layout: null, fitted: false, shown: false, painted: false });
            changed = true;
          }
        return changed;
      }
      // Called from the vehicle pass for a car that has stains (or had a skin).
      function updateCarBlood(c, m) {
        cbPump();
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
        if (cbSyncEvents(skin, list)) skin.needBuild = true;
        const sig = (m.damageVersion | 0) + ':' + (m.shapeVersion | 0);
        if (sig !== skin.sig && gameTime - skin.builtAt > 0.4 && !skin.build) skin.needBuild = true;
        // The fit runs in slices; the skin keeps showing the last one until the new one is ready.
        if (!skin.build && skin.needBuild && skin.events.length && performance.now() >= (skin.retryAt || 0)) {
          skin.needBuild = false;
          skin.sig = sig;
          skin.builtAt = gameTime;
          skin.build = cbStartBuild(skin, m);
        }
        if (skin.build && cbSlice(skin.build)) {
          const job = skin.build;
          skin.build = null;
          if (!job.error) cbCommit(skin, job);
        }
        // What each stain looks like now: its birth, what the rain has left, how far the airflow and the runs have gone.
        const ev = skin.ev;
        for (const v of ev) v.set(0, 0, 0, 0);
        for (const e of skin.events) ev[e.index].set(e.stain.t, e.shown ? 1 - e.stain.wash : 0, e.stain.flow, e.stain.creep);
        skin.material.userData.now.value = gameTime;
        skin.mesh.visible = skin.triangles > 0;
        if (gameTime > carBloodSweepAt) {
          carBloodSweepAt = gameTime + 3;
          for (const other of [...carBloodSkins.values()]) if (carModels.get(other.c) !== other.m) cbRetire(other);
        }
      }
      // What the console reports: the skins alive and, for one car, what it draws; `reset` clears the frame probe.
      function carBloodInfo(c, reset = false) {
        const skin = c ? carBloodSkins.get(c) : null,
          gaps = [...cbProbe.gaps].sort((a, b) => a - b),
          info = {
            skins: carBloodSkins.size,
            maxSkins: CB_MAX_CARS,
            spare: cbSpare.length,
            builds: carBloodBuilds,
            paintMs: +carBloodPaintMs.toFixed(1),
            paintSlices: carBloodPaintSlices,
            buildMs: +carBloodBuildMs.toFixed(1),
            buildSlices: carBloodBuildSlices,
            triangles: skin ? skin.triangles : 0,
            sourceTriangles: skin ? skin.sourceTriangles : 0,
            gatherCache: { hits: cbGatherHits, misses: cbGatherMisses, types: cbGatherCache.size },
            events: skin ? skin.events.length : 0,
            fitted: skin ? skin.events.filter((e) => e.fitted).length : 0,
            painted: skin ? skin.events.filter((e) => e.painted).length : 0,
            visible: skin ? skin.mesh.visible : false,
            panels: skin ? skin.events.flatMap((e) => (e.layout || []).map((p) => ({ kind: p.kind, slot: p.slot, tiles: [+p.Wm.toFixed(2), +p.Hm.toFixed(2)] }))) : [],
            warm: { compiles: cbWarmCompiles, linked: cbWarmLinked, key: cbWarmKey, ms: +cbWarmMs.toFixed(1) },
            // The work this module did in a frame (ms): the largest since the last reset, the biggest slice, frames that had any.
            work: { worstFrameMs: +cbProbe.workMax.toFixed(2), worstSliceMs: +cbProbe.worstSlice.toFixed(2), frames: cbProbe.workFrames, slices: cbProbe.slices, tileUploadMs: +cbProbe.uploadMs.toFixed(1), tileUploads: cbProbe.uploads, slow: cbProbe.slow },
            // Whole frame gaps (ms) while stained cars were on screen: median, 95th percentile and worst of the last 240.
            frameGaps: { n: gaps.length, median: +(gaps[gaps.length >> 1] || 0).toFixed(1), p95: +(gaps[Math.floor(gaps.length * 0.95)] || 0).toFixed(1), worst: +(gaps[gaps.length - 1] || 0).toFixed(1) },
            textures: renderer.info.memory.textures,
            geometries: renderer.info.memory.geometries,
            programs: renderer.info.programs?.length ?? 0,
          };
        if (reset) {
          cbProbe.gaps.length = 0;
          cbProbe.workMax = cbProbe.frameWork = cbProbe.worstSlice = 0;
          cbProbe.workFrames = cbProbe.slices = cbProbe.uploadMs = cbProbe.uploads = 0;
          cbProbe.slow.length = 0;
        }
        return info;
      }
