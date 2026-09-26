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
        // An assistant referee's flag.
        flag: crowdPart('flag', crowdMerge([
          { geo: at(unitCylinder, 0.15, -1.2, 0, 0, 0, 0, 0.1, 4.2, 0.1), color: '#1d1f22' },
          { geo: at(unitBox, 0.15, -2.4, 1.1, 0, 0, 0, 0.06, 1.5, 2.0), color: '#f2d33a' },
        ]), crowdPropMaterial, 8, false, false),
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
        if (crowdRecording) recordInstance(part, part.n);
        part.n++;
      }
      /**
       * STILL FIGURES
       * Someone lying still (a sunbather, a body) packs the same instances frame
       * after frame, so once their pose has settled the instances are recorded
       * and copied back in on later frames instead of rebuilding the skeleton.
       */
      let crowdRecording = null,
        crowdStillCount = 0,
        crowdStillShown = 0;
      function recordInstance(part, i) {
        const data = new Float32Array(16 + (part.paint ? 6 : 3));
        data.set(part.mesh.instanceMatrix.array.subarray(i * 16, i * 16 + 16));
        if (part.paint) {
          data.set(part.paint.array.subarray(i * 4, i * 4 + 4), 16);
          data.set(part.meta.array.subarray(i * 2, i * 2 + 2), 20);
        } else if (part.mesh.instanceColor) data.set(part.mesh.instanceColor.array.subarray(i * 3, i * 3 + 3), 16);
        crowdRecording.push(part, data);
      }
      function replayInstances(records) {
        for (let r = 0; r < records.length; r += 2) {
          const part = records[r],
            data = records[r + 1],
            i = part.n;
          if (i >= part.capacity) continue;
          const m = part.mesh.instanceMatrix.array;
          for (let k = 0, o = i * 16; k < 16; k++) m[o + k] = data[k];
          if (part.paint) {
            const pa = part.paint.array,
              ma = part.meta.array;
            pa[i * 4] = data[16];
            pa[i * 4 + 1] = data[17];
            pa[i * 4 + 2] = data[18];
            pa[i * 4 + 3] = data[19];
            ma[i * 2] = data[20];
            ma[i * 2 + 1] = data[21];
          } else if (part.mesh.instanceColor && data.length > 16) {
            const c = part.mesh.instanceColor.array;
            c[i * 3] = data[16];
            c[i * 3 + 1] = data[17];
            c[i * 3 + 2] = data[18];
          }
          part.n++;
        }
      }
      const STILL_POSES = new Set(['lieBack', 'lieFront', 'recline', 'sitGround']);
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
        if (crowdRecording) recordInstance(part, i);
        part.n++;
      }
      const dogColors = new Map();
      const umbrellaColors = new Map();
      function cachedCrowdColor(map, hex) {
        let c = map.get(hex);
        if (!c) map.set(hex, (c = new Three.Color(hex)));
        return c;
      }
