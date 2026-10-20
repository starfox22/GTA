      // Polyte's downloaded CC-BY-4.0 RPG-7: exact source near faces/split normals and PBR colours.
      // Source/converter/hashes: tools/rocket_launcher_model.py, docs/audit/military-combat-review-2026-10-20/bazooka-source.json.
      // The shared source buffers are immutable after decoding; only each crowd batch's instance attributes change.
      let rocketLauncherCache;
      function rocketLauncherData() {
        if (rocketLauncherCache !== undefined) return rocketLauncherCache;
        rocketLauncherCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.rocketLauncherModel;
        if (!url) return null;
        const encoded = atob(url.slice(url.indexOf(',') + 1)),
          bytes = new Uint8Array(encoded.length);
        for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
        if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECRPG01') throw new Error('rocket launcher: invalid model');
        const headerLength = new DataView(bytes.buffer).getUint32(8, true),
          header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))),
          base = 12 + headerLength,
          types = { f4: Float32Array, u2: Uint16Array },
          arrays = {};
        for (const [name, [type, offset, count]] of Object.entries(header.arrays)) arrays[name] = new types[type](bytes.buffer, base + offset, count);
        rocketLauncherCache = { header, arrays };
        return rocketLauncherCache;
      }
      function rocketLauncherGeometry(lod = 'near') {
        const data = rocketLauncherData();
        if (!data) return null;
        const geometry = new Three.BufferGeometry();
        for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3], ['rocketFinish', 2]])
          geometry.setAttribute(name, new Three.BufferAttribute(data.arrays[lod + '_' + name], size));
        geometry.setIndex(new Three.BufferAttribute(data.arrays[lod + '_index'], 1));
        geometry.computeBoundingSphere();
        return geometry;
      }
      // Source baseColorFactor is already linear; its six used materials are batched with their own finish.
      // One material and one instanced draw per LOD, regardless of how many people hold the launcher.
      const rocketLauncherMaterial = (() => {
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, metalness: 1, side: Three.DoubleSide });
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 rocketFinish;\nvarying vec2 vRocketFinish;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRocketFinish = rocketFinish;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vRocketFinish;')
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vRocketFinish.x;')
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vRocketFinish.y;');
        };
        material.customProgramCacheKey = () => 'downloaded-rpg7-source';
        return material;
      })();
      // The player's full source stays visible at every zoom; distant crowd holders use the small source-derived copy.
      function rigWeaponPart(weapon, hero = false) {
        return weapon === 'rocket' && !hero && BODY === BODY_STREET ? P.rocketFar : P[weapon];
      }
