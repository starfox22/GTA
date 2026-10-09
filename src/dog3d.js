      // Street dogs from a downloaded model (assets/dog-model.bin, tools/dog_model.py: a rigged Labrador, CC-BY):
      // its baked trot, stand, sit and sniff frames blended per dog in the vertex shader, one instanced draw.
      /**
       * DOG MODEL
       * The converter poses the model's own skeleton into eight trot phases (diagonal pairs), standing, sitting and
       * sniffing (head down) and stores every frame's positions and normals; here they become one float texture
       * (DOG FRAMES: a row block per frame, `gl_VertexID` picks the texel). Each instance carries `dogPose`
       * (trot phase 0-8, trot share, sit, sniff): the shader blends the two trot frames either side of the phase,
       * then towards standing by the trot share, then towards sitting or sniffing. The shadow pass uses the same
       * vertex code (customDepthMaterial). Colours: the model's texture over its coat colour per vertex, times the dog's
       * own colour (instance colour), so a black, brown or white dog keeps the shading, dark nose and pads.
       * drawCrowdDog (crowd3d-frame.js) emits it; without the model in the build the old box dog is drawn.
       */
      const DOG_ROW = 1024;
      function dogModelData() {
        const url = typeof ASSETS !== 'undefined' && ASSETS.dogModel;
        if (!url || url.length < 64) return null;
        try {
          const text = atob(url.slice(url.indexOf(',') + 1)),
            bytes = new Uint8Array(text.length);
          for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECDG001') throw new Error('dog model: not a dog file');
          const view = new DataView(bytes.buffer),
            headerLength = view.getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))),
            base = 12 + headerLength,
            types = { i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array },
            arrays = {};
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) arrays[name] = new types[type](bytes.buffer, base + offset, count);
          return { header, arrays };
        } catch (error) {
          console.error(error);
          return null;
        }
      }
      const DOG_VERTEX_PARS = `
        uniform sampler2D dogFrames;
        uniform float dogRows;
        attribute vec4 dogPose;
        vec4 dogTexel(int frame, int row) {
          int id = gl_VertexID;
          return texelFetch(dogFrames, ivec2(id % ${DOG_ROW}, id / ${DOG_ROW} + (frame * 2 + row) * int(dogRows)), 0);
        }
        vec3 dogBlend(int row) {
          float phase = mod(dogPose.x, 8.0);
          int a = int(floor(phase));
          int b = (a + 1) - ((a + 1) / 8) * 8;
          vec3 trot = mix(dogTexel(a, row).xyz, dogTexel(b, row).xyz, fract(phase));
          vec3 v = mix(dogTexel(8, row).xyz, trot, dogPose.y);
          v = mix(v, dogTexel(10, row).xyz, dogPose.w);
          return mix(v, dogTexel(9, row).xyz, dogPose.z);
        }
      `;
      function dogPatch(shader) {
        shader.uniforms.dogFrames = dogShared.frames;
        shader.uniforms.dogRows = dogShared.rows;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + DOG_VERTEX_PARS)
          .replace('#include <begin_vertex>', 'vec3 transformed = dogBlend(0);')
          .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(dogBlend(1));');
      }
      const dogShared = { frames: { value: null }, rows: { value: 1 } };
      function makeDogModelPart() {
        const data = dogModelData();
        if (!data) return null;
        const { header, arrays } = data,
          n = header.vertices,
          frames = header.frames.length,
          rows = Math.ceil(n / DOG_ROW),
          [lx, ly, lz, ex, ey, ez] = header.quant,
          texels = new Float32Array(DOG_ROW * rows * frames * 2 * 4),
          q = arrays.position,
          nn = arrays.normal;
        for (let f = 0; f < frames; f++)
          for (let i = 0; i < n; i++) {
            const src = (f * n + i) * 3,
              col = i % DOG_ROW,
              row = Math.floor(i / DOG_ROW),
              p = ((f * 2 * rows + row) * DOG_ROW + col) * 4,
              o = (((f * 2 + 1) * rows + row) * DOG_ROW + col) * 4;
            texels[p] = ((q[src] + 32767) / 65534) * ex + lx;
            texels[p + 1] = ((q[src + 1] + 32767) / 65534) * ey + ly;
            texels[p + 2] = ((q[src + 2] + 32767) / 65534) * ez + lz;
            texels[o] = nn[src] / 127;
            texels[o + 1] = nn[src + 1] / 127;
            texels[o + 2] = nn[src + 2] / 127;
          }
        const frameTexture = new Three.DataTexture(texels, DOG_ROW, rows * frames * 2, Three.RGBAFormat, Three.FloatType);
        frameTexture.minFilter = frameTexture.magFilter = Three.NearestFilter;
        frameTexture.needsUpdate = true;
        dogShared.frames.value = frameTexture;
        dogShared.rows.value = rows;
        // The geometry: the standing frame's positions (bounds and the attribute count), the colours, the triangles.
        const geo = new Three.BufferGeometry(),
          stand = header.frames.indexOf('stand'),
          position = new Float32Array(n * 3),
          normal = new Float32Array(n * 3),
          color = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const src = (stand * n + i) * 3;
          position[i * 3] = ((q[src] + 32767) / 65534) * ex + lx;
          position[i * 3 + 1] = ((q[src + 1] + 32767) / 65534) * ey + ly;
          position[i * 3 + 2] = ((q[src + 2] + 32767) / 65534) * ez + lz;
          normal[i * 3] = nn[src] / 127;
          normal[i * 3 + 1] = nn[src + 1] / 127;
          normal[i * 3 + 2] = nn[src + 2] / 127;
          // The texture over the coat (x 128): brighter than the coat stays brighter, a dark nose stays dark.
          for (let k = 0; k < 3; k++) color[i * 3 + k] = Math.pow(arrays.colour[i * 3 + k] / 128, 2.2);
        }
        geo.setAttribute('position', new Three.BufferAttribute(position, 3));
        geo.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        geo.setAttribute('color', new Three.BufferAttribute(color, 3));
        geo.setIndex(new Three.BufferAttribute(new Uint16Array(arrays.index), 1));
        geo.computeBoundingSphere();
        const capacity = 160,
          pose = new Three.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        pose.setUsage(Three.DynamicDrawUsage);
        geo.setAttribute('dogPose', pose);
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.86, metalness: 0 });
        material.onBeforeCompile = dogPatch;
        material.customProgramCacheKey = () => 'dog-frames';
        const part = crowdPart('dog model', geo, material, capacity);
        const depth = new Three.MeshDepthMaterial({ depthPacking: Three.RGBADepthPacking });
        depth.onBeforeCompile = dogPatch;
        depth.customProgramCacheKey = () => 'dog-frames-depth';
        part.mesh.customDepthMaterial = depth;
        part.pose = pose;
        part.dog = header;
        return part;
      }
      const dogModelPart = makeDogModelPart();
      // Console before/after (dogModelOn(false): the box dog).
      let dogModelOn = true;
      /* One dog: its root matrix (paws on the ground, facing its heading) and pose. */
      function emitDogModel(matrix, color, phase, trot, sit, sniff) {
        const part = dogModelPart;
        if (part.n >= part.capacity) return;
        const i = part.n,
          a = part.pose.array;
        a[i * 4] = phase;
        a[i * 4 + 1] = trot;
        a[i * 4 + 2] = sit;
        a[i * 4 + 3] = sniff;
        crowdEmit(part, matrix, 1, 1, 1, color);
      }
      // Console (dogModel()): what the build carries and how many dogs were drawn last frame.
      function dogModelReport() {
        if (!dogModelPart) return { loaded: false };
        const h = dogModelPart.dog;
        return { loaded: true, title: h.title, vertices: h.vertices, triangles: h.triangles, frames: h.frames, length: h.length, height: h.height, collar: h.collar, drawn: dogModelPart.mesh.visible ? dogModelPart.mesh.count : 0 };
      }
