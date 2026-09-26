      // Helicopter rotors and makeHelicopter().
      // ---- Rotors ---------------------------------------------------------------------------
      // An airfoil ring (chordwise loop), leading edge at -z: the blade runs along +x.
      const HELI_AIRFOIL = [
        [0, 0],
        [0.04, 0.5],
        [0.18, 0.95],
        [0.45, 0.8],
        [1, 0.06],
        [0.45, -0.3],
        [0.18, -0.45],
        [0.04, -0.3],
      ];
      function heliBladeRing(r, chord, thick, pitch, sweep, drop) {
        const c = Math.cos(pitch),
          s = Math.sin(pitch);
        return HELI_AIRFOIL.map(([p, t]) => {
          const z0 = (p - 0.25) * chord + sweep,
            y0 = t * thick;
          return [r, y0 * c + z0 * s * -1 + drop, y0 * s + z0 * c];
        });
      }
      /*
       * Main rotor: the hub (mast, yoke, grips, dampers, pitch links, rotating
       * swashplate, cap) and the blades, both in rotor space (y up from the ground).
       */
      function heliRotorParts(rotor, look, military) {
        const S = policeShapeKit(),
          hub = policeSet(),
          blades = policeSet(),
          { radius: R, root, chord, blades: n, droop, sweep, hub: hubR } = rotor,
          y = rotor.y,
          tipStart = R - (military ? 2.2 : 1.5);
        policeAdd(hub, S.cylinder, 0, (rotor.mast + y) / 2, 0, 0.8, y - rotor.mast, 0.8, '#5d6268');
        policeAdd(hub, S.cylinder, 0, y, 0, hubR, 0.75, hubR, '#3a3e43');
        policeAdd(hub, S.sphere, 0, y + 0.55, 0, 1.25, 0.55, 1.25, '#80868c');
        policeAdd(hub, S.cylinder, 0, rotor.mast + 1.75, 0, hubR * 0.78, 0.35, hubR * 0.78, '#8b9197');
        for (let i = 0; i < n; i++) {
          const a = (i * TAU) / n,
            c = Math.cos(a),
            s = Math.sin(a),
            at = (r, dz) => [c * r + s * dz, 0, -s * r + c * dz];
          // Grip and damper along the blade root, a pitch link down to the swashplate.
          heliMatrix.compose(heliV2.set(...at(hubR + 1.2, 0)).setY(y), heliQuat.setFromAxisAngle(heliUp, a), new Three.Vector3(3.2, 0.95, 1.5));
          policeAddMatrix(hub, boxGeo, heliMatrix, '#2e3236');
          heliMatrix.compose(heliV2.set(...at(hubR * 0.7, 1.3)).setY(y - 0.1), heliQuat.setFromAxisAngle(heliUp, a), new Three.Vector3(2.2, 0.5, 0.5));
          policeAddMatrix(hub, S.cylinder, heliMatrix.multiply(new Three.Matrix4().makeRotationZ(Math.PI / 2)), '#1c1e21');
          const top = at(hubR * 0.85, -1.2),
            foot = at(hubR * 0.7, -1.2);
          heliRod(hub, [foot[0], rotor.mast + 1.8, foot[2]], [top[0], y - 0.35, top[2]], 0.16, '#a8aeb4');
          // The blade: cuff, then twisted, tapering to a swept tip that droops at rest.
          const stations = [root, root + 1.4, R * 0.3, R * 0.55, R * 0.8, tipStart, R - 0.6, R],
            rings = stations.map((r) => {
              const f = (r - root) / (R - root),
                tipF = Math.max(0, (r - R * 0.9) / (R * 0.1)),
                cw = r < root + 1 ? chord * 0.6 : chord * (1 - (rotor.taper ?? 0.4) * tipF),
                pitch = 0.16 - 0.14 * f,
                swept = sweep * tipF * tipF,
                drop = -droop * f * f;
              return heliBladeRing(r, cw, chord * (r < root + 1 ? 0.22 : 0.12 - 0.04 * f), pitch, swept, drop);
            });
          const bodyRings = rings.slice(0, 6),
            tipRings = rings.slice(5),
            place = (ring) => ring.map(([r, py, pz]) => [c * r + s * pz, y + py, -s * r + c * pz]);
          heliAddSweep(blades, bodyRings.map(place), look.blade);
          heliAddSweep(blades, tipRings.map(place), look.tip);
        }
        return {
          hub: policeGeometry(hub),
          blades: policeGeometry(blades),
          x: rotor.x,
          y,
          radius: R,
          disc: { blades: n, hub: (hubR + 1.6) / R, tip: tipStart / R, trail: 0.13, smear: 0.1, color: look.blade, tipColor: look.tip },
        };
      }
      // Two- or four-blade tail rotor in its own plane (x, y), spinning about z.
      function heliTailRotorParts(t, look) {
        const S = policeShapeKit(),
          set = policeSet();
        policeAdd(set, S.cylinder, 0, 0, 0, 0.75, 1.1, 0.75, '#3a3e43', null, Math.PI / 2);
        for (let i = 0; i < t.blades; i++) {
          const a = (i * TAU) / t.blades + 0.3,
            c = Math.cos(a),
            s = Math.sin(a),
            place = (ring) => ring.map(([r, py, pz]) => [c * r - s * pz, s * r + c * pz, py]);
          const body = [0.9, t.radius * 0.72].map((r) => heliBladeRing(r, t.chord, 0.18, 0.12, 0, 0)),
            tip = [t.radius * 0.72, t.radius * 0.86, t.radius].map((r) => heliBladeRing(r, t.chord * (r > t.radius * 0.9 ? 0.85 : 1), 0.16, 0.08, 0, 0));
          heliAddSweep(set, body.map(place), look.blade);
          heliAddSweep(set, tip.slice(0, 2).map(place), '#e8e6e0');
          heliAddSweep(set, tip.slice(1).map(place), '#c7362b');
        }
        return {
          blades: policeGeometry(set),
          x: t.x,
          y: t.y,
          z: t.z,
          cant: t.cant,
          radius: t.radius,
          disc: { blades: t.blades, hub: 0.14, tip: 0.86, trail: 0.2, smear: 0.14, color: look.blade, tipColor: '#c7362b' },
        };
      }
      function heliFenestronParts(f, look) {
        const set = policeSet();
        const n = f.blades || 10;
        for (let i = 0; i < n; i++) {
          // Unevenly spaced, as a real fenestron's are (less of a whine).
          const a = (i * TAU) / n + 0.12 * Math.sin(i * 2.4),
            c = Math.cos(a),
            s = Math.sin(a),
            place = (ring) => ring.map(([r, py, pz]) => [c * r - s * pz, s * r + c * pz, py]);
          heliAddSweep(set, [1.1, f.radius - 0.15].map((r) => heliBladeRing(r, 0.9, 0.14, 0.3, 0, 0)).map(place), '#34373c');
        }
        return {
          blades: policeGeometry(set),
          x: f.x,
          y: f.y,
          z: 0,
          cant: 0,
          radius: f.radius - 0.1,
          disc: { blades: n, hub: 0.27, tip: 1.2, trail: 0.12, smear: 0.22, color: '#2a2d31', tipColor: '#2a2d31' },
        };
      }
      // ---- The model -------------------------------------------------------------------------
      function makeHelicopter(vehicle) {
        const look = helicopterLookFor(vehicle),
          kit = heliKit(look),
          M = heliMaterials(),
          group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        group.name = look.kind + ' helicopter';
        const livery = heliLiveryTexture(look, kit),
          finish = look.finish,
          paint = new Three.MeshPhysicalMaterial({
            color: '#ffffff',
            map: livery,
            emissive: '#000000',
            emissiveMap: livery,
            roughness: finish.roughness,
            metalness: finish.metalness,
            clearcoat: finish.clearcoat,
            clearcoatRoughness: 0.07,
            envMapIntensity: 1,
          }),
          glass = heliGlassMaterial(look.glass).clone(),
          lightMaterial = heliLightMaterial(),
          quiet = (m) => {
            m.castShadow = false;
            return m;
          };
        const skin = mesh(kit.paint, paint, body, 0, 0, 0),
          canopy = mesh(kit.glass, glass, body, 0, 0, 0),
          trim = mesh(kit.trim, M.trim, body, 0, 0, 0);
        canopy.receiveShadow = false;
        if (kit.metal) mesh(kit.metal, M.metal, body, 0, 0, 0);
        quiet(mesh(kit.interior, M.interior, body, 0, 0, 0));
        const pilot = quiet(mesh(kit.pilot, M.interior, body, 0, 0, 0)),
          observer = quiet(mesh(kit.observer, M.interior, body, 0, 0, 0));
        pilot.visible = observer.visible = false;
        if (kit.decals) quiet(mesh(kit.decals, policeGlyphs().material, body, 0, 0, 0));
        const lights = quiet(mesh(kit.lights, lightMaterial, body, 0, 0, 0));
        lights.receiveShadow = false;
        // Main rotor: hub and blades spin in `rotor`; the blur disc stays still.
        const rotor = new Three.Group();
        rotor.position.set(kit.rotor.x, 0, 0);
        // Parked, no blade lies along the fuselage (it would hide the roof and boom).
        rotor.rotation.y = kit.plan.rotor.park ?? Math.PI / 4;
        body.add(rotor);
        quiet(mesh(kit.rotor.hub, M.metal, rotor, 0, 0, 0));
        const blades = mesh(kit.rotor.blades, M.blade, rotor, 0, 0, 0);
        blades.receiveShadow = false;
        const discMaterial = heliDiscMaterial(kit.rotor.disc),
          disc = quiet(new Three.Mesh(M.discGeometry, discMaterial));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(kit.rotor.x, kit.rotor.y + 0.1, 0);
        disc.scale.setScalar(kit.rotor.radius);
        disc.visible = false;
        disc.receiveShadow = false;
        body.add(disc);
        // Tail rotor (or fenestron fan): a fixed mount (the cant), the spinning part.
        const tailMount = new Three.Group();
        tailMount.position.set(kit.tail.x, kit.tail.y, kit.tail.z);
        tailMount.rotation.x = kit.tail.cant;
        body.add(tailMount);
        const tail = new Three.Group();
        tailMount.add(tail);
        const tailBlades = quiet(mesh(kit.tail.blades, M.blade, tail, 0, 0, 0)),
          tailDiscMaterial = heliDiscMaterial(kit.tail.disc),
          tailDisc = quiet(new Three.Mesh(M.discGeometry, tailDiscMaterial));
        tailDisc.scale.setScalar(kit.tail.radius);
        tailDisc.position.z = kit.tail.z < 0 ? -0.1 : 0.1;
        tailDisc.visible = false;
        tailMount.add(tailDisc);
        // The Nightsun on its gimbal; its anchor for the searchlight (HELI_SEARCHLIGHT_MOUNT).
        let nightsun = null;
        const searchlightMount = new Three.Object3D();
        searchlightMount.position.set(HELI_SEARCHLIGHT_MOUNT.x, HELI_SEARCHLIGHT_MOUNT.y, HELI_SEARCHLIGHT_MOUNT.z);
        body.add(searchlightMount);
        if (kit.nightsun) {
          const yaw = new Three.Group(),
            pitch = new Three.Group();
          yaw.position.copy(searchlightMount.position);
          body.add(yaw);
          yaw.add(pitch);
          quiet(mesh(kit.nightsun.head, M.trim, pitch, 0, 0, 0));
          quiet(mesh(kit.nightsun.lens, lightMaterial, pitch, 0, 0, 0));
          pitch.rotation.z = -0.5;
          nightsun = { yaw, pitch, aimYaw: 0, aimPitch: -0.5 };
        }
        const halos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(heliHaloMaterial(a.color));
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          body.add(sprite);
          return { sprite, channel: a.channel, strength: a.strength };
        });
        return {
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          helicopter: true,
          heli: true,
          // Built at real size: the renderer's DESIGN SIZE never scales it.
          realSize: true,
          look,
          rotor,
          blades,
          disc,
          tail,
          tailBlades,
          tailDisc,
          canopy,
          glass,
          pilot,
          observer,
          shell: null,
          nightsun,
          searchlightMount,
          lightMaterial,
          levels: lightMaterial.uniforms.levels.value,
          halos,
          rpm: -1,
          ghost: 0,
          lastSpeed: 0,
          accel: 0,
          reflective: -1,
          // damage3d.js hooks: livery restored after the soot, the paint's own finish.
          liveryMap: livery,
          liveryColor: '#ffffff',
          finish,
          // Bullet marks land on the skin, glass and trim (never the rotor disc).
          rayTargets: [skin, canopy, trim],
        };
      }
