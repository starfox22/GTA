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
       * swaps them back (`assetCharRelease`). The materials are made per car and pooled on release; their three programs
       * (atlas cut-out, atlas, plain) are compiled at the title prewarm (`assetCharWarm`, kept in sharedMaterials, so the
       * programs outlive every wreck).
       */
      const ASSET_CHAR_TILE = 1 / 12,
        assetCharGrime = new Three.Color('#585451'),
        assetCharHeat = new Three.Color('#1d1a17'),
        assetCharFree = { cut: [], atlas: [], plain: [] },
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
          cityMaterialPatch(shader);
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
            .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= charSootTexel * charState.z;');
        };
        material.customProgramCacheKey = () => 'asset-char';
      }
      // A char material of `kind` ('cut': the atlas with the trim's alpha test, 'atlas', 'plain': no map) from the pool.
      function assetCharMaterial(kind) {
        const free = assetCharFree[kind];
        if (free.length) return free.pop();
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', map: kind === 'plain' ? null : vaAtlas(), alphaTest: kind === 'cut' ? 0.5 : 0 });
        material.userData.assetChar = { kind, state: { value: new Three.Vector4(0, 0, 0, ASSET_CHAR_TILE) }, seed: { value: new Three.Vector3() } };
        assetCharPatch(material);
        return material;
      }
      // Whether a model draws from the shared atlas (asked once per model).
      function assetCharModel(m) {
        if (m.assetAtlas === undefined) {
          const shared = vaMaterialSet;
          let found = false;
          if (shared)
            m.group.traverse((o) => {
              if (o.isMesh && (o.material === shared.trim || o.material === shared.rubber || o.material === shared.rim)) found = true;
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
        const kindOf = (material) =>
          material === shared.trim ? 'cut' : material === shared.rubber || material === shared.rim ? 'atlas' : burnt && material === m.paint ? 'plain' : null;
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
            material.emissive.setRGB(0, 0, 0);
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
        }
      }
      /* The embers' glow (linear RGB) on a burnt model's char materials, written only when it changed. */
      function assetCharEmbers(m, r, g, b) {
        const set = m.assetChar;
        if (!set || set.ember === r) return;
        set.ember = r;
        for (let i = 0; i < set.materials.length; i++) set.materials[i].emissive.setRGB(r, g, b);
      }
      /* Puts the shared materials back (a repair, a respray) and returns the char materials to the pool. */
      function assetCharRelease(m) {
        const set = m.assetChar;
        if (!set) return;
        for (let i = 0; i < set.swaps.length; i += 2) set.swaps[i].material = set.swaps[i + 1];
        for (const material of set.materials) {
          const free = assetCharFree[material.userData.assetChar.kind];
          if (free.length < 12) free.push(material);
        }
        m.assetChar = undefined;
      }
      /*
       * Title prewarm (render3d-resources.js): a stand-in asset model burnt so the three char programs compile; its char
       * materials stay in sharedMaterials (never disposed), which keeps the programs for every later wreck.
       */
      function assetCharWarm(m) {
        if (!assetCharModel(m)) return false;
        assetCharSwap({ id: 1 }, m, true);
        const kinds = new Set(m.assetChar.materials.map((material) => material.userData.assetChar.kind));
        // A kind the stand-in lacks (an asset car has trim, rims and paint) gets a material on a box in its group.
        for (const kind of ['cut', 'atlas', 'plain'])
          if (!kinds.has(kind)) {
            const material = assetCharMaterial(kind),
              stand = new Three.Mesh(boxGeo, material);
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
        return { models: out, pooled: { cut: assetCharFree.cut.length, atlas: assetCharFree.atlas.length, plain: assetCharFree.plain.length } };
      }
