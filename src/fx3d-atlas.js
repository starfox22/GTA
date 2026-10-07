      // The effect particles' texture atlas (fx3d-particles.js): four billowed smoke puffs with their surface normals,
      // a glow, a muzzle flash star, the broken-glass glints and a drop, baked a slice a frame behind the title.
      /**
       * FX ATLAS: 512 x 256, eight 128-pixel frames, 4 across and 2 down (frame k at column k % 4,
       * row k >> 2; row 0 is the bottom of the texture, v = 0):
       *  0-3  PUFFS: a cluster of overlapping spheres with fBm noise on its surface and in its density.
       *       A: opacity, 1 - exp(-thickness) through the cluster (the spheres' depths add, so the
       *          middle is dense and the edges thin out into wisps). RG: the front surface's normal
       *          (x, y as 0..1), so the sun lights one side of each billow and the other side falls
       *          into shade: the volume a flat sprite lacks at eye level. B: thickness, 0..1.
       *  4    GLOW: the round soft halo of a spark, an ember or a flash core (the lamp halo's profile).
       *  5    FLASH: a muzzle flash, a hot core and five uneven spikes.
       *  6    GLASS: a scatter of sharp glints (the broken-glass sprite: tempered glass bursts into a
       *       shower of small cubes, so it tumbles as a glitter, never a soft puff).
       *  7    DROP: a hard-edged drop (blood, water, casings and chips: a few pixels across).
       * Frames 4-7 have a flat normal (RG 0.5), so they are lit like a card facing the camera.
       * Every frame fades to nothing well inside its square, so the mip chain never bleeds one frame
       * into the next.
       * BAKING: fxBakeAtlas is a generator that yields every few rows; fxAtlasStep (from the particle
       * draw, every frame until it is done) runs it for a couple of milliseconds a frame, so the ~10 ms
       * of work (several times that before the JIT has warmed up) never lands in one frame. The texture
       * is uploaded once, when the last slice is done; no Math.random (a seeded LCG).
       */
      const FX_FRAME = 128,
        FX_ATLAS_COLUMNS = 4,
        FX_ATLAS_ROWS = 2,
        FX_PUFF_FRAMES = 4,
        FX_GLOW = 4,
        FX_FLASH = 5,
        FX_GLASS = 6,
        FX_DROP = 7;
      function* fxBakeAtlas(data) {
        const width = FX_FRAME * FX_ATLAS_COLUMNS,
          S = FX_FRAME;
        // A deterministic lattice for value noise (a seeded LCG: the game's Math.random stream is left alone).
        let seed = 0x9e3779b9;
        const next = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        const put = (frame, px, py, r, g, b, a) => {
          const o = (((frame >> 2) * S + py) * width + (frame & 3) * S + px) * 4;
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = a;
        };
        // Smooth value noise over the frame, one octave at a time and separable (rows first, then down the
        // columns): a few operations a pixel instead of a lattice lookup per sample.
        const rows = new Float32Array(65 * S),
          lattice = new Float32Array(65 * 65);
        const addOctave = (field, cells, amp) => {
          for (let i = 0; i < (cells + 1) * (cells + 1); i++) lattice[i] = next();
          for (let j = 0; j <= cells; j++)
            for (let px = 0; px < S; px++) {
              const x = ((px + 0.5) / S) * cells,
                xi = Math.floor(x),
                f = x - xi,
                a = lattice[j * (cells + 1) + xi];
              rows[j * S + px] = a + (lattice[j * (cells + 1) + xi + 1] - a) * f * f * (3 - 2 * f);
            }
          for (let py = 0; py < S; py++) {
            const y = ((py + 0.5) / S) * cells,
              yi = Math.floor(y),
              f = y - yi,
              k = f * f * (3 - 2 * f);
            for (let px = 0; px < S; px++) {
              const a = rows[yi * S + px];
              field[py * S + px] += (a + (rows[(yi + 1) * S + px] - a) * k) * amp;
            }
          }
        };
        function* fbmField(field, cells) {
          field.fill(0);
          addOctave(field, cells, 0.5 / 0.875);
          yield;
          addOctave(field, cells * 2, 0.25 / 0.875);
          yield;
          addOctave(field, cells * 4, 0.125 / 0.875);
        }
        // ---- Puffs ----
        // exp(-2.3 q) for q = dd / rr in 0..2.6, in 1/24 steps (a ball's density by its squared radius).
        const gauss = new Float32Array(66);
        for (let k = 0; k < gauss.length; k++) gauss[k] = Math.exp((-2.3 * k) / 24);
        const heightField = new Float32Array(S * S),
          thickField = new Float32Array(S * S),
          warpField = new Float32Array(S * S),
          surfaceField = new Float32Array(S * S),
          densityField = new Float32Array(S * S);
        for (let frame = 0; frame < FX_PUFF_FRAMES; frame++) {
          const blobs = [],
            count = 7 + frame;
          // One sphere in the middle, the rest round it (u, v in -1..1 across the frame).
          blobs.push([0, -0.05, 0.4]);
          for (let i = 1; i < count; i++) {
            const a = next() * Math.PI * 2,
              d = 0.2 + next() * 0.24;
            blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.85 - 0.04, 0.17 + next() * 0.17]);
          }
          yield* fbmField(warpField, 3);
          yield* fbmField(surfaceField, 10);
          yield* fbmField(densityField, 7);
          yield;
          let thickMax = 0;
          for (let py = 0; py < S; py++) {
            if ((py & 7) === 7) yield;
            for (let px = 0; px < S; px++) {
              const i = py * S + px,
                u = ((px + 0.5) / S) * 2 - 1,
                v = ((py + 0.5) / S) * 2 - 1,
                // The outline wanders with the noise, so no billow is a perfect circle.
                warp = (warpField[i] - 0.5) * 0.16,
                wu = u + warp,
                wv = v - warp * 0.7;
              let top = 0,
                thick = 0;
              for (let k = 0; k < blobs.length; k++) {
                const b = blobs[k],
                  du = wu - b[0],
                  dv = wv - b[1],
                  rr = b[2] * b[2],
                  dd = du * du + dv * dv;
                // Density: a soft (Gaussian) ball, so the outline thins out instead of ending at a rim.
                if (dd < rr * 2.6) {
                  const q = (dd / rr) * 24,
                    n = q | 0;
                  thick += 2 * b[2] * (gauss[n] + (gauss[n + 1] - gauss[n]) * (q - n));
                }
                if (dd < rr) {
                  // The surface the light sees: the spheres' fronts, joined by a smooth maximum (creases
                  // between billows, no aliasing).
                  const h = Math.sqrt(rr - dd),
                    m = Math.min(1, Math.max(0, 0.5 + (h - top) * 7));
                  top = top + (h - top) * m + 0.07 * m * (1 - m);
                }
              }
              heightField[i] = top > 0 ? top + (surfaceField[i] - 0.5) * 0.05 : 0;
              thick *= 0.55 + 0.9 * densityField[i];
              thickField[i] = thick;
              if (thick > thickMax) thickMax = thick;
            }
          }
          const step2 = 4 / S;
          for (let py = 0; py < S; py++) {
            if ((py & 7) === 7) yield;
            for (let px = 0; px < S; px++) {
              const i = py * S + px,
                u = ((px + 0.5) / S) * 2 - 1,
                v = ((py + 0.5) / S) * 2 - 1,
                edge = Math.min(1, Math.max(0, (0.97 - Math.sqrt(u * u + v * v)) / 0.12)),
                alpha = (1 - Math.exp(-thickField[i] * 2.8)) * edge;
              let r = 128,
                g = 128;
              if (alpha > 0.004) {
                const hx = (heightField[py * S + Math.min(S - 1, px + 1)] - heightField[py * S + Math.max(0, px - 1)]) / step2,
                  hy = (heightField[Math.min(S - 1, py + 1) * S + px] - heightField[Math.max(0, py - 1) * S + px]) / step2,
                  // Steep sphere rims are capped so the normal stays finite at the outline.
                  scale = Math.min(1, 2.4 / Math.max(1e-6, Math.sqrt(hx * hx + hy * hy))),
                  ux = -hx * scale,
                  uy = -hy * scale,
                  inv = 1 / Math.sqrt(ux * ux + uy * uy + 1);
                r = Math.round((ux * inv * 0.5 + 0.5) * 255);
                g = Math.round((uy * inv * 0.5 + 0.5) * 255);
              }
              put(frame, px, py, r, g, Math.round(Math.min(1, thickField[i] / thickMax) * 255), Math.round(alpha * 255));
            }
          }
        }
        // ---- Glow, flash, drop (analytic, radial profiles from tables) ----
        const PROFILE = 256,
          glowTable = new Float32Array(PROFILE + 1),
          coreTable = new Float32Array(PROFILE + 1);
        for (let k = 0; k <= PROFILE; k++) {
          const r = (k / PROFILE) * 1.5,
            r2 = r * r,
            edge = Math.min(1, Math.max(0, (0.98 - r) / 0.1));
          // Glow: the lamp halo's falloff (a bright core, a long soft skirt).
          glowTable[k] = (Math.exp(-r2 * 26) * 0.62 + Math.exp(-r2 * 5.5) * 0.38) * edge;
          coreTable[k] = (Math.exp(-r2 * 40) + Math.exp(-r2 * 7) * 0.3) * edge;
        }
        const spikes = [
          [0.2, 0.92],
          [1.45, 0.62],
          [2.6, 0.84],
          [3.9, 0.55],
          [5.05, 0.74],
        ].map(([angle, length]) => [Math.cos(angle), Math.sin(angle), 1 / length]);
        const tilt = Math.cos(0.25),
          lean = Math.sin(0.25);
        for (let py = 0; py < S; py++) {
          if ((py & 7) === 7) yield;
          for (let px = 0; px < S; px++) {
            const u = ((px + 0.5) / S) * 2 - 1,
              v = ((py + 0.5) / S) * 2 - 1,
              r = Math.sqrt(u * u + v * v),
              k = Math.min(PROFILE, Math.round((r / 1.5) * PROFILE)),
              edge = Math.min(1, Math.max(0, (0.98 - r) / 0.1));
            put(FX_GLOW, px, py, 128, 128, 255, Math.round(Math.min(1, glowTable[k]) * 255));
            // Flash: a white core and uneven spikes, the way a muzzle flash photographs.
            let spike = 0;
            if (r > 1e-4)
              for (let n = 0; n < spikes.length; n++) {
                // cos(angle to the spike), raised to the 26th power by squaring, shortening along it.
                const along = Math.max(0, (u * spikes[n][0] + v * spikes[n][1]) / r),
                  a2 = along * along,
                  a8 = a2 * a2 * a2 * a2,
                  lobe = a8 * a8 * a8 * a2 * Math.max(0, 1 - r * spikes[n][2]);
                if (lobe > spike) spike = lobe;
              }
            put(FX_FLASH, px, py, 128, 128, 255, Math.round(Math.min(1, coreTable[k] + spike * 0.95 * edge) * 255));
            // Drop: a hard-edged ellipse, a little tilted (the old blood drop sprite's shape).
            const eu = (u * tilt + v * lean) / 0.56,
              ev = (-u * lean + v * tilt) / 0.81;
            put(FX_DROP, px, py, 128, 128, 255, Math.round(Math.min(1, Math.max(0, (1 - Math.sqrt(eu * eu + ev * ev)) * 18)) * 255));
          }
        }
        yield;
        // ---- Glass: the glints, drawn as the broken-glass canvas sprite was (at twice its size) ----
        const glassCanvas = document.createElement('canvas');
        glassCanvas.width = glassCanvas.height = S;
        const gc = glassCanvas.getContext('2d', { willReadFrequently: true });
        if (gc) {
          const k2 = S / 64;
          for (let i = 0; i < 22; i++) {
            const a = i * 2.39996,
              rr = 3 + 26 * Math.sqrt((i + 0.5) / 22),
              x = (32 + Math.cos(a) * rr) * k2,
              y = (32 + Math.sin(a) * rr) * k2,
              k = (0.9 + (i % 3) * 0.8) * k2;
            gc.fillStyle = i % 4 === 0 ? '#ffffff' : i % 4 === 1 ? '#ffffffd0' : '#ffffff90';
            gc.beginPath();
            gc.moveTo(x, y - k * 1.3);
            gc.lineTo(x + k, y + k * 0.7);
            gc.lineTo(x - k * 0.9, y + k * 0.5);
            gc.closePath();
            gc.fill();
          }
          const pixels = gc.getImageData(0, 0, S, S).data;
          for (let py = 0; py < S; py++)
            for (let px = 0; px < S; px++) put(FX_GLASS, px, py, 128, 128, 255, pixels[((S - 1 - py) * S + px) * 4 + 3]);
        }
      }
      // The atlas texture: empty until the bake's last slice is done (nothing is drawn with it before an effect).
      const fxAtlasData = new Uint8Array(FX_FRAME * FX_ATLAS_COLUMNS * FX_FRAME * FX_ATLAS_ROWS * 4),
        fxAtlas = new Three.DataTexture(fxAtlasData, FX_FRAME * FX_ATLAS_COLUMNS, FX_FRAME * FX_ATLAS_ROWS, Three.RGBAFormat, Three.UnsignedByteType);
      fxAtlas.magFilter = Three.LinearFilter;
      fxAtlas.minFilter = Three.LinearMipmapLinearFilter;
      fxAtlas.generateMipmaps = true;
      fxAtlas.name = 'fx atlas';
      let fxAtlasBake = fxBakeAtlas(fxAtlasData),
        fxAtlasBakeMs = 0;
      /* Runs the bake for about `budgetMs`; uploads the texture when it is done. True once it is. */
      function fxAtlasStep(budgetMs) {
        if (!fxAtlasBake) return true;
        const started = performance.now();
        do {
          if (fxAtlasBake.next().done) {
            fxAtlasBake = null;
            // Uploaded now (with its mip chain), in a frame that is already paying for the bake.
            fxAtlas.needsUpdate = true;
            renderer.initTexture(fxAtlas);
            break;
          }
        } while (performance.now() - started < budgetMs);
        fxAtlasBakeMs += performance.now() - started;
        return !fxAtlasBake;
      }
