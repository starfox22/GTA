      // Wall skin: real CC0 PBR materials (ambientCG brick, concrete, corrugated steel, plaster, clay roof tiles from
      // assets/wall-skin.webp, packed by tools/wall_skin.py) drawn at true scale on the shared facades' masonry.
      /**
       * WALL SKIN
       * The facade atlas (`wallTextures`) paints four bays by four storeys into 512 pixels, about 37 pixels a metre:
       * fine from the street camera, a soft smear of bricks from the chase view. The shared facades' program
       * (cityFacadePatch) now also draws a real material over the masonry, in world space at its true size (a brick
       * 21.5 x 6.5 cm in 7.5 cm courses), so it never stretches with a building's width:
       *
       *  - the masonry keeps the atlas's own colour, weathering and sills, read at a coarser mip (`low`, at least
       *    8 texels: the painted brick courses are gone) and multiplied by the photo's colour over its mean, so the
       *    per-building tint (vertex colour) and the atlas still set the tone and the photo adds only its pattern;
       *  - the windows stay the atlas's: its gloss map (`roughnessMap`, matte masonry, smooth panes) masks the skin;
       *  - where a pixel cannot resolve the skin (the street camera, far walls) the coarse read is the plain read and
       *    the photo's mips are its mean: the wall is the old one, with no seam or shimmer;
       *  - the photo's normal (OpenGL X, Y) and roughness light the masonry on MEDIUM and up (`cityGroundDetail`).
       *
       * Layers are a texture array (one sampler, no new program): a material picks its layer with a uniform
       * (`cityWallLayer`, -1 for none), so every facade still shares the one `cityFacade` program and batches as
       * before; the chase view's far copy draws the same material. FRONT PAINT, shop windows and curtain walls take
       * no layer. `lookSwitches({ wallSkin: false })` is the A/B in one page; `wallSkin()` the report.
       */
      // Layers of assets/wall-skin.webp in order (tools/wall_skin.py LAYERS) with their tile in world units (8 a metre) and
      // how much of the atlas's own fine detail they keep (none for brick: its painted courses would double the photo's).
      const WALL_SKIN_LAYERS = [
        { name: 'brick', id: 'Bricks059', tile: [7.2, 9.6], keep: 0 }, // 4 bricks of 22.5 cm by 16 courses of 7.5 cm
        { name: 'concrete', id: 'Concrete034', tile: [24, 24], keep: 0.85 },
        { name: 'corrugated', id: 'CorrugatedSteel005', tile: [12, 12], keep: 0.3 }, // 10 ribs at 15 cm
        { name: 'plaster', id: 'Plaster003', tile: [16, 16], keep: 0.5 },
        { name: 'roofTiles', id: 'RoofingTiles014A', tile: [38, 33], keep: 0 }, // 19 tile columns of 25 cm by 11 courses
      ];
      // The facade atlas quadrant's skin: brick, office, warehouse, stucco (render3d-terrain.js wallTextures).
      const WALL_SKIN_FOR_QUADRANT = [0, 1, 2, 3];
      const wallSkinSwitch = { value: 1 };
      const wallSkin = (() => {
        const image = visualAssets.wallSkin,
          layers = WALL_SKIN_LAYERS.length,
          means = WALL_SKIN_LAYERS.map(() => new Three.Vector3(0.5, 0.5, 0.5));
        let size = 1,
          albedo = new Uint8Array([128, 128, 128, 255]),
          detail = new Uint8Array([128, 128, 255, 255]),
          ready = false;
        if (image && image.width >= 2 && image.height >= layers) {
          size = image.width / 2;
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = size * layers;
          const g = canvas.getContext('2d', { willReadFrequently: true });
          g.drawImage(image, 0, 0);
          const pixels = g.getImageData(0, 0, canvas.width, canvas.height).data,
            n = size * size;
          albedo = new Uint8Array(n * 4 * layers);
          detail = new Uint8Array(n * 4 * layers);
          const linear = (c) => {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          };
          for (let layer = 0; layer < layers; layer++) {
            let r = 0,
              gr = 0,
              b = 0,
              count = 0;
            for (let y = 0; y < size; y++) {
              const row = (layer * size + y) * canvas.width * 4,
                out = (layer * n + y * size) * 4;
              albedo.set(pixels.subarray(row, row + size * 4), out);
              detail.set(pixels.subarray(row + size * 4, row + size * 8), out);
              if (y % 4) continue;
              for (let x = 0; x < size; x += 4) {
                const i = row + x * 4;
                r += linear(pixels[i]);
                gr += linear(pixels[i + 1]);
                b += linear(pixels[i + 2]);
                count++;
              }
            }
            means[layer].set(r / count, gr / count, b / count);
          }
          ready = true;
        }
        const array = (data, colour) => {
          const t = new Three.DataArrayTexture(data, size, size, ready ? layers : 1);
          t.format = Three.RGBAFormat;
          t.type = Three.UnsignedByteType;
          t.colorSpace = colour ? Three.SRGBColorSpace : Three.NoColorSpace;
          t.wrapS = t.wrapT = Three.RepeatWrapping;
          t.magFilter = Three.LinearFilter;
          t.minFilter = Three.LinearMipmapLinearFilter;
          t.generateMipmaps = ready;
          t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          t.needsUpdate = true;
          return t;
        };
        return {
          ready,
          means,
          uniforms: {
            cityWallAlbedo: { value: array(albedo, true) },
            cityWallDetail: { value: array(detail, false) },
            cityWallSkin: wallSkinSwitch,
          },
        };
      })();
      const WALL_SKIN_PARS = `
        uniform highp sampler2DArray cityWallAlbedo;
        uniform highp sampler2DArray cityWallDetail;
        uniform float cityWallSkin;
        uniform float cityWallLayer;
        uniform vec2 cityWallTile;
        uniform vec4 cityWallMean;
        uniform vec3 cityWallKey;
        uniform float cityGroundDetail;`;
      // Replaces three.js's map_fragment: the atlas read, with the skin over its masonry.
      const WALL_SKIN_MAP = `
        float wallSkinShare = 0.0;
        vec3 wallSkinTangent = vec3( 1.0, 0.0, 0.0 );
        vec3 wallSkinUv = vec3( 0.0 );
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          vec3 wallSkinN = inverseTransformDirection( normalize( vNormal ), viewMatrix );
          if ( cityWallLayer >= 0.0 && cityWallSkin > 0.5 && abs( wallSkinN.y ) < 0.5 ) {
            wallSkinTangent = normalize( vec3( wallSkinN.z, 0.0, -wallSkinN.x ) );
            wallSkinUv = vec3( vec2( dot( vCityWorld.xz, wallSkinTangent.xz ), vCityWorld.y ) / cityWallTile, cityWallLayer );
            #ifdef USE_ROUGHNESSMAP
              wallSkinShare = smoothstep( 0.6, 0.85, texture2D( roughnessMap, vRoughnessMapUv ).g );
            #else
              wallSkinShare = 1.0;
            #endif
            vec2 atlasPx = vMapUv * vec2( textureSize( map, 0 ) );
            vec2 dx = dFdx( atlasPx ), dy = dFdy( atlasPx );
            float atlasLod = 0.5 * log2( max( max( dot( dx, dx ), dot( dy, dy ) ), 1e-6 ) );
            vec3 low = textureLod( map, vMapUv, max( atlasLod, 2.0 ) ).rgb;
            // Only the plain wall: sills, lintels, frames, soot-black and bare patches keep the atlas.
            float lowLuma = dot( low, vec3( 0.2126, 0.7152, 0.0722 ) ),
              keyLuma = dot( cityWallKey, vec3( 0.2126, 0.7152, 0.0722 ) ),
              lumaRatio = lowLuma / keyLuma;
            wallSkinShare *= ( 1.0 - smoothstep( 0.12, 0.3, length( low / max( lowLuma, 1e-4 ) - cityWallKey / keyLuma ) ) )
              * smoothstep( 0.45, 0.65, lumaRatio ) * ( 1.0 - smoothstep( 1.6, 2.2, lumaRatio ) );
            vec3 skin = texture( cityWallAlbedo, wallSkinUv ).rgb / cityWallMean.rgb;
            sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, low * min( skin, vec3( 3.0 ) ) + ( sampledDiffuseColor.rgb - low ) * cityWallMean.w, wallSkinShare );
          }
          diffuseColor *= sampledDiffuseColor;
        #endif`;
      // After normal_fragment_maps: the skin's relief and roughness (MEDIUM and up).
      const WALL_SKIN_NORMAL = `
        if ( wallSkinShare > 0.0 && cityGroundDetail > 0.5 ) {
          vec3 skinDetail = texture( cityWallDetail, wallSkinUv ).rgb;
          vec2 skinSlope = ( skinDetail.rg * 2.0 - 1.0 ) * wallSkinShare;
          vec3 skinT = normalize( ( viewMatrix * vec4( wallSkinTangent, 0.0 ) ).xyz ),
            skinB = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
          normal = normalize( normal + skinT * skinSlope.x + skinB * skinSlope.y );
          roughnessFactor = mix( roughnessFactor, roughnessFactor * ( 0.55 + 0.6 * skinDetail.b ), wallSkinShare );
        }`;
      // Called from cityFacadePatch with the material's layer (-1: no skin). The text is the same for every facade.
      function wallSkinPatch(shader, layer, key) {
        Object.assign(shader.uniforms, wallSkin.uniforms);
        const tile = WALL_SKIN_LAYERS[layer]?.tile || [1, 1];
        shader.uniforms.cityWallLayer = { value: wallSkin.ready && layer >= 0 && layer < WALL_SKIN_LAYERS.length ? layer : -1 };
        shader.uniforms.cityWallTile = { value: new Three.Vector2(tile[0], tile[1]) };
        const mean = wallSkin.means[layer];
        shader.uniforms.cityWallMean = { value: mean ? new Three.Vector4(mean.x, mean.y, mean.z, WALL_SKIN_LAYERS[layer].keep) : new Three.Vector4(0.5, 0.5, 0.5, 1) };
        shader.uniforms.cityWallKey = { value: key || new Three.Vector3(0.5, 0.5, 0.5) };
        shader.uniforms.cityGroundDetail = groundShared.cityGroundDetail;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + WALL_SKIN_PARS)
          .replace('#include <map_fragment>', WALL_SKIN_MAP)
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + WALL_SKIN_NORMAL);
      }
      /* The plain wall's colour in an atlas quadrant (linear): the mean of its pixels, twice narrowed to those near it
         in hue and brightness (windows, sills and frames drop out). The skin draws only where the atlas is this. */
      const wallSkinKeys = new Map();
      function wallSkinKey(quadrant) {
        if (wallSkinKeys.has(quadrant)) return wallSkinKeys.get(quadrant);
        const key = new Three.Vector3(0.5, 0.5, 0.5),
          canvas = wallTextures[quadrant]?.image;
        if (canvas && canvas.getContext) {
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
            lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)),
            luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
          for (let pass = 0; pass < 3; pass++) {
            const kl = luma(key.x, key.y, key.z);
            let r = 0,
              g = 0,
              b = 0,
              n = 0;
            for (let i = 0; i < data.length; i += 16 * 3) {
              const pr = lin(data[i]),
                pg = lin(data[i + 1]),
                pb = lin(data[i + 2]),
                pl = luma(pr, pg, pb) || 1e-4;
              if (pass > 0) {
                const ratio = pl / kl,
                  dc = Math.hypot(pr / pl - key.x / kl, pg / pl - key.y / kl, pb / pl - key.z / kl);
                if (ratio < 0.5 || ratio > 2 || dc > 0.3) continue;
              }
              r += pr;
              g += pg;
              b += pb;
              n++;
            }
            if (n) key.set(r / n, g / n, b / n);
          }
        }
        wallSkinKeys.set(quadrant, key);
        return key;
      }
      // Console wallSkin(): the layers, whether the sheet loaded, the switch and how many facades take each layer.
      function wallSkinReport() {
        const use = WALL_SKIN_LAYERS.map(() => 0);
        for (const m of facadeMaterials.values()) if (m.userData.wallSkin >= 0) use[m.userData.wallSkin]++;
        return {
          ready: wallSkin.ready,
          on: wallSkinSwitch.value > 0,
          size: wallSkin.uniforms.cityWallAlbedo.value.image.width,
          layers: WALL_SKIN_LAYERS.map((l, i) => ({
            name: l.name,
            source: 'ambientCG ' + l.id,
            tileMetres: l.tile.map((v) => +(v / UNITS_PER_METRE).toFixed(2)),
            mean: wallSkin.means[i].toArray().map((v) => +v.toFixed(3)),
            atlasKey: WALL_SKIN_FOR_QUADRANT.indexOf(i) >= 0 ? wallSkinKey(WALL_SKIN_FOR_QUADRANT.indexOf(i)).toArray().map((v) => +v.toFixed(3)) : null,
            facadeMaterials: use[i],
          })),
          normals: groundShared.cityGroundDetail.value > 0,
        };
      }
