      // Licensed Monarch collection: independent source pack and per-source shared
      // material/texture families. Vehicle names, simulation and saves stay in the
      // original gameplay tables; multiple names may share one actual source kit.
      let monarchVehicleCache, monarchVehicleLoadError = null;
      const monarchVehicleTypes = new Set(['valkyrie', 'dbs', 'zr1x', 'chevetteSE', 'wayron',
        'tourbillon', 'jasko', 'sirocco', 'novera', 'w1', 'lafera']);
      function monarchVehicleData() {
        if (monarchVehicleCache !== undefined) return monarchVehicleCache;
        monarchVehicleCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.monarchVehicleModels;
        if (!url || url.length < 64) return null;
        try {
          const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw Error('Monarch vehicles: invalid pack');
          const length = new DataView(bytes.buffer).getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + length))), base = 12 + length,
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array }, arrays = {}, byGameType = {};
          if (base > bytes.length || Object.keys(header.models).length > 32) throw Error('Monarch vehicles: invalid model/header budget');
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
            const ArrayType = types[type];
            if (!ArrayType || !Number.isSafeInteger(offset) || !Number.isSafeInteger(count) || offset < 0 || count < 0 ||
                (base + offset) % ArrayType.BYTES_PER_ELEMENT || base + offset + count * ArrayType.BYTES_PER_ELEMENT > bytes.length)
              throw Error('Monarch vehicles: invalid array ' + name);
            arrays[name] = new ArrayType(bytes.buffer, base + offset, count);
          }
          for (const [key, model] of Object.entries(header.models)) {
            if (!key.startsWith('monarch_') || model.type !== key || !Array.isArray(model.gameTypes) || model.wheels?.length !== 4)
              throw Error('Monarch vehicles: invalid source mapping ' + key);
            model.approved = true; model.assetPack = 'monarch';
            for (const type of model.gameTypes) {
              if (typeof type !== 'string' || !type || byGameType[type]) throw Error('Monarch vehicles: duplicate/invalid gameplay mapping ' + type);
              byGameType[type] = key;
            }
          }
          monarchVehicleCache = { header, arrays, byGameType };
        } catch (error) { monarchVehicleLoadError = String(error.message || error); console.error(error); }
        return monarchVehicleCache;
      }
      function monarchVehicleModel(type) {
        if (typeof type !== 'string' || !type.startsWith('monarch_') && !monarchVehicleTypes.has(type)) return null;
        const data = monarchVehicleData();
        return data?.header.models[data.byGameType[type] || type] || null;
      }
      const monarchVehicleTextureSets = new Map(), monarchVehicleMaterialSets = new Map(), monarchVehicleLampSets = new Map();
      let monarchVehicleReduced;
      function monarchVehicleLoadTexture(texture, model, channel, reduced) {
        const keys = model.textureKeys?.[channel],
          high = typeof keys === 'string' ? keys : keys?.high,
          low = typeof keys === 'string' ? keys + 'Low' : keys?.low,
          url = typeof ASSETS !== 'undefined' && (ASSETS[reduced && low ? low : high] || ASSETS[high]);
        if (!url || typeof Image === 'undefined') return;
        const epoch = (texture.userData.monarchEpoch || 0) + 1;
        texture.userData.monarchEpoch = epoch;
        const image = new Image();
        image.onload = () => {
          if (texture.userData.monarchEpoch !== epoch) return;
          if (texture.image && (texture.image.width !== image.width || texture.image.height !== image.height)) texture.dispose();
          texture.image = image; texture.needsUpdate = true;
          try { renderer.initTexture(texture); } catch (error) {}
        };
        image.src = url;
      }
      function monarchVehicleTexture(model, channel = 'albedo') {
        let record = monarchVehicleTextureSets.get(model.type);
        if (!record) { record = { model, textures: {} }; monarchVehicleTextureSets.set(model.type, record); }
        if (record.textures[channel]) return record.textures[channel];
        const texture = new Three.Texture(), reduced = (activeTier?.lodBias || 1) > 1.05;
        texture.colorSpace = channel === 'albedo' || channel === 'emissive' ? Three.SRGBColorSpace : Three.NoColorSpace;
        texture.flipY = false; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (monarchVehicleReduced === undefined) monarchVehicleReduced = reduced;
        record.textures[channel] = texture; monarchVehicleLoadTexture(texture, model, channel, reduced);
        return texture;
      }
      function monarchVehicleTextureQuality() {
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (reduced === monarchVehicleReduced) return;
        monarchVehicleReduced = reduced;
        for (const record of monarchVehicleTextureSets.values())
          for (const channel in record.textures) monarchVehicleLoadTexture(record.textures[channel], record.model, channel, reduced);
      }
      function monarchVehicleFinish(material, model, paint = false, rubber = false, lamp = false) {
        material.map = monarchVehicleTexture(model);
        material.roughnessMap = material.metalnessMap = monarchVehicleTexture(model, 'orm');
        material.emissiveMap = monarchVehicleTexture(model, lamp ? 'albedo' : 'emissive'); material.emissive.setRGB(1, 1, 1);
        if (!lamp) material.emissiveIntensity = model.emissiveIntensity ?? 1;
        if (model.hasNormalMaps) material.normalMap = monarchVehicleTexture(model, 'normal');
        approvedVehicleMaterialPatch(material, paint, null, rubber);
        material.userData.monarchSource = true;
        const base = material.onBeforeCompile;
        material.onBeforeCompile = shader => {
          base(shader);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 avOrmSourceUv;\nattribute vec2 avNormalSourceUv;\nattribute vec2 avEmissiveSourceUv;\nattribute vec4 avSurface;\nvarying vec2 vMonarchOrmUv;\nvarying vec2 vMonarchNormalUv;\nvarying vec2 vMonarchEmissiveUv;\nvarying vec4 vMonarchSurface;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMonarchOrmUv=avOrmSourceUv;vMonarchNormalUv=avNormalSourceUv;vMonarchEmissiveUv=avEmissiveSourceUv;vMonarchSurface=avSurface;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vMonarchOrmUv;\nvarying vec2 vMonarchNormalUv;\nvarying vec2 vMonarchEmissiveUv;\nvarying vec4 vMonarchSurface;')
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(!gl_FrontFacing && vMonarchSurface.y<0.5) discard;')
            .replace('vec2 approvedUv =', 'vec2 monarchOrmUv=vAvAtlasRect.xy+fract(vMonarchOrmUv)*vAvAtlasRect.zw;\nvec2 monarchNormalUv=vAvAtlasRect.xy+fract(vMonarchNormalUv)*vAvAtlasRect.zw;\nvec2 monarchEmissiveUv=vAvAtlasRect.xy+fract(' + (lamp ? 'vAvSourceUv' : 'vMonarchEmissiveUv') + ')*vAvAtlasRect.zw;\nvec2 approvedUv =')
            .replace(/texture2D\( roughnessMap, approvedUv \)/g, 'texture2D( roughnessMap, monarchOrmUv )')
            .replace(/texture2D\( metalnessMap, approvedUv \)/g, 'texture2D( metalnessMap, monarchOrmUv )')
            .replace(/texture2D\( emissiveMap, approvedUv \)/g, 'texture2D( emissiveMap, monarchEmissiveUv )')
            .replace('#include <alphatest_fragment>', 'if(vMonarchSurface.w > -1.5 && vMonarchSurface.w < -0.5) diffuseColor.a=opacity;\nif(vMonarchSurface.w>=0.0 && diffuseColor.a<vMonarchSurface.w) discard;')
            .replace('#include <normal_fragment_begin>', Three.ShaderChunk.normal_fragment_begin.replace(/\bvNormalMapUv\b/g, 'vMonarchNormalUv'))
            .replace('#include <normal_fragment_maps>', Three.ShaderChunk.normal_fragment_maps.replace(/\bvNormalMapUv\b/g, 'monarchNormalUv')
              .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vMonarchSurface.z;'))
            .replace('min(0.18, vApprovedFinish.y)', 'vApprovedFinish.y')
            .replace('max(0.78, roughnessFactor * vApprovedFinish.x)', 'roughnessFactor * vApprovedFinish.x')
            .replace('max(0.22, roughnessFactor * vApprovedFinish.x)', 'roughnessFactor * vApprovedFinish.x');
          if (paint) {
            shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );',
              'vec4 diffuseColor = vec4( mix(vec3(1.0),diffuse,vMonarchSurface.x), opacity );');
            // Instanced traffic carries its colour after the uniform diffuse.
            // Protect the same source trim/black hood regions on that path too.
            shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', Three.ShaderChunk.color_vertex
              .replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix(vec3(1.0),instanceColor.xyz,avSurface.x);'));
          }
        };
        material.customProgramCacheKey = () => 'monarch-source-v2-' + (paint ? 'paint' : rubber ? 'rubber' : lamp ? 'lamp' : 'trim') + (model.hasNormalMaps ? '-normal' : '');
        return material;
      }
      function monarchVehicleGlassSides(material) {
        const base = material.onBeforeCompile, key = material.customProgramCacheKey();
        material.userData.monarchSource = true;
        material.onBeforeCompile = shader => {
          base(shader);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec4 avSurface;\nvarying float vMonarchGlassSide;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMonarchGlassSide=avSurface.y;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vMonarchGlassSide;')
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(!gl_FrontFacing && vMonarchGlassSide<0.5) discard;');
        };
        material.customProgramCacheKey = () => 'monarch-glass-sided-v1-' + key;
        return material;
      }
      function monarchVehicleMaterials(model) {
        if (monarchVehicleMaterialSets.has(model.type)) return monarchVehicleMaterialSets.get(model.type);
        const options = { side: Three.DoubleSide, forceSinglePass: true, roughness: 1, metalness: 1, vertexColors: true, alphaTest: .5 },
          trim = monarchVehicleFinish(new Three.MeshStandardMaterial(options), model),
          rubber = monarchVehicleFinish(new Three.MeshStandardMaterial(options), model, false, true),
          opticalGlass = monarchVehicleFinish(new Three.MeshStandardMaterial({ ...options, transparent: true, opacity: 1, alphaTest: 0, depthWrite: false }), model),
          glass = monarchVehicleGlassSides(carGlassMaterial('#28333b', .24)), glassFar = monarchVehicleGlassSides(carGlassMaterial('#28333b', .64));
        for (const material of [glass, glassFar]) { material.depthWrite = false; material.side = Three.DoubleSide; material.forceSinglePass = true; }
        const materials = { trim, rim: trim, rubber, opticalGlass, glass, glassFar };
        for (const material of new Set(Object.values(materials))) sharedMaterials.add(material);
        monarchVehicleMaterialSets.set(model.type, materials);
        return materials;
      }
      function monarchVehiclePaint(vehicle, model) {
        const material = new Three.MeshPhysicalMaterial({ color: vehicle.color, roughness: 1, metalness: 1, vertexColors: true,
          side: Three.DoubleSide, forceSinglePass: true, clearcoat: .7, clearcoatRoughness: .16, alphaTest: .5, envMapIntensity: 1 });
        material.userData.carDirt = { value: new Three.Vector2(0, -1e6) };
        return monarchVehicleFinish(material, model, true);
      }
      function monarchVehicleLamps(model) {
        if (monarchVehicleLampSets.has(model.type)) return monarchVehicleLampSets.get(model.type);
        const lamps = {};
        for (const [name, emission] of [['headOff', 0], ['headOn', 2], ['tailOff', .06], ['tailOn', .9], ['brake', 3]]) {
          lamps[name] = monarchVehicleFinish(new Three.MeshStandardMaterial({ side: Three.DoubleSide, forceSinglePass: true,
            roughness: 1, metalness: 1, vertexColors: true, alphaTest: .5, emissiveIntensity: emission }), model, false, false, true);
          sharedMaterials.add(lamps[name]);
        }
        monarchVehicleLampSets.set(model.type, lamps);
        return lamps;
      }
      let monarchVehicleEmptyPart;
      function monarchVehicleEmptyGeometry() {
        if (monarchVehicleEmptyPart) return monarchVehicleEmptyPart;
        const geometry = new Three.BufferGeometry();
        for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 4], ['finish', 2],
          ['avSourceUv', 2], ['avOrmSourceUv', 2], ['avNormalSourceUv', 2], ['avEmissiveSourceUv', 2],
          ['avAtlasRect', 4], ['avSurface', 4], ['avDoubleSide', 1], ['avPaintMask', 1]])
          geometry.setAttribute(name, new Three.Float32BufferAttribute([], size));
        geometry.setIndex([]);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere(); sharedGeometries.add(geometry);
        return (monarchVehicleEmptyPart = geometry);
      }
      function monarchVehicleKitFit(kit, model, data, k) {
        const M = CAR_M, source = model.seats, own = {};
        if (source?.hip) { own.hipX = source.hip[0] * k / kit.l; own.y = source.hip[1] * k / M; own.minY = own.y; own.z = Math.abs(source.hip[2]) * k / M; }
        if (source?.wheel) { own.wheel = [(source.wheel[0] - model.glass.xf) * k / M, source.wheel[1] * k / M]; own.wheelZ = source.wheel[2] * k / M; }
        if (source?.radius) own.radius = source.radius * k / M;
        if (source?.floor !== undefined) own.floor = source.floor * k / M;
        if (source?.tilt !== undefined) own.tilt = source.tilt;
        if (source?.recline !== undefined) own.recline = source.recline;
        kit.seats = carSeatPlan(kit.glass, kit.l, kit.seats.glass.w, M, kit.type, Object.keys(own).length ? own : null);
        if (!model.hasInterior) {
          const set = civSet();
          carCabinParts((geometry, matrix, color, finish) => civAddMatrix(set, geometry, matrix, { color, finish }),
            kit.glass, kit.l, kit.seats.glass.w, kit.seats, CAR_CABIN_TRIM[kit.type] || CAR_CABIN_TRIM.default, { two: true });
          kit.interiorFallback = civGeometry(set);
        } else kit.interiorFallback = null;
        // Missing source roles are genuinely absent: never show the generic
        // closed hood/panel boxes over an intact downloaded car.
        if (!sportsRoleTriangles(model, 'hood')) kit.hood = kit.far.hood = monarchVehicleEmptyGeometry();
        if (!sportsRoleTriangles(model, 'panels')) kit.paint = kit.far.paint = monarchVehicleEmptyGeometry();
        sportsNativeDoors(kit);
        kit.far.lamps = {};
        for (const [name, geometry] of Object.entries(kit.lamps)) kit.far.lamps[name] = approvedSuvFarPart(model, data, name, k) || geometry;
        for (const geometry of [kit.door, kit.trunk]) {
          const count = geometry.attributes.position.count;
          const surface = new Float32Array(count * 4);
          for (let i = 0; i < count; i++) surface.set([1, 0, 1, -1], i * 4);
          geometry.setAttribute('avSurface', new Three.Float32BufferAttribute(surface, 4));
          geometry.setAttribute('avDoubleSide', new Three.Float32BufferAttribute(new Float32Array(count), 1));
          if (model.paintRect) {
            const rect = new Float32Array(count * 4);
            for (let i = 0; i < count; i++) rect.set(model.paintRect, i * 4);
            geometry.setAttribute('avAtlasRect', new Three.Float32BufferAttribute(rect, 4));
          }
          for (const name of ['avOrmSourceUv', 'avNormalSourceUv', 'avEmissiveSourceUv'])
            if (!geometry.attributes[name]) geometry.setAttribute(name, geometry.attributes.avSourceUv.clone());
        }
      }
      const monarchVehicleRayInverse = new Three.Matrix4(), monarchVehicleLocalRay = new Three.Ray();
      function monarchVehicleMesh(mesh) {
        if (!mesh.isMesh || mesh.userData.monarchRay || !mesh.material?.userData?.monarchSource) return mesh;
        if (typeof militaryMarkRayMesh === 'function') militaryMarkRayMesh(mesh);
        const fullRaycast = mesh.raycast;
        mesh.userData.monarchRay = true;
        mesh.raycast = function(raycaster, intersections) {
          const first = intersections.length;
          fullRaycast.call(this, raycaster, intersections);
          const flags = this.geometry.attributes.avDoubleSide;
          if (!flags || intersections.length === first) return;
          monarchVehicleRayInverse.copy(this.matrixWorld).invert();
          monarchVehicleLocalRay.copy(raycaster.ray).applyMatrix4(monarchVehicleRayInverse);
          let at = first;
          for (let i = first; i < intersections.length; i++) {
            const hit = intersections[i];
            if (flags.getX(hit.face.a) < .5 && hit.face.normal.dot(monarchVehicleLocalRay.direction) >= 0) continue;
            intersections[at++] = hit;
          }
          intersections.length = at;
        };
        return mesh;
      }
      function monarchVehicleReport() {
        const data = monarchVehicleData(), models = {};
        if (data) for (const [key, model] of Object.entries(data.header.models)) {
          const textures = monarchVehicleTextureSets.get(key)?.textures;
          models[key] = { gameTypes: model.gameTypes, title: model.title, author: model.author, source: model.source, license: model.license,
            triangles: model.triangles, farTriangles: model.farTriangles, nativeCabin: !!model.hasInterior,
            nativeDoors: Object.keys(model.doors || {}), atlasSizes: textures ? Object.fromEntries(Object.entries(textures).map(([channel, texture]) =>
              [channel, [texture.image?.width || 0, texture.image?.height || 0]])) : {} };
        }
        return { loaded: !!data, enabled: vaEnabled, reducedTextures: !!monarchVehicleReduced, error: monarchVehicleLoadError, models };
      }
