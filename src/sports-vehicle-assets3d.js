      // Licensed sports-car pack, source door part ranges, shared PBR textures and quality transitions.
      let sportsVehicleCache;
      function sportsVehicleData() {
        if (sportsVehicleCache !== undefined) return sportsVehicleCache;
        sportsVehicleCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.sportsVehicleModels;
        if (!url || url.length < 64) return null;
        try {
          const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw Error('sports vehicles: invalid pack');
          const size = new DataView(bytes.buffer).getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + size))), base = size + 12,
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
            if (!types[type] || offset < 0 || count < 0 || base + offset + count * types[type].BYTES_PER_ELEMENT > bytes.length)
              throw Error('sports vehicles: invalid array ' + name);
            arrays[name] = new types[type](bytes.buffer, base + offset, count);
          }
          for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'sports'; }
          sportsVehicleCache = { header, arrays };
        } catch (error) { console.error(error); }
        return sportsVehicleCache;
      }
      function sportsVehicleModel() { return sportsVehicleData()?.header.models.c8_hari || null; }
      function sportsVehicleReport() {
        const model = sportsVehicleModel();
        return { loaded: !!model, enabled: vaEnabled, key: model?.type || null,
          triangles: model?.triangles || 0, farTriangles: model?.farTriangles || 0,
          atlasSizes: sportsVehicleTextures.map(texture => [texture?.image?.width || 0, texture?.image?.height || 0]),
          reducedTextures: !!sportsVehicleReduced, nativeDoors: model ? Object.keys(model.doors || {}) : [] };
      }
      // Alias parts retain source ownership once. Five-pane glass is composed by pane,
      // while native door index ranges follow that reorder without duplicating vertices.
      function sportsRoleGeometry(model, data, role, k, uvAt) {
        const names = model.roleParts[role], parts = names.map(name => vaGeometry(model, data, name, k, uvAt, true)),
          joined = vaJoin(parts.filter(Boolean));
        if (!joined || !model.rolePanes?.[role]) return joined;
        const output = new Uint32Array(joined.index.count), ranges = {}, bases = [];
        let vertexAt = 0, at = 0;
        for (const geometry of parts) { bases.push(vertexAt); vertexAt += geometry?.attributes.position.count || 0; }
        joined.clearGroups();
        for (let pane = 0; pane < 5; pane++) {
          const start = at;
          for (let i = 0; i < parts.length; i++) {
            const geometry = parts[i], group = geometry?.groups.find(group => group.materialIndex === pane);
            if (!group?.count) continue;
            (ranges[names[i]] ||= []).push([at, group.count]);
            for (let j = 0; j < group.count; j++) output[at++] = geometry.index.array[group.start + j] + bases[i];
          }
          joined.addGroup(start, at - start, pane);
        }
        if (at !== output.length) throw Error('sports vehicle glass: incomplete pane composition');
        joined.setIndex(new Three.BufferAttribute(vertexAt < 65536 ? new Uint16Array(output) : output, 1));
        joined.userData.vehiclePartRanges = ranges;
        return joined;
      }
      function sportsRoleTriangles(model, role) {
        const names = model.roleParts?.[role] || [role];
        return names.reduce((sum, name) => sum + (model.parts[name]?.triangles || 0), 0);
      }
      function sportsNativeDoors(kit) {
        const source = kit.asset.doors;
        if (!source) return;
        kit.nativeDoors = {};
        for (const [name, side] of [['left', -1], ['right', 1]]) {
          const door = source[name];
          if (!door) continue;
          kit.nativeDoors[side] = { hinge: door.hinge.map(value => value * kit.k), axis: door.axis,
            partNames: Object.values(door.parts).flat().filter(Boolean) };
        }
      }
      const sportsVehicleTextures = [];
      let sportsVehicleReduced;
      function sportsVehicleLoadTexture(texture, slot, reduced) {
        const key = ['sportsVehicleAlbedo', 'sportsVehicleOrm', 'sportsVehicleEmissive'][slot],
          url = typeof ASSETS !== 'undefined' && (ASSETS[key + (reduced ? 'Low' : '')] || ASSETS[key]);
        if (!url || typeof Image === 'undefined') return;
        const epoch = (texture.userData.sportsEpoch || 0) + 1;
        texture.userData.sportsEpoch = epoch;
        const image = new Image();
        image.onload = () => {
          if (texture.userData.sportsEpoch !== epoch) return;
          if (texture.image && (texture.image.width !== image.width || texture.image.height !== image.height)) texture.dispose();
          texture.image = image; texture.needsUpdate = true;
          try { renderer.initTexture(texture); } catch (error) {}
        };
        image.src = url;
      }
      function sportsVehicleTexture(slot = 0) {
        if (sportsVehicleTextures[slot]) return sportsVehicleTextures[slot];
        const texture = new Three.Texture();
        texture.colorSpace = slot === 1 ? Three.NoColorSpace : Three.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (sportsVehicleReduced === undefined) sportsVehicleReduced = reduced;
        sportsVehicleTextures[slot] = texture;
        sportsVehicleLoadTexture(texture, slot, reduced);
        return texture;
      }
      function sportsVehicleTextureQuality() {
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (reduced === sportsVehicleReduced) return;
        sportsVehicleReduced = reduced;
        for (let i = 0; i < sportsVehicleTextures.length; i++)
          if (sportsVehicleTextures[i]) sportsVehicleLoadTexture(sportsVehicleTextures[i], i, reduced);
      }
      let sportsVehicleMaterialSet;
      function sportsVehicleFinish(material, paint = false, rubber = false) {
        material.map = sportsVehicleTexture();
        material.roughnessMap = material.metalnessMap = sportsVehicleTexture(1);
        material.emissiveMap = sportsVehicleTexture(2);
        material.emissive.setRGB(1, 1, 1);
        return approvedVehicleMaterialPatch(material, paint, null, rubber);
      }
      function sportsVehicleMaterials() {
        if (sportsVehicleMaterialSet) return sportsVehicleMaterialSet;
        const trim = sportsVehicleFinish(new Three.MeshStandardMaterial({ roughness: 1, metalness: 1,
            vertexColors: true, alphaTest: .5 })),
          rubber = sportsVehicleFinish(new Three.MeshStandardMaterial({ roughness: 1, metalness: .02,
            vertexColors: true, alphaTest: .5 }), false, true),
          opticalGlass = sportsVehicleFinish(new Three.MeshStandardMaterial({ roughness: 1, metalness: 1,
            vertexColors: true, transparent: true, opacity: 1, alphaTest: 0, depthWrite: false,
            side: Three.DoubleSide, forceSinglePass: true })),
          glass = carGlassMaterial('#28333b', .24), glassFar = carGlassMaterial('#28333b', .64);
        sportsVehicleMaterialSet = { trim, rim: trim, rubber, opticalGlass, glass, glassFar };
        for (const material of [trim, rubber, opticalGlass, glass, glassFar]) sharedMaterials.add(material);
        return sportsVehicleMaterialSet;
      }
      function sportsVehiclePaint(vehicle) {
        const material = new Three.MeshPhysicalMaterial({ color: vehicle.color, roughness: 1, metalness: 1,
          vertexColors: true, clearcoat: .7, clearcoatRoughness: .16, alphaTest: .5, envMapIntensity: 1 });
        material.userData.carDirt = { value: new Three.Vector2(0, -1e6) };
        return sportsVehicleFinish(material, true);
      }
      let sportsVehicleLampSet;
      function sportsVehicleLamps() {
        if (sportsVehicleLampSet) return sportsVehicleLampSet;
        sportsVehicleLampSet = {};
        for (const [name, emission] of [['headOff', 0], ['headOn', 2], ['tailOff', .06], ['tailOn', .9], ['brake', 3]]) {
          const material = sportsVehicleFinish(new Three.MeshStandardMaterial({ roughness: 1,
            metalness: 1, vertexColors: true, alphaTest: .5, emissiveIntensity: emission }));
          sportsVehicleLampSet[name] = material;
          sharedMaterials.add(material);
        }
        return sportsVehicleLampSet;
      }
