      // Mission 2 (the Blue Hour) in 3D: the bodyguards' sight cones on the terrace floor and the speech bubbles and name label over the party.
      /* SIGHT CONES
         One fan per bodyguard, rebuilt every frame from the logic's own numbers:
         centred on roofGuardView (heading plus head turn), ROOF_VIEW.half either
         side, each ray cut short where roofViewLength stops it (cover, the
         balustrade), so the drawn cone is exactly what he can see. A soft fill
         that fades away from him and a brighter rim; gold when calm, amber while
         he is watching the player, red when the cover is nearly blown (the
         colour eases, the rim pulses while he watches). Read-only: the renderer
         never changes the mission. */
      const CONE_SEGMENTS = 40,
        CONE_RIM = 2.2,
        CONE_CALM = new Three.Color('#e6c386'),
        CONE_SEEN = new Three.Color('#f0a040'),
        CONE_HOT = new Three.Color('#e84634'),
        roofCones = [];
      function roofConeMesh(vertices) {
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(new Float32Array(vertices * 3), 3));
        geo.setAttribute('color', new Three.BufferAttribute(new Float32Array(vertices * 4), 4));
        const mesh = new Three.Mesh(
          geo,
          new Three.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            side: Three.DoubleSide,
            fog: false,
          }),
        );
        mesh.frustumCulled = false;
        mesh.renderOrder = 3;
        mesh.visible = false;
        scene.add(mesh);
        return mesh;
      }
      function roofCone(i) {
        if (!roofCones[i])
          roofCones[i] = {
            fill: roofConeMesh(CONE_SEGMENTS * 3),
            rim: roofConeMesh(CONE_SEGMENTS * 6 + 12),
            color: CONE_CALM.clone(),
            heat: 0,
          };
        return roofCones[i];
      }
      const coneRays = new Float32Array((CONE_SEGMENTS + 1) * 3),
        coneTarget = new Three.Color();
      function updateRoofCone(cone, e, m, deltaSeconds) {
        const view = roofGuardView(e),
          hot = e.sees && m.suspicion >= 60 ? 1 : 0,
          seen = e.sees ? 1 : 0,
          ease = 1 - Math.exp(-deltaSeconds * 6);
        coneTarget.copy(hot ? CONE_HOT : seen ? CONE_SEEN : CONE_CALM);
        // Nobody sees the player, but the party is uneasy: a warm tint.
        if (!seen) coneTarget.lerp(CONE_SEEN, clamp(m.suspicion / 100, 0, 0.6) * 0.5 + (e.alert || 0) * 0.3);
        cone.color.lerp(coneTarget, ease);
        cone.heat += ((seen ? 1 : 0) - cone.heat) * ease;
        for (let i = 0; i <= CONE_SEGMENTS; i++) {
          const a = view - ROOF_VIEW.half + (i / CONE_SEGMENTS) * ROOF_VIEW.half * 2,
            d = roofViewLength(e, a);
          coneRays[i * 3] = Math.cos(a);
          coneRays[i * 3 + 1] = Math.sin(a);
          coneRays[i * 3 + 2] = d;
        }
        const r = cone.color.r,
          g = cone.color.g,
          b = cone.color.b,
          pulse = cone.heat * (0.75 + 0.25 * Math.sin(gameTime * 9)),
          nearAlpha = 0.2 + cone.heat * 0.14,
          farAlpha = 0.06 + cone.heat * 0.07,
          rimAlpha = 0.42 + pulse * 0.45;
        // The fill: a fan from his feet, fading with distance.
        const fp = cone.fill.geometry.attributes.position.array,
          fc = cone.fill.geometry.attributes.color.array;
        let v = 0;
        const put = (pos, col, x, z, alpha) => {
          pos[v * 3] = x;
          pos[v * 3 + 1] = 0;
          pos[v * 3 + 2] = z;
          col[v * 4] = r;
          col[v * 4 + 1] = g;
          col[v * 4 + 2] = b;
          col[v * 4 + 3] = alpha;
          v++;
        };
        for (let i = 0; i < CONE_SEGMENTS; i++) {
          const c0 = coneRays[i * 3],
            s0 = coneRays[i * 3 + 1],
            d0 = coneRays[i * 3 + 2],
            c1 = coneRays[i * 3 + 3],
            s1 = coneRays[i * 3 + 4],
            d1 = coneRays[i * 3 + 5],
            f0 = farAlpha + (nearAlpha - farAlpha) * (1 - d0 / ROOF_VIEW.range),
            f1 = farAlpha + (nearAlpha - farAlpha) * (1 - d1 / ROOF_VIEW.range);
          put(fp, fc, 0, 0, nearAlpha);
          put(fp, fc, c0 * d0, s0 * d0, f0);
          put(fp, fc, c1 * d1, s1 * d1, f1);
        }
        cone.fill.geometry.attributes.position.needsUpdate = true;
        cone.fill.geometry.attributes.color.needsUpdate = true;
        // The rim: a band along the far edge (wherever cover cuts it) and the two sides.
        const rp = cone.rim.geometry.attributes.position.array,
          rc = cone.rim.geometry.attributes.color.array;
        v = 0;
        for (let i = 0; i < CONE_SEGMENTS; i++) {
          const c0 = coneRays[i * 3],
            s0 = coneRays[i * 3 + 1],
            d0 = coneRays[i * 3 + 2],
            c1 = coneRays[i * 3 + 3],
            s1 = coneRays[i * 3 + 4],
            d1 = coneRays[i * 3 + 5],
            i0 = Math.max(0, d0 - CONE_RIM),
            i1 = Math.max(0, d1 - CONE_RIM);
          put(rp, rc, c0 * i0, s0 * i0, rimAlpha * 0.2);
          put(rp, rc, c0 * d0, s0 * d0, rimAlpha);
          put(rp, rc, c1 * d1, s1 * d1, rimAlpha);
          put(rp, rc, c0 * i0, s0 * i0, rimAlpha * 0.2);
          put(rp, rc, c1 * d1, s1 * d1, rimAlpha);
          put(rp, rc, c1 * i1, s1 * i1, rimAlpha * 0.2);
        }
        for (const i of [0, CONE_SEGMENTS]) {
          const c = coneRays[i * 3],
            s = coneRays[i * 3 + 1],
            d = coneRays[i * 3 + 2],
            nx = -s * 0.6,
            nz = c * 0.6;
          put(rp, rc, -nx, -nz, rimAlpha * 0.5);
          put(rp, rc, c * d - nx, s * d - nz, rimAlpha * 0.7);
          put(rp, rc, c * d + nx, s * d + nz, rimAlpha * 0.7);
          put(rp, rc, -nx, -nz, rimAlpha * 0.5);
          put(rp, rc, c * d + nx, s * d + nz, rimAlpha * 0.7);
          put(rp, rc, nx, nz, rimAlpha * 0.5);
        }
        cone.rim.geometry.attributes.position.needsUpdate = true;
        cone.rim.geometry.attributes.color.needsUpdate = true;
        for (const mesh of [cone.fill, cone.rim]) mesh.position.set(e.x, (e.altitude ?? entityElevation(e)) + 0.3, e.y);
      }
      let roofConeClock = 0;
      function updateRoofMissionVisuals() {
        const m = rooftopJob(),
          show = !!m && !!player.roof && !m.alarm,
          guards = show ? enemies.filter((e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit') : [],
          deltaSeconds = clamp(gameTime - roofConeClock, 0, 0.1);
        roofConeClock = gameTime;
        for (let i = 0; i < Math.max(guards.length, roofCones.length); i++) {
          const e = guards[i],
            cone = e ? roofCone(i) : roofCones[i];
          cone.fill.visible = cone.rim.visible = !!e;
          if (e) updateRoofCone(cone, e, m, deltaSeconds);
        }
      }
      /* Speech over the party (roofSpeechBubble, roofmission-ui.js) and Vescari's
         name while he is on his feet and quiet. */
      function drawHitTargetLabel() {
        const m = rooftopJob();
        if (!m || !player.roof) return;
        for (const actor of [
          m.boss,
          ...enemies.filter((e) => e.guard && e.hp > 0 && e.missionTag === 'rooftop-hit'),
          ...storyActors.filter((p) => p.missionTag === 'rooftop-hit' && !p.hidden && rooftopFloor(p)),
        ]) {
          const p = api.project(actor.x, actor.y, actor.altitude + 33);
          if (p.x < 40 || p.x > viewportWidth - 40 || p.y < 70 || p.y > viewportHeight - 150) continue;
          if (actor.speech) roofSpeechBubble(actor, p.x, p.y);
          else if (actor === m.boss && actor.hp > 0) {
            worldContext.fillStyle = '#15222bef';
            worldContext.fillRect(p.x - 72, p.y - 16, 144, 24);
            worldContext.fillStyle = '#f3d592';
            worldContext.textAlign = 'center';
            worldContext.font = 'bold 11px Arial';
            worldContext.fillText('LUCIANO VESCARI', p.x, p.y);
          }
        }
      }
