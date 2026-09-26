      // ---- Vehicle bodies ------------------------------------------------------------------
      // Section table of the saloon shell: x along the length, then width
      // and height factors. The damageable shell is re-sliced much finer from it.
      const SHELL_SECTIONS = [
        [-0.5, 0.82, 0.84],
        [-0.43, 1, 1],
        [-0.21, 1, 1],
        [0.19, 1, 1],
        [0.42, 0.94, 0.88],
        [0.5, 0.78, 0.73],
      ];
      const pristineShells = new Map(),
        pristineCabins = new Map(),
        carGlass = new Three.MeshStandardMaterial({ color: '#182b3c', roughness: 0.12, metalness: 0.65 }),
        crackedGlass = new Three.MeshStandardMaterial({ map: crackedGlassTexture, roughness: 0.32, metalness: 0.45 }),
        // An empty frame: the dark cabin seen through where the glass was.
        brokenGlass = new Three.MeshStandardMaterial({ color: '#0d0f11', roughness: 0.95 }),
        deadLamp = new Three.MeshStandardMaterial({ color: '#2b2824', roughness: 0.45, metalness: 0.35 }),
        burntMetal = new Three.MeshStandardMaterial({ color: '#2c2a27', roughness: 0.95, metalness: 0.25 }),
        engineBay = new Three.MeshStandardMaterial({ color: '#25282a', roughness: 0.6, metalness: 0.5 });
      let damageResourcesClaimed = false;
      // Shared damage resources must survive pruneModels(); register them once.
      function claimDamageResources() {
        if (damageResourcesClaimed) return;
        damageResourcesClaimed = true;
        for (const material of [carGlass, crackedGlass, brokenGlass, deadLamp, burntMetal, engineBay]) sharedMaterials.add(material);
      }
      function shellSection(t) {
        for (let k = 0; k < SHELL_SECTIONS.length - 1; k++) {
          const a = SHELL_SECTIONS[k],
            b = SHELL_SECTIONS[k + 1];
          if (t <= b[0] + 1e-6) {
            const f = (t - a[0]) / (b[0] - a[0]);
            return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
          }
        }
        return SHELL_SECTIONS[SHELL_SECTIONS.length - 1].slice(1);
      }
      // The saloon shell with 23 slices (closer together at the ends, where cars crumple)
      // and 13 points round each, with UVs for the soot map. Shared until dented.
      function carShellGeometry(l, w, h) {
        claimDamageResources();
        const key = l + ':' + w + ':' + h;
        if (pristineShells.has(key)) return pristineShells.get(key);
        const verts = [],
          uvs = [],
          indices = [],
          slices = 23,
          ring = 13;
        for (let i = 0; i < slices; i++) {
          const t = -0.5 * Math.cos((i / (slices - 1)) * Math.PI),
            [ww, hh] = shellSection(t),
            z = (w / 2) * ww,
            top = h * hh,
            mid = (4.8 + top - 1) / 2;
          const points = [
            [3.8, -z * 0.84],
            [4.8, -z],
            [mid, -z],
            [top - 1, -z],
            [top, -z * 0.83],
            [top, -z * 0.42],
            [top, 0],
            [top, z * 0.42],
            [top, z * 0.83],
            [top - 1, z],
            [mid, z],
            [4.8, z],
            [3.8, z * 0.84],
          ];
          points.forEach(([y, zz], j) => {
            verts.push(t * l, y, zz);
            uvs.push(t + 0.5, j / (ring - 1));
          });
        }
        for (let k = 0; k < slices - 1; k++)
          for (let j = 0; j < ring; j++) {
            const a = k * ring + j,
              b = k * ring + ((j + 1) % ring),
              c = (k + 1) * ring + ((j + 1) % ring),
              d = (k + 1) * ring + j;
            indices.push(a, b, d, b, c, d);
          }
        const last = (slices - 1) * ring;
        for (let j = 1; j < ring - 1; j++) {
          indices.push(0, j + 1, j);
          indices.push(last, last + j, last + j + 1);
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        pristineShells.set(key, geo);
        sharedGeometries.add(geo);
        return geo;
      }
      // The glasshouse as five separate panes (left, front, right, rear, roof) in
      // material groups, so each can crack or burst on its own.
      const PANE_ORDER = ['left', 'front', 'right', 'rear', 'roof'];
      function carCabinGeometry(l, w, base, roof, van) {
        const key = [l, w, base, roof, van].join(':');
        if (pristineCabins.has(key)) return pristineCabins.get(key);
        const xb = van ? -0.41 : -0.32,
          xf = 0.27,
          rb = van ? -0.4 : -0.19,
          rf = van ? 0.13 : 0.07,
          wb = w * 0.42,
          wt = w * 0.35,
          corner = [
            [xb * l, base, -wb],
            [xf * l, base, -wb],
            [xf * l, base, wb],
            [xb * l, base, wb],
            [rb * l, roof, -wt],
            [rf * l, roof, -wt],
            [rf * l, roof, wt],
            [rb * l, roof, wt],
          ],
          // Each pane as [bottom 1, bottom 2, top 2, top 1], wound to face outward.
          quads = [
            [0, 1, 5, 4],
            [1, 2, 6, 5],
            [2, 3, 7, 6],
            [3, 0, 4, 7],
            [4, 5, 6, 7],
          ],
          positions = [],
          uvs = [],
          geo = new Three.BufferGeometry();
        quads.forEach(([b1, b2, t2, t1], pane) => {
          const uv = { [b1]: [0, 0], [b2]: [1, 0], [t2]: [1, 1], [t1]: [0, 1] };
          for (const v of [b1, t1, b2, b2, t1, t2]) {
            positions.push(...corner[v]);
            uvs.push(...uv[v]);
          }
          geo.addGroup(pane * 6, 6, pane);
        });
        geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();
        pristineCabins.set(key, geo);
        sharedGeometries.add(geo);
        return geo;
      }
      // Pushes every vertex along the dents it lies inside: full depth at the centre,
      // easing to nothing at the dent's radius, with a per-vertex wrinkle so the metal
      // folds rather than dishes. `offsetX` is the mesh's place along the body.
      function crumple(geometry, base, dents, offsetX, seed) {
        const position = geometry.attributes.position,
          array = position.array;
        for (let i = 0; i < position.count; i++) {
          const x = base[i * 3] + offsetX,
            y = base[i * 3 + 1],
            z = base[i * 3 + 2],
            wrinkle = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453,
            n = (wrinkle - Math.floor(wrinkle)) * 2 - 1;
          let dx = 0,
            dy = 0,
            dz = 0;
          for (const d of dents) {
            if (d.depth === undefined) continue;
            const ex = x - d.x,
              ey = (y - d.z) * 0.6,
              ez = z - d.y,
              q = (ex * ex + ey * ey + ez * ez) / (d.r * d.r);
            if (q >= 1) continue;
            const f = (1 - q) * (1 - q) * d.depth,
              // Crushed metal has to go somewhere: it bulges out sideways from the push.
              across = ex * -d.ny + ez * d.nx,
              bulge = f * 0.14 * Math.sign(across);
            dx += d.nx * f * (1 + 0.45 * n) - d.ny * bulge;
            dz += d.ny * f * (1 + 0.45 * n) + d.nx * bulge;
            dy += f * (0.32 * n - 0.14);
          }
          array[i * 3] = base[i * 3] + dx;
          array[i * 3 + 1] = base[i * 3 + 1] + dy;
          array[i * 3 + 2] = base[i * 3 + 2] + dz;
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
      }
      // Moves a part into a pivot group at `hinge` so it can swing about that point.
      function hingePart(m, part, hinge) {
        const pivot = new Three.Group();
        pivot.position.copy(hinge);
        part.parent.add(pivot);
        part.position.sub(hinge);
        pivot.add(part);
        return pivot;
      }
      const hingeScratch = new Three.Vector3();
      function carBodyDamage(c, m, damage) {
        const { l, w, h, van } = m.dims,
          parts = damage.parts,
          first = !m.partState,
          before = m.partState || {},
          paintColor = '#' + m.paint.color.getHexString();
        // Crumple the shell and the glasshouse with the same dents. The dents are
        // in world units, the model in its design units (render3d.js DESIGN SIZE).
        const signature = c.dents.reduce((s, d) => s + (d.depth || 0) * 7 + d.x + d.y * 3, c.dents.length);
        if (signature !== m.dentSignature) {
          m.dentSignature = signature;
          const k = 1 / (m.modelScale || 1);
          m.designDents = k === 1 ? c.dents : c.dents.map((d) => ({ ...d, x: d.x * k, y: d.y * k, z: d.z * k, r: d.r * k, depth: d.depth === undefined ? undefined : d.depth * k }));
          if (c.dents.length) {
            if (!m.ownShell) {
              m.shell.geometry = m.shell.geometry.clone();
              m.ownShell = true;
            }
            crumple(m.shell.geometry, m.shellBase, m.designDents, 0, c.id);
            if (m.cabinBase) {
              if (!m.ownCabin) {
                m.cabin.geometry = m.cabin.geometry.clone();
                m.ownCabin = true;
              }
              crumple(m.cabin.geometry, m.cabinBase, m.designDents, m.cabin.position.x, c.id);
            }
          }
          m.shapeVersion = (m.shapeVersion || 0) + 1;
        }
        const frontDepth = (m.designDents || c.dents).reduce((s, d) => (d.x > l * 0.2 && d.depth ? Math.max(s, d.depth) : s), 0);
        // Hood: buckles up in the middle, springs open on its hinge, or is gone.
        if (!m.hoodPivot) m.hoodPivot = hingePart(m, m.hood, hingeScratch.set(l * 0.215, m.hoodBaseY, 0));
        m.hood.visible = parts.hood < 2;
        if (parts.hood === 2 && before.hood !== 2 && !first) spawnPanel(m.hood, paintColor, c, l * 0.25, 0.4, w * 0.67, 1.4);
        m.hoodPivot.position.set(l * 0.215 - frontDepth * 0.12, m.hoodBaseY - frontDepth * 0.08, 0);
        m.hoodPivot.rotation.set(parts.hood === 1 ? 0.07 : 0, 0, parts.hood === 1 ? 0.78 + (c.id % 5) * 0.05 : Math.min(0.32, damage.front * 0.3));
        m.hood.scale.x = l * 0.25 * (1 - clamp(frontDepth / (l * 0.3), 0, 0.45));
        m.hood.position.x = m.hood.scale.x / 2;
        if (parts.hood >= 1 && !m.engine) {
          // The engine bay the hood was covering: block, rocker cover, air box.
          m.engine = new Three.Group();
          m.engine.position.set(l * 0.34, m.hoodBaseY - 0.2, 0);
          m.body.add(m.engine);
          box(m.engine, 0, 0, 0, l * 0.21, 0.9, w * 0.58, engineBay);
          box(m.engine, -l * 0.02, 0.8, 0, l * 0.12, 0.9, w * 0.22, darkMetal);
          mesh(cylinderGeo, darkMetal, m.engine, l * 0.05, 0.9, w * 0.17, 1.6, 0.8, 1.6);
        }
        if (m.engine) m.engine.visible = parts.hood >= 1;
        // Bumpers: pushed in with the crumple, hanging off one bracket, or torn away.
        m.bumpers.forEach((bumper, i) => {
          const state = i ? parts.bumperRear : parts.bumperFront,
            amount = i ? damage.rear : damage.front,
            side = (i ? damage.bumperRearSide : damage.bumperFrontSide) || 1,
            half = bumper.scale.z / 2;
          if (state === 2) {
            if (before[i ? 'bumperRear' : 'bumperFront'] !== 2 && !first)
              spawnPanel(bumper, damage.burnt ? '#2c2a27' : '#b8c0c3', c, bumper.scale.x, bumper.scale.y, bumper.scale.z, 1.2);
            bumper.visible = false;
            return;
          }
          bumper.visible = true;
          bumper.position.copy(m.bumperOrigins[i]);
          bumper.position.x += (i ? 1 : -1) * amount * 2.4;
          bumper.position.y -= amount * 1.1;
          bumper.rotation.set(0, (i ? 1 : -1) * amount * 0.15 * side, 0);
          if (state === 1) {
            // Held by the far bracket: the loose end drops about 25 degrees.
            const drop = 0.44;
            bumper.rotation.x = side * drop;
            bumper.position.y -= half * Math.sin(drop);
            bumper.position.z += side * half * (1 - Math.cos(drop));
          }
          // Police bumpers are black plastic (police3d.js).
          bumper.material = damage.burnt ? burntMetal : m.bumperMaterials?.[i] || m.bumperMaterial || chrome;
        });
        // Doors swing out on a bent hinge; torn off, the dark opening is left.
        for (const side of [-1, 1]) {
          const key = side < 0 ? 'doorLeft' : 'doorRight',
            state = parts[key];
          if (!state) continue;
          m.doors = m.doors || {};
          let door = m.doors[side];
          if (!door) {
            const pivot = new Three.Group();
            pivot.position.set(l * 0.2, 0, side * w * 0.5);
            m.body.add(pivot);
            // From the sill (`dims.sill`: a real-size body's, cars3d.js) to the belt.
            const sill = m.dims.sill ?? 4.8,
              panel = box(pivot, -l * 0.13, (sill + h + 0.4) / 2, side * 0.25, l * 0.26, h + 0.4 - sill, 0.45, m.paint),
              opening = box(m.body, l * 0.07, (sill + h) / 2, side * (w * 0.5 + 0.04), l * 0.24, h - sill - 0.2, 0.3, engineBay);
            // A livery samples its door colour through the panel's UVs (police3d.js).
            if (m.panelGeometry) panel.geometry = m.panelGeometry;
            door = m.doors[side] = { pivot, panel, opening };
          }
          door.pivot.rotation.set(0, side * (state === 1 ? 0.95 : 0), state === 1 ? -0.09 : 0);
          if (state === 2 && before[key] !== 2 && !first && door.panel.visible)
            spawnPanel(door.panel, paintColor, c, l * 0.26, h - 4.4, 0.45, 1.2);
          door.panel.visible = state < 2;
        }
        // The trunk lid pops up on its hinge (vans and SUVs have tailgates in the body).
        if (parts.trunk && !van && !m.trunk) {
          m.trunk = new Three.Group();
          m.trunk.position.set(-l * 0.3, m.hoodBaseY, 0);
          m.body.add(m.trunk);
          const lid = box(m.trunk, -l * 0.09, 0, 0, l * 0.18, 0.4, w * 0.67, m.paint);
          if (m.trunkGeometry) lid.geometry = m.trunkGeometry;
        }
        if (m.trunk) m.trunk.rotation.z = parts.trunk ? -0.85 : 0;
        // Glass: one material per pane once any pane is damaged.
        const glass = damage.glass,
          // `m.glass`: a model's own intact glass (police3d.js).
          paneMaterial = (state) => (state === 2 ? brokenGlass : state === 1 ? crackedGlass : m.glass || carGlass);
        if (m.cabinBase) {
          const hurt = damage.burnt || glass.front || glass.rear || glass.left || glass.right;
          if (hurt) {
            m.paneMaterials = m.paneMaterials || [carGlass, carGlass, carGlass, carGlass, carGlass].map(() => m.glass || carGlass);
            PANE_ORDER.forEach((pane, i) => (m.paneMaterials[i] = paneMaterial(pane === 'roof' ? (damage.burnt ? 2 : 0) : glass[pane])));
            m.cabin.material = m.paneMaterials;
          } else m.cabin.material = m.glass || carGlass;
        } else m.cabin.material = paneMaterial(glass.front);
        // Wheels: bent inward on a crumpled side; a flat tyre sits down on its rim.
        m.wheels.forEach(({ wheel, side }) => {
          const key = (wheel.position.x > 0 ? 'front' : 'rear') + (side < 0 ? 'Left' : 'Right');
          if (wheel.userData.baseY === undefined) wheel.userData.baseY = wheel.position.y;
          const flat = damage.tires[key],
            burnt = damage.burnt;
          wheel.rotation.x = side * damage[side > 0 ? 'right' : 'left'] * 0.16;
          wheel.scale.y = flat && !burnt ? 0.8 : 1;
          wheel.position.y = wheel.userData.baseY - (burnt ? 1.6 : flat ? 0.8 : 0);
          if (wheel.children[0]) wheel.children[0].visible = !burnt;
        });
        m.partState = { ...parts };
      }
      // Trucks, bikes, tanks and aircraft: no crumple, but tyres, burn and lamps.
      function specialDamage(c, m, damage) {
        if (isAircraft(c) || isBoat(c)) return;
        for (const { wheel, side } of m.wheels || []) {
          if (!wheel.position) continue;
          if (wheel.userData.baseY === undefined) wheel.userData.baseY = wheel.position.y;
          const key = (wheel.position.x > 0 ? 'front' : 'rear') + (side < 0 ? 'Left' : 'Right'),
            flat = damage.tires?.[key];
          wheel.scale.y = flat && !damage.burnt ? 0.82 : 1;
          wheel.position.y = wheel.userData.baseY - (damage.burnt ? 1.6 : flat ? 0.8 : 0);
          if (wheel.children[0] && damage.burnt) wheel.children[0].visible = false;
        }
      }
      // Glass that bursts throws a glitter of crumbs out of the frame.
      function glassBurst(c, m, pane) {
        const { l, w } = vehicleSpec(c),
          local = { front: [l * 0.27, 0], rear: [-l * 0.32, 0], left: [0, -w * 0.45], right: [0, w * 0.45] }[pane] || [0, 0],
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          x = c.x + local[0] * cos - local[1] * sin,
          z = c.y + local[0] * sin + local[1] * cos,
          y = entityElevation(c) + 11 * (m.modelScale || 1);
        for (let j = 0; j < 14; j++)
          fx.push({
            x: x + (Math.random() - 0.5) * 6,
            y,
            z: z + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 70 + (c.vx || 0) * 0.5,
            vy: 20 + Math.random() * 40,
            vz: (Math.random() - 0.5) * 70 + (c.vy || 0) * 0.5,
            life: 0.5 + Math.random() * 0.4,
            max: 0.9,
            color: Math.random() < 0.5 ? '#e4f1f7' : '#9fc4d6',
            size: 1 + Math.random() * 1.2,
            case: true,
          });
      }
      /**
       * Brings a vehicle model in line with its damage data. Runs when the vehicle's
       * damageVersion changes (and once when a model is built for a damaged vehicle).
       */
      function applyVehicleDamage(c, m) {
        const damage = c.damage;
        if (!damage?.parts) return;
        const glassBefore = m.glassState;
        if (m.car) carBodyDamage(c, m, damage);
        else specialDamage(c, m, damage);
        if (glassBefore)
          for (const pane of ['front', 'rear', 'left', 'right'])
            if (damage.glass[pane] === 2 && glassBefore[pane] !== 2) glassBurst(c, m, pane);
        m.glassState = { ...damage.glass };
        // Lamps: a broken one is dark glass, and its night halo stays off.
        for (const lamp of m.lamps || []) lamp.mesh.material = damage.lights[lamp.key] ? deadLamp : lamp.lit;
        if (m.car && m.nightLights)
          m.lampOut = ['headLeft', 'tailLeft', 'headRight', 'tailRight'].map((key) => damage.lights[key]);
        // A burnt shell sits down on its rims (road vehicles only: aircraft bodies are posed).
        if (m.car || vehicleSpec(c).truck) m.body.position.y = damage.burnt ? -1.2 : 0;
        m.shapeVersion = (m.shapeVersion || 0) + 1;
      }
      const grime = new Three.Color('#585451'),
        sootColor = new Three.Color('#1d1a17');
      // Paint dulls with wear, blisters while burning, chars when the fire is out.
      function paintVehicle(c, m) {
        const damage = c.damage,
          burnt = damage?.burnt || c.hp <= 0;
        if (burnt) {
          if (!m.charred) {
            m.charred = true;
            if (m.car) {
              // Soot and blistered paint; the same map masks where embers glow.
              m.paint.map = sootTexture;
              m.paint.emissiveMap = sootTexture;
              m.paint.color.set('#ffffff');
            } else m.paint.color.set('#302c28');
            m.paint.roughness = 0.97;
            m.paint.metalness = 0.12;
            // Burnt paint has no clear coat left (car paint is MeshPhysicalMaterial).
            if (m.paint.isMeshPhysicalMaterial) m.paint.clearcoat = 0;
            m.paint.needsUpdate = true;
          }
          // Embers: the fresh wreck glows through the soot for a few seconds.
          const age = gameTime - (damage?.wreckedAt || c.deadTime || 0),
            glow = clamp(1 - age / 14, 0, 1) * (0.8 + 0.2 * Math.sin(gameTime * 9 + c.id));
          m.paint.emissive.setRGB(0.85 * glow * glow, 0.2 * glow * glow, 0.03 * glow * glow);
          return;
        }
        if (m.charred) {
          m.charred = false;
          // A police livery comes back with the repair (police3d.js).
          m.paint.map = m.liveryMap || null;
          m.paint.emissiveMap = m.liveryMap || null;
          m.paint.emissive.setRGB(0, 0, 0);
          m.paint.needsUpdate = true;
          m.paintWear = -1;
        }
        const wear = clamp(1 - c.hp / c.maxhp, 0, 1),
          heat = damage?.burning ? clamp(damage.burning / 8, 0, 0.7) : 0,
          // The colour is part of the key: a respray changes it with the wear unchanged.
          key = wear + heat * 10 + (m.liveryColor || c.color);
        if (m.paintWear === key) return;
        m.paintWear = key;
        m.paint.color.set(m.liveryColor || c.color).lerp(grime, wear * 0.22).lerp(sootColor, heat);
        m.paint.roughness = 0.3 + wear * 0.6;
        m.paint.metalness = 0.63 - wear * 0.42;
        // Scuffed and dented panels lose the gloss of their clear coat.
        if (m.paint.isMeshPhysicalMaterial) {
          // `finish`: a model's own paint (police liveries are satin, not metallic).
          const finish = m.finish;
          m.paint.roughness = (finish ? finish.roughness : 0.42) + wear * 0.5;
          m.paint.metalness = finish ? finish.metalness * (1 - wear * 0.6) : 0.55 - wear * 0.35;
          m.paint.clearcoat = 1 - wear * 0.8;
          m.paint.clearcoatRoughness = 0.08 + wear * 0.5;
        }
      }
      // Suspension pose on top of the body's own animation: weight transfer, the blast
      // hop, and the sag toward a flat tyre.
      const pose = { lift: 0, roll: 0, pitch: 0 };
      function vehiclePose(c) {
        const hop = c.hop,
          tires = c.damage?.tires;
        pose.lift = hop ? hop.z : 0;
        pose.roll = (c.loadRoll || 0) + (hop ? hop.roll : 0);
        pose.pitch = (c.loadPitch || 0) + (hop ? hop.pitch : 0);
        if (tires && !c.damage.burnt) {
          const left = (tires.frontLeft ? 1 : 0) + (tires.rearLeft ? 1 : 0),
            right = (tires.frontRight ? 1 : 0) + (tires.rearRight ? 1 : 0),
            front = (tires.frontLeft ? 1 : 0) + (tires.frontRight ? 1 : 0),
            rear = (tires.rearLeft ? 1 : 0) + (tires.rearRight ? 1 : 0);
          // Rolling +x lifts the left side: a flat on the right leans the body right.
          pose.roll += (right - left) * 0.028;
          pose.pitch += (rear - front) * 0.018;
        }
        return pose;
      }

      // ---- Smoke and fire ------------------------------------------------------------------
      let carFlames = null,
        carFlameIndex = 0,
        carFireLightUsed = false;
      const carFireLight = new Three.PointLight('#ff8f3a', 0, 170, 1.6);
      scene.add(carFireLight);
      function flameAt(x, y, z, size, strength) {
        if (!carFlames)
          carFlames = Array.from({ length: 32 }, () => {
            const s = new Three.Sprite(
              new Three.SpriteMaterial({ map: flameTx, transparent: true, depthWrite: false, blending: Three.AdditiveBlending }),
            );
            s.visible = false;
            scene.add(s);
            return s;
          });
        if (carFlameIndex >= carFlames.length) return;
        const s = carFlames[carFlameIndex++];
        s.visible = true;
        s.position.set(x, y + size * 0.35, z);
        s.scale.set(size * 0.62, size, 1);
        s.material.opacity = strength;
      }
      function engineSmoke(x, y, z, color, size, rise) {
        fx.push({
          x: x + (Math.random() - 0.5) * 4,
          y,
          z: z + (Math.random() - 0.5) * 4,
          vx: 4 + (Math.random() - 0.5) * 6,
          vy: rise,
          vz: 2 + (Math.random() - 0.5) * 6,
          life: 2.2,
          max: 2.2,
          color,
          size,
          smoke: true,
        });
      }
      /**
       * Per-frame damage effects for a visible vehicle: grey wisps from a hurt engine,
       * thick black smoke and flames from a burning one, and a wreck that burns out and
       * smoulders for most of a minute.
       */
      function vehicleEffects(c, m, deltaSeconds) {
        const spec = vehicleSpec(c);
        if (deltaSeconds <= 0 || spec.bicycle) return;
        const damage = c.damage,
          health = c.hp / c.maxhp,
          elevation = entityElevation(c) + (c.hop?.z || 0),
          engineX = m.car ? spec.l * 0.33 : spec.truck ? spec.l * 0.3 : 0,
          engineY = elevation + (m.car ? (m.dims.h + 1.2) * (m.modelScale || 1) : spec.truck ? 14 : 9),
          cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          x = c.x + cos * engineX,
          z = c.y + sin * engineX,
          chance = (rate) => Math.random() < 1 - Math.exp(-rate * deltaSeconds);
        if (c.hp <= 0) {
          const age = gameTime - c.deadTime;
          if (age < 12) {
            // The whole shell burns for a while after the tank goes.
            const strength = clamp(1 - age / 12, 0, 1);
            for (let k = 0; k < 3; k++) {
              const along = (k - 1) * spec.l * 0.28;
              flameAt(c.x + cos * along, elevation + 6, c.y + sin * along, (16 + Math.sin(gameTime * 11 + k * 2) * 3) * (0.6 + strength * 0.6), 0.9 * strength);
            }
            if (!carFireLightUsed) {
              carFireLightUsed = true;
              carFireLight.position.set(c.x, elevation + 18, c.y);
              carFireLight.intensity = 620 * strength * (0.85 + 0.15 * Math.sin(gameTime * 17));
            }
          }
          if (age < 55 && chance(age < 12 ? 16 : 6 * (1 - age / 55)))
            engineSmoke(c.x, elevation + 10, c.y, age < 12 ? '#27292c' : '#4a4d52', age < 12 ? 17 : 12, 18);
          return;
        }
        if (damage?.burning) {
          const grow = clamp(damage.burning / 3, 0.35, 1);
          for (let k = 0; k < 2; k++)
            flameAt(
              x + (k - 0.5) * 3 * -sin,
              engineY - 1,
              z + (k - 0.5) * 3 * cos,
              (9 + Math.sin(gameTime * 13 + k * 3) * 2.5) * grow,
              0.95,
            );
          if (!carFireLightUsed) {
            carFireLightUsed = true;
            carFireLight.position.set(x, engineY + 8, z);
            carFireLight.intensity = 380 * grow * (0.85 + 0.15 * Math.sin(gameTime * 19));
          }
          if (chance(14)) engineSmoke(x, engineY + 3, z, '#222427', 14, 22);
          return;
        }
        if (health < 0.6 && chance((0.6 - health) * 22))
          engineSmoke(x, engineY, z, health < 0.4 ? '#55595f' : '#a4a8ad', health < 0.4 ? 11 : 8, health < 0.4 ? 16 : 12);
      }

      // ---- Marks on vehicles ------------------------------------------------------------------
      const markAnchors = new WeakMap(),
        markRay = new Three.Raycaster(),
        markOrigin = new Three.Vector3(),
        markDirection = new Three.Vector3(),
        markInverse = new Three.Matrix4(),
        bodyWorld = new Three.Matrix4(),
        markWorld = new Three.Matrix4();
      function rayTargets(m) {
        const wheelParts = new Set();
        for (const { wheel } of m.wheels || []) wheel?.traverse?.((o) => wheelParts.add(o));
        const list = [];
        m.body.traverse((o) => {
          if (!o.isMesh || o.isInstancedMesh || wheelParts.has(o)) return;
          for (let p = o; p && p !== m.body; p = p.parent) if (!p.visible) return;
          list.push(o);
        });
        return list;
      }
      // Finds where a mark sits on the body: cast along the bullet's line from outside,
      // take the first surface it meets, and keep that pose in body space.
      function anchorMark(c, m, mark) {
        m.group.updateMatrixWorld(true);
        markInverse.copy(m.body.matrixWorld).invert();
        markDirection.set(mark.dx, 0, mark.dy);
        if (markDirection.lengthSq() < 1e-6) markDirection.set(-mark.x, 0, -mark.y);
        markDirection.normalize();
        markOrigin.set(mark.x, mark.z, mark.y).addScaledVector(markDirection, -18).applyMatrix4(m.body.matrixWorld);
        const worldDirection = markDirection.clone().transformDirection(m.body.matrixWorld);
        markRay.set(markOrigin, worldDirection);
        markRay.far = 44;
        if (!m.rayTargets || m.rayTargetsVersion !== m.shapeVersion) {
          m.rayTargets = rayTargets(m);
          m.rayTargetsVersion = m.shapeVersion;
        }
        const hit = markRay.intersectObjects(m.rayTargets, false)[0],
          point = new Three.Vector3(),
          normal = new Three.Vector3();
        if (hit && hit.face) {
          point.copy(hit.point).applyMatrix4(markInverse);
          normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).transformDirection(markInverse);
          if (normal.dot(markDirection) > 0) normal.negate();
        } else {
          point.set(mark.x, mark.z, mark.y);
          normal.copy(markDirection).negate();
        }
        const scrape = mark.kind === 'scrape',
          sx = scrape ? mark.size * 1.8 : mark.kind === 'star' ? mark.size : mark.size * 4.2,
          sy = scrape ? mark.size * 0.45 : sx,
          anchor = {
            matrix: decalPose(new Three.Matrix4(), point.x, point.y, point.z, normal.x, normal.y, normal.z, sx, sy, scrape ? 0 : (mark.id * 2.39996) % TAU, 0.07),
            version: m.shapeVersion,
          };
        markAnchors.set(mark, anchor);
        return anchor;
      }
      const MARK_TILES = { hole: DECAL.hole, star: DECAL.star, scrape: DECAL.scrape };
      function drawVehicleMarks() {
        const layer = vehicleDecals;
        let n = 0,
          budget = 8;
        for (const [c, m] of carModels) {
          const marks = c.damage?.marks;
          if (!marks?.length || !m.group.visible) continue;
          m.group.updateMatrix();
          m.body.updateMatrix();
          bodyWorld.multiplyMatrices(m.group.matrix, m.body.matrix);
          for (const mark of marks) {
            if (n >= layer.capacity) break;
            if (mark.kind === 'star' && c.damage.glass[mark.pane] === 2) continue;
            let anchor = markAnchors.get(mark);
            if (!anchor || anchor.version !== m.shapeVersion) {
              if (budget <= 0 && !anchor) continue;
              if (budget-- > 0) anchor = anchorMark(c, m, mark);
            }
            writeDecal(layer, n++, markWorld.multiplyMatrices(bodyWorld, anchor.matrix), MARK_TILES[mark.kind], mark.kind === 'scrape' ? 0.85 : 1, null);
          }
        }
        layer.mesh.count = n;
        if (n) layer.dirty = true;
      }
