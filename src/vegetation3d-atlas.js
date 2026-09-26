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
