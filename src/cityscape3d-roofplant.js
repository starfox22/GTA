      // Roof plant extras: mushroom exhaust fans, a galvanized duct run, plumbing vent stacks and conduit on the city's
      // flat roofs, in FRONT PAINT (no new batch), from a stream of their own, low and clear of the recorded plant.
      /**
       * ROOF EXTRAS
       * Seen from above a working roof is busy with small plant, and the plant the game knows about (the AC
       * clusters, bulkheads, water towers, dishes and skylights that decorateRoof records as `b.roofKeepOuts`, read
       * by the helicopter landing and roof walking rules) left most of each roof bare. These extras are decoration
       * only: never recorded, never solid, under 4 units tall (lower than the 5-unit vents already there), and set
       * clear of every recorded box so they never stand in the plant. They draw from their own stream
       * (`roofPlantSeed` per building), never cityRandom, whose stream after the buildings places the roof plant and
       * the bus stops. Every part is FRONT PAINT (cityscape3d-frontage.js: one shared material, colour as a vertex
       * colour, which every city cell already draws), boxes from `paintBox` and round parts from `roofPaintCylinder`,
       * so a cell gains triangles but not a draw call.
       */
      const ROOF_PLANT_COLORS = {
          galvanized: '#a7aeb1',
          fanCap: '#8e979c',
          stem: '#5d6469',
          curb: '#73777a',
          stack: '#3f4549',
          conduit: '#81888c',
        },
        roofPaintCylinders = new Map();
      let roofPlantState = 1;
      function roofPlantSeed(i) {
        roofPlantState = (Math.imul(i + 7, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
      }
      function roofPlantRandom() {
        roofPlantState = (roofPlantState + 0x6d2b79f5) >>> 0;
        let t = roofPlantState;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
      // A FRONT PAINT cylinder of one colour (the box's twin, frontPaintGeometry): the attributes FRONT PAINT's batch carries.
      function roofPaintCylinder(color) {
        let geometry = roofPaintCylinders.get(color);
        if (geometry) return geometry;
        geometry = cylinderGeo.clone();
        const count = geometry.attributes.position.count,
          tint = new Three.Color(color),
          colors = new Float32Array(count * 3);
        for (let k = 0; k < count; k++) {
          colors[k * 3] = tint.r;
          colors[k * 3 + 1] = tint.g;
          colors[k * 3 + 2] = tint.b;
        }
        geometry.setAttribute('color', new Three.BufferAttribute(colors, 3));
        geometry.setAttribute('cityLit', new Three.BufferAttribute(new Float32Array(count * 2), 2));
        roofPaintCylinders.set(color, geometry);
        return geometry;
      }
      function roofExtras(kind, b, group, i) {
        if (b.helipad || b.skyline || !['office', 'brick', 'stucco', 'deco'].includes(kind) || b.w < 60 || b.h < 60) return;
        roofPlantSeed(i);
        const top = b.height,
          keep = (b.roofKeepOuts || []).map((k) => ({ x: k.x - b.x, z: k.y - b.y, hx: k.hx, hz: k.hy })),
          rnd = roofPlantRandom;
        // An office's hatches down the middle and the solar array's place (unrecorded plant of decorateRoof).
        if (kind === 'office') keep.push({ x: b.w / 2, z: b.h / 2, hx: b.w / 2, hz: 5 }, { x: 70, z: 30, hx: 42, hz: 13 });
        // Clear of the parapet (its coping is 4 wide) and of every recorded box, in the group's space.
        const clear = (x, z, hx, hz) =>
            x - hx > 8 &&
            x + hx < b.w - 8 &&
            z - hz > 8 &&
            z + hz < b.h - 8 &&
            !keep.some((k) => Math.abs(k.x - x) < k.hx + hx + 2 && Math.abs(k.z - z) < k.hz + hz + 2),
          spot = (hx, hz) => {
            for (let tries = 0; tries < 12; tries++) {
              const x = hx + 8 + rnd() * (b.w - 16 - 2 * hx),
                z = hz + 8 + rnd() * (b.h - 16 - 2 * hz);
              if (clear(x, z, hx, hz)) return [x, z];
            }
            return null;
          },
          area = b.w * b.h;
        // Mushroom exhaust fans on a curb: kitchens, washrooms, stairwells.
        const fans = Math.min(4, 1 + Math.floor(area / 9000) + (rnd() < 0.4 ? 1 : 0));
        for (let k = 0; k < fans; k++) {
          const at = spot(3.5, 3.5);
          if (!at) continue;
          const [x, z] = at,
            r = 1.9 + rnd() * 0.8;
          paintBox(group, x, top + 0.4, z, r * 2 + 1.6, 0.8, r * 2 + 1.6, ROOF_PLANT_COLORS.curb);
          mesh(roofPaintCylinder(ROOF_PLANT_COLORS.stem), FRONT_PAINT, group, x, top + 1.6, z, r * 0.62, 1.8, r * 0.62);
          mesh(roofPaintCylinder(ROOF_PLANT_COLORS.fanCap), FRONT_PAINT, group, x, top + 2.9, z, r, 0.9, r);
        }
        // A galvanized duct run on low stands, into the roof through a plenum box at one end.
        if (rnd() < (kind === 'office' ? 0.7 : 0.45)) {
          const alongX = rnd() < 0.5,
            length = Math.min((alongX ? b.w : b.h) - 30, 24 + rnd() * 40),
            radius = 1.1 + rnd() * 0.4,
            at = alongX ? spot(length / 2 + 3, radius + 2) : spot(radius + 2, length / 2 + 3);
          if (at && length > 16) {
            const [x, z] = at,
              y = top + 0.9 + radius,
              duct = mesh(roofPaintCylinder(ROOF_PLANT_COLORS.galvanized), FRONT_PAINT, group, x, y, z, radius, length, radius);
            if (alongX) duct.rotation.z = Math.PI / 2;
            else duct.rotation.x = Math.PI / 2;
            for (let s = -length / 2 + 4; s <= length / 2 - 4; s += 12)
              paintBox(group, alongX ? x + s : x, top + 0.6, alongX ? z : z + s, alongX ? 0.8 : radius * 2 + 0.6, 1.2, alongX ? radius * 2 + 0.6 : 0.8, ROOF_PLANT_COLORS.stack);
            const end = (length / 2 + 1.8) * (rnd() < 0.5 ? -1 : 1);
            paintBox(group, alongX ? x + end : x, top + 1.8, alongX ? z : z + end, 3.6, 3.6, 3.6, ROOF_PLANT_COLORS.galvanized);
          }
        }
        // Plumbing vent stacks, a hand high, and a run of conduit along a parapet.
        const stacks = 2 + Math.floor(rnd() * 4);
        for (let k = 0; k < stacks; k++) {
          const at = spot(1, 1);
          if (at) mesh(roofPaintCylinder(ROOF_PLANT_COLORS.stack), FRONT_PAINT, group, at[0], top + 1.3, at[1], 0.45, 2.6, 0.45);
        }
        if (rnd() < 0.5) {
          const north = rnd() < 0.5,
            z = north ? 6.2 : b.h - 6.2,
            from = 10 + rnd() * b.w * 0.3,
            to = b.w - 10 - rnd() * b.w * 0.3;
          if (to - from > 20 && !keep.some((k) => Math.abs(k.z - z) < k.hz + 2 && k.x + k.hx > from && k.x - k.hx < to))
            paintBox(group, (from + to) / 2, top + 0.45, z, to - from, 0.6, 0.6, ROOF_PLANT_COLORS.conduit);
        }
      }
