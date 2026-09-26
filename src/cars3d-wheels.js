      // ---- Tyres and rims ----------------------------------------------------------------------
      /*
       * A unit tyre (radius 1, width 1, axis y like wheelGeo): tread, rounded
       * shoulders and sidewalls down to the bead. `kind`: 'road', 'whitewall'
       * (a white band on the sidewall, vertex colour), 'knobby' (blocks round the
       * tread and shoulders). The bead radius is the rim's (`bead`).
       */
      const civTyres = new Map();
      function civTyreGeometry(kind = 'road', bead = 0.68) {
        const key = kind + ':' + bead.toFixed(2);
        if (civTyres.has(key)) return civTyres.get(key);
        const profile = [
            [bead, -0.44],
            [bead + (0.9 - bead) * 0.5, -0.49],
            [0.9, -0.5],
            [0.96, -0.47],
            [0.995, -0.4],
            [1, -0.3],
            [1, 0.3],
            [0.995, 0.4],
            [0.96, 0.47],
            [0.9, 0.5],
            [bead + (0.9 - bead) * 0.5, 0.49],
            [bead, 0.44],
          ].map(([r, y]) => new Three.Vector2(r, y)),
          lathe = new Three.LatheGeometry(profile, 14),
          set = civSet(),
          sidewall = (r) => (kind === 'whitewall' && r > bead + (0.9 - bead) * 0.25 && r < bead + (0.9 - bead) * 0.8 ? '#e8e6de' : '#26272a');
        // Colour the lathe by radius (whitewalls), tread darker.
        const pos = lathe.attributes.position,
          colors = [];
        lathe.computeVertexNormals();
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getZ(i));
          civColor.set(r > 0.985 ? '#1c1d1f' : sidewall(r));
          colors.push(civColor.r, civColor.g, civColor.b);
        }
        const tread = trimCellRect('tread'),
          solid = trimCellRect('solid');
        for (let i = 0; i < pos.count; i++) {
          civVector.fromBufferAttribute(pos, i);
          set.position.push(civVector.x, civVector.y, civVector.z);
          civVector.fromBufferAttribute(lathe.attributes.normal, i);
          set.normal.push(civVector.x, civVector.y, civVector.z);
          const r = Math.hypot(pos.getX(i), pos.getZ(i));
          if (r > 0.985) {
            // Tread blocks from the atlas round the circumference.
            const a = Math.atan2(pos.getZ(i), pos.getX(i));
            set.uv.push(tread[0] + ((a / TAU + 0.5) * 6 % 1) * (tread[2] - tread[0]), tread[1] + (pos.getY(i) + 0.5) * (tread[3] - tread[1]));
          } else set.uv.push((solid[0] + solid[2]) / 2, (solid[1] + solid[3]) / 2);
          set.color.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
          set.finish.push(0.9, 0);
        }
        for (let i = 0; i < lathe.index.count; i++) set.index.push(lathe.index.getX(i));
        set.count = pos.count;
        lathe.dispose();
        if (kind === 'knobby') {
          // Knobs: staggered blocks over the tread and down the shoulders.
          const S = civShapeKit(),
            blocks = 26;
          for (let i = 0; i < blocks; i++) {
            const a = (i / blocks) * TAU;
            for (const [y, r, s] of [[0, 1.04, 0.18], [i % 2 ? 0.3 : -0.3, 1.02, 0.15], [i % 2 ? -0.43 : 0.43, 0.97, 0.12]])
              civAdd(set, S.box, Math.cos(a) * r, y, Math.sin(a) * r, 0.12, s, 0.14, { color: '#222326', finish: 'rubber' }, 0, -a, 0);
          }
        }
        const geo = civGeometry(set);
        civTyres.set(key, geo);
        return geo;
      }
      /*
       * Rims, merged per style, side and size with the brake disc behind them.
       * style: spokes (count), shape ('straight', 'split', 'y', 'star', 'mesh',
       * 'aero', 'steel', 'smoothie', 'offroad', 'spider', 'dirt'), colour, lip.
       */
      const civRims = new Map();
      function civRimGeometry(rim, side, r, width) {
        const key = [rim.style, rim.spokes, rim.color, rim.lip, side, r.toFixed(2), width.toFixed(2), rim.frac].join(':');
        if (civRims.has(key)) return civRims.get(key);
        const S = civShapeKit(),
          set = civSet(),
          across = Math.PI / 2,
          face = side * (width / 2),
          R = r * (rim.frac || 0.7),
          color = rim.color || '#b9bec3',
          dark = '#1a1b1e',
          metal = rim.finish || 'alloy',
          out = (d) => face + side * d,
          disc = (radius, t, z, c, finish, geo = S.cylinder24) => civAdd(set, geo, 0, 0, z, radius, t, radius, { color: c, finish }, across, 0, 0);
        // The dark inside of the rim, the brake disc with its hat.
        disc(R * 0.99, 0.02, face - side * width * 0.6, '#2a2c30', 'satin', S.cylinderLow);
        if (rim.style !== 'dirt') {
          disc(R * 0.86, 0.12, face - side * width * 0.32, '#6d7176', 'satin', S.cylinderLow);
          disc(R * 0.36, 0.2, face - side * width * 0.28, '#2b2d31', 'satin', S.cylinderLow);
        }
        // The lip: a bright ring round the face.
        civAdd(set, S.torus, 0, 0, out(0.01), R * 0.985, R * 0.985, 1.2, { color: rim.lipColor || color, finish: rim.lipColor ? 'chrome' : metal }, 0, 0, 0);
        const spokes = rim.spokes || 5,
          hubR = R * 0.24,
          spokeZ = out(-0.02);
        if (rim.style === 'steel' || rim.style === 'smoothie' || rim.style === 'aero') {
          // A dished face: a steel wheel with a hubcap, a chrome smoothie, an aero cover.
          const capColor = rim.style === 'steel' ? rim.capColor || '#c3c7cb' : color;
          disc(R * 0.96, 0.08, out(-0.03), rim.style === 'steel' ? '#2e3136' : color, rim.style === 'smoothie' ? 'chrome' : metal);
          civAdd(set, S.dome, 0, 0, out(0.0), R * (rim.style === 'aero' ? 0.93 : 0.8), rim.style === 'aero' ? 0.12 : 0.28, R * (rim.style === 'aero' ? 0.93 : 0.8), { color: capColor, finish: rim.style === 'aero' ? 'satin' : 'chrome' }, side * across, 0, 0);
          if (rim.style === 'aero')
            for (let i = 0; i < spokes; i++) {
              const a = (i / spokes) * TAU;
              civBeam(set, S.box, [Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28, out(0.1)], [Math.cos(a + 0.5) * R * 0.86, Math.sin(a + 0.5) * R * 0.86, out(0.06)], R * 0.1, 0.06, { color: dark, finish: 'gloss' }, [0, 0, 1]);
            }
          if (rim.style === 'steel')
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * TAU;
              // The ventilation holes round the dish.
              civAdd(set, S.cylinderLow, Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68, out(0.0), R * 0.07, 0.06, R * 0.07, { color: '#15171a', finish: 'satin' }, across, 0, 0);
            }
        } else {
          // Spokes from the hub to the lip, in the style's shape.
          const spoke = (a, width2, reach = 0.96, lift = 0.05, c = color) =>
            civBeam(set, S.box, [Math.cos(a) * hubR * 0.9, Math.sin(a) * hubR * 0.9, out(lift)], [Math.cos(a) * R * reach, Math.sin(a) * R * reach, spokeZ], R * width2, 0.1, { color: c, finish: metal }, [0, 0, 1]);
          for (let i = 0; i < spokes; i++) {
            const a = (i / spokes) * TAU + (rim.twist || 0);
            if (rim.style === 'split') {
              spoke(a - 0.1, 0.09);
              spoke(a + 0.1, 0.09);
            } else if (rim.style === 'y') {
              spoke(a, 0.13, 0.6);
              for (const d of [-0.2, 0.2])
                civBeam(set, S.box, [Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, out(0.02)], [Math.cos(a + d) * R * 0.96, Math.sin(a + d) * R * 0.96, spokeZ], R * 0.09, 0.1, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'star') {
              // Five-point star: wide at the hub, tapering out.
              spoke(a, 0.22, 0.55, 0.06);
              spoke(a, 0.12, 0.97, 0.04);
            } else if (rim.style === 'spider') {
              // Thin twin spokes twisting towards the lip.
              for (const d of [-0.06, 0.06])
                civBeam(set, S.box, [Math.cos(a + d) * hubR, Math.sin(a + d) * hubR, out(0.05)], [Math.cos(a + d * 3 + 0.18) * R * 0.96, Math.sin(a + d * 3 + 0.18) * R * 0.96, spokeZ], R * 0.06, 0.1, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'mesh') {
              spoke(a, 0.05, 0.96, 0.03);
              civBeam(set, S.box, [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, out(0.02)], [Math.cos(a + TAU / spokes) * R * 0.5, Math.sin(a + TAU / spokes) * R * 0.5, out(0.02)], R * 0.04, 0.08, { color, finish: metal }, [0, 0, 1]);
            } else if (rim.style === 'offroad') {
              spoke(a, 0.2, 0.96, 0.04);
              civAdd(set, S.cylinderLow, Math.cos(a + Math.PI / spokes) * R * 0.86, Math.sin(a + Math.PI / spokes) * R * 0.86, out(0.02), R * 0.06, 0.08, R * 0.06, { color: '#303236', finish: 'satin' }, across, 0, 0);
            } else if (rim.style === 'dirt') {
              // Wire spokes and a gold anodised hub.
              for (const d of [-1, 1])
                civBeam(set, S.box, [Math.cos(a) * hubR * 0.7, Math.sin(a) * hubR * 0.7, face - side * width * 0.3 * d], [Math.cos(a + 0.3) * R * 0.97, Math.sin(a + 0.3) * R * 0.97, face - side * width * 0.5], R * 0.018, 0.018, { color: '#c9ccd0', finish: 'chrome' }, [0, 0, 1]);
            } else spoke(a, rim.spokeWidth || 0.16);
          }
          if (rim.style === 'mesh' || rim.style === 'split' || rim.style === 'y') disc(R * 0.95, 0.03, out(-0.08), dark, 'satin');
          // Hub and centre cap (a centre-lock nut on the exotics).
          disc(hubR, 0.14, out(0.06), rim.hubColor || color, metal, S.cylinderLow);
          disc(hubR * 0.6, 0.1, out(0.11), rim.capColor || '#2a2c30', rim.centreLock ? 'chrome' : 'gloss', rim.centreLock ? S.hex : S.cylinderLow);
        }
        const geo = civGeometry(set);
        civRims.set(key, geo);
        return geo;
      }
