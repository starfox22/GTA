      // Helicopter per frame: animateHelicopter(), helicopterSearchlightMount(), helicopterModelReport().
      // ---- Per frame ---------------------------------------------------------------------------
      const heliTarget = new Three.Vector3(),
        heliPoliceLevels = new Float32Array(8);
      function heliAngleTowards(from, to, k) {
        return from + normalizeAngle(to - from) * k;
      }
      /*
       * Spool, rotor blur, attitude and vibration, crew, Nightsun aim, lights and
       * halos for one helicopter model in view (render3d.js vehicle pass).
       */
      function animateHelicopter(c, m, dt, wear) {
        const alive = c.hp > 0,
          ground = terrainHeight(c.x, c.y),
          elevation = entityElevation(c),
          airborne = elevation > ground + 2,
          crewed = alive && (c === player.car || c.airUnit),
          running = alive && (crewed || (c.abandonedFlight && airborne) || !!c.showRotor);
        // Spool: about 4 s up to speed, 9 s coasting down; a wreck stops short.
        // The player's machine follows the flight model's own rotor spool (the HUD's ROTOR).
        const spool = c === player.car && alive ? c.rotorSpeed || 0 : null;
        if (m.rpm < 0) m.rpm = spool ?? (running ? 1 : 0);
        const rate = running ? 0.26 : alive ? 0.11 : 0.6;
        if (spool !== null) m.rpm += (spool - m.rpm) * (1 - Math.exp(-dt * 5));
        else m.rpm = running ? Math.min(1, m.rpm + dt * rate) : Math.max(0, m.rpm - dt * rate);
        const rpm = m.rpm,
          blur = clamp((rpm - 0.3) / 0.4, 0, 1);
        m.rotor.rotation.y += dt * rpm * HELI_SPIN;
        m.tail.rotation.z += dt * rpm * HELI_TAIL_SPIN;
        m.ghost += dt * (0.6 + 2.4 * rpm);
        m.disc.visible = blur > 0.01;
        const du = m.disc.material.uniforms;
        du.uBlur.value = blur;
        du.uPhase.value = m.ghost;
        // Blades give way to the disc; they keep throwing their shadow.
        const solid = blur < 0.75;
        m.blades.material = solid ? heliMaterials().blade : heliMaterials().shadowOnly;
        m.tailBlades.visible = blur < 0.6;
        m.tailDisc.visible = blur > 0.01;
        m.tailDisc.material.uniforms.uBlur.value = blur;
        m.tailDisc.material.uniforms.uPhase.value = m.ghost * 3;
        // The disc darkens at night (it only scatters the light around it).
        const lampsOn = vehicleLampAmount(),
          discLight = 1 - 0.55 * nightAmount;
        du.uColor.value.set(m.look.blade).multiplyScalar(discLight);
        // Attitude: nose down with speed and acceleration (up in a flare), banked in
        // the turn; on the ground only the rotor's vibration.
        const speed = c.speed || 0,
          accel = dt > 0 ? clamp((speed - m.lastSpeed) / dt, -120, 120) : 0;
        m.lastSpeed = speed;
        m.accel += (accel - m.accel) * (1 - Math.exp(-dt * 2.5));
        const flying = airborne && alive;
        m.body.rotation.z = flying ? clamp(-speed * 0.00024 - m.accel * 0.0014, -0.22, 0.16) : 0;
        m.body.rotation.x = flying ? clamp(c.av * 0.075, -0.14, 0.14) : 0;
        const buzz = rpm * (airborne ? 0.55 : 1);
        m.body.position.y = Math.sin(gameTime * 41 + c.id) * 0.05 * buzz;
        m.body.rotation.x += Math.sin(gameTime * 29.3 + c.id) * 0.0022 * buzz;
        m.body.rotation.z += Math.sin(gameTime * 23.7) * 0.0018 * buzz;
        // A wreck: the hub knocked askew, sat low on a collapsed skid.
        if (!alive) {
          m.rotor.rotation.x = 0.1;
          m.rotor.rotation.z = -0.06;
          if (!airborne) m.body.rotation.x = 0.07;
        } else if (m.rotor.rotation.x) m.rotor.rotation.x = m.rotor.rotation.z = 0;
        // Crew: the pilot whenever someone flies it, the observer in the air unit.
        m.pilot.visible = crewed;
        m.observer.visible = alive && !!c.airUnit;
        // Glass: scuffed and sooted with the wear.
        m.glass.roughness = 0.04 + wear * 0.5;
        m.glass.opacity = 0.46 + wear * 0.4;
        // Nightsun: the head turns to what the crew are watching, else rests forward.
        const tracking = alive && c.airUnit && (c.airState === 'tracking' || c.airState === 'searching'),
          watched = tracking ? (c.airState === 'tracking' && c.airTarget && c.airTarget.hp > 0 ? c.airTarget : c.airLastSeen) : null;
        if (m.nightsun) {
          const ns = m.nightsun;
          let yaw = 0,
            pitch = -0.5;
          if (watched) {
            heliTarget.set(watched.x, watched.hp !== undefined ? entityElevation(watched) : terrainHeight(watched.x, watched.y), watched.y);
            m.body.worldToLocal(heliTarget).sub(ns.yaw.position);
            yaw = Math.atan2(-heliTarget.z, heliTarget.x);
            pitch = clamp(Math.atan2(heliTarget.y, Math.hypot(heliTarget.x, heliTarget.z)), -1.45, 0.1);
          }
          const k = 1 - Math.exp(-dt * 4);
          ns.aimYaw = heliAngleTowards(ns.aimYaw, yaw, k);
          ns.aimPitch += (pitch - ns.aimPitch) * k;
          ns.yaw.rotation.y = ns.aimYaw;
          ns.pitch.rotation.z = ns.aimPitch;
        }
        // ---- Lights ----
        const L = m.levels,
          t = gameTime + (c.id % 13) * 0.29,
          nav = alive && (running || (crewed && lampsOn > 0.3)) ? 1 : 0;
        heliLightGain.value = 3.4 + lampsOn * 2.6;
        L.fill(0);
        L[HELI_CH.navRed] = L[HELI_CH.navGreen] = nav;
        L[HELI_CH.navWhite] = nav;
        if (running) {
          const p = t % 1.3;
          L[HELI_CH.strobe] = p < 0.05 || (p > 0.16 && p < 0.21) ? 1 : 0;
          L[HELI_CH.beacon] = Math.pow(Math.max(0, Math.sin(t * 6.8)), 4);
          const low = typeof aircraftClearance === 'function' ? aircraftClearance(c) < 360 : !airborne;
          L[HELI_CH.work] = (low && (lampsOn > 0.2 || !airborne)) || (tracking && lampsOn > 0.2) ? 1 : 0;
        }
        if (m.look.kind === 'police' && alive && (c.airUnit || c.showLights)) {
          policeLightLevels(c, heliPoliceLevels, gameTime);
          const l = heliPoliceLevels;
          L[HELI_CH.red] = Math.max(l[0], l[1], l[5]);
          L[HELI_CH.blue] = Math.max(l[2], l[3], l[6]);
        }
        // Halos over the lit lamps: faint by day, blooming at night.
        const scale = 0.25 + lampsOn * 0.6;
        for (const h of m.halos) {
          const level = L[h.channel];
          if (level > 0.05) queueVehicleHalo(h.sprite, level * h.strength * scale * (h.channel === HELI_CH.strobe ? 1.6 : 1));
        }
        // Police livery: the reflective lettering and pinstripes catch the light at night.
        if (m.look.reflective) {
          const glow = m.charred ? -1 : Math.round(lampsOn * 20) / 20;
          if (m.reflective !== glow) {
            m.reflective = glow;
            if (glow >= 0) m.paint.emissive.setScalar(glow * 0.08);
          }
        }
      }
      /*
       * Where the police searchlight's lens is, in world space (for searchlight3d.js):
       * the model's anchor while it is built, else the same point from the pose.
       */
      function helicopterSearchlightMount(c, out = new Three.Vector3()) {
        const m = carModels.get(c);
        if (m?.searchlightMount && m.group.visible) return m.searchlightMount.getWorldPosition(out);
        const cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          p = HELI_SEARCHLIGHT_MOUNT;
        return out.set(c.x + cos * p.x - sin * p.z, entityElevation(c) + 0.1 + p.y, c.y + sin * p.x + cos * p.z);
      }
      // What the review report (DeadEndCity.helicopterModels) counts for one model.
      function helicopterModelReport(c, m) {
        let meshes = 0,
          drawn = 0,
          shadows = 0,
          triangles = 0;
        m.group.traverse((o) => {
          if (!o.isMesh) return;
          meshes++;
          for (let p = o; p; p = p.parent) if (!p.visible) return;
          drawn++;
          if (o.castShadow) shadows++;
          const g = o.geometry;
          triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
        });
        return {
          id: c.id,
          look: m.look?.kind || (m.apache ? 'apache' : 'old'),
          visible: m.group.visible,
          rpm: m.rpm !== undefined ? +m.rpm.toFixed(2) : null,
          meshes,
          drawCalls: drawn,
          shadowCasters: shadows,
          triangles: Math.round(triangles),
          crew: m.pilot ? (m.pilot.visible ? 1 : 0) + (m.observer.visible ? 1 : 0) : null,
          scheme: m.look?.scheme || null,
          // Milliseconds the look's livery took to paint (once per look).
          liveryMs: m.liveryMap?.userData.paintMs ?? null,
        };
      }
