      // BEGIN SUBSYSTEM: src/crowd3d.js — Instanced people: skeleton, gait, poses, weapons and street props
      /**
       * Instanced people: skeleton, gait, poses, weapons and street props
       * Source: src/crowd3d.js
       * Scope: renderer closure (inside createCityRenderer).
       *
       * Everyone on foot is drawn here from the shared body parts of
       * character-rig3d.js: pedestrians, and (`updateCrowd3D`'s `specials`) the
       * player, officers, SWAT, agents, soldiers, gangs, guards and mission
       * characters, each with an outfit (`specialLook`) and what they hold
       * (`specialSpec`). A street of a hundred people costs the same few dozen
       * draw calls as a street of five. Each frame the visible people are
       * packed into the instance buffers with a matrix per part, built from a
       * small skeleton:
       *
       *   root (feet, heading, fall) → hips → torso → head
       *                                        ↘ shoulders → elbows → hands
       *                  hips → thighs → knees → ankles
       *
       * Poses are layered. The base pose (standing, cowering, hands up, on the
       * phone, sitting, dancing...) comes from `person.pose` and is eased joint
       * by joint. The gait layer is driven by how far the person actually moved:
       * each foot is planted for the stance part of its cycle and carried
       * forward in an arc for the swing (two-bone IK for hip and knee), the
       * pelvis rises and falls over the planted leg, the arms swing against the
       * legs, and the body leans into a run. The upper body turns to where the
       * person faces while the hips follow the direction of travel (strafing,
       * backing away); standing, the feet step round in place when the body
       * turns far enough. Weapon holds are placed in an aim frame and both hands
       * reach them by IK: a pistol in a two-hand grip, a rifle shouldered, a
       * rocket tube on the shoulder, with recoil and a reload.
       *
       * Level of detail: hands, props and the face read only up close; zoomed
       * far out, someone simply standing or walking becomes a three-instance
       * figure (body and two legs).
       */
      const CROWD_CAPACITY = 900;
      const crowdBodyMaterial = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 }),
        crowdClothDouble = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: Three.DoubleSide }),
        crowdPropMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
        crowdPhoneMaterial = new Three.MeshStandardMaterial({ color: '#15171b', emissive: '#86b8ff', emissiveIntensity: 0.55, roughness: 0.3 }),
        crowdEmberMaterial = new Three.MeshBasicMaterial({ color: '#ff8a3a' }),
        crowdLeashMaterial = new Three.MeshStandardMaterial({ color: '#2a2320', roughness: 0.7 });
      /* Limb geometry hangs down from its joint at the origin (dogs). */
      function crowdLimb(rTop, rBottom, length, segments = 7) {
        const g = new Three.CylinderGeometry(rTop, rBottom, length, segments, 1);
        g.translate(0, -length / 2, 0);
        return g;
      }
      /* Merge small geometries, optionally painting each a vertex colour (props). */
      function crowdMerge(list) {
        const parts = list.map(({ geo, color }) => {
          const g = geo.index ? geo.toNonIndexed() : geo;
          if (color) {
            const c = new Three.Color(color),
              n = g.attributes.position.count,
              colors = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
              colors[i * 3] = c.r;
              colors[i * 3 + 1] = c.g;
              colors[i * 3 + 2] = c.b;
            }
            g.setAttribute('color', new Three.BufferAttribute(colors, 3));
          }
          return g;
        });
        const total = parts.reduce((n, g) => n + g.attributes.position.count, 0),
          position = new Float32Array(total * 3),
          normal = new Float32Array(total * 3),
          color = list.some((p) => p.color) ? new Float32Array(total * 3) : null;
        let o = 0;
        for (const g of parts) {
          const n = g.attributes.position.count;
          position.set(g.attributes.position.array, o * 3);
          normal.set(g.attributes.normal.array, o * 3);
          if (color && g.attributes.color) color.set(g.attributes.color.array, o * 3);
          o += n;
        }
        const merged = new Three.BufferGeometry();
        merged.setAttribute('position', new Three.BufferAttribute(position, 3));
        merged.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        if (color) merged.setAttribute('color', new Three.BufferAttribute(color, 3));
        merged.computeBoundingSphere();
        return merged;
      }
      const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
        const g = geo.clone();
        g.scale(sx, sy, sz);
        g.rotateX(rx);
        g.rotateY(ry);
        g.rotateZ(rz);
        g.translate(x, y, z);
        return g;
      };
      const unitBox = new Three.BoxGeometry(1, 1, 1),
        unitCylinder = new Three.CylinderGeometry(1, 1, 1, 10);
      const crowdParts = {};
      function crowdPart(name, geometry, material, capacity, shadow = true, colored = true) {
        const mesh = new Three.InstancedMesh(geometry, material, capacity);
        mesh.instanceMatrix.setUsage(Three.DynamicDrawUsage);
        if (colored) {
          mesh.instanceColor = new Three.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
          mesh.instanceColor.setUsage(Three.DynamicDrawUsage);
        }
        mesh.count = 0;
        // Instances move every frame, so the mesh-level bounds are meaningless.
        mesh.frustumCulled = false;
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        mesh.name = 'crowd ' + name;
        mesh.userData.dynamic = true;
        scene.add(mesh);
        crowdParts[name] = { mesh, n: 0, capacity };
        return crowdParts[name];
      }
      /* A painted body part (character-rig3d.js PAINT SHADER): per-instance paint and mask. */
      function rigPart(name, geometry, material, capacity, shadow = false) {
        const paintAttribute = new Three.InstancedBufferAttribute(new Float32Array(capacity * 4), 4),
          metaAttribute = new Three.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
        paintAttribute.setUsage(Three.DynamicDrawUsage);
        metaAttribute.setUsage(Three.DynamicDrawUsage);
        geometry.setAttribute('crowdPaint', paintAttribute);
        geometry.setAttribute('crowdMeta', metaAttribute);
        const part = crowdPart(name, geometry, material, capacity, shadow, false);
        part.paint = paintAttribute;
        part.meta = metaAttribute;
        return part;
      }
      const weaponGeometries = rigWeaponGeometries();
      /* The figure far away: body and one leg, each a single low mesh. */
      function farFigureGeometries() {
        const region = (g, r) => rigRegion(g, r);
        const body = rigMerge([
          region(
            rigLoft(
              [
                { y: RIG.hip - 0.85, fx: 0.7, bx: 0.8, w: 1.15 },
                { y: RIG.hip + 0.6, fx: 0.85, bx: 0.85, w: 1.2 },
                { y: RIG.hip + 2.4, fx: 1.02, bx: 0.94, w: 1.5 },
                { y: RIG.hip + 3.6, fx: 0.95, bx: 0.95, w: 1.72 },
                { y: RIG.hip + 4.25, fx: 0.55, bx: 0.6, w: 1.1 },
              ],
              8,
            ),
            0,
          ),
          region(rigLoft([{ y: RIG.hip - 0.85, fx: 0.72, bx: 0.82, w: 1.2 }, { y: RIG.hip + 0.8, fx: 0.86, bx: 0.86, w: 1.22 }], 8, null), 1),
          rigBall(0.8, 0.95, 0.66, 3, 0.05, RIG.hip + RIG.waist + RIG.neck + 1.4, 0, 8, 6),
          rigBall(0.86, 0.72, 0.72, 2, -0.08, RIG.hip + RIG.waist + RIG.neck + 1.85, 0, 8, 5),
          ...[-1, 1].map((s) => region(rigPlace(new Three.CylinderGeometry(0.46, 0.3, 4.4, 6, 1), 0, RIG.hip + RIG.waist + RIG.shoulderY - 2.2, s * 1.62, s * 0.08, 0, 0), 0)),
          ...[-1, 1].map((s) => rigBall(0.24, 0.5, 0.16, 3, 0.05, RIG.hip + RIG.waist + RIG.shoulderY - 4.9, s * 1.7, 5, 4)),
        ]);
        const leg = rigMerge([
          region(
            rigLoft(
              [
                { y: 0.3, fx: 0.66, w: 0.66 },
                { y: -RIG.thigh, fx: 0.42, w: 0.4 },
                { y: -RIG.thigh - RIG.shin + 0.2, fx: 0.25, w: 0.24 },
              ],
              6,
            ),
            0,
          ),
          region(rigPlace(new Three.BoxGeometry(2.0, 0.55, 0.74), 0.5, -RIG.thigh - RIG.shin - 0.27, 0), 1),
        ]);
        return { body, leg };
      }
      const farFigure = farFigureGeometries();
      /**
       * BODY SETS
       * The body parts are built twice: a close-up set at full detail and a
       * street set with about half the facets (for the zooms people are played
       * at, where a head is a few pixels across). Only one set is drawn in a
       * frame, so the draw calls do not double.
       */
      function rigBodySet(suffix, detailScale) {
        rigSegmentScale = detailScale;
        const hair = rigHairGeometries(),
          hats = rigHatGeometries();
        const set = {
          head: rigPart('head' + suffix, rigHeadGeometry(), rigSkinMaterial, CROWD_CAPACITY, true),
          torsoM: rigPart('torso' + suffix, rigTorsoGeometry(false), rigSkinMaterial, CROWD_CAPACITY, true),
          torsoF: rigPart('torso f' + suffix, rigTorsoGeometry(true), rigSkinMaterial, CROWD_CAPACITY, true),
          pelvisM: rigPart('pelvis' + suffix, rigPelvisGeometry(false), rigSkinMaterial, CROWD_CAPACITY, true),
          pelvisF: rigPart('pelvis f' + suffix, rigPelvisGeometry(true), rigSkinMaterial, CROWD_CAPACITY, true),
          upperArm: rigPart('upper arm' + suffix, rigUpperArmGeometry(), rigSkinMaterial, CROWD_CAPACITY * 2, true),
          forearm: rigPart('forearm' + suffix, rigForearmGeometry(), rigSkinMaterial, CROWD_CAPACITY * 2),
          hand: rigPart('hand' + suffix, rigHandGeometry(), rigSkinMaterial, CROWD_CAPACITY * 2),
          thighM: rigPart('thigh' + suffix, rigThighGeometry(false), rigSkinMaterial, CROWD_CAPACITY * 2, true),
          thighF: rigPart('thigh f' + suffix, rigThighGeometry(true), rigSkinMaterial, CROWD_CAPACITY * 2, true),
          shin: rigPart('shin' + suffix, rigShinGeometry(), rigSkinMaterial, CROWD_CAPACITY * 2, true),
          shoe: rigPart('shoe' + suffix, rigShoeGeometry(false), rigSkinMaterial, CROWD_CAPACITY * 2),
          boot: rigPart('boot' + suffix, rigShoeGeometry(true), rigSkinMaterial, 600),
          skirt: rigPart('skirt' + suffix, rigSkirtGeometry(), rigClothDouble, 500, true),
          hairShort: rigPart('hair' + suffix, hair.hairShort, rigHairMaterial, 600),
          hairCrop: rigPart('hair crop' + suffix, hair.hairCrop, rigHairMaterial, 200),
          hairBuzz: rigPart('hair buzz' + suffix, hair.hairBuzz, rigHairMaterial, 400),
          hairLong: rigPart('long hair' + suffix, hair.hairLong, rigHairMaterial, 500),
          hairCurly: rigPart('curly hair' + suffix, hair.hairCurly, rigHairMaterial, 400),
          hairBun: rigPart('hair bun' + suffix, hair.hairBun, rigHairMaterial, 300),
          hairPony: rigPart('ponytail' + suffix, hair.hairPony, rigHairMaterial, 300),
          cap: rigPart('cap' + suffix, hats.cap, rigSkinMaterial, 300),
          patrolCap: rigPart('patrol cap' + suffix, hats.patrolCap, rigGearMaterial, 150),
          helmet: rigPart('helmet' + suffix, hats.helmet, rigGearMaterial, 200),
          sunhat: rigPart('sun hat' + suffix, hats.sunhat, rigSkinMaterial, 200),
          hardHat: rigPart('hard hat' + suffix, hats.hardHat, rigGearMaterial, 100),
          collar: rigPart('collar' + suffix, rigCollarGeometry(), rigClothDouble, 400),
          hood: rigPart('hood' + suffix, rigHoodGeometry(), rigSkinMaterial, 300),
          vest: rigPart('vest' + suffix, rigVestGeometry(), rigSkinMaterial, 200, true),
          belt: rigPart('duty belt' + suffix, rigBeltGeometry(), rigGearMaterial, 200),
          backpack: rigPart('backpack' + suffix, rigBackpackGeometry(), rigSkinMaterial, 300, true),
          radio: rigPart('radio' + suffix, rigRegion(new Three.BoxGeometry(0.34, 0.55, 0.28), 0), rigGearMaterial, 150),
        };
        rigSegmentScale = 1;
        return set;
      }
      const BODY_CLOSE = rigBodySet('', 1),
        BODY_STREET = rigBodySet(' street', 0.6);
      // The set drawn this frame (updateCrowd3D).
      let BODY = BODY_STREET;
      const P = {
        // Parts drawn at one detail only.
        figure: rigPart('far body', farFigure.body, rigSkinMaterial, CROWD_CAPACITY, true),
        figureLeg: rigPart('far leg', farFigure.leg, rigSkinMaterial, CROWD_CAPACITY * 2, true),
        labelPolice: crowdPart('label police', rigLabelGeometry, rigLabelMaterial('POLICE', '#f2f2ea'), 120, false, false),
        labelFed: crowdPart('label fed', rigLabelGeometry, rigLabelMaterial('FED', '#f2cf3a'), 60, false, false),
        // Weapons (character-rig3d.js WEAPONS).
        pistol: rigPart('pistol', weaponGeometries.pistol, rigGearMaterial, 150),
        smg: rigPart('smg', weaponGeometries.smg, rigGearMaterial, 80),
        shotgun: rigPart('shotgun', weaponGeometries.shotgun, rigGearMaterial, 20),
        rifle: rigPart('rifle', weaponGeometries.rifle, rigGearMaterial, 160),
        sniper: rigPart('sniper rifle', weaponGeometries.sniper, rigGearMaterial, 20),
        rocket: rigPart('rocket launcher', weaponGeometries.rocket, rigGearMaterial, 10),
        knife: rigPart('knife', weaponGeometries.knife, rigGearMaterial, 20),
        shield: rigPart('shield', weaponGeometries.shield, rigGearMaterial, 40, true),
        // Things in hand and scene props (vertex coloured).
        briefcase: crowdPart('briefcase', crowdMerge([
          { geo: at(unitBox, 0, -1.4, 0, 0, 0, 0, 2.4, 1.7, 0.6), color: '#2a211c' },
          { geo: at(unitBox, 0, -0.4, 0, 0, 0, 0, 0.9, 0.3, 0.26), color: '#1a1512' },
        ]), crowdPropMaterial, 200, false, false),
        shopping: crowdPart('shopping bag', crowdMerge([
          { geo: at(unitBox, 0, -1.45, 0, 0, 0, 0, 1.9, 2.1, 0.95) },
          { geo: at(unitBox, 0, -0.3, 0, 0, 0, 0, 1.0, 0.22, 0.18) },
        ]), crowdBodyMaterial, 200, false),
        cup: crowdPart('cup', crowdMerge([
          { geo: at(unitCylinder, 0.15, -0.5, 0, 0, 0, 0, 0.36, 1.0, 0.36), color: '#efe6d6' },
          { geo: at(unitCylinder, 0.15, 0.04, 0, 0, 0, 0, 0.4, 0.18, 0.4), color: '#3b2a22' },
        ]), crowdPropMaterial, 200, false, false),
        phone: crowdPart('phone', at(unitBox, 0.2, -0.5, 0, 0, 0, 0, 0.26, 1.1, 0.62), crowdPhoneMaterial, 260, false, false),
        ember: crowdPart('ember', at(unitBox, 0.3, -0.8, 0.2, 0, 0, 0, 0.4, 0.4, 0.4), crowdEmberMaterial, 60, false, false),
        carton: crowdPart('carton', crowdMerge([
          { geo: at(unitBox, 0, 0, 0, 0, 0, 0, 2.4, 2.2, 3.2), color: '#b58a5a' },
          { geo: at(unitBox, 0, 1.11, 0, 0, 0, 0, 0.55, 0.04, 3.22), color: '#d8c49a' },
        ]), crowdPropMaterial, 30, true, false),
        umbrella: crowdPart('umbrella', crowdMerge([
          { geo: at(new Three.CylinderGeometry(0.12, 5.6, 1.7, 12, 1, true), 0, 7.4, 0) },
          { geo: at(unitCylinder, 0, 3.6, 0, 0, 0, 0, 0.12, 7.4, 0.12) },
        ]), crowdClothDouble, 400),
        guitar: crowdPart('guitar', crowdMerge([
          { geo: at(unitCylinder, 0, 0, 0, Math.PI / 2, 0, 0, 2.0, 0.7, 1.65), color: '#9a5a2a' },
          { geo: at(unitCylinder, 0, 0, 0.9, Math.PI / 2, 0, 0, 1.4, 0.72, 1.2), color: '#9a5a2a' },
          { geo: at(unitCylinder, 0, 0.37, -0.26, Math.PI / 2, 0, 0, 0.52, 0.1, 0.52), color: '#1d1410' },
          { geo: at(unitBox, 0, 0.18, -3.7, 0, 0, 0, 0.44, 0.3, 4.9), color: '#3b2618' },
          { geo: at(unitBox, 0, 0.18, -6.4, 0, 0, 0, 0.6, 0.35, 1.0), color: '#1d1410' },
        ]), crowdPropMaterial, 12, true, false),
        // Beach club things in hand (beachclub.js): a cocktail, a waiter's tray,
        // a champagne bottle with a sparkler, a broom.
        cocktail: crowdPart('cocktail', crowdMerge([
          { geo: at(new Three.CylinderGeometry(0.54, 0.26, 1.05, 8), 0.15, -0.35, 0), color: '#e8f4f6' },
          { geo: at(new Three.CylinderGeometry(0.48, 0.28, 0.7, 8), 0.15, -0.48, 0), color: '#ff7a4a' },
          { geo: at(unitBox, 0.3, 0.26, 0.1, 0, 0, 0.3, 0.1, 1.2, 0.1), color: '#2fbf8f' },
        ]), crowdPropMaterial, 320, false, false),
        tray: crowdPart('tray', crowdMerge([
          { geo: at(unitCylinder, 0, 0.2, 0, 0, 0, 0, 2.3, 0.18, 2.3), color: '#c9ccc9' },
          { geo: at(unitCylinder, 0.8, 0.8, 0.5, 0, 0, 0, 0.35, 1.05, 0.35), color: '#ff7a4a' },
          { geo: at(unitCylinder, -0.7, 0.8, 0.45, 0, 0, 0, 0.35, 1.05, 0.35), color: '#f2d24a' },
          { geo: at(unitCylinder, 0, 0.8, -0.8, 0, 0, 0, 0.35, 1.05, 0.35), color: '#6fd0e0' },
        ]), crowdPropMaterial, 24, false, false),
        bottle: crowdPart('bottle', crowdMerge([
          { geo: at(unitCylinder, 0.2, 0.2, 0, 0, 0, 0, 0.48, 2.1, 0.48), color: '#1d3a28' },
          { geo: at(unitCylinder, 0.2, 1.5, 0, 0, 0, 0, 0.2, 0.8, 0.2), color: '#d4b24a' },
        ]), crowdPropMaterial, 12, false, false),
        spark: crowdPart('spark', new Three.OctahedronGeometry(1, 0), crowdEmberMaterial, 60, false, false),
        broom: crowdPart('broom', crowdMerge([
          { geo: at(unitCylinder, 0, -2.2, 0, 0, 0, 0, 0.16, 6.6, 0.16), color: '#8a6d4a' },
          { geo: at(unitBox, 0, -5.6, 0, 0, 0, 0, 0.7, 0.8, 3.0), color: '#3a3430' },
        ]), crowdPropMaterial, 12, false, false),
        dogBody: crowdPart('dog', crowdMerge([
          { geo: at(unitBox, 0, 3.3, 0, 0, 0, 0, 4.6, 2.1, 1.8) },
          { geo: at(unitBox, 2.4, 4.4, 0, 0, 0, -0.35, 1.5, 1.9, 1.6) },
          { geo: at(unitBox, 3.4, 4.9, 0, 0, 0, 0, 1.9, 1.5, 1.4) },
          { geo: at(unitBox, 4.55, 4.6, 0, 0, 0, 0, 1.0, 0.8, 0.9) },
          { geo: at(unitBox, 3.1, 5.9, 0.55, 0.3, 0, 0, 0.5, 0.9, 0.35) },
          { geo: at(unitBox, 3.1, 5.9, -0.55, -0.3, 0, 0, 0.5, 0.9, 0.35) },
          { geo: at(unitBox, -2.8, 4.3, 0, 0, 0, 0.9, 0.45, 2.0, 0.45) },
        ]), crowdBodyMaterial, 160),
        dogLeg: crowdPart('dog leg', crowdLimb(0.36, 0.3, 2.4, 5), crowdBodyMaterial, 640, false),
        leash: crowdPart('leash', unitBox, crowdLeashMaterial, 160, false, false),
      };
      /**
       * STREET PROPS
       * Scene furniture from src/crowd.js (carts, cafe tables, guitar cases,
       * delivery boxes, club ropes). Each kind is one vertex-coloured merged
       * geometry drawn as an InstancedMesh.
       */
      const PROP_GEOMETRY = {
        cart: crowdMerge([
          { geo: at(unitBox, 0, 5.0, 0, 0, 0, 0, 13, 5.5, 6.5), color: '#c9ccc9' },
          { geo: at(unitBox, 0, 7.9, 0, 0, 0, 0, 13.6, 0.4, 7), color: '#8f9396' },
          { geo: at(unitBox, 0, 5.2, 3.3, 0, 0, 0, 11, 2.4, 0.1), color: '#c63a2c' },
          { geo: at(unitCylinder, -4.5, 1.6, 3.4, Math.PI / 2, 0, 0, 1.6, 0.8, 1.6), color: '#1c1d1f' },
          { geo: at(unitCylinder, 4.5, 1.6, 3.4, Math.PI / 2, 0, 0, 1.6, 0.8, 1.6), color: '#1c1d1f' },
          { geo: at(unitCylinder, 0, 13, 0, 0, 0, 0, 0.25, 11, 0.25), color: '#6b6f72' },
          { geo: at(new Three.ConeGeometry(9, 3, 8, 1, true), 0, 18.3, 0), color: '#e2b43a' },
          { geo: at(new Three.CylinderGeometry(9.05, 9.05, 0.7, 8, 1, true), 0, 16.6, 0), color: '#c63a2c' },
          { geo: at(unitBox, 5.5, 9.1, 0, 0, 0, 0, 1.2, 2, 5), color: '#e8e2d2' },
        ]),
        cafeTable: crowdMerge([
          { geo: at(unitCylinder, 0, 6.3, 0, 0, 0, 0, 3.2, 0.45, 3.2), color: '#e9e4d8' },
          { geo: at(unitCylinder, 0, 3.2, 0, 0, 0, 0, 0.35, 6.2, 0.35), color: '#2c2f33' },
          { geo: at(unitCylinder, 0, 0.2, 0, 0, 0, 0, 1.6, 0.35, 1.6), color: '#2c2f33' },
          ...[-1, 1].flatMap((s) => [
            // Chairs: a 0.45 m seat, where a seated person's hips come to.
            { geo: at(unitBox, s * 7.5, 3.6, 0, 0, 0, 0, 3.2, 0.5, 3.2), color: '#8a5a32' },
            { geo: at(unitBox, s * 9.1, 6.2, 0, 0, 0, 0, 0.5, 4.8, 3.2), color: '#7a4e2a' },
            { geo: at(unitBox, s * 7.5, 1.75, 0, 0, 0, 0, 2.6, 3.5, 2.6), color: '#3a3430' },
          ]),
        ]),
        menuBoard: crowdMerge([
          { geo: at(unitBox, 0, 4, 1.0, 0.24, 0, 0, 4.2, 8, 0.4), color: '#23272a' },
          { geo: at(unitBox, 0, 4, -1.0, -0.24, 0, 0, 4.2, 8, 0.4), color: '#23272a' },
          { geo: at(unitBox, 0, 4.6, 1.26, 0.24, 0, 0, 3.2, 5, 0.1), color: '#dcd6c4' },
        ]),
        guitarCase: crowdMerge([
          { geo: at(unitBox, 0, 0.5, 0, 0, 0, 0, 8, 1, 3.2), color: '#1d1f24' },
          { geo: at(unitBox, 0, 1.02, 0, 0, 0, 0, 7.2, 0.1, 2.6), color: '#8e2433' },
          { geo: at(unitBox, 1.5, 1.12, 0.4, 0, 0, 0, 0.7, 0.1, 0.7), color: '#d9c060' },
          { geo: at(unitBox, 0, 2.4, -1.7, -1.15, 0, 0, 8, 0.4, 3.2), color: '#1d1f24' },
        ]),
        boxes: crowdMerge([
          { geo: at(unitBox, 0, 1.6, 0, 0, 0, 0, 3.6, 3.2, 3.6), color: '#b58a5a' },
          { geo: at(unitBox, 0.3, 4.6, 0.2, 0, 0.3, 0, 3.4, 2.8, 3.2), color: '#a67c50' },
          { geo: at(unitBox, 4.2, 1.4, 0, 0, 0.2, 0, 3.2, 2.8, 3.6), color: '#c09366' },
          { geo: at(unitBox, -3.6, 3.5, 0, 0, 0, 0.12, 0.4, 7, 2.6), color: '#3a3e44' },
        ]),
        rope: crowdMerge([
          ...[-16, 0, 16].flatMap((x) => [
            { geo: at(unitCylinder, x, 3.5, 0, 0, 0, 0, 0.35, 7, 0.35), color: '#c9a44a' },
            { geo: at(unitCylinder, x, 0.25, 0, 0, 0, 0, 1.3, 0.5, 1.3), color: '#c9a44a' },
          ]),
          { geo: at(unitBox, -8, 5.8, 0, 0, 0, 0, 16, 0.5, 0.5), color: '#8e1f2a' },
          { geo: at(unitBox, 8, 5.8, 0, 0, 0, 0, 16, 0.5, 0.5), color: '#8e1f2a' },
        ]),
      };
      const propParts = {};
      for (const [kind, geometry] of Object.entries(PROP_GEOMETRY))
        propParts[kind] = crowdPart('prop ' + kind, geometry, crowdPropMaterial, 40, true, false);

      // Scratch objects for the skeleton, reused every frame.
      const crowdMatrix = () => new Three.Matrix4();
      const mIdentity = crowdMatrix(),
        mRoot = crowdMatrix(),
        mHips = crowdMatrix(),
        mTorso = crowdMatrix(),
        mHead = crowdMatrix(),
        mAim = crowdMatrix(),
        mGun = crowdMatrix(),
        mShieldM = crowdMatrix(),
        mLocal = crowdMatrix(),
        mOut = crowdMatrix(),
        mShoulder = [crowdMatrix(), crowdMatrix()],
        mElbow = [crowdMatrix(), crowdMatrix()],
        mHand = [crowdMatrix(), crowdMatrix()],
        mHip = [crowdMatrix(), crowdMatrix()],
        mKnee = [crowdMatrix(), crowdMatrix()],
        mFoot = crowdMatrix(),
        crowdEuler = new Three.Euler(0, 0, 0, 'YXZ'),
        crowdScale = new Three.Vector3(),
        crowdVec = new Three.Vector3(),
        crowdVec2 = new Three.Vector3(),
        crowdQuat = new Three.Quaternion(),
        crowdXAxis = new Three.Vector3(1, 0, 0);
      /* out = parent · T(x, y, z) · Ry(ry) · Rx(rx) · Rz(rz) */
      function crowdJoint(out, parent, x, y, z, rz = 0, rx = 0, ry = 0) {
        crowdEuler.set(rx, ry, rz, 'YXZ');
        mLocal.makeRotationFromEuler(crowdEuler);
        mLocal.elements[12] = x;
        mLocal.elements[13] = y;
        mLocal.elements[14] = z;
        return out.multiplyMatrices(parent, mLocal);
      }
      function crowdEmit(part, matrix, sx, sy, sz, color) {
        if (part.n >= part.capacity) return;
        mOut.copy(matrix).scale(crowdScale.set(sx, sy, sz));
        part.mesh.setMatrixAt(part.n, mOut);
        if (color && part.mesh.instanceColor) part.mesh.setColorAt(part.n, color);
        part.n++;
      }
      // 16 while the person being packed wears the player's night rim, else 0.
      let rigRimFlag = 0;
      /* A painted part: the matrix, then the paint (character-rig3d.js rigPaint). */
      function rigEmit(part, matrix, sx, sy, sz, paint) {
        const i = part.n;
        if (i >= part.capacity || !paint) return;
        mOut.copy(matrix);
        if (sx !== 1 || sy !== 1 || sz !== 1) mOut.scale(crowdScale.set(sx, sy, sz));
        mOut.toArray(part.mesh.instanceMatrix.array, i * 16);
        const pa = part.paint.array,
          ma = part.meta.array;
        pa[i * 4] = paint[0];
        pa[i * 4 + 1] = paint[1];
        pa[i * 4 + 2] = paint[2];
        pa[i * 4 + 3] = paint[3];
        ma[i * 2] = paint[4];
        ma[i * 2 + 1] = paint[5] + rigRimFlag;
        part.n++;
      }
      const dogColors = new Map();
      const umbrellaColors = new Map();
      function cachedCrowdColor(map, hex) {
        let c = map.get(hex);
        if (!c) map.set(hex, (c = new Three.Color(hex)));
        return c;
      }

      /**
       * LOOKS
       * A look (crowd.js dressPerson, or `specialLook` below) is compiled once
       * into parts and paints: body shape (female / male, kid), height and
       * build, the garment on each part, hair, hat, footwear and kit. Fields
       * the game changes later (a fan's shirt turning into the team kit, a
       * vendor's hat) recompile it.
       */
      const compiledLooks = new WeakMap();
      const hashOf = (seed, k) => {
        const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      const pickOf = (list, h) => list[Math.min(list.length - 1, Math.floor(h * list.length))];
      const mixColor = new Three.Color(),
        mixColor2 = new Three.Color();
      function mixHex(a, b, t) {
        return '#' + mixColor.set(a).lerp(mixColor2.set(b), t).getHexString();
      }
      const SUMMER_DISTRICTS = /BEACH|OCEAN DRIVE|PALM KEYS|SUNSET PIER|CORAL MARINA|LITTLE HAVANA|MAREA/;
      const DOWNTOWN_DISTRICTS = /DOWNTOWN|FINANCIAL|CIVIC|MIDTOWN|CENTRAL/;
      function lookChanged(c, look) {
        return (
          c.top !== look.top ||
          c.pants !== look.pants ||
          c.shoes !== look.shoes ||
          c.hat !== look.hat ||
          c.hatColor !== look.hatColor ||
          c.skirt !== look.skirt ||
          c.shorts !== look.shorts ||
          c.sleeves !== look.sleeves ||
          c.hairStyle !== look.hairStyle
        );
      }
      function compiledLook(look, p) {
        let c = compiledLooks.get(look);
        if (!c || lookChanged(c, look)) {
          c = compileLook(look, p);
          compiledLooks.set(look, c);
        }
        return c;
      }
      const SLEEVES = { long: [0, 0], short: [0, 3], bare: [3, 3] };
      function compileLook(look, p) {
        const seed = (look.build || 1) * 1000 + (look.height || 1) * 77,
          h = (k) => hashOf(seed, k),
          role = look.outfit ? null : p.role || 'casual',
          kid = role === 'kid' || !!look.kid,
          female = look.female ?? (look.skirt || look.hairStyle === 2 || look.hairStyle === 3 || (look.hairStyle === 4 && h(1) < 0.5)),
          skin = look.skin || '#c99169',
          hair = look.hair || '#231a15',
          district = look.outfit || !p ? '' : districtAt(p.x, p.y) || '',
          summer = SUMMER_DISTRICTS.test(district),
          downtown = DOWNTOWN_DISTRICTS.test(district);
        let top = look.top || '#44505c',
          pants = look.pants || '#2a3444',
          shoes = look.shoes || '#141414',
          garment = look.garment,
          inner = look.inner || pickOf(['#ecebe6', '#dad7cf', '#2a2c30', '#9aa3ad', '#c9d4dc'], h(2)),
          accent = look.accent || top,
          topPattern = look.topPattern || 0,
          pantsPattern = look.pantsPattern ?? 0,
          sleeves = look.sleeves ? 'long' : 'short',
          shorts = !!look.shorts,
          skirt = !!look.skirt,
          footwear = look.footwear || 'shoe',
          sole = look.sole || null,
          socks = null,
          hatStyle = look.hatStyle || (look.hat ? 'cap' : null),
          vest = look.vest || null,
          beard = look.beard ?? (!female && !kid ? (h(3) < 0.1 ? 2 : h(3) < 0.32 ? 1 : 0) : 0),
          hairPart = null;
        const barefoot = shoes === skin;
        if (!garment) {
          if (top === skin) garment = 'shirtless';
          else if (female && shorts && barefoot && !look.sleeves) garment = 'bikini';
          else if (role === 'commuter') {
            garment = look.sleeves || downtown ? (h(4) < (female ? 0.45 : 0.62) ? 'suit' : female ? 'vneck' : 'jacket') : 'tee';
            if (garment === 'suit') {
              inner = pickOf(['#f1f2f4', '#e4ebf2', '#f4efe6', '#dfe4ea'], h(5));
              accent = female ? inner : pickOf(['#7a1f2a', '#1d2a44', '#2f3337', '#5a4a2a', '#23405c'], h(6));
            }
          } else if (role === 'jogger') {
            garment = female ? (h(4) < 0.5 ? 'crop' : 'tank') : h(4) < 0.5 ? 'tank' : 'tee';
            shorts = true;
            footwear = 'sneaker';
            socks = '#f2f1ec';
          } else if (role === 'worker') {
            const hiVis = /^#(e8761e|d8c93a)$/i.test(top);
            garment = 'tee';
            if (hiVis) {
              vest = { a: top, b: top, c: '#d9dde0' };
              top = pickOf(['#3d4c5c', '#2a2c30', '#6b5638', '#e8e4da'], h(5));
            }
            footwear = 'boot';
            if (look.hat) hatStyle = 'hardHat';
          } else if (role === 'reveller') garment = female ? (skirt ? (h(4) < 0.6 ? 'dress' : 'crop') : pickOf(['crop', 'tank', 'vneck', 'jacket'], h(4))) : pickOf(['tee', 'jacket', 'vneck', 'tee'], h(4));
          else if (role === 'tourist') {
            garment = 'tee';
            topPattern = h(4) < 0.3 ? PATTERN.floral : h(4) < 0.42 ? PATTERN.stripes : 0;
            if (look.hat && h(5) < 0.55) hatStyle = 'sunhat';
            if (look.shorts === undefined) shorts = h(6) < 0.6;
            footwear = 'sneaker';
          } else if (role === 'elder') garment = h(4) < 0.55 ? 'jacket' : 'tee';
          else if (role === 'texter') garment = h(4) < 0.6 ? 'hoodie' : 'tee';
          else if (role === 'bouncer') {
            garment = 'jacket';
            inner = '#141518';
          } else if (kid) garment = h(4) < 0.35 ? 'hoodie' : 'tee';
          else if (female) garment = skirt && h(4) < 0.4 ? 'dress' : pickOf(['tee', 'vneck', 'vneck', 'jacket', 'hoodie', 'tank', 'tee'], h(4));
          else {
            garment = pickOf(['tee', 'tee', 'jacket', 'hoodie', 'vneck', 'tee', 'tank'], h(4));
            if (garment === 'tee' && h(7) < 0.25) topPattern = PATTERN.check;
          }
          if (summer && !look.outfit) {
            if (garment === 'jacket' || garment === 'hoodie') garment = female ? 'tank' : 'tee';
            if (look.shorts === undefined && !skirt) shorts = h(8) < 0.7;
            if (garment === 'tee' && h(9) < 0.3) topPattern = PATTERN.floral;
            sleeves = 'short';
            if (look.hat && h(5) < 0.6) hatStyle = 'sunhat';
          }
          if (garment === 'dress') pants = top;
          if (garment === 'jacket' && h(10) < 0.3) topPattern = PATTERN.leather;
        }
        // Bluish trousers are jeans.
        if (look.pantsPattern === undefined && !skirt && (garment === 'tee' || garment === 'hoodie' || garment === 'jacket' || garment === 'vneck' || garment === 'tank')) {
          mixColor.set(pants);
          if (mixColor.b > mixColor.r * 1.25 && mixColor.b > 0.02) pantsPattern = PATTERN.denim;
        }
        if (footwear === 'shoe' && !look.outfit && /^#(f0eee8|e24a3b|2fa3c7)$/i.test(shoes)) footwear = 'sneaker';
        const torsoMask = TORSO_MASKS[garment] || TORSO_MASKS.tee,
          armCover =
            garment === 'jacket' || garment === 'accentJacket' || garment === 'suit' || garment === 'hoodie'
              ? 'long'
              : garment === 'tank' || garment === 'crop' || garment === 'bikini' || garment === 'shirtless' || garment === 'dress'
                ? 'bare'
                : look.sleevesStyle || sleeves;
        const gloves = look.gloves || null,
          legsCovered = !shorts && !skirt,
          kneePads = look.kneePads || null;
        if (!sole) sole = footwear === 'sneaker' ? '#eeede8' : footwear === 'boot' ? '#15120f' : barefoot ? skin : '#1b1816';
        // Hair: 0 shaved / bald, 1 short, 2 long, 3 bun, 4 curly (crowd.js); outfits may name a part.
        const style = look.hairStyle;
        if (typeof style === 'string') hairPart = BODY_CLOSE[style] ? style : null;
        else if (style === 1) hairPart = 'hairShort';
        else if (style === 2) hairPart = 'hairLong';
        else if (style === 3) hairPart = 'hairBun';
        else if (style === 4) hairPart = 'hairCurly';
        else if (style === 0) hairPart = female ? 'hairPony' : h(11) < 0.6 ? 'hairBuzz' : null;
        const hatPart = hatStyle ? (BODY_CLOSE[hatStyle] ? hatStyle : 'cap') : null,
          helmet = hatStyle === 'helmet' || hatStyle === 'hardHat';
        const height = look.heightAbsolute || (kid ? look.height || 0.64 : clamp((look.height || 1) * (female ? 0.965 : 1.015), 0.914, 1.086)),
          width = clamp(1 + ((look.build || 1) - 1) * 0.5, 0.9, 1.2) * (kid ? 0.9 : 1);
        const eyes = look.eyes || mixHex(hair, '#0d0b0a', 0.45),
          jaw = beard === 2 ? mixHex(hair, skin, 0.15) : beard === 1 ? mixHex(skin, hair, 0.38) : skin,
          lips = mixHex(skin, '#a4474a', female ? 0.38 : 0.2),
          collarColor = legsCovered ? pants : socks || skin;
        return {
          top: look.top,
          pants: look.pants,
          shoes: look.shoes,
          hat: look.hat,
          hatColor: look.hatColor,
          skirt: look.skirt,
          shorts: look.shorts,
          sleeves: look.sleeves,
          hairStyle: look.hairStyle,
          female,
          kid,
          height,
          width,
          garment,
          torso: female ? 'torsoF' : 'torsoM',
          pelvis: female ? 'pelvisF' : 'pelvisM',
          thigh: female ? 'thighF' : 'thighM',
          shoulderZ: RIG.shoulderZ[female ? 1 : 0],
          hipZ: RIG.hipZ[female ? 1 : 0],
          headScale: kid ? 1.22 : female ? 0.95 : 1,
          hairPart: helmet ? null : hairPart,
          hatPart,
          shoePart: footwear === 'boot' ? 'boot' : 'shoe',
          skirtOn: skirt || garment === 'dress',
          collar: !!look.collar || garment === 'jacket' || garment === 'accentJacket' || garment === 'suit',
          hood: garment === 'hoodie',
          vest: !!vest,
          belt: !!look.belt,
          label: look.label === 'POLICE' ? P.labelPolice : look.label === 'FED' ? P.labelFed : null,
          radio: !!look.radio,
          backpack: !!look.backpack,
          paints: {
            head: rigPaint(skin, eyes, jaw, lips, [0, 1, 2, 3]),
            hair: rigPaint(hair),
            hat: rigPaint(look.hatColor || '#23272e', look.brim || (hatStyle === 'sunhat' ? mixHex(look.hatColor || '#e9dcc0', '#6b4a2e', 0.35) : mixHex(look.hatColor || '#23272e', '#000000', 0.25)), look.hatBadge || '#d8b65a'),
            torso: rigPaint(top, inner, accent, skin, torsoMask, topPattern),
            collar: rigPaint(garment === 'suit' || garment === 'uniform' ? (look.collarColor || inner) : top, top, top, top, [0, 0, 0, 0], garment === 'suit' ? 0 : topPattern),
            hood: rigPaint(top, top, top, top, [0], topPattern),
            upperArm: rigPaint(top, top, accent, skin, SLEEVES[armCover], topPattern),
            forearm: rigPaint(top, look.cuff || top, top, skin, armCover === 'long' ? [0, 1] : [3, 3], topPattern),
            hand: gloves ? rigPaint(gloves) : rigPaint(skin),
            pelvis: rigPaint(pants, look.beltColor || '#1d1a18', look.buckle || '#b7b9bb', skin, look.belt || garment === 'bikini' || garment === 'dress' || garment === 'shirtless' || (shorts && !legsCovered && summer) ? [0, 0, 0] : [0, 1, 2], pantsPattern),
            skirt: rigPaint(pants, mixHex(pants, '#000000', 0.2), pants, pants, [0, 1]),
            thigh: rigPaint(pants, pants, pants, skin, skirt || garment === 'bikini' ? [3, 3] : shorts ? [0, 3] : [0, 0], pantsPattern),
            shin: rigPaint(pants, socks || skin, kneePads || pants, skin, legsCovered ? [0, 0, kneePads ? 2 : 0] : [3, socks ? 1 : 3, 3], pantsPattern),
            shoe: rigPaint(barefoot ? skin : shoes, sole, collarColor, skin, footwear === 'boot' ? [0, 1, 0] : [0, 1, 2]),
            vest: vest ? rigPaint(vest.a, vest.b, vest.c) : null,
            belt: rigPaint(look.dutyBelt?.a || '#121315', look.dutyBelt?.b || '#18191b', look.dutyBelt?.c || '#b8bec4'),
            backpack: rigPaint(look.bagColor || '#2b2f3a', '#1b1c1f'),
            radio: rigPaint('#141517'),
            figure: rigPaint(top === skin || garment === 'bikini' ? skin : top, pants, hatPart ? look.hatColor || '#23272e' : hairPart ? hair : skin, skin, [0, 1, 2, 3]),
            figureLeg: rigPaint(legsCovered ? pants : skin, barefoot ? skin : shoes, pants, pants, [0, 1]),
          },
        };
      }
      /**
       * OUTFITS
       * The player and everyone who is not a pedestrian gets a look here, by
       * who they are: patrol officers in LAPD navy with a duty belt, badge and
       * shoulder radio (a peaked cap on some); traffic officers add a hi-vis
       * vest; SWAT in black with helmet, plate carrier and POLICE across the
       * back; agents in dark suits under a windbreaker with FED on the back;
       * soldiers in woodland camouflage with helmet and plate carrier; mobsters
       * in suits; gangs in their colours; party guests and staff.
       */
      const specialLooks = new WeakMap();
      const FEMALE_NAMES = /\b(MARA|ELENA|MARIA|SOFIA|ROSA|LUCIA|NINA|ANNA|CLAIRE|EVA)\b/;
      function outfitOf(p) {
        if (p === player) return player.disguised ? 'playerDisguise' : 'player';
        if (p.police) return { patrol: 'police', road: 'traffic', swat: 'swat', sniper: 'swat', fed: 'fed', soldier: 'army' }[p.unit] || 'police';
        if (p.military) return p.role === 'gate' ? 'mp' : 'army';
        if (p.guest) return p.staff ? 'waiter' : 'partyGuest';
        if (p.faction === 'vescari' || p.guard || p.boss) return 'mobster';
        if (p.faction) return 'gang';
        return 'story';
      }
      const PLAYER_GOLD = '#c9a14f'; // the HUD gold (shell.html --ui-gold #e2c897), deepened so it reads as gold on cloth
      function outfitLook(p, outfit, seed) {
        const h = (k) => hashOf(seed, k),
          skin = pickOf(['#e9c2a3', '#d9a886', '#c99169', '#b27a52', '#8f5b3c', '#6e4630', '#4e3223'], h(1)),
          hair = pickOf(['#16110e', '#231a15', '#33241b', '#4b3424', '#6a4a30', '#8c6a42', '#b89060'], h(2)),
          base = { outfit, skin, hair, hairStyle: 1, build: 1 + (h(3) - 0.5) * 0.3, height: 0.95 + h(4) * 0.12, female: false, sleeves: true };
        switch (outfit) {
          case 'player':
          case 'playerDisguise': {
            const disguise = outfit === 'playerDisguise';
            return {
              ...base,
              skin: '#c49270',
              hair: '#1a1411',
              hairStyle: 'hairCrop',
              beard: 1,
              build: 1.2,
              heightAbsolute: 1.8 / 1.75,
              garment: disguise ? 'suit' : 'accentJacket',
              top: disguise ? '#e3dac0' : '#2a221e',
              inner: disguise ? '#f6f4ee' : '#eeebe4',
              accent: disguise ? '#16171b' : PLAYER_GOLD,
              topPattern: disguise ? 0 : PATTERN.leather,
              cuff: disguise ? '#e3dac0' : '#1d1714',
              pants: disguise ? '#23272f' : '#2b3647',
              pantsPattern: disguise ? 0 : PATTERN.denim,
              belt: false,
              beltColor: '#2a1d15',
              buckle: '#c9a45a',
              shoes: disguise ? '#121214' : '#3b2b1f',
              footwear: disguise ? 'shoe' : 'boot',
            };
          }
          case 'police':
          case 'traffic': {
            const female = h(5) < 0.3,
              cap = outfit === 'traffic' || h(6) < 0.4;
            return {
              ...base,
              female,
              hairStyle: female ? 3 : h(7) < 0.5 ? 'hairBuzz' : 1,
              garment: 'uniform',
              top: '#1d283a',
              inner: '#152033',
              accent: '#d8b65a',
              sleevesStyle: h(8) < 0.5 ? 'long' : 'short',
              pants: '#1b2433',
              pantsPattern: 0,
              belt: true,
              collar: true,
              radio: true,
              shoes: '#111214',
              footwear: 'boot',
              hatStyle: cap ? 'patrolCap' : null,
              hatColor: outfit === 'traffic' ? '#e9e9e4' : '#1a2232',
              brim: '#0e0f11',
              hatBadge: '#d8b65a',
              vest: outfit === 'traffic' ? { a: '#cfe83a', b: '#cfe83a', c: '#c9ced3' } : null,
              beard: 0,
            };
          }
          case 'swat':
            return {
              ...base,
              hairStyle: 'hairBuzz',
              garment: 'tee',
              top: '#262a30',
              pants: '#262a30',
              pantsPattern: 0,
              belt: true,
              dutyBelt: { a: '#16181b', b: '#1f2226', c: '#2b2e33' },
              vest: { a: '#1b1e22', b: '#2c3036', c: '#1b1e22' },
              hatStyle: 'helmet',
              hatColor: '#1b1e22',
              brim: '#0f1012',
              hatBadge: '#2c2f34',
              gloves: '#141517',
              kneePads: '#16181b',
              shoes: '#121314',
              footwear: 'boot',
              label: 'POLICE',
              radio: true,
              beard: h(9) < 0.3 ? 1 : 0,
            };
          case 'fed':
            return {
              ...base,
              female: h(5) < 0.25,
              hairStyle: h(5) < 0.25 ? 3 : 1,
              garment: 'suit',
              top: '#1a2131',
              inner: '#eef0f2',
              accent: '#2b3140',
              pants: '#1b1e25',
              pantsPattern: 0,
              belt: false,
              shoes: '#0f0f10',
              footwear: 'shoe',
              label: 'FED',
              eyes: '#0a0a0b',
              beard: 0,
            };
          case 'army':
          case 'mp':
            return {
              ...base,
              hairStyle: 'hairBuzz',
              garment: 'tee',
              top: '#6f7552',
              topPattern: PATTERN.camo,
              pants: '#6f7552',
              pantsPattern: PATTERN.camo,
              belt: true,
              dutyBelt: { a: '#4d4a36', b: '#5a553d', c: '#3e3c2d' },
              vest: { a: '#6a6246', b: '#58513a', c: '#6a6246' },
              hatStyle: 'helmet',
              hatColor: '#5d6247',
              brim: outfit === 'mp' ? '#ebe8df' : '#3e4130',
              hatBadge: '#2d2f26',
              gloves: '#6a5e48',
              kneePads: '#55593f',
              shoes: '#6a553c',
              footwear: 'boot',
              beard: 0,
            };
          case 'mobster':
            return {
              ...base,
              hairStyle: h(5) < 0.5 ? 1 : 'hairBuzz',
              garment: 'suit',
              top: p.boss ? '#1c1c20' : p.color || '#293441',
              inner: p.boss ? '#1a1a1d' : '#e9e6df',
              accent: p.boss ? '#b8943e' : '#1a1a1d',
              pants: '#17181c',
              pantsPattern: 0,
              shoes: '#0f0f10',
              beard: h(6) < 0.4 ? 1 : 0,
              build: 1.15,
            };
          case 'waiter':
            return { ...base, garment: 'suit', top: '#efe7d2', inner: '#ffffff', accent: '#16171b', pants: '#17181b', pantsPattern: 0, shoes: '#111', beard: 0 };
          case 'partyGuest': {
            const female = h(5) < 0.5;
            return female
              ? { ...base, female, hairStyle: pickOf([2, 3, 2, 4], h(6)), garment: 'dress', skirt: true, top: p.color || '#c23b6b', pants: p.color || '#c23b6b', topPattern: PATTERN.satin, shoes: '#111' }
              : { ...base, garment: 'suit', top: h(6) < 0.5 ? '#1c1d22' : p.color || '#2a2d33', inner: h(7) < 0.5 ? '#f2f0ea' : p.color || '#eae4d8', accent: '#18191c', pants: '#18191c', pantsPattern: 0, shoes: '#111' };
          }
          case 'gang': {
            const female = h(5) < 0.2,
              garment = pickOf(['hoodie', 'jacket', 'tank', 'tee', 'hoodie'], h(6));
            return {
              ...base,
              female,
              hairStyle: female ? pickOf([2, 3, 0], h(7)) : pickOf([1, 'hairBuzz', 4, 1], h(7)),
              garment,
              top: p.color || '#6b2f36',
              inner: h(8) < 0.5 ? '#e8e6e0' : '#1a1b1d',
              pants: h(9) < 0.6 ? '#2a3446' : '#1b1c20',
              shoes: h(10) < 0.6 ? '#eeede8' : '#141414',
              footwear: h(10) < 0.6 ? 'sneaker' : 'shoe',
              hat: h(11) < 0.4 ? 1 : 0,
              hatColor: h(12) < 0.5 ? '#141414' : p.color || '#6b2f36',
            };
          }
          case 'cyclist':
          case 'motorcyclist':
          case 'jetskier': {
            const female = h(5) < 0.35;
            const base2 = { ...base, female, hairStyle: female ? pickOf([3, 'hairPony', 2], h(6)) : pickOf([1, 'hairBuzz', 4], h(6)) };
            if (outfit === 'motorcyclist')
              return { ...base2, garment: 'jacket', top: pickOf(['#1c1d20', '#2a2320', '#3a1d1d', '#1d2433'], h(7)), topPattern: PATTERN.leather, inner: '#2a2c30', pants: '#23282f', shoes: '#141414', footwear: 'boot', gloves: '#141414', hatStyle: 'helmet', hatColor: pickOf(['#e9e7e1', '#1b1c1f', '#b8322a', '#2c5ea8'], h(8)), brim: '#101114', hatBadge: '#101114' };
            if (outfit === 'jetskier') return { ...base2, garment: female ? 'bikini' : 'shirtless', top: female ? '#2a67b5' : base.skin, pants: pickOf(['#d8413a', '#2a67b5', '#15253f'], h(7)), shorts: true, shoes: base.skin };
            return { ...base2, garment: pickOf(['tee', 'hoodie', 'jacket', 'tee'], h(7)), top: pickOf(['#4d7782', '#e24a3b', '#f2f1ec', '#2f3e57', '#e3c35a'], h(8)), pants: pickOf(['#23303f', '#1d2126', '#6e6553'], h(9)), shorts: h(10) < 0.3, footwear: 'sneaker', shoes: '#f0eee8', hatStyle: 'cap', hatColor: pickOf(['#3fa9a6', '#23272e', '#e24a3b'], h(11)) };
          }
          case 'beach': {
            // Palm Keys Beach (beach.js): swimwear, a shirt for strollers and staff.
            const female = !!p.female,
              kid = (p.scale || 1) < 0.8,
              onePiece = female && !p.shirt && h(5) < 0.35;
            return {
              outfit,
              kid,
              female,
              skin: p.skin,
              hair: p.hair,
              hairStyle: female ? pickOf([2, 3, 'hairPony', 4, 2], h(6)) : pickOf([1, 'hairBuzz', 4, 1, 0], h(6)),
              beard: female || kid ? 0 : h(7) < 0.25 ? 1 : 0,
              build: 1 + (h(3) - 0.5) * 0.3,
              heightAbsolute: kid ? p.scale : clamp(p.scale || 1, 0.92, 1.08),
              garment: p.shirt ? 'tee' : female ? (onePiece ? 'tank' : 'bikini') : 'shirtless',
              top: p.shirt || (female ? p.suit : p.skin),
              topPattern: p.shirt && p.kind === 'stroller' && h(8) < 0.4 ? PATTERN.floral : 0,
              pants: p.suit,
              pantsPattern: 0,
              shorts: true,
              sleevesStyle: 'short',
              shoes: p.kind === 'vendor' || p.kind === 'patron' ? '#8a6d4a' : p.skin,
              footwear: 'shoe',
              hat: p.kind === 'lifeguard' || h(9) < 0.12 ? 1 : 0,
              hatStyle: p.kind === 'lifeguard' ? 'cap' : h(9) < 0.12 ? 'sunhat' : null,
              hatColor: p.kind === 'lifeguard' ? '#d9302c' : '#e9dcc0',
            };
          }
          default: {
            const female = FEMALE_NAMES.test(p.name || '') || (p.name ? false : h(5) < 0.5);
            return {
              ...base,
              female,
              hairStyle: female ? pickOf([2, 3, 4], h(6)) : pickOf([1, 1, 4, 'hairBuzz'], h(6)),
              garment: female ? 'jacket' : 'jacket',
              top: p.color || '#6b5965',
              inner: '#e8e4dc',
              pants: female ? '#1d2126' : '#343b44',
              shoes: '#1e1a18',
            };
          }
        }
      }
      function specialLook(p) {
        const outfit = outfitOf(p);
        let entry = specialLooks.get(p);
        if (!entry || entry.outfit !== outfit || entry.color !== p.color) {
          const seed = entry?.seed ?? Math.random() * 1000;
          entry = { outfit, color: p.color, seed, look: outfitLook(p, outfit, seed) };
          specialLooks.set(p, entry);
        }
        return entry.look;
      }

      /**
       * JOINTS
       * Index into a person's joint array. Swings are about the body's lateral
       * axis (positive brings a limb forward), abductions lift an arm out to the
       * side, knees and elbows bend (knees negative, elbows positive).
       */
      const J_DROP = 0,
        J_LEAN = 1,
        J_TWIST = 2,
        J_ROLL = 3,
        J_HEAD_PITCH = 4,
        J_HEAD_YAW = 5,
        J_SH = [6, 9],
        J_AB = [7, 10],
        J_EL = [8, 11],
        J_HIP = [12, 14],
        J_KNEE = [13, 15],
        J_FALL = 16,
        J_SPREAD = 17,
        J_LOCO = 18,
        J_ARMFREE = [19, 20],
        J_HOLD = 21, // how far the hands are on a weapon (IK) rather than posed
        J_COUNT = 22;
      const crowdState = new WeakMap(),
        poseTarget = new Float32Array(J_COUNT);
      function stateFor(p) {
        let s = crowdState.get(p);
        if (!s) {
          s = {
            joints: new Float32Array(J_COUNT),
            x: p.x,
            y: p.y,
            yaw: p.a || 0,
            hipYaw: p.a || 0,
            moveYaw: p.a || 0,
            speed: 0,
            phase: Math.random() * TAU,
            turnPhase: 0,
            turning: false,
            seed: Math.random() * 100,
            seen: false,
            holdKind: null,
          };
          s.joints[J_ARMFREE[0]] = s.joints[J_ARMFREE[1]] = 1;
          crowdState.set(p, s);
        }
        return s;
      }
      function setArm(T, side, swing, abduct, elbow) {
        T[J_SH[side]] = swing;
        T[J_AB[side]] = abduct;
        T[J_EL[side]] = elbow;
      }
      /**
       * DANCING
       * Club dancers move to the club's musical clock (`mareaGroove`, beachclub-
       * audio.js): one cycle per beat, a style per person, bigger with the set's
       * energy, and the whole floor jumps with its hands up for a few seconds when
       * the drop lands. Anyone else dancing (the rooftop party, the yacht deck)
       * keeps a steady 120 BPM of their own.
       */
      function crowdDancePose(p, s, T, seed) {
        const club = !!p.club,
          g = mareaGroove,
          beat = club ? g.beat + ((seed * 0.37) % 0.12) - 0.06 : gameTime * 2 + (p.phase || seed),
          ph = beat * TAU,
          e = club ? Math.max(0.2, g.energy) : 0.7,
          on = Math.max(0, Math.cos(ph)),
          half = Math.sin(ph / 2);
        let style = (p.danceStyle ?? Math.floor(seed)) % 7;
        // In a breakdown most people drop to a sway; after the drop, everyone jumps.
        if (club && g.section === 'break' && seed % 3 > 1) style = 3;
        const jump = club && gameTime - g.dropAt < 4 && (seed % 5 > 0.8 || gameTime - g.dropAt < 1.5);
        T[J_LOCO] = 0;
        T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
        // A bounce under everything: knees give on the beat.
        T[J_DROP] = -on * 0.45 * e;
        T[J_KNEE[0]] = T[J_KNEE[1]] = -0.12 - on * 0.4 * e;
        T[J_HIP[0]] = T[J_HIP[1]] = 0.06 + on * 0.2 * e;
        T[J_HEAD_PITCH] = 0.1 * on * e;
        if (jump) {
          const up = Math.max(0, Math.sin(ph));
          T[J_DROP] = up * 2.1 - on * 0.4;
          T[J_KNEE[0]] = T[J_KNEE[1]] = -0.2 - up * 0.5;
          setArm(T, 0, 2.85, 0.35 + up * 0.2, 0.2);
          setArm(T, 1, 2.85, 0.35 + up * 0.2, 0.2);
          T[J_HEAD_PITCH] = -0.3;
          return;
        }
        switch (style) {
          case 0: // bounce with forearms pumping
            setArm(T, 0, 0.55 + on * 0.25 * e, 0.3, 1.45 + on * 0.3);
            setArm(T, 1, 0.55 + on * 0.25 * e, 0.3, 1.45 + on * 0.3);
            break;
          case 1: // fist pump
            setArm(T, 1, 2.35 + Math.sin(ph) * 0.35 * e, 0.2, 0.35 + on * 0.6);
            setArm(T, 0, 0.3, 0.3, 1.3);
            T[J_LEAN] = -0.08;
            break;
          case 2: // hands up, swaying at half time
            setArm(T, 0, 2.7, 0.45 + half * 0.25, 0.35);
            setArm(T, 1, 2.7, 0.45 - half * 0.25, 0.35);
            T[J_ROLL] = half * 0.08;
            T[J_HEAD_PITCH] = -0.2;
            break;
          case 3: // hip sway, loose arms
            T[J_ROLL] = half * 0.1;
            T[J_TWIST] = half * 0.22;
            T[J_HIP[0]] = 0.1 + half * 0.2;
            T[J_HIP[1]] = 0.1 - half * 0.2;
            setArm(T, 0, 0.45 + half * 0.35, 0.35, 1.3);
            setArm(T, 1, 0.45 - half * 0.35, 0.35, 1.3);
            break;
          case 4: {
            // two-step: a step to each side on alternate beats
            const side = Math.floor(beat) % 2,
              lift = Math.max(0, Math.sin(ph)) * e;
            T[J_HIP[side]] = 0.15 + lift * 0.6;
            T[J_KNEE[side]] = -0.2 - lift * 1.0;
            T[J_ROLL] = (side ? 1 : -1) * 0.06;
            setArm(T, 0, 0.4 + (side ? 0.5 : -0.1), 0.35, 1.2);
            setArm(T, 1, 0.4 + (side ? -0.1 : 0.5), 0.35, 1.2);
            break;
          }
          case 5: // waving arms overhead, side to side
            setArm(T, 0, 2.35, 0.95 + half * 0.5, 0.55);
            setArm(T, 1, 2.35, 0.95 - half * 0.5, 0.55);
            T[J_ROLL] = half * 0.12;
            break;
          default: {
            // shuffle: quick alternating heel steps on the eighths
            const q = Math.sin(ph * 2);
            T[J_HIP[0]] = 0.1 + Math.max(0, q) * 0.55 * e;
            T[J_HIP[1]] = 0.1 + Math.max(0, -q) * 0.55 * e;
            T[J_KNEE[0]] = -0.15 - Math.max(0, q) * 0.9 * e;
            T[J_KNEE[1]] = -0.15 - Math.max(0, -q) * 0.9 * e;
            setArm(T, 0, 0.6 - q * 0.5, 0.25, 1.6);
            setArm(T, 1, 0.6 + q * 0.5, 0.25, 1.6);
            T[J_LEAN] = -0.1;
            break;
          }
        }
      }
      /* Base pose targets. `side` 0 is left, 1 is right. */
      function crowdPoseTargets(p, s, T, t, spec, R) {
        T.fill(0);
        const seed = s.seed,
          stoop = p.look?.stoop || 0;
        T[J_LEAN] = -stoop;
        T[J_HEAD_PITCH] = stoop * 0.6;
        setArm(T, 0, 0.02, 0.12, 0.16);
        setArm(T, 1, 0.02, 0.12, 0.16);
        T[J_KNEE[0]] = T[J_KNEE[1]] = -0.04;
        T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 1;
        T[J_LOCO] = 1;
        // Idle life: weight shifts and the odd look around.
        const sway = Math.sin(t * 0.55 + seed);
        T[J_ROLL] = sway * 0.025;
        T[J_HIP[0]] = sway * 0.04;
        T[J_HIP[1]] = -sway * 0.04;
        T[J_KNEE[sway > 0 ? 1 : 0]] = -0.04 - Math.abs(sway) * 0.1;
        T[J_HEAD_YAW] = Math.sin(t * 0.31 + seed * 2) * Math.max(0, Math.sin(t * 0.13 + seed)) * 0.7;
        if (p.hp <= 0) {
          T[J_LOCO] = 0;
          T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
          T[J_HEAD_YAW] = 0;
          const k = seed % 1;
          if (p.deathStyle?.slump) {
            // Slid down a wall: sitting, legs out, head dropped, arms slack.
            T[J_FALL] = 0;
            T[J_DROP] = -5.2;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.45;
            T[J_KNEE[0]] = -0.25 - k * 0.5;
            T[J_KNEE[1]] = -0.1;
            T[J_SPREAD] = 0.3;
            T[J_LEAN] = 0.35;
            T[J_ROLL] = (k - 0.5) * 0.4;
            T[J_HEAD_PITCH] = 0.75;
            setArm(T, 0, 0.15, 0.4, 0.2);
            setArm(T, 1, 0.3, 0.2 + k * 0.4, 0.4);
            return;
          }
          T[J_FALL] = 1;
          if ((p.deathStyle?.sign ?? 1) < 0) {
            // Face down: arms thrown forward, one leg drawn up.
            setArm(T, 0, 2.6 - k * 0.6, 0.5, 0.3);
            setArm(T, 1, 1.6 + k * 0.8, 0.9, 0.6);
            T[J_HIP[1]] = 0.7 * k;
            T[J_KNEE[1]] = -1.1 * k;
          } else {
            // On the back: arms flung, a knee bent, the head rolled aside.
            setArm(T, 0, 0.4, 1.1 + k * 0.6, 0.3);
            setArm(T, 1, -0.2, 0.3 + k, 0.6);
            T[J_HIP[0]] = 0.3 * k;
            T[J_KNEE[0]] = -0.7 * k;
            T[J_KNEE[1]] = -0.5 * k;
          }
          T[J_SPREAD] = 0.25;
          T[J_HEAD_YAW] = (k - 0.5) * 1.2;
          return;
        }
        let pose = spec?.pose || p.pose;
        if (p.ejected) pose = 'thrown';
        else if (p.exercise != null) pose = 'exercise';
        else if (p.dancing) pose = 'dance';
        else if (p.onPhone && !pose) pose = 'phone';
        else if (p.sitting && !pose) pose = 'sit';
        if (p.glanceUntil > gameTime) T[J_HEAD_YAW] = Math.sin((p.glanceUntil - gameTime) * 7) * 0.8;
        // Carried things decide what the right arm does while walking.
        const carry = p.carry;
        if (carry === 'briefcase' || carry === 'shopping' || carry === 'handbag') {
          setArm(T, 1, 0, 0.14, 0.08);
          T[J_ARMFREE[1]] = 0.35;
        } else if (carry === 'coffee' || carry === 'food') {
          setArm(T, 1, 0.35, 0.15, 1.55);
          T[J_ARMFREE[1]] = 0.1;
        } else if (carry === 'camera') {
          setArm(T, 1, 0.3, 0.1, 1.2);
          T[J_ARMFREE[1]] = 0.2;
        }
        if (s.umbrella) {
          setArm(T, 1, 0.75, 0.05, 1.7);
          T[J_ARMFREE[1]] = 0;
        }
        const shake = (amount) => Math.sin(t * 31 + seed) * amount;
        switch (pose) {
          case 'run':
            T[J_LEAN] = -0.2 - stoop;
            setArm(T, 0, 0.1, 0.12, 1.4);
            setArm(T, 1, 0.1, 0.12, 1.4);
            T[J_HEAD_PITCH] = 0.1;
            break;
          case 'limp':
            T[J_ROLL] = 0.08;
            setArm(T, 1, 0.45, 0.25, 1.7);
            T[J_ARMFREE[1]] = 0;
            T[J_LEAN] = -0.18;
            break;
          case 'text':
            T[J_HEAD_PITCH] = 0.45;
            setArm(T, 0, 0.55, -0.12, 1.55);
            setArm(T, 1, 0.6, -0.15, 1.5);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'phone':
            setArm(T, 1, 0.75, 0.55, 2.55);
            T[J_ARMFREE[1]] = 0;
            T[J_HEAD_YAW] = 0.15 + Math.sin(t * 0.7 + seed) * 0.2;
            T[J_HEAD_PITCH] = 0.1;
            setArm(T, 0, -0.1, 0.45, 1.3);
            break;
          case 'film':
            // Phone held up in both hands at eye height, filming.
            setArm(T, 0, 1.3, -0.25, 0.45);
            setArm(T, 1, 1.35, -0.2, 0.35);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_PITCH] = 0.05;
            T[J_LEAN] = 0.05;
            break;
          case 'cower':
            T[J_LOCO] = 0;
            T[J_DROP] = -3.1;
            T[J_LEAN] = -0.9 + shake(0.03);
            T[J_HIP[0]] = T[J_HIP[1]] = 1.45;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -2.3;
            T[J_SPREAD] = 0.18;
            setArm(T, 0, 2.55, 0.55, 2.2);
            setArm(T, 1, 2.55, 0.55, 2.2);
            T[J_HEAD_PITCH] = 0.55;
            T[J_HEAD_YAW] = 0;
            break;
          case 'freeze':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.06 + shake(0.02);
            setArm(T, 0, 0.55, 0.3, 1.35);
            setArm(T, 1, 0.55, 0.3, 1.35);
            T[J_HEAD_YAW] = 0;
            break;
          case 'handsUp':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.05 + shake(0.012);
            setArm(T, 0, 2.8, 0.5, 0.3);
            setArm(T, 1, 2.8, 0.5, 0.3);
            T[J_HEAD_PITCH] = -0.12;
            T[J_HEAD_YAW] = 0;
            break;
          case 'kneel':
            T[J_LOCO] = 0;
            T[J_DROP] = -3.05;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.05;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.5;
            T[J_SPREAD] = 0.12;
            T[J_LEAN] = -0.08 + Math.sin(t * 3.2) * 0.05;
            setArm(T, 0, 1.15, -0.5, 1.95);
            setArm(T, 1, 1.15, -0.5, 1.95);
            T[J_HEAD_PITCH] = 0.2;
            T[J_HEAD_YAW] = 0;
            break;
          case 'startle':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.14;
            setArm(T, 0, 0.7, 0.55, 1.3);
            setArm(T, 1, 0.7, 0.55, 1.3);
            T[J_HEAD_PITCH] = -0.12;
            T[J_HEAD_YAW] = 0;
            break;
          case 'gasp':
            T[J_LEAN] = 0.1;
            setArm(T, 0, 1.25, -0.4, 2.35);
            setArm(T, 1, 1.25, -0.4, 2.35);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_YAW] = 0;
            break;
          case 'despair':
            T[J_LOCO] = 0;
            setArm(T, 0, 2.25, 0.85, 2.3);
            setArm(T, 1, 2.25, 0.85, 2.3);
            T[J_HEAD_PITCH] = 0.25;
            break;
          case 'watch':
          case 'arms':
            if (pose === 'arms' || seed % 3 < 1.6) {
              setArm(T, 0, 0.8, -0.4, 1.95);
              setArm(T, 1, 0.75, -0.35, 1.9);
            } else {
              setArm(T, 0, -0.25, 0.75, 1.45);
              setArm(T, 1, -0.25, 0.75, 1.45);
            }
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.2;
            if (pose === 'arms') T[J_HEAD_YAW] *= 0.4;
            break;
          case 'shout':
            T[J_LOCO] = 0;
            T[J_LEAN] = -0.1 + Math.sin(t * 9) * 0.04;
            setArm(T, 0, 0.9, 0.65, 0.5 + Math.sin(t * 9) * 0.2);
            setArm(T, 1, 0.9, 0.65, 0.5 - Math.sin(t * 9) * 0.2);
            T[J_HEAD_PITCH] = -0.15;
            T[J_HEAD_YAW] = 0;
            break;
          case 'fist':
            T[J_LOCO] = 0;
            T[J_LEAN] = -0.1;
            setArm(T, 1, 2.45 + Math.sin(t * 15) * 0.25, 0.25, 1.25 + Math.sin(t * 15) * 0.35);
            setArm(T, 0, 0.25, 0.3, 0.6);
            T[J_HEAD_YAW] = 0;
            break;
          case 'point':
            T[J_LOCO] = 0;
            setArm(T, 1, 1.52, 0.12, 0.03);
            setArm(T, 0, 0.05, 0.12, 0.2);
            T[J_HEAD_YAW] = 0;
            break;
          case 'dodge':
            T[J_LOCO] = 0;
            T[J_ROLL] = 0.35;
            T[J_LEAN] = 0.2;
            setArm(T, 0, 1.3, 1.2, 0.6);
            setArm(T, 1, 1.5, 1.1, 0.5);
            T[J_HIP[0]] = 0.9;
            T[J_KNEE[0]] = -1.2;
            break;
          case 'sit':
            T[J_LOCO] = 0;
            T[J_DROP] = -2.65;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.35;
            T[J_SPREAD] = 0.06;
            T[J_LEAN] = 0.05;
            setArm(T, 0, 0.5, 0.05, 0.95);
            setArm(T, 1, 0.5, 0.05, 0.95);
            if (p.sipping) setArm(T, 1, 1.0, 0.25, 2.45);
            else if (carry === 'coffee') setArm(T, 1, 0.75, 0.1, 1.5);
            break;
          case 'crawl': {
            // Prone, hauling themselves along on alternate elbows, legs dragging.
            const c = Math.sin(t * 5 + seed);
            T[J_LOCO] = 0;
            T[J_FALL] = 1;
            setArm(T, 0, 2.5 + c * 0.45, 0.35, 1.2 - c * 0.5);
            setArm(T, 1, 2.5 - c * 0.45, 0.35, 1.2 + c * 0.5);
            T[J_HIP[0]] = 0.15 + Math.max(0, c) * 0.45;
            T[J_KNEE[0]] = -0.3 - Math.max(0, c) * 0.9;
            T[J_HIP[1]] = 0.05;
            T[J_KNEE[1]] = -0.15;
            T[J_ROLL] = c * 0.1;
            T[J_HEAD_PITCH] = -0.5;
            break;
          }
          case 'lie':
            T[J_LOCO] = 0;
            T[J_FALL] = 1;
            T[J_HIP[1]] = 0.9 + Math.sin(t * 1.3 + seed) * 0.15;
            T[J_KNEE[1]] = -1.6;
            setArm(T, 1, 1.0, 0.1, 1.6);
            setArm(T, 0, 0.3 + Math.sin(t * 0.9) * 0.2, 0.7, 0.8);
            T[J_ROLL] = Math.sin(t * 1.1 + seed) * 0.08;
            break;
          case 'help':
            T[J_LOCO] = 0;
            T[J_DROP] = -2.95;
            T[J_HIP[0]] = 1.5;
            T[J_KNEE[0]] = -1.6;
            T[J_HIP[1]] = 0.05;
            T[J_KNEE[1]] = -1.5;
            T[J_LEAN] = -0.5;
            setArm(T, 0, 1.0, 0.1, 0.5 + Math.sin(t * 2) * 0.2);
            setArm(T, 1, 1.1, 0.1, 0.4);
            T[J_HEAD_PITCH] = 0.4;
            break;
          case 'serve': {
            const gesture = Math.sin(t * 0.8 + seed) > 0.6;
            setArm(T, 0, 0.75, 0.1, 0.8);
            setArm(T, 1, gesture ? 1.3 : 0.75, 0.15, gesture ? 0.4 : 0.8);
            T[J_LEAN] = -0.08;
            break;
          }
          case 'strum':
            T[J_LOCO] = 0;
            setArm(T, 0, 1.0, 0.95, 0.95);
            setArm(T, 1, 0.75, -0.5, 1.45 + Math.sin(t * 9.5) * 0.25);
            T[J_HEAD_PITCH] = 0.2 + Math.sin(t * 4.2) * 0.06;
            T[J_ROLL] = Math.sin(t * 2.1) * 0.04;
            s.guitar = true;
            break;
          case 'clap':
            setArm(T, 0, 1.2, -0.3 + Math.sin(t * 14) * 0.22, 1.35);
            setArm(T, 1, 1.2, -0.3 + Math.sin(t * 14) * 0.22, 1.35);
            break;
          case 'smoke': {
            const drag = (t + seed) % 5.5 < 1.3;
            setArm(T, 1, drag ? 1.0 : 0.45, drag ? 0.3 : 0.2, drag ? 2.55 : 1.85);
            setArm(T, 0, 0.35, -0.35, 1.45);
            T[J_HEAD_PITCH] = drag ? -0.1 : 0;
            s.ember = true;
            break;
          }
          case 'sway':
            T[J_ROLL] = Math.sin(t * 2.2 + seed) * 0.06;
            T[J_DROP] = -Math.abs(Math.sin(t * 2.2 + seed)) * 0.2;
            if (seed % 2 < 1) setArm(T, 1, -0.2, 0.7, 1.4);
            break;
          case 'wave':
            T[J_LOCO] = 0;
            setArm(T, 1, 2.85, 0.35 + Math.sin(t * 8) * 0.25, 0.3);
            T[J_LEAN] = 0.04;
            break;
          case 'carry':
            setArm(T, 0, 1.0, -0.12, 1.1);
            setArm(T, 1, 1.0, -0.12, 1.1);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_LEAN] = 0.04;
            break;
          case 'leash':
            setArm(T, 1, 0.55, 0.15, 0.45);
            T[J_ARMFREE[1]] = 0.1;
            break;
          case 'chat': {
            const talk = Math.sin(t * 1.7 + seed);
            setArm(T, 1, 0.55 + talk * 0.35, 0.2, 1.4 + Math.sin(t * 3.1) * 0.3);
            setArm(T, 0, -0.2, 0.7, 1.4);
            T[J_HEAD_PITCH] = Math.sin(t * 3 + seed) * 0.07;
            break;
          }
          case 'wait':
            T[J_HEAD_YAW] = Math.sin(t * 0.9 + seed) * 0.5;
            break;
          case 'thrown':
            T[J_LOCO] = 0;
            setArm(T, 0, 2.3, 0.6, 0.3);
            setArm(T, 1, 1.4, 0.6, 0.3);
            T[J_HIP[0]] = 0.7;
            T[J_HIP[1]] = -0.5;
            break;
          case 'dance':
            crowdDancePose(p, s, T, seed);
            break;
          case 'swim': {
            // Treading water: arms sculling at the surface, a slow kick.
            T[J_LOCO] = 0;
            const scull = Math.sin(t * 2.6 + seed);
            setArm(T, 0, 1.35, 0.75 + scull * 0.35, 0.35);
            setArm(T, 1, 1.35, 0.75 - scull * 0.35, 0.35);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HIP[0]] = 0.35 + Math.sin(t * 3.1 + seed) * 0.3;
            T[J_HIP[1]] = 0.35 - Math.sin(t * 3.1 + seed) * 0.3;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.6;
            T[J_LEAN] = 0.15;
            T[J_HEAD_PITCH] = -0.2;
            break;
          }
          case 'lounge': {
            // Stretched out on a daybed: one arm behind the head, a knee up.
            T[J_LOCO] = 0;
            T[J_FALL] = 0.94;
            T[J_HEAD_PITCH] = -0.35;
            T[J_HEAD_YAW] = Math.sin(t * 0.2 + seed) * 0.3;
            const knee = seed % 2 < 1,
              both = seed % 3 < 1.5;
            T[J_HIP[knee ? 0 : 1]] = 0.75;
            T[J_KNEE[knee ? 0 : 1]] = -1.5;
            setArm(T, 0, 2.7, 0.7, 2.3);
            setArm(T, 1, both ? 2.7 : 0.35, both ? 0.7 : 0.35, both ? 2.3 : 0.6);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          }
          case 'dj': {
            // Hands on the decks, head nodding on the beat; a hand to the
            // headphones now and then, a fist in the air on the drop.
            const g = mareaGroove,
              ph = g.beat * TAU,
              bar = Math.floor(g.beat / 4);
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.22;
            T[J_HEAD_PITCH] = 0.25 + Math.max(0, Math.cos(ph)) * 0.25;
            T[J_DROP] = -Math.max(0, Math.cos(ph)) * 0.3;
            setArm(T, 0, 0.95, 0.15, 1.1 + Math.sin(t * 1.3) * 0.2);
            setArm(T, 1, 0.95, 0.15, 1.1 + Math.sin(t * 1.7 + 1) * 0.2);
            if (bar % 4 === 1) setArm(T, 1, 0.75, 0.55, 2.55);
            if (gameTime - g.dropAt < 3 || (g.section === 'drop' && bar % 8 === 0)) setArm(T, 0, 2.75 + Math.sin(ph) * 0.2, 0.2, 0.3);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          }
          case 'bartend': {
            // Shaking a cocktail at chest height, then pouring.
            const pour = (t + seed) % 9 > 6.5;
            setArm(T, 1, pour ? 1.3 : 1.0 + Math.sin(t * 19) * 0.22, pour ? 0.3 : 0.25, pour ? 0.6 : 1.9);
            setArm(T, 0, pour ? 0.9 : 1.0 + Math.sin(t * 19) * 0.22, pour ? 0.1 : 0.25, pour ? 1.3 : 1.9);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_PITCH] = pour ? 0.3 : 0.05;
            break;
          }
          case 'tray':
            // A waiter's tray held flat at the shoulder; the other arm swings.
            setArm(T, 1, 0.3, 0.7, 2.25);
            T[J_ARMFREE[1]] = 0;
            break;
          case 'drink':
            setArm(T, 1, p.sipping || spec?.sip ? 1.0 : 0.45, 0.2, p.sipping || spec?.sip ? 2.45 : 1.55);
            T[J_ARMFREE[1]] = 0.1;
            if (seed % 2 < 1) setArm(T, 0, -0.15, 0.55, 1.35);
            T[J_ROLL] = Math.sin(mareaGroove.beat * Math.PI + seed) * 0.03;
            break;
          case 'sparkler':
            setArm(T, 1, 2.75, 0.3, 0.35);
            setArm(T, 0, 0.4, 0.2, 1.2);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_PITCH] = -0.15;
            break;
          case 'sweep': {
            const stroke = Math.sin(t * 2.2 + seed);
            setArm(T, 1, 0.8 + stroke * 0.3, -0.25, 0.6);
            setArm(T, 0, 1.1 + stroke * 0.3, -0.35, 1.1);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_LEAN] = 0.2;
            T[J_TWIST] = stroke * 0.15;
            break;
          }
          case 'stop':
            // The bouncer's flat palm: nobody in.
            T[J_LOCO] = 0;
            setArm(T, 1, 1.5, 0.05, 0.1);
            setArm(T, 0, -0.1, 0.6, 1.5);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_YAW] = 0;
            break;
          case 'shove':
            T[J_LOCO] = 0;
            T[J_LEAN] = 0.25;
            setArm(T, 0, 1.5, 0.1, 0.05);
            setArm(T, 1, 1.5, 0.1, 0.05);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'exercise': {
            const e = p.exercise;
            T[J_LOCO] = 0;
            if (p.exerciseKind === 'mat') {
              T[J_DROP] = -5.4;
              T[J_HIP[0]] = T[J_HIP[1]] = 1.3;
              T[J_LEAN] = -0.15 - e * 0.85;
              setArm(T, 0, 2.4, 0.2, 1.8);
              setArm(T, 1, 2.4, 0.2, 1.8);
            } else if (p.exerciseKind === 'dip' || p.exerciseKind === 'bars') {
              // Hands on the bars: the drop keeps them at the bars' height.
              T[J_DROP] = 4.75 + e * 5;
              setArm(T, 0, -0.12, 0.3, 0.1);
              setArm(T, 1, -0.12, 0.3, 0.1);
              T[J_HIP[0]] = 0.5;
              T[J_HIP[1]] = 0.34;
            } else {
              // Hanging from the pull-up bar (hands at its height).
              T[J_DROP] = 9.5 + e * 6;
              setArm(T, 0, 2.75 - e * 0.45, 0.35, 0.2 + e * 0.9);
              setArm(T, 1, 2.75 - e * 0.45, 0.35, 0.2 + e * 0.9);
              T[J_HIP[0]] = 0.35;
              T[J_KNEE[0]] = T[J_KNEE[1]] = -0.5;
            }
            break;
          }
          // ---- The player and officers (specialSpec) ----
          case 'exitCar': {
            // Rising out of the driver's seat: from a crouch with a hand up on the
            // door frame to standing (spec.transition 0 → 1).
            const k = 1 - (spec?.transition ?? 1);
            T[J_LOCO] = 1 - k;
            T[J_DROP] = -3.1 * k;
            T[J_HIP[0]] = 1.2 * k;
            T[J_HIP[1]] = 0.7 * k;
            T[J_KNEE[0]] = -1.9 * k;
            T[J_KNEE[1]] = -1.2 * k;
            T[J_LEAN] = -0.45 * k;
            setArm(T, 0, 0.9 + 1.1 * k, 0.6 * k + 0.1, 0.6 + 0.6 * k);
            T[J_HEAD_PITCH] = 0.3 * k;
            break;
          }
          case 'enterCar': {
            // Ducking into the seat (spec.transition 0 → 1).
            const k = spec?.transition ?? 0;
            T[J_LOCO] = 0;
            T[J_DROP] = -3.2 * k;
            T[J_HIP[0]] = 1.3 * k;
            T[J_HIP[1]] = 0.5 * k;
            T[J_KNEE[0]] = -1.8 * k;
            T[J_KNEE[1]] = -1.0 * k;
            T[J_LEAN] = -0.55 * k;
            setArm(T, 0, 1.2 + 0.9 * k, 0.5, 0.7);
            setArm(T, 1, 0.7, 0.3, 1.0);
            T[J_HEAD_PITCH] = 0.4 * k;
            break;
          }
          case 'riding':
            // On a bicycle, motorbike or jet ski (RIDERS): seated, leaning to the bars.
            T[J_LOCO] = 0;
            T[J_LEAN] = spec?.riderLean ?? -0.3;
            T[J_HEAD_PITCH] = -0.2;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_ROLL] = 0;
            break;
          // ---- The beach (beach.js poses) ----
          case 'sitGround':
          case 'ride':
            // On the sand (or a pedalo seat): legs out in front, leaning back on the hands.
            T[J_LOCO] = 0;
            T[J_DROP] = -6.3;
            T[J_HIP[0]] = 1.45;
            T[J_HIP[1]] = 1.3;
            T[J_KNEE[0]] = -0.35;
            T[J_KNEE[1]] = -0.9;
            T[J_SPREAD] = 0.1;
            T[J_LEAN] = pose === 'ride' ? -0.1 : 0.22;
            if (pose === 'ride') {
              setArm(T, 0, 1.25, 0.1, 0.3);
              setArm(T, 1, 1.25, 0.1, 0.3);
            } else {
              setArm(T, 0, -0.5, 0.35, 0.1);
              setArm(T, 1, seed % 2 < 1 ? -0.5 : 0.9 + Math.sin(t * 0.3) * 0.1, 0.35, seed % 2 < 1 ? 0.1 : 1.3);
            }
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'recline':
            // On a lounger: back raised, legs out.
            T[J_LOCO] = 0;
            T[J_DROP] = -6.4;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.5;
            T[J_KNEE[0]] = -0.1;
            T[J_KNEE[1]] = -0.35;
            T[J_LEAN] = 0.95;
            T[J_HEAD_PITCH] = 0.5;
            setArm(T, 0, seed % 2 < 1 ? 2.7 : 0.1, 0.5, seed % 2 < 1 ? 2.3 : 0.2);
            setArm(T, 1, seed % 2 < 1 ? 2.7 : 0.1, 0.5, seed % 2 < 1 ? 2.3 : 0.2);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'kneelDig':
            // A child building in the sand: kneeling, hands scooping in turn.
            T[J_LOCO] = 0;
            T[J_DROP] = -3.05;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.2;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.9;
            T[J_SPREAD] = 0.15;
            T[J_LEAN] = -0.45;
            setArm(T, 0, 0.9 + Math.sin(t * 5) * 0.5, 0.15, 0.4);
            setArm(T, 1, 0.9 + Math.sin(t * 5 + 1.6) * 0.5, 0.15, 0.4);
            T[J_HEAD_PITCH] = 0.4;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'lieBack':
            // Sunbathing on the back: hands behind the head for some, a knee up for others.
            T[J_LOCO] = 0;
            T[J_FALL] = 1;
            if ((p.threshold ?? seed % 1) > 0.5) {
              setArm(T, 0, 2.75, 0.6, 2.4);
              setArm(T, 1, 2.75, 0.6, 2.4);
            } else {
              setArm(T, 0, 0.1, 0.25, 0.1);
              setArm(T, 1, 0.1, 0.25, 0.1);
            }
            if ((p.threshold ?? 0) > 0.75) {
              T[J_HIP[1]] = 0.8;
              T[J_KNEE[1]] = -1.5;
            }
            T[J_SPREAD] = 0.08;
            T[J_HEAD_PITCH] = -0.1;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'lieFront':
            // On the front, head on the folded arms.
            T[J_LOCO] = 0;
            T[J_FALL] = 1;
            setArm(T, 0, 2.7, 0.55, 2.2);
            setArm(T, 1, 2.7, 0.55, 2.2);
            T[J_SPREAD] = 0.1;
            T[J_HEAD_PITCH] = -0.3;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'wade':
            // In the shallows: arms held out of the water.
            T[J_AB[0]] = T[J_AB[1]] = 0.42 + Math.sin(t * 0.8 + seed) * 0.08;
            T[J_EL[0]] = T[J_EL[1]] = 0.5;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.4;
            break;
          case 'vbReady':
            // Volleyball (beachvolley.js): the ready crouch, forearms out.
            T[J_LOCO] = 0.6;
            T[J_DROP] = -0.9;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.9;
            T[J_SPREAD] = 0.16;
            T[J_LEAN] = -0.35;
            setArm(T, 0, 0.75, 0.25, 0.9);
            setArm(T, 1, 0.75, 0.25, 0.9);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0.2;
            break;
          case 'vbBump':
            // Forearm pass: arms straight and together, platform out in front.
            T[J_LOCO] = 0.4;
            T[J_DROP] = -1.3;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.7;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.2;
            T[J_SPREAD] = 0.18;
            T[J_LEAN] = -0.35;
            setArm(T, 0, 1.05, -0.28, 0.05);
            setArm(T, 1, 1.05, -0.28, 0.05);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbDig':
            // A dive for the ball: a long lunge, arms reaching low.
            T[J_LOCO] = 0;
            T[J_DROP] = -3.0;
            T[J_HIP[0]] = 1.3;
            T[J_KNEE[0]] = -1.5;
            T[J_HIP[1]] = -0.5;
            T[J_KNEE[1]] = -0.4;
            T[J_LEAN] = -0.7;
            setArm(T, 0, 1.2, -0.2, 0.05);
            setArm(T, 1, 1.2, -0.2, 0.05);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbSet':
            // Hands up over the forehead.
            T[J_LOCO] = 0.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -0.3;
            T[J_DROP] = -0.25;
            setArm(T, 0, 2.55, 0.35, 1.2);
            setArm(T, 1, 2.55, 0.35, 1.2);
            T[J_HEAD_PITCH] = -0.45;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbSpike':
            // In the air: the hitting arm cocked high, the other reaching.
            T[J_LOCO] = 0;
            T[J_HIP[0]] = T[J_HIP[1]] = 0.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.1;
            T[J_LEAN] = 0.12;
            setArm(T, 1, 3.0 + Math.sin(t * 9) * 0.3, 0.2, 0.6);
            setArm(T, 0, 2.2, 0.2, 0.3);
            T[J_HEAD_PITCH] = -0.35;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbServe':
            T[J_LOCO] = 0.3;
            setArm(T, 0, 2.4, 0.1, 0.2);
            setArm(T, 1, 2.9, 0.3, 1.2);
            T[J_LEAN] = 0.08;
            T[J_HIP[0]] = 0.25;
            T[J_HEAD_PITCH] = -0.4;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'vbHit':
          case 'cheer':
            // Arms up: a block at the net, or celebrating a point.
            T[J_LOCO] = pose === 'cheer' ? 0 : 0.3;
            setArm(T, 0, 2.8 + (pose === 'cheer' ? Math.sin(t * 8) * 0.15 : 0), pose === 'cheer' ? 0.55 : 0.12, 0.2);
            setArm(T, 1, 2.8 + (pose === 'cheer' ? Math.sin(t * 8 + 1) * 0.15 : 0), pose === 'cheer' ? 0.55 : 0.12, 0.2);
            T[J_HEAD_PITCH] = -0.3;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'throw':
            T[J_LOCO] = 0;
            setArm(T, 1, 1.5, 0.1, 0.2);
            setArm(T, 0, -0.4, 0.2, 0.3);
            T[J_LEAN] = -0.1;
            T[J_TWIST] = -0.3;
            T[J_HIP[0]] = 0.3;
            T[J_HIP[1]] = -0.2;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'tumble':
            T[J_LOCO] = 0;
            setArm(T, 0, 2.1, 0.8, 0.6);
            setArm(T, 1, 1.7, 0.9, 0.9);
            T[J_HIP[0]] = -0.4;
            T[J_HIP[1]] = 0.7;
            T[J_KNEE[0]] = -0.6;
            T[J_KNEE[1]] = -1.3;
            T[J_SPREAD] = 0.3;
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          default:
            break;
        }
        if (p.illness) {
          T[J_LEAN] -= p.illness * 0.3;
          setArm(T, 0, 0.85, 0.2, 1.2);
        }
        if (spec?.dazed) T[J_ROLL] += Math.sin(gameTime * 8) * 0.06;
        // Weapon stances turn the upper body: blading for a shouldered long gun,
        // square for a pistol, a lean into the aim.
        const hold = spec?.hold;
        if (hold?.inHand) {
          // The firing arm hangs a little forward and less free.
          T[J_ARMFREE[1]] = 0.55;
          T[J_SH[1]] = Math.max(T[J_SH[1]], 0.08);
          T[J_EL[1]] = Math.max(T[J_EL[1]], 0.3);
        } else if (hold) {
          T[J_HOLD] = 1;
          T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
          T[J_TWIST] += hold.twist || 0;
          T[J_LEAN] += hold.lean || 0;
          T[J_HEAD_PITCH] += hold.headPitch || 0;
          T[J_HEAD_YAW] = hold.headYaw || 0;
          if (hold.aiming) T[J_ROLL] *= 0.3;
        }
        // A fresh hit (wounds.js): the torso snaps away from the round, a head
        // hit throws the head back, a leg hit buckles that knee.
        const flinch = hitFlinch(p);
        if (flinch > 0) {
          const rel = normalizeAngle((p.hitDir || 0) - (p.a || 0)),
            along = Math.cos(rel),
            across = Math.sin(rel);
          T[J_LEAN] += -along * 0.5 * flinch;
          T[J_ROLL] += across * 0.3 * flinch;
          if (p.hitZone === 'head') T[J_HEAD_PITCH] -= 0.8 * flinch;
          else if (p.hitZone === 'leg') {
            const side = across > 0 ? 1 : 0;
            T[J_DROP] -= 1.1 * flinch;
            T[J_KNEE[side]] -= 1.1 * flinch;
          } else if (!hold) {
            setArm(T, 0, 0.9 * flinch, 0.5, 1.6 * flinch);
            setArm(T, 1, 0.9 * flinch, 0.5, 1.6 * flinch);
          }
        }
        const fall = p.poisonCollapse ?? personFallAmount(p);
        if (fall > 0) {
          T[J_FALL] = Math.max(T[J_FALL], fall);
          T[J_LOCO] = 0;
        }
      }

      /**
       * IK
       * Two-bone limbs placed in the world: `ikArm` puts an upper arm, forearm and
       * hand so the wrist reaches `target` with the elbow towards `pole`.
       */
      const ikS = new Three.Vector3(),
        ikT = new Three.Vector3(),
        ikE = new Three.Vector3(),
        ikDir = new Three.Vector3(),
        ikPole = new Three.Vector3(),
        ikX = new Three.Vector3(),
        ikY = new Three.Vector3(),
        ikZ = new Three.Vector3();
      function boneMatrix(out, origin, x, y, z, scale) {
        out.set(x.x * scale, y.x * scale, z.x * scale, origin.x, x.y * scale, y.y * scale, z.y * scale, origin.y, x.z * scale, y.z * scale, z.z * scale, origin.z, 0, 0, 0, 1);
        return out;
      }
      function ikArm(upper, lower, hand, shoulder, target, pole, L1, L2, scale) {
        ikS.copy(shoulder);
        ikDir.subVectors(target, ikS);
        let d = ikDir.length();
        const reach = (L1 + L2) * 0.998;
        if (d < 1e-4) ikDir.set(1, 0, 0), (d = 1e-4);
        ikDir.divideScalar(d);
        d = clamp(d, Math.abs(L1 - L2) + 0.05, reach);
        ikT.copy(ikS).addScaledVector(ikDir, d);
        const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d),
          hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a));
        ikPole.copy(pole).addScaledVector(ikDir, -pole.dot(ikDir));
        if (ikPole.lengthSq() < 1e-6) ikPole.set(0, -1, 0).addScaledVector(ikDir, ikDir.y);
        ikPole.normalize();
        ikE.copy(ikS).addScaledVector(ikDir, a).addScaledVector(ikPole, hgt);
        // Upper arm: +y from the elbow back up to the shoulder; +x the way the forearm bends.
        ikY.subVectors(ikS, ikE).normalize();
        ikX.subVectors(ikT, ikE);
        ikX.addScaledVector(ikY, -ikX.dot(ikY));
        if (ikX.lengthSq() < 1e-6) ikX.copy(ikPole).negate();
        ikX.normalize();
        ikZ.crossVectors(ikX, ikY);
        boneMatrix(upper, ikS, ikX, ikY, ikZ, scale);
        // Forearm: same bending plane.
        ikY.subVectors(ikE, ikT).normalize();
        ikX.crossVectors(ikY, ikZ).normalize();
        boneMatrix(lower, ikE, ikX, ikY, ikZ, scale);
        boneMatrix(hand, ikT, ikX, ikY, ikZ, scale);
      }
      /* Leg IK in the hip's sagittal plane: hip swing and knee bend for an ankle at (fx, fy). */
      const legSolve = { hip: 0, knee: 0 };
      function solveLeg(fx, fy, L1, L2) {
        let d = Math.hypot(fx, fy);
        d = clamp(d, 0.5, (L1 + L2) * 0.999);
        const cosHip = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1),
          cosKnee = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
        legSolve.hip = Math.atan2(fx, -fy) + Math.acos(cosHip);
        legSolve.knee = -(Math.PI - Math.acos(cosKnee));
        return legSolve;
      }

      /**
       * HOLDS
       * Where a weapon sits in the aim frame (origin at the hips, x along the aim,
       * y up, z to the right; reference-person units) for each stance, and how
       * the upper body turns for it.
       */
      const HOLD_POSES = {
        pistolAim: { grip: [3.35, 4.55, 0.18], pitch: 0, twist: 0, lean: -0.06, headPitch: 0.12, aiming: true },
        pistolOneHand: { grip: [3.8, 4.55, 0.85], pitch: 0, twist: -0.3, lean: -0.04, headPitch: 0.08, oneHand: true, aiming: true },
        pistolReady: { grip: [2.05, 2.55, 0.45], pitch: -0.85, twist: 0, lean: 0, headPitch: 0.05 },
        // Carried in the firing hand at the side, muzzle down; the arms swing.
        pistolSide: { inHand: true, at: [0.12, -0.62, 0.02], rz: -1.2 },
        smgSide: { inHand: true, at: [0.1, -0.6, 0.04], rz: -1.05 },
        smgAim: { grip: [2.55, 3.85, 0.42], pitch: 0, twist: -0.25, lean: -0.1, headPitch: 0.2, aiming: true },
        smgReady: { grip: [1.9, 2.9, 0.5], pitch: -0.6, twist: -0.15, lean: 0, headPitch: 0.05 },
        longAim: { grip: [2.45, 3.88, 0.52], pitch: 0, twist: -0.45, lean: -0.16, headPitch: 0.3, headYaw: 0.28, aiming: true },
        longReady: { grip: [2.1, 3.05, 0.6], pitch: -0.55, twist: -0.3, lean: -0.05, headPitch: 0.1, headYaw: 0.15 },
        longCarry: { grip: [1.25, 2.75, 0.8], pitch: -0.5, yaw: -0.95, twist: 0, lean: 0, headPitch: 0 },
        rocket: { grip: [1.35, 3.55, 1.08], pitch: 0.03, twist: -0.2, lean: -0.08, headPitch: 0.15, headYaw: 0.2, aiming: true },
        knife: { grip: [2.3, 3.35, 0.9], pitch: 0.1, twist: -0.15, lean: -0.1, headPitch: 0.1, oneHand: true },
        fists: { twist: 0, lean: -0.1, headPitch: 0.15, fists: true },
        shield: { grip: [3.3, 4.4, 0.55], pitch: 0, twist: -0.2, lean: -0.12, headPitch: 0.1, oneHand: true, aiming: true },
      };
      const WEAPON_PAINTS = {
        pistol: rigPaint('#1d1f22', '#121315', '#121315', '#9aa6ae', [0, 1, 2, 3]),
        smg: rigPaint('#212326', '#141517', '#141517', '#8a969e', [0, 1, 2, 3]),
        shotgun: rigPaint('#222427', '#141516', '#6b4426', '#a0a4a8', [0, 1, 2, 3]),
        rifle: rigPaint('#26292c', '#1a1b1d', '#3a3226', '#3f6475', [0, 1, 2, 3]),
        rifleArmy: rigPaint('#2a2c2e', '#5f5646', '#5f5646', '#3f6475', [0, 1, 2, 3]),
        sniper: rigPaint('#2a2c2e', '#1a1b1d', '#5d4a33', '#3f5d6d', [0, 1, 2, 3]),
        rocket: rigPaint('#56603f', '#1e2019', '#3c4430', '#888888', [0, 1, 2, 3]),
        knife: rigPaint('#1c1c1c', '#101010', '#101010', '#cfd6db', [0, 1, 2, 3]),
        shield: rigPaint('#15181c', '#0f1113', '#0f1113', '#56707f', [0, 1, 2, 3]),
      };
      const PLAYER_WEAPONS = ['pistol', 'smg', 'shotgun', 'rocket', 'rifle', 'sniper', 'knife', null];
      const holdVec = new Three.Vector3(),
        holdVec2 = new Three.Vector3(),
        holdPole = new Three.Vector3(),
        shoulderWorld = [new Three.Vector3(), new Three.Vector3()],
        handFrames = [new Three.Matrix4(), new Three.Matrix4()],
        legLocal = new Three.Vector3(),
        legInverse = new Three.Matrix4(),
        armTargets = [new Three.Vector3(), new Three.Vector3()];

      /* Which poses carry something that needs the phone in hand. */
      const PHONE_POSES = new Set(['text', 'phone', 'film']);
      /* The far figure: plain standing or walking people only. */
      function farFigureOk(p, spec, J) {
        return !spec?.hold && !spec?.rootOverride && !(p.hp <= 0) && J[J_FALL] < 0.02 && J[J_DROP] > -0.6 && J[J_LOCO] > 0.9 && !p.sitting && !p.dancing;
      }
      /**
       * Pack one person. `detail` 2 full, 1 without hands and small props, 0 far
       * (the figure, when they are only standing or walking). `spec` (special
       * characters) carries the outfit, what they hold and pose overrides.
       */
      function drawCrowdPerson(p, s, deltaSeconds, detail, spec = null) {
        const look = spec?.look || p.look || ensureLook(p),
          R = compiledLook(look, p),
          J = s.joints,
          T = poseTarget,
          t = gameTime,
          dt = deltaSeconds;
        // Measure how far they actually moved: that drives the stride.
        const dx = p.x - s.x,
          dy = p.y - s.y,
          moved = Math.hypot(dx, dy),
          facing = spec?.facing ?? p.a ?? 0;
        s.x = p.x;
        s.y = p.y;
        let fresh = false;
        if (moved > 40 || !s.seen) {
          s.speed = 0;
          s.yaw = s.hipYaw = s.moveYaw = facing;
          s.seen = true;
          fresh = true;
        } else if (dt > 0) {
          s.speed += (moved / dt - s.speed) * (1 - Math.exp(-dt * 10));
          if (moved > 1e-3) s.moveYaw += normalizeAngle(Math.atan2(dy, dx) - s.moveYaw) * (1 - Math.exp(-dt * 12));
        }
        s.umbrella = weather.rain > 0.25 && !!look.umbrella && !p.react && !p.sitting && p.hp > 0 && !p.scene && !spec;
        s.guitar = false;
        s.ember = false;
        crowdPoseTargets(p, s, T, t + s.seed, spec, R);
        // Ease the base pose.
        const k = 1 - Math.exp(-dt * (p.react || spec?.hold?.aiming ? 14 : 9));
        for (let i = 0; i < J_COUNT; i++) J[i] += (T[i] - J[i]) * (dt > 0 && !fresh ? k : 1);
        if (p.hp <= 0 && !p.deathStyle?.slump) J[J_FALL] = personFallAmount(p);
        // Swimming strokes and the parachute set the limbs outright.
        if (spec && (spec.swim || spec.parachute)) applyLimbOverrides(spec, J);
        // Facing. The upper body turns to where they face; the hips follow the
        // direction of travel (strafing, backing away) or, standing, step round
        // once the twist grows large.
        const aimRate = spec?.snapFacing ? 40 : s.speed > 20 ? 12 : 8;
        s.yaw += clamp(normalizeAngle(facing - s.yaw), -aimRate * dt, aimRate * dt) || 0;
        if (dt === 0 || fresh) s.yaw = facing;
        const H = R.height * RIG_UNIT,
          loco = J[J_LOCO] * clamp((s.speed - 1.5) / 5, 0, 1);
        let strideSign = 1;
        if (loco > 0.05) {
          const rel = normalizeAngle(s.moveYaw - s.yaw),
            back = Math.abs(rel) > 1.95;
          if (back) strideSign = -1;
          const hipTarget = s.yaw + clamp(back ? normalizeAngle(rel - Math.PI) : rel, -1.2, 1.2) * 0.85;
          s.hipYaw += normalizeAngle(hipTarget - s.hipYaw) * (1 - Math.exp(-dt * 10));
          s.turning = false;
        } else {
          const lag = normalizeAngle(s.yaw - s.hipYaw);
          if (Math.abs(lag) > (spec?.hold ? 0.55 : 0.8)) s.turning = true;
          if (s.turning) {
            const step = clamp(lag, -4.5 * dt, 4.5 * dt);
            s.hipYaw += step;
            s.turnPhase += Math.abs(step) * 4.2;
            if (Math.abs(lag) < 0.06) s.turning = false;
          }
        }
        if (fresh || J[J_FALL] > 0.02 || J[J_LOCO] < 0.2) s.hipYaw = s.yaw;
        const upperTurn = normalizeAngle(s.yaw - s.hipYaw);
        // The gait. One cycle (two steps) covers strideCycle (game.js), a
        // little shorter for smaller people.
        const run = clamp((s.speed - 20) / 18, 0, 1),
          cycle = strideCycle(s.speed) * (0.55 + 0.45 * R.height);
        if (!fresh && dt > 0) s.phase += (moved / cycle) * TAU * strideSign * (p.injured || spec?.limp ? 0.8 : 1);
        const phi = s.phase,
          beta = 0.62 - 0.26 * run,
          L1 = RIG.thigh,
          L2 = RIG.shin,
          stanceLen = Math.min((beta * cycle) / H, 6.4),
          liftH = 0.75 + 2.3 * run,
          bobWalk = -0.28 * (0.5 + 0.5 * Math.cos(2 * phi)),
          bobRun = 0.55 * (0.5 - 0.5 * Math.cos(2 * (phi - Math.PI * beta))) - 0.4,
          bob = loco * (bobWalk + (bobRun - bobWalk) * run),
          hipY = RIG.hip + J[J_DROP] + bob;
        const legHip = [0, 0],
          legKnee = [0, 0],
          footPitch = [0, 0];
        const limp = p.injured || spec?.limp;
        for (let side = 0; side < 2; side++) {
          let hip = J[J_HIP[side]],
            knee = J[J_KNEE[side]],
            pitch = 0;
          if (loco > 0.01) {
            let u = ((phi + side * Math.PI) / TAU) % 1;
            if (u < 0) u += 1;
            let fx, lift;
            if (u < beta) {
              const q = u / beta;
              fx = stanceLen * (0.5 - q);
              lift = 0;
              pitch = q < 0.14 ? 0.28 * (1 - q / 0.14) : q > 0.7 ? -0.75 * Math.pow((q - 0.7) / 0.3, 2) : 0;
            } else {
              const q = (u - beta) / (1 - beta),
                e = q * q * (3 - 2 * q);
              fx = stanceLen * (-0.5 + e);
              lift = liftH * Math.pow(Math.sin(Math.PI * Math.pow(q, 0.8 - 0.25 * run)), 0.9);
              pitch = -0.55 * (1 - q) * (1 - q) + 0.22 * q * q;
            }
            if (limp && side === 1) {
              fx *= 0.55;
              lift *= 0.4;
            }
            fx *= strideSign;
            const leg = solveLeg(fx, -(hipY - RIG.ankle - lift), L1, L2);
            hip += (leg.hip - hip) * loco;
            knee += (leg.knee - knee) * loco;
            pitch *= loco;
          }
          if (s.turning && loco < 0.3) {
            const lift = Math.max(0, Math.sin(s.turnPhase + side * Math.PI)) * 0.6;
            hip += lift * 0.35;
            knee -= lift * 0.7;
          }
          legHip[side] = hip;
          legKnee[side] = knee;
          footPitch[side] = pitch;
        }
        const hipsDiff = legHip[0] - legHip[1],
          pelvisYaw = -0.12 * hipsDiff * loco,
          lean = J[J_LEAN] - loco * (0.03 + run * 0.17),
          twist = J[J_TWIST] - clamp(upperTurn, -1.1, 1.1) + 0.2 * hipsDiff * loco * (1 - J[J_HOLD] * 0.8),
          roll = J[J_ROLL] + loco * (limp ? 0.1 * Math.sin(phi) : 0.02 * Math.cos(phi));
        // Arms swing against the legs, bent more at a run.
        const armSwing = [
            J[J_SH[0]] - loco * J[J_ARMFREE[0]] * (0.85 + run * 0.45) * (legHip[0] - (legHip[0] + legHip[1]) / 2),
            J[J_SH[1]] - loco * J[J_ARMFREE[1]] * (0.85 + run * 0.45) * (legHip[1] - (legHip[0] + legHip[1]) / 2),
          ],
          elbows = [
            J[J_EL[0]] + loco * J[J_ARMFREE[0]] * (0.22 + run * 1.15 + Math.max(0, armSwing[0]) * 0.35),
            J[J_EL[1]] + loco * J[J_ARMFREE[1]] * (0.22 + run * 1.15 + Math.max(0, armSwing[1]) * 0.35),
          ],
          abduct = [J[J_AB[0]] - loco * J[J_ARMFREE[0]] * run * 0.12, J[J_AB[1]] - loco * J[J_ARMFREE[1]] * run * 0.12];
        // Breathing: the chest rises a little, faster after running.
        s.breath = (s.breath || 0) + dt * (1.7 + Math.min(1, s.speed / 40) * 2.5);
        const breathe = Math.sin(s.breath) * (1 - loco * 0.5),
          shrug = breathe * 0.035;
        const elevation = spec?.elevation ?? entityElevation(p),
          fall = J[J_FALL];
        // Someone lying along the camera's line of sight reads as standing, so a
        // body going down turns a little across the screen as it falls.
        if (fall < 0.05) s.fallTurn = null;
        else if (s.fallTurn == null) {
          const along = Math.abs(Math.sin(s.hipYaw));
          s.fallTurn = along > 0.6 ? (s.seed % 2 < 1 ? 1 : -1) * (0.7 + (s.seed % 0.4)) : 0;
        }
        const fallSign = p.hp <= 0 ? (p.deathStyle?.sign ?? 1) : p.pose === 'crawl' || spec?.pose === 'crawl' || spec?.pose === 'lieFront' ? -1 : 1,
          fallYaw = ((s.fallTurn || 0) + (p.hp <= 0 ? p.deathStyle?.turn || 0 : 0)) * fall;
        // Root: position, heading, then the fall (a rotation about the lateral
        // axis): over backwards, or face down for fallSign -1.
        if (spec?.rootOverride) mRoot.copy(spec.rootOverride);
        else crowdJoint(mRoot, mIdentity, p.x, elevation + fall * 1.2 * H, p.y, (fallSign * fall * Math.PI) / 2, p.ejected ? p.ejectRoll || 0 : 0, -(s.hipYaw + fallYaw));
        mRoot.scale(crowdScale.set(H, H, H));
        rigRimFlag = spec?.rim ? 16 : 0;
        const w = R.width,
          paints = R.paints;
        // Far away and simply standing or walking: three instances.
        if (detail === 0 && farFigureOk(p, spec, J)) {
          crowdJoint(mHips, mRoot, 0, bob, 0, 0, 0, pelvisYaw);
          rigEmit(P.figure, mHips, w, 1, w, paints.figure);
          for (let side = 0; side < 2; side++) {
            crowdJoint(mOut, mRoot, 0, hipY, (side ? 1 : -1) * R.hipZ * w, legHip[side] * 0.8);
            rigEmit(P.figureLeg, mOut, 1, 1, 1, paints.figureLeg);
          }
          return null;
        }
        crowdJoint(mHips, mRoot, 0, hipY, 0, -run * loco * 0.06, roll * 0.4, pelvisYaw);
        crowdJoint(mTorso, mHips, 0, RIG.waist, 0, lean, roll, twist);
        rigEmit(BODY[R.pelvis], mHips, w, 1, w, paints.pelvis);
        if (R.skirtOn) rigEmit(BODY.skirt, mHips, w, 1, w, paints.skirt);
        if (R.belt) rigEmit(BODY.belt, mHips, w, 1, w, paints.belt);
        // The torso breathes (a touch deeper and taller at the chest).
        rigEmit(BODY[R.torso], mTorso, w * (1 + breathe * 0.012), 1 + breathe * 0.006, w, paints.torso);
        if (R.collar) rigEmit(BODY.collar, mTorso, w, 1, w, paints.collar);
        if (R.hood) rigEmit(BODY.hood, mTorso, w, 1, w, paints.hood);
        if (R.vest) rigEmit(BODY.vest, mTorso, w, 1, w, paints.vest);
        if (R.label) {
          crowdJoint(mOut, mTorso, -(R.vest ? 1.16 : 1.0) * w, 2.62, 0);
          crowdEmit(R.label, mOut, 1, 1, w);
        }
        if (R.radio && detail > 1) {
          crowdJoint(mOut, mTorso, 0.72 * w, 2.95, -1.02 * w, 0, 0.3, 0);
          rigEmit(BODY.radio, mOut, 1, 1, 1, paints.radio);
        }
        if (R.backpack || look.backpack) {
          crowdJoint(mOut, mTorso, -1.42 * w, 1.9, 0);
          rigEmit(BODY.backpack, mOut, 1, 1, w, paints.backpack);
        }
        // Head: turned towards what they look at, steadied against the stride.
        const headYaw = J[J_HEAD_YAW] - (upperTurn - clamp(upperTurn, -1.1, 1.1)) - 0.2 * hipsDiff * loco * 0.8;
        crowdJoint(mHead, mTorso, 0.04, RIG.neck, 0, -J[J_HEAD_PITCH] - lean * 0.3, 0, headYaw);
        const hs = R.headScale;
        rigEmit(BODY.head, mHead, hs, hs, hs, paints.head);
        if (R.hatPart) rigEmit(BODY[R.hatPart], mHead, hs, hs, hs, paints.hat);
        if (R.hairPart && !(R.hatPart && R.hairPart === 'hairCurly')) rigEmit(BODY[R.hairPart], mHead, hs, hs, hs, paints.hair);
        // Shoulders.
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          crowdJoint(mShoulder[side], mTorso, 0, RIG.shoulderY + shrug, sign * R.shoulderZ * w, armSwing[side], -sign * abduct[side], 0);
          crowdJoint(mElbow[side], mShoulder[side], 0, -RIG.upperArm, 0, elbows[side]);
          crowdJoint(mHand[side], mElbow[side], 0, -RIG.forearm, 0, 0.1);
        }
        // Weapons and fists: both hands to the hold by IK.
        const hold = spec?.hold,
          holdWeight = J[J_HOLD];
        if (hold?.inHand) {
          crowdJoint(mGun, mHand[1], hold.at[0], hold.at[1], hold.at[2], hold.rz);
          rigEmit(P[spec.weapon], mGun, 1, 1, 1, WEAPON_PAINTS[spec.weapon] || WEAPON_PAINTS.pistol);
        } else if (hold && holdWeight > 0.05) drawHold(p, s, spec, hold, R, H, elevation, hipY, holdWeight);
        // A rider's hands on the bars (RIDERS).
        if (spec?.handTargets) {
          for (let side = 0; side < 2; side++) {
            shoulderWorld[side].setFromMatrixPosition(mShoulder[side]);
            holdPole.set(-0.4, -1, (side ? 1 : -1) * 0.6).transformDirection(mTorso);
            ikArm(mShoulder[side], mElbow[side], mHand[side], shoulderWorld[side], spec.handTargets[side], holdPole, RIG.upperArm * H, RIG.forearm * H, H);
          }
        }
        const armPaint = paints.upperArm,
          forePaint = paints.forearm;
        for (let side = 0; side < 2; side++) {
          rigEmit(BODY.upperArm, mShoulder[side], w, 1, w, armPaint);
          rigEmit(BODY.forearm, mElbow[side], w, 1, w, forePaint);
          if (detail > 1) rigEmit(BODY.hand, mHand[side], 1, 1, 1, paints.hand);
        }
        // Legs.
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          let hip = legHip[side],
            knee = legKnee[side],
            spread = J[J_SPREAD];
          if (spec?.legTargets) {
            // A rider's feet on the pedals or pegs: the target in the pelvis frame.
            legLocal.copy(spec.legTargets[side]).applyMatrix4(legInverse.copy(mHips).invert());
            const leg = solveLeg(legLocal.x, legLocal.y, RIG.thigh, RIG.shin);
            hip = leg.hip;
            knee = leg.knee;
            spread = clamp(Math.atan2(sign * legLocal.z - R.hipZ * w, -legLocal.y), -0.15, 0.5);
          }
          crowdJoint(mHip[side], mHips, 0, 0, sign * R.hipZ * w, hip, -sign * spread, 0);
          rigEmit(BODY[R.thigh], mHip[side], w, 1, w, paints.thigh);
          crowdJoint(mKnee[side], mHip[side], 0, -RIG.thigh, 0, knee);
          rigEmit(BODY.shin, mKnee[side], 1, 1, 1, paints.shin);
          // The foot stays flat on the ground through the stance, rolls onto the
          // toes at push-off and hangs toes-down in the swing.
          const flat = fall > 0.5 ? 0.3 : 1;
          crowdJoint(mFoot, mKnee[side], 0, -RIG.shin, 0, -(hip + knee) * flat + footPitch[side] + (-run * loco * 0.06));
          rigEmit(BODY[R.shoePart], mFoot, 1, 1, 1, paints.shoe);
        }
        // Things in hand.
        const right = mHand[1];
        if (detail > 1 && !hold) {
          const pose = p.pose || (p.onPhone ? 'phone' : null);
          if (PHONE_POSES.has(pose)) crowdEmit(P.phone, right, 1, 1, 1);
          if (p.carry === 'camera') crowdEmit(P.phone, right, 2.2, 1.1, 1.8);
          if (p.carry === 'briefcase' && p.hp > 0 && !s.umbrella) crowdEmit(P.briefcase, right, 1, 1, 1);
          if ((p.carry === 'shopping' || p.carry === 'handbag') && p.hp > 0 && !s.umbrella)
            crowdEmit(P.shopping, right, p.carry === 'handbag' ? 0.75 : 1, p.carry === 'handbag' ? 0.8 : 1, 1, cachedCrowdColor(umbrellaColors, p.carry === 'handbag' ? look.bagColor || '#6b2f36' : ['#e9dcc4', '#c9a26b', '#f2f0ea', '#b8413a'][Math.floor(((look.build || 1) * 97) % 4)]));
          if ((p.carry === 'coffee' || p.carry === 'food') && p.hp > 0 && !PHONE_POSES.has(pose)) crowdEmit(P.cup, right, 1, 1, 1);
          if (s.ember) crowdEmit(P.ember, right, 1, 1, 1);
          if (spec?.cocktail && p.hp > 0) crowdEmit(P.cocktail, right, 1, 1, 1);
          if (p.hp > 0 && p.club) {
            const pose = p.pose;
            if (p.carry === 'cocktail' && pose !== 'dj' && pose !== 'swim' && pose !== 'lounge') crowdEmit(P.cocktail, right, 1, 1, 1);
            if (p.carry === 'sparkler') {
              crowdEmit(P.bottle, right, 1, 1, 1);
              const e = right.elements;
              for (let k = 0; k < 3; k++) {
                const f = Math.sin(gameTime * 40 + k * 2.1) * 0.5 + 0.6;
                crowdJoint(mOut, mIdentity, e[12] + Math.sin(gameTime * 23 + k) * 0.8, e[13] + 2.3 + k * 0.45, e[14] + Math.cos(gameTime * 29 + k) * 0.8);
                crowdEmit(P.spark, mOut, f * 0.36, f * 0.36, f * 0.36);
              }
            }
            if (pose === 'sweep') crowdEmit(P.broom, right, 1, 1, 1);
          }
        }
        if (p.carry === 'tray' && p.hp > 0 && p.pose === 'tray') {
          // The tray stays flat whatever the wrist is doing.
          const e = right.elements;
          crowdJoint(mOut, mIdentity, e[12], e[13] + 0.3, e[14], 0, 0, -s.yaw);
          crowdEmit(P.tray, mOut, H, H, H);
        }
        if (p.carry === 'box' && p.hp > 0) {
          crowdJoint(mOut, mTorso, 2.3, 1.7, 0);
          crowdEmit(P.carton, mOut, 1, 1, 1);
        }
        if (s.guitar) {
          crowdJoint(mOut, mTorso, 1.85, 1.5, 0.25, 0, 0.55, 0);
          crowdEmit(P.guitar, mOut, 1, 1, 1);
        }
        if (s.umbrella) {
          // The canopy stays upright whatever the arm is doing.
          const e = right.elements;
          crowdJoint(mOut, mIdentity, e[12], e[13], e[14], -0.12, 0, -s.yaw);
          crowdEmit(P.umbrella, mOut, H, H, H, cachedCrowdColor(umbrellaColors, look.umbrella || '#1b1d22'));
        }
        rigRimFlag = 0;
        return right;
      }
      /**
       * Weapons in hand. The hold's grip is placed in the aim frame (at the
       * hips, turned to where they face), with recoil and the reload, the
       * weapon is drawn there, and the wrists are brought to its grip and
       * handguard by IK (overwriting the posed arm matrices).
       */
      function drawHold(p, s, spec, hold, R, H, elevation, hipY, weight) {
        const w = R.width;
        crowdJoint(mAim, mIdentity, p.x, elevation + hipY * H, p.y, 0, 0, -s.yaw);
        mAim.scale(crowdScale.set(H, H, H));
        for (let side = 0; side < 2; side++) shoulderWorld[side].setFromMatrixPosition(mShoulder[side]);
        const L1 = RIG.upperArm * H,
          L2 = RIG.forearm * H,
          recoil = spec.recoil || 0,
          reload = spec.reload ?? -1,
          reloadBump = reload >= 0 ? Math.sin(Math.PI * clamp(reload, 0, 1)) : 0;
        let rightTarget = null,
          leftTarget = null,
          rightFrame = null,
          leftFrame = null;
        if (hold.fists) {
          // Guard up at the chin; the punching hand snaps out and back.
          const lead = spec.punchLead ?? 1,
            punch = spec.punch || 0;
          for (let side = 0; side < 2; side++) {
            const sign = side ? 1 : -1,
              isLead = side === lead,
              x = isLead ? 2.1 + punch * 2.3 : 1.55,
              z = sign * (isLead ? 0.45 - punch * 0.4 : 0.62);
            armTargets[side].set(x, 4.55 - (isLead ? punch * 0.15 : 0), z).applyMatrix4(mAim);
          }
          rightTarget = armTargets[1];
          leftTarget = armTargets[0];
        } else if (spec.weapon) {
          const g = hold.grip,
            info = WEAPON_HOLDS[spec.weapon] || WEAPON_HOLDS.pistol,
            knife = spec.weapon === 'knife' ? spec.knifeSwing || 0 : 0,
            slash = Math.sin(knife * Math.PI);
          crowdJoint(
            mGun,
            mAim,
            g[0] - recoil * (info.shoulder ? 0.25 : 0.5) + slash * 1.2 - reloadBump * 0.5,
            g[1] + recoil * (info.shoulder ? 0.05 : 0.2) - reloadBump * 0.6 + slash * 0.4,
            g[2] - slash * 1.6 - reloadBump * 0.2,
            (hold.pitch || 0) + recoil * (info.shoulder ? 0.1 : 0.32) + reloadBump * 0.45,
            reloadBump * 0.6,
            (hold.yaw || 0) + slash * 1.1,
          );
          const kind = spec.weapon === 'rifle' && spec.army ? 'rifleArmy' : spec.weapon;
          rigEmit(P[spec.weapon], mGun, 1, 1, 1, WEAPON_PAINTS[kind] || WEAPON_PAINTS.pistol);
          // The firing hand: its wrist a little behind and above the grip.
          // The firing hand wraps the grip: the wrist a little behind and above it,
          // the hand down the grip, fingers round the front.
          crowdJoint(handFrames[1], mGun, -0.3, 0.34, 0.02, 0.22);
          rightTarget = armTargets[1].setFromMatrixPosition(handFrames[1]);
          rightFrame = handFrames[1];
          if (info.support && !hold.oneHand) {
            const sp = info.support,
              k = WEAPON_SCALE_OF(spec.weapon),
              pistolGrip = spec.weapon === 'pistol';
            // Reloading: the support hand goes to the magazine and back.
            crowdJoint(
              handFrames[0],
              mGun,
              sp[0] * k - reloadBump * (sp[0] * k - 0.5) + (pistolGrip ? -0.22 : -0.3),
              sp[1] + (pistolGrip ? 0.3 : 0.12) - reloadBump * 1.1,
              sp[2] - (pistolGrip ? 0.08 : 0.22),
              pistolGrip ? 0.22 : 0.9,
              pistolGrip ? 0 : -0.5,
            );
            leftTarget = armTargets[0].setFromMatrixPosition(handFrames[0]);
            leftFrame = handFrames[0];
          }
        }
        if (spec.shield) {
          // The ballistic shield on the left forearm, square to the front.
          crowdJoint(mShieldM, mAim, 2.6, 3.9, -0.55, 0, 0, 0.08);
          rigEmit(P.shield, mShieldM, 1, 1, 1, WEAPON_PAINTS.shield);
          crowdJoint(mOut, mShieldM, 0.52, -1.0, 0, -0.3);
          crowdEmit(P.labelPolice, mOut, 1.3, 1.3, 1.3);
          crowdJoint(handFrames[0], mShieldM, -0.3, 0.55, 0.1, 0.1);
          leftTarget = armTargets[0].setFromMatrixPosition(handFrames[0]);
          leftFrame = handFrames[0];
        }
        for (let side = 0; side < 2; side++) {
          const target = side ? rightTarget : leftTarget;
          if (!target) continue;
          const sign = side ? 1 : -1;
          // Blend from the posed wrist while the hold eases in.
          if (weight < 0.999) {
            holdVec2.setFromMatrixPosition(mHand[side]);
            target.lerpVectors(holdVec2, target, weight);
          }
          // Elbows down and out, a little back.
          holdPole.set(-0.25, -1, sign * 0.7).transformDirection(mAim);
          ikArm(mShoulder[side], mElbow[side], mHand[side], shoulderWorld[side], target, holdPole, L1, L2, H);
          // A hand on the weapon takes the weapon's frame once the hold is in.
          const frame = side ? rightFrame : leftFrame;
          if (frame && weight > 0.6) mHand[side].copy(frame);
        }
        void w;
      }
      const WEAPON_SCALE_OF = (weapon) => (weapon === 'shield' ? 1 : WEAPON_SCALE);

      /**
       * SPECIAL CHARACTERS
       * What the player, officers, soldiers, gangs and mission characters hold
       * and how, from game state; read by drawCrowdPerson. One scratch spec,
       * filled per person just before they are packed.
       */
      const specScratch = {};
      const parachuteProxy = (() => {
        const part = () => ({ rotation: { x: 0, z: 0 } });
        return {
          group: { position: new Three.Vector3(), rotation: new Three.Euler() },
          parts: { arm1: part(), 'arm-1': part(), leg1: part(), 'leg-1': part(), guns: [] },
          torso: { rotation: { z: 0 } },
        };
      })();
      const rootQuat = new Three.Quaternion(),
        rootMatrixScratch = new Three.Matrix4(),
        unitScale = new Three.Vector3(1, 1, 1);
      // Car transitions (render side only): when the player got in or out.
      const carTransition = { car: null, at: -10, kind: null, x: 0, y: 0, a: 0 };
      function specialSpec(p) {
        const sp = specScratch;
        for (const k in sp) sp[k] = undefined;
        sp.look = specialLook(p);
        sp.facing = p.a || 0;
        const incapacitated = personIncapacitated(p) || p.hp <= 0;
        const recoilFrom = (at) => (at != null ? clamp(1 - (gameTime - at) / 0.13, 0, 1) : 0);
        if (p === player) {
          sp.rim = true;
          sp.snapFacing = true;
          if (mouse.active || touchAim !== null) sp.facing = aim();
          const holstered = !!rooftopJob() && player.disguised && !rooftopJob().weaponDrawn;
          // The Marea pool (clubpool.js): a dive in, and a climb out onto the deck.
          if (player.pool?.phase === 'out') {
            sp.pose = 'exitCar';
            sp.transition = clamp(player.pool.t || 0, 0, 1);
            sp.facing = player.a;
            return sp;
          }
          if (player.swimming) return playerSwimSpec(sp);
          if (player.parachute) return playerParachuteSpec(sp);
          if (player.tumble) {
            sp.pose = 'tumble';
            sp.elevation = entityElevation(player) + 2;
            crowdJoint(rootMatrixScratch, mIdentity, player.x, sp.elevation, player.y, Math.PI / 2, player.tumbleRoll || 0, -player.a);
            sp.rootOverride = rootMatrixScratch;
            return sp;
          }
          if (carTransition.kind === 'exit' && gameTime - carTransition.at < 0.5) {
            sp.pose = 'exitCar';
            sp.transition = clamp((gameTime - carTransition.at) / 0.5, 0, 1);
          }
          if (incapacitated || holstered) return sp;
          const weapon = PLAYER_WEAPONS[selectedWeaponIndex] ?? null,
            firedRecently = gameTime - (player.lastShotAt ?? -100) < 1.6;
          if (selectedWeaponIndex === FISTS_INDEX) {
            const guard = gameTime - (player.punchAt ?? -100) < 2.5;
            if (guard) {
              sp.hold = HOLD_POSES.fists;
              sp.punch = (player.punchUntil || 0) > gameTime ? Math.sin(clamp(1 - ((player.punchUntil || 0) - gameTime) / 0.26, 0, 1) * Math.PI) : 0;
              sp.punchLead = player.punchHand === -1 ? 0 : 1;
            }
            return sp;
          }
          if (!weapon) return sp;
          sp.weapon = weapon;
          sp.recoil = clamp(((player.recoilUntil || 0) - gameTime) / 0.12, 0, 1);
          const w = weapons[selectedWeaponIndex];
          if (reloadSecondsRemaining > 0 && w?.load) sp.reload = 1 - reloadSecondsRemaining / w.load;
          if (weapon === 'knife') {
            sp.hold = HOLD_POSES.knife;
            sp.knifeSwing = Math.max(0, ((player.knifeSwingUntil || 0) - gameTime) / 0.28);
          } else if (weapon === 'rocket') sp.hold = HOLD_POSES.rocket;
          else if (weapon === 'pistol') sp.hold = firedRecently || sp.reload >= 0 ? HOLD_POSES.pistolAim : HOLD_POSES.pistolSide;
          else if (weapon === 'smg') sp.hold = firedRecently || sp.reload >= 0 ? HOLD_POSES.smgAim : HOLD_POSES.smgSide;
          else sp.hold = firedRecently || sp.reload >= 0 ? HOLD_POSES.longAim : HOLD_POSES.longReady;
          return sp;
        }
        if (p.dazedFor > 0) sp.dazed = true;
        if (p.limping) sp.limp = true;
        if (p.downed && p.hp > 0) {
          sp.pose = 'crawl';
          return sp;
        }
        if (incapacitated) return sp;
        if (p.police || p.military) {
          const aiming = p.state === 'aim' || p.state === 'suppress' || !!p.aiming || !!p.aimingOnly,
            unit = p.unit,
            weapon = p.military || unit === 'soldier' ? 'rifle' : p.shield ? 'pistol' : unit === 'swat' ? 'rifle' : unit === 'sniper' ? 'sniper' : unit === 'fed' ? 'smg' : 'pistol';
          sp.weapon = weapon;
          sp.army = !!(p.military || unit === 'soldier');
          sp.shield = !!p.shield;
          sp.recoil = recoilFrom(p.muzzleAt);
          if (p.shield) sp.hold = HOLD_POSES.shield;
          else if (weapon === 'pistol') sp.hold = aiming ? HOLD_POSES.pistolAim : wantedStars > 0 ? HOLD_POSES.pistolReady : null;
          else if (weapon === 'smg') sp.hold = aiming ? HOLD_POSES.smgAim : HOLD_POSES.smgReady;
          else sp.hold = aiming ? HOLD_POSES.longAim : p.military || wantedStars <= 0 ? HOLD_POSES.longCarry : HOLD_POSES.longReady;
          if (!sp.hold) sp.weapon = null;
          return sp;
        }
        if (p.faction && p.aiming && p.hp > 0) {
          sp.weapon = 'pistol';
          sp.hold = HOLD_POSES.pistolOneHand;
          sp.recoil = p.recoiling ? 1 : recoilFrom(p.muzzleAt);
          return sp;
        }
        if (p.guest || p.boss) {
          if (p.drinking) {
            sp.pose = 'drink';
            sp.cocktail = true;
            sp.sip = Math.sin(gameTime * 1.3 + (p.phase || 0)) > 0.6;
          } else if (p.role === 'serve' || p.staff) sp.pose = 'serve';
          else if (!p.dancing && p.role === 'chat') sp.pose = 'chat';
        }
        return sp;
      }
      /* The player in the water: front crawl, or breaststroke when easing off. */
      function playerSwimSpec(sp) {
        const stroke = player.swimStroke || 0,
          hard = typeof swimHard === 'function' ? swimHard() : true,
          drive = clamp(player.swimDrive || 0, 0, 1),
          roll = hard ? Math.sin(stroke) * 0.44 * (0.4 + drive * 0.6) : 0;
        sp.facing = player.a;
        if (player.pool?.phase === 'dive') {
          // Head first: from a lean off the edge to arms-first into the water.
          const k = clamp(player.pool.t || 0, 0, 1);
          sp.elevation = entityElevation(player);
          crowdJoint(rootMatrixScratch, mIdentity, player.x, sp.elevation + 4 * k, player.y, -(0.35 + k * 1.75), 0, -player.a);
          sp.rootOverride = rootMatrixScratch;
          sp.swim = { stroke: 0, hard: true, drive: 0, dive: true };
          return sp;
        }
        sp.elevation = entityElevation(player) + 2.0;
        crowdJoint(rootMatrixScratch, mIdentity, player.x, sp.elevation, player.y, -Math.PI / 2 + 0.12, roll, -player.a);
        sp.rootOverride = rootMatrixScratch;
        sp.swim = { stroke, hard, drive };
        return sp;
      }
      /* Parachute: parachute3d.js poses a stand-in model; its angles drive the rig. */
      function playerParachuteSpec(sp) {
        const proxy = parachuteProxy;
        poseParachutist(proxy, lastDelta);
        const g = proxy.group;
        rootQuat.setFromEuler(g.rotation);
        rootMatrixScratch.compose(g.position, rootQuat, unitScale);
        sp.rootOverride = rootMatrixScratch;
        sp.parachute = proxy;
        sp.facing = player.parachute.heading ?? player.a;
        sp.elevation = g.position.y;
        return sp;
      }
      let lastDelta = 0;
      /* Swimming and the parachute set the limbs directly, after the pose has eased. */
      function applyLimbOverrides(sp, J) {
        if (sp.swim) {
          const { stroke, hard, drive, float, dive } = sp.swim;
          J[J_LOCO] = 0;
          J[J_FALL] = 0;
          J[J_DROP] = 0;
          J[J_HOLD] = 0;
          if (dive) {
            // Streamlined: arms overhead, legs together.
            J[J_SH[0]] = J[J_SH[1]] = 3.05;
            J[J_AB[0]] = J[J_AB[1]] = 0.08;
            J[J_EL[0]] = J[J_EL[1]] = 0.05;
            J[J_HIP[0]] = J[J_HIP[1]] = 0;
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.08;
            J[J_SPREAD] = 0;
            J[J_HEAD_PITCH] = 0.25;
            J[J_HEAD_YAW] = 0;
          } else if (float) {
            // Floating on the back, arms and legs spread, a lazy scull.
            J[J_SH[0]] = J[J_SH[1]] = 0.2;
            J[J_AB[0]] = J[J_AB[1]] = 1.2 + Math.sin(stroke) * 0.1;
            J[J_EL[0]] = J[J_EL[1]] = 0.2;
            J[J_HIP[0]] = J[J_HIP[1]] = 0.1;
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.15;
            J[J_SPREAD] = 0.3;
            J[J_HEAD_PITCH] = -0.2;
            J[J_HEAD_YAW] = 0;
          } else if (hard) {
            // Front crawl: arms windmill half a cycle apart, a flutter kick at twice the rate.
            J[J_SH[1]] = Math.PI - stroke;
            J[J_SH[0]] = -stroke;
            J[J_AB[0]] = J[J_AB[1]] = 0.25;
            J[J_EL[1]] = 0.3 + Math.max(0, Math.sin(stroke)) * 1.2;
            J[J_EL[0]] = 0.3 + Math.max(0, -Math.sin(stroke)) * 1.2;
            J[J_HIP[0]] = Math.sin(stroke * 2) * 0.3 * (0.5 + drive);
            J[J_HIP[1]] = -Math.sin(stroke * 2) * 0.3 * (0.5 + drive);
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.2;
            J[J_HEAD_YAW] = Math.sin(stroke) * 0.6;
            J[J_HEAD_PITCH] = 0.1;
          } else {
            // Breaststroke: arms reach forward, sweep out and tuck back; frog kick.
            const c = Math.sin(stroke),
              pull = Math.max(0, c),
              recover = Math.max(0, -c);
            J[J_SH[0]] = J[J_SH[1]] = 2.9 - pull * 1.1;
            J[J_AB[0]] = J[J_AB[1]] = 0.2 + pull * 1.1;
            J[J_EL[0]] = J[J_EL[1]] = 0.2 + pull * 1.3;
            J[J_HIP[0]] = J[J_HIP[1]] = recover * 1.1;
            J[J_KNEE[0]] = J[J_KNEE[1]] = -0.2 - recover * 1.8;
            J[J_SPREAD] = 0.15 + recover * 0.45;
            J[J_HEAD_PITCH] = -0.5 + pull * 0.25;
            J[J_HEAD_YAW] = 0;
          }
          J[J_ARMFREE[0]] = J[J_ARMFREE[1]] = 0;
          J[J_LEAN] = 0;
          J[J_TWIST] = 0;
        } else if (sp.parachute) {
          const parts = sp.parachute.parts;
          J[J_LOCO] = 0;
          J[J_FALL] = 0;
          J[J_DROP] = 0;
          J[J_HOLD] = 0;
          J[J_SH[1]] = parts.arm1.rotation.z;
          J[J_SH[0]] = parts['arm-1'].rotation.z;
          J[J_AB[1]] = -parts.arm1.rotation.x;
          J[J_AB[0]] = parts['arm-1'].rotation.x;
          J[J_EL[0]] = J[J_EL[1]] = 0.35;
          J[J_HIP[1]] = parts.leg1.rotation.z;
          J[J_HIP[0]] = parts['leg-1'].rotation.z;
          J[J_KNEE[0]] = J[J_KNEE[1]] = -0.35;
          J[J_SPREAD] = Math.abs(parts.leg1.rotation.x);
          J[J_LEAN] = sp.parachute.torso.rotation.z;
          J[J_ARMFREE[0]] = J[J_ARMFREE[1]] = 0;
        }
      }
      /**
       * BEACHGOERS
       * Palm Keys Beach's people (beach.js) are drawn by the rig too: their
       * `pose` is mapped onto the rig's poses, `z` is their height (the sand, a
       * towel, a lounger, the lifeguard tower, the water), and swimmers get the
       * crawl or float on the surface like the player.
       */
      const BEACH_POSES = {
        walk: null,
        run: null,
        stand: null,
        wadeWalk: 'wade',
        wade: 'wade',
        sit: 'sitGround',
        ride: 'ride',
        recline: 'recline',
        kneel: 'kneelDig',
        lie: 'lieBack',
        lieFront: 'lieFront',
        tread: 'swim',
        ready: 'vbReady',
        hit: 'vbHit',
        bump: 'vbBump',
        dig: 'vbDig',
        set: 'vbSet',
        spike: 'vbSpike',
        serve: 'vbServe',
        cheer: 'cheer',
        throw: 'throw',
      };
      const beachFacing = new Three.Matrix4();
      function beachSpec(p) {
        const sp = specScratch;
        for (const k in sp) sp[k] = undefined;
        let entry = specialLooks.get(p);
        if (!entry) {
          entry = { outfit: 'beach', look: outfitLook(p, 'beach', (p.threshold || 0.5) * 997 + (p.phase || 0) * 13) };
          specialLooks.set(p, entry);
        }
        sp.look = entry.look;
        sp.facing = p.a || 0;
        sp.elevation = p.z || 0;
        const pose = p.pose;
        if (pose === 'swim' || pose === 'float') {
          const stroke = (p.phase || 0) * 3.2 + gameTime * (pose === 'swim' ? 3.2 : 0.8),
            onBack = pose === 'float';
          sp.elevation = (p.z || 0) + 2.0;
          crowdJoint(beachFacing, mIdentity, p.x, sp.elevation, p.y, onBack ? Math.PI / 2 : -Math.PI / 2 + 0.12, onBack ? 0 : Math.sin(stroke) * 0.35, -(p.a || 0));
          sp.rootOverride = beachFacing;
          sp.swim = { stroke, hard: true, drive: 0.7, float: onBack };
          return sp;
        }
        if (pose === 'tread') sp.elevation = (p.z || 0) - 7.4;
        sp.pose = BEACH_POSES[pose] ?? null;
        return sp;
      }
      function drawBeachgoers(deltaSeconds, detail) {
        if (typeof beachgoers === 'undefined' || !beachgoers.length) return 0;
        if (Math.abs(cameraTarget.x + 2010) > 1900 || Math.abs(cameraTarget.y - 5620) > 1500) return 0;
        let n = 0;
        for (const p of beachgoers) {
          if (!p.visible || p.state === 'off' || p.pose === 'dive' || !entityInView(p, 30)) {
            const s = crowdState.get(p);
            if (s) s.seen = false;
            continue;
          }
          drawCrowdPerson(p, stateFor(p), deltaSeconds, detail, beachSpec(p));
          n++;
        }
        return n;
      }
      /**
       * RIDERS
       * Whoever rides a bicycle, a share bike, a motorbike or a jet ski is drawn
       * by the rig on the vehicle's model (render3d.js hands each one over with
       * `queueRider` once the vehicle is posed): hips on the seat, hands on the
       * grips and feet on the pedals (turning with the crank) or the pegs, all
       * by IK, leaning into the bars. The player keeps their own look.
       */
      const RIDER_SEATS = {
        bicycle: { seat: [-2.2, 15.25, 0], grip: [8.6, 18, 4.1], crank: 3, pedalZ: 2, lean: -0.45 },
        share: { seat: [-3.1, 16.25, 0], grip: [5.0, 17.4, 3.9], crank: 3, pedalZ: 2.6, lean: -0.32 },
        motorbike: { seat: [-5.2, 12.35, 0], grip: [6.8, 14, 3], peg: [0.2, 5.4, 3.4], lean: -0.32 },
        jetski: { seat: [-4.6, 8.1, 0], grip: [2.4, 9.6, 4.4], peg: [-3.8, 4.6, 3.1], lean: -0.22 },
      };
      const riderQueue = [],
        riderProxies = new WeakMap(),
        riderRoot = new Three.Matrix4(),
        riderRotation = new Three.Matrix4(),
        riderSeat = new Three.Vector3(),
        riderUp = new Three.Vector3(),
        riderHands = [new Three.Vector3(), new Three.Vector3()],
        riderFeet = [new Three.Vector3(), new Three.Vector3()],
        riderScratch = new Three.Vector3(),
        riderScale = new Three.Vector3();
      /* Called by render3d.js for a two-wheeler or jet ski whose rider shows; true when the rig draws them. */
      function queueRider(c, m) {
        riderQueue.push(c, m);
        return true;
      }
      function drawQueuedRiders(deltaSeconds, detail) {
        for (let i = 0; i < riderQueue.length; i += 2) {
          const c = riderQueue[i],
            m = riderQueue[i + 1],
            kind = m.jetski ? 'jetski' : c.shareBike ? 'share' : m.bicycle ? 'bicycle' : 'motorbike',
            seat = RIDER_SEATS[kind],
            frame = m.rider.parent;
          if (!frame) continue;
          m.group.updateMatrixWorld(true);
          const M = frame.matrixWorld,
            isPlayer = c === player.car;
          let proxy = riderProxies.get(c);
          if (!proxy) riderProxies.set(c, (proxy = { x: c.x, y: c.y, a: c.a, hp: 1 }));
          proxy.x = c.x;
          proxy.y = c.y;
          proxy.a = c.a;
          const sp = isPlayer ? specialSpec(player) : specScratch;
          if (!isPlayer) {
            for (const k in sp) sp[k] = undefined;
            let entry = specialLooks.get(c);
            const outfit = kind === 'motorbike' ? 'motorcyclist' : kind === 'jetski' ? 'jetskier' : 'cyclist';
            if (!entry || entry.outfit !== outfit) {
              entry = { outfit, look: outfitLook(c, outfit, (c.id || 1) * 7.31) };
              specialLooks.set(c, entry);
            }
            sp.look = entry.look;
          } else if (kind === 'jetski') sp.look = { ...specialLook(player) };
          sp.hold = null;
          sp.weapon = null;
          sp.swim = null;
          sp.parachute = null;
          sp.pose = 'riding';
          sp.riderLean = seat.lean;
          const R = compiledLook(sp.look, proxy),
            H = R.height * RIG_UNIT;
          // Root: the frame's rotation, the hips on the seat.
          M.decompose(riderSeat, crowdQuat, riderScale);
          riderRotation.makeRotationFromQuaternion(crowdQuat);
          riderSeat.set(...seat.seat).applyMatrix4(M);
          riderUp.set(0, 1, 0).applyQuaternion(crowdQuat);
          riderRoot.copy(riderRotation).setPosition(riderSeat.addScaledVector(riderUp, -(RIG.hip - 0.5) * H));
          sp.rootOverride = riderRoot;
          sp.elevation = riderSeat.y;
          sp.facing = c.a;
          for (let side = 0; side < 2; side++) {
            const z = (side ? 1 : -1) * seat.grip[2];
            riderHands[side].set(seat.grip[0] - 0.4, seat.grip[1] + 0.2, z).applyMatrix4(M);
            if (seat.crank && m.crank) {
              // The pedal on this side, then the ankle just above it.
              const a = (m.crank.rotation.z || 0) + (side ? 0 : Math.PI);
              riderScratch.set(m.crank.position.x - Math.sin(a) * seat.crank, m.crank.position.y + Math.cos(a) * seat.crank, (side ? 1 : -1) * seat.pedalZ);
              riderFeet[side].copy(riderScratch).applyMatrix4(M).addScaledVector(riderUp, RIG.ankle * H);
            } else riderFeet[side].set(seat.peg[0], seat.peg[1], (side ? 1 : -1) * seat.peg[2]).applyMatrix4(M).addScaledVector(riderUp, RIG.ankle * H);
          }
          sp.handTargets = riderHands;
          sp.legTargets = riderFeet;
          drawCrowdPerson(proxy, stateFor(proxy), deltaSeconds, detail, sp);
        }
        riderQueue.length = 0;
      }
      /* Where the player got into or out of a car, for the transition poses. */
      function trackCarTransition() {
        const car = player.car && !transitRide && !taxiRide ? player.car : null;
        if (car !== carTransition.car) {
          if (carTransition.car && !car) carTransition.kind = 'exit';
          else if (car && !carTransition.car) {
            carTransition.kind = 'enter';
            carTransition.x = player.x;
            carTransition.y = player.y;
          } else carTransition.kind = null;
          carTransition.at = gameTime;
          carTransition.car = car;
        }
      }
      // A stand-in for the player ducking into a car's driver seat.
      const enterGhost = { x: 0, y: 0, a: 0, hp: 100 };
      function drawEnterCar(deltaSeconds, detail) {
        const car = carTransition.car;
        if (carTransition.kind !== 'enter' || !car || gameTime - carTransition.at > 0.4 || isAircraft(car) || isBoat(car)) return;
        if (Math.hypot(car.vx || 0, car.vy || 0) > 30) return;
        const spec = vehicleSpec(car),
          side = car.a - Math.PI / 2,
          k = clamp((gameTime - carTransition.at) / 0.4, 0, 1);
        enterGhost.x = car.x + Math.cos(side) * (spec.w / 2 + 1.5 - k * 3) + Math.cos(car.a) * spec.l * 0.08;
        enterGhost.y = car.y + Math.sin(side) * (spec.w / 2 + 1.5 - k * 3) + Math.sin(car.a) * spec.l * 0.08;
        enterGhost.a = car.a + Math.PI / 2;
        const sp = specialSpec(player);
        sp.hold = null;
        sp.weapon = null;
        sp.pose = 'enterCar';
        sp.transition = k;
        sp.facing = enterGhost.a;
        sp.elevation = entityElevation(car);
        sp.look = specialLook(player);
        drawCrowdPerson(enterGhost, stateFor(enterGhost), deltaSeconds, detail, sp);
      }

      /* Dogs: a trotting body, four legs in diagonal pairs, and the leash. */
      function drawCrowdDog(p, hand, deltaSeconds) {
        const dog = p.dog;
        let s = crowdState.get(dog);
        if (!s) {
          s = { x: dog.x, y: dog.y, phase: 0, speed: 0 };
          crowdState.set(dog, s);
        }
        const moved = Math.hypot(dog.x - s.x, dog.y - s.y);
        s.x = dog.x;
        s.y = dog.y;
        if (moved < 40 && deltaSeconds > 0) {
          s.speed += (moved / deltaSeconds - s.speed) * (1 - Math.exp(-deltaSeconds * 8));
          s.phase += (moved / 9) * TAU;
        }
        const color = cachedCrowdColor(dogColors, dog.color),
          size = (dog.size || 1) * 0.85,
          trot = clamp(s.speed / 10, 0, 1),
          sit = dog.sit ? 1 : 0;
        crowdJoint(mRoot, mIdentity, dog.x, entityElevation(p) + Math.abs(Math.sin(s.phase)) * 0.3 * trot, dog.y, sit * 0.45, 0, -dog.a);
        mRoot.scale(crowdScale.set(size, size, size));
        crowdEmit(P.dogBody, mRoot, 1, 1, 1, color);
        for (let i = 0; i < 4; i++) {
          const front = i < 2,
            side = i % 2 ? 1 : -1,
            swing = Math.sin(s.phase + (front === (side > 0) ? 0 : Math.PI)) * 0.6 * trot;
          crowdJoint(mOut, mRoot, front ? 1.7 : -1.8, 2.5, side * 0.65, sit && !front ? 1.2 : swing);
          crowdEmit(P.dogLeg, mOut, 1, 1, 1, color);
        }
        if (hand && p.hp > 0) {
          // Leash from the hand to the collar.
          const e = hand.elements;
          crowdVec.set(e[12], e[13] - 0.6, e[14]);
          crowdVec2.set(dog.x + Math.cos(dog.a) * 2.8 * size, entityElevation(p) + 5 * size, dog.y + Math.sin(dog.a) * 2.8 * size);
          const length = crowdVec.distanceTo(crowdVec2);
          if (length > 0.5 && length < 40) {
            const mid = crowdVec.clone().add(crowdVec2).multiplyScalar(0.5);
            crowdQuat.setFromUnitVectors(crowdXAxis, crowdVec2.sub(crowdVec).normalize());
            mOut.compose(mid, crowdQuat, crowdScale.set(length, 0.2, 0.2));
            if (P.leash.n < P.leash.capacity) {
              P.leash.mesh.setMatrixAt(P.leash.n, mOut);
              P.leash.n++;
            }
          }
        }
      }
      function flushCrowdParts() {
        for (const part of Object.values(crowdParts)) {
          const mesh = part.mesh;
          mesh.count = part.n;
          if (part.n) {
            mesh.instanceMatrix.clearUpdateRanges();
            mesh.instanceMatrix.addUpdateRange(0, part.n * 16);
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) {
              mesh.instanceColor.clearUpdateRanges();
              mesh.instanceColor.addUpdateRange(0, part.n * 3);
              mesh.instanceColor.needsUpdate = true;
            }
            if (part.paint) {
              part.paint.clearUpdateRanges();
              part.paint.addUpdateRange(0, part.n * 4);
              part.paint.needsUpdate = true;
              part.meta.clearUpdateRanges();
              part.meta.addUpdateRange(0, part.n * 2);
              part.meta.needsUpdate = true;
            }
          }
          mesh.visible = part.n > 0;
          part.n = 0;
        }
      }
      /* Level of detail from the zoom: 2 full, 1 no hands or small props, 0 far figures. */
      function crowdDetail() {
        const lod = activeTier ? activeTier.lodBias : 1,
          zoom = flightViewActive ? viewZoom : worldZoom;
        return zoom >= 0.6 * lod ? 2 : zoom >= 0.34 * lod ? 1 : 0;
      }
      /**
       * Per frame: pack every visible pedestrian, their dog, the special
       * characters (`specials`: the player, officers, gangs, guards, mission
       * characters) and the scene props. Returns how many people were drawn.
       */
      function updateCrowd3D(deltaSeconds, specials = []) {
        let drawn = 0;
        lastDelta = deltaSeconds;
        const detail = crowdDetail(),
          zoom = flightViewActive ? viewZoom : worldZoom,
          zoomedIn = (flightViewActive ? viewZoom : worldZoom) > 0.22;
        // Close-up detail only where a head is more than a few pixels across.
        BODY = zoom >= 2.4 ? BODY_CLOSE : BODY_STREET;
        trackCarTransition();
        if (zoomedIn)
          for (const p of pedestrians) {
            if (p.hidden) continue;
            const view = entityInView(p, 30),
              dogView = p.dog && entityInView(p.dog, 20);
            if (!view && !dogView) {
              const s = crowdState.get(p);
              if (s) s.seen = false;
              continue;
            }
            const hand = drawCrowdPerson(p, stateFor(p), deltaSeconds, detail, null);
            drawn++;
            if (p.dog) drawCrowdDog(p, hand, deltaSeconds);
          }
        for (const p of specials) {
          const isPlayer = p === player;
          if (p.hidden) continue;
          if (isPlayer && (player.car || transitRide || taxiRide)) continue;
          if (!isPlayer && (!zoomedIn || !entityInView(p, 35))) {
            const s = crowdState.get(p);
            if (s) s.seen = false;
            continue;
          }
          const spec = specialSpec(p),
            s = stateFor(p);
          drawCrowdPerson(p, s, deltaSeconds, isPlayer ? Math.max(detail, 1) : detail, spec);
          drawn++;
        }
        drawEnterCar(deltaSeconds, detail);
        if (zoomedIn) drawn += drawBeachgoers(deltaSeconds, detail);
        for (const prop of crowd.props) {
          const part = propParts[prop.kind];
          if (!part || !entityInView(prop, 30)) continue;
          // A piece a car has knocked over lies tipped on its side (crowd.js).
          crowdJoint(mOut, mIdentity, prop.x, terrainHeight(prop.x, prop.y), prop.y, 0, prop.tip || 0, -(prop.a || 0));
          if (part.n < part.capacity) {
            part.mesh.setMatrixAt(part.n, mOut);
            part.n++;
          }
        }
        return drawn;
      }
      /* After the vehicles are posed: the riders, then upload every part (render3d.js). */
      function finishCrowd3D(deltaSeconds) {
        drawQueuedRiders(deltaSeconds, crowdDetail());
        flushCrowdParts();
      }
      /**
       * Measures for DeadEndCity.scaleReport: the rig's standing height at
       * look.height 1, and a person's drawn extents ({ l, w, h }, map units).
       */
      /* What the people cost this frame: instanced parts drawn, draw calls (camera
         and shadow) and triangles, and which body set is in use. */
      function crowdStats() {
        let parts = 0,
          viewCalls = 0,
          shadowCalls = 0,
          triangles = 0,
          instances = 0;
        for (const part of Object.values(crowdParts)) {
          const mesh = part.mesh;
          if (!mesh.visible || !mesh.count) continue;
          const g = mesh.geometry,
            tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
          parts++;
          viewCalls++;
          if (mesh.castShadow) shadowCalls++;
          instances += mesh.count;
          triangles += tris * mesh.count;
        }
        return { parts, viewCalls, shadowCalls, instances, triangles: Math.round(triangles), bodySet: BODY === BODY_CLOSE ? 'close' : 'street' };
      }
      function crowdRigHeight() {
        return PERSON_HEIGHT;
      }
      function personExtents(p) {
        if (!p || !(p === player || pedestrians.includes(p) || renderPeople.includes(p))) return null;
        const look = p === player || !p.look ? specialLook(p) : p.look,
          R = compiledLook(look, p),
          H = R.height * RIG_UNIT;
        return { l: 2.3 * H * R.width, w: 3.9 * H * R.width, h: 14 * H };
      }
      function personStature(p) {
        const look = p.look || (renderPeople.includes(p) ? specialLook(p) : null);
        return look ? compiledLook(look, p).height * PERSON_HEIGHT : null;
      }
      // END SUBSYSTEM: src/crowd3d.js
