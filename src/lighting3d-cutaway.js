      // Lighting 3D cutaway occluders (updateCutaway, setCharacterCutaway) and head, tail and strobe light beams.
      /* Occluders: buildings, and decks or roofs over the street (airCoverVolumes),
         that stand between the camera and the player, found by casting rays from
         the player's middle and head towards the camera through each one's box
         (grown by `margin`, so the hole opens just before the player is lost). */
      const occluderRay = { x: 0, y: 0, z: 0 };
      function rayHitsBox(px, py, pz, localX, localZ, hx, hz, bottom, top) {
        // Slab test in the box's own frame: px/pz and localX/localZ are the ray's
        // origin and direction already turned into it; y is shared.
        let near = 0.5,
          far = 1e9;
        const axes = [
          [px, localX, hx],
          [pz, localZ, hz],
        ];
        for (const [origin, direction, half] of axes) {
          if (Math.abs(direction) < 1e-6) {
            if (Math.abs(origin) > half) return false;
            continue;
          }
          let t0 = (-half - origin) / direction,
            t1 = (half - origin) / direction;
          if (t0 > t1) [t0, t1] = [t1, t0];
          near = Math.max(near, t0);
          far = Math.min(far, t1);
          if (near > far) return false;
        }
        // Height: the ray climbs, so it is inside the box's span between these.
        const dy = occluderRay.y;
        if (dy > 1e-6) {
          near = Math.max(near, (bottom - py) / dy);
          far = Math.min(far, (top - py) / dy);
        } else if (py < bottom || py > top) return false;
        return near < far;
      }
      function findOccluders(x, y, heights, margin, list) {
        const ray = occluderRay;
        if (camera.isPerspectiveCamera) {
          ray.x = camera.position.x - x;
          ray.y = camera.position.y - heights[0];
          ray.z = camera.position.z - y;
        } else {
          camera.getWorldDirection(cutawayEdge);
          ray.x = -cutawayEdge.x;
          ray.y = -cutawayEdge.y;
          ray.z = -cutawayEdge.z;
        }
        const length = Math.hypot(ray.x, ray.y, ray.z) || 1;
        ray.x /= length;
        ray.y /= length;
        ray.z /= length;
        if (ray.y < 0.05) return;
        // How far a ray can travel sideways before it clears the tallest roof.
        const reach = ((streetCeiling() - heights[0]) / ray.y) * Math.hypot(ray.x, ray.z) + margin;
        for (const o of allBuildings) {
          const b = o.b;
          if (o.height <= heights[0]) continue;
          if (b.x > x + reach || b.x + b.w < x - reach || b.y > y + reach || b.y + b.h < y - reach) continue;
          // The player inside this building is coversOver()'s case.
          if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) continue;
          const cx = b.x + b.w / 2,
            cy = b.y + b.h / 2;
          if (!heights.some((h) => rayHitsBox(x - cx, h, y - cy, ray.x, ray.z, b.w / 2 + margin, b.h / 2 + margin, -60, o.height))) continue;
          list.push({ x: cx, y: cy, hx: b.w / 2 + 2, hy: b.h / 2 + 2, a: 0, bottom: -60, top: o.height + 24, near: Math.hypot(cx - x, cy - y) });
        }
        for (const b of airCoverVolumes()) {
          if (b.height <= heights[0] || b.minHeight <= heights[0] + 4) continue;
          if (Math.abs(b.x - x) > reach + b.hx + b.hy || Math.abs(b.y - y) > reach + b.hx + b.hy) continue;
          const local = coverLocal(b, x, y),
            cos = b.cos ?? Math.cos(b.a),
            sin = b.sin ?? Math.sin(b.a),
            localX = ray.x * cos + ray.z * sin,
            localZ = -ray.x * sin + ray.z * cos;
          if (!heights.some((h) => rayHitsBox(local.x, h, local.y, localX, localZ, b.hx + margin, b.hy + margin, b.minHeight, b.height))) continue;
          list.push({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a, bottom: b.minHeight - 8, top: b.height + 2, near: Math.hypot(b.x - x, b.y - y) });
        }
        list.sort((p, q) => p.near - q.near);
      }
      const cutawayOccluders = [];
      function setCutBox(box, span, cover) {
        if (!cover) {
          box.set(0, 0, 0, 0);
          return;
        }
        box.set(cover.x, cover.y, cover.hx + 1, cover.hy + 1);
        span.set(Math.cos(cover.a || 0), Math.sin(cover.a || 0), cover.bottom, cover.top);
      }
      function updateCutaway(elevation) {
        const u = cityLightUniforms,
          car = player.car;
        u.cityCutaway.value.z = 0;
        // Never in the air, on or in the water, on the map, or when switched off.
        if (!characterCutaway || gameMode === 'map' || player.parachute || player.swimming || player.hidden) return;
        if (transitRide || taxiRide || (car && (isAircraft(car) || isBoat(car)))) return;
        const spec = car ? vehicleSpec(car) : null,
          bodyHeight = car ? (spec.truck ? 32 : 18) : PERSON_HEIGHT + 1,
          radius = car ? Math.hypot(spec.l, spec.w) / 2 + 6 : CUTAWAY_RADIUS_ON_FOOT,
          covers = coversOver(player.x, player.y, elevation + bodyHeight, elevation, car ? 0 : 3, !!car);
        // Anything standing between the camera and the player (a tower south of
        // them, a viaduct deck): only when no roof over them already takes both slots.
        cutawayOccluders.length = 0;
        if (covers.length < 2) {
          findOccluders(player.x, player.y, [elevation + bodyHeight * 0.45, elevation + bodyHeight], radius * 0.4, cutawayOccluders);
          for (const o of cutawayOccluders) if (covers.length < 2) covers.push(o);
        }
        if (!covers.length) return;
        setCutBox(u.cityCutBoxA.value, u.cityCutSpanA.value, covers[0]);
        setCutBox(u.cityCutBoxB.value, u.cityCutSpanB.value, covers[1]);
        sceneBufferSize(cutawaySize);
        const middle = elevation + bodyHeight * 0.5;
        cutawayPoint.set(player.x, middle, player.y).applyMatrix4(camera.matrixWorldInverse);
        const depth = -cutawayPoint.z;
        cutawayPoint.set(player.x, middle, player.y).project(camera);
        cutawayEdge.set(player.x + radius, middle, player.y).project(camera);
        const pixels = Math.hypot((cutawayEdge.x - cutawayPoint.x) * cutawaySize.x, (cutawayEdge.y - cutawayPoint.y) * cutawaySize.y) / 2;
        if (Math.abs(cutawayPoint.x) > 1.2 || Math.abs(cutawayPoint.y) > 1.2 || cutawayPoint.z > 1) return;
        u.cityCutaway.value.set(
          (cutawayPoint.x * 0.5 + 0.5) * cutawaySize.x,
          (cutawayPoint.y * 0.5 + 0.5) * cutawaySize.y,
          pixels,
          // Only what stands between the camera and the player.
          depth - (car ? spec.l * 0.3 : 4),
        );
      }
      function setCharacterCutaway(on) {
        characterCutaway = !!on;
      }
      Three.MeshStandardMaterial.prototype.onBeforeCompile = cityMaterialPatch;
      // Unlit materials that opted out of tone mapping (signs, ad panels, screens)
      // were designed as final screen colours: carry them through the HDR pipeline.
      if (hdrCapable) {
        Three.MeshBasicMaterial.prototype.onBeforeCompile = function (shader) {
          if (this.toneMapped) return;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n#include <city_hdr_pars>')
            .replace(
              '#include <colorspace_fragment>',
              '#include <colorspace_fragment>\ngl_FragColor.rgb = cityInverseTone( clamp( gl_FragColor.rgb, 0.0, 1.0 ) ) * 1.15;',
            );
        };
        Three.MeshBasicMaterial.prototype.customProgramCacheKey = function () {
          return this.toneMapped ? 'tone' : 'display';
        };
      }
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
      // ---- Time-of-day look ------------------------------------------------------------------
      const SKY_KEYS = {
        // [zenith, horizon, ground, glow] in scene-linear sRGB hex.
        day: ['#5b87bd', '#c4d2dc', '#5c5a52', '#ffe2b8'],
        dusk: ['#4a5a8a', '#f0a070', '#453c3a', '#ff9a50'],
        // A blue-hour night, brighter than a real one on purpose: the moonlit sky
        // is the ambient that keeps streets readable between the lamp pools.
        night: ['#43557a', '#5f6a88', '#2b2e37', '#463d5e'],
        overcast: ['#8a949e', '#b3b9bf', '#4a4d50', '#d0d0d0'],
      };
      const skyKeyColors = Object.fromEntries(
        Object.entries(SKY_KEYS).map(([k, list]) => [k, list.map((c) => new Three.Color(c))]),
      );
      // Lamp materials are declared after this file; their day colours are read on first use.
      let warmLampBase = null,
        tailLampBase = null,
        brakeLampBase = null;
      /**
       * NIGHT LOOK
       * A readable blue-hour night rather than an ink-black one: moonlight and a
       * cool sky fill strong enough that roads, buildings, people and cars read
       * everywhere, blacks lifted slightly towards blue, less contrast than by
       * day, and exposure opened up. Lamps, neon and headlights stay far brighter
       * than this ambient, so they still pop and pool. (No light follows the
       * player: they are lit like everyone else.)
       */
      const NIGHT_LOOK = {
        moon: 0.75, // added to the moon's (the sun light's) night intensity
        sky: 1.5, // added to the hemisphere sky fill
        exposure: 0.3, // extra exposure share at full night
        saturation: 0.2, // saturation lost at full night
        contrast: 0.08, // contrast lost at full night
        lampPower: 3.6, // street-lamp map strength
      };
      const gradeLiftNight = new Three.Vector3(0.012, 0.02, 0.036),
        gradeGainNight = new Three.Vector3(1.05, 1.0, 0.95),
        gradeLiftDusk = new Three.Vector3(0.0, 0.002, 0.006),
        gradeGainDusk = new Three.Vector3(1.1, 1.0, 0.86),
        gradeLiftDay = new Three.Vector3(0.0, 0.0, 0.003),
        gradeGainDay = new Three.Vector3(1.05, 1.0, 0.92);
      let lightingClock = performance.now();
      function updateLighting(deltaSeconds) {
        // The environment rebuild is throttled on the wall clock, not game time.
        const now = performance.now();
        envAge += (now - lightingClock) / 1000;
        lightingClock = now;
        updateSunPath();
        const light = daylight(),
          night = clamp(1 - light * 1.6, 0, 1),
          dusk = clamp(1 - Math.abs(light - 0.3) / 0.3, 0, 1),
          overcast = weather.cloud * weather.cloud,
          rain = weather.rain;
        // Sky colours: night -> day, dusk on top, grey as it clouds over.
        const k = skyKeyColors;
        for (let i = 0; i < 4; i++) {
          const target = [skyUniforms.uZenith, skyUniforms.uHorizon, skyUniforms.uGround, skyUniforms.uGlow][i].value;
          target.copy(k.night[i]).lerp(k.day[i], light).lerp(k.dusk[i], dusk * 0.75).lerp(k.overcast[i], overcast * 0.7 * light);
        }
        skyUniforms.uNight.value = night;
        skyUniforms.uStars.value = night * (1 - overcast);
        skyUniforms.uSunColor.value.copy(sun.color);
        refreshEnvironment(false);
        // The dome only exists for the flight camera.
        skyDome.visible = flightViewActive;
        if (skyDome.visible) {
          skyDome.position.copy(camera.position);
          skyDome.scale.setScalar(camera.far * 0.9);
        }
        // Sun glints on the water, cloud lighting and cloud shadows follow the real sun.
        waterUniforms.uSun.value.copy(sunDirection);
        SUN_DIRECTION.copy(sunDirection);
        marchUniforms.uSunDirection.value.copy(sunDirection);
        shadeUniforms.uSunDirection.value.copy(sunDirection);
        // Night light: lamp pools, and emissive lamp heads bright enough to bloom.
        cityLightUniforms.cityLampPower.value = night * NIGHT_LOOK.lampPower;
        cityLightUniforms.cityWet.value = weather.wet;
        const blackout = cityLightUniforms.cityZonePower.value;
        blackout.set(sideJobPower(100, 100), sideJobPower(100, 2000), sideJobPower(100, 3000));
        if (!warmLampBase) {
          warmLampBase = warmLamp.color.clone();
          tailLampBase = tailLamp.color.clone();
          brakeLampBase = brakeLamp.color.clone();
        }
        const lampsOn = vehicleLampAmount();
        warmLamp.color.copy(warmLampBase).multiplyScalar(1 + lampsOn * 3.5);
        tailLamp.color.copy(tailLampBase).multiplyScalar(1 + lampsOn * 2.5);
        brakeLamp.color.copy(brakeLampBase).multiplyScalar(3 + lampsOn * 3);
        updateHeadlightBeams();
        // Moonlight and sky light strong enough to read the streets by at night.
        sun.intensity += night * NIGHT_LOOK.moon;
        hemi.intensity += night * NIGHT_LOOK.sky;
        // Post look: exposure, bloom and grade (postfx3d.js).
        // A touch more exposure at night: legibility first, darkness second.
        postLook.exposure = renderer.toneMappingExposure * (1 + night * NIGHT_LOOK.exposure);
        postLook.bloomThreshold = 2.2 - night * 1.35 - dusk * 0.3;
        postLook.bloomStrength = 0.22 + night * 0.3 + dusk * 0.1;
        postLook.saturation = (1.16 + dusk * 0.06 - night * NIGHT_LOOK.saturation) * (1 - overcast * 0.14 - rain * 0.06);
        postLook.contrast = 1.14 + dusk * 0.02 - night * NIGHT_LOOK.contrast - overcast * 0.06;
        postLook.lift.copy(gradeLiftDay).lerp(gradeLiftDusk, dusk).lerp(gradeLiftNight, night);
        postLook.gain.copy(gradeGainDay).lerp(gradeGainDusk, dusk).lerp(gradeGainNight, night);
        if (rain > 0.05) {
          postLook.lift.lerp(gradeLiftNight, rain * 0.3);
          postLook.gain.lerp(gradeGainDay, rain * 0.5);
        }
        postLook.vignette = 0.2 + night * 0.06;
        // AO reads at street scale on the ground and grows with the view from the air.
        postLook.aoRadius = clamp(18 / Math.max(0.25, viewZoom), 18, 72);
        postLook.aoIntensity = 1.5;
        // Rain and lightning on top of the time of day (weather3d.js).
        weatherGrade();
      }
      /**
       * SHADOW CASTERS
       * A car or a person is two dozen small meshes, and every one of them was
       * drawn again into the shadow map. Seen from the street camera their shadow
       * is the body's: the lamps, trims, hands and gun models under it add
       * nothing but draw calls. New models keep shadows only on parts larger
       * than `minRadius` (world units, bounding-sphere radius).
       */
      const casterScale = new Three.Vector3();
      function trimShadowCasters(root, minRadius) {
        root.updateMatrixWorld(true);
        root.traverse((o) => {
          if (!o.isMesh || !o.castShadow || !o.geometry) return;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          o.getWorldScale(casterScale);
          const radius = o.geometry.boundingSphere.radius * Math.max(casterScale.x, casterScale.y, casterScale.z);
          if (radius < minRadius) o.castShadow = false;
        });
      }
      // ---- Contact shadows ---------------------------------------------------------------
      /**
       * CONTACT SHADOWS
       * With sun shadows off (quality.js SHADOWS: the LOW tier's default, or the
       * Settings choice), every car, pedestrian and figure in view sits on a soft
       * dark blob instead, so nothing floats over the street: one instanced draw
       * for all of them. Nothing is drawn while the shadow map is on.
       */
      const CONTACT_CAPACITY = 900,
        contactCanvas = document.createElement('canvas');
      contactCanvas.width = contactCanvas.height = 64;
      {
        const g = contactCanvas.getContext('2d'),
          grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.55, 'rgba(0,0,0,0.8)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      }
      const contactShadows = new Three.InstancedMesh(
        new Three.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new Three.MeshBasicMaterial({
          color: '#000000',
          map: new Three.CanvasTexture(contactCanvas),
          transparent: true,
          // Sunlit pavement sits high on the tone curve, where halving the light
          // only darkens it a little: the blob has to be strong to read by day.
          opacity: 0.82,
          depthWrite: false,
          fog: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -2,
        }),
        CONTACT_CAPACITY,
      );
      contactShadows.count = 0;
      contactShadows.visible = false;
      contactShadows.frustumCulled = false;
      contactShadows.renderOrder = 2;
      contactShadows.userData.dynamic = true;
      contactShadows.name = 'contact shadows';
      scene.add(contactShadows);
      const contactMatrix = new Three.Matrix4(),
        contactPosition = new Three.Vector3(),
        contactRotation = new Three.Quaternion(),
        contactScale = new Three.Vector3(),
        contactUp = new Three.Vector3(0, 1, 0);
      let contactCount = 0;
      function contactBlob(x, y, ground, length, width, angle) {
        if (contactCount >= CONTACT_CAPACITY) return;
        contactPosition.set(x, ground + 0.3, y);
        contactRotation.setFromAxisAngle(contactUp, -angle);
        contactScale.set(length, 1, width);
        contactShadows.setMatrixAt(contactCount++, contactMatrix.compose(contactPosition, contactRotation, contactScale));
      }
      // Called every frame from render(), once the people and vehicles are placed.
      function updateContactShadows() {
        contactCount = 0;
        if (!renderer.shadowMap.enabled) {
          for (const c of vehicles) {
            const spec = vehicleSpec(c);
            if (spec.boat || spec.jetski) continue;
            const ground = terrainHeight(c.x, c.y),
              aircraft = isAircraft(c);
            // Aircraft only on the ground.
            if (aircraft && (c.altitude ?? 0) - ground > 3) continue;
            if (!entityInView(c, Math.max(40, spec.l))) continue;
            const shrink = aircraft ? 0.8 : 1;
            contactBlob(c.x, c.y, aircraft ? ground : entityElevation(c), spec.l * 1.12 * shrink, spec.w * 1.35 * shrink, c.a || 0);
          }
          // People are only drawn this close in (render3d.js, crowd3d.js).
          if (flightViewActive ? viewZoom > PEOPLE_ZOOM : worldZoom > 0.22) {
            for (const p of pedestrians)
              if (!p.hidden && !p.swimming && entityInView(p, 20)) contactBlob(p.x, p.y, entityElevation(p), 10, 10, 0);
            for (const p of renderPeople) {
              if (p.hidden || p.swimming || p.parachute) continue;
              if (p === player && (player.car || transitRide || taxiRide)) continue;
              if (entityInView(p, 20)) contactBlob(p.x, p.y, entityElevation(p), 10, 10, 0);
            }
          }
        }
        contactShadows.count = contactCount;
        contactShadows.visible = contactCount > 0;
        if (contactCount) contactShadows.instanceMatrix.needsUpdate = true;
      }
      // ---- Quality tier ----------------------------------------------------------------------
      let activeTier = null;
      function applyRendererQuality(tier) {
        activeTier = tier;
        const ratio = Math.min(devicePixelRatio || 1, tier.pixelRatio);
        if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
        renderer.setSize(viewportWidth, viewportHeight);
        // Sun shadows (quality.js SHADOWS): off, a smaller map, or the tier's map.
        // Switching them on or off changes the lights' state, so three.js relinks
        // the lit programs once; a new size only reallocates the map.
        const mode = shadowQuality(),
          on = mode !== 'off',
          size = mode === 'low' ? Math.min(tier.shadowMap, 2048) : Math.max(2048, tier.shadowMap);
        renderer.shadowMap.enabled = on;
        if (sun.castShadow !== on) sun.castShadow = on;
        if (sun.shadow.mapSize.x !== size || (!on && sun.shadow.map)) {
          sun.shadow.mapSize.set(size, size);
          if (sun.shadow.map) {
            sun.shadow.map.dispose();
            sun.shadow.map = null;
          }
        }
        setPostQuality(tier);
        setSearchlightQuality(tier);
      }
