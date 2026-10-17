      // ASSET CHAR: the burnt (and, for the army's models, worn and heat-darkened) look of the downloaded vehicle
      // models that draw from the shared vehicle atlas: per-car char materials swapped onto their atlas and paint meshes.
      /**
       * ASSET CHAR
       * A downloaded model draws its trim (an army model its whole body: the camouflage is the texture) from the shared
       * atlas materials (vaMaterials), and a plain-painted asset car's paint samples a single swatch texel, so the
       * procedural cars' soot map (paintVehicle: `m.paint.map = sootTexture`) cannot reach it: a burnt one kept its
       * paint and chrome. A model with atlas parts (`assetCharModel`) instead swaps those meshes, and its paint, onto
       * char materials of its own (`m.assetChar`): lit standard materials over the same atlas (or none, for the paint),
       * the colour sooted by the soot texture projected from each mesh's own frame (in world units) on three planes (so constant-UV paint
       * takes it too), matte, no clear coat, the embers in the emissive (`assetCharEmbers`). A model whose atlas is its
       * paint (`m.atlasPaint`: the army's) also takes the wear's grime and the fire's heat through them before it burns,
       * as procedural paint does. Intact models keep the shared materials (and the pristine merge); a repair or respray
       * swaps them back (`assetCharRelease`). The materials are made per car and pooled on release; their programs
       * (atlas cut-out, atlas, plain, vertex finish, approved PBR and livery) are compiled at the title prewarm (`assetCharWarm`, kept in sharedMaterials, so the
       * programs outlive every wreck).
       */
      const ASSET_CHAR_TILE = 1 / 12,
        assetCharGrime = new Three.Color('#585451'),
        assetCharHeat = new Three.Color('#1d1a17'),
        assetCharFree = { cut: [], atlas: [], plain: [], finish: [], approved: [], monarch: [] },
        ASSET_CHAR_GLSL = `
        vec3 charW = abs( normalize( vCharNormal ) );
        charW *= charW * charW;
        charW /= charW.x + charW.y + charW.z + 1e-4;
        vec3 charP = vCharPos * charState.w + charSeed;
        vec3 charSootTexel = texture2D( charSoot, charP.zy ).rgb * charW.x + texture2D( charSoot, charP.xz ).rgb * charW.y + texture2D( charSoot, charP.xy ).rgb * charW.z;
        // The shell's own shading (the atlas's light and dark) faintly under the soot; the blistered paint half greyed.
        float charLum = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
        vec3 charBurnt = mix( vec3( dot( charSootTexel, vec3( 0.299, 0.587, 0.114 ) ) ), charSootTexel, 0.6 ) * ( 0.45 + 0.4 * charLum );
        diffuseColor.rgb = mix( diffuseColor.rgb, charGrime, charState.x );
        diffuseColor.rgb = mix( diffuseColor.rgb, charHeat, charState.y );
        diffuseColor.rgb = mix( diffuseColor.rgb, charBurnt, charState.z );`;
      function assetCharPatch(material) {
        const own = material.userData.assetChar;
        material.onBeforeCompile = (shader) => {
          if (own.kind !== 'monarch') cityMaterialPatch(shader);
          shader.uniforms.charSoot = { value: sootTexture };
          shader.uniforms.charState = own.state;
          shader.uniforms.charSeed = own.seed;
          shader.uniforms.charGrime = { value: assetCharGrime };
          shader.uniforms.charHeat = { value: assetCharHeat };
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCharPos;\nvarying vec3 vCharNormal;')
            .replace('#include <project_vertex>', 'vCharPos = transformed * vec3( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ), length( modelMatrix[ 2 ].xyz ) );\nvCharNormal = objectNormal;\n#include <project_vertex>');
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              '#include <common>\nuniform sampler2D charSoot;\nuniform vec4 charState;\nuniform vec3 charSeed, charGrime, charHeat;\nvarying vec3 vCharPos;\nvarying vec3 vCharNormal;',
            )
            .replace('#include <map_fragment>', '#include <map_fragment>\n' + ASSET_CHAR_GLSL)
            // The embers glow through the soot where the texture's blistered paint shows (the procedural emissiveMap).
            .replace('#include <emissivemap_fragment>', 'vec3 charEmberRadiance = totalEmissiveRadiance * charSootTexel * charState.z;\n#include <emissivemap_fragment>\ntotalEmissiveRadiance = charState.z > 0.5 ? charEmberRadiance : totalEmissiveRadiance;');
          if (own.kind === 'finish' || own.kind === 'approved') {
            if (own.kind === 'approved') shader.uniforms.charRoughnessFloor = own.roughnessFloor;
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nattribute vec2 finish;\nvarying vec2 vFinish;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinish = finish;');
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nvarying vec2 vFinish;' + (own.kind === 'approved' ? '\nuniform float charRoughnessFloor;' : ''))
              .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = charState.z > 0.5 ? 0.97 : ' + (own.kind === 'approved' ? 'max(charRoughnessFloor, ' : '') + 'min(1.0, ' + (own.kind === 'approved' ? 'roughnessFactor * vFinish.x' : 'vFinish.x') + ' + charState.x * 2.7 + charState.y * 0.4)' + (own.kind === 'approved' ? ')' : '') + ';')
              .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = charState.z > 0.5 ? 0.12 : max(0.0, ' + (own.kind === 'approved' ? 'metalnessFactor * vFinish.y' : 'vFinish.y') + ' * (1.0 - charState.x * 2.7));');
          }
          if (own.kind === 'approved' && own.livery.value) {
            shader.uniforms.approvedLivery = own.livery;
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nattribute vec2 liveryUv;\nvarying vec2 vApprovedLiveryUv;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvApprovedLiveryUv = liveryUv;');
            // The underlying livery is sampled before soot, so a burnt marked car
            // cannot retain a clean sheriff star or white panel over the char.
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform sampler2D approvedLivery;\nvarying vec2 vApprovedLiveryUv;')
              .replace('#include <map_fragment>', '#include <map_fragment>\nvec4 approvedDecal = texture2D(approvedLivery, vApprovedLiveryUv);\ndiffuseColor.rgb = mix(diffuseColor.rgb, approvedDecal.rgb * diffuse, approvedDecal.a);');
          }
          if (own.kind === 'approved') {
            shader.uniforms.carDirt = own.dirt || own.noDirt;
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform vec2 carDirt;')
              .replace(ASSET_CHAR_GLSL, CIV_DIRT_GLSL + '\n' + ASSET_CHAR_GLSL);
            approvedVehicleAtlasPatch(shader);
          }
          if (own.kind === 'monarch') {
            // Apply soot around the original source hooks. The source patch
            // expands the remaining map chunks, retaining UV sets, sidedness,
            // paint masks, normal scale and cutouts on the burnt body too.
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = charState.z > 0.5 ? 0.97 : min(1.0, roughnessFactor + charState.x * 2.7 + charState.y * 0.4);')
              .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = charState.z > 0.5 ? 0.12 : metalnessFactor * (1.0 - charState.x * 2.7);');
            own.sourceCompile(shader);
          }
        };
        material.customProgramCacheKey = () => 'asset-char-' + own.kind + (own.sourceProgramKey ? '-' + own.sourceProgramKey : '') + (own.livery?.value ? '-livery' : '');
      }
      // Char kind: atlas cut-out, atlas, plain (no map), or atlas with per-vertex finish.
      function assetCharMaterial(kind) {
        const free = assetCharFree[kind];
        if (free.length) return free.pop();
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', map: kind === 'plain' || kind === 'monarch' ? null : kind === 'approved' ? approvedVehicleTexture() : vaAtlas(),
          roughnessMap: kind === 'approved' ? approvedVehicleTexture(true) : null,
          metalnessMap: kind === 'approved' ? approvedVehicleTexture(true) : null,
          vertexColors: kind === 'approved', alphaTest: kind === 'cut' || kind === 'finish' || kind === 'approved' ? 0.5 : 0 });
        material.userData.assetChar = { kind, state: { value: new Three.Vector4(0, 0, 0, ASSET_CHAR_TILE) }, seed: { value: new Three.Vector3() }, livery: { value: null }, roughnessFloor: { value: 0 }, noDirt: { value: new Three.Vector2(0, -1e6) }, dirt: null };
        assetCharPatch(material);
        return material;
      }
      // Whether a model draws from the shared atlas (asked once per model).
      function assetCharModel(m) {
        if (m.assetAtlas === undefined) {
          const shared = vaMaterialSet;
          let found = false;
          m.group.traverse((o) => {
            if (o.isMesh && (o.material?.userData?.assetAtlas || shared && (o.material === shared.trim || o.material === shared.rubber || o.material === shared.rim))) found = true;
          });
          m.assetAtlas = found;
        }
        return m.assetAtlas;
      }
      /*
       * Swaps the model's atlas meshes (and with `burnt` its paint meshes) onto its char materials, made on first use:
       * one per source material, each starting from the source's finish. Meshes already swapped are left alone, so a
       * worn army model that then burns only adds its paint.
       */
      function assetCharSwap(c, m, burnt) {
        const shared = vaMaterials();
        let set = m.assetChar;
        if (!set) {
          set = m.assetChar = { swaps: [], sources: [], materials: [], ember: -1 };
          // Each car's soot sits differently (its id). The shader scales the mesh's own frame to world units (an army
          // model is drawn at its design size, a slab is a unit box scaled), so the soot is one size on every part.
          const tile = ASSET_CHAR_TILE,
            id = c.id || 0;
          set.seed = [((id * 0.6180339) % 1) * 7, ((id * 0.4142135) % 1) * 7, ((id * 0.7320508) % 1) * 7];
          set.tile = tile;
        }
        const kindOf = (material) => material.userData?.monarchSource && !material.userData.assetChar ? 'monarch' :
          material.userData?.assetAtlas || (material === shared.trim ? 'cut' : material === shared.rubber || material === shared.rim ? 'atlas' : burnt && material === m.paint ? 'plain' : null);
        const charFor = (source) => {
          const kind = kindOf(source);
          if (!kind) return source;
          let i = set.sources.indexOf(source);
          if (i < 0) {
            const material = assetCharMaterial(kind),
              own = material.userData.assetChar;
            material.roughness = source.roughness;
            material.metalness = source.metalness;
            material.envMapIntensity = source.envMapIntensity;
            if (kind === 'finish' || kind === 'approved' || kind === 'monarch') {
              material.map = source.map;
              material.vertexColors = source.vertexColors;
              material.needsUpdate = true;
            }
            if (kind === 'approved' || kind === 'monarch') {
              // A reused approved material can switch between opaque bodywork and
              // authored transparent optics; restore every render flag from its source.
              material.transparent = source.transparent;
              material.opacity = source.opacity;
              material.alphaTest = source.alphaTest;
              material.depthWrite = source.depthWrite;
              material.side = source.side;
              material.forceSinglePass = source.forceSinglePass;
              material.roughnessMap = source.roughnessMap;
              material.metalnessMap = source.metalnessMap;
              material.emissiveMap = source.emissiveMap || null;
              material.emissiveIntensity = source.emissiveIntensity;
              if (kind === 'monarch') {
                material.extensions = { ...source.extensions };
                material.normalMap = source.normalMap || null;
                material.normalScale.copy(source.normalScale);
                own.sourceCompile = source.onBeforeCompile;
                own.sourceProgramKey = source.customProgramCacheKey();
              }
              own.livery.value = source.userData.approvedLivery || null;
              own.roughnessFloor.value = source.userData.approvedRubber ? 0.78 : source.userData.approvedPaint ? 0.22 : 0;
              own.dirt = source.userData.carDirt || null;
            }
            material.emissive.copy(source.emissive);
            own.state.value.set(0, 0, 0, set.tile);
            own.seed.value.set(set.seed[0], set.seed[1], set.seed[2]);
            i = set.sources.push(source) - 1;
            set.materials.push(material);
          }
          return set.materials[i];
        };
        m.group.traverse((o) => {
          if (!o.isMesh) return;
          // A door cut from the body draws [paint, engine bay] (damage3d-bodies.js).
          if (Array.isArray(o.material)) {
            if (!o.material.some(kindOf)) return;
            set.swaps.push(o, o.material);
            o.material = o.material.map(charFor);
          } else if (kindOf(o.material)) {
            set.swaps.push(o, o.material);
            o.material = charFor(o.material);
          }
        });
        // Parts the damage adds later (a sprung door or trunk lid in the paint) are swapped when the shape changes.
        set.shape = m.shapeVersion;
        set.ember = -1;
        assetCharState(m, 0, 0, burnt ? 1 : 0);
      }
      /* The char amounts on every char material of the model: `grime` and `heat` (0..1 lerps, as paintVehicle's), `burnt` 0/1. */
      function assetCharState(m, grime, heat, burnt) {
        const set = m.assetChar;
        if (!set) return;
        for (let i = 0; i < set.materials.length; i++) {
          const material = set.materials[i],
            source = set.sources[i],
            state = material.userData.assetChar.state.value;
          state.x = grime;
          state.y = heat;
          state.z = burnt;
          // Burnt paint and trim are matte; wear and heat dull them on the way (paintVehicle's numbers).
          material.roughness = burnt ? 0.97 : Math.min(1, source.roughness + grime * 2.7 + heat * 0.4);
          material.metalness = burnt ? 0.12 : source.metalness * (1 - grime * 2.7);
          if (!burnt) material.emissive.copy(source.emissive);
        }
      }
      /* The embers' glow (linear RGB) on a burnt model's char materials, written only when it changed. */
      function assetCharEmbers(m, r, g, b) {
        const set = m.assetChar;
        if (!set || set.ember === r) return;
        set.ember = r;
        for (let i = 0; i < set.materials.length; i++) set.materials[i].emissive.setRGB(r, g, b);
      }
      // A source-backed door can be created after its body has already charred.
      // It shares the live char material immediately, but must remember the clean
      // source for release; another swap ignores materials that are already char.
      function assetCharAdopt(m, mesh) {
        const set = m.assetChar;
        if (!set || set.swaps.includes(mesh)) return;
        let inherited = false;
        const original = material => {
          const index = set.materials.indexOf(material);
          if (index < 0) return material;
          inherited = true; return set.sources[index];
        }, source = Array.isArray(mesh.material) ? mesh.material.map(original) : original(mesh.material);
        if (inherited) set.swaps.push(mesh, source);
      }
      /* Puts the shared materials back (a repair, a respray) and returns the char materials to the pool. */
      function assetCharRelease(m) {
        const set = m.assetChar;
        if (!set) return;
        for (let i = 0; i < set.swaps.length; i += 2) set.swaps[i].material = set.swaps[i + 1];
        for (const material of set.materials) {
          const free = assetCharFree[material.userData.assetChar.kind];
          if (material.userData.assetChar.kind === 'monarch') {
            material.userData.assetChar.sourceCompile = null;
            material.userData.assetChar.sourceProgramKey = null;
            material.userData.assetChar.dirt = null;
          }
          if (free.length < 12) free.push(material);
          else material.dispose();
        }
        m.assetChar = undefined;
      }
      /*
       * Title prewarm (render3d-resources.js): a stand-in asset model burnt so the char programs compile; its char
       * materials stay in sharedMaterials (never disposed), which keeps the programs for every later wreck.
       */
      function assetCharWarm(m) {
        if (!assetCharModel(m)) return false;
        assetCharSwap({ id: 1 }, m, true);
        const kinds = new Set(m.assetChar.materials.map((material) => material.userData.assetChar.kind));
        // A kind the stand-in lacks (an asset car has trim, rims and paint) gets a material on a box in its group.
        for (const kind of ['cut', 'atlas', 'plain', 'finish', 'approved'])
          if (!kinds.has(kind)) {
            const material = assetCharMaterial(kind),
              geometry = kind === 'finish' || kind === 'approved' ? boxGeo.clone() : boxGeo,
              stand = new Three.Mesh(geometry, material);
            if (kind === 'finish' || kind === 'approved') {
              const finish = new Float32Array(geometry.attributes.position.count * 2);
              for (let i = 0; i < finish.length; i += 2) { finish[i] = 0.9; finish[i + 1] = 0.02; }
              geometry.setAttribute('finish', new Three.BufferAttribute(finish, 2));
              if (kind === 'approved') {
                geometry.setAttribute('color', new Three.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
                geometry.setAttribute('avSourceUv', geometry.attributes.uv.clone());
                const rect = new Float32Array(geometry.attributes.position.count * 4);
                for (let i = 0; i < rect.length; i += 4) { rect[i + 2] = 1; rect[i + 3] = 1; }
                geometry.setAttribute('avAtlasRect', new Three.BufferAttribute(rect, 4));
                const liveryMaterial = assetCharMaterial('approved');
                liveryMaterial.userData.assetChar.livery.value = sootTexture;
                geometry.setAttribute('liveryUv', geometry.attributes.uv.clone());
                m.group.add(new Three.Mesh(geometry, liveryMaterial));
                // Optical covers use the same atlas shader with a distinct sidedness
                // and alpha path; compile that variant before the first burnt Jimny.
                const opticalMaterial = assetCharMaterial('approved');
                Object.assign(opticalMaterial, { transparent: true, opacity: 1, alphaTest: 0,
                  depthWrite: false, side: Three.DoubleSide, forceSinglePass: true });
                m.group.add(new Three.Mesh(geometry, opticalMaterial));
                // The sports source also has an emissive atlas. Compile both
                // opaque and optical char variants before the first damaged C8.
                for (const optical of [false, true]) {
                  const emissiveMaterial = assetCharMaterial('approved');
                  emissiveMaterial.emissiveMap = sootTexture;
                  if (optical) Object.assign(emissiveMaterial, { transparent: true, alphaTest: 0,
                    depthWrite: false, side: Three.DoubleSide, forceSinglePass: true });
                  m.group.add(new Three.Mesh(geometry, emissiveMaterial));
                }
              }
              sharedGeometries.add(geometry);
            }
            m.group.add(stand);
          }
        m.group.traverse((o) => {
          if (o.material?.userData?.assetChar) sharedMaterials.add(o.material);
        });
        m.assetChar = undefined;
        return true;
      }
      // Console `assetChar()`: the char state of every model drawn now.
      function assetCharReport() {
        const out = [];
        for (const [c, m] of carModels)
          if (m.assetChar)
            out.push({
              id: c.id,
              type: c.type,
              materials: m.assetChar.materials.map((material) => material.userData.assetChar.kind),
              swapped: m.assetChar.swaps.length / 2,
              state: Array.from(m.assetChar.materials[0]?.userData.assetChar.state.value.toArray() || []).map((v) => Math.round(v * 1000) / 1000),
              ember: Math.round(Math.max(0, m.assetChar.ember) * 1000) / 1000,
            });
        return { models: out, pooled: { cut: assetCharFree.cut.length, atlas: assetCharFree.atlas.length, plain: assetCharFree.plain.length, finish: assetCharFree.finish.length, approved: assetCharFree.approved.length } };
      }
