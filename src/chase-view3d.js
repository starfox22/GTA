      // Chase view 3D: the perspective camera behind the player (chase-camera.js says where it stands), the
      // ground it sees for culling and level of detail, the draw distance by tier and the haze at its end.
      /**
       * CHASE VIEW
       * The third-person view is a PerspectiveCamera that copies the game's pinhole
       * (chase-camera.js: position, heading, pitch, lens; the game projects with the same
       * numbers for its own rules). It takes over from the street or flight camera in
       * render() (render3d-frame.js) after updateFlightView, and the ride camera
       * (themepark3d-shows.js) still takes over from it on the Falcon and the Eye.
       *
       * What it sees: everything within the tier's draw distance (CHASE_DRAW), so
       * `viewCenter` / `viewReach` hold the box round that wedge of ground, and the cells of
       * scenery are also tested against the camera's frustum (chaseCellShown), keeping the
       * ones within the shadow reach behind the camera so a tower behind it still shades
       * the street ahead. `viewZoom` is the street zoom the view matches near the camera
       * (CHASE_LOD_NEAR): full detail there; things that step down with distance ask
       * chaseZoomAt(x, y) (vehicles, small scenery, trees).
       *
       * Haze: the aerial-perspective fog (flight-view3d.js) is clear to CHASE_HAZE_CLEAR
       * of the draw distance and closes over the rest, so the far clip is never seen.
       */
      const CHASE_DRAW = { LOW: 2600, MEDIUM: 3600, HIGH: 4800, ULTRA: 6400 },
        CHASE_HAZE_CLEAR = 0.16,
        CHASE_LOD_NEAR = 400,
        // Behind the camera, cells this close still draw (they cast the shadows in front of it).
        CHASE_SHADOW_KEEP = 1400,
        chaseCamera = new Three.PerspectiveCamera(CHASE_FOOT.fov, 1, CHASE_NEAR, 9000),
        chaseLookAt = new Three.Vector3(),
        chaseSphere = new Three.Sphere(),
        chaseCorner = new Three.Vector3();
      chaseCamera.layers.enable(DETAIL_LAYER);
      chaseCamera.layers.enable(FAR_DETAIL_LAYER);
      let chaseViewActive = false,
        chaseDrawReach = CHASE_DRAW.HIGH;
      function chaseDrawDistance() {
        const tier = activeTier || graphicsTier();
        return CHASE_DRAW[tier.name] || CHASE_DRAW.HIGH;
      }
      /* The street zoom a thing at map (x, y) is drawn at in the chase view (its distance from the
         camera against the street frame): for level-of-detail switches tuned on the street view. */
      function chaseZoomAt(x, y, z = 0) {
        const d = Math.max(CHASE_NEAR, Math.hypot(x - chaseCam.x, y - chaseCam.y, z ? z - chaseCam.z : 0));
        return streetFrameHeight() / (2 * d * Math.tan((chaseCamera.fov * Math.PI) / 360));
      }
      /* Whether a cell of scenery round map (x, y) with reach `reach` draws in the chase view: inside
         the draw distance and the frustum, or close enough behind to cast a shadow into the view. */
      function chaseCellShown(x, y, reach) {
        const dx = x - chaseCam.x,
          dy = y - chaseCam.y,
          d = Math.hypot(dx, dy);
        if (d > chaseDrawReach + reach * 1.42) return false;
        if (d < CHASE_SHADOW_KEEP + reach * 1.42) return true;
        chaseSphere.center.set(x, chaseCam.pz, y);
        chaseSphere.radius = reach * 1.42 + 200;
        return viewFrustum.intersectsSphere(chaseSphere);
      }
      function updateChaseView(deltaSeconds) {
        chaseViewActive = chaseCameraLive() && chaseCam.ready;
        if (!chaseViewActive) return false;
        camera = chaseCamera;
        const aspect = viewportWidth / Math.max(1, viewportHeight),
          yaw = chaseCam.viewYaw,
          pitch = chaseCam.viewPitch,
          cp = Math.cos(pitch);
        chaseDrawReach = chaseDrawDistance();
        chaseCamera.fov = chaseCam.fov;
        chaseCamera.aspect = aspect;
        chaseCamera.near = CHASE_NEAR;
        chaseCamera.far = chaseDrawReach * 1.08;
        chaseCamera.position.set(chaseCam.x, chaseCam.z, chaseCam.y);
        chaseLookAt.set(chaseCam.x + Math.cos(yaw) * cp * 100, chaseCam.z - Math.sin(pitch) * 100, chaseCam.y + Math.sin(yaw) * cp * 100);
        chaseCamera.up.set(0, 1, 0);
        chaseCamera.lookAt(chaseLookAt);
        chaseCamera.updateProjectionMatrix();
        chaseCamera.updateMatrixWorld(true);
        // The ground this view can see: the camera and the far edge of the frustum, out to the draw distance.
        const tanV = Math.tan((chaseCamera.fov * Math.PI) / 360),
          tanH = tanV * aspect,
          reach = chaseDrawReach;
        let minX = chaseCam.x,
          maxX = chaseCam.x,
          minY = chaseCam.y,
          maxY = chaseCam.y;
        for (let i = -1; i <= 1; i++) {
          const a = yaw + Math.atan(tanH) * i,
            far = reach / Math.cos(Math.atan(tanH) * i || 0);
          chaseCorner.set(chaseCam.x + Math.cos(a) * Math.min(far, reach * 1.35), 0, chaseCam.y + Math.sin(a) * Math.min(far, reach * 1.35));
          minX = Math.min(minX, chaseCorner.x);
          maxX = Math.max(maxX, chaseCorner.x);
          minY = Math.min(minY, chaseCorner.z);
          maxY = Math.max(maxY, chaseCorner.z);
        }
        viewCenter.x = (minX + maxX) / 2;
        viewCenter.y = (minY + maxY) / 2;
        viewReach = Math.max(920, (maxX - minX) / 2, (maxY - minY) / 2) + 120;
        viewZoom = Math.min(4.5, chaseZoomAt(chaseCam.x + CHASE_LOD_NEAR, chaseCam.y));
        viewGroundDistance = CHASE_LOD_NEAR;
        // Haze: clear near the camera, closing over the far part of the draw distance.
        const clear = reach * CHASE_HAZE_CLEAR;
        scene.fog.near = clear;
        // fogFactor = 1 - exp(-((d - near) / far)^2): about 0.93 at the far clip.
        scene.fog.density = 1.62 / Math.max(1, reach - clear);
        return true;
      }
      /* DeadEndCity.chaseCamera() adds what the renderer draws (render3d-api.js chaseView). */
      function chaseViewReport() {
        return {
          active: chaseViewActive,
          drawMetres: Math.round(chaseDrawReach / UNITS_PER_METRE),
          near: chaseCamera.near,
          far: Math.round(chaseCamera.far),
          viewReach: Math.round(viewReach),
          viewZoom: +viewZoom.toFixed(3),
          fogNear: Math.round(scene.fog.near),
          fogDensity: +scene.fog.density.toExponential(3),
        };
      }
      /**
       * CHASE SHADOWS
       * Looking along the street the frustum reaches the draw distance, and a shadow box
       * fitted to all of it would spread the map's texels over a kilometre. In the chase
       * view the sun's shadow covers the near part of the view only, out to
       * CHASE_SHADOW_REACH by tier, fitted to the bounding sphere of that slice of the
       * frustum: a box of one size whatever way the camera turns, its centre snapped to
       * whole texels, so shadow edges hold still while the camera swings round. Lit
       * materials fade the shadow out over the last part of that depth (cityShadowFade,
       * lighting3d-sky.js CITY_LIGHT_PARS), so it never ends on a line.
       */
      const CHASE_SHADOW_REACH = { LOW: 900, MEDIUM: 900, HIGH: 1200, ULTRA: 1500 },
        chaseShadowCentre = new Three.Vector3(),
        chaseShadowForward = new Three.Vector3();
      {
        // Directional shadows in lit materials fade by view depth where the patch declares the fade.
        const line =
            'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;',
          chunk = Three.ShaderChunk.lights_fragment_begin;
        if (chunk.includes(line))
          Three.ShaderChunk.lights_fragment_begin = chunk.replace(
            line,
            '#ifdef CITY_SHADOW_FADE\n' +
              line.replace('vDirectionalShadowCoord[ i ] ) : 1.0;', 'vDirectionalShadowCoord[ i ] ) * ( 1.0 - cityShadowFade( geometryPosition ) ) + cityShadowFade( geometryPosition ) : 1.0;') +
              '\n#else\n' +
              line +
              '\n#endif',
          );
      }
      function chaseShadowReach() {
        const tier = activeTier || graphicsTier();
        return CHASE_SHADOW_REACH[tier.name] || CHASE_SHADOW_REACH.HIGH;
      }
      function placeChaseSun() {
        const reach = chaseShadowReach(),
          near = chaseCamera.near,
          tanV = Math.tan((chaseCamera.fov * Math.PI) / 360),
          tanH = tanV * chaseCamera.aspect,
          k2 = tanH * tanH + tanV * tanV;
        // The bounding sphere of the frustum's slice from the near plane to `reach`.
        const along = Math.min(reach, ((reach + near) * (1 + k2)) / 2),
          radius = Math.sqrt(reach * reach * k2 + (reach - along) * (reach - along));
        chaseCamera.getWorldDirection(chaseShadowForward);
        chaseShadowCentre.copy(chaseCamera.position).addScaledVector(chaseShadowForward, along);
        shadowAxisX.crossVectors(shadowWorldUp, sunDirection).normalize();
        shadowAxisY.crossVectors(sunDirection, shadowAxisX);
        const half = Math.pow(1.08, Math.ceil(Math.log(Math.max(radius + 12, 64)) / Math.log(1.08))),
          texel = (2 * half) / sun.shadow.mapSize.x,
          cx = Math.round(chaseShadowCentre.dot(shadowAxisX) / texel) * texel,
          cy = Math.round(chaseShadowCentre.dot(shadowAxisY) / texel) * texel,
          d = chaseShadowCentre.dot(sunDirection),
          maxD = d + radius,
          minD = d - radius,
          lift = Math.max(700, streetCeiling() + 100),
          anchorD = maxD + lift + 200;
        shadowAnchor.copy(shadowAxisX).multiplyScalar(cx).addScaledVector(shadowAxisY, cy).addScaledVector(sunDirection, anchorD);
        sun.position.copy(shadowAnchor);
        sun.target.position.copy(shadowAnchor).sub(sunDirection);
        const cam = sun.shadow.camera,
          nearPlane = Math.max(1, anchorD - maxD - lift),
          farPlane = anchorD - minD + 40;
        if (half !== shadowHalfSize || cam.near !== nearPlane || cam.far !== farPlane) {
          shadowHalfSize = half;
          cam.left = cam.bottom = -half;
          cam.right = cam.top = half;
          cam.near = nearPlane;
          cam.far = farPlane;
          cam.updateProjectionMatrix();
        }
        sun.shadow.normalBias = clamp(texel * 1.6, 0.35, 4);
        cityLightUniforms.cityShadowReach.value = reach;
      }
