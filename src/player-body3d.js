      // The player's own body: one skinned mesh (a man in his forties in a black tee, jeans and leather shoes) posed by
      // the crowd rig's skeleton every frame, built from signed distance fields in slices behind the title.
      /**
       * PLAYER BODY
       * The player is not drawn from the crowd's instanced parts but from a body of his own (one draw, one
       * shadow draw): realistic adult proportions at the rig's joints (character-rig3d.js RIG), modelled as
       * signed distance fields and meshed by surface nets (player-body3d-mesher.js): the clothed body
       * (anatomy), the head with the face and the hair (head), hands and shoes (extremities). Each vertex
       * follows two of the rig's 15 bones as dual quaternions (shader), so the joints bend without gaps or
       * candy-wrapping, and keeps its part (head, torso, pelvis, upper/lower arms and legs, hands, feet) for
       * anything that must tell them apart.
       *
       * POSING: drawCrowdPerson (crowd3d-draw.js) poses everyone the same way; for the player (his spec's
       * `rim`, in his own outfit: playerBodyOn) it draws the body set BODY_PLAYER, whose body parts are empty,
       * and hands the joint matrices to playerBodyBone and the hands' grip to playerBodyGrip instead.
       * playerBodyFlush (finishCrowd3D) turns them into the bones' dual quaternions and shows the mesh only on
       * a frame that posed it. Weapons, phones and props stay the crowd's.
       *
       * BUILD: the meshes take about a second of work, so pbBuildSteps runs as a generator a few milliseconds
       * at a time from the renderer's start (more behind the title, less in play). Until it is done the player
       * is drawn from the near set as before (playerBodyOn is false). The material is on the scene from the
       * start (a placeholder triangle with every attribute), so the title prewarm compiles both programs.
       */
      // @include src/player-body3d-mesher.js
      // @include src/player-body3d-anatomy.js
      // @include src/player-body3d-head.js
      // @include src/player-body3d-extremities.js
      // @include src/player-body3d-build.js
      // @include src/player-body3d-shader.js
      const pbUniforms = {
        pbQr: { value: Array.from({ length: PB_BONES }, () => new Three.Vector4(0, 0, 0, 1)) },
        pbQd: { value: Array.from({ length: PB_BONES }, () => new Three.Vector4(0, 0, 0, 0)) },
        pbScale: { value: 1 },
        pbGripAmount: { value: new Three.Vector2(0.15, 0.15) },
      };
      const playerBodyMaterial = (() => {
          const material = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0 });
          material.onBeforeCompile = pbMaterialPatch;
          material.customProgramCacheKey = () => 'player-body';
          return material;
        })(),
        playerBodyDepth = (() => {
          const material = new Three.MeshDepthMaterial({ depthPacking: Three.RGBADepthPacking });
          material.onBeforeCompile = pbDepthPatch;
          material.customProgramCacheKey = () => 'player-body-depth';
          return material;
        })();
      /* A geometry with every attribute the body has (the placeholder until the build is done). */
      function pbGeometry(data) {
        const g = new Three.BufferGeometry(),
          a = data.attributes;
        g.setAttribute('position', new Three.BufferAttribute(a.position, 3));
        g.setAttribute('normal', new Three.BufferAttribute(a.normal, 3));
        g.setAttribute('pbSkin', new Three.BufferAttribute(a.pbSkin, 4));
        g.setAttribute('pbGrip', new Three.BufferAttribute(a.pbGrip, 4));
        g.setAttribute('pbGripN', new Three.BufferAttribute(a.pbGripN, 3));
        g.setAttribute('pbZone', new Three.BufferAttribute(a.pbZone, 4));
        // (Under 65,536 vertices: a 16-bit index.)
        g.setIndex(new Three.BufferAttribute(data.index.length && data.attributes.position.length / 3 < 65536 ? Uint16Array.from(data.index) : data.index, 1));
        g.boundingSphere = new Three.Sphere(new Three.Vector3(0, 7, 0), 9);
        return g;
      }
      const playerBodyMesh = (() => {
        const placeholder = pbGeometry({
          attributes: {
            position: new Float32Array(9),
            normal: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
            pbSkin: new Float32Array(12),
            pbGrip: new Float32Array(12),
            pbGripN: new Float32Array(9),
            pbZone: new Float32Array(12),
          },
          index: new Uint32Array([0, 1, 2]),
        });
        const mesh = new Three.Mesh(placeholder, playerBodyMaterial);
        mesh.name = 'player body';
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.customDepthMaterial = playerBodyDepth;
        mesh.userData.dynamic = true;
        scene.add(mesh);
        return mesh;
      })();
      // The bind skeleton in rig units (rotation as a quaternion, origin) once built; the frame's captured joints.
      const pbState = {
          ready: false,
          enabled: true,
          error: '',
          data: null,
          bindQ: [],
          bindO: [],
          frames: Array.from({ length: PB_BONES }, () => new Three.Matrix4()),
          posed: 0,
          shown: false,
          grip: [0.15, 0.15],
          slices: 0,
          workMs: 0,
          started: performance.now(),
        },
        pbBuild = pbBuildSteps();
      function pbBuildStep(finish = false) {
        if (pbState.ready || pbState.error) return;
        const t0 = performance.now(),
          budget = finish ? 1e9 : gameMode === 'menu' ? 9 : 4;
        pbClock.until = t0 + budget;
        let r;
        try {
          r = pbBuild.next();
        } catch (error) {
          pbState.error = String(error).slice(0, 200);
          console.error('player body: build failed', error);
          return;
        } finally {
          pbClock.until = Infinity;
        }
        pbState.slices++;
        pbState.workMs += performance.now() - t0;
        if (!r.done) {
          if (finish) return pbBuildStep(true);
          setTimeout(() => pbBuildStep(), gameMode === 'menu' ? 4 : 12);
          return;
        }
        const data = r.value,
          old = playerBodyMesh.geometry;
        pbState.data = data;
        for (let b = 0; b < PB_BONES; b++) {
          const bone = data.bones[b],
            R = bone.R,
            m = new Three.Matrix4().set(R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, 0, 0, 0, 1);
          pbState.bindQ[b] = new Three.Quaternion().setFromRotationMatrix(m);
          pbState.bindO[b] = new Three.Vector3(bone.o[0] * PB_UNITS, bone.o[1] * PB_UNITS, bone.o[2] * PB_UNITS);
        }
        playerBodyMesh.geometry = pbGeometry(data);
        old.dispose();
        // Its buffers go to the GPU now (render3d-resources.js OFF-SCREEN UPLOAD), not in the frame he first shows.
        const shown = playerBodyMesh.visible;
        playerBodyMesh.visible = true;
        try {
          uploadMeshes([playerBodyMesh], false);
        } catch (error) {
          console.warn('player body: upload', error);
        }
        playerBodyMesh.visible = shown;
        pbState.ready = true;
        pbState.builtAt = performance.now();
        bootMark('player-body');
      }
      setTimeout(() => pbBuildStep(), 0);
      // The body set the player is drawn from: the close set's kit and hats, its own parts left empty.
      const PB_EMPTY_PART = { mesh: null, n: 0, capacity: 0 };
      const BODY_PLAYER = { ...BODY_CLOSE };
      for (const name of ['head', 'torsoM', 'torsoF', 'pelvisM', 'pelvisF', 'upperArm', 'forearm', 'hand', 'thighM', 'thighF', 'shin', 'shoe', 'boot', ...NEAR_HAIR]) BODY_PLAYER[name] = PB_EMPTY_PART;
      /* Whether the player (in `look`) is drawn from his own body this frame. */
      function playerBodyOn(look) {
        return pbState.ready && pbState.enabled && look?.outfit === 'player';
      }
      function playerBodyBone(i, matrix) {
        pbState.frames[i].copy(matrix);
        pbState.posed |= 1 << i;
      }
      function playerBodyGrip(left, right) {
        pbState.grip[0] = left;
        pbState.grip[1] = right;
      }
      const pbRot = new Three.Matrix4(),
        pbQ = new Three.Quaternion(),
        pbQInv = new Three.Quaternion(),
        pbT = new Three.Vector3(),
        pbO = new Three.Vector3();
      /* Per frame, after the crowd is packed: the bones' dual quaternions from the captured joints. */
      function playerBodyFlush() {
        const all = (1 << PB_BONES) - 1,
          shown = pbState.ready && pbState.posed === all;
        pbState.posed = 0;
        pbState.shown = shown;
        if (playerBodyMesh.visible !== shown) playerBodyMesh.visible = shown;
        if (!shown) return;
        const qr = pbUniforms.pbQr.value,
          qd = pbUniforms.pbQd.value;
        for (let b = 0; b < PB_BONES; b++) {
          const e = pbState.frames[b].elements,
            sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]),
            sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]),
            sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
          pbRot.set(e[0] / sx, e[4] / sy, e[8] / sz, 0, e[1] / sx, e[5] / sy, e[9] / sz, 0, e[2] / sx, e[6] / sy, e[10] / sz, 0, 0, 0, 0, 1);
          pbQ.setFromRotationMatrix(pbRot);
          // From bind to now: R R0^T, and the translation that puts the bind origin on the joint.
          pbQ.multiply(pbQInv.copy(pbState.bindQ[b]).invert());
          if (b === 0) pbUniforms.pbScale.value = sx;
          pbO.copy(pbState.bindO[b]).multiplyScalar(sx).applyQuaternion(pbQ);
          pbT.set(e[12] - pbO.x, e[13] - pbO.y, e[14] - pbO.z);
          qr[b].set(pbQ.x, pbQ.y, pbQ.z, pbQ.w);
          // Dual part: half the translation times the rotation.
          qd[b].set(
            0.5 * (pbT.x * pbQ.w + pbT.y * pbQ.z - pbT.z * pbQ.y),
            0.5 * (-pbT.x * pbQ.z + pbT.y * pbQ.w + pbT.z * pbQ.x),
            0.5 * (pbT.x * pbQ.y - pbT.y * pbQ.x + pbT.z * pbQ.w),
            -0.5 * (pbT.x * pbQ.x + pbT.y * pbQ.y + pbT.z * pbQ.z),
          );
        }
        pbUniforms.pbGripAmount.value.set(pbState.grip[0], pbState.grip[1]);
      }
      /* Console (DeadEndCity.playerModel): the body's build, size and parts, and whether it drew this frame;
         `finish` completes a build still running in slices at once (tests and tools). */
      function playerBodyReport(finish = false) {
        if (finish && !pbState.ready) pbBuildStep(true);
        const d = pbState.data;
        return {
          ready: pbState.ready,
          enabled: pbState.enabled,
          error: pbState.error || null,
          shown: pbState.shown,
          visible: playerBodyMesh.visible,
          buildMs: d ? d.ms : null,
          workMs: Math.round(pbState.workMs),
          slices: pbState.slices,
          vertices: d ? d.vertices : 0,
          triangles: d ? d.triangles : 0,
          parts: d ? d.parts : null,
          grip: pbState.grip.slice(),
          drawCalls: { camera: 1, shadow: playerBodyMesh.castShadow ? 1 : 0 },
        };
      }
