      // Clouds 3D frame update (updateCloudVisuals): shadows, sun dimming, the far march, the veil near the camera,
      // the wisps, the lens and the in-cloud grade; cloudViewReport() for the console.
      // ---- Frame update -------------------------------------------------------------------
      const cloudQuads = [cloudComposite, cloudDepth],
        cloudBuffer = new Three.Vector2(),
        cloudBounds = new Three.Vector2(),
        cloudForward = new Three.Vector3(),
        cloudSubject = new Three.Vector3(),
        cloudVelocity = new Three.Vector3(),
        cloudClearColor = new Three.Color(),
        cloudGrey = new Three.Color(),
        cloudFlat = new Three.Vector4(),
        cloudFlatColor = new Three.Color();
      /* The light inside the cloud round a jumper (the same sky, sun and bounce the
         layer is drawn with, by height in the slab) and how far in cloud the jumper
         is: the parachute's rig takes it instead of the sun (parachute3d-canopy.js). */
      const cloudRigLight = new Three.Color(1, 1, 1);
      let cloudRigAmount = 0;
      // What the camera makes of the layer this frame (DeadEndCity.cloudLayer().view).
      const cloudView = {
        context: '',
        active: false,
        // The CPU estimate of cloud at the camera, and the same eased (the in-cloud grade).
        cameraAmount: 0,
        inCloud: 0,
        veilSteps: 0,
        veilCap: 0,
        flatVeil: 0,
        wisps: 0,
        wispOpacity: 0,
        lensWet: 0,
        subjectDistance: 0,
      };
      // How much cloud there is between the sun and a ground point, from the coverage
      // map alone (the CPU has no copy of the noise volume): enough to dim the sun as
      // a big shadow crosses you.
      function cloudOverhead(x, z) {
        const slab = cloudLayerAt(x, z),
          cover = slab.cover,
          lift = ((slab.base + slab.top) / 2 - terrainHeight(x, z)) / Math.max(0.2, SUN_DIRECTION.y),
          m = cloudMapAt(x + SUN_DIRECTION.x * lift + cloudLayer.windX, z + SUN_DIRECTION.z * lift + cloudLayer.windY),
          t = clamp((m - (1 - cover)) / 0.28, 0, 1);
        return t * t * (3 - 2 * t);
      }
      function updateCloudVisuals(deltaSeconds) {
        const light = litDaylight(),
          cloud = weather.cloud,
          coverage = cloudLayer.coverage,
          overcast = clamp((cloud - 0.8) / 0.2, 0, 1),
          tier = graphicsTier().name;
        syncCloudField(marchUniforms);
        syncCloudField(shadeUniforms);
        cloudLayerBounds(cloudBounds);
        // Shadows on the ground: strongest in broken cloud, gone under a closed deck
        // (whose even gloom is the overcast dimming in weather3d.js) and at night.
        // At most a third darker: enough to read as passing cloud without turning
        // the streets into a patchwork from the air.
        // A closed deck (overcast and rain, cloud 0.9 and up) throws no pattern at
        // all: its residual blotches over the rain-dark streets read as dirt.
        const closedDeck = clamp((cloud - 0.72) / 0.18, 0, 1),
          shadeStrength = cloudsSupported ? 0.34 * clamp(light * 1.4, 0, 1) * (1 - closedDeck) : 0;
        const shadeOn = shadeStrength > 0.01 && coverage > 0.05;
        // The chase camera stands under the plane: its shadows come per pixel (clouds3d-sky.js).
        cloudShade.visible = shadeOn && !chaseViewActive;
        chaseShade.on = shadeOn && chaseViewActive;
        shadeUniforms.uStrength.value = shadeStrength;
        if (cloudShade.visible) {
          const ground = terrainHeight(viewCenter.x, viewCenter.y),
            span = viewReach * 2.6 + 1200;
          cloudShade.position.set(viewCenter.x, ground + shadeHeight, viewCenter.y);
          cloudShade.scale.set(span, span, 1);
          shadeUniforms.uGround.value = ground;
          shadeUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
          camera.getWorldDirection(shadeUniforms.uViewDirection.value);
        }
        // The sun dims as a shadow crosses the middle of the view. The clouds are lit
        // by the sun above the weather (the time-of-day strength, plus any lightning):
        // an overcast is grey underneath and bright on top. By night the moon (and the
        // city's glow under the base) is kept dim: with the multiple scattering a brighter
        // moon lit night cloud like a sunset.
        const cloudSunIntensity = 0.12 + light * 3.83 + 9 * weather.flash * weather.flash;
        // Only while the view is about the size of a cloud: from the air the frame
        // spans several, and dimming the whole city for the one in the middle made
        // the light pump as the helicopter crossed their edges.
        const cloudSized = clamp((2600 - viewReach) / 1600, 0, 1);
        sun.intensity *= 1 - cloudOverhead(viewCenter.x, viewCenter.y) * (0.42 - overcast * 0.25) * cloudSized * (cloudsSupported ? 1 : 0);
        // The layer itself: only from the flight camera (which never looks above ~30
        // degrees below the horizon), so only once the camera is above the lowest cloud.
        const flying = cloudsSupported && camera === flightCamera && coverage > 0.02,
          p = player.parachute,
          context = p ? (p.stage === 'freefall' ? 'freefall' : 'canopy') : 'aircraft',
          active = flying && camera.position.y > cloudBounds.x,
          /* A jumper goes from freefall to canopy over the opening, not at the pull:
             the veil, the clear air round them, the mist streaming past and the lens
             follow how far the canopy is out and how fast they still fall. */
          underCanopy = p && p.stage === 'canopy' ? clamp(p.opening, 0, 1) : 0,
          fallFlow = p ? clamp(-(p.vz || 0) / PARACHUTE_TERMINAL, 0, 1) : 0,
          jumperCloud = p && cloudsSupported ? clamp(cloudLayer.immersion * 1.3, 0, 1) : 0;
        // In cloud a jumper has no sun: the light round them is the cloud's own, dim and even.
        sun.intensity *= 1 - 0.6 * jumperCloud;
        cloudRigAmount = 0;
        cloudSubject.set(player.x, entityElevation(player.car || player), player.y);
        const subjectDistance = camera.position.distanceTo(cloudSubject),
          cameraAmount = flying ? cloudAmountAt(camera.position.x, camera.position.z, camera.position.y) : 0;
        cloudView.context = flying ? context : '';
        cloudView.active = active;
        cloudView.cameraAmount = cameraAmount;
        cloudView.inCloud += (cameraAmount - cloudView.inCloud) * (1 - Math.exp(-deltaSeconds * (cameraAmount > cloudView.inCloud ? 4 : 2)));
        cloudView.subjectDistance = subjectDistance;
        cloudComposite.visible = cloudDepth.visible = active;
        updateCloudLens(deltaSeconds, flying && tier !== 'LOW' ? context : '', cameraAmount, underCanopy, fallFlow);
        // The chase view's sky: the layer seen from below (clouds3d-sky.js).
        updateSkyClouds(tier, coverage, cloudSunIntensity, light);
        if (!active) {
          cloudVeil.visible = false;
          cloudView.veilSteps = cloudView.veilCap = cloudView.flatVeil = 0;
          updateCloudWisps(deltaSeconds, 0, 0, 0, cloudSubject);
          cloudView.wisps = cloudView.wispOpacity = 0;
          return;
        }
        const { width, height } = sizeCloudTarget(tier);
        compositeUniforms.uResolution.value.copy(cloudBuffer);
        nearCompositeUniforms.uResolution.value.copy(cloudBuffer);
        marchUniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        marchUniforms.uCameraWorld.value.copy(camera.matrixWorld);
        marchUniforms.uCameraPosition.value.copy(camera.position);
        setCloudLight(cloudSunIntensity, light);
        marchUniforms.uEye.value.copy(camera.position);
        marchUniforms.uHazeColor.value.copy(scene.fog.color);
        marchUniforms.uHaze.value.set(scene.fog.near, scene.fog.far);
        marchUniforms.uSlab.value.copy(cloudBounds);
        // The veil between the camera and the subject (clouds3d-near.js): a jumper always
        // (capped), an aircraft only as deep as it is in cloud itself, so flying under the
        // base the chase camera never looks through cloud the aircraft is not in.
        const cap =
            context === 'aircraft'
              ? NEAR_CAP.aircraft * clamp(cloudLayer.immersion * 1.6, 0, 1)
              : NEAR_CAP.freefall + (NEAR_CAP.canopy - NEAR_CAP.freefall) * underCanopy,
          segmentLow = Math.min(camera.position.y, cloudSubject.y),
          segmentHigh = Math.max(camera.position.y, cloudSubject.y),
          veil = cap > 0.01 && segmentHigh > cloudBounds.x && segmentLow < cloudBounds.y,
          steps = veil ? NEAR_STEPS[tier] ?? NEAR_STEPS.HIGH : 0;
        // Cloud between the camera and the subject is the veil's; without one it is cut
        // away, fading in over the last stretch before the subject so cloud at its own
        // level wells up around it as it climbs into the layer.
        if (steps > 0) marchUniforms.uNearFade.value.set(subjectDistance * 0.9, subjectDistance * 1.02);
        else marchUniforms.uNearFade.value.set(subjectDistance * 0.72, subjectDistance * 1.02);
        marchUniforms.uAircraft.value.copy(cloudSubject);
        // Clear air round the subject: an aircraft's pocket (walls of cloud, the ground
        // below); none in freefall (the white-out is the point), a thin one under canopy.
        if (p) marchUniforms.uPocket.value.set(1 + 119 * underCanopy, 2 + 418 * underCanopy, 0.5 * underCanopy);
        else marchUniforms.uPocket.value.set(CLOUD_POCKET_INNER, CLOUD_POCKET_OUTER, 1);
        marchUniforms.uMaxDistance.value = camera.far;
        // Shafts under broken cloud by day (HIGH and ULTRA): gone under a closed deck,
        // whose shade is even, and at night.
        marchUniforms.uShafts.value.set(
          tier === 'HIGH' || tier === 'ULTRA' ? 0.55 * clamp(light * 1.5, 0, 1) * (1 - closedDeck) : 0,
          scene.fog.density * 2.2,
          terrainHeight(viewCenter.x, viewCenter.y),
        );
        const clearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(cloudClearColor);
        renderer.setRenderTarget(cloudTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.render(marchScene, fullScreenCamera);
        // LOW's flat veil: the in-cloud colour (sky light fading with depth into the
        // layer, a little sun at the top, bounce light at the base) times the estimate.
        const slab = cloudLayerAt(camera.position.x, camera.position.z),
          h = clamp((camera.position.y - slab.base) / Math.max(1, slab.top - slab.base), 0, 1),
          flatAlpha = veil && steps === 0 ? cloudView.inCloud * cap : 0;
        const sky = marchUniforms.uSkyColor.value,
          sunLight = marchUniforms.uSunColor.value,
          bounce = marchUniforms.uGroundColor.value,
          skyShare = (0.25 + 0.75 * h) * 0.7,
          sunShare = 0.25 * h * h;
        cloudFlatColor.setRGB(
          sky.r * skyShare + sunLight.r * sunShare + bounce.r * (1 - h),
          sky.g * skyShare + sunLight.g * sunShare + bounce.g * (1 - h),
          sky.b * skyShare + sunLight.b * sunShare + bounce.b * (1 - h),
        );
        cloudFlat.set(cloudFlatColor.r * flatAlpha, cloudFlatColor.g * flatAlpha, cloudFlatColor.b * flatAlpha, flatAlpha);
        /* The light round the jumper for the rig: inside, cloud is lit by the sun
           scattered down through it (less of it the deeper under the tops) and the sky,
           with the ground's bounce near the base; about as bright as the veil, so white
           cloth greys into it rather than showing as a dark shape. */
        if (jumperCloud > 0) {
          const subjectSlab = cloudLayerAt(cloudSubject.x, cloudSubject.z),
            hs = clamp((cloudSubject.y - subjectSlab.base) / Math.max(1, subjectSlab.top - subjectSlab.base), 0, 1),
            skyAt = 0.7 + 0.3 * hs,
            sunAt = 0.12 + 0.3 * hs,
            bounceAt = 0.8 * (1 - hs);
          cloudRigLight.setRGB(
            sky.r * skyAt + sunLight.r * sunAt + bounce.r * bounceAt,
            sky.g * skyAt + sunLight.g * sunAt + bounce.g * bounceAt,
            sky.b * skyAt + sunLight.b * sunAt + bounce.b * bounceAt,
          );
          cloudRigAmount = jumperCloud * 0.85;
        }
        renderCloudVeil(subjectDistance, cap, steps, width, height, cloudFlat);
        renderer.setRenderTarget(null);
        renderer.setClearColor(cloudClearColor, clearAlpha);
        cloudView.veilSteps = steps;
        cloudView.veilCap = veil ? cap : 0;
        cloudView.flatVeil = flatAlpha;
        // Composite quad: square to the camera, just beyond the subject, filling the frame.
        const depth = subjectDistance + 70,
          tall = 2 * depth * Math.tan((camera.fov * Math.PI) / 360) * 1.25;
        camera.getWorldDirection(cloudForward);
        for (const quad of cloudQuads) {
          quad.position.copy(camera.position).addScaledVector(cloudForward, depth);
          quad.quaternion.copy(camera.quaternion);
          quad.scale.set(tall * camera.aspect, tall, 1);
        }
        // Rags streaming past while the camera is in (or skimming) the layer.
        const margin = 20 * UNITS_PER_METRE,
          nearLayer = camera.position.y > cloudBounds.x - margin && camera.position.y < cloudBounds.y + margin,
          wisps = nearLayer ? WISP_COUNT[tier] ?? WISP_COUNT.HIGH : 0,
          wispOpacity = context === 'aircraft' ? 0.45 * clamp(cloudLayer.immersion * 3, 0, 1) : 0.7 - 0.1 * underCanopy;
        updateCloudWisps(deltaSeconds, wisps, subjectDistance * 1.3, wisps ? wispOpacity : 0, cloudSubject);
        cloudView.wisps = wispMesh.visible ? wisps : 0;
        cloudView.wispOpacity = wispMesh.visible ? wispOpacity : 0;
        // The veil streams past a falling jumper (and, faintly, a canopy or an aircraft
        // in cloud), strongest at a freefall's speed and slowing as the canopy opens.
        const streaks = steps > 0 ? cameraAmount * (p ? 0.1 + 0.3 * fallFlow : 0.12 * clamp(cloudLayer.immersion * 2, 0, 1)) : 0;
        if (p) cloudVelocity.set(p.vx || 0, p.vz || 0, p.vy || 0);
        else if (player.car) cloudVelocity.set(player.car.vx || 0, player.car.vz || 0, player.car.vy || 0);
        setCloudStreaks(streaks, cloudVelocity, deltaSeconds);
        // Inside a cloud the world greys out: colour and contrast drain, and the white
        // around you glows.
        const grey = cloudView.inCloud * (context === 'aircraft' ? clamp(cloudLayer.immersion * 2, 0, 1) : 1);
        postLook.saturation *= 1 - grey * 0.3;
        postLook.contrast *= 1 - grey * 0.16;
        postLook.bloomStrength *= 1 + grey * 0.5;
      }
      // The march target at the tier's share of the screen (cloudBuffer: the scene buffer's size, read here).
      // The LOW tier marches the layer at the phones' resolution (a third of the screen rather than a half:
      // under half the fragments), with no recompile.
      const cloudTargetSize = { width: 4, height: 4 };
      function sizeCloudTarget(tier) {
        sceneBufferSize(cloudBuffer);
        const resolution = tier === 'LOW' ? Math.min(CLOUD_RESOLUTION, 0.34) : CLOUD_RESOLUTION,
          width = Math.max(4, Math.round((viewportWidth || cloudBuffer.x) * resolution)),
          height = Math.max(4, Math.round((viewportHeight || cloudBuffer.y) * resolution));
        if (cloudTarget.width !== width || cloudTarget.height !== height) cloudTarget.setSize(width, height);
        cloudTargetSize.width = width;
        cloudTargetSize.height = height;
        return cloudTargetSize;
      }
      /* The light the clouds are drawn with (the far march, the veil and, from below, the dome's layer): the
         scene's own sun, sky and ground colours, so dawn, dusk, night and lightning all reach the clouds without
         a palette of their own. */
      function setCloudLight(cloudSunIntensity, light) {
        marchUniforms.uSunColor.value.copy(sun.color).multiplyScalar(cloudSunIntensity * 0.62);
        // The game's day sun is a warm, stylised yellow; on cloud that reads as sand. Up
        // high the sun is whiter: half-way to its own grey by day, all of it kept at dusk.
        const cloudSun = marchUniforms.uSunColor.value,
          sunGrey = cloudSun.r * 0.2126 + cloudSun.g * 0.7152 + cloudSun.b * 0.0722,
          whiten = 0.5 * clamp((light - 0.35) / 0.4, 0, 1);
        cloudSun.lerp(cloudGrey.setScalar(sunGrey), whiten);
        marchUniforms.uSkyColor.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.42);
        // Light bounced up off the city is greyed, or cloud bases turn olive.
        marchUniforms.uGroundColor.value
          .copy(hemi.groundColor)
          .lerp(cloudGrey.setScalar(hemi.groundColor.r * 0.3 + hemi.groundColor.g * 0.59 + hemi.groundColor.b * 0.11), 0.7)
          .multiplyScalar(hemi.intensity * 0.3);
        marchUniforms.uGlowColor.value.setRGB(1, 0.6, 0.36).multiplyScalar(nightAmount * 0.3);
        // Most of the day grade's warm gain taken back out: sunlit cloud is white.
        const gain = postLook.gain;
        marchUniforms.uCloudTint.value.set(1 + (1 / gain.x - 1) * 0.85, 1 + (1 / gain.y - 1) * 0.85, 1 + (1 / gain.z - 1) * 0.85);
      }
      // Water on the lens (clouds3d-lens.js): only for a jumper's camera. Beads gather
      // within a second or two in cloud and dry or blow off over a few seconds after it;
      // in freefall the rush of air stretches them and sweeps them up the frame.
      // `underCanopy` how far the canopy is out (0 freefall .. 1 flying), `fallFlow` the fall against freefall speed.
      function updateCloudLens(deltaSeconds, context, cameraAmount, underCanopy = 0, fallFlow = 0) {
        const jumping = context === 'freefall' || context === 'canopy',
          target = jumping ? clamp(cameraAmount * 1.4, 0, 1) * (1 - 0.25 * underCanopy) : 0,
          wet = cloudLensUniforms.uLensWet.value,
          rate = target > wet ? 0.7 : 0.3 - 0.12 * underCanopy,
          flow = jumping ? Math.max(fallFlow, 0.12 * underCanopy) : 0;
        cloudLensUniforms.uLensWet.value = jumping ? wet + (target - wet) * (1 - Math.exp(-deltaSeconds * rate * 3)) : 0;
        if (cloudLensUniforms.uLensWet.value < 0.003) cloudLensUniforms.uLensWet.value = 0;
        cloudLensUniforms.uLensFlow.value += (flow - cloudLensUniforms.uLensFlow.value) * (1 - Math.exp(-deltaSeconds * 2));
        cloudLensUniforms.uLensScroll.value = (cloudLensUniforms.uLensScroll.value + cloudLensUniforms.uLensFlow.value * deltaSeconds * 1.3) % 1000;
        cloudView.lensWet = cloudLensUniforms.uLensWet.value;
      }
      function cloudViewReport() {
        const r = (v) => +v.toFixed(2),
          slab = cloudLayerAt(camera.position.x, camera.position.z);
        return {
          context: cloudView.context,
          active: cloudView.active,
          cameraM: +worldMeters(camera.position.y).toFixed(1),
          baseM: +worldMeters(slab.base).toFixed(1),
          topM: +worldMeters(slab.top).toFixed(1),
          cameraAmount: r(cloudView.cameraAmount),
          inCloud: r(cloudView.inCloud),
          veil: { steps: cloudView.veilSteps, cap: r(cloudView.veilCap), flat: r(cloudView.flatVeil) },
          wisps: cloudView.wisps,
          wispOpacity: r(cloudView.wispOpacity),
          lensWet: r(cloudView.lensWet),
          subjectDistanceM: +worldMeters(cloudView.subjectDistance).toFixed(1),
          towers: cloudTowerBoxes.filter((b) => b.z > b.x).length,
          // The light the clouds are drawn with (scene-linear RGB).
          light: ['uSunColor', 'uSkyColor', 'uGroundColor'].map((k) => marchUniforms[k].value.toArray().map(r)),
          // The chase view's sky (clouds3d-sky.js, aerial-haze3d.js, postfx3d-sun.js): the clouds from below
          // ('march', 'layer' or ''), the sun the sky draws (elevation, degrees), the haze, the sun glare.
          sky: {
            clouds: ['', 'layer', 'march'][skyCloudView.mode],
            // Cloud shadows drawn per pixel (the chase view) this frame.
            shadows: chaseShade.drawn,
            sunDeg: +((Math.asin(clamp(skySunDirection.y, -1, 1)) * 180) / Math.PI).toFixed(1),
            haze: CITY_HAZE.cityHazeSun.value[3] > 0.5,
            horizon: Array.from(CITY_HAZE.cityHazeSky.value.subarray(0, 3), r),
            zenith: Array.from(CITY_HAZE.cityHazeTop.value.subarray(0, 3), r),
            glare: sunGlareReport(),
          },
        };
      }
