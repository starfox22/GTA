      // Lighting 3D vehicle lights, part 2: BEAM SHADOWS (people, cars, trees and posts in the CAR LAMPS beams), the
      // TERRAIN HORIZON strip kept in the same texture, and the headlights() report.
      /**
       * BEAM SHADOWS
       * The beams of the first CAR LAMPS slots (the player's car, then the cars
       * nearest the view: quality.js `beamShadows`, 2 on MEDIUM up to 8 on
       * ULTRA) are blocked by what stands in them: the car in front, people,
       * trees, lamp posts, signal poles and street furniture. Each occluder is
       * drawn, seen from straight above, as a dark wedge running away from the
       * lamps into its slot's tile of a mask laid along the beam (x ahead, y to
       * the kerb side), widening with distance and softening as the two lamps'
       * shadows part; its green channel keeps how high the occluder's top stands
       * above the lamps (as a tangent from the lamps), so a wall behind a
       * pedestrian is shadowed only below the line over their head. Max
       * blending, one instanced draw into the 1024 x 384 mask (a 4 x 2 grid of
       * tiles) at the foot of the target; lit materials read slot i's tile i
       * (cityBeamShade). The TERRAIN HORIZON strip lies above it (a float
       * target: tangents are signed), copied in whenever a slot's table
       * changes; the mask's clear is scissored to the mask, so the strip
       * survives it.
       */
      const BEAM_SHADOW_CAPACITY = 384,
        // Occluders one slot may shadow (the nearest first would need a sort;
        // a busy crossing stays well under this).
        BEAM_SHADOW_PER_SLOT = 72,
        beamShadowTarget = new Three.WebGLRenderTarget(BEAM_MASK_WIDTH, BEAM_TEXTURE_HEIGHT, {
          type: hdrCapable ? Three.HalfFloatType : Three.UnsignedByteType,
          depthBuffer: false,
          minFilter: Three.LinearFilter,
          magFilter: Three.LinearFilter,
        }),
        beamShadowScene = new Three.Scene(),
        // The whole grid: tile (column, row) spans BEAM_TILE_LENGTH x BEAM_TILE_WIDTH.
        beamShadowCamera = new Three.OrthographicCamera(0, BEAM_TILE_LENGTH * BEAM_TILE_COLUMNS, BEAM_TILE_WIDTH * BEAM_TILE_ROWS, 0, 0.1, 10),
        beamShadowWedges = new Three.InstancedMesh(
          new Three.PlaneGeometry(1, 2).translate(0.5, 0, 0),
          new Three.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            blending: Three.CustomBlending,
            blendEquation: Three.MaxEquation,
            blendSrc: Three.OneFactor,
            blendDst: Three.OneFactor,
            vertexShader: `
              varying vec2 vWedge;
              varying vec3 vShade;
              varying vec2 vLocal;
              void main() {
                // instanceColor: widening over the length, top tangent, tile + darkness.
                vShade = instanceColor;
                vWedge = vec2( position.x, position.y );
                vec3 p = vec3( position.x, position.y * mix( 1.0, instanceColor.x, position.x ), 0.0 );
                // The wedge in its tile (x ahead, y across), then the tile in the grid.
                vec4 local = instanceMatrix * vec4( p, 1.0 );
                vLocal = local.xy;
                float tile = floor( instanceColor.z );
                local.xy += vec2( mod( tile, ${BEAM_TILE_COLUMNS.toFixed(1)} ) * ${BEAM_TILE_LENGTH.toFixed(1)}, ( floor( tile / ${BEAM_TILE_COLUMNS.toFixed(1)} ) + 0.5 ) * ${BEAM_TILE_WIDTH.toFixed(1)} );
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * local;
              }`,
            fragmentShader: `
              varying vec2 vWedge;
              varying vec3 vShade;
              varying vec2 vLocal;
              void main() {
                // Clipped to its own tile.
                if ( vLocal.x < 0.0 || vLocal.x > ${BEAM_TILE_LENGTH.toFixed(1)} || abs( vLocal.y ) > ${(BEAM_TILE_WIDTH / 2).toFixed(1)} ) discard;
                float soft = mix( 0.35, 0.95, vWedge.x );
                float across = 1.0 - smoothstep( 1.0 - soft, 1.0, abs( vWedge.y ) );
                float along = smoothstep( 0.0, 0.03, vWedge.x ) * ( 1.0 - smoothstep( 0.55, 1.0, vWedge.x ) );
                float dark = fract( vShade.z ) * across * along * ( 1.0 - 0.45 * vWedge.x );
                gl_FragColor = vec4( dark, dark > 0.01 ? vShade.y : 0.0, 0.0, 1.0 );
              }`,
          }),
          BEAM_SHADOW_CAPACITY,
        );
      beamShadowTarget.texture.generateMipmaps = false;
      beamShadowTarget.viewport.set(0, 0, BEAM_MASK_WIDTH, BEAM_MASK_HEIGHT);
      beamShadowTarget.scissor.set(0, 0, BEAM_MASK_WIDTH, BEAM_MASK_HEIGHT);
      beamShadowTarget.scissorTest = true;
      hazeUniforms.cityBeamShadow.value = beamShadowTarget.texture;
      // The horizon strip's copy: one quad over the strip's viewport, texel for texel.
      const horizonScene = new Three.Scene(),
        horizonQuad = new Three.Mesh(
          new Three.PlaneGeometry(2, 2),
          new Three.ShaderMaterial({
            uniforms: { table: { value: horizonTexture } },
            depthTest: false,
            depthWrite: false,
            blending: Three.NoBlending,
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = vec4( position.xy, 0.0, 1.0 );
              }`,
            fragmentShader: `
              uniform sampler2D table;
              varying vec2 vUv;
              void main() {
                gl_FragColor = vec4( texture2D( table, vUv ).rg, 0.0, 1.0 );
              }`,
          }),
        );
      horizonQuad.frustumCulled = false;
      horizonScene.add(horizonQuad);
      function drawHorizonStrip() {
        if (!horizonDirty) return;
        horizonDirty = false;
        horizonTexture.needsUpdate = true;
        const previousTarget = renderer.getRenderTarget();
        beamShadowTarget.viewport.set(0, BEAM_HORIZON_TOP, HORIZON_STRIP_WIDTH, HEADLIGHT_HORIZON.rows);
        beamShadowTarget.scissor.copy(beamShadowTarget.viewport);
        renderer.setRenderTarget(beamShadowTarget);
        renderer.render(horizonScene, beamShadowCamera);
        beamShadowTarget.viewport.set(0, 0, BEAM_MASK_WIDTH, BEAM_MASK_HEIGHT);
        beamShadowTarget.scissor.copy(beamShadowTarget.viewport);
        renderer.setRenderTarget(previousTarget);
      }
      beamShadowCamera.position.set(0, 0, 5);
      beamShadowCamera.updateMatrixWorld();
      beamShadowWedges.count = 0;
      beamShadowWedges.frustumCulled = false;
      beamShadowWedges.setColorAt(0, new Three.Color());
      beamShadowScene.add(beamShadowWedges);
      Object.assign(cityLightUniforms, {
        cityBeamShadow: { value: beamShadowTarget.texture },
        // How many slots (from the first) read their mask tile.
        cityBeamShadowSlots: { value: 0 },
      });
      const wedgeMatrix = new Three.Matrix4(),
        wedgePosition = new Three.Vector3(),
        wedgeQuaternion = new Three.Quaternion(),
        wedgeScale = new Three.Vector3(),
        wedgeAxis = new Three.Vector3(0, 0, 1),
        wedgeColor = new Three.Color(),
        // The slot being drawn: its tile, lamp point (world), heading and car.
        wedgeSlot = { tile: 0, lamp: null, cos: 1, sin: 0, car: null, count: 0 };
      let wedgeCount = 0;
      // One occluder at map (x, y): half its width across the ray, half its depth
      // along it, its top's height (world y) and how dark its shadow is (0..1).
      function addBeamWedge(x, y, halfWidth, halfDepth, top, darkness = 0.88) {
        if (wedgeCount >= BEAM_SHADOW_CAPACITY || wedgeSlot.count >= BEAM_SHADOW_PER_SLOT) return;
        const lamp = wedgeSlot.lamp,
          dx = x - lamp.x,
          dz = y - lamp.z,
          ahead = dx * wedgeSlot.cos + dz * wedgeSlot.sin,
          side = -dx * wedgeSlot.sin + dz * wedgeSlot.cos,
          distance = Math.hypot(ahead, side);
        if (ahead < 4 || ahead > BEAM_TILE_LENGTH || Math.abs(side) > ahead * 1.3 + 24) return;
        const rise = (top - lamp.y) / distance;
        if (rise <= 0) return;
        const ux = ahead / distance,
          uy = side / distance,
          start = distance + halfDepth * 0.6,
          length = BEAM_TILE_LENGTH * 1.2 - start;
        if (length <= 0) return;
        wedgeQuaternion.setFromAxisAngle(wedgeAxis, Math.atan2(uy, ux));
        wedgePosition.set(ux * start, uy * start, 0);
        wedgeScale.set(length, halfWidth, 1);
        beamShadowWedges.setMatrixAt(wedgeCount, wedgeMatrix.compose(wedgePosition, wedgeQuaternion, wedgeScale));
        // A vertical post's shadow from a point widens in proportion to the distance.
        beamShadowWedges.setColorAt(wedgeCount, wedgeColor.setRGB((start + length) / start, Math.min(rise, 1), wedgeSlot.tile + Math.min(darkness, 0.99)));
        wedgeCount++;
        wedgeSlot.count++;
      }
      // Quick reject: within the tile's reach of the lamps, and ahead of them.
      function inBeamReach(x, y) {
        const lamp = wedgeSlot.lamp,
          dx = x - lamp.x,
          dz = y - lamp.z;
        return Math.abs(dx) < BEAM_TILE_LENGTH + 40 && Math.abs(dz) < BEAM_TILE_LENGTH + 40 && dx * wedgeSlot.cos + dz * wedgeSlot.sin > 0;
      }
      // An oriented box (half extents hx along its heading a, hy across) seen along the ray.
      function addBoxWedge(x, y, a, hx, hy, top, darkness) {
        const lamp = wedgeSlot.lamp,
          turn = a - Math.atan2(y - lamp.z, x - lamp.x),
          across = Math.abs(hx * Math.sin(turn)) + Math.abs(hy * Math.cos(turn)),
          along = Math.abs(hx * Math.cos(turn)) + Math.abs(hy * Math.sin(turn));
        addBeamWedge(x, y, across * 0.9, along, top, darkness);
      }
      const PERSON_SHADOW_HALF = 0.28 * UNITS_PER_METRE;
      function addPersonWedge(p) {
        if (p.hidden || p.swimming || !inBeamReach(p.x, p.y)) return;
        addBeamWedge(p.x, p.y, PERSON_SHADOW_HALF, PERSON_SHADOW_HALF, entityElevation(p) + PERSON_HEIGHT * (p.hp <= 0 ? 0.25 : 1));
      }
      // Street furniture in the beams (damage-upkeep.js street props): the top of
      // each kind in metres (trees by their crown) and how dark its shadow is (a
      // crown or a railing lets some light through). Kinds lower than the lamps
      // (cones, crates, loungers) cast none.
      const PROP_SHADOW = {
        lamp: [9, 0.9],
        signal: [5.5, 0.9],
        lantern: [4, 0.9],
        tree: [0, 0.8],
        palm: [8, 0.75],
        planter: [3, 0.8],
        hydrant: [0.8, 0.9],
        mailbox: [1.25, 0.9],
        meter: [1.4, 0.85],
        news: [1.1, 0.9],
        trash: [1, 0.9],
        dumpster: [1.4, 0.92],
        bench: [0.85, 0.7],
        seat: [0.85, 0.7],
        railing: [1.05, 0.45],
        bollard: [1, 0.9],
        biketotem: [2.2, 0.9],
        sharebike: [1.1, 0.5],
        bikerack: [0.9, 0.4],
      };
      // Posts and trunks are thinner than the box a car strikes.
      const PROP_POSTS = new Set(['lamp', 'signal', 'lantern', 'tree', 'palm']);
      function addPropWedge(prop) {
        const kind = PROP_SHADOW[prop.kind];
        if (!kind || prop.down || !inBeamReach(prop.x, prop.y)) return;
        // A tree's crown radius stands for its height (a 1.5 m crown on a ~5.5 m tree).
        const top = (prop.kind === 'tree' ? Math.max(prop.size || 12, 8) * 3.6 : kind[0] * UNITS_PER_METRE) + terrainHeight(prop.x, prop.y),
          post = PROP_POSTS.has(prop.kind);
        addBoxWedge(prop.x, prop.y, prop.a || 0, post ? Math.min(prop.hx, 1.6) : prop.hx, post ? Math.min(prop.hy, 1.6) : prop.hy, top, kind[1]);
      }
      function addCarWedge(c) {
        if (c === wedgeSlot.car || c.hp <= 0 || isAircraft(c) || !inBeamReach(c.x, c.y)) return;
        const spec = vehicleSpec(c);
        if (spec.boat || spec.jetski) return;
        const height = (spec.truck || c.type === 'bus' || c.type === 'van' ? 2.6 : spec.bike || spec.bicycle ? 1.4 : 1.45) * UNITS_PER_METRE;
        // The car's footprint seen along the ray from the lamps.
        addBoxWedge(c.x, c.y, c.a, spec.l / 2, spec.w / 2, entityElevation(c) + height, 0.92);
      }
      let beamShadowSlots = 0,
        beamShadowDrawn = false;
      function updateBeamShadows() {
        const u = cityLightUniforms.cityBeamShadowSlots;
        wedgeCount = 0;
        drawHorizonStrip();
        let slots = Math.min(carLampCount, activeTier?.beamShadows ?? 0, BEAM_SHADOW_TILES);
        // Only the leading slots read a tile: stop at the first unlit one.
        for (let i = 0; i < slots; i++)
          if (carLampA[i].w <= 0) {
            slots = i;
            break;
          }
        beamShadowSlots = slots;
        const reach = BEAM_TILE_LENGTH;
        for (let i = 0; i < slots; i++) {
          const lamp = carLampA[i],
            cos = carLampB[i].x,
            sin = carLampB[i].y;
          Object.assign(wedgeSlot, { tile: i, lamp, cos, sin, car: carLampCars[i], count: 0 });
          // Cars first (the car in front matters most), then people, then furniture.
          for (const c of vehicles) addCarWedge(c);
          if (!player.car && !player.hidden && inBeamReach(player.x, player.y))
            addBeamWedge(player.x, player.y, PERSON_SHADOW_HALF, PERSON_SHADOW_HALF, entityElevation(player) + PERSON_HEIGHT);
          for (const p of pedestrians) addPersonWedge(p);
          for (const p of renderPeople) addPersonWedge(p);
          propsNear(lamp.x + cos * reach * 0.5, lamp.z + sin * reach * 0.5, reach * 0.62, addPropWedge);
        }
        beamShadowWedges.count = wedgeCount;
        carLampStats.shadowWedges = wedgeCount;
        // No occluder anywhere: the tiles are not read.
        u.value = wedgeCount ? slots : 0;
        if (!wedgeCount) {
          // Cleared once when the last wedge goes, so a later slot starts clean.
          if (beamShadowDrawn) clearBeamShadowMask(false);
          return;
        }
        beamShadowWedges.instanceMatrix.needsUpdate = true;
        beamShadowWedges.instanceColor.needsUpdate = true;
        clearBeamShadowMask(true);
      }
      // Clears the mask (the scissor keeps the horizon strip) and draws the wedges.
      function clearBeamShadowMask(draw) {
        const previousTarget = renderer.getRenderTarget(),
          previousAlpha = renderer.getClearAlpha();
        renderer.getClearColor(driveClearColor);
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(beamShadowTarget);
        renderer.clear(true, false, false);
        if (draw) renderer.render(beamShadowScene, beamShadowCamera);
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(driveClearColor, previousAlpha);
        beamShadowDrawn = draw;
      }
      // DeadEndCity.headlights(): the vehicle lights this frame.
      function vehicleLightsReport() {
        const round = (v) => Math.round(v * 10) / 10;
        return {
          ...carLampStats,
          lampsOn: round(vehicleLampAmount()),
          cars: carLampCars.slice(0, carLampCount).map((c, i) => ({
            type: c.type,
            player: c === player.car,
            lightBar: carLampFlood[i],
            x: round(carLampA[i].x),
            z: round(carLampA[i].z),
            y: round(carLampA[i].y),
            height: round(carLampB[i].w),
            strength: Math.round(carLampA[i].w),
            // The body frame the beam runs in (degrees) and whether it reads the terrain horizon.
            pitch: round((Math.asin(clamp(carLampC[i].x, -1, 1)) * 180) / Math.PI),
            roll: round((Math.atan2(carLampC[i].y, carLampC[i].z) * 180) / Math.PI),
            aim: [slotFrames[i].forward.x, slotFrames[i].forward.y, slotFrames[i].forward.z].map((v) => Math.round(v * 1000) / 1000),
            horizon: carLampC[i].w % 2 > 0.5,
          })),
          // Terrain horizons recomputed this frame, and tables per slot on the range.
          horizonsComputed: horizonComputed,
          terrainBeams: lookSwitchState.terrainBeams,
          headBeamPeak: round(headBeamPeak),
          // Slots whose beams people, cars, trees and posts shadow (BEAM SHADOWS).
          shadowSlots: beamShadowSlots,
          hazeLevel: Math.round(hazeUniforms.uHaze.value * hazePeak * 1000) / 1000,
        };
      }
