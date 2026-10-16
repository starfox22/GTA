      // Full-resolution licensed SDC SVJ pack; independent source PBR maps and renderer-owned tier changes.
      let svjVehicleCache;
      function svjVehicleData() {
        if (svjVehicleCache !== undefined) return svjVehicleCache;
        svjVehicleCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.svjVehicleModels;
        if (!url || url.length < 64) return null;
        try {
          const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw Error('SVJ vehicles: invalid pack');
          const size = new DataView(bytes.buffer).getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + size))), base = size + 12,
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {};
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
            if (!types[type] || offset < 0 || count < 0 || base + offset + count * types[type].BYTES_PER_ELEMENT > bytes.length)
              throw Error('SVJ vehicles: invalid array ' + name);
            arrays[name] = new types[type](bytes.buffer, base + offset, count);
          }
          for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'svj'; }
          svjVehicleCache = { header, arrays };
        } catch (error) { console.error(error); }
        return svjVehicleCache;
      }
      function svjVehicleModel() { return svjVehicleData()?.header.models.svj_sdc || null; }
      function svjVehicleReport() {
        const model = svjVehicleModel();
        return { loaded: !!model, enabled: vaEnabled, key: model?.type || null,
          triangles: model?.triangles || 0, farTriangles: model?.farTriangles || 0,
          atlasSizes: svjVehicleTextures.map(texture => [texture?.image?.width || 0, texture?.image?.height || 0]),
          reducedTextures: !!svjVehicleReduced, nativeDoors: model ? Object.keys(model.doors || {}) : [], source: model?.source || null, license: model?.license || null, sourceTriangles: model?.sourceTriangles || 0, nativeCabin: !!model?.hasInterior };
      }
      const svjVehicleTextures = [];
      let svjVehicleReduced;
      function svjVehicleLoadTexture(texture, slot, reduced) {
        const key = ['svjVehicleAlbedo', 'svjVehicleOrm', 'svjVehicleEmissive'][slot],
          url = typeof ASSETS !== 'undefined' && (ASSETS[key + (reduced ? 'Low' : '')] || ASSETS[key]);
        if (!url || typeof Image === 'undefined') return;
        const epoch = (texture.userData.svjEpoch || 0) + 1;
        texture.userData.svjEpoch = epoch;
        const image = new Image();
        image.onload = () => {
          if (texture.userData.svjEpoch !== epoch) return;
          if (texture.image && (texture.image.width !== image.width || texture.image.height !== image.height)) texture.dispose();
          texture.image = image; texture.needsUpdate = true;
          try { renderer.initTexture(texture); } catch (error) {}
        };
        image.src = url;
      }
      function svjVehicleTexture(slot = 0) {
        if (svjVehicleTextures[slot]) return svjVehicleTextures[slot];
        const texture = new Three.Texture();
        texture.colorSpace = slot === 1 ? Three.NoColorSpace : Three.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (svjVehicleReduced === undefined) svjVehicleReduced = reduced;
        svjVehicleTextures[slot] = texture;
        svjVehicleLoadTexture(texture, slot, reduced);
        return texture;
      }
      function svjVehicleTextureQuality() {
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (reduced === svjVehicleReduced) return;
        svjVehicleReduced = reduced;
        for (let i = 0; i < svjVehicleTextures.length; i++)
          if (svjVehicleTextures[i]) svjVehicleLoadTexture(svjVehicleTextures[i], i, reduced);
      }
      let svjVehicleMaterialSet;
      function svjVehicleFinish(material, paint = false, rubber = false) {
        material.map = svjVehicleTexture();
        material.roughnessMap = material.metalnessMap = svjVehicleTexture(1);
        material.emissiveMap = svjVehicleTexture(2);
        material.emissive.setRGB(1, 1, 1);
        approvedVehicleMaterialPatch(material, paint, null, rubber);
        const base = material.onBeforeCompile;
        material.onBeforeCompile = shader => {
          base(shader);
          shader.fragmentShader = shader.fragmentShader.replace('min(0.18, vApprovedFinish.y)', 'vApprovedFinish.y');
        };
        material.customProgramCacheKey = () => 'svj-source-' + (rubber ? 'rubber' : paint ? 'paint' : 'trim');
        return material;
      }
      function svjVehicleMaterials() {
        if (svjVehicleMaterialSet) return svjVehicleMaterialSet;
        const trim = svjVehicleFinish(new Three.MeshStandardMaterial({ side: Three.DoubleSide, forceSinglePass: true, roughness: 1, metalness: 1,
            vertexColors: true, alphaTest: .5 })),
          rubber = svjVehicleFinish(new Three.MeshStandardMaterial({ side: Three.DoubleSide, forceSinglePass: true, roughness: 1, metalness: .02,
            vertexColors: true, alphaTest: .5 }), false, true),
          opticalGlass = svjVehicleFinish(new Three.MeshStandardMaterial({ side: Three.DoubleSide, forceSinglePass: true, roughness: 1, metalness: 1,
            vertexColors: true, transparent: true, opacity: 1, alphaTest: 0, depthWrite: false })),
          glass = carGlassMaterial('#28333b', .24), glassFar = carGlassMaterial('#28333b', .64);
        for (const material of [glass, glassFar]) {
          material.depthWrite = false; material.side = Three.DoubleSide; material.forceSinglePass = true;
        }
        svjVehicleMaterialSet = { trim, rim: trim, rubber, opticalGlass, glass, glassFar };
        for (const material of [trim, rubber, opticalGlass, glass, glassFar]) sharedMaterials.add(material);
        return svjVehicleMaterialSet;
      }
      function svjVehiclePaint(vehicle) {
        const material = new Three.MeshPhysicalMaterial({ color: vehicle.color, roughness: 1, metalness: 1,
          vertexColors: true, side: Three.DoubleSide, forceSinglePass: true, clearcoat: .7, clearcoatRoughness: .16, alphaTest: .5, envMapIntensity: 1 });
        material.userData.carDirt = { value: new Three.Vector2(0, -1e6) };
        return svjVehicleFinish(material, true);
      }
      let svjVehicleLampSet;
      function svjVehicleLamps() {
        if (svjVehicleLampSet) return svjVehicleLampSet;
        svjVehicleLampSet = {};
        for (const [name, emission] of [['headOff', 0], ['headOn', 2], ['tailOff', .06], ['tailOn', .9], ['brake', 3]]) {
          const material = svjVehicleFinish(new Three.MeshStandardMaterial({ side: Three.DoubleSide, forceSinglePass: true, roughness: 1,
            metalness: 1, vertexColors: true, alphaTest: .5, emissiveIntensity: emission }));
          svjVehicleLampSet[name] = material;
          sharedMaterials.add(material);
        }
        return svjVehicleLampSet;
      }

      function svjVehicleKitFit(kit, model, data, k) {
        const M = CAR_M, gm = model.glass, set = civSet();
        kit.seats = carSeatPlan(kit.glass, kit.l, kit.seats.glass.w, M, 'brutini',
          { hipX: -.10 * k / kit.l, y: .25 * k / M, minY: .21 * k / M, z: .43 * k / M,
            wheel: [(.54 - gm.xf) * k / M, .66 * k / M], wheelZ: -.43 * k / M, radius: .17 * k / M, tilt: .48 });
        carCabinParts((geometry, matrix, color, finish) => civAddMatrix(set, geometry, matrix, { color, finish }),
          kit.glass, kit.l, kit.seats.glass.w, kit.seats, CAR_CABIN_TRIM.brutini, { two: true });
        kit.interiorFallback = civGeometry(set);
        sportsNativeDoors(kit);
        kit.far.lamps = {};
        for (const [name, geometry] of Object.entries(kit.lamps)) kit.far.lamps[name] = approvedSuvFarPart(model, data, name, k) || geometry;
      }
