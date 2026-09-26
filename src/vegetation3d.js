      // BEGIN SUBSYSTEM: src/vegetation3d.js — Tree library: species, foliage atlas, wind, LOD
      /**
       * Tree library
       * Source: src/vegetation3d.js
       * Scope: createCityRenderer() closure (included where the street trees are
       * planted, after the breakable scenery helpers and before world3d.js, whose
       * makePalm() comes here).
       *
       * Every tree in the world is one of the species in TREE_SPECIES, modelled
       * once per level of detail as a single geometry and drawn as instances:
       *
       *   broadleaf   London plane, linden, honey locust, Bradford pear, maple,
       *               oak, weeping willow, jacaranda, flame tree, cherry, beech,
       *               birch; a trunk that forks into limbs reaching under the
       *               crown's edge, and a crown of overlapping lobes, each a lumpy
       *               core wrapped in leaf-cluster cards, so the edge seen from
       *               above breaks up into foliage rather than a ball
       *   conifers    spruce (drooping bough whorls), fir (dense, level boughs),
       *               pine (a bare trunk under tufted crown clumps), Italian
       *               cypress (a dark column) and stone pine (a flat umbrella)
       *   palms       Canary date palm (thick trunk, a dense ball of fronds),
       *               Mexican fan palm (tall and thin, fan leaves over a skirt
       *               of dead ones), coconut (a bowed trunk, long drooping
       *               fronds, nuts), royal palm (a smooth grey trunk, green
       *               crownshaft); fronds are curved, keeled blades
       *
       * All of it shares one material (treeMaterial) over one procedural texture
       * atlas (foliageAtlas: leaf clusters, needle boughs, willow strands,
       * blossom, pinnate and fan fronds, eight barks) with a normal map baked
       * from the painted height. The atlas is near neutral; the colour is in the
       * vertex colours (the species) and the instance colour (a per-tree jitter,
       * autumn and blossom accents), which tints only the leaves. So each species
       * is one draw per breakable cell and level of detail, like the plain lobes
       * it replaced. Each geometry carries:
       *   foliage  (leaf mask, sway weight): what the wind moves and the tint reaches
       *   morph    a per-vertex offset, scaled per instance from -1 to 1: a crown
       *            that spreads or stays upright, boughs that droop or lift, fronds
       *            that hang: continuous variants of the same species at no cost
       * and each instance an `instanceFoliage` (morph, density: sparser crowns
       * drop more of their leaf pixels). Wind sways crowns and fronds in the
       * vertex shader (and in the shadow pass, whose depth material shares the
       * patch). Per tree: scale +-18%, a height/width aspect, a lean, a turn, the
       * tint, the morph and the density, all from a hash of its position, so the
       * city is the same every visit.
       *
       * Levels of detail: `near` (the modelled tree), `mid` (a few lumpy blobs and
       * a trunk, ~60 triangles) from street zoom ~0.5 out and in the flight view
       * beyond ~1.4 km, and the far city's merged copy (flight-view3d.js FAR
       * SCENERY), which gets one plain crown blob per tree (`noteFarTree`).
       * Breakable trees keep working: the near and mid meshes are both instances
       * linked to the tree's prop (render3d.js BREAKABLE SCENERY), so a felled
       * tree falls, leaves its stump and is replanted whole.
       */
      const FOLIAGE_ATLAS = 1024,
        ATLAS_CELLS = {
          leafRound: [0, 0, 256, 256],
          leafLobed: [256, 0, 256, 256],
          leafFine: [512, 0, 256, 256],
          needle: [768, 0, 256, 256],
          willow: [0, 256, 256, 256],
          blossom: [256, 256, 256, 256],
          fan: [512, 256, 256, 256],
          scale: [768, 256, 256, 256],
          frond: [0, 512, 512, 128],
          thatch: [512, 512, 256, 128],
          // Pine tufts: needle pompoms in clumps (pines, stone pines).
          tuft: [768, 512, 256, 256],
        },
        // Bark strips along the bottom: 0 plane (mottled), 1 furrowed, 2 smooth
        // with rings, 3 date palm leaf bases, 4 palm rings, 5 pine plates, 6 birch,
        // 7 fine scaly.
        barkCell = (i) => [i * 128, 768, 128, 256];
      // A small seeded generator (mulberry32): tree shapes and placement never
      // touch the game's seeded sequence.
      function vegRandom(seed) {
        let s = seed >>> 0 || 1;
        return () => {
          s = (s + 0x6d2b79f5) >>> 0;
          let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      const vegSeed = (x, y, salt = 0) => (Math.imul(Math.round(x) | 0, 73856093) ^ Math.imul(Math.round(y) | 0, 19349663) ^ Math.imul(salt + 7, 83492791)) >>> 0;
      const vegHash = (x, y, salt = 0) => vegRandom(vegSeed(x, y, salt))();
      // An atlas cell as UV bounds, inset so mipmaps do not bleed across cells.
      function atlasUV(cell, inset = 3) {
        const [x, y, w, h] = cell;
        return { u0: (x + inset) / FOLIAGE_ATLAS, du: (w - inset * 2) / FOLIAGE_ATLAS, v0: 1 - (y + h - inset) / FOLIAGE_ATLAS, dv: (h - inset * 2) / FOLIAGE_ATLAS };
      }
      /* ---- The atlas ------------------------------------------------------------------ */
      // Painted once at start-up on two canvases: colour (near-neutral values,
      // alpha for the leaf shapes) and height (for the normal map).
      function paintFoliageAtlas() {
        const colorCanvas = document.createElement('canvas'),
          heightCanvas = document.createElement('canvas');
        colorCanvas.width = colorCanvas.height = heightCanvas.width = heightCanvas.height = FOLIAGE_ATLAS;
        const c = colorCanvas.getContext('2d'),
          h = heightCanvas.getContext('2d');
        h.fillStyle = '#404040';
        h.fillRect(0, 0, FOLIAGE_ATLAS, FOLIAGE_ATLAS);
        const random = vegRandom(20260926);
        const between = (a, b) => a + random() * (b - a);
        // Near-neutral fills: a warm or cool cast so a crown is not one flat hue.
        const tone = (v, warm = 0) =>
          `rgb(${Math.round(Math.min(255, v * (236 + warm * 14)))},${Math.round(Math.min(255, v * 242))},${Math.round(Math.min(255, v * (226 - warm * 16)))})`;
        const grey = (v) => {
          const g = Math.round(Math.max(0, Math.min(255, v * 255)));
          return `rgb(${g},${g},${g})`;
        };
        // Draws the current path on both canvases.
        function fillBoth(value, height, warm = 0) {
          c.fillStyle = tone(value, warm);
          c.fill();
          h.fillStyle = grey(height);
          h.fill();
        }
        function strokeBoth(value, height, width, warm = 0) {
          c.strokeStyle = tone(value, warm);
          h.strokeStyle = grey(height);
          c.lineWidth = h.lineWidth = width;
          c.stroke();
          h.stroke();
        }
        function inCell(cell, paint) {
          const [x, y, w, hh] = cell;
          for (const g of [c, h]) {
            g.save();
            g.beginPath();
            g.rect(x, y, w, hh);
            g.clip();
            g.translate(x, y);
          }
          paint(cell[2], cell[3]);
          c.restore();
          h.restore();
        }
        // The path API is shared by the two contexts: build each path on both.
        const path = (build) => {
          for (const g of [c, h]) {
            g.beginPath();
            build(g);
          }
        };
        function leafPath(g, shape, x, y, len, wid, angle) {
          const ca = Math.cos(angle),
            sa = Math.sin(angle),
            P = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
          if (shape === 'lobed') {
            // A five-lobed leaf (plane, maple, oak): alternate tips and notches.
            for (let k = 0; k <= 10; k++) {
              const a = (k / 10) * TAU,
                r = (k % 2 ? 0.48 : 1) * len * 0.5,
                [px, py] = P(Math.cos(a) * r, Math.sin(a) * r * (wid / len) * 1.6);
              if (k) g.lineTo(px, py);
              else g.moveTo(px, py);
            }
            g.closePath();
          } else {
            // Pointed oval (linden, pear, willow, leaflets).
            const [ax, ay] = P(-len / 2, 0),
              [bx, by] = P(len / 2, 0),
              [c1x, c1y] = P(0, wid),
              [c2x, c2y] = P(0, -wid);
            g.moveTo(ax, ay);
            g.quadraticCurveTo(c1x, c1y, bx, by);
            g.quadraticCurveTo(c2x, c2y, ax, ay);
            g.closePath();
          }
        }
        // A cluster of leaf clumps: a dark, dense inner canopy first (depth, and
        // no see-through holes in the middle), then leaves rosetted round each
        // clump centre, the later (upper) ones brighter. The outline stays ragged.
        function clumps(cell, o) {
          inCell(cell, (w, hh) => {
            const centres = [];
            for (let i = 0; i < o.clumps; i++) {
              const a = random() * TAU,
                d = Math.pow(random(), 0.6) * o.radius * w;
              centres.push([w / 2 + Math.cos(a) * d, hh / 2 + Math.sin(a) * d]);
            }
            // A solid, lumpy middle, so a card or crown core never shows sky
            // through its heart; only the rim of leaves is cut out.
            for (let i = 0; i < 9; i++) {
              const a = (i / 9) * TAU;
              path((g) => g.arc(w / 2 + Math.cos(a) * w * 0.12, hh / 2 + Math.sin(a) * w * 0.12, w * o.radius * between(0.62, 0.78), 0, TAU));
              fillBoth(between(0.3, 0.36), 0.15);
            }
            for (const [x, y] of centres) {
              path((g) => g.arc(x, y, o.len * between(1.1, 1.5), 0, TAU));
              fillBoth(between(0.26, 0.34), 0.2);
            }
            centres.sort((p, q) => q[1] - p[1]);
            for (const [x, y] of centres) {
              const lift = 1 - y / hh;
              for (let k = 0; k < o.leaves; k++) {
                const a = random() * TAU,
                  d = Math.sqrt(random()) * o.len * 1.5,
                  lx = x + Math.cos(a) * d,
                  ly = y + Math.sin(a) * d,
                  value = between(0.62, 0.95) + lift * 0.12,
                  len = o.len * between(0.75, 1.15);
                if (o.shape === 'fine') {
                  // A compound leaf: a stalk with pairs of tiny leaflets.
                  const ang = a + between(-0.5, 0.5),
                    ca = Math.cos(ang),
                    sa = Math.sin(ang);
                  for (let j = 0; j < 5; j++) {
                    const s = (j / 4 - 0.4) * len,
                      px = lx + ca * s,
                      py = ly + sa * s;
                    for (const side of [-1, 1]) {
                      path((g) => leafPath(g, 'round', px - sa * side * len * 0.16, py + ca * side * len * 0.16, len * 0.3, len * 0.1, ang + side * 1.1));
                      fillBoth(value * between(0.9, 1.05), 0.45 + value * 0.5, o.warm || 0);
                    }
                  }
                } else {
                  path((g) => leafPath(g, o.shape, lx, ly, len, len * (o.shape === 'lobed' ? 0.5 : 0.34), a + between(-0.6, 0.6)));
                  fillBoth(value, 0.45 + value * 0.5, o.warm || 0);
                  // Midrib: a darker line catches the light at close range.
                  if (o.shape !== 'lobed' && len > 14) {
                    path((g) => {
                      g.moveTo(lx - Math.cos(a) * len * 0.4, ly - Math.sin(a) * len * 0.4);
                      g.lineTo(lx + Math.cos(a) * len * 0.4, ly + Math.sin(a) * len * 0.4);
                    });
                    strokeBoth(value * 0.72, 0.42 + value * 0.4, 1);
                  }
                }
              }
            }
          });
        }
        clumps(ATLAS_CELLS.leafRound, { clumps: 40, leaves: 18, len: 17, radius: 0.37, shape: 'round' });
        clumps(ATLAS_CELLS.leafLobed, { clumps: 38, leaves: 16, len: 20, radius: 0.37, shape: 'lobed' });
        clumps(ATLAS_CELLS.leafFine, { clumps: 34, leaves: 8, len: 24, radius: 0.36, shape: 'fine', warm: 0.3 });
        // Dense scale foliage (cypress, clipped limes): tight overlapping sprays.
        clumps(ATLAS_CELLS.scale, { clumps: 80, leaves: 16, len: 11, radius: 0.4, shape: 'round' });
        // Needle bough: a twig from the base (bottom) to the tip (top), side
        // twigs and needles, over a dark underlayer in the bough's outline.
        inCell(ATLAS_CELLS.needle, (w, hh) => {
          const outline = (g, k) => {
            g.moveTo(w / 2, hh * 0.97);
            g.bezierCurveTo(w * (0.5 - 0.46 * k), hh * 0.62, w * (0.5 - 0.3 * k), hh * 0.2, w / 2, hh * 0.03);
            g.bezierCurveTo(w * (0.5 + 0.3 * k), hh * 0.2, w * (0.5 + 0.46 * k), hh * 0.62, w / 2, hh * 0.97);
          };
          path((g) => outline(g, 0.8));
          fillBoth(0.3, 0.2);
          const twig = (x0, y0, x1, y1, width) => {
            path((g) => {
              g.moveTo(x0, y0);
              g.lineTo(x1, y1);
            });
            strokeBoth(0.4, 0.45, width, 0.6);
          };
          const needles = (x0, y0, x1, y1, len) => {
            const n = Math.hypot(x1 - x0, y1 - y0) / 2.2,
              a = Math.atan2(y1 - y0, x1 - x0);
            for (let k = 0; k < n; k++) {
              const t = k / n,
                px = x0 + (x1 - x0) * t,
                py = y0 + (y1 - y0) * t;
              for (const side of [-1, 1]) {
                const na = a + side * between(0.7, 1.2) - 0.25,
                  l = len * between(0.7, 1.2) * (1 - t * 0.45);
                path((g) => {
                  g.moveTo(px, py);
                  g.lineTo(px + Math.cos(na) * l, py + Math.sin(na) * l);
                });
                strokeBoth(between(0.7, 1.05), between(0.55, 1), 1.7);
              }
            }
          };
          twig(w / 2, hh * 0.98, w / 2, hh * 0.04, 3);
          for (let y = hh * 0.9; y > hh * 0.1; y -= 17) {
            const t = 1 - y / hh,
              reach = Math.sin(Math.PI * Math.min(1, 0.12 + t)) * w * 0.34;
            for (const side of [-1, 1]) {
              const ex = w / 2 + side * reach,
                ey = y - reach * 0.75;
              twig(w / 2, y, ex, ey, 1.6);
              needles(w / 2, y, ex, ey, 11);
            }
          }
          needles(w / 2, hh * 0.98, w / 2, hh * 0.04, 12);
        });
        // Pine tufts: pompoms of needles radiating from each shoot tip, in
        // clumps over a shaded bed (pines and stone pines seen from above).
        inCell(ATLAS_CELLS.tuft, (w, hh) => {
          const centres = [];
          for (let i = 0; i < 22; i++) {
            const a = random() * TAU,
              d = Math.pow(random(), 0.6) * 0.34 * w;
            centres.push([w / 2 + Math.cos(a) * d, hh / 2 + Math.sin(a) * d]);
          }
          path((g) => g.arc(w / 2, hh / 2, w * 0.27, 0, TAU));
          fillBoth(0.28, 0.15);
          for (const [x, y] of centres) {
            path((g) => g.arc(x, y, between(20, 27), 0, TAU));
            fillBoth(between(0.26, 0.32), 0.2);
          }
          centres.sort((p, q) => q[1] - p[1]);
          for (const [x, y] of centres)
            for (let k = 0; k < 7; k++) {
              const px = x + between(-15, 15),
                py = y + between(-15, 15),
                lift = 1 - py / hh;
              for (let n = 0; n < 22; n++) {
                const a = random() * TAU,
                  l = between(7, 15);
                path((g) => {
                  g.moveTo(px, py);
                  g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
                });
                strokeBoth(between(0.62, 0.98) + lift * 0.1, between(0.5, 1), 1.6, 0.2);
              }
            }
        });
        // Willow: strands hanging from the top edge, narrow leaves down each.
        inCell(ATLAS_CELLS.willow, (w, hh) => {
          for (let i = 0; i < 34; i++) {
            const x0 = between(10, w - 10),
              len = hh * between(0.55, 0.97),
              sway = between(-14, 14);
            path((g) => {
              g.moveTo(x0, 0);
              g.quadraticCurveTo(x0 + sway, len * 0.5, x0 + sway * 0.4, len);
            });
            strokeBoth(0.35, 0.3, 1.4);
            for (let y = 6; y < len; y += 5) {
              const t = y / len,
                px = x0 + sway * (2 * t * (1 - t)) + sway * 0.4 * t * t;
              for (const side of [-1, 1]) {
                path((g) => leafPath(g, 'round', px + side * 4, y + 3, 11, 2.4, Math.PI / 2 - side * 0.5));
                fillBoth(between(0.6, 1), between(0.5, 1), 0.4);
              }
            }
          }
        });
        // Blossom: clusters of five-petalled flowers, packed over a shaded bed.
        inCell(ATLAS_CELLS.blossom, (w, hh) => {
          const centres = [];
          for (let i = 0; i < 44; i++) {
            const a = random() * TAU,
              d = Math.pow(random(), 0.6) * 0.37 * w;
            centres.push([w / 2 + Math.cos(a) * d, hh / 2 + Math.sin(a) * d]);
          }
          path((g) => g.arc(w / 2, hh / 2, w * 0.28, 0, TAU));
          fillBoth(0.52, 0.3);
          for (const [x, y] of centres) {
            path((g) => g.arc(x, y, between(15, 20), 0, TAU));
            fillBoth(between(0.5, 0.6), 0.3);
          }
          for (const [x, y] of centres)
            for (let k = 0; k < 9; k++) {
              const fx = x + between(-13, 13),
                fy = y + between(-13, 13),
                s = between(2.6, 3.8),
                value = between(0.85, 1.05);
              for (let p = 0; p < 5; p++) {
                const a = (p / 5) * TAU + k;
                path((g) => g.arc(fx + Math.cos(a) * s, fy + Math.sin(a) * s, s * 0.95, 0, TAU));
                fillBoth(value, 0.6 + value * 0.3);
              }
              path((g) => g.arc(fx, fy, s * 0.55, 0, TAU));
              fillBoth(value * 0.7, 0.9);
            }
        });
        // Fan leaf (Mexican fan palm): pleated segments radiating from a hub at
        // the bottom centre, drawn on an ellipse the geometry maps back to a circle;
        // the tips split into ribbons.
        inCell(ATLAS_CELLS.fan, (w, hh) => {
          const hubX = w / 2,
            hubY = hh * 0.94,
            P = (phi, rho) => [hubX + Math.sin(phi) * rho * w * 0.47, hubY - Math.cos(phi) * rho * hh * 0.9];
          const segments = 34;
          for (let s = 0; s < segments; s++) {
            const a0 = -1.6 + (s / segments) * 3.2,
              a1 = -1.6 + ((s + 1) / segments) * 3.2,
              am = (a0 + a1) / 2,
              split = between(0.62, 0.8),
              value = s % 2 ? between(0.85, 1) : between(0.62, 0.74);
            path((g) => {
              g.moveTo(...P(am, 0.05));
              g.lineTo(...P(a0, split));
              g.lineTo(...P(a0 + 0.01, between(0.9, 1.0)));
              g.lineTo(...P(am, split + 0.04));
              g.lineTo(...P(a1 - 0.01, between(0.9, 1.0)));
              g.lineTo(...P(a1, split));
              g.closePath();
            });
            fillBoth(value, s % 2 ? 0.9 : 0.55);
          }
          path((g) => g.arc(hubX, hubY, 6, 0, TAU));
          fillBoth(0.5, 0.6);
        });
        // Pinnate frond (date, coconut, royal palms): the base on the left, the
        // tip on the right; a rachis down the middle and leaflets swept towards
        // the tip, longest a third of the way out.
        inCell(ATLAS_CELLS.frond, (w, hh) => {
          const mid = hh / 2;
          for (let x = 18; x < w - 6; x += 3.2) {
            const t = x / w,
              len = hh * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + t * 1.02)), 0.55) * (1 - t * 0.25);
            for (const side of [-1, 1]) {
              const a = side * between(0.95, 1.2),
                ex = x + Math.cos(a - side * 0.35) * len * 0.55 + len * 0.35,
                ey = mid + Math.sin(a) * len;
              path((g) => {
                g.moveTo(x, mid);
                g.quadraticCurveTo(x + len * 0.25, mid + side * len * 0.55, ex, ey);
              });
              strokeBoth(between(0.66, 1), between(0.55, 1), 2.6 * (1 - t * 0.5) + 0.8, 0.2);
            }
          }
          path((g) => {
            g.moveTo(0, mid);
            g.lineTo(w, mid);
          });
          strokeBoth(0.62, 0.95, 4, 0.8);
        });
        // Thatch: the skirt of dead fronds a fan palm keeps under its crown.
        inCell(ATLAS_CELLS.thatch, (w, hh) => {
          c.fillStyle = tone(0.42, 1);
          c.fillRect(0, 0, w, hh * 0.8);
          for (let i = 0; i < 260; i++) {
            const x = between(0, w),
              len = hh * between(0.5, 1);
            path((g) => {
              g.moveTo(x, between(0, hh * 0.2));
              g.lineTo(x + between(-6, 6), len);
            });
            strokeBoth(between(0.5, 1), between(0.4, 1), between(2, 5), 1);
          }
        });
        // Barks.
        const barkNoise = (w, hh, n, lo, hi, size) => {
          for (let i = 0; i < n; i++) {
            path((g) => g.rect(between(0, w), between(0, hh), size * between(0.5, 1.5), size * between(0.5, 1.5)));
            fillBoth(between(lo, hi), between(0.3, 0.7), 0.5);
          }
        };
        inCell(barkCell(0), (w, hh) => {
          // Plane: flaking camouflage patches.
          c.fillStyle = tone(0.78, 0.4);
          c.fillRect(0, 0, w, hh);
          for (let i = 0; i < 70; i++) {
            const x = between(-10, w),
              y = between(-10, hh),
              r = between(8, 22);
            path((g) => {
              for (let k = 0; k < 7; k++) {
                const a = (k / 7) * TAU,
                  rr = r * between(0.6, 1.2);
                g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr * 1.4);
              }
              g.closePath();
            });
            fillBoth(between(0.5, 1), between(0.4, 0.8), between(-0.5, 1));
          }
        });
        inCell(barkCell(1), (w, hh) => {
          // Furrowed: vertical ridges and dark fissures.
          c.fillStyle = tone(0.55, 0.5);
          c.fillRect(0, 0, w, hh);
          h.fillStyle = grey(0.6);
          h.fillRect(0, 0, w, hh);
          for (let i = 0; i < 26; i++) {
            let x = between(0, w);
            path((g) => {
              g.moveTo(x, 0);
              for (let y = 0; y < hh; y += 16) g.lineTo((x += between(-4, 4)), y);
            });
            strokeBoth(between(0.18, 0.3), 0.1, between(1.5, 3.5));
          }
          barkNoise(w, hh, 300, 0.45, 0.85, 3);
        });
        inCell(barkCell(2), (w, hh) => {
          // Smooth, with faint rings (royal palm, flame tree, cherry, beech).
          c.fillStyle = tone(0.86, 0.1);
          c.fillRect(0, 0, w, hh);
          h.fillStyle = grey(0.6);
          h.fillRect(0, 0, w, hh);
          for (let y = 4; y < hh; y += between(9, 16)) {
            path((g) => g.rect(0, y, w, between(1, 2.5)));
            fillBoth(between(0.66, 0.76), 0.45);
          }
          barkNoise(w, hh, 160, 0.75, 0.95, 4);
        });
        inCell(barkCell(3), (w, hh) => {
          // Date palm: the diamond pattern of old leaf bases.
          c.fillStyle = tone(0.34, 0.6);
          c.fillRect(0, 0, w, hh);
          const dw = w / 5,
            dh = 22;
          for (let row = 0; row * dh * 0.5 < hh + dh; row++)
            for (let k = -1; k < 6; k++) {
              const x = k * dw + (row % 2 ? dw / 2 : 0),
                y = row * dh * 0.5;
              path((g) => {
                g.moveTo(x, y - dh * 0.46);
                g.lineTo(x + dw * 0.46, y);
                g.lineTo(x, y + dh * 0.46);
                g.lineTo(x - dw * 0.46, y);
                g.closePath();
              });
              fillBoth(between(0.66, 0.92), between(0.7, 0.95), 0.6);
            }
        });
        inCell(barkCell(4), (w, hh) => {
          // Palm rings (fan and coconut palms).
          c.fillStyle = tone(0.74, 0.35);
          c.fillRect(0, 0, w, hh);
          h.fillStyle = grey(0.7);
          h.fillRect(0, 0, w, hh);
          for (let y = 0; y < hh; y += between(7, 11)) {
            path((g) => {
              g.moveTo(0, y);
              for (let x = 0; x <= w; x += 16) g.lineTo(x, y + between(-1.5, 1.5));
            });
            strokeBoth(between(0.36, 0.5), 0.2, between(1.5, 3));
          }
          for (let i = 0; i < 40; i++) {
            const x = between(0, w),
              y = between(0, hh);
            path((g) => {
              g.moveTo(x, y);
              g.lineTo(x + between(-2, 2), y + between(10, 30));
            });
            strokeBoth(0.55, 0.4, 1);
          }
        });
        inCell(barkCell(5), (w, hh) => {
          // Pine: plates between dark cracks.
          c.fillStyle = tone(0.22, 0.6);
          c.fillRect(0, 0, w, hh);
          h.fillStyle = grey(0.15);
          h.fillRect(0, 0, w, hh);
          for (let i = 0; i < 90; i++) {
            const x = between(-8, w),
              y = between(-8, hh),
              pw = between(10, 22),
              ph = between(16, 38);
            path((g) => {
              g.moveTo(x, y + ph * 0.1);
              g.lineTo(x + pw * 0.9, y);
              g.lineTo(x + pw, y + ph * 0.85);
              g.lineTo(x + pw * 0.15, y + ph);
              g.closePath();
            });
            fillBoth(between(0.6, 0.95), between(0.6, 0.9), 1);
          }
        });
        inCell(barkCell(6), (w, hh) => {
          // Birch: white, black lenticels and scars.
          c.fillStyle = tone(0.96, 0);
          c.fillRect(0, 0, w, hh);
          h.fillStyle = grey(0.6);
          h.fillRect(0, 0, w, hh);
          for (let i = 0; i < 80; i++) {
            path((g) => g.rect(between(-10, w), between(0, hh), between(8, 30), between(1.5, 3.5)));
            fillBoth(between(0.08, 0.3), 0.3);
          }
        });
        inCell(barkCell(7), (w, hh) => {
          // Fine scaly (spruce, fir).
          c.fillStyle = tone(0.5, 0.4);
          c.fillRect(0, 0, w, hh);
          barkNoise(w, hh, 700, 0.35, 0.8, 4);
        });
        return { colorCanvas, heightCanvas };
      }
      // The normal map from the painted height (a Sobel slope per texel).
      function foliageNormalCanvas(heightCanvas) {
        const n = FOLIAGE_ATLAS,
          src = heightCanvas.getContext('2d').getImageData(0, 0, n, n).data,
          out = document.createElement('canvas');
        out.width = out.height = n;
        const g = out.getContext('2d'),
          image = g.createImageData(n, n),
          d = image.data,
          at = (x, y) => src[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
            const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * 2.2,
              dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * 2.2,
              len = Math.hypot(dx, dy, 1),
              i = (y * n + x) * 4;
            d[i] = Math.round((-dx / len) * 127.5 + 127.5);
            d[i + 1] = Math.round((dy / len) * 127.5 + 127.5);
            d[i + 2] = Math.round((1 / len) * 127.5 + 127.5);
            d[i + 3] = 255;
          }
        g.putImageData(image, 0, 0);
        return out;
      }
      // The colour mip chain made by hand: each level halves the last and then
      // sharpens its alpha round the cut-out threshold, so a crown far away keeps
      // its leaf coverage instead of thinning to lace as averaged alpha drops.
      function foliageMips(level0) {
        const levels = [level0];
        let size = FOLIAGE_ATLAS;
        while (size > 8) {
          size /= 2;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const g = canvas.getContext('2d');
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(levels[levels.length - 1], 0, 0, size, size);
          const image = g.getImageData(0, 0, size, size),
            d = image.data;
          for (let i = 3; i < d.length; i += 4) {
            const a = d[i] / 255;
            d[i] = Math.round(Math.max(0, Math.min(1, (a - 0.42) * 1.9 + 0.5)) * 255);
          }
          g.putImageData(image, 0, 0);
          levels.push(canvas);
        }
        return levels;
      }
      const foliageAtlas = (() => {
        const { colorCanvas, heightCanvas } = paintFoliageAtlas();
        const map = new Three.Texture(colorCanvas);
        map.mipmaps = foliageMips(colorCanvas);
        map.generateMipmaps = false;
        map.minFilter = Three.LinearMipmapLinearFilter;
        map.colorSpace = Three.SRGBColorSpace;
        map.anisotropy = 4;
        map.needsUpdate = true;
        const normalMap = new Three.CanvasTexture(foliageNormalCanvas(heightCanvas));
        normalMap.anisotropy = 4;
        return { map, normalMap };
      })();
      /* ---- The material ---------------------------------------------------------------- */
      const foliageUniforms = {
        foliageTime: { value: 0 },
        foliageWind: { value: 0.3 },
      };
      const FOLIAGE_VERTEX_PARS = `
        attribute vec2 foliage;
        attribute vec3 morph;
        #ifdef USE_INSTANCING
          attribute vec2 instanceFoliage;
        #endif
        uniform float foliageTime;
        uniform float foliageWind;
        varying float vFoliageLeaf;
        varying float vFoliageDensity;`;
      // The morph, then the leaf mask and density for the fragment shader.
      const FOLIAGE_BEGIN = `
        #include <begin_vertex>
        float foliageMorph = 0.0;
        vFoliageDensity = 0.0;
        #ifdef USE_INSTANCING
          foliageMorph = instanceFoliage.x;
          vFoliageDensity = instanceFoliage.y;
        #endif
        transformed += morph * foliageMorph;
        vFoliageLeaf = foliage.x;`;
      // Wind: a slow sway that travels across the city in gusts (phase from the
      // world position), weighted per vertex (the tip of a frond, the top of a
      // crown), plus a quick leaf flutter; a world-space offset after the
      // transform, scaled by the tree's own scale.
      const FOLIAGE_SWAY = `
        {
          vec4 foliageWorld = vec4( transformed, 1.0 );
          float foliageScale = 1.0;
          #ifdef USE_INSTANCING
            foliageWorld = instanceMatrix * foliageWorld;
            foliageScale = length( instanceMatrix[ 1 ].xyz );
          #endif
          foliageWorld = modelMatrix * foliageWorld;
          float phase = foliageTime * 1.3 + foliageWorld.x * 0.012 + foliageWorld.z * 0.009;
          vec2 gust = vec2( sin( phase ) + 0.35 * sin( phase * 2.3 + 1.7 ), cos( phase * 0.9 + 0.5 ) * 0.6 );
          float flutter = sin( foliageTime * 7.0 + dot( foliageWorld.xyz, vec3( 0.9, 1.3, 0.7 ) ) ) * foliage.x;
          vec3 foliageOffset = ( vec3( gust.x, 0.0, gust.y ) * foliage.y * 1.4 + vec3( 0.12, 0.07, -0.1 ) * flutter ) * foliageWind * foliageScale;
          mvPosition.xyz += ( viewMatrix * vec4( foliageOffset, 0.0 ) ).xyz;
          gl_Position = projectionMatrix * mvPosition;
        }`;
      // Sparser crowns (instance density) drop more of their leaf-card pixels.
      const FOLIAGE_ALPHATEST = `
        #ifdef USE_ALPHATEST
          if ( diffuseColor.a < alphaTest + vFoliageDensity * 0.32 * step( 0.8, vFoliageLeaf ) ) discard;
        #endif`;
      function foliageVertexPatch(shader) {
        Object.assign(shader.uniforms, foliageUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + FOLIAGE_VERTEX_PARS)
          .replace('#include <begin_vertex>', FOLIAGE_BEGIN)
          .replace('#include <project_vertex>', '#include <project_vertex>\n' + FOLIAGE_SWAY);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vFoliageLeaf;\nvarying float vFoliageDensity;')
          .replace('#include <alphatest_fragment>', FOLIAGE_ALPHATEST);
      }
      const treeMaterial = new Three.MeshStandardMaterial({
        map: foliageAtlas.map,
        normalMap: foliageAtlas.normalMap,
        normalScale: new Three.Vector2(0.9, 0.9),
        vertexColors: true,
        alphaTest: 0.5,
        side: Three.DoubleSide,
        roughness: 0.84,
        metalness: 0,
      });
      treeMaterial.name = 'trees';
      treeMaterial.onBeforeCompile = (shader) => {
        cityMaterialPatch(shader);
        foliageVertexPatch(shader);
        shader.vertexShader = shader.vertexShader.replace(
          '#include <color_vertex>',
          // The instance colour (jitter, autumn) tints the leaves, not the bark.
          `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
            vColor = vec3( 1.0 );
          #endif
          #ifdef USE_COLOR
            vColor *= color;
          #endif
          #ifdef USE_INSTANCING_COLOR
            vColor *= mix( vec3( 1.0 ), instanceColor.rgb, smoothstep( 0.3, 0.5, foliage.x ) );
          #endif`,
        );
        shader.fragmentShader = shader.fragmentShader
          // Leaves keep their crown-shaped normal on both faces: a card seen from
          // behind is still the outside of the crown, not a dark hole in it.
          .replace(
            '#include <normal_fragment_begin>',
            '#include <normal_fragment_begin>\nif ( vFoliageLeaf > 0.3 ) { normal = normalize( vNormal ); nonPerturbedNormal = normal; }',
          )
          // Light through the leaves: shaded foliage is never as dark as bark.
          .replace(
            '#include <lights_fragment_end>',
            '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * vFoliageLeaf * 0.07;',
          );
      };
      treeMaterial.customProgramCacheKey = () => 'city-trees';
      // The shadow pass: the same cut-outs, morph and sway.
      const treeDepthMaterial = new Three.MeshDepthMaterial({
        depthPacking: Three.RGBADepthPacking,
        map: foliageAtlas.map,
        alphaTest: 0.5,
        side: Three.DoubleSide,
      });
      treeDepthMaterial.onBeforeCompile = foliageVertexPatch;
      treeDepthMaterial.customProgramCacheKey = () => 'city-trees-depth';
      /* ---- Geometry kit ---------------------------------------------------------------- */
      const UP = new Three.Vector3(0, 1, 0),
        vegA = new Three.Vector3(),
        vegB = new Three.Vector3(),
        vegC = new Three.Vector3();
      // Accumulates one tree's vertices: position, normal, uv, colour, the
      // foliage pair (leaf mask, sway) and the morph offset.
      class FoliageMesh {
        constructor() {
          this.p = [];
          this.n = [];
          this.t = [];
          this.c = [];
          this.f = [];
          this.m = [];
          this.i = [];
        }
        get count() {
          return this.p.length / 3;
        }
        vert(p, n, u, v, color, leaf, sway, morph) {
          this.p.push(p.x, p.y, p.z);
          this.n.push(n.x, n.y, n.z);
          this.t.push(u, v);
          this.c.push(color.r, color.g, color.b);
          this.f.push(leaf, sway);
          this.m.push(morph ? morph.x : 0, morph ? morph.y : 0, morph ? morph.z : 0);
          return this.count - 1;
        }
        tri(a, b, c) {
          this.i.push(a, b, c);
        }
        quad(a, b, c, d) {
          this.i.push(a, b, c, a, c, d);
        }
        geometry(meta) {
          const g = new Three.BufferGeometry();
          g.setAttribute('position', new Three.Float32BufferAttribute(this.p, 3));
          g.setAttribute('normal', new Three.Float32BufferAttribute(this.n, 3));
          g.setAttribute('uv', new Three.Float32BufferAttribute(this.t, 2));
          g.setAttribute('color', new Three.Float32BufferAttribute(this.c, 3));
          g.setAttribute('foliage', new Three.Float32BufferAttribute(this.f, 2));
          g.setAttribute('morph', new Three.Float32BufferAttribute(this.m, 3));
          g.setIndex(this.i);
          g.computeBoundingBox();
          // Room for the morph and the sway.
          g.boundingBox.expandByScalar(meta.reach * 0.35 + 4);
          g.computeBoundingSphere();
          g.boundingSphere.radius += meta.reach * 0.35 + 4;
          g.userData.foliage = meta;
          return g;
        }
      }
      const shade = (color, k) => ({ r: color.r * k, g: color.g * k, b: color.b * k });
      const linear = (hex) => new Three.Color(hex);
      // A tube along a polyline (trunks, limbs, stems) with bark from an atlas strip.
      function tube(fm, points, radii, sides, bark, color, o = {}) {
        const cell = atlasUV(barkCell(bark), 2),
          n = points.length,
          lengths = [0];
        for (let k = 1; k < n; k++) lengths.push(lengths[k - 1] + points[k].distanceTo(points[k - 1]));
        const total = lengths[n - 1] || 1,
          vSpan = Math.min(1, (o.vScale ?? 1) * (total / (radii[0] * 2 * Math.PI)) * 0.5),
          tangent = new Three.Vector3(),
          normal = new Three.Vector3(),
          binormal = new Three.Vector3(),
          previous = new Three.Vector3(),
          dir = new Three.Vector3(),
          pos = new Three.Vector3(),
          rings = [];
        for (let k = 0; k < n; k++) {
          tangent.subVectors(points[Math.min(n - 1, k + 1)], points[Math.max(0, k - 1)]).normalize();
          if (k === 0) normal.copy(Math.abs(tangent.y) < 0.9 ? UP : new Three.Vector3(1, 0, 0)).cross(tangent).normalize();
          else normal.sub(previous.copy(tangent).multiplyScalar(normal.dot(tangent))).normalize();
          binormal.crossVectors(tangent, normal);
          const t = lengths[k] / total,
            ring = [],
            tint = shade(color, o.shadeAt ? o.shadeAt(t) : 1),
            sway = o.sway ? o.sway(points[k], t) : 0,
            morph = o.morph ? o.morph(t) : null;
          for (let s = 0; s <= sides; s++) {
            const a = (s / sides) * TAU;
            dir.copy(normal).multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a));
            pos.copy(points[k]).addScaledVector(dir, radii[k]);
            ring.push(fm.vert(pos, dir, cell.u0 + (s / sides) * cell.du, cell.v0 + t * vSpan * cell.dv, tint, o.leaf ?? 0, sway, morph));
          }
          rings.push(ring);
        }
        for (let k = 1; k < n; k++)
          for (let s = 0; s < sides; s++) fm.quad(rings[k - 1][s], rings[k - 1][s + 1], rings[k][s + 1], rings[k][s]);
      }
      // A flat leaf card at `centre` facing `facing`, `w` x `h`, turned `spin`.
      function card(fm, centre, facing, w, h, spin, cellName, color, o) {
        const cell = atlasUV(ATLAS_CELLS[cellName]),
          n = vegA.copy(facing).normalize(),
          ref = Math.abs(n.y) < 0.95 ? UP : new Three.Vector3(1, 0, 0),
          tu = new Three.Vector3().crossVectors(ref, n).normalize(),
          tv = new Three.Vector3().crossVectors(n, tu),
          cs = Math.cos(spin),
          sn = Math.sin(spin),
          ax = tu.clone().multiplyScalar(cs).addScaledVector(tv, sn),
          ay = tv.clone().multiplyScalar(cs).addScaledVector(tu, -sn),
          // Hanging cards (willow) keep their top edge at the centre.
          top = o.hang ? 0 : 0.5,
          ids = [];
        for (const [u, v] of [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ]) {
          const p = centre.clone().addScaledVector(ax, (u - 0.5) * w).addScaledVector(ay, (v - 1 + top) * h);
          ids.push(fm.vert(p, o.normal(p), cell.u0 + u * cell.du, cell.v0 + v * cell.dv, o.tint ? o.tint(p, color) : color, o.leaf ?? 1, o.sway(p), o.morph));
        }
        fm.quad(ids[0], ids[1], ids[2], ids[3]);
      }
      const icoCache = new Map();
      function icoPositions(detail) {
        if (!icoCache.has(detail)) icoCache.set(detail, new Three.IcosahedronGeometry(1, detail).attributes.position);
        return icoCache.get(detail);
      }
      // A lumpy blob (crown cores, the mid level's crowns), its UVs projected from
      // above onto the dense middle of a leaf cell.
      function blob(fm, centre, rx, ry, rz, detail, cellName, color, o) {
        const cell = atlasUV(ATLAS_CELLS[cellName]),
          src = icoPositions(detail),
          spread = o.uvSpread ?? 0.22,
          lumpy = o.lumpy ?? 0.2,
          p = new Three.Vector3(),
          d = new Three.Vector3();
        const ids = [];
        for (let k = 0; k < src.count; k++) {
          d.fromBufferAttribute(src, k);
          const bump = 1 + lumpy * (vegHash(d.x * 97, d.y * 89 + d.z * 83, o.seed || 0) - 0.5) * 2;
          p.set(centre.x + d.x * rx * bump, centre.y + d.y * ry * bump, centre.z + d.z * rz * bump);
          const k2 = 0.6 + 0.4 * (d.y * 0.5 + 0.5);
          ids.push(fm.vert(p, o.normal(p), cell.u0 + (0.5 + d.x * spread) * cell.du, cell.v0 + (0.5 + d.z * spread) * cell.dv, shade(color, k2), o.leaf ?? 1, o.sway(p), o.morph));
        }
        for (let k = 0; k < ids.length; k += 3) fm.tri(ids[k], ids[k + 1], ids[k + 2]);
      }
      // A curved, keeled palm frond: `heading` round the crown, rising at `elev`
      // and falling away by `droop`; the leaflets (the texture) rise from the
      // rachis in a V, and the blade twists towards the tip.
      function frond(fm, base, heading, len, width, elev, droop, segments, color, o = {}) {
        const cell = atlasUV(ATLAS_CELLS.frond),
          H = new Three.Vector3(Math.cos(heading), 0, Math.sin(heading)),
          side = new Three.Vector3(-Math.sin(heading), 0, Math.cos(heading)),
          rows = [];
        for (let s = 0; s <= segments; s++) {
          const t = s / segments,
            spine = base.clone().addScaledVector(H, len * t * Math.cos(elev)).addScaledVector(UP, len * t * Math.sin(elev) - droop * len * t * t),
            w = width * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)), 0.6) + width * 0.04,
            twist = (o.twist ?? 0.3) * t,
            across = side.clone().multiplyScalar(Math.cos(twist)).addScaledVector(UP, Math.sin(twist)),
            lift = w * 0.3,
            tint = shade(color, 0.72 + 0.3 * t),
            sway = 0.12 + 0.88 * t * t,
            morph = UP.clone().multiplyScalar(-len * 0.22 * t * t);
          const L = spine.clone().addScaledVector(across, -w / 2).addScaledVector(UP, lift),
            R = spine.clone().addScaledVector(across, w / 2).addScaledVector(UP, lift),
            nL = vegB.copy(UP).addScaledVector(across, 0.45).normalize().clone(),
            nR = vegC.copy(UP).addScaledVector(across, -0.45).normalize().clone();
          rows.push([
            fm.vert(L, nL, cell.u0 + t * cell.du, cell.v0, tint, 1, sway, morph),
            fm.vert(spine, UP, cell.u0 + t * cell.du, cell.v0 + cell.dv * 0.5, tint, 1, sway, morph),
            fm.vert(R, nR, cell.u0 + t * cell.du, cell.v0 + cell.dv, tint, 1, sway, morph),
          ]);
        }
        for (let s = 1; s < rows.length; s++) {
          const [a0, b0, c0] = rows[s - 1],
            [a1, b1, c1] = rows[s];
          fm.quad(a0, b0, b1, a1);
          fm.quad(b0, c0, c1, b1);
        }
      }
      // A palmate fan leaf on its hub, spread outward and up; pleated.
      function fanLeaf(fm, hub, heading, elev, radius, color, o = {}) {
        const cell = atlasUV(ATLAS_CELLS.fan),
          out = new Three.Vector3(Math.cos(heading), 0, Math.sin(heading)),
          F = out.clone().multiplyScalar(Math.cos(elev)).addScaledVector(UP, Math.sin(elev)),
          flat = UP.clone().multiplyScalar(Math.cos(elev)).addScaledVector(out, -Math.sin(elev)),
          side = new Three.Vector3().crossVectors(flat, F),
          // Rolled about its own axis, so the fans of a crown face every way.
          roll = o.roll ?? 0,
          N = flat.clone().multiplyScalar(Math.cos(roll)).addScaledVector(side, Math.sin(roll)),
          S = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(flat, -Math.sin(roll)),
          wedges = o.wedges ?? 10,
          centre = fm.vert(hub, N, cell.u0 + 0.5 * cell.du, cell.v0 + 0.06 * cell.dv, shade(color, 0.75), 1, 0.3, null),
          rim = [],
          normal = UP.clone().multiplyScalar(0.6).add(N).normalize();
        for (let k = 0; k <= wedges; k++) {
          const phi = -1.6 + (k / wedges) * 3.2,
            pleat = (k % 2 ? 0.07 : -0.03) * radius,
            cup = 0.32 * radius * Math.pow(Math.abs(phi) / 1.6, 2),
            p = hub
              .clone()
              .addScaledVector(F, Math.cos(phi) * radius)
              .addScaledVector(S, Math.sin(phi) * radius)
              .addScaledVector(N, pleat + cup)
              .addScaledVector(UP, -radius * 0.25 * Math.max(0, Math.cos(phi)));
          rim.push(
            fm.vert(p, normal, cell.u0 + (0.5 + Math.sin(phi) * 0.47) * cell.du, cell.v0 + (0.06 + Math.cos(phi) * 0.9) * cell.dv, shade(color, k % 2 ? 1.02 : 0.86), 1, 0.9, UP.clone().multiplyScalar(-radius * 0.3)),
          );
        }
        for (let k = 1; k < rim.length; k++) fm.tri(centre, rim[k - 1], rim[k]);
      }
      // A conifer bough: a card bent down from the trunk to its tip.
      function bough(fm, root, heading, len, width, droop, color, o) {
        const cell = atlasUV(ATLAS_CELLS[o.cell || 'needle']),
          H = new Three.Vector3(Math.cos(heading), 0, Math.sin(heading)),
          side = new Three.Vector3(-Math.sin(heading), 0, Math.cos(heading)),
          rows = [];
        for (const t of [0, 0.5, 1]) {
          const spine = root.clone().addScaledVector(H, len * t).addScaledVector(UP, -droop * len * Math.pow(t, 1.5)),
            w = width * (t === 0.5 ? 1 : t ? 0.55 : 0.4),
            tint = shade(color, 0.7 + 0.35 * t),
            sway = o.sway * (0.2 + t),
            morph = UP.clone().multiplyScalar(-len * (o.morphDroop ?? 0.3) * t * t),
            normal = UP.clone().multiplyScalar(o.upBias ?? 1.1).addScaledVector(H, 0.6).normalize();
          rows.push([
            fm.vert(spine.clone().addScaledVector(side, -w / 2).addScaledVector(UP, -w * 0.12), normal, cell.u0, cell.v0 + t * cell.dv, tint, 1, sway, morph),
            fm.vert(spine.clone().addScaledVector(side, w / 2).addScaledVector(UP, -w * 0.12), normal, cell.u0 + cell.du, cell.v0 + t * cell.dv, tint, 1, sway, morph),
          ]);
        }
        for (let k = 1; k < rows.length; k++) fm.quad(rows[k - 1][0], rows[k - 1][1], rows[k][1], rows[k][0]);
      }
      /* ---- Species --------------------------------------------------------------------- */
      // Sizes in map units (8 to the metre) at the nominal plan radius of 13 (a
      // street tree of r 12 comes out at 0.92 of these). H: height; R: crown
      // radius; Ry: the crown's half height. Colours are the leaves', bark's and
      // (blossom) flowers'; `far` is the flat colour of the far city's blob.
      const TREE_SPECIES = {
        plane: { form: 'broad', H: 70, R: 27, Ry: 23, shape: 'round', lobes: 7, cards: 10, cell: 'leafLobed', leaf: '#6f8c45', bark: 0, trunk: '#bdb298', trunkR: 2.1, limbs: 4 },
        linden: { form: 'broad', H: 64, R: 21, Ry: 23, shape: 'oval', lobes: 7, cards: 10, cell: 'leafRound', leaf: '#5d813c', bark: 1, trunk: '#6a5a4c', trunkR: 1.8, limbs: 3 },
        locust: { form: 'broad', H: 64, R: 26, Ry: 18, shape: 'vase', lobes: 8, cards: 8, cell: 'leafFine', leaf: '#a3b555', bark: 1, trunk: '#4d423a', trunkR: 1.6, limbs: 5, airy: true },
        pear: { form: 'broad', H: 54, R: 17, Ry: 21, shape: 'teardrop', lobes: 6, cards: 10, cell: 'leafRound', leaf: '#4b7a3a', bark: 1, trunk: '#5e5047', trunkR: 1.4, limbs: 3 },
        // A Bradford pear in its white spring blossom (one pear in five).
        pearBlossom: { form: 'broad', H: 54, R: 17, Ry: 21, shape: 'teardrop', lobes: 6, cards: 10, cell: 'leafRound', leaf: '#4b7a3a', bark: 1, trunk: '#5e5047', trunkR: 1.4, limbs: 3, blossom: { color: '#f4f2ea', share: 0.7 } },
        maple: { form: 'broad', H: 60, R: 24, Ry: 21, shape: 'round', lobes: 7, cards: 10, cell: 'leafLobed', leaf: '#628a3e', bark: 1, trunk: '#6e6053', trunkR: 1.7, limbs: 4 },
        oak: { form: 'broad', H: 76, R: 33, Ry: 24, shape: 'spreading', lobes: 9, cards: 10, cell: 'leafLobed', leaf: '#58763a', bark: 1, trunk: '#55473a', trunkR: 2.6, limbs: 5 },
        willow: { form: 'broad', H: 66, R: 29, Ry: 22, shape: 'weeping', lobes: 7, cards: 14, cell: 'willow', leaf: '#a2b964', bark: 1, trunk: '#5f5245', trunkR: 2.2, limbs: 5 },
        jacaranda: { form: 'broad', H: 58, R: 29, Ry: 12, shape: 'umbrella', lobes: 8, cards: 9, cell: 'leafFine', leaf: '#6a8c45', bark: 1, trunk: '#6d5e50', trunkR: 1.7, limbs: 5, blossom: { color: '#9c7ee0', share: 0.62 } },
        flame: { form: 'broad', H: 52, R: 34, Ry: 9, shape: 'umbrella', lobes: 9, cards: 9, cell: 'leafFine', leaf: '#669a40', bark: 2, trunk: '#8a7d6e', trunkR: 1.9, limbs: 5, blossom: { color: '#ee4a26', share: 0.52 } },
        cherry: { form: 'broad', H: 50, R: 25, Ry: 17, shape: 'spreading', lobes: 7, cards: 10, cell: 'leafRound', leaf: '#678a44', bark: 2, trunk: '#5f433b', trunkR: 1.5, limbs: 4, blossom: { color: '#f5b8cc', share: 0.76 } },
        beech: { form: 'broad', H: 76, R: 27, Ry: 28, shape: 'oval', lobes: 7, cards: 9, cell: 'leafRound', leaf: '#607f3c', bark: 2, trunk: '#8c8b82', trunkR: 2.1, limbs: 4 },
        birch: { form: 'broad', H: 80, R: 16, Ry: 29, shape: 'teardrop', lobes: 6, cards: 9, cell: 'leafRound', leaf: '#94ad52', bark: 6, trunk: '#ebe8df', trunkR: 1.3, limbs: 3, airy: true },
        cypress: { form: 'cypress', H: 96, R: 9, Ry: 43, leaf: '#46693f', bark: 7, trunk: '#5c4c3e', trunkR: 1.3, fixedScale: true },
        stonePine: { form: 'stonePine', H: 88, R: 38, Ry: 10, leaf: '#56783f', bark: 5, trunk: '#8a6446', trunkR: 2.4 },
        spruce: { form: 'spruce', H: 88, R: 20, leaf: '#46704a', bark: 7, trunk: '#5e4d40', trunkR: 1.5, conifer: true },
        fir: { form: 'fir', H: 80, R: 17, leaf: '#4f7a68', bark: 7, trunk: '#6b6259', trunkR: 1.5, conifer: true },
        pine: { form: 'pine', H: 92, R: 25, Ry: 15, leaf: '#62824a', bark: 5, trunk: '#91603f', trunkR: 1.9, conifer: true },
        // Palms at makePalm's size 1 (plan radius 17): heights of the trunk top.
        canary: { form: 'palm', palm: 'canary', H: 64, R: 34, leaf: '#5a7a3b', bark: 3, trunk: '#86765b', trunkR: 3.9, fronds: 26, frondLen: 36, frondW: 9, elevTop: 1.0, elevLow: -0.35, droop: 0.55, girth: 1.5, breakKJ: 320 },
        fan: { form: 'palm', palm: 'fan', H: 100, R: 20, leaf: '#6a8a40', bark: 4, trunk: '#8f806b', trunkR: 1.7, fronds: 22, fanR: 10.5, girth: 0.8, breakKJ: 120 },
        coconut: { form: 'palm', palm: 'coconut', H: 76, R: 36, leaf: '#86a64a', bark: 4, trunk: '#9c8d74', trunkR: 1.9, fronds: 14, frondLen: 40, frondW: 11, elevTop: 0.7, elevLow: -0.45, droop: 0.8, girth: 1, breakKJ: 150 },
        royal: { form: 'palm', palm: 'royal', H: 84, R: 32, leaf: '#608a3e', bark: 2, trunk: '#bdb9b0', trunkR: 2.6, fronds: 13, frondLen: 36, frondW: 10, elevTop: 1.15, elevLow: -0.15, droop: 0.65, girth: 1.2, breakKJ: 220 },
      };
      for (const [key, S] of Object.entries(TREE_SPECIES)) {
        S.key = key;
        S.leafColor = linear(S.leaf);
        S.trunkColor = linear(S.trunk);
        if (S.blossom) S.blossom.linear = linear(S.blossom.color);
        S.seed = vegSeed(key.length * 131, key.charCodeAt(0) * 17, key.charCodeAt(1));
      }
      // Crown-shaped normals: from the crown's centre, a little towards the sky,
      // so a crown shades as one soft volume and not as a heap of flat cards.
      const crownNormal = (C, rx, ry) => (p) => new Three.Vector3((p.x - C.x) / rx, ((p.y - C.y) / ry) * 0.9, (p.z - C.z) / rx).normalize().addScaledVector(UP, 0.5).normalize();
      // Leaf colour by height in the crown: the underside and the inside in shade.
      const crownShade = (base, top) => (p, color) => shade(color, 0.62 + 0.46 * clamp((p.y - base) / Math.max(1, top - base), 0, 1));
      function buildBroadleaf(S, lod) {
        const fm = new FoliageMesh(),
          random = vegRandom(S.seed + lod),
          between = (a, b) => a + random() * (b - a),
          { H, R, Ry } = S,
          crownBase = H - Ry * 2,
          C = new Three.Vector3(0, crownBase + Ry, 0),
          lobes = [],
          count = lod ? Math.max(3, Math.round(S.lobes / 2)) : S.lobes;
        // The lobes: one on top, the rest round it, arranged by the crown's shape.
        lobes.push({ c: C.clone().add(new Three.Vector3(0, Ry * (S.shape === 'umbrella' ? 0.2 : 0.35), 0)), rx: R * 0.56, ry: Ry * 0.62, out: new Three.Vector3() });
        for (let j = 1; j < count; j++) {
          const a = j * 2.39996 + between(-0.3, 0.3),
            out = new Three.Vector3(Math.cos(a), 0, Math.sin(a));
          let ring = R * between(0.44, 0.58),
            y = between(-0.25, 0.25) * Ry,
            rx = R * between(0.42, 0.52),
            ry = Ry * between(0.5, 0.62);
          if (S.shape === 'oval') (ring *= 0.78), (y = ((j % 3) - 1) * Ry * 0.42);
          else if (S.shape === 'teardrop') (ring *= 0.66), (y = between(-0.55, 0.35) * Ry), (rx *= 1 - (y / Ry) * 0.3);
          else if (S.shape === 'vase') (ring *= 1.02), (y = Ry * between(0.05, 0.35));
          else if (S.shape === 'spreading') (ring *= 1.06), (y = between(-0.35, 0.15) * Ry);
          else if (S.shape === 'umbrella') (ring = R * between(0.3, 0.72)), (y = between(-0.15, 0.15) * Ry), (ry *= 0.8), (rx *= between(0.8, 1.15));
          else if (S.shape === 'weeping') (ring *= 0.92), (y = between(-0.15, 0.3) * Ry);
          lobes.push({ c: C.clone().addScaledVector(out, ring).add(new Three.Vector3(0, y, 0)), rx, ry, out });
        }
        // Trunk to the fork, and the limbs out towards the lobes: they show
        // under the crown's edge from the tilted camera.
        const fork = crownBase + Ry * (S.shape === 'umbrella' ? 0.2 : 0.45),
          bend = new Three.Vector3(between(-1, 1), 0, between(-1, 1)).multiplyScalar(S.trunkR * 0.5),
          trunkSides = lod ? 4 : 7,
          top = new Three.Vector3(bend.x, fork, bend.z);
        tube(
          fm,
          [new Three.Vector3(0, -1, 0), new Three.Vector3(0, fork * 0.08, 0), new Three.Vector3(bend.x * 0.5, fork * 0.55, bend.z * 0.5), top],
          [S.trunkR * 1.55, S.trunkR * 1.1, S.trunkR, S.trunkR * 0.82],
          trunkSides,
          S.bark,
          S.trunkColor,
          { shadeAt: (t) => 1 - t * 0.28, vScale: 1.4 },
        );
        const limbs = lod ? 0 : S.limbs;
        for (let j = 1; j <= limbs && j < lobes.length; j++) {
          const L = lobes[j],
            end = L.c.clone().multiplyScalar(0.72).setY(L.c.y - L.ry * 0.2),
            mid = top.clone().lerp(end, 0.5).add(new Three.Vector3(0, Ry * 0.15, 0)),
            morph = new Three.Vector3().copy(L.out).multiplyScalar(R * 0.2).add(new Three.Vector3(0, -Ry * 0.12, 0));
          tube(fm, [top.clone().setY(fork - S.trunkR), mid, end], [S.trunkR * 0.62, S.trunkR * 0.4, S.trunkR * 0.18], 5, S.bark, S.trunkColor, {
            shadeAt: (t) => 0.85 - t * 0.25,
            sway: (p, t) => t * t * 0.25,
            morph: (t) => morph.clone().multiplyScalar(t),
            vScale: 0.6,
          });
        }
        // Crown.
        const normal = crownNormal(C, R, Ry * 1.2),
          tint = crownShade(crownBase, H),
          sway = (p) => 0.35 + 0.65 * clamp((p.y - crownBase) / (Ry * 2), 0, 1),
          flowers = S.blossom;
        lobes.forEach((L, j) => {
          const morph = j ? L.out.clone().multiplyScalar(R * 0.2).add(new Three.Vector3(0, -Ry * 0.14, 0)) : new Three.Vector3(0, -Ry * 0.2, 0);
          if (lod) {
            blob(fm, L.c, L.rx * 1.08, L.ry * 1.05, L.rx * 1.08, 0, S.cell === 'willow' ? 'leafRound' : S.cell, shade(S.leafColor, 0.92), { normal, sway, morph, seed: j, uvSpread: 0.36, lumpy: 0.24 });
            return;
          }
          const coreK = S.airy ? 0.5 : 0.7;
          blob(fm, L.c, L.rx * coreK, L.ry * coreK, L.rx * coreK, 0, S.cell === 'willow' ? 'leafRound' : S.cell, shade(S.leafColor, 0.7), { normal, sway, morph, seed: j, leaf: 0.6 });
          const umbrella = S.shape === 'umbrella';
          for (let k = 0; k < S.cards; k++) {
            const dir = new Three.Vector3(between(-1, 1), umbrella ? between(0.05, 1) : between(-0.35, 1), between(-1, 1)).normalize(),
              pos = L.c.clone().add(new Three.Vector3(dir.x * L.rx * 0.78, dir.y * L.ry * 0.78, dir.z * L.rx * 0.78)),
              bloom = flowers && dir.y > -0.1 && random() < flowers.share,
              size = L.rx * between(1.0, 1.35) * (S.airy ? 1.1 : 1);
            if (S.shape === 'weeping' && k % 3) {
              // Willow: curtains of strands hanging from the crown's shell down
              // towards the ground, crossing at random turns.
              const a = random() * TAU,
                shell = new Three.Vector3(Math.cos(a), 0, Math.sin(a)),
                top = L.c.clone().addScaledVector(shell, L.rx * between(0.55, 0.95)).setY(L.c.y + L.ry * between(0.2, 0.6)),
                facing = new Three.Vector3(Math.cos(a + between(-1.2, 1.2)), 0, Math.sin(a + between(-1.2, 1.2)));
              card(fm, top, facing, L.rx * between(0.55, 0.8), L.ry * between(1.9, 2.6), between(-0.12, 0.12), 'willow', S.leafColor, {
                normal,
                sway: (p) => sway(p) + 0.5,
                morph,
                tint: (p, color) => shade(color, 0.8 + 0.3 * clamp((p.y - crownBase) / (Ry * 2), 0, 1)),
                hang: true,
              });
              continue;
            }
            const facing = umbrella ? dir.clone().multiplyScalar(0.35).addScaledVector(UP, 1.2) : dir.clone().multiplyScalar(0.7).addScaledVector(UP, 0.9);
            card(fm, pos, facing, size, size, random() * TAU, bloom ? 'blossom' : S.cell === 'willow' ? 'leafFine' : S.cell, bloom ? flowers.linear : S.leafColor, {
              normal,
              sway,
              morph,
              tint: (p, color) => shade(tint(p, color), between(0.9, 1.08)),
            });
          }
        });
        return fm.geometry({ species: S.key, lod, reach: Math.max(R, Ry), crown: { y: C.y, r: R, ry: Ry } });
      }
      function buildConifer(S, lod) {
        const fm = new FoliageMesh(),
          random = vegRandom(S.seed + lod),
          between = (a, b) => a + random() * (b - a),
          { H, R } = S,
          trunkTop = new Three.Vector3(between(-1, 1), H * 0.97, between(-1, 1));
        const trunkPoints = [new Three.Vector3(0, -1, 0), new Three.Vector3(0, H * 0.3, 0), trunkTop.clone().multiplyScalar(0.6).setY(H * 0.65), trunkTop];
        if (S.form === 'spruce' || S.form === 'fir') {
          tube(fm, trunkPoints, [S.trunkR * 1.4, S.trunkR, S.trunkR * 0.6, S.trunkR * 0.15], lod ? 3 : 5, S.bark, S.trunkColor, { shadeAt: (t) => 0.9 - t * 0.3 });
          const spruce = S.form === 'spruce',
            base = H * (spruce ? 0.1 : 0.14),
            tiers = lod ? 4 : spruce ? 9 : 11,
            normal = (p) => new Three.Vector3(p.x / R, 0.9, p.z / R).normalize();
          // A dark core so the gaps between whorls read as depth, not sky.
          const coreSides = lod ? 5 : 7,
            coreCell = atlasUV(ATLAS_CELLS.scale),
            coreColor = shade(S.leafColor, lod ? 0.85 : 0.55),
            apex = fm.vert(new Three.Vector3(trunkTop.x, H * 1.01, trunkTop.z), UP, coreCell.u0 + coreCell.du / 2, coreCell.v0 + coreCell.dv / 2, coreColor, 0.6, 0.5, null),
            rim = [];
          for (let s = 0; s <= coreSides; s++) {
            const a = (s / coreSides) * TAU,
              r = R * (lod ? 0.95 : 0.58);
            rim.push(fm.vert(new Three.Vector3(Math.cos(a) * r, base, Math.sin(a) * r), new Three.Vector3(Math.cos(a), 0.6, Math.sin(a)).normalize(), coreCell.u0 + (0.5 + Math.cos(a) * 0.4) * coreCell.du, coreCell.v0 + (0.5 + Math.sin(a) * 0.4) * coreCell.dv, shade(coreColor, 0.7), 0.6, 0.1, null));
          }
          for (let s = 1; s < rim.length; s++) fm.tri(apex, rim[s], rim[s - 1]);
          if (lod) return fm.geometry({ species: S.key, lod, reach: R, crown: { y: H * 0.45, r: R * 0.7, ry: H * 0.45 } });
          for (let k = 0; k < tiers; k++) {
            const t = k / (tiers - 1),
              y = base + (H * 0.94 - base) * t,
              // Spruce: ragged whorls of drooping boughs with gaps between; fir: a
              // tight, regular cone of level boughs whose tips turn up, a spire on top.
              reach = spruce ? R * Math.pow(1 - t * 0.93, 0.95) * between(0.8, 1.15) : R * (1 - t * 0.96) * between(0.95, 1.04),
              boughs = Math.max(4, Math.round((spruce ? 7 : 9) - t * 3)),
              twist = k * 2.39996;
            for (let b = 0; b < boughs; b++) {
              if (spruce && random() < 0.14) continue;
              const a = twist + (b / boughs) * TAU + between(-0.2, 0.2);
              bough(fm, new Three.Vector3(trunkTop.x * t, y, trunkTop.z * t), a, reach * 1.05, reach * (spruce ? 0.62 : 0.78), spruce ? between(0.28, 0.42) : between(-0.06, 0.06), shade(S.leafColor, 0.8 + 0.3 * t), {
                sway: 0.2 + 0.6 * t,
                morphDroop: spruce ? 0.35 : 0.18,
                upBias: 1.2,
              });
            }
          }
          return fm.geometry({ species: S.key, lod, reach: R, crown: { y: H * 0.45, r: R * 0.7, ry: H * 0.45 } });
        }
        if (S.form === 'pine' || S.form === 'stonePine') {
          // A tall bare trunk; the crown is flattened clumps on limbs up top.
          const stone = S.form === 'stonePine',
            Ry = S.Ry,
            crownY = H - Ry,
            clumps = lod ? 3 : stone ? 8 : 6,
            C = new Three.Vector3(trunkTop.x, crownY, trunkTop.z),
            fork = H * (stone ? 0.62 : 0.66);
          const stem = [new Three.Vector3(0, -1, 0), new Three.Vector3(0, fork * 0.4, 0), new Three.Vector3(trunkTop.x * 0.6, fork * 0.8, trunkTop.z * 0.6), new Three.Vector3(trunkTop.x, fork, trunkTop.z)];
          if (stone) stem.forEach((p, k) => (p.x += Math.sin((k / 3) * Math.PI) * S.trunkR * 1.6));
          tube(fm, stem, [S.trunkR * 1.35, S.trunkR, S.trunkR * 0.9, S.trunkR * 0.75], lod ? 4 : 6, S.bark, S.trunkColor, { shadeAt: (t) => 1 - t * 0.2, vScale: 1.2 });
          const normal = crownNormal(C, R, Ry * 1.6),
            tint = crownShade(crownY - Ry, H),
            sway = (p) => 0.4 + 0.6 * clamp((p.y - (crownY - Ry)) / (Ry * 2), 0, 1);
          for (let j = 0; j < clumps; j++) {
            const a = j * 2.39996 + between(-0.3, 0.3),
              out = new Three.Vector3(Math.cos(a), 0, Math.sin(a)),
              ring = j === 0 ? 0 : R * between(0.4, 0.62),
              lc = C.clone().addScaledVector(out, ring).add(new Three.Vector3(0, j === 0 ? Ry * (stone ? 0.1 : 0.3) : between(stone ? -0.2 : -0.5, stone ? 0.15 : 0.35) * Ry, 0)),
              rx = R * (stone ? between(0.38, 0.48) : between(0.44, 0.54)),
              ry = Ry * between(0.55, 0.75),
              // Morph: the crown pushed to one side (a windswept tree).
              morph = new Three.Vector3(R * 0.28, 0, 0).addScaledVector(out, R * 0.08);
            if (!lod && j)
              tube(fm, [new Three.Vector3(trunkTop.x, fork - 3, trunkTop.z), lc.clone().lerp(C, 0.35).setY(lc.y - ry * 0.4), lc.clone().setY(lc.y - ry * 0.3)], [S.trunkR * 0.55, S.trunkR * 0.35, S.trunkR * 0.15], 4, S.bark, S.trunkColor, {
                shadeAt: () => 0.8,
                sway: (p, t) => t * 0.2,
                morph: (t) => morph.clone().multiplyScalar(t),
                vScale: 0.5,
              });
            if (lod) {
              blob(fm, lc, rx * 1.15, ry, rx * 1.15, 0, 'tuft', shade(S.leafColor, 0.9), { normal, sway, morph, seed: j, uvSpread: 0.3 });
              continue;
            }
            blob(fm, lc, rx * 0.7, ry * 0.65, rx * 0.7, 0, 'scale', shade(S.leafColor, 0.62), { normal, sway, morph, seed: j, leaf: 0.6 });
            for (let k = 0; k < (stone ? 7 : 8); k++) {
              const dir = new Three.Vector3(between(-1, 1), between(-0.2, 1), between(-1, 1)).normalize(),
                pos = lc.clone().add(new Three.Vector3(dir.x * rx * 0.75, dir.y * ry * 0.7, dir.z * rx * 0.75)),
                size = rx * between(1.05, 1.4);
              card(fm, pos, dir.clone().multiplyScalar(0.5).addScaledVector(UP, 1.1), size, size, random() * TAU, 'tuft', S.leafColor, {
                normal,
                sway,
                morph,
                tint: (p, color) => shade(tint(p, color), between(0.88, 1.08)),
              });
            }
          }
          return fm.geometry({ species: S.key, lod, reach: R, crown: { y: crownY, r: R, ry: Ry } });
        }
        // Italian cypress: a dense flame-shaped column, widest a third of the way
        // up, drawn to a point; its scale foliage lies close, so the cards are
        // small and hug the column.
        const Ry = S.Ry,
          C = new Three.Vector3(0, H - Ry, 0),
          normal = (p) => new Three.Vector3(p.x / R, 1.3, p.z / R).normalize(),
          tint = crownShade(C.y - Ry, H),
          sway = (p) => 0.15 + 0.85 * clamp((p.y - (C.y - Ry)) / (Ry * 2), 0, 1) ** 2;
        tube(fm, [new Three.Vector3(0, -1, 0), new Three.Vector3(0, C.y - Ry + 4, 0)], [S.trunkR * 1.2, S.trunkR], 4, S.bark, S.trunkColor, {});
        const width = (t) => R * Math.pow(Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.82)), 0.8) * (1.05 - t * 0.25);
        if (lod) blob(fm, C, R, Ry, R, 0, 'scale', shade(S.leafColor, 0.9), { normal, sway, seed: 1, uvSpread: 0.25, lumpy: 0.1, morph: new Three.Vector3(R * 0.1, 0, 0) });
        else {
          // A stack of overlapping lumps (the column), then small sprays on it.
          const lumps = 8;
          for (let s = 0; s < lumps; s++) {
            const t = (s + 0.5) / lumps,
              w = width(t),
              p = new Three.Vector3(between(-0.12, 0.12) * R, C.y - Ry + Ry * 2 * t, between(-0.12, 0.12) * R);
            blob(fm, p, w, (Ry / lumps) * 1.7, w, 0, 'scale', shade(S.leafColor, 0.95), { normal, sway, seed: s, uvSpread: 0.24, lumpy: 0.16, morph: new Three.Vector3(R * 0.18 * t, 0, 0) });
          }
          for (let k = 0; k < 12; k++) {
            const a = k * 2.39996,
              t = clamp((k + 0.5) / 12 + between(-0.04, 0.04), 0, 0.96),
              r = width(t) * 0.85,
              pos = new Three.Vector3(Math.cos(a) * r, C.y - Ry + Ry * 2 * t, Math.sin(a) * r);
            card(fm, pos, new Three.Vector3(Math.cos(a), 0.6, Math.sin(a)), r * 1.4, r * 1.4, random() * TAU, 'scale', S.leafColor, {
              normal,
              sway,
              morph: new Three.Vector3(R * 0.18 * t, 0, 0),
              tint: (q, color) => shade(tint(q, color), between(0.95, 1.12)),
            });
          }
        }
        return fm.geometry({ species: S.key, lod, reach: Ry, crown: { y: C.y, r: R, ry: Ry } });
      }
      function buildPalm(S, lod) {
        const fm = new FoliageMesh(),
          random = vegRandom(S.seed + lod),
          between = (a, b) => a + random() * (b - a),
          H = S.H,
          segs = lod ? 3 : 7,
          points = [],
          radii = [];
        // The trunk: a bow for the coconut, a slight lean for the rest; each
        // species' own profile (the date palm's swollen bole, the royal's bulge).
        const lean = S.palm === 'coconut' ? H * 0.22 : H * 0.03;
        for (let k = 0; k <= segs; k++) {
          const t = k / segs;
          points.push(new Three.Vector3(lean * Math.pow(t, S.palm === 'coconut' ? 1.8 : 1), H * t - (k ? 0 : 1), 0));
          const r = S.trunkR;
          radii.push(
            S.palm === 'canary'
              ? r * (1.15 - 0.15 * t + 0.25 * Math.pow(t, 6))
              : S.palm === 'royal'
                ? r * (1.1 + 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.4)) - 0.25 * t)
                : S.palm === 'fan'
                  ? r * (1 + 0.9 * Math.pow(1 - t, 6))
                  : r * (1 + 0.6 * Math.pow(1 - t, 5)),
          );
        }
        tube(fm, points, radii, lod ? 4 : 7, S.bark, S.trunkColor, {
          shadeAt: (t) => 1 - t * 0.2,
          sway: (p, t) => t * t * 0.35,
          vScale: S.palm === 'canary' ? 2.4 : 1.3,
        });
        const crown = points[points.length - 1].clone();
        if (S.palm === 'royal') {
          // The crownshaft: a smooth green column the fronds spring from.
          const shaftTop = crown.clone().add(new Three.Vector3(0, 13, 0));
          tube(fm, [crown, crown.clone().add(new Three.Vector3(0, 7, 0)), shaftTop], [S.trunkR * 0.95, S.trunkR * 0.9, S.trunkR * 0.7], lod ? 4 : 7, 2, linear('#6f9148'), { sway: () => 0.35, shadeAt: () => 1.05 });
          crown.copy(shaftTop);
        }
        if (S.palm === 'fan') {
          // The petticoat of dead fronds hanging under the crown.
          const skirtTop = crown.clone().add(new Three.Vector3(0, 2, 0)),
            skirtFoot = crown.clone().add(new Three.Vector3(0, -22, 0)),
            cell = atlasUV(ATLAS_CELLS.thatch),
            sides = lod ? 5 : 9,
            color = linear('#b19a74'),
            rows = [];
          for (const [p, r, v] of [
            [skirtTop, S.trunkR * 1.8, 1],
            [skirtFoot, S.trunkR * 3.4, 0],
          ]) {
            const row = [];
            for (let s = 0; s <= sides; s++) {
              const a = (s / sides) * TAU,
                n = new Three.Vector3(Math.cos(a), 0.2, Math.sin(a)).normalize();
              row.push(fm.vert(p.clone().add(new Three.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)), n, cell.u0 + (s / sides) * cell.du, cell.v0 + v * cell.dv, shade(color, v ? 0.8 : 1), 0.2, 0.25, null));
            }
            rows.push(row);
          }
          for (let s = 0; s < sides; s++) fm.quad(rows[1][s], rows[1][s + 1], rows[0][s + 1], rows[0][s]);
          const fans = lod ? 7 : S.fronds;
          for (let k = 0; k < fans; k++) {
            // Stiff petioles radiating from the crown, the young ones upright and
            // the old ones hanging; each fan held out beyond its stalk.
            const t = k / fans,
              heading = k * 2.39996,
              elev = 1.15 - t * 1.7,
              stalk = S.fanR * between(1.2, 1.6),
              hub = crown.clone().add(new Three.Vector3(Math.cos(heading) * Math.cos(elev) * stalk, 4 + Math.sin(elev) * stalk, Math.sin(heading) * Math.cos(elev) * stalk));
            if (!lod) tube(fm, [crown.clone().add(new Three.Vector3(0, 3, 0)), hub], [0.55, 0.35], 3, 2, linear('#7d8a4a'), { sway: () => 0.4 });
            fanLeaf(fm, hub, heading, elev + 0.25, S.fanR * between(0.9, 1.1), shade(S.leafColor, between(0.88, 1.1) * (0.8 + 0.25 * (1 - t))), { wedges: lod ? 5 : 10, roll: between(-0.9, 0.9) });
          }
          blob(fm, crown.clone().add(new Three.Vector3(0, 3, 0)), S.trunkR * 2.2, 5, S.trunkR * 2.2, 0, 'scale', shade(S.leafColor, 0.6), { normal: () => UP, sway: () => 0.3, seed: 1, leaf: 0.6 });
          return fm.geometry({ species: S.key, lod, reach: S.R, crown: { y: crown.y + 4, r: S.R, ry: 10 } });
        }
        // Pinnate fronds: rings from upright spears to hanging old leaves.
        const count = lod ? Math.ceil(S.fronds / 2) : S.fronds;
        for (let k = 0; k < count; k++) {
          const t = count > 1 ? k / (count - 1) : 0,
            heading = k * 2.39996 + between(-0.15, 0.15),
            elev = S.elevTop + (S.elevLow - S.elevTop) * Math.pow(t, 0.8) + between(-0.1, 0.1),
            len = S.frondLen * between(0.85, 1.12),
            base = crown.clone().add(new Three.Vector3(Math.cos(heading) * 1.5, 2 - t * 3, Math.sin(heading) * 1.5));
          frond(fm, base, heading, len, S.frondW * between(0.9, 1.1), elev, S.droop * between(0.8, 1.2), lod ? 2 : 5, shade(S.leafColor, between(0.88, 1.1) * (0.85 + 0.2 * (1 - t))), { twist: 0.4 });
        }
        if (S.palm === 'canary')
          // The pineapple of leaf bases under the crown.
          blob(fm, crown.clone().add(new Three.Vector3(0, -1, 0)), S.trunkR * 1.5, S.trunkR * 1.4, S.trunkR * 1.5, lod ? 0 : 1, 'scale', linear('#7a7248'), { normal: (p) => p.clone().sub(crown).normalize(), sway: () => 0.3, seed: 2, leaf: 0.2, uvSpread: 0.4 });
        if (S.palm === 'coconut' && !lod)
          for (let k = 0; k < 5; k++) {
            const a = k * 1.3,
              p = crown.clone().add(new Three.Vector3(Math.cos(a) * 2.2, -2.5 - (k % 2) * 1.5, Math.sin(a) * 2.2));
            blob(fm, p, 1.5, 1.7, 1.5, 0, 'scale', linear(k % 2 ? '#5d6a2f' : '#6b4f2e'), { normal: (q) => q.clone().sub(p).normalize(), sway: () => 0.3, seed: k, leaf: 0.2, uvSpread: 0.02, lumpy: 0.05 });
          }
        return fm.geometry({ species: S.key, lod, reach: S.R, crown: { y: crown.y, r: S.R, ry: 12 } });
      }
      const speciesGeometries = new Map();
      // One geometry per species and level of detail (0 near, 1 mid), made on first use.
      function speciesGeometry(key, lod = 0) {
        const id = key + '|' + lod;
        if (!speciesGeometries.has(id)) {
          const S = TREE_SPECIES[key];
          speciesGeometries.set(id, S.form === 'broad' ? buildBroadleaf(S, lod) : S.form === 'palm' ? buildPalm(S, lod) : buildConifer(S, lod));
        }
        return speciesGeometries.get(id);
      }
      /* ---- Instances ------------------------------------------------------------------- */
      // Everything the render loop switches between levels of detail.
      const foliageLodMeshes = [];
      const foliageMeshes = [];
      // An InstancedMesh of a species geometry with its own per-instance data
      // (the vertex buffers are shared with every other cell's mesh).
      function foliageInstances(geometry, count) {
        const g = new Three.BufferGeometry();
        for (const [name, attribute] of Object.entries(geometry.attributes)) g.setAttribute(name, attribute);
        g.setIndex(geometry.index);
        g.boundingBox = geometry.boundingBox;
        g.boundingSphere = geometry.boundingSphere;
        g.userData.foliage = geometry.userData.foliage;
        g.setAttribute('instanceFoliage', new Three.InstancedBufferAttribute(new Float32Array(count * 2), 2));
        const im = new Three.InstancedMesh(g, treeMaterial, count);
        im.instanceColor = new Three.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
        im.customDepthMaterial = treeDepthMaterial;
        im.castShadow = true;
        im.receiveShadow = true;
        const meta = geometry.userData.foliage;
        im.name = 'trees ' + meta.species + (meta.lod ? ' mid' : '');
        foliageMeshes.push(im);
        return im;
      }
      // Per instance: the tint and the (morph, density) pair.
      function setFoliageInstance(im, index, tint, morph, density) {
        im.setColorAt(index, tint);
        im.geometry.attributes.instanceFoliage.setXY(index, morph, density);
      }
      // Registers a breakable cell's tree mesh for the level-of-detail switch.
      function noteFoliageLod(im) {
        const lod = im.geometry.userData.foliage.lod;
        foliageLodMeshes.push({ im, lod, x: im.boundingSphere.center.x, z: im.boundingSphere.center.z });
        im.visible = !lod;
      }
      // The per-tree variation, all from its position.
      const vegTint = new Three.Color();
      function treeVariation(S, x, y) {
        const random = vegRandom(vegSeed(x, y, 3)),
          value = (random() - 0.5) * 0.22,
          hue = (random() - 0.5) * 0.14;
        vegTint.setRGB(1 + value + hue, 1 + value, 1 + value - hue * 1.2);
        // Seasonal accents, sparingly: a maple turning, a pear in blossom.
        const accent = random();
        if (S.key === 'maple' && accent < 0.14) vegTint.setRGB(...(accent < 0.07 ? [2.35, 0.95, 0.42] : [2.6, 0.62, 0.34]));
        else if (S.key === 'linden' && accent < 0.03) vegTint.setRGB(1.9, 1.35, 0.5);
        return {
          scale: 0.82 + random() * 0.36,
          aspect: 0.9 + random() * 0.22,
          yaw: random() * TAU,
          leanX: (random() - 0.5) * 0.09,
          leanZ: (random() - 0.5) * 0.09,
          morph: random() * 2 - 1,
          density: S.form === 'palm' ? 0 : Math.pow(random(), 1.6),
          tint: vegTint.clone(),
        };
      }
      /* ---- The far city's crowns ------------------------------------------------------- */
      const farTreeGeometry = new Three.IcosahedronGeometry(1, 1),
        farTreeMaterials = new Map();
      function farTreeMaterial(S) {
        if (!farTreeMaterials.has(S.key)) {
          const color = S.blossom ? S.leafColor.clone().lerp(S.blossom.linear, S.blossom.share * 0.6) : S.leafColor.clone();
          farTreeMaterials.set(S.key, new Three.MeshStandardMaterial({ color: color.multiplyScalar(0.8), roughness: 0.9 }));
        }
        return farTreeMaterials.get(S.key);
      }
      // One plain crown blob per tree for the far copy (FAR SCENERY), which only
      // takes opaque, untextured materials.
      function noteFarTree(S, x, ground, y, scale) {
        const crown = speciesGeometry(S.key, 0).userData.foliage.crown,
          blobMesh = new Three.Mesh(farTreeGeometry, farTreeMaterial(S));
        blobMesh.position.set(x, ground + crown.y * scale, y);
        blobMesh.scale.set(crown.r * scale, Math.max(crown.ry, crown.r * 0.4) * scale, crown.r * scale);
        blobMesh.updateMatrixWorld(true);
        noteFarScenery(blobMesh);
      }
      /* ---- Placement: species by district ------------------------------------------------ */
      // A weighted pick from `[[species, weight], ...]` with a 0..1 roll.
      function pickSpecies(table, roll) {
        let total = 0;
        for (const [, w] of table) total += w;
        let at = roll * total;
        for (const [key, w] of table) if ((at -= w) <= 0) return key;
        return table[table.length - 1][0];
      }
      const DISTRICT_TREES = {
        'NORTHBANK · OLD QUARTER': [
          ['linden', 5],
          ['plane', 4],
          ['maple', 1.5],
        ],
        'BATTERY POINT': [
          ['linden', 4],
          ['plane', 4],
          ['maple', 1],
        ],
        'BATTERY PARK': [
          ['plane', 3],
          ['oak', 2],
          ['linden', 2],
        ],
        MIDTOWN: [
          ['locust', 6],
          ['pear', 2.5],
          ['linden', 1.5],
        ],
        BROADWAY: [
          ['locust', 5],
          ['pear', 3],
          ['plane', 1.5],
        ],
        'EXCHANGE DISTRICT': [
          ['locust', 5],
          ['pear', 2],
          ['linden', 2],
        ],
        // The towers' plazas: stone pines among the locusts.
        'NORTH POINT · FINANCIAL': [
          ['locust', 5],
          ['pear', 2],
          ['stonePine', 1.5],
          ['plane', 1],
        ],
        'SOUTH BANK': [
          ['maple', 3.5],
          ['pear', 3],
          ['linden', 2],
          ['oak', 1.5],
        ],
        'THE RECLAMATION': [
          ['locust', 3],
          ['pear', 3],
          ['plane', 2],
          ['maple', 1],
        ],
        'HARBOR POINT MARINA': [
          ['plane', 3],
          ['locust', 2.5],
          ['stonePine', 1.5],
          ['pear', 1],
        ],
        'IRONWORKS DOCKS': [
          ['plane', 4],
          ['locust', 3],
        ],
        'CENTRAL GARDEN': [
          ['oak', 4],
          ['linden', 2],
          ['maple', 2],
          ['plane', 2],
        ],
      };
      const PARK_TREES = [
          ['oak', 5],
          ['linden', 2],
          ['maple', 2.5],
          ['plane', 2],
          ['beech', 1],
        ],
        COUNTY_TREES = [
          ['oak', 3],
          ['maple', 3],
          ['linden', 2],
          ['beech', 1.5],
          ['birch', 1],
        ],
        FOOTHILL_CONIFERS = [
          ['pine', 5],
          ['spruce', 2.5],
          ['fir', 2.5],
        ];
      // Palms by place on the Keys and in the resort towns.
      function palmSpeciesAt(x, y, roll) {
        const district = districtAt(x, y);
        if (district === BEACH.name || district === 'SUNSET PIER') return pickSpecies([['coconut', 6], ['royal', 1]], roll);
        if (district === 'OCEAN DRIVE') return pickSpecies([['fan', 6], ['coconut', 2.5], ['royal', 1]], roll);
        if (district === 'PALM KEYS · ART DECO') return pickSpecies([['royal', 3], ['fan', 3], ['coconut', 2]], roll);
        if (district === 'LITTLE HAVANA') return pickSpecies([['royal', 3], ['canary', 2.5], ['coconut', 1.5], ['fan', 1]], roll);
        if (district === 'CORAL MARINA') return pickSpecies([['coconut', 4], ['canary', 2], ['royal', 1]], roll);
        return pickSpecies([['coconut', 3], ['royal', 2], ['canary', 2], ['fan', 2]], roll);
      }
      // Which species a tree of the plan (`trees`, and renderer-only ones) grows as.
      function treeSpecies(t) {
        if (t.species) return t.species;
        const roll = vegHash(t.x, t.y, 1);
        // Monarch Isle: London planes with stone pines among them on the grand
        // streets and villa gardens, mixed palms on the waterfront, the garden's
        // cherries and the cypress walks.
        if (t.isle) {
          if (t.isle === 'palm') return pickSpecies([['royal', 3], ['coconut', 2], ['canary', 2]], roll);
          if (t.isle === 'cherry') return 'cherry';
          if (t.isle === 'cypress') return 'cypress';
          return roll < 0.2 ? 'stonePine' : 'plane';
        }
        const tropical = t.tropical ?? (onPalmKeys(t.x) && !t.county);
        if (tropical) {
          // Flame trees and jacarandas among the palms.
          if (roll < 0.26) return roll < 0.15 ? 'flame' : 'jacaranda';
          return palmSpeciesAt(t.x, t.y, vegHash(t.x, t.y, 2));
        }
        if (t.pine) return pickSpecies(FOOTHILL_CONIFERS, roll);
        if (t.park) {
          if (t.nearPond && roll < 0.7) return 'willow';
          if (t.blossom) return 'cherry';
          return pickSpecies(PARK_TREES, roll);
        }
        if (t.blossom) return 'cherry';
        if (t.county) return pickSpecies(COUNTY_TREES, roll);
        const table = DISTRICT_TREES[districtAt(t.x, t.y)],
          key = pickSpecies(table || DISTRICT_TREES.MIDTOWN, roll);
        return key === 'pear' && vegHash(t.x, t.y, 4) < 0.2 ? 'pearBlossom' : key;
      }
      const speciesCounts = {};
      /**
       * One tree of the plan (or a renderer-only one, landscape3d.js): a palm or a
       * tree of its species, a breakable prop (damage.js) drawn as instances
       * (BREAKABLE SCENERY), near and mid levels both linked to the prop.
       */
      function plantTree(t) {
        const key = treeSpecies(t),
          S = TREE_SPECIES[key];
        if (S.form === 'palm') {
          t.prop = plantPalm(t.x, t.y, t.r / 17, key);
          return;
        }
        const v = treeVariation(S, t.x, t.y),
          scale = (S.fixedScale ? 1 : t.r / 13) * v.scale,
          ground = terrainHeight(t.x, t.y),
          group = new Three.Group();
        group.position.set(t.x, ground, t.y);
        // The collision size class (damage.js treeProp) by the crown actually grown.
        t.prop = treeProp({ x: t.x, y: t.y, r: (S.R * scale) / 1.4, pine: S.conifer || S.form === 'cypress' || S.form === 'stonePine' });
        t.species = key;
        speciesCounts[key] = (speciesCounts[key] || 0) + 1;
        addTreeMeshes(group, S, v, scale);
        breakableGroup(t.prop, group);
        noteFarTree(S, t.x, ground, t.y, scale);
      }
      function addTreeMeshes(group, S, v, scale) {
        for (const lod of [0, 1]) {
          const m = new Three.Mesh(speciesGeometry(S.key, lod), treeMaterial);
          m.rotation.set(v.leanX, v.yaw, v.leanZ);
          m.scale.set(scale * v.aspect, scale / Math.sqrt(v.aspect), scale * v.aspect);
          m.userData.foliageTint = v.tint;
          m.userData.foliageMorph = v.morph;
          m.userData.foliageDensity = v.density;
          group.add(m);
        }
      }
      /**
       * A palm of `species` (by place when not given), `size` 1 for a 9 m palm of
       * the plan. A breakable prop (damage.js): it snaps and falls when a
       * vehicle brings enough energy. Returns the prop.
       */
      function plantPalm(x, z, size = 1, species = null) {
        const key = species || palmSpeciesAt(x, z, vegHash(x, z, 2)),
          S = TREE_SPECIES[key],
          v = treeVariation(S, x, z),
          scale = size * v.scale,
          ground = terrainHeight(x, z),
          prop = registerStreetProp('palm', x, z, 0, { half: [2 * size * S.girth, 2 * size * S.girth], size: 12 * size, breakKJ: S.breakKJ });
        speciesCounts[key] = (speciesCounts[key] || 0) + 1;
        const group = new Three.Group();
        group.position.set(x, ground, z);
        // Palms lean more than they vary in width.
        v.aspect = 0.95 + (v.aspect - 0.9) * 0.4;
        v.leanX *= 1.6;
        v.leanZ *= 1.6;
        addTreeMeshes(group, S, v, scale);
        breakableGroup(prop, group);
        noteFarTree(S, x, ground, z, scale);
        return prop;
      }
      /* ---- Level of detail, wind ------------------------------------------------------- */
      const MID_TREE_ZOOM = 0.5,
        MID_TREE_DISTANCE = 1500;
      function updateVegetation(deltaSeconds) {
        // Wrapped at 200 pi seconds, where every term of the sway and flutter
        // comes round to its start (a jump-free loop that keeps float precision).
        foliageUniforms.foliageTime.value = (foliageUniforms.foliageTime.value + deltaSeconds * (1 + weather.wind * 1.5)) % (200 * Math.PI);
        // A few inches of movement in a breeze, a foot or more in a gale.
        foliageUniforms.foliageWind.value = 0.3 + weather.wind * 1.1 + weather.rain * 0.3;
        const lod = activeTier ? activeTier.lodBias : 1,
          far = farSceneryShown,
          streetNear = viewZoom >= MID_TREE_ZOOM * lod;
        for (const entry of foliageLodMeshes) {
          let near = streetNear;
          if (flightViewActive) near = Math.hypot(camera.position.x - entry.x, camera.position.z - entry.z, camera.position.y) < MID_TREE_DISTANCE / lod;
          entry.im.visible = !far && (entry.lod ? !near : near);
        }
      }
      /* ---- Report (DeadEndCity.vegetation) ---------------------------------------------- */
      const vegSphere = new Three.Sphere();
      function vegetationReport() {
        let calls = 0,
          triangles = 0,
          instances = 0;
        const inView = {};
        for (const im of foliageMeshes) {
          let shown = im.visible;
          for (let o = im.parent; shown && o; o = o.parent) shown = o.visible;
          if (!shown || !im.count) continue;
          if (!im.boundingSphere) im.computeBoundingSphere();
          vegSphere.copy(im.boundingSphere).applyMatrix4(im.matrixWorld);
          if (!viewFrustum.intersectsSphere(vegSphere)) continue;
          const tris = (im.geometry.index ? im.geometry.index.count : im.geometry.attributes.position.count) / 3;
          calls++;
          instances += im.count;
          triangles += tris * im.count;
          inView[im.name] = (inView[im.name] || 0) + im.count;
        }
        const perTree = {};
        for (const [id, g] of speciesGeometries) perTree[id] = g.index.count / 3;
        return {
          species: { ...speciesCounts },
          forest: { ...forestCounts },
          view: { drawCalls: calls, shadowCasters: calls, instances, triangles: Math.round(triangles), meshes: inView },
          trianglesPerTree: perTree,
        };
      }
      // Filled by county3d.js (the Ridgeline forests).
      const forestCounts = {};
      // Inspection only (DeadEndCity.treeLineup): one of every species in rows
      // east of (x, y), `lod` 0 near or 1 mid, as plain instances (nothing to knock over).
      let lineupGroup = null;
      function treeLineup(x, y, spacing = 90, lod = 0, perRow = 8) {
        if (lineupGroup) {
          scene.remove(lineupGroup);
          for (const im of lineupGroup.children) {
            foliageMeshes.splice(foliageMeshes.indexOf(im), 1);
            im.dispose();
          }
        }
        lineupGroup = new Three.Group();
        lineupGroup.name = 'tree lineup';
        const keys = Object.keys(TREE_SPECIES),
          m4 = new Three.Matrix4(),
          white = new Three.Color(1, 1, 1);
        keys.forEach((key, i) => {
          const im = foliageInstances(speciesGeometry(key, lod), 1),
            px = x + (i % perRow) * spacing,
            py = y + Math.floor(i / perRow) * spacing * 1.4,
            scale = TREE_SPECIES[key].form === 'palm' ? 1 : 1;
          m4.makeScale(scale, scale, scale).setPosition(px, terrainHeight(px, py), py);
          im.setMatrixAt(0, m4);
          setFoliageInstance(im, 0, white, 0, 0);
          im.computeBoundingSphere();
          lineupGroup.add(im);
        });
        scene.add(lineupGroup);
        return keys;
      }
      // END SUBSYSTEM: src/vegetation3d.js
