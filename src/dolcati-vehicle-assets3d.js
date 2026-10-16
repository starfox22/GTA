      // ROY's licensed Panigale source: independent pack, exact near meshes, source PBR atlases and shared LOD.
      let dolcatiVehicleCache;
      function dolcatiVehicleData() {
        if (dolcatiVehicleCache !== undefined) return dolcatiVehicleCache;
        dolcatiVehicleCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.dolcatiVehicleModels;
        if (!url || url.length < 64) return null;
        try {
          const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw Error('Dolcati: invalid model pack');
          const size = new DataView(bytes.buffer).getUint32(8, true), base = 12 + size,
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, base))), arrays = {},
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array };
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
            if (!types[type] || offset < 0 || count < 0 || base + offset + count * types[type].BYTES_PER_ELEMENT > bytes.length)
              throw Error('Dolcati: invalid array ' + name);
            arrays[name] = new types[type](bytes.buffer, base + offset, count);
          }
          for (const model of Object.values(header.models)) { model.approved = true; model.assetPack = 'dolcati'; }
          dolcatiVehicleCache = { header, arrays };
        } catch (error) { console.error(error); }
        return dolcatiVehicleCache;
      }
      function dolcatiVehicleModel() { return dolcatiVehicleData()?.header.models.dolcati_roy || null; }
      const dolcatiVehicleTextures = [];
      let dolcatiVehicleReduced;
      function dolcatiVehicleLoadTexture(texture, slot, reduced) {
        const key = ['dolcatiVehicleAlbedo', 'dolcatiVehicleOrm', 'dolcatiVehicleEmissive'][slot],
          url = typeof ASSETS !== 'undefined' && (ASSETS[key + (reduced ? 'Low' : '')] || ASSETS[key]);
        if (!url || typeof Image === 'undefined') return;
        const epoch = (texture.userData.dolcatiEpoch || 0) + 1;
        texture.userData.dolcatiEpoch = epoch;
        const image = new Image();
        image.onload = () => {
          if (texture.userData.dolcatiEpoch !== epoch) return;
          if (texture.image && (texture.image.width !== image.width || texture.image.height !== image.height)) texture.dispose();
          texture.image = image; texture.needsUpdate = true;
          try { renderer.initTexture(texture); } catch (error) {}
        };
        image.src = url;
      }
      function dolcatiVehicleTexture(slot = 0) {
        if (dolcatiVehicleTextures[slot]) return dolcatiVehicleTextures[slot];
        const texture = new Three.Texture();
        texture.colorSpace = slot === 1 ? Three.NoColorSpace : Three.SRGBColorSpace;
        texture.flipY = false; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (dolcatiVehicleReduced === undefined) dolcatiVehicleReduced = reduced;
        dolcatiVehicleTextures[slot] = texture;
        dolcatiVehicleLoadTexture(texture, slot, reduced);
        return texture;
      }
      function dolcatiVehicleTextureQuality() {
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (reduced === dolcatiVehicleReduced) return;
        dolcatiVehicleReduced = reduced;
        for (let i = 0; i < dolcatiVehicleTextures.length; i++)
          if (dolcatiVehicleTextures[i]) dolcatiVehicleLoadTexture(dolcatiVehicleTextures[i], i, reduced);
      }
      function dolcatiVehicleFinish(material, paint = false, rubber = false) {
        material.map = dolcatiVehicleTexture();
        material.roughnessMap = material.metalnessMap = dolcatiVehicleTexture(1);
        approvedVehicleMaterialPatch(material, paint, null, rubber);
        const base = material.onBeforeCompile;
        material.onBeforeCompile = shader => {
          base(shader);
          // Keep the downloaded fairing's gloss and artwork. Only its red pigment
          // takes the game's respray; white source lettering keeps its own colour.
          shader.fragmentShader = shader.fragmentShader.replace('min(0.18, vApprovedFinish.y)', 'vApprovedFinish.y');
          if (paint) shader.fragmentShader = shader.fragmentShader
            .replace('diffuseColor *= sampledDiffuseColor;',
              'float dolcatiPigment = step(sampledDiffuseColor.g * 1.6 + 0.02, sampledDiffuseColor.r);\n' +
              'diffuseColor.rgb = mix(sampledDiffuseColor.rgb, diffuseColor.rgb * (sampledDiffuseColor.r / 0.7874), dolcatiPigment);\n' +
              'diffuseColor.a *= sampledDiffuseColor.a;')
            .replace(/max\(0.22, roughnessFactor \* vApprovedFinish.x\)/g, 'max(0.06, roughnessFactor * vApprovedFinish.x)');
        };
        material.customProgramCacheKey = () => 'dolcati-source-' + (paint ? 'paint' : rubber ? 'rubber' : 'trim');
        return material;
      }
      let dolcatiVehicleMaterialSet;
      function dolcatiVehicleMaterials() {
        if (dolcatiVehicleMaterialSet) return dolcatiVehicleMaterialSet;
        const trim = dolcatiVehicleFinish(new Three.MeshStandardMaterial({ roughness: 1, metalness: 1, vertexColors: true, alphaTest: .5 })),
          rubber = dolcatiVehicleFinish(new Three.MeshStandardMaterial({ roughness: 1, metalness: .02, vertexColors: true }), false, true),
          // The source uses transmission glass with default opaque PBR factors;
          // the city renderer approximates that optical surface with clear alpha glass.
          glass = dolcatiVehicleFinish(new Three.MeshPhysicalMaterial({ roughness: .08, metalness: 0, vertexColors: true,
            transparent: true, depthWrite: false, side: Three.DoubleSide, forceSinglePass: true, envMapIntensity: 1 }));
        dolcatiVehicleMaterialSet = { trim, rim: trim, rubber, glass, glassFar: glass };
        for (const material of [trim, rubber, glass]) sharedMaterials.add(material);
        return dolcatiVehicleMaterialSet;
      }
      function dolcatiVehiclePaint(vehicle) {
        const material = new Three.MeshPhysicalMaterial({ color: vehicle.color, roughness: 1, metalness: 1, vertexColors: true,
          clearcoat: .8, clearcoatRoughness: .08, alphaTest: .5 });
        material.userData.carDirt = { value: new Three.Vector2(0, -1e6) };
        return dolcatiVehicleFinish(material, true);
      }
      let dolcatiVehicleLampSet;
      function dolcatiVehicleLamps() {
        if (dolcatiVehicleLampSet) return dolcatiVehicleLampSet;
        dolcatiVehicleLampSet = {};
        for (const [name, emission] of [['headOff', 0], ['headOn', 2], ['tailOff', .04], ['tailOn', .9], ['brake', 3]]) {
          const material = dolcatiVehicleFinish(new Three.MeshStandardMaterial({ roughness: 1, metalness: 1,
            vertexColors: true, emissiveIntensity: emission }));
          material.emissiveMap = dolcatiVehicleTexture(2); material.emissive.setRGB(1, 1, 1);
          dolcatiVehicleLampSet[name] = material; sharedMaterials.add(material);
        }
        return dolcatiVehicleLampSet;
      }
