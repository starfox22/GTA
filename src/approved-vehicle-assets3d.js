      // Approved replacement vehicle pack: independent cached data, source material atlases,
      // per-vertex finishes and close/far geometry. The original vehicle pack stays intact.
      let approvedVehicleCache;
      function approvedVehicleData() {
        if (approvedVehicleCache !== undefined) return approvedVehicleCache;
        approvedVehicleCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.approvedVehicleModels;
        if (!url || url.length < 64) return null;
        try {
          const text = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(text.length);
          for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw new Error('approved vehicles: invalid pack');
          const view = new DataView(bytes.buffer), size = view.getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + size))),
            base = 12 + size, arrays = {},
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array };
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
            if (!types[type] || offset < 0 || count < 0 || base + offset + count * types[type].BYTES_PER_ELEMENT > bytes.length)
              throw new Error('approved vehicles: invalid array ' + name);
            arrays[name] = new types[type](bytes.buffer, base + offset, count);
          }
          for (const model of Object.values(header.models)) model.approved = true;
          approvedVehicleCache = { header, arrays };
        } catch (error) { console.error(error); }
        return approvedVehicleCache;
      }
      function approvedVehicleModel(key) {
        if (!key) return null;
        return approvedVehicleData()?.header.models[key] || null;
      }
      function approvedVehicleGeometry(model, part, scale, uvAt) {
        return vaGeometry(model, approvedVehicleData(), part, scale, uvAt);
      }
      const approvedVehicleTextures = [];
      let approvedVehicleTextureTier;
      function approvedVehicleLoadTexture(texture, orm, reduced) {
        const key = orm ? 'approvedVehicleOrm' : 'approvedVehicleAlbedo',
          url = typeof ASSETS !== 'undefined' && (ASSETS[key + (reduced ? 'Low' : '')] || ASSETS[key]);
        if (!url || typeof Image === 'undefined') return;
        const epoch = (texture.userData.approvedEpoch || 0) + 1;
        texture.userData.approvedEpoch = epoch;
        const image = new Image();
        image.onload = () => {
          if (texture.userData.approvedEpoch !== epoch) return;
          // r160's WebGL2 texture storage is immutable. Reallocate on a size
          // change while retaining this Texture object and all material references.
          if (texture.image && (texture.image.width !== image.width || texture.image.height !== image.height)) texture.dispose();
          texture.image = image; texture.needsUpdate = true;
          try { renderer.initTexture(texture); } catch (error) {}
        };
        image.src = url;
      }
      function approvedVehicleTextureQuality() {
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (reduced === approvedVehicleTextureTier) return;
        approvedVehicleTextureTier = reduced;
        for (let i = 0; i < approvedVehicleTextures.length; i++)
          if (approvedVehicleTextures[i]) approvedVehicleLoadTexture(approvedVehicleTextures[i], i === 1, reduced);
      }
      function approvedVehicleTexture(orm = false) {
        const slot = orm ? 1 : 0;
        if (approvedVehicleTextures[slot]) return approvedVehicleTextures[slot];
        const texture = new Three.Texture();
        texture.colorSpace = orm ? Three.NoColorSpace : Three.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const reduced = (activeTier?.lodBias || 1) > 1.05;
        if (approvedVehicleTextureTier === undefined) approvedVehicleTextureTier = reduced;
        approvedVehicleLoadTexture(texture, orm, reduced);
        approvedVehicleTextures[slot] = texture;
        return texture;
      }
      // Repeat source UVs before applying the atlas rectangle: repeating an entire
      // atlas would sample another model, and clamping would erase tiled detail.
      function approvedVehicleAtlasPatch(shader) {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec2 avSourceUv;\nattribute vec4 avAtlasRect;\nvarying vec2 vAvSourceUv;\nvarying vec4 vAvAtlasRect;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAvSourceUv = avSourceUv;\nvAvAtlasRect = avAtlasRect;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vAvSourceUv;\nvarying vec4 vAvAtlasRect;')
          .replace('#include <map_fragment>', 'vec2 approvedUv = vAvAtlasRect.xy + fract(vAvSourceUv) * vAvAtlasRect.zw;\n' + Three.ShaderChunk.map_fragment.replace(/\bvMapUv\b/g, 'approvedUv'))
          .replace('#include <roughnessmap_fragment>', Three.ShaderChunk.roughnessmap_fragment.replace(/\bvRoughnessMapUv\b/g, 'approvedUv'))
          .replace('#include <metalnessmap_fragment>', Three.ShaderChunk.metalnessmap_fragment.replace(/\bvMetalnessMapUv\b/g, 'approvedUv'));
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
          Three.ShaderChunk.emissivemap_fragment.replace(/\bvEmissiveMapUv\b/g, 'approvedUv'));
      }
      function approvedVehicleMaterialPatch(material, paint = false, livery = null, rubber = false) {
        material.userData.assetAtlas = 'approved';
        material.userData.approvedPaint = paint;
        material.userData.approvedLivery = livery;
        material.userData.approvedRubber = rubber;
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 finish;\nvarying vec2 vApprovedFinish;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvApprovedFinish = finish;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vApprovedFinish;')
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + (paint || rubber ? 'roughnessFactor = max(' + (rubber ? '0.78' : '0.22') + ', roughnessFactor * vApprovedFinish.x);' : 'roughnessFactor *= vApprovedFinish.x;'))
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= ' + (paint ? 'min(0.18, vApprovedFinish.y);' : 'vApprovedFinish.y;'));
          if (livery) {
            shader.uniforms.approvedLivery = { value: livery };
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nattribute vec2 liveryUv;\nvarying vec2 vApprovedLiveryUv;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvApprovedLiveryUv = liveryUv;');
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform sampler2D approvedLivery;\nvarying vec2 vApprovedLiveryUv;')
              .replace('#include <map_fragment>', '#include <map_fragment>\nvec4 approvedDecal = texture2D(approvedLivery, vApprovedLiveryUv);\ndiffuseColor.rgb = mix(diffuseColor.rgb, approvedDecal.rgb * diffuse, approvedDecal.a);');
          }
          if (paint) {
            shader.uniforms.carDirt = material.userData.carDirt || CIV_NO_DIRT;
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform vec2 carDirt;')
              .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n' + CIV_DIRT_GLSL)
              .replace('roughnessFactor = max(0.22, roughnessFactor * vApprovedFinish.x);', 'roughnessFactor = mix(max(0.22, roughnessFactor * vApprovedFinish.x), 0.82, saturate(carSill));')
              .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - 0.85 * saturate(carSill);\n#endif');
          }
          approvedVehicleAtlasPatch(shader);
        };
        material.customProgramCacheKey = () => 'approved-vehicle-' + (rubber ? 'rubber' : paint ? 'paint' : 'trim') + (livery ? '-livery' : '');
        return material;
      }
      let approvedVehicleMaterialSet;
      function approvedVehicleMaterials(model) {
        if (approvedVehicleMaterialSet) return approvedVehicleMaterialSet;
        const atlas = approvedVehicleTexture(), orm = approvedVehicleTexture(true),
          trim = approvedVehicleMaterialPatch(new Three.MeshStandardMaterial({ map: atlas, roughnessMap: orm,
            metalnessMap: orm, roughness: 1, metalness: 1, vertexColors: true, alphaTest: 0.5, envMapIntensity: 1 })),
          rubber = approvedVehicleMaterialPatch(new Three.MeshStandardMaterial({ map: atlas, roughnessMap: orm,
            metalnessMap: orm, roughness: 0.86, metalness: 0.02, vertexColors: true, alphaTest: 0.5, envMapIntensity: 0.5 }), false, null, true),
          opticalGlass = approvedVehicleMaterialPatch(new Three.MeshStandardMaterial({ map: atlas, roughnessMap: orm,
            metalnessMap: orm, roughness: 1, metalness: 1, vertexColors: true, transparent: true, opacity: 1,
            alphaTest: 0, depthWrite: false, side: Three.DoubleSide, forceSinglePass: true, envMapIntensity: 1 })),
          glass = carGlassMaterial('#26333c', 0.3), glassFar = carGlassMaterial('#26333c', 0.64);
        approvedVehicleMaterialSet = { trim, rubber, rim: trim, opticalGlass, glass, glassFar };
        sharedMaterials.add(trim); sharedMaterials.add(rubber); sharedMaterials.add(glass); sharedMaterials.add(glassFar);
        sharedMaterials.add(opticalGlass);
        return approvedVehicleMaterialSet;
      }
      function approvedVehiclePaint(vehicle, model, options = {}) {
        const livery = options.livery || null,
          material = new Three.MeshPhysicalMaterial({ color: vehicle.color, map: approvedVehicleTexture(),
            roughnessMap: approvedVehicleTexture(true), metalnessMap: approvedVehicleTexture(true),
            roughness: 1, metalness: 1, vertexColors: true, clearcoat: 0.8, clearcoatRoughness: 0.08,
            envMapIntensity: 1, alphaTest: 0.5 });
        material.userData.carDirt = { value: new Three.Vector2(0, -1e6) };
        return approvedVehicleMaterialPatch(material, true, livery);
      }
      const approvedVehicleImpostorPaints = new Map();
      function approvedVehicleImpostorPaint(model, options = {}) {
        const key = model.type + ':' + (options.livery?.uuid || 'plain');
        if (approvedVehicleImpostorPaints.has(key)) return approvedVehicleImpostorPaints.get(key);
        const material = approvedVehiclePaint({ color: '#ffffff' }, model, options);
        sharedMaterials.add(material);
        approvedVehicleImpostorPaints.set(key, material);
        return material;
      }
      function approvedVehicleLod(c, m) {
        const parts = m.approvedLodParts;
        if (!parts?.length) return;
        if (m.approvedLodDamageVersion !== c.damageVersion) {
          const damage = c.damage;
          m.approvedLodDamageVersion = c.damageVersion;
          m.approvedLodDamagePinned = !!(c.dents?.length || damage?.marks?.length || damage &&
            (damage.front || damage.rear || damage.left || damage.right || damage.burnt || damage.burning ||
              [damage.parts, damage.glass, damage.lights, damage.tires].some(record => record && Object.values(record).some(Boolean))));
        }
        const dx = c.x - player.x, dy = c.y - player.y,
          reach = 210 / (activeTier?.lodBias || 1),
          damaged = c.hp < c.maxhp || m.damageVersion !== c.damageVersion || m.approvedLodDamagePinned || !!c.trunkOpen || !!m.doorBodyMask,
          far = c !== player.car && !damaged && dx * dx + dy * dy > reach * reach * (m.approvedLodFar ? 0.81 : 1.21);
        if (far === !!m.approvedLodFar) return;
        m.approvedLodFar = far;
        m.shapeVersion = (m.shapeVersion || 0) + 1;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          part.mesh.geometry = far ? part.far : part.near;
        }
        if (m.approvedInterior) m.approvedInterior.visible = !far;
      }
      function approvedVehicleReport() {
        const data = approvedVehicleData(), models = [];
        for (const [car, model] of carModels) {
          if (!model.approvedAsset) continue;
          const pool = bodyPools.get(policeImpostorKey(car) || approvedSuvKey(car) || car.type),
            parts = model.approvedLodParts || model.motoLod?.pairs;
          models.push({ id: car.id, type: car.type, asset: model.approvedAsset, far: !!(model.approvedLodFar || model.motoLod?.isFar),
            triangles: parts?.reduce((sum, part) => sum + (part.mesh.geometry.index?.count || 0) / 3, 0) || 0,
            visible: !!model.group.visible, pool: { ready: !!pool, instances: pool?.parts?.[0]?.mesh.count || 0,
              triangles: pool?.parts?.reduce((sum, part) => sum + (part.mesh.geometry.index?.count || 0) / 3, 0) || 0 } });
        }
        return { loaded: !!data, keys: data ? Object.keys(data.header.models) : [],
          atlasSizes: approvedVehicleTextures.map(texture => [texture?.image?.width || 0, texture?.image?.height || 0]),
          reducedTextures: !!approvedVehicleTextureTier, models };
      }
