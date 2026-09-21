      // BEGIN SUBSYSTEM: src/ecology3d.js — Wildlife meshes
      /**
       * Wildlife meshes
       * Source: src/ecology3d.js
       * Scope: createCityRenderer() closure.
       * Species-specific geometry, gait animation, culling and owned-material cleanup.
       */
      /* Original woodland models. Insert inside createCityRenderer; call after the camera frustum update. */
      const wildlifeModels = new Map(),
        WILDLIFE_VISUAL_LIMIT = 48;
      const wildlifeConeGeometry = new Three.ConeGeometry(1, 1, 7);
      const wildlifePalette = {
        deer: ['#aa7950', '#e3ceb0', '#594332', '#292522'],
        fox: ['#b96836', '#ecd8bb', '#794328', '#292322'],
        rabbit: ['#a99886', '#e6d7c6', '#c39891', '#37302a'],
        bear: ['#65503d', '#ac9273', '#493a30', '#252221'],
      };
      function makeWildlifeModel(animal) {
        const species = wildlifePalette[animal.species] ? animal.species : 'deer',
          materials = wildlifePalette[species].map((c) => mat(c, 0.94)),
          [fur, cream, trim, ink] = materials;
        const group = new Three.Group(),
          body = new Three.Group(),
          head = new Three.Group();
        group.name = 'wildlife-' + species;
        // Geometry keeps its descriptive local dimensions; this shared species scale
        // places every model in the same world units as the 18-unit human mesh.
        group.scale.setScalar(WILDLIFE_SPECIES[species].modelScale);
        group.add(body);
        body.add(head);
        scene.add(group);
        const model = {
          group,
          body,
          head,
          species,
          materials,
          legs: [],
          ears: [],
          tail: null,
          phase: Number(animal.phase) || 0,
          death: 0,
          deadAge: 0,
        };
        const ell = (p, material, x, y, z, sx, sy, sz) =>
          mesh(sphereGeo, material, p, x, y, z, sx, sy, sz);
        const limb = (x, y, z, upperLength, lowerLength, thickness, phase, hoof = true) => {
          const upper = new Three.Group();
          upper.position.set(x, y, z);
          body.add(upper);
          const lower = new Three.Group();
          lower.position.y = -upperLength;
          upper.add(lower);
          ell(upper, fur, 0, -upperLength * 0.45, 0, thickness, upperLength * 0.57, thickness);
          ell(
            lower,
            species === 'fox' ? trim : fur,
            0,
            -lowerLength * 0.46,
            0,
            thickness * 0.65,
            lowerLength * 0.57,
            thickness * 0.66,
          );
          ell(
            lower,
            hoof ? ink : fur,
            0.35,
            -lowerLength + 0.5,
            0,
            thickness * (hoof ? 1 : 1.35),
            0.8,
            thickness * 0.95,
          );
          model.legs.push({
            upper,
            lower,
            phase,
          });
          return upper;
        };
        const ear = (x, y, z, height, width, angle = 0, rounded = false) => {
          const pivot = new Three.Group();
          pivot.position.set(x, y, z);
          pivot.rotation.x = angle;
          head.add(pivot);
          if (rounded) {
            ell(pivot, fur, 0, height * 0.35, 0, width, height * 0.5, width * 0.65);
            ell(pivot, trim, width * 0.53, height * 0.4, 0, width * 0.5, height * 0.31, width * 0.44);
          } else {
            mesh(
              wildlifeConeGeometry,
              fur,
              pivot,
              0,
              height * 0.4,
              0,
              width * 2,
              height,
              width * 1.3,
            ).rotation.z = -0.1;
            mesh(
              wildlifeConeGeometry,
              species === 'rabbit' ? trim : cream,
              pivot,
              width * 0.43,
              height * 0.4,
              0,
              width * 0.75,
              height * 0.72,
              width * 0.65,
            ).rotation.z = -0.1;
          }
          model.ears.push({
            pivot,
            rest: angle,
          });
          return pivot;
        };
        const eyes = (x, y, z, size) => {
          for (const s of [-1, 1]) ell(head, ink, x, y, s * z, size, size, size * 0.65);
        };
        if (species === 'deer') {
          ell(body, fur, -1, 21, 0, 13, 6.7, 5.1);
          ell(body, cream, -1, 18, 0, 10.3, 3.7, 4.5);
          ell(body, fur, 9, 25, 0, 4.3, 8.7, 3.9).rotation.z = -0.42;
          head.position.set(13.5, 30, 0);
          ell(head, fur, 2, 0, 0, 5.4, 3.4, 3.2);
          ell(head, cream, 5.7, -1.15, 0, 3.3, 1.7, 2.1);
          ell(head, ink, 8.5, -0.5, 0, 1.1, 1, 1.6);
          eyes(3.5, 1.1, 2.8, 0.63);
          for (const s of [-1, 1]) {
            ear(-1, 2.1, s * 2.6, 6.5, 1.45, s * 0.65);
            limb(8.3, 19, s * 3.4, 8.3, 10, 1.25, s > 0 ? 0 : Math.PI);
            limb(-9, 19, s * 3.7, 8.8, 9.5, 1.7, s > 0 ? Math.PI : 0);
          }
          // A deterministic mix of stags and does gives each herd different silhouettes.
          if (Math.sin(model.phase * 1.17) > -0.2)
            for (const s of [-1, 1]) {
              const pts = [
                [-1, 2.5, s * 1.6],
                [-3, 8, s * 3],
                [-2, 13.5, s * 5],
                [1, 16, s * 6.5],
              ];
              for (let i = 1; i < pts.length; i++)
                rod(head, new Three.Vector3(...pts[i - 1]), new Three.Vector3(...pts[i]), 0.52, trim);
              rod(head, new Three.Vector3(-3, 8, s * 3), new Three.Vector3(1.5, 11, s * 3.7), 0.4, trim);
              rod(
                head,
                new Three.Vector3(-2, 13.5, s * 5),
                new Three.Vector3(-5, 16, s * 5.9),
                0.35,
                trim,
              );
            }
          model.tail = new Three.Group();
          model.tail.position.set(-13, 23, 0);
          body.add(model.tail);
          ell(model.tail, cream, -1, 0, 0, 2.7, 1.5, 2.2);
        } else if (species === 'fox') {
          ell(body, fur, -1, 10, 0, 10.7, 3.8, 3.9);
          ell(body, cream, 1, 8.8, 0, 8, 2.1, 3.4);
          ell(body, fur, 7.6, 12, 0, 4.3, 4.7, 3.6);
          head.position.set(10, 14.2, 0);
          ell(head, fur, 0, 0, 0, 4.4, 3.2, 3.35);
          mesh(wildlifeConeGeometry, cream, head, 5, -1.2, 0, 4.2, 7.1, 4.2).rotation.z = -Math.PI / 2;
          ell(head, ink, 8.5, -1.2, 0, 0.8, 0.7, 0.85);
          eyes(2, 0.8, 2.75, 0.52);
          for (const s of [-1, 1]) {
            ear(-0.8, 2.2, s * 2.1, 5.4, 1.6, s * 0.23);
            limb(6.2, 10, s * 2.7, 4.2, 5.2, 1.1, s > 0 ? 0 : Math.PI, false);
            limb(-7.2, 10, s * 2.7, 4.7, 4.7, 1.25, s > 0 ? Math.PI : 0, false);
          }
          model.tail = new Three.Group();
          model.tail.position.set(-10, 11, 0);
          body.add(model.tail);
          ell(model.tail, fur, -6, 1, 0, 8.5, 3.3, 3.2).rotation.z = -0.13;
          ell(model.tail, cream, -12.5, 1.8, 0, 3.5, 2.2, 2.1);
        } else if (species === 'rabbit') {
          ell(body, fur, -1.8, 5.7, 0, 5.2, 4.2, 3.7);
          ell(body, cream, 0.1, 4.2, 0, 3.6, 2.7, 3.1);
          head.position.set(3.3, 8.3, 0);
          ell(head, fur, 0, 0, 0, 3, 2.6, 2.7);
          ell(head, cream, 2.3, -0.8, 0, 1.5, 1.1, 1.7);
          ell(head, trim, 3.4, -0.3, 0, 0.42, 0.4, 0.6);
          eyes(1.2, 0.6, 2.2, 0.56);
          for (const s of [-1, 1]) {
            ear(-0.5, 2, s * 1.1, 7.9, 1.05, s * 0.13);
            limb(2.7, 5.1, s * 2, 2, 2.4, 0.75, 0, false);
            const back = limb(-4.2, 5.2, s * 2.5, 2.4, 2.3, 1.45, Math.PI, false);
            ell(back, fur, 0, -1.1, 0, 2.2, 2.5, 1.7);
          }
          model.tail = ell(body, cream, -6.5, 6.8, 0, 1.8, 1.8, 1.8);
        } else {
          ell(body, fur, -1.5, 14.6, 0, 16, 8.8, 8);
          ell(body, trim, 7, 19, 0, 8.5, 6.1, 6.8);
          ell(body, fur, -10.5, 13.4, 0, 7.9, 8, 7.1);
          head.position.set(14.4, 18.9, 0);
          ell(head, fur, 0, 0, 0, 6.7, 5.3, 5.3);
          ell(head, cream, 5.4, -1.7, 0, 4.3, 2.9, 3.2);
          ell(head, ink, 8.9, -0.7, 0, 1.6, 1.3, 2);
          eyes(3.2, 1.2, 4.5, 0.62);
          for (const s of [-1, 1]) {
            ear(-2.1, 3.1, s * 3.9, 4.6, 2, s * 0.18, true);
            limb(9.3, 14.5, s * 5.4, 6.2, 7.5, 3, s > 0 ? 0 : Math.PI, false);
            limb(-11, 13.4, s * 5.2, 6, 6.6, 3.2, s > 0 ? Math.PI : 0, false);
          }
          model.tail = ell(body, fur, -17, 15, 0, 2, 1.8, 1.8);
        }
        return model;
      }
      function disposeWildlifeModel(animal, model) {
        scene.remove(model.group);
        for (const material of model.materials) material.dispose();
        model.group.clear();
        wildlifeModels.delete(animal);
      }
      function updateWildlifeVisuals(deltaSeconds) {
        const step = Math.max(0, Math.min(0.1, Number(deltaSeconds) || 0));
        const nearby = wildlife
            .filter(
              (a) =>
                a &&
                Number.isFinite(a.x) &&
                Number.isFinite(a.y) &&
                !a.hidden &&
                (a.hp > 0 || wildlifeModels.has(a)) &&
                Math.hypot(a.x - cameraTarget.x, a.y - cameraTarget.y) < 1600,
            )
            .sort(
              (a, b) =>
                (a.x - cameraTarget.x) ** 2 +
                (a.y - cameraTarget.y) ** 2 -
                ((b.x - cameraTarget.x) ** 2 + (b.y - cameraTarget.y) ** 2),
            )
            .slice(0, WILDLIFE_VISUAL_LIMIT),
          retained = new Set(nearby);
        for (const [a, m] of wildlifeModels) if (!retained.has(a)) disposeWildlifeModel(a, m);
        for (const animal of nearby) {
          let m = wildlifeModels.get(animal);
          if (!m) {
            m = makeWildlifeModel(animal);
            wildlifeModels.set(animal, m);
          }
          const { group, body, head, species } = m,
            speed = Math.min(180, Math.max(0, Math.abs(Number(animal.speed) || 0))),
            moving = animal.hp > 0 ? Math.min(1, speed / 18) : 0;
          m.phase +=
            step * (1.4 + speed * (species === 'rabbit' ? 0.17 : species === 'bear' ? 0.08 : 0.12));
          const gait = m.phase,
            alert =
              animal.hp > 0 &&
              (animal.warning > 0 || /attack|chase|aggress|charge/.test(animal.state || ''));
          m.death += ((animal.hp <= 0 ? 1 : 0) - m.death) * Math.min(1, step * 5);
          m.deadAge = animal.hp <= 0 ? m.deadAge + step : 0;
          if (m.deadAge > 16) {
            disposeWildlifeModel(animal, m);
            continue;
          }
          const x = animal.x,
            z = animal.y,
            direction = Number(animal.a) || 0,
            ground = terrainHeight(x, z),
            slopeSample = 7 * WILDLIFE_SPECIES[species].modelScale,
            ahead = terrainHeight(
              x + Math.cos(direction) * slopeSample,
              z + Math.sin(direction) * slopeSample,
            ),
            behind = terrainHeight(
              x - Math.cos(direction) * slopeSample,
              z - Math.sin(direction) * slopeSample,
            );
          group.position.set(x, ground + 0.25, z);
          group.rotation.set(0, -direction, 0);
          group.visible = entityInView(
            {
              x,
              y: z,
              altitude: ground,
            },
            species === 'deer' ? 52 : 42,
          );
          if (!group.visible) continue;
          const hop =
            species === 'rabbit'
              ? Math.max(0, Math.sin(gait)) * 3.2 * moving
              : Math.sin(gait * 2) * moving * (species === 'bear' ? 0.35 : 0.65);
          body.position.y = hop * (1 - m.death) + m.death * (species === 'bear' ? 7 : 3.8);
          body.rotation.set(
            m.death * Math.PI * 0.5,
            0,
            Math.max(-0.5, Math.min(0.5, Math.atan2(ahead - behind, slopeSample * 2))) * (1 - m.death),
          );
          const grazing = /graze|rest|idle/.test(animal.state || '') && moving < 0.15;
          head.rotation.z =
            (grazing && species === 'deer' ? -0.4 : alert ? 0.12 : Math.sin(gait * 0.39) * 0.045) *
            (1 - m.death);
          head.rotation.y = Math.sin(gait * 0.27) * 0.08 * (1 - moving * 0.6) * (1 - m.death);
          for (const leg of m.legs) {
            const headingSine = Math.sin(gait + leg.phase);
            leg.upper.rotation.z =
              headingSine *
              moving *
              (species === 'bear' ? 0.35 : species === 'rabbit' ? 0.55 : 0.6) *
              (1 - m.death);
            leg.lower.rotation.z = Math.max(0, -headingSine) * moving * 0.55 * (1 - m.death);
          }
          for (let i = 0; i < m.ears.length; i++) {
            const ear = m.ears[i];
            ear.pivot.rotation.x = ear.rest + Math.sin(gait * 0.7 + i * 2.1) * 0.04 * (1 - m.death);
            ear.pivot.rotation.z =
              species === 'rabbit' ? -moving * 0.33 + (alert ? 0.13 : 0) : alert ? -0.1 : 0;
          }
          if (m.tail && species !== 'bear' && species !== 'rabbit') {
            m.tail.rotation.y = Math.sin(gait * 0.75) * (species === 'fox' ? 0.22 : 0.12) * (1 - m.death);
            m.tail.rotation.z = species === 'deer' && /flee|run/.test(animal.state || '') ? -0.65 : 0;
          }
        }
      }
      // END SUBSYSTEM: src/ecology3d.js
