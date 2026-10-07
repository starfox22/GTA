      // Near set heads: a face modelled into the head loft (sockets, brow, nose, cheekbones, lips, chin, jaw) as
      // a man's and a woman's shape, ears, and the seven hair styles in one mesh with hairlines, partings, curls.
      /**
       * NEAR HEAD
       * Head space (character-rig3d.js HEAD): the joint at the neck base, +x forward, +z right, the
       * crown at 2.35. The face is sculpted onto the close set's head rings sampled densely, with the
       * angles bunched towards the front; the near shader paints eyes, brows, lips and stubble at the
       * same places (NEAR_FACE there), so the paint sits in the sockets and on the lips modelled here.
       */
      const NEAR_FACE = { eyeY: 1.46, eyeZ: 0.255, browY: 1.6, noseTipY: 1.12, mouthY: 0.905 };
      // Deterministic lumps for curls and ragged ends.
      const nearLumps = (x, y, z) => Math.sin(x * 13.1 + y * 4.3) * Math.sin(y * 10.7 - z * 7.9) * Math.sin(z * 12.3 + x * 6.1);
      function nearFaceSculpt(female) {
        const k = female ? { brow: 0.4, nose: 0.8, lips: 1.3, jaw: 0.35, chin: 0.75, cheek: 1.15 } : { brow: 1, nose: 1, lips: 1, jaw: 1, chin: 1, cheek: 1 },
          F = NEAR_FACE;
        return (x, y, z) => {
          if (x < -0.25) return 0;
          const az = Math.abs(z),
            fr = clamp((x - 0.1) / 0.45, 0, 1);
          let d = 0;
          // Eye sockets under the brow, the eyeballs in them.
          d += fr * (-0.06 * nearBump(y - F.eyeY - 0.015, 0.085, az - F.eyeZ, 0.13) + 0.032 * nearBump(y - F.eyeY, 0.045, az - F.eyeZ, 0.085));
          // Brow ridge and the glabella between.
          d += fr * k.brow * (0.035 * nearBump(y - F.browY, 0.05, az - 0.25, 0.2) + 0.016 * nearBump(y - F.browY + 0.05, 0.05, z, 0.07));
          // Nose: bridge to tip, the wings, a steep underside.
          if (y > 0.98 && y < 1.56) {
            const t = clamp((1.5 - y) / (1.5 - F.noseTipY), 0, 1),
              width = 0.045 + 0.035 * t,
              under = y < F.noseTipY ? Math.exp(-((F.noseTipY - y) ** 2) / (0.033 * 0.033)) : 1;
            d += fr * k.nose * (0.015 + 0.15 * Math.pow(t, 1.4)) * under * Math.exp(-(z * z) / (width * width));
            d += fr * k.nose * 0.045 * nearBump(y - F.noseTipY + 0.02, 0.04, az - 0.095, 0.045);
          }
          // Cheekbones, and the hollow under them on a man.
          d += fr * k.cheek * 0.03 * nearBump(y - 1.3, 0.09, az - 0.43, 0.13);
          if (!female) d -= fr * 0.012 * nearBump(y - 1.06, 0.08, az - 0.45, 0.1);
          // Lips, the line between them, the corners, the philtrum.
          d += fr * k.lips * (0.032 * nearBump(y - F.mouthY - 0.04, 0.028, z, 0.15) + 0.038 * nearBump(y - F.mouthY + 0.037, 0.033, z, 0.135));
          d -= fr * (0.014 * nearBump(y - F.mouthY, 0.011, z, 0.17) + 0.012 * nearBump(y - F.mouthY, 0.03, az - 0.2, 0.035) + 0.007 * nearBump(y - F.mouthY - 0.09, 0.03, z, 0.025));
          // Chin, the jaw's angle, the temples.
          d += fr * k.chin * 0.04 * nearBump(y - 0.71, 0.07, z, female ? 0.1 : 0.15);
          d += k.jaw * 0.03 * nearBump(y - 0.8, 0.1, az - 0.5, 0.1) * nearBump(x - 0.2, 0.25, 0, 1);
          d -= fr * 0.02 * nearBump(y - 1.62, 0.12, az - 0.6, 0.1);
          return d;
        };
      }
      const NEAR_HEAD_YS = nearJoin(nearSpan(0, 0.55, 0.14), nearSpan(0.55, 1.0, 0.05), nearSpan(1.0, 1.2, 0.033), nearSpan(1.2, 1.75, 0.05), nearSpan(1.75, 2.35, 0.1));
      function nearSkull(female) {
        const g = nearLoft(nearRings(RIG_HEAD_RINGS, NEAR_HEAD_YS), 36, { warp: 0.55 });
        return nearSculpt(g, nearFaceSculpt(female));
      }
      /* The right ear (the left is its mirror): a flat, tilted shell with a hollow, standing off the head. */
      function nearEar() {
        const g = nearLoft(
          nearRings(
            [
              { y: 1.12, fx: 0.06, bx: 0.06, w: 0.035, cx: 0.02 },
              { y: 1.2, fx: 0.1, bx: 0.1, w: 0.045 },
              { y: 1.35, fx: 0.1, bx: 0.15, w: 0.05, cx: -0.02 },
              { y: 1.5, fx: 0.08, bx: 0.16, w: 0.05, cx: -0.03 },
              { y: 1.6, fx: 0.05, bx: 0.12, w: 0.04, cx: -0.04 },
              { y: 1.66, fx: 0.02, bx: 0.05, w: 0.03, cx: -0.03, dome: 0.015 },
            ],
            nearSpan(1.12, 1.66, 0.06),
          ),
          12,
        );
        // The bowl of the ear on its outer face.
        nearSculpt(g, (x, y, z, nx, ny, nz) => (nz > 0.3 ? -0.022 * nearBump(y - 1.36, 0.11, x + 0.03, 0.06) : 0));
        g.translate(0, -1.38, 0);
        g.rotateZ(-0.2);
        // The back edge flares out from the head (the head's side is at z 0.645 there).
        g.rotateY(0.25);
        g.translate(-0.07, 1.38, 0.675);
        g.computeVertexNormals();
        return g;
      }
      function nearHeadGeometry() {
        const ear = nearEar();
        return nearMerge([nearPack(nearSkull(false), NEAR_KIND.head, nearSkull(true)), nearPack(ear, NEAR_KIND.head), nearPack(nearMirror(ear), NEAR_KIND.head)]);
      }

      /* ---- Hair ---------------------------------------------------------------------- */
      /**
       * HAIR
       * The close set's styles sampled smoothly, then: the front hairline raised to a real forehead (the
       * shell sinks under the skin below it, temples receding, sideburns down to the ears), a parting
       * pressed in, volume on top, curls for the curly style, ragged ends on long hair, a bun or a tied
       * tail. Variants in NEAR_HAIR order.
       */
      function nearHairline(centre, temple) {
        // Height of the hairline across the forehead (|z|): highest at the temples, down to the sideburns.
        return (az) => (az < 0.36 ? centre + (temple - centre) * (az / 0.36) ** 2 : temple - (az - 0.36) * 1.9);
      }
      function nearHairShape(rings, { hairline, parting = null, volume = 0.02, curls = 0, ragged = 0 } = {}) {
        const ys = nearSpan(rings[0].y, rings[rings.length - 1].y, 0.09),
          g = nearLoft(nearRings(rings, ys), 30, { warp: 0.4 }),
          bottom = rings[0].y;
        return nearSculpt(g, (x, y, z) => {
          const az = Math.abs(z);
          let d = 0;
          // Below the hairline on the face side the shell sinks under the skin.
          if (hairline && x > 0.25) d -= 0.12 * clamp((hairline(az) - y) / 0.05, 0, 1) * clamp((x - 0.25) / 0.2, 0, 1);
          if (y > 2.0) d += volume * clamp((y - 2.0) / 0.3, 0, 1);
          if (parting !== null && y > 1.8 && x > -0.4) d -= 0.028 * nearBump(z - parting, 0.03, 0, 1) * clamp((y - 1.8) / 0.2, 0, 1);
          if (curls) d += curls * (0.5 + 0.5 * nearLumps(x * 1.6, y * 1.6, z * 1.6));
          if (ragged && y < bottom + 0.9) d += ragged * nearLumps(x * 2.3, y * 0.7, z * 2.3) * clamp((bottom + 0.9 - y) / 0.6, 0, 1);
          return d;
        });
      }
      function nearHairGeometry() {
        const { short, crop, buzz, long, curly, bob } = rigHairRingLists(),
          man = nearHairline(1.97, 2.06),
          woman = nearHairline(1.93, 1.99),
          bobShape = () => nearHairShape(bob, { hairline: woman, parting: 0.18, volume: 0.03 }),
          tail = () => {
            const points = [],
              radii = [];
            for (let i = 0; i <= 8; i++) {
              const t = i / 8;
              points.push(new Three.Vector3(-0.92 - 0.22 * t - 0.05 * Math.sin(t * Math.PI), 1.86 - 1.45 * t, 0.03 * Math.sin(t * 5)));
              radii.push(0.17 * (1 - t * 0.55) + 0.03 * Math.sin(t * Math.PI));
            }
            return nearTube(points, radii, 9);
          };
        const styles = [
          [nearHairShape(short, { hairline: man, parting: 0.24, volume: 0.035 })],
          [nearHairShape(crop, { hairline: man, volume: 0.02, curls: 0.012 })],
          [nearHairShape(buzz, { hairline: man, volume: 0 })],
          [nearHairShape(long, { hairline: woman, parting: 0.0, volume: 0.03, ragged: 0.035 })],
          [nearHairShape(curly, { hairline: woman, volume: 0.02, curls: 0.055 })],
          [bobShape(), nearSculpt(rigBall(0.36, 0.34, 0.36, 0, -0.78, 2.12, 0, 16, 12), (x, y, z) => 0.02 * nearLumps(x * 3, y * 3, z * 3))],
          [bobShape(), rigBall(0.2, 0.2, 0.22, 0, -0.86, 1.92, 0, 12, 8), tail()],
        ];
        return nearMerge(styles.flatMap((parts, variant) => parts.map((g) => nearPack(g, NEAR_KIND.hair, null, variant))));
      }
