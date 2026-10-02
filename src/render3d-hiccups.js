      // HICCUP LOG: what each drawn frame created for the first time (shader programs, textures,
      // geometries) and the slowest frames' renderer CPU split; read through city3D.hiccups().
      /**
       * A frame spike is a first use (a program linked, a texture uploaded, a model built) or a
       * long straight-line pass. Per frame this reads three counters and the renderer's own laps
       * (`r:*` parts of profile.parts); only a frame that created something or ran long is kept
       * (the last 40 events plus the 8 slowest frames), so the log costs nothing in play.
       * `cpu` is a frame's renderer time without the GPU submit (`r:submit`), the part a faster
       * graphics card does not hide; `submit` is reported apart.
       */
      const HICCUP_LAPS = ['r:camera', 'r:sky', 'r:scenery', 'r:lod', 'r:crowd', 'r:vehicles', 'r:damage', 'r:people+fx'],
        HICCUP_SLOW_MS = 12,
        hiccupStart = new Float64Array(HICCUP_LAPS.length + 2),
        hiccupLog = {
          frames: 0,
          programs: 0,
          textures: 0,
          geometries: 0,
          // Frames that created something, and the share of the log kept.
          firstUseFrames: 0,
          events: [],
          worst: [],
          worstCpu: 0,
          worstSubmit: 0,
        };
      let hiccupFrameStart = 0,
        hiccupSeenPrograms = -1,
        hiccupSeenTextures = 0,
        hiccupSeenGeometries = 0;
      function hiccupPrograms() {
        return renderer.info.programs ? renderer.info.programs.length : 0;
      }
      // A program's own name: its material's type and name, else (a ShaderMaterial) the last custom
      // uniforms its shader declares, so a log line says which shader it was.
      const HICCUP_BUILTIN_UNIFORMS = /^(modelMatrix|modelViewMatrix|projectionMatrix|viewMatrix|normalMatrix|cameraPosition|isOrthographic|fogColor|fogDensity|fogNear|fogFar)$/;
      function hiccupProgramName(program) {
        const label = (program.type || 'program').replace('Material', '');
        if (program.name) return label + ':' + program.name;
        if (program.type !== 'ShaderMaterial') return label;
        try {
          const source = renderer.getContext().getShaderSource(program.fragmentShader) || '',
            names = [];
          for (const match of source.matchAll(/uniform\s+\w+\s+([\w\s,]+);/g))
            for (const name of match[1].split(',')) {
              const id = name.trim();
              if (id && !HICCUP_BUILTIN_UNIFORMS.test(id)) names.push(id);
            }
          return label + ':' + names.slice(-3).join(',');
        } catch {
          return label;
        }
      }
      // Who uses the new programs: the first object in the scene whose material runs each one,
      // named by its nearest named ancestor (programs of the renderer's own off-screen scenes
      // have no owner here and keep their uniform names).
      function hiccupOwners(fresh) {
        const owners = new Map();
        let left = fresh.size;
        scene.traverse((o) => {
          if (!left || !o.material) return;
          const list = Array.isArray(o.material) ? o.material : [o.material];
          for (const material of list) {
            const program = renderer.properties.get(material).currentProgram;
            if (!program || !fresh.has(program) || owners.has(program)) continue;
            let named = o;
            while (named && !named.name) named = named.parent;
            owners.set(program, (named && named.name) || o.type + ' ' + (o.geometry ? o.geometry.type : ''));
            left--;
          }
        });
        return owners;
      }
      // A program that is a variant of an older one (same shader, other state: light counts,
      // fog, shadow maps...) says which cache-key fields differ from its nearest sibling.
      function hiccupVariant(program, fresh) {
        const key = String(program.cacheKey).split(','),
          head = key.slice(0, 2).join(',');
        let best = null,
          bestSame = -1;
        for (const other of renderer.info.programs) {
          if (other === program || fresh.has(other)) continue;
          const parts = String(other.cacheKey).split(',');
          if (parts.slice(0, 2).join(',') !== head) continue;
          let same = 0;
          for (let i = 0; i < parts.length; i++) if (parts[i] === key[i]) same++;
          if (same > bestSame) {
            bestSame = same;
            best = parts;
          }
        }
        if (!best) return '';
        const diff = [];
        for (let i = 0; i < key.length && diff.length < 6; i++) if (key[i] !== best[i]) diff.push(i + ':' + best[i] + '>' + key[i]);
        return ' ~variant[' + diff.join(' ') + ']';
      }
      // The lights three.js counts for the camera now (visible, on its layers): programs are keyed
      // by these counts, so a count that changes between views recompiles every lit program.
      function hiccupLights() {
        let d = 0,
          p = 0,
          sp = 0,
          h = 0,
          shadow = 0;
        scene.traverseVisible((o) => {
          if (!o.isLight || !o.layers.test(camera.layers)) return;
          if (o.isDirectionalLight) d++;
          else if (o.isPointLight) p++;
          else if (o.isSpotLight) sp++;
          else if (o.isHemisphereLight) h++;
          if (o.castShadow) shadow++;
        });
        return 'dir' + d + ' point' + p + ' spot' + sp + ' hemi' + h + ' shadows' + shadow;
      }
      // Work done between frames (the prewarm) is not a frame's first use: the next frame starts from here.
      function hiccupSync() {
        hiccupSeenPrograms = hiccupPrograms();
        hiccupSeenTextures = renderer.info.memory.textures;
        hiccupSeenGeometries = renderer.info.memory.geometries;
      }
      function hiccupBegin() {
        hiccupFrameStart = performance.now();
        if (hiccupSeenPrograms < 0) {
          hiccupSeenPrograms = hiccupPrograms();
          hiccupSeenTextures = renderer.info.memory.textures;
          hiccupSeenGeometries = renderer.info.memory.geometries;
        }
        const parts = profile.parts;
        for (let i = 0; i < HICCUP_LAPS.length; i++) hiccupStart[i] = parts[HICCUP_LAPS[i]] || 0;
        hiccupStart[HICCUP_LAPS.length] = parts['r:submit'] || 0;
        hiccupStart[HICCUP_LAPS.length + 1] = parts['r:submit+shadow'] || 0;
      }
      function hiccupEnd() {
        const total = performance.now() - hiccupFrameStart,
          parts = profile.parts,
          submit =
            (parts['r:submit'] || 0) -
            hiccupStart[HICCUP_LAPS.length] +
            ((parts['r:submit+shadow'] || 0) - hiccupStart[HICCUP_LAPS.length + 1]),
          cpu = total - submit,
          programs = hiccupPrograms(),
          newPrograms = programs - hiccupSeenPrograms,
          newTextures = renderer.info.memory.textures - hiccupSeenTextures,
          newGeometries = renderer.info.memory.geometries - hiccupSeenGeometries;
        hiccupLog.frames++;
        if (newPrograms > 0) hiccupLog.programs += newPrograms;
        if (newTextures > 0) hiccupLog.textures += newTextures;
        if (newGeometries > 0) hiccupLog.geometries += newGeometries;
        if (cpu > hiccupLog.worstCpu) hiccupLog.worstCpu = cpu;
        if (submit > hiccupLog.worstSubmit) hiccupLog.worstSubmit = submit;
        const created = newPrograms > 0 || newTextures > 0 || newGeometries > 0,
          slow = cpu > HICCUP_SLOW_MS,
          worstList = hiccupLog.worst;
        const rank = !slow ? false : worstList.length < 8 || cpu > worstList[worstList.length - 1].cpu;
        if (created || rank) {
          const laps = {};
          for (let i = 0; i < HICCUP_LAPS.length; i++) {
            const ms = (parts[HICCUP_LAPS[i]] || 0) - hiccupStart[i];
            if (ms >= 0.5) laps[HICCUP_LAPS[i].slice(2)] = +ms.toFixed(1);
          }
          const entry = {
            frame: hiccupLog.frames,
            t: +gameTime.toFixed(1),
            cpu: +cpu.toFixed(1),
            submit: +submit.toFixed(0),
            laps,
          };
          if (created) {
            hiccupLog.firstUseFrames++;
            if (newPrograms > 0) {
              entry.programs = newPrograms;
              const names = [],
                fresh = new Set();
              for (let i = programs - newPrograms; i < programs; i++) if (renderer.info.programs[i]) fresh.add(renderer.info.programs[i]);
              const owners = hiccupOwners(fresh);
              for (const program of fresh) {
                if (names.length >= 12) break;
                names.push(hiccupProgramName(program) + (owners.has(program) ? ' @' + owners.get(program) : '') + hiccupVariant(program, fresh));
              }
              entry.names = names;
            }
            if (newTextures > 0) entry.textures = newTextures;
            if (newGeometries > 0) entry.geometries = newGeometries;
            if (newPrograms > 0) entry.lights = hiccupLights();
            hiccupLog.events.push(entry);
            if (hiccupLog.events.length > 40) hiccupLog.events.shift();
          }
          if (rank) {
            worstList.push(entry);
            worstList.sort((a, b) => b.cpu - a.cpu);
            if (worstList.length > 8) worstList.length = 8;
          }
        }
        hiccupSeenPrograms = programs;
        hiccupSeenTextures = renderer.info.memory.textures;
        hiccupSeenGeometries = renderer.info.memory.geometries;
      }
      function hiccupCopy(entry) {
        return { ...entry, laps: { ...entry.laps }, names: entry.names ? entry.names.slice() : undefined };
      }
      // Everything the scene could draw: unique geometries and their bytes, unique textures by
      // pixels, against how many the GPU holds now (a first draw uploads the rest).
      function hiccupSceneGpu() {
        const geometries = new Set(),
          textures = new Set(),
          big = [];
        let bytes = 0,
          texturePixels = 0;
        scene.traverse((o) => {
          const g = o.geometry;
          if (g && !geometries.has(g)) {
            geometries.add(g);
            for (const name in g.attributes) {
              const a = g.attributes[name];
              bytes += a.array ? a.array.byteLength : 0;
            }
            if (g.index && g.index.array) bytes += g.index.array.byteLength;
          }
          const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
          for (const m of list)
            for (const key in m) {
              const t = m[key];
              if (t && t.isTexture && !textures.has(t)) {
                textures.add(t);
                const image = t.image;
                if (image && image.width) {
                  texturePixels += image.width * image.height;
                  if (image.width * image.height >= 1 << 20) big.push([key + ' ' + image.width + 'x' + image.height + (image.getContext ? ' canvas' : ' ' + (image.constructor && image.constructor.name)), image.width * image.height]);
                }
              }
            }
        });
        big.sort((a, b) => b[1] - a[1]);
        return {
          geometries: geometries.size,
          geometryMB: +(bytes / 1048576).toFixed(1),
          textures: textures.size,
          texturePixelsM: +(texturePixels / 1e6).toFixed(1),
          // Textures of a megapixel or more (a canvas keeps its backing store after the upload).
          bigTextures: big.slice(0, 12).map(([name, pixels]) => name + ' ' + (pixels / 1e6).toFixed(1) + 'M'),
          uploadedGeometries: renderer.info.memory.geometries,
          uploadedTextures: renderer.info.memory.textures,
          // Baked canvas textures (ground sheets, sign faces) still waiting for their upload and release.
          canvasesToRelease: bakedCanvases.length,
        };
      }
      // Geometry bytes of one object's subtree (each geometry once).
      function hiccupBytes(root, seen) {
        let bytes = 0;
        root.traverse((o) => {
          const g = o.geometry;
          if (!g || seen.has(g)) return;
          seen.add(g);
          for (const name in g.attributes) {
            const a = g.attributes[name];
            bytes += a.array ? a.array.byteLength : 0;
          }
          if (g.index && g.index.array) bytes += g.index.array.byteLength;
        });
        return bytes;
      }
      // Per-cell geometry sizes of the merged batches and the 1024-unit static cells, and the far
      // scenery: what a cell coming into view uploads the first time.
      function hiccupCells() {
        const seen = new Set(),
          mb = (n) => +(n / 1048576).toFixed(2),
          sizes = (list) => {
            list.sort((a, b) => a - b);
            const n = list.length;
            return n ? { n, medianMB: mb(list[n >> 1]), p90MB: mb(list[Math.floor(n * 0.9)]), maxMB: mb(list[n - 1]), totalMB: mb(list.reduce((a, b) => a + b, 0)) } : { n: 0 };
          },
          batch = [],
          statics = [];
        for (const cell of staticBatchCells.values()) batch.push(hiccupBytes(cell.group, seen));
        for (const cell of staticCells) statics.push(hiccupBytes(cell.group, seen));
        return {
          batchCells: sizes(batch),
          staticCells: sizes(statics),
          looseMB: mb(looseStatics.reduce((n, s) => n + hiccupBytes(s.group, seen), 0)),
          farSceneryMB: mb(hiccupBytes(farScenery, new Set())),
          farMeshes: farScenery.children.length,
          // The pre-upload ahead of the view (render3d-resources.js CELL PRE-UPLOAD): meshes and MB sent, slices, the slowest slice (ms).
          preUpload: { meshes: cellWarm.meshes, MB: +cellWarm.megabytes.toFixed(1), slices: cellWarm.ticks, slowestMs: +cellWarm.slowest.toFixed(1), cells: cellWarm.cells ? cellWarm.cells.length : 0 },
        };
      }
      function hiccupReport(reset) {
        const out = {
          frames: hiccupLog.frames,
          // Created since the log began (reset or start of play); the counts are first uses.
          programsLinked: hiccupLog.programs,
          texturesCreated: hiccupLog.textures,
          geometriesCreated: hiccupLog.geometries,
          firstUseFrames: hiccupLog.firstUseFrames,
          worstCpuMs: +hiccupLog.worstCpu.toFixed(1),
          worstSubmitMs: +hiccupLog.worstSubmit.toFixed(0),
          lights: hiccupLights(),
          gpu: hiccupSceneGpu(),
          cells: hiccupCells(),
          // The body-impostor pools made so far (flight-view3d.js): pools, instanced meshes in them.
          // The dormant-light guard (lighting3d-cutaway.js) is in the chunk every lit program is built from.
          dormantLights: Three.ShaderChunk.lights_fragment_begin.includes('if ( directLight.visible ) RE_Direct('),
          bodyPools: { pools: bodyPools.size, meshes: [...bodyPools.values()].reduce((n, pool) => n + (pool ? pool.parts.length : 0), 0) },
          lightsNested: (() => {
            let n = 0;
            scene.traverse((o) => {
              if (o.isLight && o.parent !== scene) n++;
            });
            return n;
          })(),
          now: { programs: hiccupPrograms(), textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries },
          memory: { ...renderer.info.memory },
          prewarm: { ...prewarmInfo, ms: +prewarmInfo.ms.toFixed(0) },
          // The staged tier change (lighting3d-look.js LIT STATE): pending, switches made, CPU, programs compiled.
          litStage: { ...litStageInfo, ms: +litStageInfo.ms.toFixed(0), staging: litStagingReady },
          worst: hiccupLog.worst.map(hiccupCopy),
          events: hiccupLog.events.map(hiccupCopy),
        };
        if (reset) {
          hiccupLog.frames = hiccupLog.programs = hiccupLog.textures = hiccupLog.geometries = 0;
          hiccupLog.firstUseFrames = hiccupLog.worstCpu = hiccupLog.worstSubmit = 0;
          hiccupLog.events.length = hiccupLog.worst.length = 0;
        }
        return out;
      }
