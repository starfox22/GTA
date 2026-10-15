      // Licensed Coupe '33 source pack: exact close geometry, source PBR textures and shared quality transitions.
      let hotrodVehicleCache;
      function hotrodVehicleData() {
        if (hotrodVehicleCache !== undefined) return hotrodVehicleCache;
        hotrodVehicleCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.hotrodVehicleModels;
        if (!url || url.length < 64) return null;
        try {
          const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw Error('hotrod vehicles: invalid pack');
          const size = new DataView(bytes.buffer).getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + size))), base = size + 12,
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
            if (!types[type] || offset < 0 || count < 0 || base + offset + count * types[type].BYTES_PER_ELEMENT > bytes.length)
              throw Error('hotrod vehicles: invalid array ' + name);
            arrays[name] = new types[type](bytes.buffer, base + offset, count);
          }
          for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'hotrod'; }
          hotrodVehicleCache = { header, arrays };
        } catch (error) { console.error(error); }
        return hotrodVehicleCache;
      }
      function hotrodVehicleModel() { return hotrodVehicleData()?.header.models.coupe33_zhab || null; }
      function hotrodVehicleReport() {
        const model = hotrodVehicleModel();
        return { loaded: !!model, enabled: vaEnabled, key: model?.type || null,
          triangles: model?.triangles || 0, farTriangles: model?.farTriangles || 0,
          atlasSizes: hotrodVehicleTextures.map(texture => [texture?.image?.width || 0, texture?.image?.height || 0]),
          reducedTextures: !!hotrodVehicleReduced, nativeCabin: !!model?.hasInterior, nativeDoors: false,
          source: model?.source || null, license: model?.license || null };
      }
      const hotrodVehicleTextures = [];
      let hotrodVehicleReduced;
      function hotrodVehicleLoadTexture(texture, slot, reduced) {
        const key = slot ? 'hotrodVehicleOrm' : 'hotrodVehicleAlbedo',
          url = typeof ASSETS !== 'undefined' && (ASSETS[key + (reduced ? 'Low' : '')] || ASSETS[key]);
        if (!url || typeof Image === 'undefined') return;
        const epoch = (texture.userData.hotrodEpoch || 0) + 1;
        texture.userData.hotrodEpoch = epoch;
        const image = new Image();
        image.onload = () => {
          if (texture.userData.hotrodEpoch !== epoch) return;
          if (texture.image && (texture.image.width !== image.width || texture.image.height !== image.height)) texture.dispose();
          texture.image = image; texture.needsUpdate = true;
          try { renderer.initTexture(texture); } catch (error) {}
        };
        image.src = url;
      }
      function hotrodVehicleTexture(slot = 0) {
        if (hotrodVehicleTextures[slot]) return hotrodVehicleTextures[slot];
        const texture = new Three.Texture();
        texture.colorSpace = slot ? Three.NoColorSpace : Three.SRGBColorSpace;
        texture.flipY = false; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (hotrodVehicleReduced === undefined) hotrodVehicleReduced = reduced;
        hotrodVehicleTextures[slot] = texture;
        hotrodVehicleLoadTexture(texture, slot, reduced);
        return texture;
      }
      function hotrodVehicleTextureQuality() {
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (reduced === hotrodVehicleReduced) return;
        hotrodVehicleReduced = reduced;
        for (let i = 0; i < hotrodVehicleTextures.length; i++)
          if (hotrodVehicleTextures[i]) hotrodVehicleLoadTexture(hotrodVehicleTextures[i], i, reduced);
      }
      function hotrodVehicleFinish(material, paint = false) {
        material.map = hotrodVehicleTexture();
        material.roughnessMap = material.metalnessMap = material.aoMap = material.specularIntensityMap = hotrodVehicleTexture(1);
        material.specularIntensity = 1;
        approvedVehicleMaterialPatch(material, paint);
        const base = material.onBeforeCompile;
        material.onBeforeCompile = shader => {
          base(shader);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 avOrmSourceUv;\nvarying vec2 vHotrodOrmUv;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHotrodOrmUv = avOrmSourceUv;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vHotrodOrmUv;')
            .replace('vec2 approvedUv =', 'vec2 hotrodOrmUv = vAvAtlasRect.xy + fract(vHotrodOrmUv) * vAvAtlasRect.zw;\nvec2 approvedUv =')
            .replace(/texture2D\( roughnessMap, approvedUv \)/g, 'texture2D( roughnessMap, hotrodOrmUv )')
            .replace(/texture2D\( metalnessMap, approvedUv \)/g, 'texture2D( metalnessMap, hotrodOrmUv )')
            .replace('#include <aomap_fragment>', Three.ShaderChunk.aomap_fragment.replace(/\bvAoMapUv\b/g, 'approvedUv'))
            .replace('#include <lights_physical_fragment>', Three.ShaderChunk.lights_physical_fragment.replace(/\bvSpecularIntensityMapUv\b/g, 'approvedUv'));
          // The source paint is metallic by default and has its own authored finish.
          shader.fragmentShader = shader.fragmentShader.replace('min(0.18, vApprovedFinish.y)', 'vApprovedFinish.y');
        };
        material.customProgramCacheKey = () => 'hotrod-source-' + (paint ? 'paint' : 'trim');
        return material;
      }
      let hotrodVehicleMaterialSet;
      function hotrodVehicleMaterials() {
        if (hotrodVehicleMaterialSet) return hotrodVehicleMaterialSet;
        const trim = hotrodVehicleFinish(new Three.MeshPhysicalMaterial({ roughness: 1, metalness: 1, vertexColors: true, alphaTest: .5, side: Three.DoubleSide, forceSinglePass: true })),
          glass = hotrodVehicleFinish(new Three.MeshPhysicalMaterial({ roughness: 1, metalness: 1, vertexColors: true,
            transparent: true, depthWrite: false, side: Three.DoubleSide, forceSinglePass: true })),
          glassFar = hotrodVehicleFinish(new Three.MeshPhysicalMaterial({ roughness: 1, metalness: 1, vertexColors: true, side: Three.DoubleSide }));
        hotrodVehicleMaterialSet = { trim, rim: trim, rubber: trim, opticalGlass: glass, glass, glassFar };
        for (const material of [trim, glass, glassFar]) sharedMaterials.add(material);
        return hotrodVehicleMaterialSet;
      }
      function hotrodVehiclePaint(vehicle) {
        const material = new Three.MeshPhysicalMaterial({ color: vehicle.color, roughness: 1, metalness: 1,
          vertexColors: true, side: Three.DoubleSide, forceSinglePass: true, clearcoat: .7, clearcoatRoughness: .16, alphaTest: .5 });
        material.userData.carDirt = { value: new Three.Vector2(0, -1e6) };
        return hotrodVehicleFinish(material, true);
      }
      let hotrodVehicleLampSet;
      function hotrodVehicleLamps() {
        if (hotrodVehicleLampSet) return hotrodVehicleLampSet;
        hotrodVehicleLampSet = {};
        for (const [name, emission] of [['headOff', 0], ['headOn', 2], ['tailOff', .04], ['tailOn', .9], ['brake', 3]]) {
          const material = hotrodVehicleFinish(new Three.MeshPhysicalMaterial({ roughness: 1, metalness: 1,
            vertexColors: true, alphaTest: .5, emissiveIntensity: emission }));
          material.emissiveMap = hotrodVehicleTexture(); material.emissive.setRGB(1, 1, 1);
          hotrodVehicleLampSet[name] = material; sharedMaterials.add(material);
        }
        return hotrodVehicleLampSet;
      }
      function hotrodVehicleKitFit(kit, model, data, k) {
        const gm = model.glass, l = kit.l, w = kit.seats.glass.w, M = CAR_M;
        for (const geometry of [kit.door, kit.trunk])
          geometry.setAttribute('avOrmSourceUv', geometry.attributes.avSourceUv.clone());
        kit.seats = carSeatPlan(kit.glass, l, w, M, 'hotrod',
          { x: 0, y: .665 * k / M, minY: .665 * k / M, z: .29 * k / M, recline: .78,
            wheel: [(.21183315 - gm.xf) * k / M, .98653741 * k / M], wheelZ: -.24934615 * k / M, radius: .17113967 * k / M, tilt: .54038 });
        kit.far.lamps = {};
        for (const [name, geometry] of Object.entries(kit.lamps)) kit.far.lamps[name] = approvedSuvFarPart(model, data, name, k) || geometry;
      }
