      // Street avatars' mid level: the same avatars' 1k-triangle meshes drawn instanced, one batch per avatar in view, each
      // instance's bones a row of one float texture.
      /**
       * NPC MID BATCHES
       * People between the near and the mid reach (npc-avatar3d.js NPC_REACH) are drawn from their avatar's low mesh
       * (tools/npc_models.py: the same vertices as the near mesh, a 1k-triangle index, so face and clothes match).
       * NPC_MID_BATCHES meshes stand in the scene from the start (a placeholder, so the title prewarm compiles the two
       * programs); each frame a batch takes one avatar's InstancedBufferGeometry and draws its people as instances
       * (gl_InstanceID from the batch's row `npcBase`). npcBoneTexture holds a row per person: the 15 bones' rotation
       * quaternions, then their duals, then (scale, left grip, right grip, lost bones). A lost bone folds onto its own
       * joint (gone, as on a near avatar; the crowd's stump stands there). No wound soaks at this distance (the blood
       * decals and pools still show). An avatar beyond the batches in view this frame stays on the rig.
       */
      const NPC_MID_BATCHES = 16,
        NPC_BONE_TEXELS = 32;
      const npcBoneData = new Float32Array(NPC_BONE_TEXELS * 4 * NPC_MID_MAX),
        npcBoneTexture = new Three.DataTexture(npcBoneData, NPC_BONE_TEXELS, NPC_MID_MAX, Three.RGBAFormat, Three.FloatType);
      npcBoneTexture.magFilter = npcBoneTexture.minFilter = Three.NearestFilter;
      npcBoneTexture.generateMipmaps = false;
      for (let r = 0; r < NPC_MID_MAX; r++) {
        for (let b = 0; b < PB_BONES; b++) npcBoneData[(r * NPC_BONE_TEXELS + b) * 4 + 3] = 1;
        npcBoneData[(r * NPC_BONE_TEXELS + 2 * PB_BONES) * 4] = 1;
      }
      npcBoneTexture.needsUpdate = true;
      /* An avatar's mid level: its near geometry's attributes, the mid index, drawn instanced. */
      function npcMidGeometry(geometry, indexMid) {
        const g = new Three.InstancedBufferGeometry();
        for (const [name] of NPC_ATTRIBUTES) g.setAttribute(name, geometry.getAttribute(name));
        g.setIndex(new Three.BufferAttribute(indexMid, 1));
        g.instanceCount = 0;
        g.boundingSphere = new Three.Sphere(new Three.Vector3(0, 7, 0), 9);
        return g;
      }
      const npcMidPlaceholder = npcMidGeometry(npcPlaceholder, new Uint16Array([0, 1, 2]));
      npcMidPlaceholder.instanceCount = 1;
      const npcMidBatches = Array.from({ length: NPC_MID_BATCHES }, (_, i) => {
        const uniforms = {
            npcBones: { value: npcBoneTexture },
            npcBase: { value: 0 },
            npcCut: { value: Array.from({ length: PB_BONES }, () => new Three.Vector3()) },
            npcWound: { value: Array.from({ length: 4 }, () => new Three.Vector4()) },
            npcMap: { value: npcAvatarMap },
          },
          material = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0, side: Three.DoubleSide, shadowSide: Three.BackSide }),
          depth = new Three.MeshDepthMaterial({ depthPacking: Three.RGBADepthPacking, side: Three.DoubleSide });
        material.defines = { NPC_MID: '' };
        depth.defines = { NPC_MID: '' };
        material.onBeforeCompile = (shader) => npcMaterialPatch(shader, uniforms);
        material.customProgramCacheKey = () => 'npc-avatar-mid';
        depth.onBeforeCompile = (shader) => npcDepthPatch(shader, uniforms);
        depth.customProgramCacheKey = () => 'npc-avatar-mid-depth';
        const mesh = new Three.Mesh(npcMidPlaceholder, material);
        mesh.name = 'npc avatar batch ' + i;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.customDepthMaterial = depth;
        mesh.userData.dynamic = true;
        scene.add(mesh);
        return { mesh, uniforms, avatar: -1, count: 0 };
      });
      // The mid people this frame (records like the near slots, without a mesh), and which batch each avatar takes.
      const npcMidRecords = Array.from({ length: NPC_MID_MAX }, () => ({ frames: Array.from({ length: PB_BONES }, () => new Three.Matrix4()), posed: 0, person: null, avatar: -1, width: 1, gripL: 0.15, gripR: 0.15, batch: -1, uniforms: null })),
        npcBatchOf = new Int16Array(64).fill(-1),
        npcBatchFrame = new Int32Array(64).fill(-1),
        npcBatchStart = new Int16Array(NPC_MID_BATCHES),
        npcBatchFill = new Int16Array(NPC_MID_BATCHES);
      /* A mid record for an avatar, or null when the mid people or the batches are used up (the rig then). */
      function npcMidTake(avatar) {
        const N = npcAv;
        if (N.usedMid >= N.capMid) return null;
        if (npcBatchFrame[avatar] !== N.frame) {
          if (N.batches >= NPC_MID_BATCHES) return null;
          npcBatchFrame[avatar] = N.frame;
          npcBatchOf[avatar] = N.batches;
          npcMidBatches[N.batches].avatar = avatar;
          npcMidBatches[N.batches].count = 0;
          N.batches++;
        }
        const r = npcMidRecords[N.usedMid++],
          b = npcBatchOf[avatar];
        r.batch = b;
        npcMidBatches[b].count++;
        r.gripL = r.gripR = 0.15;
        return r;
      }
      /* After packing (npcAvatarFlush): each mid person's row, grouped by batch, and the batches shown. */
      function npcMidFlush() {
        const N = npcAv,
          all = (1 << PB_BONES) - 1,
          data = npcBoneData;
        let start = 0,
          wrongSex = 0,
          shown = 0,
          triangles = 0;
        for (let k = 0; k < N.batches; k++) {
          npcBatchStart[k] = start;
          npcBatchFill[k] = 0;
          start += npcMidBatches[k].count;
        }
        for (let i = 0; i < N.usedMid; i++) {
          const r = npcMidRecords[i],
            fit = N.fits[r.avatar],
            row = npcBatchStart[r.batch] + npcBatchFill[r.batch]++,
            o = row * NPC_BONE_TEXELS * 4,
            ex = o + 2 * PB_BONES * 4;
          if (r.posed !== all) {
            // Not posed this frame (an early return in drawCrowdPerson): nothing drawn for this row.
            data[ex] = 0;
            r.posed = 0;
            r.person = null;
            continue;
          }
          r.posed = 0;
          shown++;
          triangles += fit.trianglesMid;
          for (let b = 0; b < PB_BONES; b++) {
            const e = r.frames[b].elements,
              sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]),
              sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]),
              sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
            npcRot.set(e[0] / sx, e[4] / sy, e[8] / sz, 0, e[1] / sx, e[5] / sy, e[9] / sz, 0, e[2] / sx, e[6] / sy, e[10] / sz, 0, 0, 0, 0, 1);
            npcQ.setFromRotationMatrix(npcRot);
            npcQ.multiply(npcQInv.copy(fit.bindQ[b]).invert());
            if (b === 0) data[ex] = sx;
            npcO.copy(fit.bindO[b]).multiplyScalar(sx).applyQuaternion(npcQ);
            npcT.set(e[12] - npcO.x, e[13] - npcO.y, e[14] - npcO.z);
            const q = o + b * 4,
              d = o + (PB_BONES + b) * 4;
            data[q] = npcQ.x;
            data[q + 1] = npcQ.y;
            data[q + 2] = npcQ.z;
            data[q + 3] = npcQ.w;
            data[d] = 0.5 * (npcT.x * npcQ.w + npcT.y * npcQ.z - npcT.z * npcQ.y);
            data[d + 1] = 0.5 * (-npcT.x * npcQ.z + npcT.y * npcQ.w + npcT.z * npcQ.x);
            data[d + 2] = 0.5 * (npcT.x * npcQ.y - npcT.y * npcQ.x + npcT.z * npcQ.w);
            data[d + 3] = -0.5 * (npcT.x * npcQ.x + npcT.y * npcQ.y + npcT.z * npcQ.z);
          }
          data[ex + 1] = r.gripL;
          data[ex + 2] = r.gripR;
          data[ex + 3] = npcLostBones(r.person.goreLost || 0);
          if (npcMidState.audit && fit.female !== personFemale(r.person)) wrongSex++;
          r.person = null;
        }
        for (let k = 0; k < NPC_MID_BATCHES; k++) {
          const batch = npcMidBatches[k],
            on = k < N.batches && batch.count > 0;
          if (batch.mesh.visible !== on) batch.mesh.visible = on;
          if (!on) continue;
          const fit = N.fits[batch.avatar];
          if (batch.mesh.geometry !== fit.midGeometry) batch.mesh.geometry = fit.midGeometry;
          fit.midGeometry.instanceCount = batch.count;
          batch.uniforms.npcBase.value = npcBatchStart[k];
          // A lost bone folds onto its own joint.
          for (let b = 0; b < PB_BONES; b++) batch.uniforms.npcCut.value[b].copy(fit.bindO[b]);
        }
        if (N.usedMid) {
          npcBoneTexture.needsUpdate = true;
          if (!npcMidState.firstShow) npcMidState.firstShow = npcMidPrograms();
        }
        N.shownMid = shown;
        if (npcMidState.audit) npcMidState.wrongSex = wrongSex;
        N.trianglesMid = triangles;
        N.batchesShown = N.batches;
        N.batches = 0;
      }
      const npcMidState = { firstShow: null, audit: false, wrongSex: 0 };
      /* gore.js's lost parts as the bones that fold (PB_GORE_CUTS). */
      function npcLostBones(lost) {
        if (!lost) return 0;
        let mask = 0;
        for (let i = 0; i < PB_GORE_CUTS.length; i++) {
          const c = PB_GORE_CUTS[i];
          if (lost & c[0]) for (let j = 0; j < c[2].length; j++) mask |= 1 << c[2][j];
        }
        return mask;
      }
      function npcMidPrograms() {
        const m = npcMidBatches[0].mesh;
        return { camera: !!renderer.properties.get(m.material).currentProgram, shadow: !!renderer.properties.get(m.customDepthMaterial).currentProgram };
      }
