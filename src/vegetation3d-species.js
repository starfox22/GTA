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
