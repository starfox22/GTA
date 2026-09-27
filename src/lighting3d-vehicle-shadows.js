      // Lighting 3D vehicle lights, part 2: BEAM SHADOWS (people and cars in the player's beams), the TERRAIN HORIZON strip
      // kept in the same texture, and the headlights() report.
      /**
       * BEAM SHADOWS
       * The player's own low beams (CAR LAMPS slot 0) are shadowed by the people
       * and cars standing in them: each is drawn, seen from straight above, as a
       * dark wedge running away from the lamps into a small mask laid along the
       * beam (x ahead, y to the kerb side), widening with distance and softening
       * as the two lamps' shadows part; its green channel keeps how high the
       * occluder's top stands above the lamps (as a tangent from the lamps), so
       * a wall behind a pedestrian is shadowed only below the line over their
       * head. Max blending, one instanced draw into the 512 x 384 mask at the
       * foot of the target, MEDIUM and up; lit materials read it for slot 0 only
       * (cityBeamShade). The TERRAIN HORIZON strip lies above it (a float target:
       * tangents are signed), copied in whenever a slot's table changes; the
       * mask's clear is scissored to the mask, so the strip survives it.
       */
      const BEAM_SHADOW_LENGTH = 440,
        BEAM_SHADOW_WIDTH = 360,
        BEAM_SHADOW_CAPACITY = 48,
        beamShadowTarget = new Three.WebGLRenderTarget(BEAM_MASK_WIDTH, BEAM_TEXTURE_HEIGHT, {
          type: hdrCapable ? Three.HalfFloatType : Three.UnsignedByteType,
          depthBuffer: false,
          minFilter: Three.LinearFilter,
          magFilter: Three.LinearFilter,
        }),
        beamShadowScene = new Three.Scene(),
        beamShadowCamera = new Three.OrthographicCamera(0, BEAM_SHADOW_LENGTH, BEAM_SHADOW_WIDTH / 2, -BEAM_SHADOW_WIDTH / 2, 0.1, 10),
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
              void main() {
                // instanceColor: widening over the length, top tangent, darkness.
                vShade = instanceColor;
                vWedge = vec2( position.x, position.y );
                vec3 p = vec3( position.x, position.y * mix( 1.0, instanceColor.x, position.x ), 0.0 );
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4( p, 1.0 );
              }`,
            fragmentShader: `
              varying vec2 vWedge;
              varying vec3 vShade;
              void main() {
                float soft = mix( 0.35, 0.95, vWedge.x );
                float across = 1.0 - smoothstep( 1.0 - soft, 1.0, abs( vWedge.y ) );
                float along = smoothstep( 0.0, 0.03, vWedge.x ) * ( 1.0 - smoothstep( 0.55, 1.0, vWedge.x ) );
                float dark = vShade.z * across * along * ( 1.0 - 0.45 * vWedge.x );
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
        cityBeamShadowOn: { value: 0 },
      });
      const wedgeMatrix = new Three.Matrix4(),
        wedgePosition = new Three.Vector3(),
        wedgeQuaternion = new Three.Quaternion(),
        wedgeScale = new Three.Vector3(),
        wedgeAxis = new Three.Vector3(0, 0, 1),
        wedgeColor = new Three.Color();
      let wedgeCount = 0;
      // One occluder at map (x, y): half its width across the ray, half its depth
      // along it, and its top's height (world y).
      function addBeamWedge(lamp, headingCos, headingSin, x, y, halfWidth, halfDepth, top) {
        if (wedgeCount >= BEAM_SHADOW_CAPACITY) return;
        const dx = x - lamp.x,
          dz = y - lamp.z,
          ahead = dx * headingCos + dz * headingSin,
          side = -dx * headingSin + dz * headingCos,
          distance = Math.hypot(ahead, side);
        if (ahead < 4 || ahead > BEAM_SHADOW_LENGTH || Math.abs(side) > ahead * 1.3 + 24) return;
        const rise = (top - lamp.y) / distance;
        if (rise <= 0) return;
        const ux = ahead / distance,
          uy = side / distance,
          start = distance + halfDepth * 0.6,
          length = BEAM_SHADOW_LENGTH * 1.2 - start;
        if (length <= 0) return;
        wedgeQuaternion.setFromAxisAngle(wedgeAxis, Math.atan2(uy, ux));
        wedgePosition.set(ux * start, uy * start, 0);
        wedgeScale.set(length, halfWidth, 1);
        beamShadowWedges.setMatrixAt(wedgeCount, wedgeMatrix.compose(wedgePosition, wedgeQuaternion, wedgeScale));
        // A vertical post's shadow from a point widens in proportion to the distance.
        beamShadowWedges.setColorAt(wedgeCount, wedgeColor.setRGB((start + length) / start, Math.min(rise, 1), 0.88));
        wedgeCount++;
      }
      function addPersonWedge(p, lamp, cos, sin, reach) {
        if (p.hidden || p.swimming || p === player) return;
        if (Math.abs(p.x - lamp.x) > reach || Math.abs(p.y - lamp.z) > reach) return;
        const half = 0.28 * UNITS_PER_METRE;
        addBeamWedge(lamp, cos, sin, p.x, p.y, half, half, entityElevation(p) + PERSON_HEIGHT);
      }
      function updateBeamShadows() {
        const u = cityLightUniforms.cityBeamShadowOn;
        wedgeCount = 0;
        drawHorizonStrip();
        if (!carLampCount || carLampCars[0] !== player.car || (activeTier?.carLamps ?? 0) < 4 || carLampA[0].w <= 0) {
          u.value = 0;
          return;
        }
        const lamp = carLampA[0],
          cos = carLampB[0].x,
          sin = carLampB[0].y,
          reach = BEAM_SHADOW_LENGTH + 40;
        for (const p of pedestrians) addPersonWedge(p, lamp, cos, sin, reach);
        for (const p of renderPeople) addPersonWedge(p, lamp, cos, sin, reach);
        for (const c of vehicles) {
          if (c === player.car || c.hp <= 0 || isAircraft(c)) continue;
          if (Math.abs(c.x - lamp.x) > reach || Math.abs(c.y - lamp.z) > reach) continue;
          const spec = vehicleSpec(c);
          if (spec.boat || spec.jetski) continue;
          // The car's footprint seen along the ray from the lamps.
          const ray = Math.atan2(c.y - lamp.z, c.x - lamp.x),
            turn = c.a - ray,
            across = 0.5 * (Math.abs(spec.l * Math.sin(turn)) + Math.abs(spec.w * Math.cos(turn))),
            along = 0.5 * (Math.abs(spec.l * Math.cos(turn)) + Math.abs(spec.w * Math.sin(turn))),
            height = (spec.truck || c.type === 'bus' || c.type === 'van' ? 2.6 : spec.bike || spec.bicycle ? 1.4 : 1.45) * UNITS_PER_METRE;
          addBeamWedge(lamp, cos, sin, c.x, c.y, across * 0.9, along, entityElevation(c) + height);
        }
        beamShadowWedges.count = wedgeCount;
        u.value = wedgeCount ? 1 : 0;
        carLampStats.shadowWedges = wedgeCount;
        if (!wedgeCount) return;
        beamShadowWedges.instanceMatrix.needsUpdate = true;
        beamShadowWedges.instanceColor.needsUpdate = true;
        const previousTarget = renderer.getRenderTarget(),
          previousAlpha = renderer.getClearAlpha();
        renderer.getClearColor(driveClearColor);
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(beamShadowTarget);
        renderer.clear(true, false, false);
        renderer.render(beamShadowScene, beamShadowCamera);
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(driveClearColor, previousAlpha);
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
          hazeLevel: Math.round(hazeUniforms.uHaze.value * hazePeak * 1000) / 1000,
        };
      }
