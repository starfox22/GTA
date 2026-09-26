      // Lighting 3D vehicle lights: the drive light map (head beams, tail washes, police strobes on the road).
      // ---- Vehicle lights ------------------------------------------------------------------
      /**
       * DRIVE LIGHT MAP
       * Each lit car throws its low beams down the road ahead and a red wash from
       * its tail lamps behind. Both are drawn every night frame, as instanced
       * quads seen from straight above, into a small HDR light map over the view
       * (cityDriveMap, texel-snapped so it does not crawl), and every lit material
       * adds that light like the street-lamp map (CITY_LIGHT_PARS): tarmac, kerbs,
       * the car ahead, pedestrians crossing and the wall at the end of the street
       * are lit through their own albedo, with the beam's falloff, instead of a
       * flat glow painted over the ground. The alpha channel keeps the highest
       * road level a beam lies on (max blending), so a beam lights what stands on
       * its own road and fades out a few metres above it. Two draw calls into a
       * 1024-texel target for all traffic; the player's car keeps its real
       * spotlight on top.
       */
      function beamTexture(width, paint) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = 128;
        paint(c.getContext('2d'), width);
        const t = new Three.CanvasTexture(c);
        t.colorSpace = Three.SRGBColorSpace;
        return t;
      }
      const headBeamTexture = beamTexture(256, (g, width) => {
        // Apex at the left edge (the bumper), spreading and fading to the right:
        // a bright zone a few metres ahead, then a long tail out to ~35 m.
        for (let x = 0; x < width; x++) {
          const u = x / (width - 1),
            half = 12 + u * 50,
            hot = 1 + 0.7 * Math.exp(-Math.pow((u - 0.22) / 0.16, 2)),
            fade = Math.min(1, Math.min(1, u * 14) * Math.pow(1 - u, 1.5) * hot * 0.62);
          const grad = g.createLinearGradient(0, 64 - half, 0, 64 + half);
          grad.addColorStop(0, 'rgba(255,240,218,0)');
          grad.addColorStop(0.25, `rgba(255,240,218,${fade * 0.45})`);
          grad.addColorStop(0.5, `rgba(255,240,218,${fade})`);
          grad.addColorStop(0.75, `rgba(255,240,218,${fade * 0.45})`);
          grad.addColorStop(1, 'rgba(255,240,218,0)');
          g.fillStyle = grad;
          g.fillRect(x, 64 - half, 1, half * 2);
        }
      });
      const tailGlowTexture = beamTexture(128, (g) => {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,44,28,0.9)');
        grad.addColorStop(0.4, 'rgba(255,44,28,0.35)');
        grad.addColorStop(1, 'rgba(255,44,28,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
      });
      // Police lights on the road: a soft white pool tinted per instance.
      const strobeGlowTexture = beamTexture(128, (g) => {
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
        // Scene light at the brightest point of a beam, before the surface's albedo.
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
      Object.assign(cityLightUniforms, {
        cityDriveMap: { value: driveTarget.texture },
        // (west x, south z, 1 / width, -1 / height) of the map in world units.
        cityDriveRect: { value: new Three.Vector4(0, 0, 0, 0) },
        cityDrivePower: { value: 0 },
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
      function updateHeadlightBeams() {
        let heads = 0,
          tails = 0,
          strobes = 0;
        // Lamps are on at night and in a downpour (weather3d.js); wet tarmac
        // brightens the beams.
        const night = vehicleLampAmount(),
          wetBoost = 1 + weather.wet * 0.35;
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
            if (!(c.ai || c === player.car)) continue;
            const spec = vehicleSpec(c);
            if (spec.boat || spec.jetski || spec.bicycle || c.type === 'bicycle') continue;
            // A beam reaches ~35 m past the bumper: lit cars just outside the frame
            // still light the street inside it.
            if (!entityInView(c, 200)) continue;
            const model = carModels.get(c),
              out = model?.lampOut || [],
              share = ((out[0] ? 0 : 1) + (out[2] ? 0 : 1)) / 2;
            const ground = entityElevation(c) + 0.35,
              cos = Math.cos(c.a),
              sin = Math.sin(c.a);
            beamQuaternion.setFromAxisAngle(headBeamUp, -c.a);
            if (share > 0) {
              beamPosition.set(c.x + cos * spec.l * 0.46, ground, c.y + sin * spec.l * 0.46);
              beamScale.set(spec.truck ? 200 : 178, 1, spec.truck ? 112 : 96);
              headBeams.setMatrixAt(heads, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
              headBeams.setColorAt(heads, beamColor.setScalar(night * share * wetBoost));
              heads++;
            }
            // Tail lamps: a red wash on the road just behind the bumper.
            beamPosition.set(c.x - cos * (spec.l * 0.5 + 16), ground, c.y - sin * (spec.l * 0.5 + 16));
            beamScale.set(26, 1, spec.w * 1.5);
            tailGlows.setMatrixAt(tails, beamMatrix.compose(beamPosition, beamQuaternion, beamScale));
            tailGlows.setColorAt(tails, beamColor.setScalar(night * (c.braking ? 0.75 : 0.32) * wetBoost));
            tails++;
          }
        headBeams.count = heads;
        tailGlows.count = tails;
        strobeGlows.count = strobes;
        const u = cityLightUniforms;
        u.cityDrivePower.value = heads + tails + strobes ? DRIVE_LIGHT_POWER : 0;
        if (!heads && !tails && !strobes) return;
        for (const m of [headBeams, tailGlows, strobeGlows])
          if (m.count) {
            m.instanceMatrix.needsUpdate = true;
            m.instanceColor.needsUpdate = true;
          }
        // The map covers the view and the reach of beams from just outside it.
        const half = Math.max(400, Math.min(viewReach + 220, 2600)),
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
