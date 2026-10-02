      // Car blood 3D, skins: the shared shader, a pool of ready skins, the per-frame work budget, the warm-up and the tile upload.
      // ---- The skin: one mesh, one material, one canvas per stained car --------------------------
      /*
       * Nothing here may cost a frame more than about CB_BUDGET_MS: the fit and the paint are
       * generators run in slices (cbSlice) from the vehicle pass, the first skin is made and its
       * program compiled and linked while the title menu is up (cbWarmStep), skins go back to a
       * pool instead of being disposed, and a painted tile reaches the GPU as a sub-image copy
       * (a quarter megabyte of canvas, not the whole 6 MB sheet).
       */
      const CB_BUDGET_MS = 3,
        CB_SPARES = 1,
        CB_START_VERTICES = 6000,
        cbSpare = [],
        cbOrigin = new Three.Vector2(),
        cbProbe = { gaps: [], workMax: 0, frameWork: 0, slices: 0, worstSlice: 0, workFrames: 0, uploadMs: 0, uploads: 0, slow: [] };
      let cbScratch = null,
        cbFrameStamp = -1e9,
        cbFrameLeft = 0,
        cbFrameGap = 16,
        cbPartial = null,
        cbWarmKey = '',
        cbWarmProgram = null,
        cbWarmLinked = false,
        cbWarmCompiles = 0,
        cbWarmMs = 0,
        cbPaintCurrent = null;
      function cbMaterial(texture) {
        const now = { value: 0 },
          events = { value: [new Three.Vector4(), new Three.Vector4(), new Three.Vector4()] },
          material = new Three.MeshStandardMaterial({
            bumpMap: texture,
            bumpScale: 0.06,
            transparent: true,
            depthWrite: false,
            roughness: 0.3,
            metalness: 0,
            envMapIntensity: 0.6,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          });
        material.userData.now = now;
        material.userData.events = events;
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.uniforms.uBloodNow = now;
          shader.uniforms.uBloodEv = events;
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 aBlood;\nvarying vec2 vBlood;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlood = aBlood;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uBloodNow;\nuniform vec4 uBloodEv[3];\nvarying vec2 vBlood;\nfloat bThick = 0.0;\nfloat bDry = 0.0;')
            .replace(
              '#include <map_fragment>',
              `{
                // One stain's state: x birth, y what the rain has left, z how far the airflow has dragged it, w how far its runs have crept.
                vec4 bEv = uBloodEv[ int( vBlood.x + 0.5 ) ];
                float bAge = max( uBloodNow - bEv.x, 0.0 );
                vec4 bField = texture2D( bumpMap, vBumpMapUv );
                float bRaw = bField.r;
                // G and B hold arrival times times the thickness: divide it back out.
                float bArrive = bField.g / max( bRaw, 0.02 );
                float bCreepAt = bField.b / max( bRaw, 0.02 );
                float bShow = 1.0 - smoothstep( bEv.z, bEv.z + 0.015, bArrive );
                if ( bCreepAt > 0.012 ) bShow *= 1.0 - smoothstep( bEv.w, bEv.w + 0.015, bCreepAt );
                // The head of a streak still growing lies thicker and wetter.
                float bHead = bEv.z < 0.999 ? smoothstep( bEv.z - 0.06, bEv.z, bArrive ) * step( 0.02, bArrive ) : 0.0;
                bThick = bRaw + 0.22 * bHead;
                bDry = smoothstep( 8.0 + 55.0 * bThick, 75.0 + 120.0 * bThick, bAge );
                // Thickness to colour: a thin film is bright and translucent, a deep pool nearly black.
                float bCover = smoothstep( 0.03, 0.1, bThick );
                float bDeep = smoothstep( 0.1, 0.75, bThick );
                vec3 bWet = mix( vec3( 0.24, 0.007, 0.011 ), vec3( 0.05, 0.0014, 0.003 ), bDeep );
                vec3 bDried = mix( vec3( 0.105, 0.036, 0.02 ), vec3( 0.026, 0.0075, 0.0052 ), bDeep );
                diffuseColor.rgb = mix( bWet, bDried, bDry );
                float bFade = 1.0 - 0.9 * smoothstep( 200.0, 1500.0, bAge );
                diffuseColor.a = bCover * mix( 0.62, 0.97, smoothstep( 0.06, 0.4, bThick ) ) * bShow * vBlood.y * bEv.y * bFade;
                if ( diffuseColor.a < 0.004 ) discard;
              }`,
            )
            // A thin film barely glints: only the thick, wet parts keep their full highlight.
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nfloat bSpec = mix( 0.3, 1.0, smoothstep( 0.12, 0.55, bThick ) ) * ( 1.0 - 0.6 * bDry );\nreflectedLight.directSpecular *= bSpec;\nreflectedLight.indirectSpecular *= bSpec;')
            .replace(
              '#include <roughnessmap_fragment>',
              '#include <roughnessmap_fragment>\nroughnessFactor = mix( mix( 0.55, 0.06, smoothstep( 0.1, 0.6, bThick ) ), 0.7, bDry );',
            )
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize( mix( nonPerturbedNormal, normal, smoothstep( 0.2, 0.75, diffuseColor.a ) * ( 1.0 - bDry * 0.85 ) ) );');
        };
        material.customProgramCacheKey = () => 'car-blood';
        return material;
      }
      function cbMakeScratch() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = CB_TILE;
        const texture = new Three.Texture(canvas);
        texture.flipY = true;
        cbScratch = { canvas, g: canvas.getContext('2d'), texture };
      }
      // Step 1 of a skin: the canvas sheet, black. Step 2: the texture, uploaded to the GPU. Step 3: the mesh and material.
      function cbMakeSkinStep(part, partial) {
        if (part === 0) {
          const canvas = document.createElement('canvas');
          canvas.width = CB_TILE * CB_COLS;
          canvas.height = CB_TILE * CB_ROWS;
          const g = canvas.getContext('2d');
          g.fillStyle = '#000';
          g.fillRect(0, 0, canvas.width, canvas.height);
          return { canvas, g };
        }
        if (part === 1) {
          const texture = new Three.CanvasTexture(partial.canvas);
          texture.anisotropy = 4;
          texture.wrapS = texture.wrapT = Three.ClampToEdgeWrapping;
          partial.texture = texture;
          try {
            renderer.initTexture(texture);
            partial.gpu = true;
          } catch (error) {
            partial.gpu = false;
          }
          return partial;
        }
        const material = cbMaterial(partial.texture),
          geometry = new Three.BufferGeometry(),
          mesh = new Three.Mesh(geometry, material);
        mesh.userData.carBloodSkin = true;
        mesh.frustumCulled = false;
        mesh.renderOrder = 6;
        mesh.receiveShadow = true;
        mesh.raycast = () => {};
        mesh.name = 'car blood';
        mesh.visible = false;
        const skin = { c: null, m: null, mesh, material, geometry, g: partial.g, canvas: partial.canvas, texture: partial.texture, gpu: partial.gpu, attr: null, ev: material.userData.events.value, used: new Array(CB_COLS * CB_ROWS).fill(false) };
        cbAttributes(skin, CB_START_VERTICES);
        return skin;
      }
      // The geometry's buffers, with room for `vertices` (a roomier geometry replaces the old one, which frees its GPU buffers).
      function cbAttributes(skin, vertices) {
        const make = (size) => new Three.BufferAttribute(new Float32Array(vertices * size), size),
          previous = skin.attr ? skin.mesh.geometry : null,
          geometry = previous ? new Three.BufferGeometry() : skin.mesh.geometry;
        skin.attr = { cap: vertices, pos: make(3), nor: make(3), uv: make(2), blood: make(2) };
        for (const [name, a] of [
          ['position', skin.attr.pos],
          ['normal', skin.attr.nor],
          ['uv', skin.attr.uv],
          ['aBlood', skin.attr.blood],
        ]) {
          a.setUsage(Three.DynamicDrawUsage);
          geometry.setAttribute(name, a);
        }
        geometry.setDrawRange(0, 0);
        if (previous) {
          skin.mesh.geometry = geometry;
          previous.dispose();
        }
      }
      function cbNewSkin(c, m) {
        let skin = cbSpare.pop();
        if (!skin) {
          const partial = cbMakeSkinStep(0);
          cbMakeSkinStep(1, partial);
          skin = cbMakeSkinStep(2, partial);
        }
        skin.c = c;
        skin.m = m;
        skin.events = [];
        skin.sig = '';
        skin.builtAt = -99;
        skin.build = null;
        skin.needBuild = false;
        skin.retryAt = 0;
        skin.triangles = 0;
        skin.sourceTriangles = 0;
        for (const v of skin.ev) v.set(0, 0, 0, 0);
        skin.mesh.geometry.setDrawRange(0, 0);
        m.body.add(skin.mesh);
        return skin;
      }
      function cbDispose(skin) {
        skin.mesh.parent?.remove(skin.mesh);
        skin.mesh.geometry.dispose();
        skin.material.dispose();
        skin.texture.dispose();
        skin.canvas.width = skin.canvas.height = 1;
      }
      function cbRetire(skin) {
        carBloodSkins.delete(skin.c);
        if (skin.m?.bloodSkin === skin) skin.m.bloodSkin = null;
        if (cbPaintCurrent?.skin === skin) cbPaintCurrent = null;
        skin.build = null;
        skin.mesh.parent?.remove(skin.mesh);
        skin.mesh.visible = false;
        skin.mesh.geometry.setDrawRange(0, 0);
        skin.c = skin.m = null;
        skin.events = [];
        if (cbSpare.length < CB_SPARES && skin.gpu) cbSpare.push(skin);
        else cbDispose(skin);
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
      // ---- The frame's slice of work ------------------------------------------------------------
      // The first call of a frame opens its budget (a slow frame has more room); every stained car shares it.
      function cbFrame() {
        const now = performance.now();
        if (now - cbFrameStamp <= 5) return;
        const gap = now - cbFrameStamp;
        cbFrameGap = gap > 400 ? 16 : gap;
        if (gap < 1000) {
          cbProbe.gaps.push(gap);
          if (cbProbe.gaps.length > 240) cbProbe.gaps.shift();
        }
        if (cbProbe.frameWork > 0) cbProbe.workFrames++;
        cbProbe.workMax = Math.max(cbProbe.workMax, cbProbe.frameWork);
        cbProbe.frameWork = 0;
        cbFrameStamp = now;
        cbFrameLeft = clamp(cbFrameGap * 0.14, CB_BUDGET_MS, 9);
      }
      // Runs `job.gen` until the slice is spent; true when it finished. `job.onYield` runs after each yield.
      function cbSlice(job) {
        cbFrame();
        if (cbFrameLeft < 0.25) return false;
        const t0 = performance.now();
        cbDeadline = t0 + cbFrameLeft;
        let done = false;
        try {
          for (;;) {
            const step = job.gen.next();
            if (step.done) {
              done = true;
              break;
            }
            job.onYield?.(step.value);
            if (performance.now() >= cbDeadline) break;
          }
        } catch (error) {
          job.error = error;
          done = true;
          console.error('car blood:', error);
        }
        const used = performance.now() - t0;
        cbFrameLeft -= used;
        cbProbe.frameWork += used;
        cbProbe.slices++;
        cbProbe.worstSlice = Math.max(cbProbe.worstSlice, used);
        if (used > 25 && cbProbe.slow.length < 12) cbProbe.slow.push([job.event ? 'paint ' + (job.panel?.kind || '-') + job.tilesDone : 'fit', +used.toFixed(1), job.slices, job.event ? job.out : job.out?.n]);
        job.ms += used;
        job.slices++;
        return done;
      }
      // Sends the scratch tile to the GPU as a sub-image of the skin's texture; `keep` (the tile is finished) also copies it into the skin's canvas sheet, which is what a lost GL context would restore from.
      function cbFlushTile(skin, slot, keep) {
        const t0 = performance.now(),
          ox = (slot % CB_COLS) * CB_TILE,
          oy = Math.floor(slot / CB_COLS) * CB_TILE;
        skin.used[slot] = true;
        if (keep || !skin.gpu) skin.g.drawImage(cbScratch.canvas, ox, oy);
        if (skin.gpu) {
          try {
            cbOrigin.set(ox, CB_TILE * CB_ROWS - oy - CB_TILE);
            renderer.copyTextureToTexture(cbOrigin, cbScratch.texture, skin.texture);
            cbProbe.uploadMs += performance.now() - t0;
            cbProbe.uploads++;
            return;
          } catch (error) {
            skin.gpu = false;
            skin.g.drawImage(cbScratch.canvas, ox, oy);
          }
        }
        skin.texture.needsUpdate = true;
      }
      // The geometry a finished fit made replaces the skin's own in one step.
      function cbCommit(skin, job) {
        if (job.retry) {
          skin.needBuild = true;
          skin.retryAt = performance.now() + 500;
          return;
        }
        const out = job.out,
          n = out.n;
        if (skin.attr.cap < n) cbAttributes(skin, Math.ceil(n * 1.3));
        const attr = skin.attr;
        for (const [a, source, size] of [
          [attr.pos, out.pos, 3],
          [attr.nor, out.nor, 3],
          [attr.uv, out.uv, 2],
          [attr.blood, out.blood, 2],
        ]) {
          a.array.set(source.subarray(0, n * size));
          a.array.fill(0, n * size);
          a.clearUpdateRanges();
          a.addUpdateRange(0, Math.max(a.array.length, 1));
          a.needsUpdate = true;
        }
        skin.mesh.geometry.setDrawRange(0, n);
        skin.triangles = n / 3;
        skin.sourceTriangles = job.sourceTriangles;
        for (const event of job.events) if (skin.events.includes(event)) event.fitted = true;
        carBloodBuilds++;
        carBloodBuildMs = job.ms;
        carBloodBuildSlices = job.slices;
      }
      // One painting job at a time for every car: the next fitted event with tiles still to paint.
      function cbPickPaint() {
        let best = null;
        for (const skin of carBloodSkins.values())
          for (const event of skin.events)
            if (event.fitted && event.layout && !event.painted && (!best || event.stain.t < best.event.stain.t)) best = { skin, event };
        if (!best) return null;
        const job = { skin: best.skin, event: best.event, gen: null, ms: 0, slices: 0, panel: null, tilesDone: 0 };
        best.event.shown = true;
        job.gen = cbPaintJob(job);
        // A tile goes to the GPU when a stage of it is done (and into the canvas sheet when the tile is).
        job.onYield = (stage) => {
          if (stage !== 'stage' || !job.panel) return;
          cbFlushTile(job.skin, job.panel.slot, job.tileEnd);
          job.tileEnd = false;
        };
        // A clean sheet under the event: a tile that held an earlier stain is blanked before the first stroke.
        for (const panel of best.event.layout)
          if (best.skin.used[panel.slot]) {
            cbScratch.g.setTransform(1, 0, 0, 1, 0, 0);
            cbScratch.g.globalCompositeOperation = 'source-over';
            cbScratch.g.fillStyle = '#000';
            cbScratch.g.fillRect(0, 0, CB_TILE, CB_TILE);
            cbFlushTile(best.skin, panel.slot, true);
            best.skin.used[panel.slot] = false;
          }
        return job;
      }
      // Advances the painting job. Safe from any stained car's update: the work is canvas only.
      function cbPump() {
        if (!cbScratch) return;
        if (cbPaintCurrent && (carBloodSkins.get(cbPaintCurrent.skin.c) !== cbPaintCurrent.skin || !cbPaintCurrent.skin.events.includes(cbPaintCurrent.event))) cbPaintCurrent = null;
        cbFrame();
        if (!cbPaintCurrent) {
          if (cbFrameLeft < 0.5) return;
          cbPaintCurrent = cbPickPaint();
          if (!cbPaintCurrent) return;
        }
        const job = cbPaintCurrent;
        if (cbSlice(job)) {
          cbPaintCurrent = null;
          job.event.painted = true;
          carBloodPaintMs = job.ms;
          carBloodPaintSlices = job.slices;
        }
      }
      // ---- The warm-up ---------------------------------------------------------------------------
      // While the title menu is up (and again if the render pipeline changes): a spare skin, made in
      // small steps, and the shared program compiled with the scene's lights and linked, so the first
      // stain triggers neither a canvas allocation, a texture upload nor a shader compile.
      function cbWarmStep() {
        let delay = 2500;
        try {
          if (!cbScratch) {
            cbMakeScratch();
            delay = 200;
          } else if (!cbDomeAtlas) {
            cbMakeDomeAtlas();
            delay = 200;
          } else if (cbSpare.length < CB_SPARES) {
            const part = cbPartial ? (cbPartial.texture ? 2 : 1) : 0;
            if (part === 0) cbPartial = cbMakeSkinStep(0);
            else if (part === 1) cbMakeSkinStep(1, cbPartial);
            else {
              cbSpare.push(cbMakeSkinStep(2, cbPartial));
              cbPartial = null;
            }
            delay = 150;
          } else {
            const key = (hdrCapable && postTier ? 'hdr' : 'direct') + (renderer.shadowMap.enabled ? ':shadow' : '');
            if (key !== cbWarmKey) {
              cbCompileProgram(cbSpare[0]);
              cbWarmKey = key;
              cbWarmLinked = false;
            }
            if (cbWarmProgram && !cbWarmLinked) {
              if (cbWarmProgram.isReady?.() || (!renderer.extensions.has('KHR_parallel_shader_compile') && gameMode === 'menu')) {
                cbWarmProgram.getUniforms();
                cbWarmLinked = true;
              } else delay = 400;
            }
          }
        } catch (error) {
          console.warn('car blood warm-up stopped:', error);
          return;
        }
        setTimeout(cbWarmStep, delay);
      }
      function cbCompileProgram(skin) {
        const t0 = performance.now(),
          slice = new Three.Object3D(),
          previous = renderer.getRenderTarget();
        slice.add(skin.mesh);
        if (hdrCapable && postTier) renderer.setRenderTarget(postSceneTarget());
        try {
          for (const material of renderer.compile(slice, camera, scene)) cbWarmProgram = renderer.properties.get(material).currentProgram || cbWarmProgram;
        } finally {
          renderer.setRenderTarget(previous);
          slice.remove(skin.mesh);
        }
        cbWarmCompiles++;
        cbWarmMs = performance.now() - t0;
      }
      setTimeout(cbWarmStep, 2200);
