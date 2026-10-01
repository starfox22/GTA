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
       * CAR LAMPS beam (HIGH and ULTRA), drifting with the weather; on the range
       * a little mountain air shows it on a clear night too. The rain streaks
       * catch the beams too (weather3d.js).
       *
       * ON SLOPES (terrain-headlights.js)
       * Every beam, quad and haze sheet is laid in its car's body frame
       * (headlightFrame: the pitch and roll the model sits at on the terrain),
       * from the lamps' real height (the club trucks' own lamps), so a climb,
       * a descent or a side slope is lit like a level road and the light lands
       * where the body aims it. A CAR LAMPS slot with terrain in reach reads its
       * TERRAIN HORIZON (no light through a hill, recomputed as the car moves, a
       * few a frame), kept in a strip of the BEAM SHADOWS texture; its haze thins
       * where the ground rises into the sheet and thickens where the beam leaves
       * the ground (over a crest). The player's club truck on the range also
       * lights its light bar or pods (LIGHT BAR: a wide flood, one more CAR LAMPS
       * slot on MEDIUM and up, taken from the farthest traffic). Console
       * `headlightAim()`, A/B `lookSwitches({ terrainBeams })`.
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
      // The pattern, its strength and reach, and what a surface takes from all
      // of them (VEHICLE LIGHT BUDGET): headlight-beam.js.
      // The head beam quad: length ahead of the bumper and width (world units).
      const HEAD_BEAM_LENGTH = 340,
        HEAD_BEAM_WIDTH = 220;
      // What a lit car's low beams lay on a level road before the budget's soft
      // cap (CITY_LIGHT_APPLY applies it to the map's summed light, as it does to
      // the CAR LAMPS), normalised to its peak: `headBeamPeak`.
      let headBeamPeak = 1;
      const headBeamTexture = beamTexture(256, 160, (g, width, height) => {
        const image = g.createImageData(width, height),
          values = new Float32Array(width * height);
        let peak = 0;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            // Canvas top is the oncoming side (the quad's -z), bottom the kerb side.
            const f = (((x + 0.5) / width) * HEAD_BEAM_LENGTH) / UNITS_PER_METRE,
              s = (((y + 0.5) / height - 0.5) * HEAD_BEAM_WIDTH) / UNITS_PER_METRE,
              v = lowBeamRoad(f, s);
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
      registerPrewarmPass(driveScene, driveCamera, driveTarget);
      const carLampA = Array.from({ length: CAR_LAMP_SLOTS }, () => new Three.Vector4()),
        carLampB = Array.from({ length: CAR_LAMP_SLOTS }, () => new Three.Vector4()),
        carLampC = Array.from({ length: CAR_LAMP_SLOTS }, () => new Three.Vector4(0, 0, 1, 0));
      Object.assign(cityLightUniforms, {
        cityDriveMap: { value: driveTarget.texture },
        // (west x, south z, 1 / width, -1 / height) of the map in world units.
        cityDriveRect: { value: new Three.Vector4(0, 0, 0, 0) },
        cityDrivePower: { value: 0 },
        cityCarLampA: { value: carLampA },
        cityCarLampB: { value: carLampB },
        cityCarLampC: { value: carLampC },
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
      // Each sheet lies in its car's body frame, 0.55 of the lamp height up; instanceColor:
      // strength, CAR LAMPS slot, 1 when the slot reads the TERRAIN HORIZON.
      const HAZE_CAPACITY = CAR_LAMP_SLOTS,
        // Air on the range on a clear night: a faint glow in every beam.
        MOUNTAIN_AIR = 0.5,
        hazeUniforms = {
          map: { value: headBeamTexture },
          uTime: { value: 0 },
          uHaze: { value: 0.15 },
          cityCarLampA: cityLightUniforms.cityCarLampA,
          cityCarLampB: cityLightUniforms.cityCarLampB,
          cityCarLampC: cityLightUniforms.cityCarLampC,
          cityCarLampCount: cityLightUniforms.cityCarLampCount,
          // The BEAM SHADOWS texture (its horizon strip), set once it exists.
          cityBeamShadow: { value: null },
        },
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
              varying vec3 vWorld;
              void main() {
                vUv = uv;
                vStrength = instanceColor;
                vec4 world = modelMatrix * instanceMatrix * vec4( position, 1.0 );
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
              }`,
            fragmentShader: `
              uniform sampler2D map;
              uniform float uTime, uHaze;
              uniform vec4 cityCarLampA[ ${CAR_LAMP_SLOTS} ];
              uniform vec4 cityCarLampB[ ${CAR_LAMP_SLOTS} ];
              uniform vec4 cityCarLampC[ ${CAR_LAMP_SLOTS} ];
              uniform float cityCarLampCount;
              uniform sampler2D cityBeamShadow;
              varying vec2 vUv;
              varying vec3 vStrength;
              varying vec3 vWorld;
              ${SURFACE_NOISE}
              ${CITY_LOW_BEAM}
              ${CITY_LAMP_FRAME}
              // The share of a low beam's light in the air from its axis down to a
              // tangent below it (the LOW BEAM pattern's vertical profile, integrated).
              float beamColumn( float down ) {
                return down < 0.02 ? down : 0.02 + ( 1.0 - pow( down * 50.0, -1.3 ) ) / 65.0;
              }
              void main() {
                // The air glows where the beam is strong, most near the lamps,
                // drifting in slow wisps.
                float beam = texture2D( map, vUv ).r;
                float wisp = cityNoise( vWorld.xz * 0.018 + vec2( uTime * 0.21, uTime * 0.07 ) ) * 0.6
                           + cityNoise( vWorld.xz * 0.05 - vec2( uTime * 0.13, uTime * 0.3 ) ) * 0.4;
                float along = 1.0 - smoothstep( 0.05, 0.9, vUv.x );
                // (Mostly in the first metres of the cone: a sheet as bright to
                // its far end laid a grey veil over a wet junction.)
                float glow = 0.6 * sqrt( beam ) * ( 0.2 + 0.8 * along * along ) * ( 0.55 + 0.9 * wisp );
                if ( vStrength.b > 0.5 ) {
                  // On the range the air is lit as the beam lights it, not as the
                  // road under it is: a fan from the lamps (the pattern just under
                  // the cut-off) fading with distance, times the lit air under the
                  // sheet, which reaches down to the ground or, past a crest, to the
                  // line the beam grazes over it. None where the ground rises into
                  // the sheet (no seam where it meets a slope); a full column where
                  // the beam leaves the ground and lifts off into the night.
                  int slot = int( vStrength.g + 0.5 );
                  vec4 lampA = cityCarLampA[ slot ], lampB = cityCarLampB[ slot ], lampC = cityCarLampC[ slot ];
                  vec3 aim, kerb;
                  cityLampFrame( lampB, lampC, aim, kerb );
                  vec3 d = vWorld - lampA.xyz;
                  float ahead = max( dot( d, aim ), 2.0 );
                  float across = dot( d, kerb );
                  float t = sign( across ) * max( abs( across ) - lampB.z, 0.0 ) / ahead;
                  float fan = lampC.w > 1.5 ? cityFloodBeam( t, -0.025 ) : cityLowBeam( t, -0.02 );
                  vec2 horizon = cityHorizonAt( vStrength.g, d, lampB.xy );
                  float below = d.y - max( horizon.y, horizon.x * length( d.xz ) );
                  float metres = ahead * 0.125;
                  float edge = ( 1.0 - smoothstep( 0.55, 1.0, vUv.x ) ) * smoothstep( 0.0, 0.2, min( vUv.y, 1.0 - vUv.y ) );
                  glow = 1.6 * fan * beamColumn( max( below, 0.0 ) / ahead ) / 0.035 * smoothstep( 0.0, 1.5, metres ) / ( 1.0 + metres * 0.12 )
                       * ( 0.55 + 0.9 * wisp ) * edge;
                }
                // Sheets overlap where cars meet (a junction, a queue): every sheet
                // over this point takes the same share, so the air in N crossing
                // beams glows up to ~1.5 of one, not N stacked to a white fog.
                float cover = 0.0;
                for ( int j = 0; j < ${CAR_LAMP_SLOTS}; j ++ ) {
                  if ( float( j ) >= cityCarLampCount ) break;
                  vec2 d = vWorld.xz - cityCarLampA[ j ].xz;
                  vec2 heading = cityCarLampB[ j ].xy;
                  float ahead = dot( d, heading );
                  if ( ahead < 2.0 || ahead > 350.0 ) continue;
                  float across = abs( dot( d, vec2( -heading.y, heading.x ) ) );
                  cover += max( 1.0 - across / ( ahead * 0.7 + 20.0 ), 0.0 ) * ( 1.0 - ahead / 350.0 );
                }
                glow /= 1.0 + max( cover - 1.0, 0.0 ) * 0.6;
                gl_FragColor = vec4( vec3( 1.0, 0.94, 0.84 ) * vStrength.r * glow * uHaze, 1.0 );
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
        // A slot lit by the car's light bar rather than its low beams (LIGHT BAR).
        carLampFlood = new Array(CAR_LAMP_SLOTS).fill(false),
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
          carLampFlood[0] = false;
          carLampDistance[0] = -1;
          carLampCount = 1;
          if (slots >= 4 && lightBarLit(player.car)) {
            carLampCars[1] = player.car;
            carLampFlood[1] = true;
            carLampDistance[1] = -1;
            carLampCount = 2;
          }
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
            carLampFlood[i] = carLampFlood[i - 1];
            carLampDistance[i] = carLampDistance[i - 1];
            i--;
          }
          carLampCars[i] = c;
          carLampFlood[i] = false;
          carLampDistance[i] = d;
        }
        for (let i = carLampCount; i < CAR_LAMP_SLOTS; i++) carLampCars[i] = null;
      }
      function hasCarLamp(c) {
        for (let i = 0; i < carLampCount; i++) if (carLampCars[i] === c) return true;
        return false;
      }
      // ---- Lamps on slopes (terrain-headlights.js) -----------------------------------------------
      // The lamps on a car's own model, unposed (world units from its centre): the club
      // trucks' head lamps (built at real size, up to 1.35 m up), else null (the class
      // default, headlampHeight). Cached on the model.
      function modelLampMount(c) {
        const m = carModels.get(c);
        if (!m?.offroad || !m.nightLights?.[2]) return null;
        if (!m.beamMount) {
          // Halos 0 and 2 are the head lamps, half a unit ahead of the lenses.
          const a = m.nightLights[0].position,
            b = m.nightLights[2].position;
          m.beamMount = { fwd: (a.x + b.x) / 2 - 0.5, height: (a.y + b.y) / 2, span: Math.abs(a.z - b.z) / 2 };
        }
        return m.beamMount;
      }
      /**
       * LIGHT BAR
       * The club trucks carry a roof light bar or driving pods (offroad3d-kits.js,
       * their halos glow at night). On the range the player's truck lights them
       * as one more CAR LAMPS slot: a wide level flood from the highest lamps
       * (cityFloodBeam), a share of a low beam's strength, reaching the trees
       * and rock faces round a bend. MEDIUM and up; the tier's slot count stays
       * the same (the farthest traffic car drops to the drive map).
       */
      const LIGHT_BAR_SHARE = 0.4;
      function lightBarMount(c) {
        const m = carModels.get(c);
        if (!m?.offroad || !m.extraHalos?.length) return null;
        if (!m.barMount) {
          let top = -Infinity,
            x = 0,
            n = 0,
            zMin = Infinity,
            zMax = -Infinity;
          for (const sprite of m.extraHalos) top = Math.max(top, sprite.position.y);
          for (const sprite of m.extraHalos)
            if (sprite.position.y > top - 2) {
              x += sprite.position.x;
              n++;
              zMin = Math.min(zMin, sprite.position.z);
              zMax = Math.max(zMax, sprite.position.z);
            }
          m.barMount = { fwd: x / n - 0.9, height: top, span: (zMax - zMin) / 2 };
        }
        return m.barMount;
      }
      function lightBarLit(c) {
        return lookSwitchState.terrainBeams && lookSwitchState.lightBar && !!c.offroadState && c.hp > 0 && !!lightBarMount(c);
      }
      // Slot frames (headlightFrame), a scratch one for the drive map, and the TERRAIN
      // HORIZON strip: each slot's table side by side in a float texture, copied into the
      // BEAM SHADOWS target under the mask (CAR LAMP FRAME, lighting3d-sky.js).
      const slotFrames = Array.from({ length: CAR_LAMP_SLOTS }, newHeadlightFrame),
        driveFrame = newHeadlightFrame(),
        HORIZON_STRIP_WIDTH = HEADLIGHT_HORIZON.angles * CAR_LAMP_SLOTS,
        horizonData = new Float32Array(HORIZON_STRIP_WIDTH * HEADLIGHT_HORIZON.rows * 2),
        horizonTexture = new Three.DataTexture(horizonData, HORIZON_STRIP_WIDTH, HEADLIGHT_HORIZON.rows, Three.RGFormat, Three.FloatType),
        horizonTable = new Float32Array(HEADLIGHT_HORIZON_SIZE),
        // What each slot's table was made for, and whether it has terrain in reach.
        horizonKeys = Array.from({ length: CAR_LAMP_SLOTS }, () => ({ car: null, flood: false, x: 0, y: 0, z: 0, a: 0, on: false })),
        // Tables recomputed a frame for cars that kept their slot (new ones always are).
        HORIZON_REFRESHES = 6;
      horizonTexture.minFilter = horizonTexture.magFilter = Three.NearestFilter;
      horizonTexture.generateMipmaps = false;
      let horizonDirty = false,
        horizonRefreshed = 0,
        horizonComputed = 0;
      function slotHorizon(i, c, flood, frame) {
        // The strip is kept in the float target only (hdrCapable).
        if (!hdrCapable) return false;
        const key = horizonKeys[i],
          same = key.car === c && key.flood === flood;
        if (
          same &&
          Math.abs(key.x - frame.x) + Math.abs(key.y - frame.y) < 4 &&
          Math.abs(key.z - frame.z) < 1.5 &&
          Math.abs(normalizeAngle(key.a - frame.heading)) < 0.015
        )
          return key.on;
        if (same && horizonRefreshed >= HORIZON_REFRESHES) return key.on;
        horizonRefreshed++;
        key.car = c;
        key.flood = flood;
        key.x = frame.x;
        key.y = frame.y;
        key.z = frame.z;
        key.a = frame.heading;
        key.on = headlightHorizon(frame, horizonTable);
        if (key.on) {
          const { angles, rows } = HEADLIGHT_HORIZON;
          for (let k = 0; k < rows; k++)
            for (let j = 0; j < angles * 2; j++) horizonData[(k * HORIZON_STRIP_WIDTH + i * angles) * 2 + j] = horizonTable[k * angles * 2 + j];
          horizonDirty = true;
          horizonComputed++;
        }
        return key.on;
      }
      // A beam quad or haze sheet laid in car c's body frame `f`: `along` its heading
      // and `lift` up the body from the ground under its centre, `length` x `width`.
      function setBodyMatrix(matrix, c, f, along, lift, length, width) {
        const F = f.forward,
          U = f.up,
          R = f.right,
          e = matrix.elements,
          ground = entityElevation(c);
        e[0] = F.x * length;
        e[1] = F.z * length;
        e[2] = F.y * length;
        e[4] = U.x;
        e[5] = U.z;
        e[6] = U.y;
        e[8] = R.x * width;
        e[9] = R.z * width;
        e[10] = R.y * width;
        e[3] = e[7] = e[11] = 0;
        e[12] = c.x + F.x * along + U.x * lift;
        e[13] = ground + F.z * along + U.z * lift;
        e[14] = c.y + F.y * along + U.y * lift;
        e[15] = 1;
        return matrix;
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
        // Lamps are on at night and in a downpour (weather3d.js); A/B
        // lookSwitches({ vehicleLights: false }) puts every vehicle's light out.
        const night = lookSwitchState.vehicleLights ? vehicleLampAmount() : 0,
          wetBoost = 1 + weather.wet * 0.35,
          slots = lookSwitchState.carLamps ? Math.min(CAR_LAMP_SLOTS, activeTier?.carLamps ?? 4) : 0;
        pickCarLamps(night, slots);
        const terrainOn = lookSwitchState.terrainBeams;
        horizonRefreshed = 0;
        horizonComputed = 0;
        for (let i = 0; i < carLampCount; i++) {
          const c = carLampCars[i],
            flood = carLampFlood[i],
            spec = vehicleSpec(c),
            mount = flood ? lightBarMount(c) : modelLampMount(c),
            f = headlightFrame(c, slotFrames[i], mount, !terrainOn),
            horizon = terrainOn && slotHorizon(i, c, flood, f);
          carLampA[i].set(f.x, f.z, f.y, CAR_LAMP_STRENGTH * night * lowBeamShare(c, night) * (flood ? LIGHT_BAR_SHARE : 1));
          carLampB[i].set(Math.cos(c.a), Math.sin(c.a), spec.bike ? 0 : mount ? mount.span : spec.w * 0.36, f.height);
          carLampC[i].set(f.sinPitch, f.sinRoll, f.cosRoll, (horizon ? 1 : 0) + (flood ? 2 : 0));
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
            // Laid in the body frame: on a slope the quads tilt with the car, so the
            // map's road level (alpha) follows the grade under and ahead of it.
            const f = headlightFrame(c, driveFrame, null, !terrainOn);
            // Cars with a CAR LAMPS slot light the world themselves.
            if (share > 0 && !hasCarLamp(c)) {
              const scale = spec.truck ? 1.15 : spec.bike ? 0.8 : 1;
              setBodyMatrix(beamMatrix, c, f, spec.l * 0.5, 0.35, HEAD_BEAM_LENGTH * scale, HEAD_BEAM_WIDTH * scale);
              headBeams.setMatrixAt(heads, beamMatrix);
              headBeams.setColorAt(heads, beamColor.setScalar((night * share * headBeamPeak) / DRIVE_LIGHT_POWER));
              heads++;
            }
            // Tail lamps: a red wash on the road just behind the bumper, spread
            // wider and brighter while braking.
            const braking = !!c.braking || c.showLamps === 'brake',
              back = spec.l * 0.5 + (braking ? 20 : 16);
            setBodyMatrix(beamMatrix, c, f, -back, 0.35, braking ? 36 : 26, spec.w * (braking ? 1.9 : 1.5));
            tailGlows.setMatrixAt(tails, beamMatrix);
            tailGlows.setColorAt(tails, beamColor.setScalar(night * (braking ? 0.95 : 0.36) * wetBoost));
            tails++;
            // Reversing lamps: a white pool behind the car.
            if (forwardSpeed(c) < -6 && strobes < STROBE_GLOW_CAPACITY) {
              const behind = spec.l * 0.5 + 34,
                strength = 0.2 * night * wetBoost;
              setBodyMatrix(beamMatrix, c, f, -behind, 0.35, 52, spec.w * 1.7);
              strobeGlows.setMatrixAt(strobes, beamMatrix);
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
      // The haze sheets over the CAR LAMPS beams: rain, fog and a damp night, and the
      // mountain air round a slot that reads the terrain horizon (on the range).
      let hazePeak = 0;
      function updateBeamHaze(night) {
        const tier = activeTier,
          haze = clamp(weather.rain * 0.9 + weather.cloud * weather.cloud * 0.25 + weather.wet * 0.15, 0, 1);
        let n = 0;
        hazePeak = 0;
        if (tier && tier.bloom >= 5)
          for (let i = 0; i < carLampCount; i++) {
            const onRange = carLampC[i].w % 2 > 0.5,
              level = night * clamp(haze + (onRange ? MOUNTAIN_AIR : 0), 0, 1);
            if (level <= 0.03) continue;
            const c = carLampCars[i],
              f = slotFrames[i],
              share = carLampFlood[i] ? LIGHT_BAR_SHARE : 1;
            setBodyMatrix(beamMatrix, c, f, f.fwd, f.height * 0.55, HEAD_BEAM_LENGTH * 0.8, HEAD_BEAM_WIDTH * 0.7);
            beamHaze.setMatrixAt(n, beamMatrix);
            beamHaze.setColorAt(n, beamColor.setRGB(lowBeamShare(c, night) * share * level, i, onRange ? 1 : 0));
            hazePeak = Math.max(hazePeak, level);
            n++;
          }
        beamHaze.count = n;
        beamHaze.visible = n > 0;
        carLampStats.haze = n;
        if (!n) return;
        hazeUniforms.uTime.value = gameTime;
        beamHaze.instanceMatrix.needsUpdate = true;
        beamHaze.instanceColor.needsUpdate = true;
      }
