      // Rain at street level (the chase view): a dense near field of short streaks round the camera, the side
      // view's fall speed, streak length and slant for both boxes of rain, and the splashes ahead of the camera.
      /**
       * STREET RAIN
       * The rain box (weather3d.js) was made for a camera looking down on the street: 1,500 units across,
       * drops falling at 120-200 m/s so they cross the frame, streaks 2-6 m long. Seen from the side at
       * eye level that read as a few long lines in a big empty box. While the chase view draws:
       *  - a second box of short streaks (RAIN_NEAR_*) stands round the camera, a little ahead of it,
       *    as dense as the tier allows; it runs the rain material's own shader (one program), lit by the
       *    lamps and the CAR LAMPS through RAIN_LAMP_GLSL as the other drops are;
       *  - both boxes fall at the side view's speed (RAIN_SIDE_FALL) with streaks as long as a film
       *    frame's exposure of that fall, slanting with the wind at the same angle as from above;
       *  - no drop comes closer to the lens than RAIN_LENS_CLEAR (uNear in the shader): nearer it would be
       *    a line the height of the frame;
       *  - the splashes gather within RAIN_SPLASH_REACH ahead of the camera, a third of their street size,
       *    and half of them stand up as crowns facing the camera (a flat ring is a sliver from the side).
       * The street view and the air keep the old numbers (uNear.w 0, uSize 1, uUpright 0).
       */
      const RAIN_NEAR_MAX = 2600,
        RAIN_NEAR_BOX = 240,
        RAIN_NEAR_TOP = 170,
        // The near box's centre ahead of the camera, and the splashes' (units).
        RAIN_NEAR_AHEAD = 95,
        RAIN_SPLASH_AHEAD = 150,
        RAIN_SPLASH_REACH = 170,
        // Drops by tier in the near box (times the rain's strength, as the street box's are).
        RAIN_NEAR_TIER = { LOW: 700, MEDIUM: 1300, HIGH: 2000, ULTRA: 2600 },
        // The side view's fall (units a second at no rain and the extra in a downpour) and the exposure
        // that sets the streak length (seconds).
        RAIN_SIDE_FALL = 210,
        RAIN_SIDE_FALL_HEAVY = 110,
        RAIN_SIDE_EXPOSURE = 0.034,
        RAIN_LENS_CLEAR = 9;
      const rainNearGeometry = new Three.BufferGeometry();
      {
        const drop = new Float32Array(RAIN_NEAR_MAX * 2 * 4),
          end = new Float32Array(RAIN_NEAR_MAX * 2);
        for (let i = 0; i < RAIN_NEAR_MAX; i++) {
          const x = Math.random() - 0.5,
            z = Math.random() - 0.5,
            phase = Math.random(),
            // Fewer faint drops than the street box: everything here is close.
            depth = 0.25 + 0.75 * Math.pow(Math.random(), 1.2);
          drop.set([x, z, phase, depth, x, z, phase, depth], i * 8);
          end[i * 2 + 1] = 1;
        }
        rainNearGeometry.setAttribute('position', new Three.BufferAttribute(new Float32Array(RAIN_NEAR_MAX * 2 * 3), 3));
        rainNearGeometry.setAttribute('aDrop', new Three.BufferAttribute(drop, 4));
        rainNearGeometry.setAttribute('aEnd', new Three.BufferAttribute(end, 1));
        rainNearGeometry.setDrawRange(0, 0);
      }
      // The street box's shader with uniforms of its own (the clock, the sky's light, the flash and the lamps shared).
      const rainNearUniforms = {
        uOrigin: { value: new Three.Vector3() },
        uTime: rainUniforms.uTime,
        uFall: { value: RAIN_SIDE_FALL },
        uTop: { value: RAIN_NEAR_TOP },
        uBox: { value: RAIN_NEAR_BOX },
        uLength: { value: 8 },
        uWind: { value: new Three.Vector2() },
        uOpacity: { value: 0 },
        uAmbient: rainUniforms.uAmbient,
        uFlash: rainUniforms.uFlash,
        uNear: { value: new Three.Vector4() },
      };
      const rainNearMaterial = new Three.ShaderMaterial({
        uniforms: { ...rainNearUniforms, ...RAIN_LAMP_UNIFORMS },
        vertexShader: rainMaterial.vertexShader,
        fragmentShader: rainMaterial.fragmentShader,
        transparent: true,
        depthWrite: false,
      });
      const rainNearMesh = new Three.LineSegments(rainNearGeometry, rainNearMaterial);
      rainNearMesh.frustumCulled = false;
      rainNearMesh.visible = false;
      rainNearMesh.renderOrder = 7;
      rainNearMesh.name = 'rain near the camera';
      scene.add(rainNearMesh);
      /* After the street box and the splashes are set for the frame (updateWeatherVisuals): in the chase
         view, the side view's numbers and the near box; anywhere else, the old ones. */
      function updateStreetRain(rain, ground, street, tier) {
        const street3d = chaseViewActive && rainMesh.visible;
        rainNearMesh.visible = street3d;
        rainUniforms.uNear.value.w = 0;
        splashUniforms.uSize.value = 1;
        splashUniforms.uUpright.value = 0;
        if (!street3d) return;
        const cos = Math.cos(chaseCam.viewYaw),
          sin = Math.sin(chaseCam.viewYaw),
          fall = RAIN_SIDE_FALL + RAIN_SIDE_FALL_HEAVY * rain,
          // The street box's slant, kept at the same angle at the slower fall.
          windScale = fall / Math.max(1, rainUniforms.uFall.value),
          length = fall * RAIN_SIDE_EXPOSURE;
        rainUniforms.uWind.value.multiplyScalar(windScale);
        rainUniforms.uFall.value = fall;
        rainUniforms.uLength.value = length;
        rainUniforms.uNear.value.set(chaseCam.x, chaseCam.z, chaseCam.y, RAIN_LENS_CLEAR);
        const drops = Math.round((touchEnabled() ? Math.min(RAIN_NEAR_TIER[tier.name] || 1300, 900) : RAIN_NEAR_TIER[tier.name] || 1300) * clamp(0.25 + rain, 0, 1));
        rainNearGeometry.setDrawRange(0, Math.min(RAIN_NEAR_MAX, drops) * 2);
        rainNearUniforms.uOrigin.value.set(chaseCam.x + cos * RAIN_NEAR_AHEAD, ground, chaseCam.y + sin * RAIN_NEAR_AHEAD);
        rainNearUniforms.uFall.value = fall;
        rainNearUniforms.uLength.value = length;
        rainNearUniforms.uWind.value.copy(rainUniforms.uWind.value);
        rainNearUniforms.uOpacity.value = clamp(rain * 0.6 + 0.16, 0, 0.75);
        rainNearUniforms.uNear.value.copy(rainUniforms.uNear.value);
        // Splashes ahead of the camera, small, half of them crowns.
        if (splashMesh.visible) {
          splashUniforms.uOrigin.value.set(chaseCam.x + cos * RAIN_SPLASH_AHEAD, street, chaseCam.y + sin * RAIN_SPLASH_AHEAD);
          splashUniforms.uReach.value = RAIN_SPLASH_REACH;
          splashUniforms.uSize.value = 0.36;
          splashUniforms.uUpright.value = 1;
        }
      }
      /**
       * CHASE RAIN AIR
       * The air in a downpour seen along the street: the chase haze and the sky dome share one colour
       * (cityHazeColor, aerial-haze3d.js), and from the street view's sky keys a rainy night's was the
       * blue-hour sky's, which the thicker haze laid over the distance as a pale lilac veil. After the
       * time of day has set it (weatherGrade, after updateHaze and the environment's refresh, so the
       * environment's light is untouched) the haze and the dome over it are darkened by the rain, more
       * at night (no moon behind the cloud) than by day. The street view never reads these colours.
       */
      const CHASE_RAIN_DARK_DAY = 0.32,
        CHASE_RAIN_DARK_NIGHT = 0.5,
        CHASE_RAIN_HAZE_COLOURS = [CITY_HAZE.cityHazeSky.value, CITY_HAZE.cityHazeGlow.value, CITY_HAZE.cityHazeTop.value, CITY_HAZE.cityHazeHalo.value];
      function chaseRainAir() {
        if (!chaseViewActive) return;
        const wetAir = clamp(weather.rain * 1.1 + weather.approach * 0.25, 0, 1);
        if (wetAir < 0.005) return;
        const keep = 1 - wetAir * (CHASE_RAIN_DARK_DAY + (CHASE_RAIN_DARK_NIGHT - CHASE_RAIN_DARK_DAY) * nightAmount);
        for (let i = 0; i < CHASE_RAIN_HAZE_COLOURS.length; i++) {
          const u = CHASE_RAIN_HAZE_COLOURS[i];
          u[0] *= keep;
          u[1] *= keep;
          u[2] *= keep;
        }
      }
      /* DeadEndCity.rainView(): what the rain and the wet street draw now (render3d-api.js rainView). */
      function rainViewReport() {
        const r = (v, d = 2) => +(+v).toFixed(d),
          m = (units) => r(units / UNITS_PER_METRE, 1),
          near = rainNearUniforms,
          street = ssrUniforms.uStreet.value;
        return {
          street: rainNearMesh.visible,
          rain: { shown: rainMesh.visible, drops: rainGeometry.drawRange.count / 2, fallMetres: m(rainUniforms.uFall.value), streakMetres: m(rainUniforms.uLength.value), opacity: r(rainUniforms.uOpacity.value), lensClearMetres: m(rainUniforms.uNear.value.w) },
          near: { drops: rainNearMesh.visible ? rainNearGeometry.drawRange.count / 2 : 0, boxMetres: m(RAIN_NEAR_BOX), fallMetres: m(near.uFall.value), streakMetres: m(near.uLength.value), opacity: r(near.uOpacity.value) },
          splashes: { shown: splashMesh.visible, count: splashMesh.visible ? splashGeometry.instanceCount : 0, reachMetres: m(splashUniforms.uReach.value), size: r(splashUniforms.uSize.value), upright: splashUniforms.uUpright.value },
          haze: { clearMetres: m(scene.fog.near), farMetres: m(scene.fog.far), skyLeft: r(CITY_HAZE.cityHazeSky.value[0] + CITY_HAZE.cityHazeSky.value[1] + CITY_HAZE.cityHazeSky.value[2], 3) },
          reflections: { on: postLook.reflect > 0, mirror: r(postLook.reflect), skyShare: r(postLook.reflectShare), reachMetres: m(ssrUniforms.uReach.value), fresnel: r(street.x), jitter: r(street.y), firstStep: r(street.w, 3) },
          sheenRadial: wetUniforms.citySheenDir.value.lengthSq() < 0.25,
        };
      }
