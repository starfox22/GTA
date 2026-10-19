      // One detached main per rig, frozen at release rather than still attached
      // to the jumper. This is visual debris only; it never changes fall physics.
      const chuteCutaway = { event: null, mesh: null, origin: new Three.Vector3(), quaternion: new Three.Quaternion(), wobble: new Three.Quaternion(), jump: null, lastJump: null, serial: -1 };
      function clearChuteCutaway() {
        const mesh = chuteCutaway.mesh;
        if (mesh) {
          scene.remove(mesh);
          const geometries = new Set(), materials = new Set();
          mesh.traverse((o) => {
            if (o.geometry) geometries.add(o.geometry);
            for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) materials.add(m);
          });
          for (const geometry of geometries) geometry.dispose();
          for (const material of materials) material.dispose();
        }
        chuteCutaway.mesh = null;
      }
      function updateChuteCutaway(p) {
        const c = chuteCutaway;
        if (c.serial !== worldResetSerial || (p && c.jump && c.jump !== p)) {
          clearChuteCutaway();
          c.event = c.jump = c.lastJump = null;
          c.serial = worldResetSerial;
        }
        if (p?.cutaway && c.event !== p.cutaway) {
          clearChuteCutaway();
          c.event = p.cutaway;
          c.jump = p;
          // Only copy a main actually drawn for this jump. A no-render fast
          // forward must never resurrect a stale canopy from a previous rig.
          if (c.lastJump === p && chuteRoot.visible && chuteRig.lastStage === 'canopy' && chuteRig.lastOpening > 0.99) {
            const copy = chuteRoot.clone(true), materials = new Map();
            copy.name = 'Released main canopy';
            copy.traverse((o) => {
              o.userData.dynamic = true;
              o.castShadow = false;
              if (o.geometry) o.geometry = o.geometry.clone();
              const cloneMaterial = (m) => {
                if (!materials.has(m)) {
                  const clone = m.clone();
                  clone.onBeforeCompile = m.onBeforeCompile;
                  clone.customProgramCacheKey = m.customProgramCacheKey;
                  clone.transparent = true;
                  clone.depthWrite = false;
                  materials.set(m, clone);
                }
                return materials.get(m);
              };
              if (o.material) o.material = Array.isArray(o.material) ? o.material.map(cloneMaterial) : cloneMaterial(o.material);
            });
            c.origin.copy(copy.position);
            c.quaternion.copy(copy.quaternion);
            c.mesh = copy;
            scene.add(copy);
          }
        }
        c.lastJump = p;
        if (!c.mesh) return;
        const t = Math.max(0, gameTime - c.event.at);
        if (t >= 10) {
          clearChuteCutaway();
          return;
        }
        const drift = 2.4 * (1 - Math.exp(-t / 2.4)),
          fade = 1 - smooth01(7, 10, t),
          deflate = smooth01(1.5, 6, t),
          x = c.origin.x + c.event.vx * drift + 3 * t,
          z = c.origin.z + c.event.vy * drift + 1.5 * t;
        c.mesh.position.set(x, Math.max(terrainHeight(x, z) + 1, c.origin.y - (1.6 * t + 0.22 * t * t) * UNITS_PER_METRE), z);
        c.mesh.quaternion.copy(c.quaternion).multiply(c.wobble.setFromEuler(chuteEuler.set(0.05 * Math.sin(t * 2), 0.07 * t, 0.12 * Math.sin(t * 1.7), 'YXZ')));
        c.mesh.scale.set(1 - 0.18 * deflate, 1 - 0.7 * deflate, 1 - 0.1 * deflate);
        c.mesh.traverse((o) => {
          for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) m.opacity = fade;
        });
      }
      // The reserve has its own white/teal panels. Detached-main geometry was
      // cloned above, so changing this live wing never recolours the released one.
      let chutePaletteReserve = false;
      const CHUTE_RESERVE_PANELS = ['#e8f4e8', '#29475a', '#4bbfa8', '#e8f4e8', '#e8f4e8', '#e8f4e8', '#4bbfa8', '#29475a', '#e8f4e8'];
      function chuteSetReservePalette(reserve) {
        if (reserve === chutePaletteReserve) return;
        chutePaletteReserve = reserve;
        const palette = reserve ? CHUTE_RESERVE_PANELS : CHUTE_PANELS,
          tone = new Three.Color();
        for (let v = 0; v < chuteVertexCount; v++) {
          const upper = chuteSkinInfo[v * 4 + 3],
            cell = Math.floor(v / chutePerStrip) % CHUTE_CELLS,
            tape = upper && chuteSkinInfo[v * 4 + 1] < 0.04 ? 1.18 : 1;
          tone.set(palette[cell]).multiplyScalar((upper ? 1 : 0.62) * tape);
          chuteSkinBase.set([tone.r, tone.g, tone.b], v * 3);
        }
        for (let rib = 0; rib < chuteRibCount; rib++) {
          tone.set(palette[Math.min(CHUTE_CELLS - 1, rib)]).multiplyScalar(rib === 0 || rib === CHUTE_CELLS ? 0.8 : 0.45);
          for (let i = 0; i < CHUTE_RIB_POINTS * 2 + 1; i++) chuteRibColor.set([tone.r, tone.g, tone.b], (rib * (CHUTE_RIB_POINTS * 2 + 1) + i) * 3);
        }
        chuteRibGeometry.attributes.color.needsUpdate = true;
      }
