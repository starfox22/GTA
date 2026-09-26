      // County 3D forests (plantForest), mist, updateTerrainVisuals(), the airport and updateCountyVisuals().
      // The Ridgeline's species: conifers by altitude, broadleaf by chance.
      function forestSpecies(conifer, ground, roll) {
        if (!conifer) return roll < 0.55 ? 'beech' : roll < 0.8 ? 'birch' : 'maple';
        const [pine, fir] = ground < 150 ? [0.55, 0.8] : ground < 400 ? [0.2, 0.6] : [0.1, 0.35];
        return roll < pine ? 'pine' : roll < fir ? 'fir' : 'spruce';
      }
      // Size 1 of mountainScenery() is 1/21 of a species' modelled size.
      const FOREST_SCALE = 1 / 21;
      function plantForest(lists) {
        const cells = new Map();
        for (const { list, conifer } of lists)
          for (let k = 0; k < list.length; k += 6) {
            const key = Math.floor(list[k] / SCENERY_CELL) * 4096 + Math.floor(list[k + 1] / SCENERY_CELL);
            if (!cells.has(key)) cells.set(key, []);
            const roll = (list[k + 4] * 7.31 + list[k + 5] * 0.137) % 1;
            cells.get(key).push({ list, k, conifer, species: forestSpecies(conifer, list[k + 2], roll) });
          }
        const m = new Three.Matrix4(),
          q = new Three.Quaternion(),
          lean = new Three.Quaternion(),
          s = new Three.Vector3(),
          p = new Three.Vector3(),
          up = new Three.Vector3(0, 1, 0),
          axis = new Three.Vector3(),
          ratio = new Three.Color();
        // The far level: every conifer is the spruce's low cone, every broadleaf
        // the beech's blob, tinted to its own species' leaf colour.
        const farBase = { true: TREE_SPECIES.spruce, false: TREE_SPECIES.beech };
        for (const entries of cells.values()) {
          const bySpecies = new Map(),
            byFar = new Map();
          for (const e of entries) {
            if (!bySpecies.has(e.species)) bySpecies.set(e.species, []);
            bySpecies.get(e.species).push(e);
            if (!byFar.has(e.conifer)) byFar.set(e.conifer, []);
            byFar.get(e.conifer).push(e);
          }
          const place = (mesh, list, far) =>
            list.forEach((e, j) => {
              const { list: data, k, species } = e,
                S = TREE_SPECIES[species],
                v = treeVariation(S, data[k], data[k + 1]),
                size = data[k + 3] * FOREST_SCALE * v.scale;
              q.setFromAxisAngle(up, data[k + 5]);
              axis.set(v.leanX, 0, v.leanZ);
              const tilt = axis.length();
              if (tilt > 1e-4) q.premultiply(lean.setFromAxisAngle(axis.normalize(), tilt * 0.6));
              s.set(size * v.aspect, size / Math.sqrt(v.aspect), size * v.aspect);
              p.set(data[k], data[k + 2] - 1, data[k + 1]);
              m.compose(p, q, s);
              mesh.setMatrixAt(j, m);
              if (far) {
                const base = farBase[e.conifer].leafColor;
                ratio.setRGB(S.leafColor.r / base.r, S.leafColor.g / base.g, S.leafColor.b / base.b).multiply(v.tint);
                setFoliageInstance(mesh, j, ratio, v.morph, 0);
              } else setFoliageInstance(mesh, j, v.tint, v.morph, v.density);
              forestCounts[species] = (forestCounts[species] || 0) + (far ? 0 : 1);
            });
          const near = [],
            far = [];
          for (const [species, list] of bySpecies) {
            const mesh = foliageInstances(speciesGeometry(species, 0), list.length);
            mesh.name = 'Ridgeline ' + species;
            place(mesh, list, false);
            near.push(mesh);
          }
          for (const [conifer, list] of byFar) {
            const mesh = foliageInstances(speciesGeometry(farBase[conifer].key, 1), list.length);
            mesh.name = 'Ridgeline ' + (conifer ? 'conifers' : 'broadleaf') + ' far';
            mesh.castShadow = false;
            place(mesh, list, true);
            mesh.visible = false;
            far.push(mesh);
          }
          let cx = 0,
            cy = 0;
          for (const e of entries) {
            cx += e.list[e.k];
            cy += e.list[e.k + 1];
          }
          for (const mesh of [...near, ...far]) {
            mesh.computeBoundingSphere();
            scene.add(mesh);
          }
          sceneryCells.push({ near, far, x: cx / entries.length, y: cy / entries.length });
        }
      }
      {
        const { conifers, broadleaf, rocks } = mountainScenery();
        plantForest([
          { list: conifers, conifer: true },
          { list: broadleaf, conifer: false },
        ]);
        plantScenery(rocks, boulderGeometry, boulderGeometry, boulderMaterial, 'boulders', 1, 0.25);
      }
      /**
       * STREAMS
       * terrainStreams() traces the ravines; each stream is a ribbon laid over the
       * surface (one mesh for all of them). Its shader runs the water downhill:
       * dark, glinting water where the bed is gentle, white broken water where it
       * drops (the waterfalls over the cliff bands).
       */
      {
        const positions = [],
          uvs = [],
          falls = [],
          indices = [];
        for (const line of terrainStreams()) {
          let along = 0;
          line.forEach(([x, y, , width, steep], k) => {
            const prev = line[Math.max(0, k - 1)],
              next = line[Math.min(line.length - 1, k + 1)],
              dx = next[0] - prev[0],
              dy = next[1] - prev[1],
              len = Math.hypot(dx, dy) || 1,
              nx = -dy / len,
              ny = dx / len,
              half = Math.min(width, 16) / 2;
            if (k) along += Math.hypot(x - prev[0], y - prev[1]);
            const base = positions.length / 3;
            for (const side of [-1, 1]) {
              const px = x + nx * side * half,
                py = y + ny * side * half,
                ground = Math.max(terrainHeight(px, py), terrainHeight(x, y));
              positions.push(px, ground + 0.9, py);
              uvs.push(side * 0.5 + 0.5, along / 40);
              falls.push(clamp(steep, 0, 2));
            }
            if (k) indices.push(base - 2, base, base - 1, base - 1, base, base + 1);
          });
        }
        if (indices.length) {
          const geo = new Three.BufferGeometry();
          geo.setAttribute('position', new Three.Float32BufferAttribute(positions, 3));
          geo.setAttribute('uv', new Three.Float32BufferAttribute(uvs, 2));
          geo.setAttribute('fall', new Three.Float32BufferAttribute(falls, 1));
          geo.setIndex(indices);
          geo.computeVertexNormals();
          const streamMaterial = new Three.MeshStandardMaterial({ color: '#2d4a52', roughness: 0.12, metalness: 0.1, transparent: true, depthWrite: false });
          streamMaterial.onBeforeCompile = (shader) => {
            cityMaterialPatch(shader);
            Object.assign(shader.uniforms, terrainUniforms);
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nattribute float fall;\nvarying float vFall;\nvarying vec2 vStreamUv;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFall = fall;\nvStreamUv = uv;');
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nvarying float vFall;\nvarying vec2 vStreamUv;\nuniform float terrainTime;\n' + TERRAIN_NOISE)
              .replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                float edge = smoothstep( 0.0, 0.3, vStreamUv.x ) * smoothstep( 1.0, 0.7, vStreamUv.x );
                float speed = 1.2 + vFall * 5.0;
                float ripples = terrainNoise( vec2( vStreamUv.x * 6.0, vStreamUv.y * 5.0 - terrainTime * speed ) );
                float foam = clamp( smoothstep( 0.35, 1.1, vFall ) * ( 0.55 + 0.6 * ripples ) + smoothstep( 0.8, 0.95, ripples ) * 0.4, 0.0, 1.0 );
                diffuseColor.rgb = mix( diffuseColor.rgb * ( 0.8 + 0.4 * ripples ), vec3( 0.82, 0.88, 0.9 ), foam );
                diffuseColor.a = edge * mix( 0.78, 0.95, foam );`,
              )
              .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( 0.1, 0.7, foam );');
          };
          streamMaterial.customProgramCacheKey = () => 'ridgeline-streams';
          const streams = new Three.Mesh(geo, streamMaterial);
          streams.name = 'Ridgeline streams';
          streams.renderOrder = 1;
          streams.receiveShadow = true;
          scene.add(streams);
        }
      }
      /**
       * VALLEY MIST
       * Two sheets of mist over the range at dawn (and a little at dusk, more after
       * rain): each is drawn only where it lies above the ground, thickening with
       * the depth of air beneath it, so it pools in the valleys, round the
       * reservoir and along the coast while the ridges stand clear. The ground
       * height comes from a small texture of the range field.
       */
      const mistSheets = [];
      {
        const field = terrainField(TERRAIN_FIELDS[0]),
          { cols, rows, heights, x0, y0 } = field,
          pixels = new Uint8Array(cols * rows * 4);
        for (let i = 0; i < cols * rows; i++) {
          pixels[i * 4] = Math.min(255, Math.round(heights[i] / 4));
          pixels[i * 4 + 3] = 255;
        }
        const heightTexture = new Three.DataTexture(pixels, cols, rows);
        heightTexture.magFilter = heightTexture.minFilter = Three.LinearFilter;
        heightTexture.needsUpdate = true;
        for (const [level, seed] of [
          [55, 0],
          [120, 7.3],
        ]) {
          const material = new Three.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
              mistHeights: { value: heightTexture },
              mistRect: { value: new Three.Vector4(x0, y0, (cols - 1) * TERRAIN_CELL, (rows - 1) * TERRAIN_CELL) },
              mistLevel: { value: level },
              mistSeed: { value: seed },
              mistColor: { value: new Three.Color('#dfe4e8') },
              mistAmount: { value: 0 },
              terrainTime: terrainUniforms.terrainTime,
            },
            vertexShader: `
              varying vec3 vMistWorld;
              void main() {
                vec4 world = modelMatrix * vec4( position, 1.0 );
                vMistWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
              }`,
            fragmentShader: `
              uniform sampler2D mistHeights;
              uniform vec4 mistRect;
              uniform float mistLevel, mistSeed, mistAmount, terrainTime;
              uniform vec3 mistColor;
              varying vec3 vMistWorld;
              ${TERRAIN_NOISE}
              void main() {
                vec2 uv = ( vMistWorld.xz - mistRect.xy ) / mistRect.zw;
                float ground = texture2D( mistHeights, uv ).r * 1020.0;
                float depth = smoothstep( 0.0, 45.0, mistLevel - ground );
                vec2 drift = vec2( terrainTime * 3.0, terrainTime * 1.2 );
                float wisps = terrainFbm( ( vMistWorld.xz + drift ) * 0.0035 + mistSeed ) ;
                wisps = smoothstep( 0.4, 0.85, wisps + terrainNoise( ( vMistWorld.xz - drift ) * 0.012 ) * 0.25 );
                float edge = smoothstep( 0.0, 0.04, uv.x ) * smoothstep( 1.0, 0.96, uv.x ) * smoothstep( 0.0, 0.06, uv.y ) * smoothstep( 1.0, 0.94, uv.y );
                float alpha = depth * wisps * edge * mistAmount * 0.3;
                if ( alpha < 0.004 ) discard;
                gl_FragColor = vec4( mistColor, alpha );
                #include <colorspace_fragment>
              }`,
          });
          const sheet = new Three.Mesh(new Three.PlaneGeometry((cols - 1) * TERRAIN_CELL, (rows - 1) * TERRAIN_CELL), material);
          sheet.rotation.x = -Math.PI / 2;
          sheet.position.set(x0 + ((cols - 1) * TERRAIN_CELL) / 2, level, y0 + ((rows - 1) * TERRAIN_CELL) / 2);
          sheet.name = 'Valley mist';
          sheet.renderOrder = 2;
          sheet.visible = false;
          scene.add(sheet);
          mistSheets.push(sheet);
        }
      }
      // Per frame: level of detail by distance, the shader's clock and sun, the mist.
      const terrainEye = new Three.Vector3();
      function updateTerrainVisuals() {
        terrainUniforms.terrainTime.value = gameTime % 1000;
        terrainUniforms.terrainSunPower.value = clamp(sun.intensity / 3, 0, 1.5);
        if (flightViewActive) terrainEye.copy(camera.position);
        else terrainEye.set(viewCenter.x, 700, viewCenter.y);
        const lodScale = activeTier ? activeTier.lodBias : 1;
        for (const chunk of terrainChunks) {
          const d = Math.hypot(terrainEye.x - chunk.centre.x, terrainEye.y - chunk.centre.z, terrainEye.z - chunk.centre.y),
            coarse = d > TERRAIN_LOD_DISTANCE * lodScale;
          if (coarse !== chunk.coarse) {
            chunk.coarse = coarse;
            chunk.mesh.geometry.setIndex(coarse ? chunk.coarseIndex : chunk.fullIndex);
          }
        }
        for (const cell of sceneryCells) {
          const d = Math.hypot(terrainEye.x - cell.x, terrainEye.z - cell.y, terrainEye.y * 0.8),
            far = d > SCENERY_NEAR * lodScale;
          for (const mesh of cell.near) mesh.visible = !far;
          for (const mesh of cell.far) mesh.visible = far;
        }
        // Mist: thickest just after dawn, a trace at dusk, more when the ground is wet.
        const hour = (worldMinutes % 1440) / 60,
          dawn = smoothStep(4.6, 6.2, hour) * (1 - smoothStep(7.4, 9.6, hour)),
          dusk = smoothStep(18.8, 20, hour) * (1 - smoothStep(21, 23, hour)) * 0.35,
          amount = clamp(Math.max(dawn, dusk) + weather.wet * 0.3, 0, 1);
        for (const sheet of mistSheets) {
          sheet.visible = amount > 0.01;
          sheet.material.uniforms.mistAmount.value = amount;
          sheet.material.uniforms.mistColor.value.set('#e4e8ec').lerp(scene.fog.color, 0.4).lerp(sun.color, 0.12);
        }
      }
      // Gravel markings live on the mountain material itself; no second floating road surface.
      for (const trail of MOUNTAIN_TRAILS) {
        const group = new Three.Group();
        group.name = trail.peak.name + ' overlook';
        scene.add(group);
        batchGroups.push(group);
        const p = trail.peak,
          h = terrainHeight(p.x, p.y);
        box(group, p.x, h + 18, p.y, 1.3, 36, 1.3, chrome);
        box(group, p.x + 10, h + 31, p.y, 19, 10, 0.8, staticMat('#eab876'));
        // Small stone viewpoint details sit beyond the end of the driving line.
        for (const [dx, dz] of [
          [26, -18],
          [28, -5],
          [29, 8],
        ]) {
          const x = p.x + dx,
            z = p.y + dz,
            y = terrainHeight(x, z);
          const rock = mesh(
            new Three.IcosahedronGeometry(1, 0),
            countyStone,
            group,
            x,
            y + 1.2,
            z,
            4.5,
            3,
            3.5,
          );
          rock.rotation.y = dx * 0.3;
        }
        const boardX = p.x + 27,
          boardZ = p.y - 27,
          boardY = terrainHeight(boardX, boardZ);
        for (const side of [-1, 1]) box(group, boardX + side * 6, boardY + 5, boardZ, 1.2, 10, 1.2, wood);
        const board = box(group, boardX, boardY + 10, boardZ, 17, 1.5, 10, staticMat('#9e9c79'));
        board.rotation.x = -0.22;
        box(group, boardX, boardY + 11, boardZ, 12, 0.3, 6, staticMat('#506d64'));
        sign(
          trail.peak.name + ' · 4×4 TRAIL',
          trail.points[0][0] + 55,
          trail.points[0][1] + 30,
          // A trailhead board at real size (it was 19 m across).
          88,
          '#d4cb92',
        );
        statics.push({
          x: p.x,
          y: p.y,
          group,
          radius: p.r + 350,
        });
      }
      for (const [i, r] of MOUNTAIN_OUTCROPS.entries()) {
        const group = new Three.Group();
        group.name = 'Mountain outcrop ' + i;
        scene.add(group);
        batchGroups.push(group);
        const base = terrainHeight(r.x, r.y),
          rock = mesh(
            new Three.IcosahedronGeometry(1, 1),
            i % 2 ? countyStone : countyRock,
            group,
            r.x,
            base + r.rise * 0.35,
            r.y,
            r.w * 0.5,
            r.rise * 0.65,
            r.h * 0.5,
          );
        rock.rotation.y = i * 0.7;
        rock.receiveShadow = rock.castShadow = true;
        const seam = mesh(
          new Three.IcosahedronGeometry(1, 0),
          countyStone,
          group,
          r.x + r.w * 0.18,
          base + r.rise * 0.13,
          r.y - r.h * 0.1,
          r.w * 0.22,
          r.rise * 0.38,
          r.h * 0.34,
        );
        seam.rotation.y = i * 0.8;
        statics.push({
          x: r.x,
          y: r.y,
          group,
          radius: 65,
        });
      }
      // The bridges are drawn by bridges3d.js, each in its own style.
      for (const t of COUNTY_TOWNS) {
        sign(t.name, t.x + 200, t.y - 72, 150, t.style === 'resort' ? '#e3b9b5' : '#d6d6be', false, { style: t.style === 'resort' ? 'resort' : 'town' });
        // The mountain villages light their streets with iron lanterns (mountain-village3d.js).
        for (let j = 0; j < 5 && !isMountainTown(t); j++) {
          const group = new Three.Group();
          scene.add(group);
          batchGroups.push(group);
          const x = t.x + 70 + j * 185,
            z = t.y + 67;
          box(group, x, 19, z, 1.4, 38, 1.4, darkMetal);
          box(group, x + 4, 38, z, 9, 1.3, 1.4, darkMetal);
          box(group, x + 8, 37, z, 5, 1, 4, warmLamp);
          halo(group, x + 8, 37, z, 17);
          box(group, x + 23, 2, z + 2, 20, 3, 7, wood);
          for (const side of [-1, 1]) box(group, x + 23 + side * 7, 1, z + 2, 1.5, 3, 6, darkMetal);
          statics.push({
            x,
            y: z,
            group,
            radius: 65,
          });
        }
      }
      sign('EAGLE PASS · SCENIC ROUTE', 6650, 2460, 195, '#d5d6b9');
      sign('OCEANVIEW / AIRPORT', 3370, 6920, 190, '#c3ded5');
      sign('CORAL COAST', 7080, 7360, 165, '#f2ccae');
      // The county airport is merged by the static batcher; the radar (which
      // turns) is flagged dynamic.
      const airportGroup = new Three.Group();
      scene.add(airportGroup);
      batchGroups.push(airportGroup);
      const air = COUNTY_AIRPORT;
      for (let x = air.terminal.x + 12; x < air.terminal.x + air.terminal.w - 10; x += 24) {
        box(airportGroup, x, 25, air.terminal.y + air.terminal.h + 1, 22, 35, 1.5, terminalGlass);
        box(airportGroup, x, 25, air.terminal.y + air.terminal.h + 2, 1, 37, 2, chrome);
      }
      box(airportGroup, 4200, 37, 8680, 610, 3, 60, countyCream);
      for (const x of [3920, 4200, 4480]) box(airportGroup, x, 18, 8698, 2.5, 36, 2.5, chrome);
      box(airportGroup, 3530, 64, 8980, 22, 128, 22, concrete);
      box(airportGroup, 3530, 135, 8980, 62, 24, 55, terminalGlass);
      box(airportGroup, 3530, 150, 8980, 68, 4, 61, airWhite);
      box(airportGroup, 3530, 170, 8980, 1, 37, 1, chrome);
      const radar = box(airportGroup, 3530, 183, 8980, 32, 8, 1, countyRail);
      radar.userData.dynamic = true;
      const terminalTitle = sign('OCEANVIEW INTERNATIONAL', 4215, 8642, 380, '#d1e5df');
      terminalTitle.position.y = terminalTitle.userData.backing.position.y = 55;
      const arrivalsTitle = sign('DEPARTURES / ARRIVALS', 4190, 8709, 215, '#c2dcd5');
      arrivalsTitle.position.y = arrivalsTitle.userData.backing.position.y = 37;
      for (const [x, z, a, size] of [
        [4100, 9160, Math.PI / 2, 1.8],
        [4460, 9160, Math.PI / 2, 1.6],
        [5710, 9300, 0, 1.4],
      ]) {
        const before = ag.children.length;
        parkedJet(x, z, a, size);
        const model = ag.children[before];
        airportGroup.attach(model);
      }
      for (const x of [4100, 4460]) {
        box(airportGroup, x, 17, 8900, 20, 25, 360, countyCream);
        box(airportGroup, x, 23, 9080, 32, 30, 32, terminalGlass);
      }
      // The runway, its lights and markings are airfields3d.js.
      for (let i = 0; i < 8; i++) {
        box(airportGroup, 4730 + i * 36, 5, 8910, 24, 10, 14, mat(i % 2 ? '#bea077' : '#90a4a2'));
      }
      statics.push({
        x: 4800,
        y: 9280,
        group: airportGroup,
        radius: 1800,
      });
      // Fort Sentinel is drawn by base3d.js (included next).
      function updateCountyVisuals() {
        radar.rotation.y = gameTime * 0.7;
        updateBridgeVisuals();
        updateBaseVisuals();
        updateAirfieldVisuals();
        updateTerrainVisuals();
        updateMountainVisuals();
      }
      function makeTank(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body;
        model.tank = true;
        const armor = model.paint,
          track = staticMat('#29352c', 0.9, 0.3);
        box(b, 0, 10, 0, 79, 15, 41, armor);
        const bow = box(b, 30, 17, 0, 20, 9, 40, armor);
        bow.rotation.z = -0.23;
        box(b, -29, 18, 0, 20, 7, 38, armor);
        for (const side of [-1, 1]) {
          box(b, 0, 8, side * 22, 81, 15, 9, track);
          for (let x = -36; x <= 36; x += 8) {
            box(b, x, 15.7, side * 22, 5, 0.8, 9, countyRail);
            box(b, x, 1, side * 22, 5, 0.8, 9, countyRail);
          }
          for (let x = -29; x < 32; x += 12) {
            const w = mesh(wheelGeo, armor, b, x, 8, side * 26.5, 5.3, 1, 5.3);
            w.rotation.x = Math.PI / 2;
          }
          box(b, 0, 19, side * 22, 82, 3, 11, armor);
          box(b, 12, 24, side * 17, 19, 6, 5, armor);
        }
        for (let i = 0; i < 7; i++) box(b, -24 + i * 3, 22, 0, 1, 1, 25, darkMetal);
        const turret = new Three.Group();
        turret.position.set(0, 24, 0);
        b.add(turret);
        mesh(new Three.CylinderGeometry(17, 21, 10, 8), armor, turret, 0, 1, 0);
        box(turret, -1, 9, 0, 27, 9, 30, armor);
        mesh(new Three.CylinderGeometry(6, 6, 2, 12), countyRail, turret, -4, 15, -5);
        const barrel = new Three.Group();
        turret.add(barrel);
        rod(barrel, new Three.Vector3(12, 8, 0), new Three.Vector3(58, 8, 0), 2.2, armor);
        box(barrel, 59, 8, 0, 5, 5, 5, darkMetal);
        box(barrel, 19, 8, 0, 9, 10, 10, armor);
        rod(turret, new Three.Vector3(-10, 13, 11), new Three.Vector3(-12, 49, 12), 0.35, countyRail);
        for (const side of [-1, 1]) {
          box(b, 40, 15, side * 16, 1, 3, 5, warmLamp);
          box(b, -40, 14, side * 15, 1, 3, 3, tailLamp);
        }
        model.turret = turret;
        model.barrel = barrel;
        return model;
      }
