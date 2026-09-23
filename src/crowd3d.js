      // BEGIN SUBSYSTEM: src/crowd3d.js — Instanced crowd bodies, poses and street props
      /**
       * Instanced crowd bodies, poses and street props
       * Source: src/crowd3d.js
       * Scope: renderer closure (inside createCityRenderer).
       *
       * Every pedestrian is drawn from one shared set of InstancedMeshes, one per
       * body part (head, hair, torso, pelvis, upper arm, forearm, hand, thigh,
       * shin, shoe, skirt, bags, phone, umbrella...), so a street of a hundred
       * people costs the same couple of dozen draw calls as a street of five.
       * Each frame the visible people are packed into the instance buffers with
       * a matrix per part, built from a small skeleton:
       *
       *   root (position, heading, fall) → hips → torso → head
       *                                        ↘ shoulders → elbows → hands
       *                  hips → thighs → knees → feet
       *
       * Poses are two layers. The base pose (standing, cowering, hands up, on the
       * phone, sitting...) comes from `person.pose` and is eased joint by joint,
       * so changes blend instead of snapping. The locomotion layer (stride, arm
       * swing, bob, lean) is driven by how far the person actually moved this
       * frame, so feet keep pace with the ground at any speed, and blends from
       * walk to run with speed.
       */
      const CROWD_CAPACITY = 820,
        CROWD_HIP = 7.6,
        CROWD_THIGH = 3.7,
        CROWD_SHIN = 3.3,
        CROWD_UPPER_ARM = 3.1,
        CROWD_FOREARM = 2.9;
      const crowdBodyMaterial = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 }),
        crowdClothDouble = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: Three.DoubleSide }),
        crowdHairMaterial = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }),
        crowdShoeMaterial = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45 }),
        crowdPropMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
        crowdPhoneMaterial = new Three.MeshStandardMaterial({ color: '#15171b', emissive: '#86b8ff', emissiveIntensity: 0.55, roughness: 0.3 }),
        crowdEmberMaterial = new Three.MeshBasicMaterial({ color: '#ff8a3a' }),
        crowdLeashMaterial = new Three.MeshStandardMaterial({ color: '#2a2320', roughness: 0.7 });
      /* Limb geometry hangs down from its joint at the origin. */
      function crowdLimb(rTop, rBottom, length, segments = 7) {
        const g = new Three.CylinderGeometry(rTop, rBottom, length, segments, 1);
        g.translate(0, -length / 2, 0);
        return g;
      }
      /* Merge small geometries, optionally painting each a vertex colour. */
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
        unitCylinder = new Three.CylinderGeometry(1, 1, 1, 10),
        unitSphere = new Three.SphereGeometry(1, 10, 8);
      /* Torso: a tapered ten-sided prism, narrow at the waist, full at the chest, sloping at the shoulders. */
      function crowdTorsoGeometry() {
        const g = new Three.CylinderGeometry(1, 1, 1, 10, 3),
          p = g.attributes.position,
          widths = [2.0, 2.2, 2.62, 2.25],
          depths = [1.42, 1.5, 1.66, 1.3];
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i),
            ring = Math.round((y + 0.5) * 3),
            x = p.getX(i),
            z = p.getZ(i);
          p.setXYZ(i, x * depths[ring], (y + 0.5) * 4.8, z * widths[ring]);
        }
        g.computeVertexNormals();
        return g;
      }
      function crowdPelvisGeometry() {
        const g = new Three.CylinderGeometry(1, 1, 1, 10, 1),
          p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i),
            top = y > 0;
          p.setXYZ(i, p.getX(i) * (top ? 1.42 : 1.5), y * 1.9 - 0.25, p.getZ(i) * (top ? 2.0 : 2.1));
        }
        g.computeVertexNormals();
        return g;
      }
      function crowdSkirtGeometry() {
        const g = new Three.CylinderGeometry(1, 1, 1, 12, 1, true),
          p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i),
            top = y > 0;
          p.setXYZ(i, p.getX(i) * (top ? 1.5 : 2.3), (y - 0.5) * 3.4, p.getZ(i) * (top ? 2.08 : 2.7));
        }
        g.computeVertexNormals();
        return g;
      }
      // Head and neck share one mesh; the head centre sits 2.25 above the neck base.
      const crowdHeadGeometry = crowdMerge([
        { geo: at(unitCylinder, 0, 0.45, 0, 0, 0, 0, 0.72, 0.9, 0.72) },
        { geo: at(new Three.SphereGeometry(1, 12, 9), 0.05, 2.25, 0, 0, 0, 0, 1.72, 2.02, 1.62) },
        { geo: at(unitSphere, 1.55, 2.0, 0, 0, 0, 0, 0.32, 0.42, 0.3) },
      ]);
      const hairCap = at(new Three.SphereGeometry(1, 12, 8, 0, TAU, 0, Math.PI * 0.6), -0.12, 2.3, 0, 0, 0, 0.32, 1.84, 2.1, 1.74),
        hairLong = crowdMerge([
          { geo: hairCap },
          { geo: at(unitBox, -1.25, 1.0, 0, 0, 0, 0.12, 0.9, 3.6, 3.1) },
        ]),
        hairBun = crowdMerge([{ geo: hairCap }, { geo: at(unitSphere, -1.45, 3.35, 0, 0, 0, 0, 0.85, 0.85, 0.85) }]),
        hairCurly = at(new Three.SphereGeometry(1, 10, 8, 0, TAU, 0, Math.PI * 0.62), -0.15, 2.4, 0, 0, 0, 0.25, 2.15, 2.35, 2.05),
        hatGeometry = crowdMerge([
          { geo: at(new Three.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2), 0, 3.0, 0, 0, 0, 0.12, 1.9, 1.25, 1.8) },
          { geo: at(unitCylinder, 1.5, 3.05, 0, 0, 0, -0.08, 1.35, 0.16, 1.45) },
        ]);
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
      const P = {
        head: crowdPart('head', crowdHeadGeometry, crowdBodyMaterial, CROWD_CAPACITY),
        hairShort: crowdPart('hair', hairCap, crowdHairMaterial, CROWD_CAPACITY, false),
        hairLong: crowdPart('long hair', hairLong, crowdHairMaterial, CROWD_CAPACITY),
        hairBun: crowdPart('hair bun', hairBun, crowdHairMaterial, CROWD_CAPACITY, false),
        hairCurly: crowdPart('curly hair', hairCurly, crowdHairMaterial, CROWD_CAPACITY, false),
        hat: crowdPart('hat', hatGeometry, crowdBodyMaterial, CROWD_CAPACITY, false),
        torso: crowdPart('torso', crowdTorsoGeometry(), crowdBodyMaterial, CROWD_CAPACITY),
        pelvis: crowdPart('pelvis', crowdPelvisGeometry(), crowdBodyMaterial, CROWD_CAPACITY),
        skirt: crowdPart('skirt', crowdSkirtGeometry(), crowdClothDouble, CROWD_CAPACITY),
        upperArm: crowdPart('upper arm', crowdLimb(0.7, 0.6, CROWD_UPPER_ARM), crowdBodyMaterial, CROWD_CAPACITY * 2),
        forearm: crowdPart('forearm', crowdLimb(0.58, 0.48, CROWD_FOREARM), crowdBodyMaterial, CROWD_CAPACITY * 2),
        hand: crowdPart('hand', at(new Three.SphereGeometry(0.62, 7, 5), 0, -0.45, 0, 0, 0, 0, 0.9, 1.15, 0.7), crowdBodyMaterial, CROWD_CAPACITY * 2, false),
        thigh: crowdPart('thigh', crowdLimb(0.95, 0.74, CROWD_THIGH), crowdBodyMaterial, CROWD_CAPACITY * 2),
        shin: crowdPart('shin', crowdLimb(0.72, 0.52, CROWD_SHIN), crowdBodyMaterial, CROWD_CAPACITY * 2),
        shoe: crowdPart('shoe', at(unitBox, 0.55, -0.32, 0, 0, 0, 0, 2.6, 0.9, 1.2), crowdShoeMaterial, CROWD_CAPACITY * 2, false),
        backpack: crowdPart(
          'backpack',
          crowdMerge([{ geo: at(unitBox, 0, 0, 0, 0, 0, 0, 1.5, 2.9, 2.8) }, { geo: at(unitBox, -0.3, 1.5, 0, 0, 0, 0, 1.1, 0.5, 2.4) }]),
          crowdBodyMaterial,
          CROWD_CAPACITY,
        ),
        briefcase: crowdPart('briefcase', crowdMerge([
          { geo: at(unitBox, 0, -1.6, 0, 0, 0, 0, 2.8, 2.0, 0.7), color: '#2a211c' },
          { geo: at(unitBox, 0, -0.45, 0, 0, 0, 0, 1.1, 0.35, 0.3), color: '#1a1512' },
        ]), crowdPropMaterial, 200, false, false),
        shopping: crowdPart('shopping bag', crowdMerge([
          { geo: at(unitBox, 0, -1.7, 0, 0, 0, 0, 2.2, 2.5, 1.1) },
          { geo: at(unitBox, 0, -0.35, 0, 0, 0, 0, 1.2, 0.25, 0.2) },
        ]), crowdBodyMaterial, 200, false),
        cup: crowdPart('cup', crowdMerge([
          { geo: at(unitCylinder, 0.15, -0.55, 0, 0, 0, 0, 0.42, 1.2, 0.42), color: '#efe6d6' },
          { geo: at(unitCylinder, 0.15, 0.1, 0, 0, 0, 0, 0.46, 0.2, 0.46), color: '#3b2a22' },
        ]), crowdPropMaterial, 200, false, false),
        phone: crowdPart('phone', at(unitBox, 0.2, -0.55, 0, 0, 0, 0, 0.3, 1.25, 0.72), crowdPhoneMaterial, 260, false, false),
        ember: crowdPart('ember', at(unitBox, 0.3, -0.9, 0.2, 0, 0, 0, 0.5, 0.5, 0.5), crowdEmberMaterial, 60, false, false),
        carton: crowdPart('carton', crowdMerge([
          { geo: at(unitBox, 0, 0, 0, 0, 0, 0, 2.7, 2.5, 3.6), color: '#b58a5a' },
          { geo: at(unitBox, 0, 1.26, 0, 0, 0, 0, 0.6, 0.04, 3.62), color: '#d8c49a' },
        ]), crowdPropMaterial, 30, true, false),
        umbrella: crowdPart('umbrella', crowdMerge([
          { geo: at(new Three.CylinderGeometry(0.12, 6.4, 1.9, 12, 1, true), 0, 8.6, 0) },
          { geo: at(unitCylinder, 0, 4.2, 0, 0, 0, 0, 0.14, 8.6, 0.14) },
        ]), crowdClothDouble, 400),
        guitar: crowdPart('guitar', crowdMerge([
          { geo: at(unitCylinder, 0, 0, 0, Math.PI / 2, 0, 0, 2.3, 0.8, 1.9), color: '#9a5a2a' },
          { geo: at(unitCylinder, 0, 0, 1.0, Math.PI / 2, 0, 0, 1.6, 0.82, 1.4), color: '#9a5a2a' },
          { geo: at(unitCylinder, 0, 0.42, -0.3, Math.PI / 2, 0, 0, 0.6, 0.1, 0.6), color: '#1d1410' },
          { geo: at(unitBox, 0, 0.2, -4.2, 0, 0, 0, 0.5, 0.35, 5.6), color: '#3b2618' },
          { geo: at(unitBox, 0, 0.2, -7.3, 0, 0, 0, 0.7, 0.4, 1.1), color: '#1d1410' },
        ]), crowdPropMaterial, 12, true, false),
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
            { geo: at(unitBox, s * 7.5, 4.3, 0, 0, 0, 0, 3.2, 0.5, 3.2), color: '#8a5a32' },
            { geo: at(unitBox, s * 9.1, 6.9, 0, 0, 0, 0, 0.5, 4.8, 3.2), color: '#7a4e2a' },
            { geo: at(unitBox, s * 7.5, 2.1, 0, 0, 0, 0, 2.6, 4.2, 2.6), color: '#3a3430' },
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
      /* Colours are parsed once per look and cached. */
      const lookColors = new WeakMap();
      function colorsFor(look) {
        let c = lookColors.get(look);
        if (!c || c.top !== look.top) {
          c = {
            top: look.top,
            skin: new Three.Color(look.skin),
            hair: new Three.Color(look.hair),
            shirt: new Three.Color(look.top),
            pants: new Three.Color(look.pants),
            shoes: new Three.Color(look.shoes),
            hat: new Three.Color(look.hatColor),
            bag: new Three.Color(look.bagColor),
            umbrella: new Three.Color(look.umbrella || '#1b1d22'),
            paper: new Three.Color(['#e9dcc4', '#c9a26b', '#f2f0ea', '#b8413a'][Math.floor((look.build * 97) % 4)]),
          };
          lookColors.set(look, c);
        }
        return c;
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
        J_COUNT = 21;
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
            speed: 0,
            phase: Math.random() * TAU,
            seed: Math.random() * 100,
            seen: false,
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
      /* Base pose targets. `side` 0 is left, 1 is right. */
      function crowdPoseTargets(p, s, T, t) {
        T.fill(0);
        const look = p.look,
          seed = s.seed,
          stoop = look?.stoop || 0;
        T[J_LEAN] = -stoop;
        T[J_HEAD_PITCH] = stoop * 0.6;
        setArm(T, 0, 0.02, 0.1, 0.18);
        setArm(T, 1, 0.02, 0.1, 0.18);
        T[J_KNEE[0]] = T[J_KNEE[1]] = -0.04;
        T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 1;
        T[J_LOCO] = 1;
        // Idle life: weight shifts and the odd look around.
        const sway = Math.sin(t * 0.55 + seed);
        T[J_ROLL] = sway * 0.025;
        T[J_HIP[0]] = sway * 0.04;
        T[J_HIP[1]] = -sway * 0.04;
        T[J_HEAD_YAW] = Math.sin(t * 0.31 + seed * 2) * Math.max(0, Math.sin(t * 0.13 + seed)) * 0.7;
        if (p.hp <= 0) {
          T[J_FALL] = 1;
          T[J_LOCO] = 0;
          const k = seed % 1;
          setArm(T, 0, 0.4, 1.1 + k * 0.6, 0.3);
          setArm(T, 1, -0.2, 0.3 + k, 0.6);
          T[J_HIP[0]] = 0.3 * k;
          T[J_SPREAD] = 0.25;
          T[J_KNEE[1]] = -0.5 * k;
          return;
        }
        let pose = p.pose;
        if (p.ejected) pose = 'thrown';
        else if (p.exercise != null) pose = 'exercise';
        else if (p.dancing) pose = 'dance';
        else if (p.onPhone && !pose) pose = 'phone';
        else if (p.sitting && !pose) pose = 'sit';
        if (p.glanceUntil > gameTime) T[J_HEAD_YAW] = Math.sin((p.glanceUntil - gameTime) * 7) * 0.8;
        // Carried things decide what the right arm does while walking.
        const carry = p.carry;
        if (carry === 'briefcase' || carry === 'shopping' || carry === 'handbag') {
          setArm(T, 1, 0, 0.12, 0.08);
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
            T[J_HEAD_PITCH] = -0.45;
            setArm(T, 0, 0.55, -0.12, 1.55);
            setArm(T, 1, 0.6, -0.15, 1.5);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            break;
          case 'phone':
            setArm(T, 1, 0.75, 0.55, 2.55);
            T[J_ARMFREE[1]] = 0;
            T[J_HEAD_YAW] = 0.15 + Math.sin(t * 0.7 + seed) * 0.2;
            T[J_HEAD_PITCH] = -0.1;
            setArm(T, 0, -0.1, 0.45, 1.3);
            break;
          case 'film':
            setArm(T, 0, 1.3, -0.25, 0.45);
            setArm(T, 1, 1.35, -0.2, 0.35);
            T[J_ARMFREE[0]] = T[J_ARMFREE[1]] = 0;
            T[J_HEAD_PITCH] = 0.05;
            break;
          case 'cower':
            T[J_LOCO] = 0;
            T[J_DROP] = -3.3;
            T[J_LEAN] = -0.9 + shake(0.03);
            T[J_HIP[0]] = T[J_HIP[1]] = 1.45;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -2.3;
            T[J_SPREAD] = 0.18;
            setArm(T, 0, 2.55, 0.55, 2.2);
            setArm(T, 1, 2.55, 0.55, 2.2);
            T[J_HEAD_PITCH] = -0.55;
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
            T[J_DROP] = -3.25;
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
            T[J_HEAD_PITCH] = 0.12;
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
            T[J_HEAD_PITCH] = -0.25;
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
            T[J_HEAD_PITCH] = 0.15;
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
            T[J_DROP] = -3.0;
            T[J_HIP[0]] = T[J_HIP[1]] = 1.5;
            T[J_KNEE[0]] = T[J_KNEE[1]] = -1.45;
            T[J_SPREAD] = 0.06;
            T[J_LEAN] = 0.05;
            setArm(T, 0, 0.5, 0.05, 0.95);
            setArm(T, 1, 0.5, 0.05, 0.95);
            if (p.sipping) setArm(T, 1, 1.0, 0.25, 2.45);
            else if (carry === 'coffee') setArm(T, 1, 0.75, 0.1, 1.5);
            break;
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
            T[J_DROP] = -3.1;
            T[J_HIP[0]] = 1.5;
            T[J_KNEE[0]] = -1.6;
            T[J_HIP[1]] = 0.05;
            T[J_KNEE[1]] = -1.5;
            T[J_LEAN] = -0.5;
            setArm(T, 0, 1.0, 0.1, 0.5 + Math.sin(t * 2) * 0.2);
            setArm(T, 1, 1.1, 0.1, 0.4);
            T[J_HEAD_PITCH] = -0.4;
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
            T[J_HEAD_PITCH] = -0.2 + Math.sin(t * 4.2) * 0.06;
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
            T[J_HEAD_PITCH] = drag ? 0.1 : 0;
            s.ember = true;
            break;
          }
          case 'sway':
            T[J_ROLL] = Math.sin(t * 2.2 + seed) * 0.06;
            T[J_DROP] = -Math.abs(Math.sin(t * 2.2 + seed)) * 0.25;
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
          case 'dance': {
            const beat = gameTime * 4 + (p.phase || seed);
            T[J_ROLL] = Math.sin(beat) * 0.07;
            setArm(T, 0, 0.7 + Math.sin(beat) * 0.5, 0.3, 1.2);
            setArm(T, 1, 0.7 - Math.sin(beat) * 0.5, 0.3, 1.2);
            T[J_HIP[0]] = Math.sin(beat) * 0.22;
            T[J_HIP[1]] = -Math.sin(beat) * 0.22;
            break;
          }
          case 'exercise': {
            const e = p.exercise;
            T[J_LOCO] = 0;
            if (p.exerciseKind === 'mat') {
              T[J_DROP] = -4.2;
              T[J_HIP[0]] = T[J_HIP[1]] = 1.3;
              T[J_LEAN] = -0.15 - e * 0.85;
              setArm(T, 0, 2.4, 0.2, 1.8);
              setArm(T, 1, 2.4, 0.2, 1.8);
            } else if (p.exerciseKind === 'dip' || p.exerciseKind === 'bars') {
              T[J_DROP] = 5 + e * 5;
              setArm(T, 0, -0.12, 0.3, 0.1);
              setArm(T, 1, -0.12, 0.3, 0.1);
              T[J_HIP[0]] = 0.5;
              T[J_HIP[1]] = 0.34;
            } else {
              T[J_DROP] = 7 + e * 6;
              setArm(T, 0, 2.75 - e * 0.45, 0.35, 0.2 + e * 0.9);
              setArm(T, 1, 2.75 - e * 0.45, 0.35, 0.2 + e * 0.9);
              T[J_HIP[0]] = 0.35;
              T[J_KNEE[0]] = T[J_KNEE[1]] = -0.5;
            }
            break;
          }
          default:
            break;
        }
        if (p.illness) {
          T[J_LEAN] -= p.illness * 0.3;
          setArm(T, 0, 0.85, 0.2, 1.2);
        }
        const fall = p.poisonCollapse ?? personFallAmount(p);
        if (fall > 0) {
          T[J_FALL] = Math.max(T[J_FALL], fall);
          T[J_LOCO] = 0;
        }
      }
      /* Which poses carry something that needs the phone in hand. */
      const PHONE_POSES = new Set(['text', 'phone', 'film']);
      function drawCrowdPerson(p, s, deltaSeconds, lod) {
        const look = p.look || ensureLook(p),
          colors = colorsFor(look),
          J = s.joints,
          T = poseTarget,
          t = gameTime;
        // Measure how far they actually moved: that drives the stride.
        const dx = p.x - s.x,
          dy = p.y - s.y,
          moved = Math.hypot(dx, dy);
        s.x = p.x;
        s.y = p.y;
        if (moved > 40 || !s.seen) {
          s.speed = 0;
          s.yaw = p.a || 0;
          s.seen = true;
        } else if (deltaSeconds > 0) {
          s.speed += (moved / deltaSeconds - s.speed) * (1 - Math.exp(-deltaSeconds * 10));
          const run = clamp((s.speed - 40) / 30, 0, 1),
            cycle = 17 + s.speed * 0.14 + run * 4;
          s.phase += (moved / cycle) * TAU * (p.injured ? 0.8 : 1);
        }
        s.umbrella = weather.rain > 0.25 && !!look.umbrella && !p.react && !p.sitting && p.hp > 0 && !p.scene;
        s.guitar = false;
        s.ember = false;
        crowdPoseTargets(p, s, T, t + s.seed);
        // Ease the base pose.
        const k = 1 - Math.exp(-deltaSeconds * (p.react ? 13 : 9));
        for (let i = 0; i < J_COUNT; i++) J[i] += (T[i] - J[i]) * (deltaSeconds > 0 ? k : 1);
        if (T[J_FALL] >= 1 && p.hp <= 0) J[J_FALL] = Math.max(J[J_FALL], personFallAmount(p));
        // Heading: turn toward the facing the game gives, faster when running.
        const yawRate = s.speed > 45 ? 12 : 8;
        s.yaw += clamp(normalizeAngle((p.a || 0) - s.yaw), -yawRate * deltaSeconds, yawRate * deltaSeconds) || 0;
        if (deltaSeconds === 0) s.yaw = p.a || 0;
        // Locomotion layer.
        const moving = clamp(s.speed / 8, 0, 1) * J[J_LOCO],
          run = clamp((s.speed - 40) / 30, 0, 1),
          phi = s.phase,
          hipAmp = (0.42 + run * 0.5) * (p.role === 'kid' ? 1.15 : 1),
          kneeAmp = 0.7 + run * 0.9,
          armAmp = 0.38 + run * 0.55,
          sinPhi = Math.sin(phi),
          cosPhi = Math.cos(phi),
          limpScale = p.injured ? [1, 0.45] : [1, 1];
        const hipL = J[J_HIP[0]] + moving * hipAmp * sinPhi * limpScale[0],
          hipR = J[J_HIP[1]] - moving * hipAmp * sinPhi * limpScale[1],
          kneeL = J[J_KNEE[0]] - moving * (0.1 + kneeAmp * Math.max(0, cosPhi)) * limpScale[0],
          kneeR = J[J_KNEE[1]] - moving * (0.1 + kneeAmp * Math.max(0, -cosPhi)) * limpScale[1],
          bob = moving * (0.3 + run * 0.6) * (Math.abs(cosPhi) - 1),
          lean = J[J_LEAN] - moving * (0.04 + run * 0.18),
          twist = J[J_TWIST] + moving * 0.09 * sinPhi,
          roll = J[J_ROLL] + moving * (p.injured ? 0.1 * sinPhi : 0.025 * cosPhi);
        const armSwing = [
          J[J_SH[0]] - moving * J[J_ARMFREE[0]] * armAmp * sinPhi,
          J[J_SH[1]] + moving * J[J_ARMFREE[1]] * armAmp * sinPhi,
        ];
        const elbows = [
          J[J_EL[0]] + moving * J[J_ARMFREE[0]] * (0.2 + run * 1.0),
          J[J_EL[1]] + moving * J[J_ARMFREE[1]] * (0.2 + run * 1.0),
        ];
        const height = look.height || 1,
          build = look.build || 1,
          elevation = entityElevation(p),
          fall = J[J_FALL];
        // Someone lying along the camera's line of sight reads as standing, so a
        // body going down turns a little across the screen as it falls.
        if (fall < 0.05) s.fallTurn = null;
        else if (s.fallTurn == null) {
          const along = Math.abs(Math.sin(s.yaw));
          s.fallTurn = along > 0.6 ? (s.seed % 2 < 1 ? 1 : -1) * (0.7 + (s.seed % 0.4)) : 0;
        }
        const fallYaw = (s.fallTurn || 0) * fall;
        // Root: position, heading, then the fall (a rotation about the lateral axis).
        crowdJoint(mRoot, mIdentity, p.x, elevation + fall * 1.5 * height, p.y, (fall * Math.PI) / 2, p.ejected ? p.ejectRoll || 0 : 0, -(s.yaw + fallYaw));
        mRoot.scale(crowdScale.set(height, height, height));
        crowdJoint(mHips, mRoot, 0, CROWD_HIP + J[J_DROP] + bob, 0, 0, roll * 0.4, 0);
        crowdJoint(mTorso, mHips, 0, 0.7, 0, lean, roll, twist);
        const skirt = look.skirt,
          legColor = skirt ? colors.skin : colors.pants,
          armColor = look.sleeves ? colors.shirt : colors.skin;
        crowdEmit(P.pelvis, mHips, build, 1, build, colors.pants);
        if (skirt) crowdEmit(P.skirt, mHips, build, 1, build, colors.pants);
        crowdEmit(P.torso, mTorso, build * 0.96, 1, build, colors.shirt);
        crowdJoint(mHead, mTorso, 0.05, 4.8, 0, J[J_HEAD_PITCH], 0, J[J_HEAD_YAW]);
        crowdEmit(P.head, mHead, 1, 1, 1, colors.skin);
        if (look.hat) crowdEmit(P.hat, mHead, 1, 1, 1, colors.hat);
        else if (look.hairStyle === 1) crowdEmit(P.hairShort, mHead, 1, 1, 1, colors.hair);
        else if (look.hairStyle === 2) crowdEmit(P.hairLong, mHead, 1, 1, 1, colors.hair);
        else if (look.hairStyle === 3) crowdEmit(P.hairBun, mHead, 1, 1, 1, colors.hair);
        else if (look.hairStyle === 4) crowdEmit(P.hairCurly, mHead, 1, 1, 1, colors.hair);
        if (look.backpack) {
          crowdJoint(mOut, mTorso, -1.95 * build, 2.5, 0);
          crowdEmit(P.backpack, mOut, 1, 1, build, colors.bag);
        }
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          crowdJoint(mShoulder[side], mTorso, 0.1, 4.15, sign * 2.45 * build, armSwing[side], -sign * J[J_AB[side]], 0);
          crowdEmit(P.upperArm, mShoulder[side], build, 1, build, armColor);
          crowdJoint(mElbow[side], mShoulder[side], 0, -CROWD_UPPER_ARM, 0, elbows[side]);
          crowdEmit(P.forearm, mElbow[side], build, 1, build, armColor);
          crowdJoint(mHand[side], mElbow[side], 0, -CROWD_FOREARM, 0);
          if (!lod) crowdEmit(P.hand, mHand[side], 1, 1, 1, colors.skin);
          const hip = side ? hipR : hipL,
            knee = side ? kneeR : kneeL;
          crowdJoint(mHip[side], mHips, 0, 0, sign * 1.12 * build, hip, -sign * J[J_SPREAD], 0);
          crowdEmit(P.thigh, mHip[side], build, 1, build, legColor);
          crowdJoint(mKnee[side], mHip[side], 0, -CROWD_THIGH, 0, knee);
          crowdEmit(P.shin, mKnee[side], 1, 1, 1, skirt ? colors.skin : colors.pants);
          // Keep the foot roughly flat on the ground through the stride.
          crowdJoint(mFoot, mKnee[side], 0, -CROWD_SHIN, 0, -(hip + knee) * (fall > 0.5 ? 0.3 : 0.85));
          crowdEmit(P.shoe, mFoot, 1, 1, 1, colors.shoes);
        }
        // Things in hand.
        const right = mHand[1];
        if (!lod) {
          const pose = p.pose || (p.onPhone ? 'phone' : null);
          if (PHONE_POSES.has(pose)) crowdEmit(P.phone, right, 1, 1, 1);
          if (p.carry === 'camera') crowdEmit(P.phone, right, 2.2, 1.1, 1.8);
          if (p.carry === 'briefcase' && p.hp > 0 && !s.umbrella) crowdEmit(P.briefcase, right, 1, 1, 1);
          if ((p.carry === 'shopping' || p.carry === 'handbag') && p.hp > 0 && !s.umbrella)
            crowdEmit(P.shopping, right, p.carry === 'handbag' ? 0.75 : 1, p.carry === 'handbag' ? 0.8 : 1, 1, p.carry === 'handbag' ? colors.bag : colors.paper);
          if ((p.carry === 'coffee' || p.carry === 'food') && p.hp > 0 && !PHONE_POSES.has(pose)) crowdEmit(P.cup, right, 1, 1, 1);
          if (s.ember) crowdEmit(P.ember, right, 1, 1, 1);
        }
        if (p.carry === 'box' && p.hp > 0) {
          crowdJoint(mOut, mTorso, 2.6, 1.9, 0);
          crowdEmit(P.carton, mOut, 1, 1, 1);
        }
        if (s.guitar) {
          crowdJoint(mOut, mTorso, 2.1, 1.7, 0.3, 0, 0.55, 0);
          crowdEmit(P.guitar, mOut, 1, 1, 1);
        }
        if (s.umbrella) {
          // The canopy stays upright whatever the arm is doing.
          const e = right.elements;
          crowdJoint(mOut, mIdentity, e[12], e[13], e[14], -0.12, 0, -s.yaw);
          crowdEmit(P.umbrella, mOut, height, height, height, colors.umbrella);
        }
        return right;
      }
      /* Dogs: a trotting body, four legs in diagonal pairs, and the leash. */
      const dogColors = new Map();
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
        let color = dogColors.get(dog.color);
        if (!color) dogColors.set(dog.color, (color = new Three.Color(dog.color)));
        const size = dog.size || 1,
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
          }
          mesh.visible = part.n > 0;
          part.n = 0;
        }
      }
      /**
       * Per frame: pack every visible pedestrian, their dog and the scene props.
       * Returns how many people were drawn (for the stats overlay).
       */
      function updateCrowd3D(deltaSeconds) {
        let drawn = 0;
        const lod = worldZoom < 0.55;
        if (worldZoom > 0.22)
          for (const p of pedestrians) {
            if (p.hidden) continue;
            const view = entityInView(p, 30),
              dogView = p.dog && entityInView(p.dog, 20);
            if (!view && !dogView) {
              const s = crowdState.get(p);
              if (s) s.seen = false;
              continue;
            }
            const hand = drawCrowdPerson(p, stateFor(p), deltaSeconds, lod);
            drawn++;
            if (p.dog) drawCrowdDog(p, hand, deltaSeconds);
          }
        for (const prop of crowd.props) {
          const part = propParts[prop.kind];
          if (!part || !entityInView(prop, 30)) continue;
          crowdJoint(mOut, mIdentity, prop.x, terrainHeight(prop.x, prop.y), prop.y, 0, 0, -(prop.a || 0));
          if (part.n < part.capacity) {
            part.mesh.setMatrixAt(part.n, mOut);
            part.n++;
          }
        }
        flushCrowdParts();
        return drawn;
      }
      // END SUBSYSTEM: src/crowd3d.js
