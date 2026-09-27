      // Clouds 3D frame update (updateCloudVisuals): wind, coverage, shadows, sun dimming and the march.
      // ---- Frame update -------------------------------------------------------------------
      const cloudWind = new Three.Vector2(),
        cloudBuffer = new Three.Vector2(),
        cloudForward = new Three.Vector3(),
        cloudClearColor = new Three.Color(),
        cloudGrey = new Three.Color();
      let cloudClock = 0;
      // How much cloud there is between the sun and a ground point, from the coverage
      // map alone (the CPU has no copy of the noise volume): enough to dim the sun as
      // a big shadow crosses you.
      function cloudOverhead(x, z, coverage) {
        const lift = (CLOUD_BASE + CLOUD_TOP) / 2 / SUN_DIRECTION.y,
          m = cloudMapAt(x + SUN_DIRECTION.x * lift + cloudWind.x, z + SUN_DIRECTION.z * lift + cloudWind.y),
          t = clamp((m - (1 - coverage)) / 0.28, 0, 1);
        return t * t * (3 - 2 * t);
      }
      function updateCloudVisuals(deltaSeconds) {
        const light = daylight(),
          cloud = weather.cloud,
          // A few fair-weather puffs even on a clear day; a closed deck in a storm.
          coverage = clamp(0.1 + cloud * 0.95, 0, 1),
          overcast = clamp((cloud - 0.8) / 0.2, 0, 1),
          // A closed deck is a flatter, lower-topped layer than towering cumulus.
          top = CLOUD_TOP - overcast * 700,
          windSpeed = 30 + weather.wind * 70;
        cloudWind.x += Math.cos(weather.windAngle) * windSpeed * deltaSeconds;
        cloudWind.y += Math.sin(weather.windAngle) * windSpeed * deltaSeconds;
        cloudClock += deltaSeconds;
        // Keep the offset small so float precision holds; the fields tile.
        cloudWind.x %= CLOUD_MAP_SPAN * 3;
        cloudWind.y %= CLOUD_MAP_SPAN * 3;
        for (const u of [marchUniforms, shadeUniforms]) {
          u.uWind.value.copy(cloudWind);
          u.uCoverage.value = coverage;
          u.uTop.value = top;
          u.uTime.value = cloudClock;
        }
        // Shadows on the ground: strongest in broken cloud, gone under a closed deck
        // (whose even gloom is the overcast dimming in weather3d.js) and at night.
        // At most a third darker: enough to read as passing cloud without turning
        // the streets into a patchwork from the air.
        // A closed deck (overcast and rain, cloud 0.9 and up) throws no pattern at
        // all: its residual blotches over the rain-dark streets read as dirt.
        const closedDeck = clamp((cloud - 0.72) / 0.18, 0, 1),
          shadeStrength = cloudsSupported ? 0.34 * clamp(light * 1.4, 0, 1) * (1 - closedDeck) : 0;
        cloudShade.visible = shadeStrength > 0.01 && coverage > 0.05;
        if (cloudShade.visible) {
          const ground = terrainHeight(viewCenter.x, viewCenter.y),
            span = viewReach * 2.6 + 1200;
          cloudShade.position.set(viewCenter.x, ground + shadeHeight, viewCenter.y);
          cloudShade.scale.set(span, span, 1);
          shadeUniforms.uGround.value = ground;
          shadeUniforms.uStrength.value = shadeStrength;
          shadeUniforms.uPerspective.value = camera.isPerspectiveCamera ? 1 : 0;
          camera.getWorldDirection(shadeUniforms.uViewDirection.value);
        }
        // The sun dims as a shadow crosses the middle of the view. The clouds are lit
        // by the sun above the weather (the time-of-day strength, plus any lightning):
        // an overcast is grey underneath and bright on top.
        const cloudSunIntensity = 0.35 + light * 3.6 + 9 * weather.flash * weather.flash;
        // Only while the view is about the size of a cloud: from the air the frame
        // spans several, and dimming the whole city for the one in the middle made
        // the light pump as the helicopter crossed their edges.
        const cloudSized = clamp((2600 - viewReach) / 1600, 0, 1);
        sun.intensity *=
          1 - cloudOverhead(viewCenter.x, viewCenter.y, coverage) * (0.42 - overcast * 0.25) * cloudSized * (cloudsSupported ? 1 : 0);
        // The layer itself: only from the flight camera, and only once it is above the
        // base (every view ray points downwards, so below it there is nothing to see).
        const active =
          cloudsSupported && camera === flightCamera && camera.position.y > CLOUD_BASE && coverage > 0.02;
        cloudComposite.visible = cloudDepth.visible = active;
        if (!active) return;
        sceneBufferSize(cloudBuffer);
        // The LOW tier marches the layer at the phones' resolution (a third of the
        // screen rather than a half: under half the fragments), with no recompile.
        const resolution = graphicsTier().name === 'LOW' ? Math.min(CLOUD_RESOLUTION, 0.34) : CLOUD_RESOLUTION,
          width = Math.max(4, Math.round((viewportWidth || cloudBuffer.x) * resolution)),
          height = Math.max(4, Math.round((viewportHeight || cloudBuffer.y) * resolution));
        if (cloudTarget.width !== width || cloudTarget.height !== height) cloudTarget.setSize(width, height);
        compositeUniforms.uResolution.value.copy(cloudBuffer);
        marchUniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
        marchUniforms.uCameraWorld.value.copy(camera.matrixWorld);
        marchUniforms.uCameraPosition.value.copy(camera.position);
        // Light: the scene's own sun, sky and ground colours, so dawn, dusk, night and
        // lightning all reach the clouds without a palette of their own.
        marchUniforms.uSunColor.value.copy(sun.color).multiplyScalar(cloudSunIntensity * 0.62);
        marchUniforms.uSkyColor.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.42);
        // Light bounced up off the city is greyed, or cloud bases turn olive.
        marchUniforms.uGroundColor.value
          .copy(hemi.groundColor)
          .lerp(cloudGrey.setScalar(hemi.groundColor.r * 0.3 + hemi.groundColor.g * 0.59 + hemi.groundColor.b * 0.11), 0.7)
          .multiplyScalar(hemi.intensity * 0.3);
        marchUniforms.uGlowColor.value.setRGB(1, 0.56, 0.3).multiplyScalar(nightAmount * 0.55);
        marchUniforms.uHazeColor.value.copy(scene.fog.color);
        marchUniforms.uHaze.value.set(scene.fog.near, scene.fog.far);
        // Cloud between the camera and the aircraft is cut away (flightDistance is how
        // far the aircraft is from the camera), fading in over the last stretch before
        // it: the chase camera never looks through a veil, and cloud at the aircraft's
        // own level wells up around it as it climbs into the layer.
        marchUniforms.uNearFade.value.set(flightDistance * 0.72, flightDistance * 1.02);
        marchUniforms.uAircraft.value.set(player.x, entityElevation(player.car || player), player.y);
        marchUniforms.uMaxDistance.value = camera.far;
        const clearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(cloudClearColor);
        renderer.setRenderTarget(cloudTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.render(marchScene, fullScreenCamera);
        renderer.setRenderTarget(null);
        renderer.setClearColor(cloudClearColor, clearAlpha);
        // Composite quad: square to the camera, just beyond the aircraft, filling the frame.
        const depth = flightDistance + 70,
          tall = 2 * depth * Math.tan((camera.fov * Math.PI) / 360) * 1.25;
        camera.getWorldDirection(cloudForward);
        for (const quad of [cloudComposite, cloudDepth]) {
          quad.position.copy(camera.position).addScaledVector(cloudForward, depth);
          quad.quaternion.copy(camera.quaternion);
          quad.scale.set(tall * camera.aspect, tall, 1);
        }
      }
