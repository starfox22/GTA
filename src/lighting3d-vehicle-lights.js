      // Lighting 3D vehicle lights: the nearest cars' low beams as real lights (CAR LAMPS), the drive light map and beam haze.
      // ---- Vehicle lights ------------------------------------------------------------------
      /**
       * CAR LAMPS
       * The player's car and the cars nearest the middle of the view (by tier:
       * quality.js `carLamps`, 1 on LOW up to 12 on ULTRA) light the world with
       * their low beams as real lights: every lit material (CITY_LIGHT_APPLY in
       * lighting3d-sky.js) evaluates the LOW BEAM pattern from each of them, by
       * distance, through its own BRDF. So the road shows the beam's shape (the
       * hot spot, the kerb-side throw, the cut-off), kerbs, walls, parked cars and
       * pedestrians facing a car are lit on the faces that face it, and wet tarmac
       * and car paint carry its glare. The lamps are two fixed-size uniform
       * arrays with a count: a car coming or going changes numbers, never a
       * shader. Nothing allocates per frame.
       *
       * DRIVE LIGHT MAP
       * Every other lit car throws the same beam, precomputed as the light it
       * lays on a level road (painted from lowBeamIntensity()), and every car a
       * red wash from its tail lamps (brighter while braking, white while
       * reversing), drawn every night frame as instanced quads seen from
       * straight above into a small HDR light map over the view (cityDriveMap,
       * texel-snapped so it does not crawl). Lit materials add that light like
       * the street-lamp map: through their own albedo, fading out a few metres
       * above the road the beam lies on (the alpha channel keeps the highest
       * road level, max blending). Three draw calls into a 1024-texel target for
       * all traffic.
       *
       * BEAM HAZE
       * In rain and mist the air in a beam glows: a soft additive sheet over each
       * CAR LAMPS beam (HIGH and ULTRA), drifting with the weather. The rain
       * streaks catch the beams too (weather3d.js).
       */
      function beamTexture(width, height, paint) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        paint(c.getContext('2d'), width, height);
        const t = new Three.CanvasTexture(c);
        t.colorSpace = Three.SRGBColorSpace;
        return t;
      }
      // The pattern's strength (hot-spot intensity x metres squared, in scene
      // light) and the soft cap on what one surface takes from one car.
      const CAR_LAMP_STRENGTH = 34000,
        CAR_LAMP_CAP = 5,
        // A nominal pair of lamps for the precomputed beam: height and half spacing (m).
        NOMINAL_LAMP_HEIGHT = 0.65,
        NOMINAL_LAMP_SPAN = 0.62,
        // The head beam quad: length ahead of the bumper and width (world units).
        HEAD_BEAM_LENGTH = 440,
        HEAD_BEAM_WIDTH = 280;
      // What a lit car's low beams lay on a level road, as CITY_LIGHT_APPLY would
      // light it (soft cap included), normalised to its peak: `headBeamPeak`.
      let headBeamPeak = 1;
      const headBeamTexture = beamTexture(256, 160, (g, width, height) => {
        const image = g.createImageData(width, height),
          values = new Float32Array(width * height),
          h = NOMINAL_LAMP_HEIGHT;
        let peak = 0;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            // Canvas top is the oncoming side (the quad's -z), bottom the kerb side.
            const f = (((x + 0.5) / width) * HEAD_BEAM_LENGTH) / UNITS_PER_METRE,
              s = (((y + 0.5) / height - 0.5) * HEAD_BEAM_WIDTH) / UNITS_PER_METRE,
              side = Math.sign(s) * Math.max(Math.abs(s) - NOMINAL_LAMP_SPAN, 0),
              d2 = f * f + side * side + h * h,
              ahead = Math.max(f, 0.05),
              near = Three.MathUtils.smoothstep(f * UNITS_PER_METRE, 6, 26),
              reach = 1 - Three.MathUtils.smoothstep(d2, 676, 3364),
              e = ((CAR_LAMP_STRENGTH * lowBeamIntensity(side / ahead, -h / ahead) * near * reach) / Math.max(d2, 0.3)) * (h / Math.sqrt(d2)),
              v = CAR_LAMP_CAP * (1 - Math.exp(-e / CAR_LAMP_CAP));
            values[y * width + x] = v;
            peak = Math.max(peak, v);
          }
        headBeamPeak = peak || 1;
        for (let i = 0; i < values.length; i++) {
          // sRGB-ish encoding: the texture is decoded back to linear light.
          const v = Math.pow(values[i] / headBeamPeak, 1 / 2.2) * 255;
          image.data[i * 4] = v;
          image.data[i * 4 + 1] = v * 0.97;
          image.data[i * 4 + 2] = v * 0.93;
          image.data[i * 4 + 3] = 255;
        }
        g.putImageData(image, 0, 0);
      });
      const tailGlowTexture = beamTexture(128, 128, (g) => {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,44,28,0.9)');
        grad.addColorStop(0.4, 'rgba(255,44,28,0.35)');
        grad.addColorStop(1, 'rgba(255,44,28,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
      });
      // Police lights and reversing lamps on the road: a soft white pool tinted per instance.
      const strobeGlowTexture = beamTexture(128, 128, (g) => {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0.85)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.3)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
      });
      const BEAM_CAPACITY = 160,
        STROBE_GLOW_CAPACITY = 64,
        DRIVE_MAP_SIZE = 1024,
        // Scene light at the brightest point of a tail wash or strobe pool, before the surface's albedo.
        DRIVE_LIGHT_POWER = 4.5,
        beamGeometry = new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0),
        driveScene = new Three.Scene(),
        driveCamera = new Three.OrthographicCamera(-1, 1, 1, -1, 1, 12000),
        driveTarget = new Three.WebGLRenderTarget(DRIVE_MAP_SIZE, DRIVE_MAP_SIZE, {
          type: hdrCapable ? Three.HalfFloatType : Three.UnsignedByteType,
          depthBuffer: false,
          minFilter: Three.LinearFilter,
          magFilter: Three.LinearFilter,
        });
      driveTarget.texture.generateMipmaps = false;
      // Looking straight down with north (-z) up the image, so the map's v runs
      // north from the rect's south edge (see cityDriveRect).
      driveCamera.up.set(0, 0, -1);
      const carLampA = Array.from({ length: CAR_LAMP_SLOTS }, () => new Three.Vector4()),
        carLampB = Array.from({ length: CAR_LAMP_SLOTS }, () => new Three.Vector4());
      Object.assign(cityLightUniforms, {
        cityDriveMap: { value: driveTarget.texture },
        // (west x, south z, 1 / width, -1 / height) of the map in world units.
        cityDriveRect: { value: new Three.Vector4(0, 0, 0, 0) },
        cityDrivePower: { value: 0 },
        cityCarLampA: { value: carLampA },
        cityCarLampB: { value: carLampB },
        cityCarLampCount: { value: 0 },
      });
      function beamPool(map) {
        const m = new Three.InstancedMesh(
          beamGeometry,
          new Three.ShaderMaterial({
            uniforms: { map: { value: map } },
            depthTest: false,
            depthWrite: false,
            blending: Three.CustomBlending,
            blendEquation: Three.AddEquation,
            blendSrc: Three.OneFactor,
            blendDst: Three.OneFactor,
            blendEquationAlpha: Three.MaxEquation,
            blendSrcAlpha: Three.OneFactor,
            blendDstAlpha: Three.OneFactor,
            vertexShader: `
              varying vec2 vUv;
              varying vec3 vStrength;
              varying float vLevel;
              void main() {
                vUv = uv;
                vStrength = instanceColor;
                vec4 world = modelMatrix * instanceMatrix * vec4( position, 1.0 );
                vLevel = world.y + ${DRIVE_LEVEL_OFFSET.toFixed(1)};
                gl_Position = projectionMatrix * viewMatrix * world;
              }`,
            fragmentShader: `
              uniform sampler2D map;
              varying vec2 vUv;
              varying vec3 vStrength;
              varying float vLevel;
              void main() {
                vec4 t = texture2D( map, vUv );
                vec3 light = t.rgb * t.a * vStrength;
                gl_FragColor = vec4( light, dot( light, vec3( 1.0 ) ) > 0.002 ? vLevel : 0.0 );
              }`,
          }),
          BEAM_CAPACITY,
        );
        m.count = 0;
        m.frustumCulled = false;
        m.setColorAt(0, new Three.Color());
        driveScene.add(m);
        return m;
      }
      const headBeams = beamPool(headBeamTexture),
        tailGlows = beamPool(tailGlowTexture),
        strobeGlows = beamPool(strobeGlowTexture),
        beamMatrix = new Three.Matrix4(),
        beamQuaternion = new Three.Quaternion(),
        beamPosition = new Three.Vector3(),
        beamScale = new Three.Vector3(),
        beamColor = new Three.Color(),
        headBeamUp = new Three.Vector3(0, 1, 0),
        driveClearColor = new Three.Color();
      // ---- Beam haze ------------------------------------------------------------------------
      const HAZE_CAPACITY = CAR_LAMP_SLOTS,
        hazeUniforms = { map: { value: headBeamTexture }, uTime: { value: 0 }, uHaze: { value: 0 } },
        beamHaze = new Three.InstancedMesh(
          beamGeometry,
          new Three.ShaderMaterial({
            uniforms: hazeUniforms,
            transparent: true,
            depthWrite: false,
            blending: Three.AdditiveBlending,
            vertexShader: `
              varying vec2 vUv;
              varying vec3 vStrength;
              varying vec2 vWorld;
              void main() {
                vUv = uv;
                vStrength = instanceColor;
                vec4 world = modelMatrix * instanceMatrix * vec4( position, 1.0 );
                vWorld = world.xz;
                gl_Position = projectionMatrix * viewMatrix * world;
              }`,
            fragmentShader: `
              uniform sampler2D map;
              uniform float uTime, uHaze;
              varying vec2 vUv;
              varying vec3 vStrength;
              varying vec2 vWorld;
              ${SURFACE_NOISE}
              void main() {
                // The air glows where the beam is strong, most near the lamps,
                // drifting in slow wisps.
                float beam = texture2D( map, vUv ).r;
                float wisp = cityNoise( vWorld * 0.018 + vec2( uTime * 0.21, uTime * 0.07 ) ) * 0.6
                           + cityNoise( vWorld * 0.05 - vec2( uTime * 0.13, uTime * 0.3 ) ) * 0.4;
                float along = 1.0 - smoothstep( 0.05, 0.9, vUv.x );
                float glow = sqrt( beam ) * ( 0.35 + 0.65 * along ) * ( 0.55 + 0.9 * wisp );
                gl_FragColor = vec4( vec3( 1.0, 0.94, 0.84 ) * vStrength * glow * uHaze, 1.0 );
              }`,
          }),
          HAZE_CAPACITY,
        );
      beamHaze.count = 0;
      beamHaze.visible = false;
      beamHaze.frustumCulled = false;
      beamHaze.renderOrder = 6;
      beamHaze.userData.dynamic = true;
      beamHaze.name = 'beam haze';
      beamHaze.setColorAt(0, new Three.Color());
      scene.add(beamHaze);
      // ---- Which cars light the world themselves ----------------------------------------------
      const carLampCars = new Array(CAR_LAMP_SLOTS).fill(null),
        carLampDistance = new Float32Array(CAR_LAMP_SLOTS),
        carLampStats = { slots: 0, analytic: 0, driveHeads: 0, tails: 0, reversing: 0, strobes: 0, haze: 0, shadowWedges: 0 };
      let carLampCount = 0;
      // How lit a car's low beams are (0 = off): driven road vehicles at night or in a downpour.
      function lowBeamShare(c, night) {
        if (night <= 0.2 || c.hp <= 0 || isAircraft(c)) return 0;
        if (!(c.ai || c === player.car || c.showLamps)) return 0;
        const spec = vehicleSpec(c);
        if (spec.boat || spec.jetski || spec.bicycle || c.type === 'bicycle') return 0;
        if (c === player.car) return headlightShare(c);
        const out = carModels.get(c)?.lampOut || [];
        return ((out[0] ? 0 : 1) + (out[2] ? 0 : 1)) / 2;
      }
      // The player's car first, then the lit cars nearest the middle of the view.
      function pickCarLamps(night, slots) {
        carLampCount = 0;
        if (slots <= 0) return;
        const cx = viewCenter.x,
          cz = viewCenter.y;
        if (player.car && lowBeamShare(player.car, night) > 0) {
          carLampCars[0] = player.car;
          carLampDistance[0] = -1;
          carLampCount = 1;
        }
        for (const c of vehicles) {
          if (c === player.car || lowBeamShare(c, night) <= 0) continue;
          const d = (c.x - cx) * (c.x - cx) + (c.y - cz) * (c.y - cz);
          if (carLampCount === slots && d >= carLampDistance[carLampCount - 1]) continue;
          // Beams reach ~50 m past the bumper: cars just outside the frame still light it.
          if (!entityInView(c, 260)) continue;
          // Insert, keeping the list sorted by distance (the player's -1 stays first).
          let i = carLampCount < slots ? carLampCount++ : carLampCount - 1;
          while (i > 0 && carLampDistance[i - 1] > d) {
            carLampCars[i] = carLampCars[i - 1];
            carLampDistance[i] = carLampDistance[i - 1];
            i--;
          }
          carLampCars[i] = c;
          carLampDistance[i] = d;
        }
        for (let i = carLampCount; i < CAR_LAMP_SLOTS; i++) carLampCars[i] = null;
      }
      function hasCarLamp(c) {
        for (let i = 0; i < carLampCount; i++) if (carLampCars[i] === c) return true;
        return false;
      }
      // Height of a vehicle's head lamps over the road (world units).
      function lampHeight(spec) {
        return (spec.truck ? 1.0 : spec.bike ? 0.8 : 0.65) * UNITS_PER_METRE;
      }
      // The reversing lamps' halo colour (render3d-frame.js, VEHICLE HALOS).
      const REVERSE_LAMP_TINT = new Three.Color('#eef2ff');
      // Signed road speed along the heading (negative while reversing).
      function forwardSpeed(c) {
        return c.vx !== undefined ? c.vx * Math.cos(c.a) + (c.vy || 0) * Math.sin(c.a) : c.speed || 0;
      }
      function updateHeadlightBeams() {
        let heads = 0,
          tails = 0,
          strobes = 0,
          reversing = 0;
        // Lamps are on at night and in a downpour (weather3d.js).
        const night = vehicleLampAmount(),
          wetBoost = 1 + weather.wet * 0.35,
          slots = lookSwitchState.carLamps ? Math.min(CAR_LAMP_SLOTS, activeTier?.carLamps ?? 4) : 0;
        pickCarLamps(night, slots);
        for (let i = 0; i < carLampCount; i++) {
          const c = carLampCars[i],
            spec = vehicleSpec(c),
            cos = Math.cos(c.a),
            sin = Math.sin(c.a),
            ground = entityElevation(c);
          carLampA[i].set(
            c.x + cos * spec.l * 0.5,
            ground + lampHeight(spec),
            c.y + sin * spec.l * 0.5,
            CAR_LAMP_STRENGTH * night * lowBeamShare(c, night),
          );
          carLampB[i].set(cos, sin, spec.bike ? 0 : spec.w * 0.36, lampHeight(spec));
        }
        cityLightUniforms.cityCarLampCount.value = carLampCount;
        if (night > 0.2)
          for (const c of vehicles) {
            if (heads >= BEAM_CAPACITY) break;
            if (c.hp <= 0 || isAircraft(c)) continue;
            // A flashing police car washes the road either side red and blue
            // (police3d.js), parked at a roadblock or not.
            const policeModel = c.cop || c.showLights ? carModels.get(c) : null;
            if (policeModel?.police && policeModel.group.visible && strobes < STROBE_GLOW_CAPACITY - 1)
              for (const side of [-1, 1]) {
                const level = policeRoadGlow(policeModel, side);
                if (level < 0.05) continue;
                const spec = vehicleSpec(c),
                  size = 110,
                  sin = Math.sin(c.a),
                  cos = Math.cos(c.a),
                  // Centre off the car's side, the quad's apex a half size back.
                  cx = c.x + side * -sin * spec.w * 1.9 - cos * size * 0.5,
                  cz = c.y + side * cos * spec.w * 1.9 - sin * size * 0.5,
                  strength = level * night * 0.11 * wetBoost;
                beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
                beamPosition.set(cx, entityElevation(c) + 0.35, cz);
                beamScale.set(size, 1, size);
                strobeGlows.setMatrixAt(strobes, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
                strobeGlows.setColorAt(strobes, side < 0 ? beamColor.setRGB(strength, strength * 0.07, strength * 0.05) : beamColor.setRGB(strength * 0.1, strength * 0.26, strength));
                strobes++;
              }
            if (!(c.ai || c === player.car || c.showLamps)) continue;
            const share = lowBeamShare(c, night),
              spec = vehicleSpec(c);
            if (spec.boat || spec.jetski || spec.bicycle || c.type === 'bicycle') continue;
            if (!entityInView(c, 260)) continue;
            const ground = entityElevation(c) + 0.35,
              cos = Math.cos(c.a),
              sin = Math.sin(c.a);
            beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
            // Cars with a CAR LAMPS slot light the world themselves.
            if (share > 0 && !hasCarLamp(c)) {
              const scale = spec.truck ? 1.15 : spec.bike ? 0.8 : 1;
              beamPosition.set(c.x + cos * spec.l * 0.5, ground, c.y + sin * spec.l * 0.5);
              beamScale.set(HEAD_BEAM_LENGTH * scale, 1, HEAD_BEAM_WIDTH * scale);
              headBeams.setMatrixAt(heads, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
              headBeams.setColorAt(heads, beamColor.setScalar((night * share * headBeamPeak) / DRIVE_LIGHT_POWER));
              heads++;
            }
            // Tail lamps: a red wash on the road just behind the bumper, spread
            // wider and brighter while braking.
            const braking = !!c.braking || c.showLamps === 'brake',
              back = spec.l * 0.5 + (braking ? 20 : 16);
            beamPosition.set(c.x - cos * back, ground, c.y - sin * back);
            beamScale.set(braking ? 36 : 26, 1, spec.w * (braking ? 1.9 : 1.5));
            tailGlows.setMatrixAt(tails, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
            tailGlows.setColorAt(tails, beamColor.setScalar(night * (braking ? 0.95 : 0.36) * wetBoost));
            tails++;
            // Reversing lamps: a white pool behind the car.
            if (forwardSpeed(c) < -6 && strobes < STROBE_GLOW_CAPACITY) {
              const behind = spec.l * 0.5 + 34,
                strength = 0.2 * night * wetBoost;
              beamPosition.set(c.x - cos * behind, ground, c.y - sin * behind);
              beamScale.set(52, 1, spec.w * 1.7);
              strobeGlows.setMatrixAt(strobes, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
              strobeGlows.setColorAt(strobes, beamColor.setRGB(strength * 0.95, strength * 0.97, strength));
              strobes++;
              reversing++;
            }
          }
        headBeams.count = heads;
        tailGlows.count = tails;
        strobeGlows.count = strobes;
        Object.assign(carLampStats, { slots, analytic: carLampCount, driveHeads: heads, tails, reversing, strobes: strobes - reversing });
        updateBeamHaze(night);
        carLampStats.shadowWedges = 0;
        updateBeamShadows();
        const u = cityLightUniforms;
        u.cityDrivePower.value = heads + tails + strobes ? DRIVE_LIGHT_POWER : 0;
        if (!heads && !tails && !strobes) return;
        for (const m of [headBeams, tailGlows, strobeGlows])
          if (m.count) {
            m.instanceMatrix.needsUpdate = true;
            m.instanceColor.needsUpdate = true;
          }
        // The map covers the view and the reach of beams from just outside it.
        const half = Math.max(400, Math.min(viewReach + 480, 2800)),
          texel = (2 * half) / DRIVE_MAP_SIZE,
          cx = Math.round(viewCenter.x / texel) * texel,
          cz = Math.round(viewCenter.y / texel) * texel;
        driveCamera.left = driveCamera.bottom = -half;
        driveCamera.right = driveCamera.top = half;
        driveCamera.position.set(cx, 6000, cz);
        driveCamera.lookAt(cx, 0, cz);
        driveCamera.updateProjectionMatrix();
        driveCamera.updateMatrixWorld();
        u.cityDriveRect.value.set(cx - half, cz + half, 1 / (2 * half), -1 / (2 * half));
        const previousTarget = renderer.getRenderTarget(),
          previousAlpha = renderer.getClearAlpha();
        renderer.getClearColor(driveClearColor);
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(driveTarget);
        renderer.clear(true, false, false);
        renderer.render(driveScene, driveCamera);
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(driveClearColor, previousAlpha);
      }
      // The haze sheets over the CAR LAMPS beams: rain, fog and a damp night.
      function updateBeamHaze(night) {
        const tier = activeTier,
          haze = night * clamp(weather.rain * 0.9 + weather.cloud * weather.cloud * 0.25 + weather.wet * 0.15, 0, 1);
        let n = 0;
        if (tier && tier.bloom >= 5 && haze > 0.03)
          for (let i = 0; i < carLampCount; i++) {
            const c = carLampCars[i],
              spec = vehicleSpec(c),
              cos = Math.cos(c.a),
              sin = Math.sin(c.a);
            beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
            beamPosition.set(c.x + cos * spec.l * 0.5, entityElevation(c) + lampHeight(spec) * 0.55, c.y + sin * spec.l * 0.5);
            beamScale.set(HEAD_BEAM_LENGTH * 0.8, 1, HEAD_BEAM_WIDTH * 0.7);
            beamHaze.setMatrixAt(n, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
            beamHaze.setColorAt(n, beamColor.setScalar(lowBeamShare(c, night)));
            n++;
          }
        beamHaze.count = n;
        beamHaze.visible = n > 0;
        carLampStats.haze = n;
        if (!n) return;
        hazeUniforms.uHaze.value = haze * 0.15;
        hazeUniforms.uTime.value = gameTime;
        beamHaze.instanceMatrix.needsUpdate = true;
        beamHaze.instanceColor.needsUpdate = true;
      }
      /**
       * BEAM SHADOWS
       * The player's own low beams (CAR LAMPS slot 0) are shadowed by the people
       * and cars standing in them: each is drawn, seen from straight above, as a
       * dark wedge running away from the lamps into a small mask laid along the
       * beam (x ahead, y to the kerb side), widening with distance and softening
       * as the two lamps' shadows part; its green channel keeps how high the
       * occluder's top stands above the lamps (as a tangent from the lamps), so
       * a wall behind a pedestrian is shadowed only below the line over their
       * head. Max blending, one instanced draw into a 512 x 384 target, MEDIUM
       * and up; lit materials read it for slot 0 only (cityBeamShade).
       */
      const BEAM_SHADOW_LENGTH = 440,
        BEAM_SHADOW_WIDTH = 360,
        BEAM_SHADOW_CAPACITY = 48,
        beamShadowTarget = new Three.WebGLRenderTarget(512, 384, {
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
            x: round(carLampA[i].x),
            z: round(carLampA[i].z),
            height: round(carLampB[i].w),
            strength: Math.round(carLampA[i].w),
          })),
          headBeamPeak: round(headBeamPeak),
          hazeLevel: round(hazeUniforms.uHaze.value * 100) / 100,
        };
      }
