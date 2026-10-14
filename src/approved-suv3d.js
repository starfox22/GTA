      // The three owner-approved free SUV bodies retain the existing Ranger and patrol gameplay contracts.
      // Geometry stays immutable per style/size; only a vehicle's mesh references change between near/far parts.
      const approvedSuvPanelBoxes = new Map();
      let approvedSuvCabinMaterialCache;
      function approvedSuvCabinMaterial() {
        if (!approvedSuvCabinMaterialCache) {
          approvedSuvCabinMaterialCache = civFinishPatch(civSharedMaterials().trim.clone(), 'approved-suv-cabin');
          approvedSuvCabinMaterialCache.userData.assetAtlas = 'finish';
          sharedMaterials.add(approvedSuvCabinMaterialCache);
        }
        return approvedSuvCabinMaterialCache;
      }
      function approvedSuvInteriorGeometry(kit) {
        if (kit.asset.hasInterior === true || kit.asset.type === 's1_jimny') return null;
        const set = civSet();
        carCabinParts((geometry, matrix, color, finish) => civAddMatrix(set, geometry, matrix, { color, finish }),
          kit.glass, kit.l, kit.seats.glass.w, kit.seats, CAR_CABIN_TRIM.suv, { hatch: true, police: !!kit.police });
        return civGeometry(set);
      }
      function approvedSuvPanelBox(model, swatch) {
        const key = model.type + ':' + swatch;
        if (approvedSuvPanelBoxes.has(key)) return approvedSuvPanelBoxes.get(key);
        const geometry = boxGeo.clone(), count = geometry.attributes.position.count,
          uv = new Float32Array(count * 2), finish = new Float32Array(count * 2),
          color = new Float32Array(count * 3).fill(1), sourceUv = new Float32Array(count * 2).fill(0.5),
          atlasRect = new Float32Array(count * 4), livery = new Float32Array(count * 2),
          paintUv = model.paintUv || [0, 0], liveryUv = swatchUv(swatch);
        for (let i = 0; i < count; i++) {
          uv.set(paintUv, i * 2); finish.set([0.3, 0.06], i * 2); livery.set(liveryUv, i * 2);
          atlasRect.set([paintUv[0] - 4 / 4096, paintUv[1] - 4 / 4096, 8 / 4096, 8 / 4096], i * 4);
        }
        geometry.setAttribute('uv', new Three.BufferAttribute(uv, 2));
        geometry.setAttribute('finish', new Three.BufferAttribute(finish, 2));
        geometry.setAttribute('color', new Three.BufferAttribute(color, 3));
        geometry.setAttribute('avSourceUv', new Three.BufferAttribute(sourceUv, 2));
        geometry.setAttribute('avAtlasRect', new Three.BufferAttribute(atlasRect, 4));
        geometry.setAttribute('liveryUv', new Three.BufferAttribute(livery, 2));
        geometry.computeBoundingSphere(); geometry.computeBoundingBox(); sharedGeometries.add(geometry);
        approvedSuvPanelBoxes.set(key, geometry);
        return geometry;
      }
      function approvedSuvFarPart(model, data, names, k) {
        const list = Array.isArray(names) ? names : [names];
        return vaGeometry(model, data, list.map(name => model.lodParts?.[name] || name), k);
      }
      function approvedSuvFarKit(kit, model, data, k) {
        const far = {};
        for (const [field, names] of Object.entries({ shell: 'shell', cabin: 'glass', hood: 'hood', paint: 'panels', trim: ['trim', 'cabin'], opticalGlass: 'opticalGlass' }))
          far[field] = approvedSuvFarPart(model, data, names, k) || kit[field];
        const trimName = model.lodParts?.trim || 'trim',
          outer = (model.parts[trimName]?.triangles || 0) * 3;
        far.trimOuter = far.trim ? civDrawRange(far.trim, outer) : null;
        far.wheels = kit.assetWheels.map((wheel, i) => ({
          tyre: approvedSuvFarPart(model, data, 'wheel' + i + '.tyre', k) || wheel.tyre,
          rim: approvedSuvFarPart(model, data, 'wheel' + i + '.rim', k) || wheel.rim,
        }));
        // Both resolutions use the same measured axle order and origins.
        const order = model.wheels.map((wheel, i) => ({ x: wheel.x, front: wheel.front, side: wheel.side, i }))
          .sort((a, b) => Number(b.front) - Number(a.front) || a.side - b.side);
        far.wheels = order.map(wheel => far.wheels[wheel.i]);
        kit.far = far;
        kit.interiorFallback = approvedSuvInteriorGeometry(kit);
      }
      function approvedSuvLodParts(model) {
        const kit = model.kit, far = kit.far, parts = [];
        for (const field of ['shell', 'cabin', 'hood', 'panels']) {
          const mesh = model[field], key = field === 'panels' ? 'paint' : field;
          if (mesh && far[key] && far[key] !== mesh.geometry) parts.push({ mesh, near: mesh.geometry, far: far[key] });
        }
        // The trim is not on the deformable shell contract, but still uses the same immutable LOD pair.
        if (model.assetTrim && far.trim !== model.assetTrim.geometry)
          parts.push({ mesh: model.assetTrim, near: model.assetTrim.geometry, far: far.trim });
        if (model.opticalGlass && far.opticalGlass !== model.opticalGlass.geometry)
          parts.push({ mesh: model.opticalGlass, near: model.opticalGlass.geometry, far: far.opticalGlass });
        for (let i = 0; i < model.wheels.length; i++) for (const [child, field] of [[0, 'tyre'], [1, 'rim']]) {
          const mesh = model.wheels[i].wheel.children[child], geometry = far.wheels[i]?.[field];
          if (mesh && geometry && geometry !== mesh.geometry) parts.push({ mesh, near: mesh.geometry, far: geometry });
        }
        model.approvedAsset = kit.approvedKey;
        model.approvedLodParts = parts;
        model.approvedLodFar = false;
      }
      // The existing civilian pass owns its wheel roll. Police bodies previously had static wheels;
      // only those receive a new roll here, in world metres even though their mesh has a .8 draw scale.
      function animateApprovedSuvWheels(c, m, seconds) {
        if (!m.approvedAsset || m.bikeUpdate || !m.wheels?.length) return;
        const target = c.tyres ? clamp(c.tyres.steer || 0, -0.65, 0.65) : clamp(c.av * 0.5, -0.4, 0.4);
        m.approvedSteer = (m.approvedSteer || 0) + (target - (m.approvedSteer || 0)) * Math.min(1, seconds * 8);
        const locks = c.tyres?.lock, spinning = (c.spinSpeed || 0) > 1 ? drivenAxle(c) : null,
          spinExtra = spinning ? c.spinSpeed * (c.speed < -2 ? -1 : 1) : 0;
        for (const wheel of m.wheels) {
          if (wheel.front) wheel.wheel.rotation.y = -m.approvedSteer;
          if (!m.police) continue;
          const lock = locks ? wheel.front ? locks[0] : Math.max(locks[1], c.handbrakeTurn ? 1 : 0) : 0,
            driven = spinning === 'all' || spinning === (wheel.front ? 'front' : 'rear'),
            radius = Math.max(1e-6, wheel.radius * (m.modelScale || m.drawScale || 1));
          wheel.wheel.rotation.z -= ((c.speed + (driven ? spinExtra : 0)) * seconds / radius) * (driven ? 1 : 1 - lock);
        }
      }
