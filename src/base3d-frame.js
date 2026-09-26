      const searchLens = new Three.Vector3(),
        searchAim = new Three.Vector3();
      function updateBaseVisuals() {
        const near =
          Math.abs(viewCenter.x - 9930) < viewReach + 1500 && Math.abs(viewCenter.y - 8850) < viewReach + 1600;
        baseGlowMesh.visible = near && nightAmount > 0.05;
        if (!near) {
          for (const s of searchlights) s.beam.mesh.visible = s.spot.visible = false;
          return;
        }
        const night = nightAmount,
          alert = militaryAlertUntil > gameTime,
          blink = Math.sin(gameTime * 3.2) > 0.2 ? 1 : 0.15;
        baseGlowMesh.material.opacity = 0.42 * night;
        B.window.emissiveIntensity = 1.35 * night;
        for (const m of plateLit) m.emissiveIntensity = 0.05 + 0.35 * night;
        B.redLamp.color.setRGB(1, 0.23 * (0.3 + 0.7 * blink), 0.17 * (0.3 + 0.7 * blink)).multiplyScalar(0.35 + 0.65 * blink);
        for (const h of baseHalos) {
          if (h.kind === 'beacon') {
            h.sprite.visible = night > 0.05 || blink > 0.5;
            h.sprite.material.opacity = (0.25 + 0.75 * night) * blink;
          } else {
            h.sprite.visible = night > 0.08;
            h.sprite.material.opacity = 0.95 * night;
          }
        }
        // Gate pieces.
        for (const p of gateParts) {
          const s = p.state;
          p.pivot.visible = !s.armBroken;
          p.stub.visible = s.armBroken;
          p.pivot.rotation.x = -p.dir * s.arm * (Math.PI / 2) * 0.95;
          p.bollards.position.y = -9 * (1 - s.bollards);
          for (const [k, post] of p.bollardList.entries()) post.rotation.z = s.bollardsBroken ? 0.9 + k * 0.1 : 0;
          if (s.bollardsBroken) p.bollards.position.y = -2;
          p.slide.position.set(
            p.slideBase.x,
            s.slideBroken ? 1.5 : 0,
            p.slideBase.z + (s.slideBroken ? 0 : (1 - s.slide) * p.slideOpenOffset),
          );
          // Burst: knocked flat, inwards.
          p.slide.rotation.z = s.slideBroken ? -1.48 : 0;
        }
        // Flags wave; the windsock and the radar turn.
        const wind = 0.5 + (weather?.wind || 0.4);
        for (const f of flags) {
          const pos = f.mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = f.base[i * 3];
            pos.setZ(i, Math.sin(gameTime * 4 * wind + f.phase - x * 0.35) * x * 0.09 * wind);
          }
          pos.needsUpdate = true;
          f.mesh.rotation.y = (weather?.windAngle || 0) * 0.3 + Math.sin(gameTime * 0.4 + f.phase) * 0.15;
        }
        windsock.rotation.y = -(weather?.windAngle || -0.7) + Math.sin(gameTime * 1.3) * 0.08;
        windsock.rotation.z = -0.5 + Math.min(0.45, wind * 0.3);
        if (radarHead) radarHead.rotation.y = gameTime * 1.6;
        // Searchlights: slow sweeps along the fence at night; on alert they hunt the intruder.
        const lit = night > 0.15;
        for (const s of searchlights) {
          const t = s.tower;
          let angle = t.a + Math.sin(gameTime * 0.32 + s.phase) * 0.95,
            reach = 170 + Math.sin(gameTime * 0.21 + s.phase * 2) * 60;
          if (alert) {
            const d = Math.hypot(player.x - t.x, player.y - t.y);
            if (d < 520) {
              angle = Math.atan2(player.y - t.y, player.x - t.x);
              reach = Math.max(40, d);
            }
          }
          // Ease the aim so a lock-on swings round rather than snapping.
          const da = Math.atan2(Math.sin(angle - s.aim), Math.cos(angle - s.aim));
          s.aim += da * 0.06;
          s.reach = (s.reach ?? reach) + (reach - (s.reach ?? reach)) * 0.06;
          const tx = t.x + Math.cos(s.aim) * s.reach,
            tz = t.y + Math.sin(s.aim) * s.reach,
            origin = s.head.position;
          s.head.rotation.y = -s.aim;
          s.lampBody.rotation.z = -Math.atan2(origin.y + 2.5, s.reach);
          s.beam.mesh.visible = s.spot.visible = lit;
          if (!lit) continue;
          // The lens sits 4 units out along the lamp's aim.
          const ground = terrainHeight(tx, tz),
            drop = origin.y + 2.5 - ground,
            slant = Math.hypot(s.reach, drop);
          searchLens.set(
            origin.x + (Math.cos(s.aim) * 4.1 * s.reach) / slant,
            origin.y + 2.5 - (4.1 * drop) / slant,
            origin.z + (Math.sin(s.aim) * 4.1 * s.reach) / slant,
          );
          searchAim.set(tx, ground, tz);
          s.beam.set(searchLens, searchAim, 23, 1.3, ground);
          s.beam.uniforms.uIntensity.value = night * (alert ? 2.1 : 1.6) * (1 + weather.rain * 0.7);
          // The pool stretches along the beam where it grazes the ground.
          const grazing = Math.min(3, slant / Math.max(1, drop));
          s.spot.position.set(tx, ground + 0.6, tz);
          s.spot.rotation.set(0, -s.aim, 0);
          s.spot.scale.set(50 * grazing, 1, 50);
          s.spot.material.color.copy(s.spot.userData.baseColor).multiplyScalar(night * (alert ? 1.25 : 0.85));
        }
      }
