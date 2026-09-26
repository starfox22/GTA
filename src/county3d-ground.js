      // County 3D ground: regional terrain materials and patches (terrainMaterials, TERRAIN_* maps) and scenery cells.
      // Regional ground is tiled separately so the original city's ground detail stays sharp.
      // Their materials get the same procedural ground detail as the city sheet
      // (surfaces3d.js), or the county is a flat, textureless pastel.
      const countyGroundMaterials = [],
        countyTileTextures = [];
      for (const tile of countyGroundTiles) {
        const tx = new Three.CanvasTexture(tile.canvas);
        countyTileTextures.push({ tile, texture: tx });
        tx.colorSpace = Three.SRGBColorSpace;
        tx.anisotropy = 8;
        const m = new Three.Mesh(
          new Three.PlaneGeometry(tile.w, tile.h),
          new Three.MeshStandardMaterial({
            map: tx,
            // The county sheets are painted in paler greens than the city sheet;
            // toned down so the land matches across the bridges.
            color: '#e2e4de',
            roughness: 0.94,
            alphaTest: 0.5,
          }),
        );
        countyGroundMaterials.push(m.material);
        m.rotation.x = -Math.PI / 2;
        m.position.set(tile.x + tile.w / 2, 0.025, tile.y + tile.h / 2);
        m.receiveShadow = true;
        scene.add(m);
      }
      const countyStone = staticMat('#778078', 0.96),
        countyRock = staticMat('#6b7468', 0.97),
        countyRail = staticMat('#a5b2b0', 0.64, 0.4),
        countyCream = staticMat('#d6cbb3', 0.86);
      /**
       * RIDGELINE RANGE TERRAIN
       * Each terrain field (terrain.js) is cut into chunks of TERRAIN_CHUNK cells,
       * one mesh each, so the view culls them. Positions are the field's exact
       * Float32 heights (the collision surface), normals come from the whole field
       * so chunk seams do not show, and a packed per-vertex attribute carries the
       * baked ambient occlusion, water flow, trail mask and forest density.
       *
       * Level of detail: a far chunk switches to a second index buffer at half the
       * resolution (2 x 2 cells per quad where the whole block is land), with a
       * skirt hanging below its edges to hide the cracks against a finer
       * neighbour. Near chunks always draw the exact surface.
       *
       * One material, patched: slope- and height-driven layers (forest floor,
       * meadow, tawny alpine grass, dirt in the gullies, scree, rock with warped
       * strata and triplanar grain, snow above a ragged snowline that lingers in
       * the gullies and blows off the ridges), streams in the ravine beds, baked
       * ambient occlusion on the ambient light, a procedural bump that is strong
       * on rock and faint on snow, and a glint on the snow facing the sun.
       */
      const TERRAIN_CHUNK = 64,
        TERRAIN_LOD_DISTANCE = 2600,
        terrainChunks = [],
        terrainUniforms = {
          terrainTime: { value: 0 },
          terrainSun: { value: sunDirection },
          terrainSunPower: { value: 1 },
          terrainSnowLine: { value: TERRAIN_SNOWLINE },
          terrainTreeLine: { value: TERRAIN_TREELINE },
        };
      const TERRAIN_NOISE = `
        float terrainHash( vec2 p ) {
          vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
          p3 += dot( p3, p3.yzx + 33.33 );
          return fract( ( p3.x + p3.y ) * p3.z );
        }
        float terrainNoise( vec2 p ) {
          vec2 i = floor( p ), f = fract( p );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( terrainHash( i ), terrainHash( i + vec2( 1.0, 0.0 ) ), f.x ),
                      mix( terrainHash( i + vec2( 0.0, 1.0 ) ), terrainHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
        }
        float terrainFbm( vec2 p ) {
          float sum = 0.0, amp = 0.5;
          for ( int i = 0; i < 4; i++ ) {
            sum += terrainNoise( p ) * amp;
            p = mat2( 1.6, -1.2, 1.2, 1.6 ) * p + 7.3;
            amp *= 0.5;
          }
          return sum;
        }
        vec3 terrainSrgb( vec3 c ) { return c * c * ( c * 0.3 + 0.7 ); }`;
      const TERRAIN_ALBEDO = `
        vec3 tP = vCityWorld;
        vec3 tN = normalize( vTerrainNormal );
        float tAo = vTerrainData.x, tFlow = vTerrainData.y, tTrail = vTerrainData.z, tForest = vTerrainData.w;
        float tSteep = 1.0 - tN.y;
        float tFoot = 0.0;
        float tFade = 1.0 - smoothstep( 0.9, 5.0, length( fwidth( tP.xz ) ) );
        float tMacro = terrainFbm( tP.xz * 0.0011 );
        float tMid = terrainFbm( tP.xz * 0.009 + 3.1 );
        float tFine = mix( 0.5, terrainNoise( tP.xz * 0.23 ), tFade );
        // Triplanar grain for the rock: faces are textured along whichever axis they face.
        vec3 tW = pow( abs( tN ), vec3( 4.0 ) );
        tW /= tW.x + tW.y + tW.z;
        float tGrain = terrainNoise( tP.zy * vec2( 0.07, 0.16 ) ) * tW.x + terrainNoise( tP.xz * 0.09 ) * tW.y + terrainNoise( tP.xy * vec2( 0.07, 0.16 ) ) * tW.z;
        float tGrainFine = mix( 0.5, terrainNoise( tP.zy * 0.6 ) * tW.x + terrainNoise( tP.xz * 0.6 ) * tW.y + terrainNoise( tP.xy * 0.6 ) * tW.z, tFade );
        // Rock strata: bands in height, warped, each band its own shade, a dark ledge at its foot.
        float tStrataY = tP.y + ( terrainNoise( tP.xz * 0.004 ) - 0.5 ) * 60.0 + tMid * 14.0;
        float tBand = tStrataY / 17.0;
        float tBandId = floor( tBand ), tBandF = fract( tBand );
        // Weathered granite: cool grey, warmer where iron stains it, darker in the
        // wet runnels and the shadowed folds; bands differ only slightly.
        vec3 tRock = mix( terrainSrgb( vec3( 0.44, 0.43, 0.41 ) ), terrainSrgb( vec3( 0.58, 0.55, 0.5 ) ), tMid * 0.75 + terrainHash( vec2( tBandId, 3.7 ) ) * 0.25 );
        tRock = mix( tRock, terrainSrgb( vec3( 0.6, 0.5, 0.4 ) ), smoothstep( 0.55, 0.8, terrainNoise( tP.xz * 0.004 + tP.y * 0.003 ) ) * 0.45 );
        tRock *= mix( 0.62, 1.0, smoothstep( 0.2, 0.55, 1.0 - tFlow ) ) * mix( 0.8, 1.0, smoothstep( 0.4, 0.85, tAo ) );
        float tCrack = ( 1.0 - smoothstep( 0.0, 0.05, abs( terrainNoise( tP.xz * vec2( 0.05, 0.03 ) + tP.y * 0.02 ) - 0.5 ) ) ) * tFade;
        tRock *= 1.0 - 0.35 * tCrack;
        tRock *= ( 0.76 + 0.32 * tGrain ) * ( 0.88 + 0.24 * tGrainFine ) * ( 1.0 - 0.1 * smoothstep( 0.86, 1.0, tBandF ) * smoothstep( 0.35, 0.6, tSteep ) );
        tRock *= mix( vec3( 1.0 ), vec3( 0.92, 0.98, 0.9 ), smoothstep( 0.45, 0.7, tMacro ) );
        // Low cliffs keep a skin of moss and scrub; bare rock takes over with height.
        float tRockW = smoothstep( 0.27, 0.42, tSteep + ( tMid - 0.5 ) * 0.16 - ( 1.0 - smoothstep( 90.0, 330.0, tP.y ) ) * 0.1 );
        tRock = mix( tRock, terrainSrgb( vec3( 0.3, 0.36, 0.22 ) ) * ( 0.8 + 0.4 * tGrain ), ( 1.0 - smoothstep( 60.0, 300.0, tP.y + ( tMid - 0.5 ) * 120.0 ) ) * 0.55 );
        // Scree: loose, pale stone on the mid slopes below the cliffs.
        float tScreeW = smoothstep( 0.15, 0.27, tSteep + ( tFine - 0.5 ) * 0.06 ) * ( 1.0 - tRockW ) * smoothstep( 200.0, 330.0, tP.y + ( tMacro - 0.5 ) * 160.0 );
        vec3 tScree = terrainSrgb( vec3( 0.55, 0.53, 0.5 ) ) * ( 0.78 + 0.44 * terrainNoise( tP.xz * 0.7 ) * tFade + 0.22 * ( 1.0 - tFade ) );
        // Vegetation: forest floor under the trees, meadow, tawny alpine turf above the treeline.
        float tAlpine = smoothstep( terrainTreeLine - 70.0, terrainTreeLine + 70.0, tP.y + ( tMacro - 0.5 ) * 140.0 );
        vec3 tMeadow = mix( terrainSrgb( vec3( 0.33, 0.43, 0.2 ) ), terrainSrgb( vec3( 0.47, 0.47, 0.24 ) ), smoothstep( 0.4, 0.68, tMacro + ( tMid - 0.5 ) * 0.3 ) );
        vec3 tTurf = mix( terrainSrgb( vec3( 0.5, 0.48, 0.3 ) ), terrainSrgb( vec3( 0.4, 0.43, 0.26 ) ), tMid );
        vec3 tFloor = terrainSrgb( vec3( 0.22, 0.24, 0.14 ) ) * ( 0.8 + 0.4 * tMid );
        vec3 tVeg = mix( mix( tMeadow, tTurf, tAlpine ), tFloor, tForest );
        tVeg *= 0.84 + 0.32 * mix( 0.5, terrainNoise( mat2( 0.8, -0.6, 0.6, 0.8 ) * tP.xz * 0.35 ), tFade );
        // Dirt: worn gullies and bare, eroding banks.
        float tDirtW = smoothstep( 0.45, 0.75, tFlow ) * 0.55 + smoothstep( 0.12, 0.2, tSteep ) * ( 1.0 - tRockW ) * 0.35 * tMid;
        vec3 tDirt = terrainSrgb( vec3( 0.4, 0.33, 0.25 ) ) * ( 0.85 + 0.3 * tFine );
        vec3 tCol = mix( tVeg, tDirt, tDirtW );
        tCol = mix( tCol, tScree, tScreeW );
        tCol = mix( tCol, tRock, tRockW );
        // Snow: a ragged line, lower in the gullies, stripped off cliffs and blown off
        // the exposed crests in patches; solid cover on the summits.
        float tSnowLine = terrainSnowLine + ( tMacro - 0.5 ) * 150.0 + ( tMid - 0.5 ) * 60.0 - tFlow * 90.0 + ( tAo - 0.7 ) * 120.0;
        float tSnow = smoothstep( tSnowLine - 20.0, tSnowLine + 60.0, tP.y );
        float tWind = smoothstep( 0.3, 0.62, terrainFbm( tP.xz * 0.013 + vec2( tMacro * 3.0, 0.0 ) ) );
        tSnow *= mix( 1.0, tWind, smoothstep( tSnowLine + 180.0, tSnowLine, tP.y ) );
        tSnow *= 1.0 - smoothstep( 0.3, 0.5, tSteep - tFlow * 0.1 );
        tSnow = clamp( tSnow, 0.0, 1.0 );
        vec3 tSnowCol = terrainSrgb( vec3( 0.93, 0.95, 0.98 ) ) * ( 0.94 + 0.06 * tFine ) * mix( vec3( 0.86, 0.9, 1.0 ), vec3( 1.0 ), tAo );
        tCol = mix( tCol, tSnowCol, tSnow );
        // Streams in the ravine beds; white water where they fall steeply.
        // (The streams themselves are ribbons; the bed here is only wet and dark.)
        float tWater = smoothstep( 0.8, 0.9, tFlow ) * ( 1.0 - tSnow ) * ( 1.0 - tTrail ) * 0.45 * smoothstep( 3.0, 12.0, tP.y );
        float tFoam = smoothstep( 0.3, 0.6, tSteep ) * ( 0.6 + 0.4 * terrainNoise( vec2( tP.x * 0.2, tP.y * 0.12 + terrainTime * 4.0 ) ) );
        tCol = mix( tCol, mix( terrainSrgb( vec3( 0.17, 0.25, 0.27 ) ), terrainSrgb( vec3( 0.85, 0.9, 0.92 ) ), tFoam ), tWater );
        // The trail: packed gravel with darker wheel ruts along the middle.
        vec3 tGravel = terrainSrgb( vec3( 0.62, 0.55, 0.43 ) ) * ( 0.84 + 0.3 * mix( 0.5, terrainNoise( tP.xz * 0.6 ), tFade ) );
        tCol = mix( tCol, tGravel, smoothstep( 0.2, 0.8, tTrail ) * ( 1.0 - tSnow * 0.6 ) );
        // Trail mud (offroad.js bakes it per vertex): dark, wet dirt, deepest in the
        // two wheel ruts, puddles lying in them, wetter after rain; rock ledges
        // where the rock steps are.
        float tMud = vTerrainMud.x, tAcross = vTerrainMud.y * 3.0, tRockStep = vTerrainMud.z;
        float tMudW = 0.0, tPuddle = 0.0, tRut = 0.0;
        if ( tMud + tRockStep > 0.004 ) {
          float mudWetness = clamp( 0.5 + 0.5 * cityWet, 0.0, 1.0 );
          tRut = exp( -pow( ( tAcross - 0.36 ) / 0.1, 2.0 ) ) * smoothstep( 0.05, 0.3, tMud );
          float mn = terrainNoise( tP.xz * 0.31 ), mn2 = mix( 0.5, terrainNoise( tP.xz * 1.9 + 4.0 ), tFade );
          vec3 mudDry = terrainSrgb( vec3( 0.47, 0.38, 0.28 ) ), mudWetCol = terrainSrgb( vec3( 0.29, 0.22, 0.15 ) );
          vec3 mudCol = mix( mudDry, mudWetCol, mudWetness * ( 0.45 + 0.55 * tMud ) ) * ( 0.82 + 0.3 * mn2 ) * ( 1.0 - 0.22 * tRut );
          // Tyre-churned streaks along the ruts.
          mudCol *= 1.0 - 0.12 * tRut * mix( 0.5, terrainNoise( tP.xz * vec2( 2.3, 0.35 ) ), tFade );
          // Puddles: a few, lying in the ruts and the low spots of the deepest mud,
          // more of them after rain; brown water that mirrors the sky.
          float puddleField = terrainNoise( tP.xz * 0.11 + 11.0 ) * 0.75 + mn * 0.25 + tRut * 0.22;
          tPuddle = smoothstep( 0.74, 0.8, puddleField + tMud * 0.06 + cityWet * 0.06 ) * smoothstep( 0.4, 0.75, tMud ) * ( 0.35 + 0.65 * mudWetness );
          mudCol = mix( mudCol, terrainSrgb( vec3( 0.26, 0.22, 0.17 ) ), tPuddle * 0.8 );
          tMudW = smoothstep( 0.03, 0.3, tMud ) * ( 1.0 - tSnow );
          tCol = mix( tCol, mudCol, tMudW );
          // Rock steps: pale grey ledges across the trail.
          vec3 slab = mix( tRock, terrainSrgb( vec3( 0.52, 0.5, 0.46 ) ), 0.5 ) * ( 0.8 + 0.3 * mn2 );
          tCol = mix( tCol, slab, smoothstep( 0.3, 0.8, tRockStep ) * 0.85 );
          tMudW *= mudWetness;
        }
        // Ambient occlusion also darkens the albedo a little in the deepest folds.
        tCol *= mix( 0.72, 1.0, smoothstep( 0.35, 0.95, tAo ) );
        // At the foot the colour meets the painted county ground it rises from.
        // At the foot the colour becomes the county sheet it rises from, with the
        // same grass detail the sheet's own shader adds (surfaces3d.js) and the
        // shading of flat ground, so the mesh's outline on the 10-unit grid never shows.
        {
          vec2 gp = tP.xz;
          // (The sheet is a canvas texture, flipped: its top row is the tile's north edge.)
          vec2 tileUv = ( gp - terrainTileRect.xy ) / terrainTileRect.zw;
          vec3 groundBase = texture2D( terrainTile, vec2( tileUv.x, 1.0 - tileUv.y ) ).rgb * terrainTileTint;
          vec2 gr = mat2( 0.8, -0.6, 0.6, 0.8 ) * gp;
          float dry = smoothstep( 0.52, 0.8, cityNoise( gp * 0.035 + 5.0 ) * 0.6 + cityNoise( gr * 0.083 + 2.0 ) * 0.4 );
          float meadow = cityNoise( gp * 0.0045 + 3.7 ) * 0.62 + cityNoise( gr * 0.014 + 11.0 ) * 0.38;
          dry = max( dry, smoothstep( 0.62, 0.9, meadow ) * 0.7 );
          float blades = cityNoise( gr * 0.35 ) * 0.55 + cityNoise( gp * 0.93 + 7.0 ) * 0.45;
          float groundFade = 1.0 - smoothstep( 0.6, 2.5, length( fwidth( gp ) ) );
          vec3 grass = groundBase * mix( 1.0, 0.84 + 0.32 * blades, groundFade ) * ( 0.84 + 0.3 * meadow ) * mix( vec3( 1.0 ), vec3( 1.14, 1.06, 0.8 ), dry );
          grass = max( mix( vec3( dot( grass, vec3( 0.2126, 0.7152, 0.0722 ) ) ), grass, 1.15 ) * vec3( 0.84, 0.9, 0.84 ), 0.0 );
          // Only green paint is grass to the sheet's shader; kerbs and verges stay as painted.
          grass = mix( groundBase, grass, smoothstep( 0.004, 0.03, groundBase.g - max( groundBase.r, groundBase.b ) ) );
          tFoot = 1.0 - smoothstep( 0.3, 16.0, tP.y + tTrail * 16.0 );
          tCol = mix( tCol, grass, tFoot );
        }
        tCol *= 1.0 - 0.3 * cityWet;
        diffuseColor.rgb = tCol;`;
      const TERRAIN_ROUGHNESS = `
        roughnessFactor = mix( mix( 0.95, 0.86, tRockW ), 0.6, tSnow );
        roughnessFactor = mix( roughnessFactor, 0.1, tWater * ( 1.0 - tFoam ) );
        roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.55, cityWet );
        roughnessFactor = mix( roughnessFactor, 0.42, tMudW * 0.7 );
        roughnessFactor = mix( roughnessFactor, 0.08, tPuddle );`;
      const TERRAIN_NORMAL = `
        {
          // Bump from a height made of the rock grain, the strata ledges and the turf.
          float bumpHeight = ( tGrain * 2.2 + tGrainFine * 0.8 + smoothstep( 0.8, 1.0, tBandF ) * 1.4 ) * tRockW
            + terrainNoise( tP.xz * 0.5 ) * 0.5 * ( 1.0 - tRockW ) + tScreeW * terrainNoise( tP.xz * 1.3 ) * 0.6;
          // Ruts pressed into the mud, a churned surface, flat water in the puddles.
          bumpHeight += ( -tRut * 1.4 + terrainNoise( tP.xz * 0.9 ) * 0.5 ) * tMudW;
          bumpHeight *= ( 1.0 - tSnow * 0.85 ) * tFade * ( 1.0 - tWater ) * ( 1.0 - tPuddle );
          vec3 sigmaX = dFdx( -vViewPosition ), sigmaY = dFdy( -vViewPosition );
          vec3 r1 = cross( sigmaY, normal ), r2 = cross( normal, sigmaX );
          float det = dot( sigmaX, r1 );
          vec2 dh = vec2( dFdx( bumpHeight ), dFdy( bumpHeight ) );
          vec3 grad = sign( det ) * ( dh.x * r1 + dh.y * r2 );
          normal = normalize( abs( det ) * normal - grad );
          // The foot is lit like the flat sheet beside it.
          normal = normalize( mix( normal, ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz, tFoot ) );
        }`;
      const TERRAIN_AO = `
        {
          float terrainOcclusion = mix( mix( 0.35, 1.0, smoothstep( 0.3, 0.95, tAo ) ), 1.0, tFoot );
          reflectedLight.indirectDiffuse *= terrainOcclusion;
          reflectedLight.indirectSpecular *= terrainOcclusion;
        }`;
      const TERRAIN_SPARKLE = `
        {
          // Snow glints: sparse facets that catch the sun towards the camera.
          vec3 viewDir = normalize( cameraPosition - tP );
          vec3 facet = normalize( tN + ( vec3( terrainHash( floor( tP.xz * 1.3 ) ), 0.0, terrainHash( floor( tP.xz * 1.3 ) + 5.0 ) ) - 0.5 ) * 0.9 );
          float glint = pow( max( dot( reflect( -terrainSun, facet ), viewDir ), 0.0 ), 40.0 );
          float sparse = step( 0.9, terrainHash( floor( tP.xz * 1.3 ) + 17.0 ) );
          totalEmissiveRadiance += vec3( 1.0, 0.97, 0.9 ) * tSnow * sparse * glint * terrainSunPower * 1.6 * tFade;
        }`;
      function terrainPatch(shader) {
        cityMaterialPatch(shader);
        Object.assign(shader.uniforms, terrainUniforms);
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute vec4 terrainData;\nattribute vec4 terrainMud;\nvarying vec4 vTerrainData;\nvarying vec4 vTerrainMud;\nvarying vec3 vTerrainNormal;',
          )
          .replace(
            '#include <beginnormal_vertex>',
            '#include <beginnormal_vertex>\nvTerrainNormal = normalize( mat3( modelMatrix ) * objectNormal );\nvTerrainData = terrainData;\nvTerrainMud = terrainMud;',
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec4 vTerrainData;\nvarying vec4 vTerrainMud;\nvarying vec3 vTerrainNormal;\nuniform sampler2D terrainTile;\nuniform vec4 terrainTileRect;\nuniform vec3 terrainTileTint;\nuniform float terrainTime;\nuniform vec3 terrainSun;\nuniform float terrainSunPower;\nuniform float terrainSnowLine;\nuniform float terrainTreeLine;\n' +
              TERRAIN_NOISE +
              SURFACE_NOISE,
          )
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + TERRAIN_ALBEDO)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + TERRAIN_ROUGHNESS)
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + TERRAIN_NORMAL)
          .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + TERRAIN_AO)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + TERRAIN_SPARKLE);
      }
      // One material per county sheet a field stands on (they differ only in the
      // sheet their foot blends into). The patch reads SURFACE_NOISE (surfaces3d.js)
      // when the program is first compiled, long after that file has run.
      const terrainMaterials = new Map();
      function terrainMaterialAt(x, y) {
        const found = countyTileTextures.find(({ tile }) => x >= tile.x && x < tile.x + tile.w && y >= tile.y && y < tile.y + tile.h);
        if (terrainMaterials.has(found)) return terrainMaterials.get(found);
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }),
          uniforms = {
            terrainTile: { value: found.texture },
            terrainTileRect: { value: new Three.Vector4(found.tile.x, found.tile.y, found.tile.w, found.tile.h) },
            terrainTileTint: { value: new Three.Color('#e2e4de') },
          };
        material.onBeforeCompile = (shader) => {
          terrainPatch(shader);
          Object.assign(shader.uniforms, uniforms);
        };
        material.customProgramCacheKey = () => 'ridgeline-terrain';
        terrainMaterials.set(found, material);
        return material;
      }
      for (const field of TERRAIN_FIELDS) {
        const terrainMaterial = terrainMaterialAt((field.x0 + field.x1) / 2, (field.y0 + field.y1) / 2);
        const { cols, rows, nx, ny, heights, triangles, flow, trailMask, x0, y0, mudField, rockField, trailAcross } = terrainField(field),
          { normals, ao, forest } = terrainBakes(field);
        for (let cz = 0; cz < ny; cz += TERRAIN_CHUNK)
          for (let cx = 0; cx < nx; cx += TERRAIN_CHUNK) {
            const c1 = Math.min(nx, cx + TERRAIN_CHUNK),
              r1 = Math.min(ny, cz + TERRAIN_CHUNK),
              w = c1 - cx + 1,
              h = r1 - cz + 1,
              // Grid vertices, then a skirt vertex under each border vertex.
              border = 2 * (w + h) - 4,
              positions = new Float32Array((w * h + border) * 3),
              normalData = new Float32Array((w * h + border) * 3),
              data = new Uint8Array((w * h + border) * 4),
              // Mud, distance across the trail (/3), rock steps (offroad.js).
              mudData = new Uint8Array((w * h + border) * 4),
              local = (c, r) => (r - cz) * w + (c - cx);
            let any = false,
              top = 0;
            for (let r = cz; r <= r1; r++)
              for (let c = cx; c <= c1; c++) {
                const i = r * cols + c,
                  v = local(c, r);
                positions[v * 3] = c * TERRAIN_CELL;
                positions[v * 3 + 1] = heights[i];
                positions[v * 3 + 2] = r * TERRAIN_CELL;
                normalData.set(normals.subarray(i * 3, i * 3 + 3), v * 3);
                data[v * 4] = Math.round(ao[i] * 255);
                data[v * 4 + 1] = Math.round(flow[i] * 255);
                data[v * 4 + 2] = Math.round(trailMask[i] * 255);
                data[v * 4 + 3] = Math.round(forest[i] * 255);
                mudData[v * 4] = Math.round(mudField[i] * 255);
                mudData[v * 4 + 1] = Math.round(clamp(trailAcross[i] / 3, 0, 1) * 255);
                mudData[v * 4 + 2] = Math.round(rockField[i] * 255);
                top = Math.max(top, heights[i]);
              }
            const full = [];
            for (let r = cz; r < r1; r++)
              for (let c = cx; c < c1; c++) {
                const t = (r * nx + c) * 2,
                  a = local(c, r),
                  b = local(c, r + 1),
                  d = local(c + 1, r);
                if (triangles[t]) full.push(a, b, d);
                if (triangles[t + 1]) full.push(b, local(c + 1, r + 1), d);
              }
            if (!full.length) continue;
            any = true;
            // Half resolution: a 2 x 2 block becomes one quad where all 8 triangles
            // exist, and keeps its own triangles otherwise (coasts, road edges).
            const coarse = [];
            for (let r = cz; r < r1; r += 2)
              for (let c = cx; c < c1; c += 2) {
                const cells = [];
                for (let dr = 0; dr < 2; dr++)
                  for (let dc = 0; dc < 2; dc++)
                    if (r + dr < r1 && c + dc < c1) cells.push([c + dc, r + dr]);
                const whole = cells.length === 4 && cells.every(([c2, r2]) => triangles[(r2 * nx + c2) * 2] && triangles[(r2 * nx + c2) * 2 + 1]);
                if (whole) coarse.push(local(c, r), local(c, r + 2), local(c + 2, r), local(c, r + 2), local(c + 2, r + 2), local(c + 2, r));
                else
                  for (const [c2, r2] of cells) {
                    const t = (r2 * nx + c2) * 2;
                    if (triangles[t]) coarse.push(local(c2, r2), local(c2, r2 + 1), local(c2 + 1, r2));
                    if (triangles[t + 1]) coarse.push(local(c2, r2 + 1), local(c2 + 1, r2 + 1), local(c2 + 1, r2));
                  }
              }
            // Skirt: a strip 30 units deep round the chunk, only under terrain above street level.
            const ring = [];
            for (let c = cx; c < c1; c++) ring.push([c, cz]);
            for (let r = cz; r < r1; r++) ring.push([c1, r]);
            for (let c = c1; c > cx; c--) ring.push([c, r1]);
            for (let r = r1; r > cz; r--) ring.push([cx, r]);
            ring.forEach(([c, r], k) => {
              const v = w * h + k,
                src = local(c, r);
              positions[v * 3] = positions[src * 3];
              positions[v * 3 + 1] = positions[src * 3 + 1] - 30;
              positions[v * 3 + 2] = positions[src * 3 + 2];
              normalData.set(normalData.subarray(src * 3, src * 3 + 3), v * 3);
              data.set(data.subarray(src * 4, src * 4 + 4), v * 4);
              mudData.set(mudData.subarray(src * 4, src * 4 + 4), v * 4);
            });
            ring.forEach(([c, r], k) => {
              const [c2, r2] = ring[(k + 1) % ring.length],
                a = local(c, r),
                b = local(c2, r2);
              if (heights[r * cols + c] < 1 && heights[r2 * cols + c2] < 1) return;
              const sa = w * h + k,
                sb = w * h + ((k + 1) % ring.length);
              // Both windings: the skirt is seen from either side of the chunk edge.
              coarse.push(a, sa, b, b, sa, sb, a, b, sa, b, sb, sa);
            });
            if (!any) continue;
            const geo = new Three.BufferGeometry();
            geo.setAttribute('position', new Three.BufferAttribute(positions, 3));
            geo.setAttribute('normal', new Three.BufferAttribute(normalData, 3));
            geo.setAttribute('terrainData', new Three.BufferAttribute(data, 4, true));
            geo.setAttribute('terrainMud', new Three.BufferAttribute(mudData, 4, true));
            const fullIndex = new Three.BufferAttribute(new Uint32Array(full), 1),
              coarseIndex = new Three.BufferAttribute(new Uint32Array(coarse), 1);
            geo.setIndex(fullIndex);
            geo.computeBoundingSphere();
            const chunk = new Three.Mesh(geo, terrainMaterial);
            chunk.name = field.name + ' terrain';
            chunk.userData.sharedTerrain = true;
            chunk.position.set(x0, 0, y0);
            chunk.receiveShadow = chunk.castShadow = true;
            scene.add(chunk);
            const centre = {
              x: x0 + ((cx + c1) / 2) * TERRAIN_CELL,
              y: y0 + ((cz + r1) / 2) * TERRAIN_CELL,
              z: top / 2,
            };
            terrainChunks.push({ mesh: chunk, fullIndex, coarseIndex, centre, coarse: false });
            statics.push({
              x: centre.x,
              y: centre.y,
              group: chunk,
              radius: (TERRAIN_CHUNK * TERRAIN_CELL) / 2 + 400,
            });
          }
      }
      /**
       * FORESTS AND BOULDERS
       * mountainScenery() (terrain.js) places them; here each kind is an
       * InstancedMesh per 2048-unit cell, in two levels of detail. The trees are
       * species of the tree library (vegetation3d.js): the conifers by altitude,
       * pines low down, fir through the middle and spruce up to the treeline,
       * and beech, birch and maple below them. Near cells draw the modelled tree
       * of each species (one mesh per species) and cast shadows; far cells one
       * low cone for every conifer and one blob for every broadleaf, tinted per
       * tree to its species, that do not.
       */
      const SCENERY_CELL = 2048,
        SCENERY_NEAR = 2300,
        sceneryCells = [];
      function mergedColoredGeometry(parts) {
        const merged = [];
        for (const [geometry, color, shade = 0] of parts) {
          const g = geometry.index ? geometry.toNonIndexed() : geometry;
          const count = g.attributes.position.count,
            colors = new Float32Array(count * 3),
            tint = new Three.Color(color),
            box = new Three.Box3().setFromBufferAttribute(g.attributes.position);
          for (let i = 0; i < count; i++) {
            // Darker towards the underside of each part: cheap self-shadowing.
            const t = (g.attributes.position.getY(i) - box.min.y) / Math.max(1e-3, box.max.y - box.min.y),
              k = 1 - shade * (1 - t);
            colors[i * 3] = tint.r * k;
            colors[i * 3 + 1] = tint.g * k;
            colors[i * 3 + 2] = tint.b * k;
          }
          g.setAttribute('color', new Three.BufferAttribute(colors, 3));
          g.deleteAttribute('uv');
          merged.push(g);
        }
        let vertices = 0;
        for (const g of merged) vertices += g.attributes.position.count;
        const position = new Float32Array(vertices * 3),
          normal = new Float32Array(vertices * 3),
          color = new Float32Array(vertices * 3);
        let o = 0;
        for (const g of merged) {
          position.set(g.attributes.position.array, o * 3);
          normal.set(g.attributes.normal.array, o * 3);
          color.set(g.attributes.color.array, o * 3);
          o += g.attributes.position.count;
        }
        const out = new Three.BufferGeometry();
        out.setAttribute('position', new Three.BufferAttribute(position, 3));
        out.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        out.setAttribute('color', new Three.BufferAttribute(color, 3));
        return out;
      }
      const boulderGeometry = (() => {
        const g = new Three.IcosahedronGeometry(1, 1),
          p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i),
            y = p.getY(i),
            z = p.getZ(i),
            k = 0.78 + terrainHash(Math.round(x * 50), Math.round(y * 50 + z * 17), 5) * 0.4;
          p.setXYZ(i, x * k, y * k * 0.62, z * k);
        }
        g.computeVertexNormals();
        return mergedColoredGeometry([[g, '#8b8880', 0.35]]);
      })(),
        boulderMaterial = new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 });
      function plantScenery(list, nearGeo, farGeo, material, kind, scaleY = 1, sink = 0) {
        const cells = new Map();
        for (let k = 0; k < list.length; k += 6) {
          const key = Math.floor(list[k] / SCENERY_CELL) * 4096 + Math.floor(list[k + 1] / SCENERY_CELL);
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(k);
        }
        const m = new Three.Matrix4(),
          q = new Three.Quaternion(),
          s = new Three.Vector3(),
          p = new Three.Vector3(),
          up = new Three.Vector3(0, 1, 0),
          tint = new Three.Color();
        for (const entries of cells.values()) {
          const meshes = [nearGeo, farGeo].map((geo, lod) => {
            const mesh = new Three.InstancedMesh(geo, material, entries.length);
            mesh.name = 'Ridgeline ' + kind + (lod ? ' far' : '');
            mesh.castShadow = !lod;
            mesh.receiveShadow = true;
            mesh.instanceColor = new Three.InstancedBufferAttribute(new Float32Array(entries.length * 3), 3);
            return mesh;
          });
          let cx = 0,
            cy = 0;
          entries.forEach((k, j) => {
            const size = list[k + 3],
              variant = list[k + 4];
            q.setFromAxisAngle(up, list[k + 5]);
            s.set(size * (0.9 + variant * 0.2), size * scaleY * (0.85 + variant * 0.35), size * (0.9 + (1 - variant) * 0.2));
            p.set(list[k], list[k + 2] - sink * size, list[k + 1]);
            m.compose(p, q, s);
            tint.setHSL(0.02 * (variant - 0.5), 0.1, 0.8 + variant * 0.35);
            for (const mesh of meshes) {
              mesh.setMatrixAt(j, m);
              mesh.setColorAt(j, tint);
            }
            cx += list[k];
            cy += list[k + 1];
          });
          for (const mesh of meshes) {
            mesh.computeBoundingSphere();
            scene.add(mesh);
          }
          meshes[1].visible = false;
          sceneryCells.push({ near: [meshes[0]], far: [meshes[1]], x: cx / entries.length, y: cy / entries.length });
        }
      }
