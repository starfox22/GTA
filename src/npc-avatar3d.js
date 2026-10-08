      // Street avatars: the people nearest the camera drawn as Microsoft Rocketbox avatars (MIT; tools/npc_models.py),
      // skinned on the rig's skeleton like the player's own body, a few reusable slots of one draw each.
      /**
       * NPC AVATARS
       * Everyone on foot is posed by the one rig (crowd3d-draw.js drawCrowdPerson). The few people nearest the camera
       * are drawn from a skinned avatar instead of the rig's parts: in the chase view the NEAR PEOPLE
       * (crowd3d-frame.js chooseNearPeople), in the street view the nearest to the player once the zoom shows a figure
       * big enough (npcAvatarChoose), at most NPC_TIER_SLOTS by tier. Which avatar a person is comes from their
       * look (compileLook: npcAvatarPick, npc-avatar-cast.js); further off they stay on the rig, painted in the
       * avatar's colours. People with no avatar (story characters, waiters, the player in a disguise), riders,
       * beachgoers, athletes and other cars' occupants stay on the rig.
       *
       * SLOTS: NPC_AVATAR_SLOTS meshes, each with its own material and depth material (one program each between
       * them: the uniforms are per material), in the scene from the start on a placeholder so the title prewarm
       * compiles both programs. A slot takes the avatar's geometry (each fitted and uploaded once, behind the title)
       * and the person's bones; drawCrowdPerson draws them with BODY_AVATAR (no body parts, no clothing kit: weapons,
       * props and gore stumps stay the crowd's) at the avatar's own shoulder width, and hands the joints to
       * npcAvatarBone. npcAvatarFlush shows a slot only on a frame that posed all 15 bones.
       *
       * GORE: a lost part folds onto its cut (the player's PB_GORE_CUTS) where the crowd's stump stands; wounds soak as
       * on the player (npcAvatarGore, from `p.goreWounds`). Severed pieces are still the rig's, in the avatar's
       * colours (compileLook gives the rig the avatar's palette).
       */
      // @include src/npc-avatar3d-fit.js
      // @include src/npc-avatar3d-shader.js
      const NPC_AVATAR_SLOTS = 8,
        NPC_TIER_SLOTS = { LOW: 4, MEDIUM: 6, HIGH: 8, ULTRA: 8 },
        // The street view: avatars once a figure is big enough (the zoom detail 2 starts at), within this reach of the
        // player (units), kept a little further once chosen.
        NPC_STREET_ZOOM = 1.3,
        NPC_STREET_REACH = 22 * UNITS_PER_METRE,
        NPC_STREET_KEEP = 0.86;
      const npcAvatarMap = (() => {
        const texture = new Three.Texture();
        texture.colorSpace = Three.SRGBColorSpace;
        texture.anisotropy = 4;
        const url = typeof ASSETS !== 'undefined' && ASSETS.npcSkin;
        if (url && typeof Image !== 'undefined') {
          const image = new Image();
          image.onload = () => {
            texture.image = image;
            texture.needsUpdate = true;
            try {
              renderer.initTexture(texture);
            } catch (error) {}
          };
          image.src = url;
        }
        return texture;
      })();
      const NPC_ATTRIBUTES = [
        ['position', 3],
        ['normal', 3],
        ['npcSkin', 4],
        ['npcGrip', 3],
        ['npcZone', 1],
        ['npcUv', 2],
      ];
      function npcGeometry(data) {
        const g = new Three.BufferGeometry();
        for (const [name, size] of NPC_ATTRIBUTES) g.setAttribute(name, new Three.BufferAttribute(data.attributes[name], size));
        g.setIndex(new Three.BufferAttribute(data.index, 1));
        g.boundingSphere = new Three.Sphere(new Three.Vector3(0, 7, 0), 9);
        return g;
      }
      const npcPlaceholder = npcGeometry({ attributes: Object.fromEntries(NPC_ATTRIBUTES.map(([name, size]) => [name, new Float32Array(3 * size)])), index: new Uint16Array([0, 1, 2]) });
      const npcSlots = Array.from({ length: NPC_AVATAR_SLOTS }, (_, i) => {
        const uniforms = {
            npcQr: { value: Array.from({ length: PB_BONES }, () => new Three.Vector4(0, 0, 0, 1)) },
            npcQd: { value: Array.from({ length: PB_BONES }, () => new Three.Vector4(0, 0, 0, 0)) },
            npcScale: { value: 1 },
            npcGripAmount: { value: new Three.Vector2(0.15, 0.15) },
            npcLost: { value: 0 },
            npcCut: { value: Array.from({ length: PB_BONES }, () => new Three.Vector3()) },
            npcWound: { value: Array.from({ length: 4 }, () => new Three.Vector4()) },
            npcMap: { value: npcAvatarMap },
          },
          material = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0, side: Three.DoubleSide }),
          depth = new Three.MeshDepthMaterial({ depthPacking: Three.RGBADepthPacking, side: Three.DoubleSide });
        material.onBeforeCompile = (shader) => npcMaterialPatch(shader, uniforms);
        material.customProgramCacheKey = () => 'npc-avatar';
        depth.onBeforeCompile = (shader) => npcDepthPatch(shader, uniforms);
        depth.customProgramCacheKey = () => 'npc-avatar-depth';
        const mesh = new Three.Mesh(npcPlaceholder, material);
        mesh.name = 'npc avatar ' + i;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.customDepthMaterial = depth;
        mesh.userData.dynamic = true;
        scene.add(mesh);
        return { mesh, material, depth, uniforms, frames: Array.from({ length: PB_BONES }, () => new Three.Matrix4()), posed: 0, person: null, avatar: -1, width: 1, goreFor: null, goreFit: null, goreVersion: -1 };
      });
      const npcAv = {
        enabled: true,
        ready: false,
        error: '',
        fits: [],
        build: null,
        built: 0,
        workMs: 0,
        frame: 0,
        cap: 0,
        used: 0,
        shown: 0,
        triangles: 0,
        firstShow: null,
        chosen: 0,
        list: new Array(NPC_AVATAR_SLOTS).fill(null),
        score: new Float32Array(NPC_AVATAR_SLOTS),
        n: 0,
      };
      // The body set an avatar person is drawn with: the player's (body parts empty) without the clothing kit either.
      const BODY_AVATAR = { ...BODY_PLAYER };
      for (const name of Object.keys(BODY_AVATAR)) BODY_AVATAR[name] = PB_EMPTY_PART;
      /* Fit and upload one avatar a slice (12 ms behind the title, 4 ms in play), from the renderer's start. */
      function* npcAvatarBuildSteps() {
        const asset = npcAvatarAsset();
        if (!asset) return;
        const cast = asset.header.avatars;
        for (let i = 0; i < cast.length; i++) {
          const fit = npcAvatarFitOne(asset, i);
          fit.geometry = npcGeometry(fit);
          fit.bindQ = [];
          fit.bindO = [];
          for (let b = 0; b < PB_BONES; b++) {
            const R = fit.bones[b].R,
              m = new Three.Matrix4().set(R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, 0, 0, 0, 1);
            fit.bindQ[b] = new Three.Quaternion().setFromRotationMatrix(m);
            fit.bindO[b] = new Three.Vector3(fit.bones[b].o[0] * PB_UNITS, fit.bones[b].o[1] * PB_UNITS, fit.bones[b].o[2] * PB_UNITS);
          }
          // Only what the slots read is kept: the arrays live on in the geometry.
          fit.attributes = null;
          fit.index = null;
          fit.name = cast[i].name;
          npcAv.fits[i] = fit;
          // Its buffers to the GPU now, off-screen (render3d-resources.js OFF-SCREEN UPLOAD), not when first seen.
          const mesh = npcSlots[0].mesh,
            visible = mesh.visible;
          mesh.geometry = fit.geometry;
          mesh.visible = true;
          try {
            uploadMeshes([mesh], renderer.shadowMap.enabled);
          } catch (error) {
            console.warn('npc avatars: upload', error);
          }
          mesh.geometry = npcPlaceholder;
          mesh.visible = visible;
          npcAv.built = i + 1;
          yield;
        }
      }
      function npcAvatarBuildStep() {
        if (npcAv.error || npcAv.ready) return;
        if (!npcAv.build) npcAv.build = npcAvatarBuildSteps();
        const t0 = performance.now(),
          budget = gameMode === 'menu' ? 12 : 4;
        let r;
        try {
          do r = npcAv.build.next();
          while (!r.done && performance.now() - t0 < budget * 0.5);
        } catch (error) {
          npcAv.error = String(error).slice(0, 200);
          console.error('npc avatars: build failed', error);
          return;
        }
        npcAv.workMs += performance.now() - t0;
        if (!r.done) {
          setTimeout(npcAvatarBuildStep, gameMode === 'menu' ? 2 : 16);
          return;
        }
        npcAv.build = null;
        npcAv.ready = npcAv.fits.length > 0;
        if (npcAv.ready) bootMark('npc-avatars');
      }
      setTimeout(npcAvatarBuildStep, 0);
      function npcAvatarCap() {
        if (!npcAv.enabled || !npcAv.ready) return 0;
        return NPC_TIER_SLOTS[(activeTier || graphicsTier()).name] ?? 6;
      }
      /* The street view's nearest people to the player (a fixed list, nearest first; nothing allocated). */
      function npcStreetConsider(p, d2) {
        const N = npcAv,
          cap = N.cap;
        if (N.n === cap) {
          if (d2 >= N.score[cap - 1]) return;
          N.n--;
        }
        let i = N.n++;
        while (i > 0 && N.score[i - 1] > d2) {
          N.list[i] = N.list[i - 1];
          N.score[i] = N.score[i - 1];
          i--;
        }
        N.list[i] = p;
        N.score[i] = d2;
      }
      function npcStreetCandidate(p, look, reach2) {
        if (!p || p.hidden || p === player || p.car) return;
        const dx = p.x - player.x,
          dy = p.y - player.y,
          s = crowdState.get(p),
          kept = !!s && s.avatarFrame === npcAv.frame - 1,
          d2 = (dx * dx + dy * dy) * (kept ? NPC_STREET_KEEP * NPC_STREET_KEEP : 1);
        if (d2 > reach2 || !entityInView(p, 30)) return;
        if (compiledLook(look || p.look || ensureLook(p), p).avatar < 0) return;
        npcStreetConsider(p, d2);
      }
      /**
       * Once a frame before packing (updateCrowd3D, after chooseNearPeople): who is drawn as their avatar. The chase
       * view takes the near set; the street view the nearest to the player while zoomed in.
       */
      function npcAvatarChoose(specials) {
        const N = npcAv;
        N.frame++;
        N.used = 0;
        N.chosen = 0;
        N.cap = npcAvatarCap();
        N.n = 0;
        if (!N.cap) return;
        if (chaseViewActive) {
          for (let i = 0; i < crowdNear.n; i++) {
            const q = crowdNear.list[i];
            if (q && q !== player && q !== driveByGhost) {
              stateFor(q).avatarFrame = N.frame;
              N.chosen++;
            }
          }
          return;
        }
        const lod = activeTier ? activeTier.lodBias : 1;
        if ((flightViewActive ? viewZoom : worldZoom) < NPC_STREET_ZOOM * lod || flightViewActive) return;
        const reach2 = NPC_STREET_REACH * NPC_STREET_REACH;
        for (let i = 0; i < pedestrians.length; i++) npcStreetCandidate(pedestrians[i], null, reach2);
        for (let i = 0; i < specials.length; i++) if (specials[i] !== player) npcStreetCandidate(specials[i], specialLook(specials[i]), reach2);
        for (let i = 0; i < N.n; i++) {
          stateFor(N.list[i]).avatarFrame = N.frame;
          N.list[i] = null;
        }
        N.chosen = N.n;
        N.n = 0;
      }
      /** drawCrowdPerson: the slot this person is drawn in this frame, or null (the rig). */
      function npcAvatarTake(p, s, R, detail) {
        const N = npcAv;
        if (s.avatarFrame !== N.frame || R.avatar < 0 || detail < 1 || N.used >= N.cap) return null;
        const fit = N.fits[R.avatar];
        if (!fit || fit.female !== !!R.female) return null;
        const slot = npcSlots[N.used++];
        slot.person = p;
        slot.avatar = R.avatar;
        slot.width = fit.width;
        slot.posed = 0;
        return slot;
      }
      function npcAvatarBone(slot, i, matrix) {
        slot.frames[i].copy(matrix);
        slot.posed |= 1 << i;
      }
      /* A bone for whoever drawCrowdPerson is skinning: an avatar's slot, or the player's own body. */
      function skinBone(slot, i, matrix) {
        if (slot) npcAvatarBone(slot, i, matrix);
        else playerBodyBone(i, matrix);
      }
      function npcAvatarGrip(slot, left, right) {
        slot.uniforms.npcGripAmount.value.set(left, right);
      }
      const npcRot = new Three.Matrix4(),
        npcQ = new Three.Quaternion(),
        npcQInv = new Three.Quaternion(),
        npcT = new Three.Vector3(),
        npcO = new Three.Vector3();
      /* Per frame after the crowd is packed (finishCrowd3D): the used slots' dual quaternions, gore, visibility. */
      function npcAvatarFlush() {
        const all = (1 << PB_BONES) - 1;
        let shown = 0,
          triangles = 0;
        for (let k = 0; k < NPC_AVATAR_SLOTS; k++) {
          const slot = npcSlots[k],
            fit = k < npcAv.used ? npcAv.fits[slot.avatar] : null,
            on = !!fit && slot.posed === all;
          slot.posed = 0;
          if (slot.mesh.visible !== on) slot.mesh.visible = on;
          if (!on) {
            slot.person = null;
            continue;
          }
          if (slot.mesh.geometry !== fit.geometry) slot.mesh.geometry = fit.geometry;
          shown++;
          triangles += fit.triangles;
          const qr = slot.uniforms.npcQr.value,
            qd = slot.uniforms.npcQd.value;
          for (let b = 0; b < PB_BONES; b++) {
            const e = slot.frames[b].elements,
              sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]),
              sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]),
              sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
            npcRot.set(e[0] / sx, e[4] / sy, e[8] / sz, 0, e[1] / sx, e[5] / sy, e[9] / sz, 0, e[2] / sx, e[6] / sy, e[10] / sz, 0, 0, 0, 0, 1);
            npcQ.setFromRotationMatrix(npcRot);
            npcQ.multiply(npcQInv.copy(fit.bindQ[b]).invert());
            if (b === 0) slot.uniforms.npcScale.value = sx;
            npcO.copy(fit.bindO[b]).multiplyScalar(sx).applyQuaternion(npcQ);
            npcT.set(e[12] - npcO.x, e[13] - npcO.y, e[14] - npcO.z);
            qr[b].set(npcQ.x, npcQ.y, npcQ.z, npcQ.w);
            qd[b].set(
              0.5 * (npcT.x * npcQ.w + npcT.y * npcQ.z - npcT.z * npcQ.y),
              0.5 * (-npcT.x * npcQ.z + npcT.y * npcQ.w + npcT.z * npcQ.x),
              0.5 * (npcT.x * npcQ.y - npcT.y * npcQ.x + npcT.z * npcQ.w),
              -0.5 * (npcT.x * npcQ.x + npcT.y * npcQ.y + npcT.z * npcQ.z),
            );
          }
          npcAvatarGore(slot, fit);
        }
        npcAv.shown = shown;
        npcAv.triangles = triangles;
        if (shown && !npcAv.firstShow) npcAv.firstShow = npcAvatarPrograms();
      }
      /* GORE (gore.js state, read only): the person's lost parts fold onto their cuts, up to four wound soaks. */
      function npcAvatarGore(slot, fit) {
        const p = slot.person,
          wounds = p.goreWounds,
          fresh = wounds && wounds.length && gameTime - wounds[wounds.length - 1].t < 24;
        if (slot.goreFor === p && slot.goreVersion === (p.goreVersion || 0) && slot.goreFit === fit && !fresh) return;
        slot.goreFor = p;
        slot.goreFit = fit;
        slot.goreVersion = p.goreVersion || 0;
        const lost = p.goreLost || 0,
          U = slot.uniforms;
        let mask = 0;
        if (lost)
          for (const [bit, cut, parts] of PB_GORE_CUTS)
            if (lost & bit)
              for (const b of parts) {
                if (!(mask & (1 << b))) U.npcCut.value[b].copy(fit.bindO[cut]);
                mask |= 1 << b;
              }
        U.npcLost.value = mask;
        const spots = U.npcWound.value;
        for (let i = 0; i < 4; i++) spots[i].set(0, 0, 0, 0);
        if (!wounds || !wounds.length) return;
        const bones = fit.bones;
        let n = 0;
        // The newest wounds (at most four spots, an exit counting as one).
        for (let k = wounds.length - 1; k >= 0 && n < 4; k--) {
          const w = wounds[k],
            grown = w.size * (0.45 + 0.55 * (1 - Math.exp(-(gameTime - w.t) / 10))),
            r = 2 + Math.min(0.15, grown * 0.06),
            c = Math.cos(w.rel),
            s = Math.sin(w.rel);
          let bone, along, rx, rz;
          if (w.zone === 'head') (bone = bones[2]), (along = 0.1 + w.h * 0.13), (rx = 0.1), (rz = 0.08);
          else if (w.zone === 'torso') (bone = bones[1]), (along = 0.04 + w.h * 0.34), (rx = 0.13), (rz = 0.17);
          else if (w.zone === 'arm')
            w.h < 0.5 ? ((bone = bones[3 + w.side]), (along = -(0.04 + w.h * 2 * 0.24)), (rx = rz = 0.05)) : ((bone = bones[5 + w.side]), (along = -(0.03 + (w.h - 0.5) * 2 * 0.2)), (rx = rz = 0.04));
          else w.h < 0.5 ? ((bone = bones[9 + w.side]), (along = -(0.06 + w.h * 2 * 0.34)), (rx = rz = 0.08)) : ((bone = bones[11 + w.side]), (along = -(0.05 + (w.h - 0.5) * 2 * 0.36)), (rx = rz = 0.055));
          for (let e = 0; e < (w.exit ? 2 : 1) && n < 4; e++) {
            const side = e ? -1 : 1;
            spots[n++].set(bone.o[0] + bone.R[3] * along + side * c * rx, bone.o[1] + bone.R[4] * along, bone.o[2] + bone.R[5] * along + side * s * rz, r);
          }
        }
      }
      function npcAvatarPrograms() {
        const m = npcSlots[0];
        return { camera: !!renderer.properties.get(m.material).currentProgram, shadow: !!renderer.properties.get(m.depth).currentProgram };
      }
      /* Console (DeadEndCity.npcAvatars): the cast, the build, this frame's slots; `on` switches them (an A/B). */
      function npcAvatarReport(on) {
        if (on === true || on === false) npcAv.enabled = on;
        const cast = npcAvatarCast();
        return {
          enabled: npcAv.enabled,
          ready: npcAv.ready,
          error: npcAv.error || null,
          cast: cast.length,
          fitted: npcAv.built,
          workMs: Math.round(npcAv.workMs),
          cap: npcAv.cap,
          chosen: npcAv.chosen,
          shown: npcAv.shown,
          triangles: npcAv.triangles,
          drawCalls: { camera: npcAv.shown, shadow: renderer.shadowMap.enabled ? npcAv.shown : 0 },
          slots: npcSlots.filter((s) => s.mesh.visible && s.person).map((s) => ({ avatar: cast[s.avatar]?.name, female: !!npcAv.fits[s.avatar]?.female, width: +s.width.toFixed(3), lost: s.uniforms.npcLost.value, wounds: s.uniforms.npcWound.value.filter((w) => w.w > 1.5).length })),
          programs: npcAvatarPrograms(),
          programsAtFirstDraw: npcAv.firstShow,
          names: cast.map((a) => a.name),
        };
      }
