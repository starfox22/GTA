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
       * a frame that posed it. Weapons, phones and props stay the crowd's, but his hands take them his way
       * (player-body3d-grips.js): round the grip, the trigger finger along the guard, the other hand under the
       * handguard or round the firing hand. His eyes look where he aims (or glance about) and blink.
       *
       * BUILD: the meshes take about a second of work, so pbBuildSteps runs as a generator a few milliseconds
       * at a time from the renderer's start (more behind the title, less in play), fine on HIGH and ULTRA and
       * coarse on LOW and MEDIUM (PB_SPACINGS). If play starts before it is done, the rest is done at once on
       * the first frame of play (playerBodyStart), so he is never seen in the crowd's body; a tier change of
       * class rebuilds in slices behind the old mesh. The material is on the scene from the start (a placeholder
       * with every attribute), so the title prewarm compiles both programs (`playerModel().programs`).
       */
      // @include src/player-body3d-mesher.js
      // @include src/player-body3d-anatomy.js
      // @include src/player-body3d-head.js
      // @include src/player-body3d-extremities.js
      // @include src/player-body3d-build.js
      // @include src/player-body3d-shader.js
      // @include src/player-body3d-grips.js
      const pbUniforms = {
        pbQr: { value: Array.from({ length: PB_BONES }, () => new Three.Vector4(0, 0, 0, 1)) },
        pbQd: { value: Array.from({ length: PB_BONES }, () => new Three.Vector4(0, 0, 0, 0)) },
        pbScale: { value: 1 },
        pbGripAmount: { value: new Three.Vector2(0.15, 0.15) },
        pbTrigger: { value: new Three.Vector2(0, 0) },
        pbBlink: { value: 0 },
        pbGaze: { value: new Three.Vector2(0, 0) },
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
      const PB_ATTRIBUTES = [
        ['position', 3],
        ['normal', 3],
        ['pbSkin', 4],
        ['pbGrip', 4],
        ['pbGripN', 3],
        ['pbTrig', 3],
        ['pbTrigN', 3],
        ['pbZone', 4],
      ];
      /* A geometry with every attribute the body has (the placeholder until the build is done). */
      function pbGeometry(data) {
        const g = new Three.BufferGeometry();
        for (const [name, size] of PB_ATTRIBUTES) g.setAttribute(name, new Three.BufferAttribute(data.attributes[name], size));
        // (Under 65,536 vertices: a 16-bit index.)
        g.setIndex(new Three.BufferAttribute(data.attributes.position.length / 3 < 65536 ? Uint16Array.from(data.index) : data.index, 1));
        g.boundingSphere = new Three.Sphere(new Three.Vector3(0, 7, 0), 9);
        return g;
      }
      const playerBodyMesh = (() => {
        const placeholder = pbGeometry({
          attributes: Object.fromEntries(PB_ATTRIBUTES.map(([name, size]) => [name, new Float32Array(3 * size)])),
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
        detail: null,
        building: null,
        build: null,
        bindQ: [],
        bindO: [],
        frames: Array.from({ length: PB_BONES }, () => new Three.Matrix4()),
        posed: 0,
        shown: false,
        grip: [0.15, 0.15, 0, 0],
        slices: 0,
        workMs: 0,
        finishedAtStart: false,
        firstShow: null,
        blinkAt: 2,
        blinkStart: -1,
        gazeAt: 0,
        gazeYaw: 0,
        gazePitch: 0,
        gazeWantYaw: 0,
        gazeWantPitch: 0,
      };
      /* The meshing the tier asks for: fine on HIGH and ULTRA, coarse on LOW and MEDIUM. */
      function pbDetailWanted() {
        const name = (activeTier || graphicsTier()).name;
        return name === 'LOW' || name === 'MEDIUM' ? 'coarse' : 'fine';
      }
      function pbBuildStep(finish = false) {
        if (pbState.error) return;
        if (!pbState.build) {
          pbState.building = pbDetailWanted();
          pbState.build = pbBuildSteps(pbState.building);
        }
        const t0 = performance.now(),
          budget = finish ? 1e9 : gameMode === 'menu' ? 12 : 4;
        pbClock.until = t0 + budget;
        let r;
        try {
          r = pbState.build.next();
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
          setTimeout(() => pbBuildStep(), gameMode === 'menu' ? 2 : 12);
          return;
        }
        pbState.build = null;
        const data = r.value,
          old = playerBodyMesh.geometry;
        // Only the summary is kept: the arrays live on in the geometry's attributes.
        pbState.data = { ms: data.ms, vertices: data.vertices, triangles: data.triangles, parts: data.parts };
        pbState.detail = data.detail;
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
        if (!pbState.ready) bootMark('player-body');
        pbState.ready = true;
      }
      setTimeout(() => pbBuildStep(), 0);
      /**
       * Play begins (the first frame packing the crowd outside the menu): a build still running is finished at
       * once, in the frame play starts, so the player never shows in the crowd's body first. Later, a change of
       * tier class (LOW/MEDIUM against HIGH/ULTRA) rebuilds in slices while the old mesh stays.
       */
      function playerBodyStart() {
        if (pbState.error) return;
        if (!pbState.ready) {
          if (gameMode === 'menu') return;
          pbState.finishedAtStart = true;
          pbBuildStep(true);
          return;
        }
        if (!pbState.build && pbState.detail !== pbDetailWanted()) {
          pbState.build = pbBuildSteps((pbState.building = pbDetailWanted()));
          setTimeout(() => pbBuildStep(), 0);
        }
      }
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
      /* How far each hand closes (0 relaxed to 1 gripping) and whether its index finger lies along a trigger guard. */
      function playerBodyGrip(left, right, triggerLeft = 0, triggerRight = 0) {
        pbState.grip[0] = left;
        pbState.grip[1] = right;
        pbState.grip[2] = triggerLeft;
        pbState.grip[3] = triggerRight;
      }
      const pbRot = new Three.Matrix4(),
        pbQ = new Three.Quaternion(),
        pbQInv = new Three.Quaternion(),
        pbT = new Three.Vector3(),
        pbO = new Three.Vector3(),
        pbLook = new Three.Vector3();
      /**
       * EYES: a blink every 2-6 s (now and then two), 0.16 s down and up; the eyes lead the head to where he
       * aims (the chase camera's pitch when it is the view), else small glances about the way he faces, each a
       * quick jump (a saccade) and then still. Head-relative yaw and pitch, clamped to what eyes can turn.
       * (Looks only: Math.random is fine here, nothing in the game reads them.)
       */
      function pbEyes(head) {
        const t = gameTime;
        if (t >= pbState.blinkAt || pbState.blinkAt - t > 10) {
          pbState.blinkStart = t;
          pbState.blinkAt = t + (Math.random() < 0.15 ? 0.3 : 2 + Math.random() * 4);
        }
        const k = (t - pbState.blinkStart) / 0.16;
        pbUniforms.pbBlink.value = k >= 0 && k < 1 ? Math.sin(Math.PI * k) : 0;
        const e = head.elements,
          sx = Math.hypot(e[0], e[1], e[2]) || 1,
          aimHeading = playerAimFacing();
        if (aimHeading !== null) {
          const pitch = chaseViewActive ? -(chaseCam.viewPitch || 0) : 0;
          // The map heading in three.js's frame (map x, elevation, map y).
          pbLook.set(Math.cos(aimHeading) * Math.cos(pitch), Math.sin(pitch), Math.sin(aimHeading) * Math.cos(pitch));
          // Into the head's frame (x forward, y up, z right).
          const f = (e[0] * pbLook.x + e[1] * pbLook.y + e[2] * pbLook.z) / sx,
            u = (e[4] * pbLook.x + e[5] * pbLook.y + e[6] * pbLook.z) / sx,
            r = (e[8] * pbLook.x + e[9] * pbLook.y + e[10] * pbLook.z) / sx;
          pbState.gazeWantYaw = clamp(Math.atan2(r, f), -0.55, 0.55);
          pbState.gazeWantPitch = clamp(Math.asin(clamp(u, -1, 1)), -0.35, 0.3);
        } else if (t >= pbState.gazeAt || pbState.gazeAt - t > 10) {
          pbState.gazeAt = t + 0.8 + Math.random() * 2.2;
          pbState.gazeWantYaw = (Math.random() - 0.5) * 0.5;
          pbState.gazeWantPitch = (Math.random() - 0.6) * 0.18;
        }
        const ease = 1 - Math.exp(-(lastDelta || 1 / 60) * 30);
        pbState.gazeYaw += (pbState.gazeWantYaw - pbState.gazeYaw) * ease;
        pbState.gazePitch += (pbState.gazeWantPitch - pbState.gazePitch) * ease;
        pbUniforms.pbGaze.value.set(pbState.gazeYaw, pbState.gazePitch);
      }
      /* Per frame, after the crowd is packed: the bones' dual quaternions from the captured joints. */
      function playerBodyFlush() {
        const all = (1 << PB_BONES) - 1,
          shown = pbState.ready && pbState.posed === all;
        pbState.posed = 0;
        pbState.shown = shown;
        if (playerBodyMesh.visible !== shown) playerBodyMesh.visible = shown;
        if (!shown) return;
        // Evidence for the prewarm: did both programs exist before he was first drawn?
        if (!pbState.firstShow) pbState.firstShow = pbPrograms();
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
        pbUniforms.pbTrigger.value.set(pbState.grip[2], pbState.grip[3]);
        pbEyes(pbState.frames[2]);
      }
      /* Whether the camera and the shadow programs exist (compiled by the prewarm or a draw). */
      function pbPrograms() {
        return { camera: !!renderer.properties.get(playerBodyMaterial).currentProgram, shadow: !!renderer.properties.get(playerBodyDepth).currentProgram };
      }
      /* Console (DeadEndCity.playerModel): the body's build, size and parts, and whether it drew this frame;
         `finish` completes a build still running in slices at once (tests and tools). */
      function playerBodyReport(finish = false) {
        if (finish && (!pbState.ready || pbState.build)) pbBuildStep(true);
        const d = pbState.data;
        return {
          ready: pbState.ready,
          enabled: pbState.enabled,
          error: pbState.error || null,
          detail: pbState.detail,
          rebuilding: pbState.ready && !!pbState.build,
          shown: pbState.shown,
          visible: playerBodyMesh.visible,
          buildMs: d ? d.ms : null,
          workMs: Math.round(pbState.workMs),
          slices: pbState.slices,
          // The build ran out of time behind the title and was finished on the first frame of play.
          finishedAtStart: pbState.finishedAtStart,
          vertices: d ? d.vertices : 0,
          triangles: d ? d.triangles : 0,
          parts: d ? d.parts : null,
          grip: pbState.grip.slice(),
          blink: +pbUniforms.pbBlink.value.toFixed(2),
          gaze: [+pbState.gazeYaw.toFixed(2), +pbState.gazePitch.toFixed(2)],
          // Programs now, and when he was first drawn (true there: the prewarm compiled them first).
          programs: pbPrograms(),
          programsAtFirstDraw: pbState.firstShow,
          drawCalls: { camera: 1, shadow: playerBodyMesh.castShadow ? 1 : 0 },
        };
      }
