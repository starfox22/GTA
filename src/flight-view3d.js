      // BEGIN SUBSYSTEM: src/flight-view3d.js — Flight camera and aerial perspective
      /**
       * Flight camera and aerial perspective
       * Source: src/flight-view3d.js
       * Scope: createCityRenderer() closure (included right after the street camera and lights).
       * The perspective camera that takes over from the orthographic street view once
       * you leave the ground, the ground footprint it sees (draw distance, level of
       * detail, shadow coverage) and the distance haze that goes with it.
       *
       * Why a second camera: an orthographic view has no depth cue at all, so climbing
       * in the helicopter only ever looked like zooming out. In the air the view is a
       * perspective camera that keeps the aircraft framed exactly as the street view
       * frames the player (a dolly zoom: the field of view widens as the camera closes
       * in), so the aircraft holds its size on screen while the ground falls away
       * beneath it, towers lean out from the centre of the frame, and the aircraft's
       * shadow drops away from it and shrinks. On the ground the field of view is 3
       * degrees, which is indistinguishable from the orthographic street view, so
       * taking off and landing never pops; walking and driving still use the
       * orthographic camera itself.
       */
      /**
       * AERIAL PERSPECTIVE
       * Exponential fog measured from the camera is the wrong model for a camera that
       * looks down from a height: everything is equally far away, so it greys the whole
       * frame evenly, which read as a milky filter. Haze here is clear out to `near`
       * (set to most of the distance to the ground in the middle of the frame) and
       * thickens with the distance beyond it, so only the far edge of a high view picks
       * up the sky colour, the way distant land does. `scene.fog` is a linear Fog whose
       * near/far feed this curve; `density` is kept as the knob the time-of-day and
       * weather code turn (far = 1 / density), with the same meaning it always had.
       */
      Three.ShaderChunk.fog_fragment = `
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
          #else
            // Aerial perspective (flight-view3d.js): clear to fogNear, then exp-squared over fogFar.
            float fogReach = max( vFogDepth - fogNear, 0.0 ) / fogFar;
            float fogFactor = 1.0 - exp( - fogReach * fogReach );
          #endif
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
        #endif`;
      const STREET_FOG_DENSITY = 0.00015;
      scene.fog = new Three.Fog('#747381', 0, 1 / STREET_FOG_DENSITY);
      scene.fog.density = STREET_FOG_DENSITY;
      /**
       * FLIGHT CAMERA
       * The shape of the view as a function of height above the ground (AGL, world units):
       *   field of view  3 deg on the ground -> 40 deg by ~140 m (ease-out, so the first
       *                  metres of a climb already feel like leaving the ground), then
       *                  narrowing to 30 deg by ~1300 m so the whole county is not in
       *                  frame at once
       *   pitch          the street view's 50.5 deg -> 74 deg by ~500 m, so the ground
       *                  under the aircraft stays in frame as it shrinks away
       *   framing        the aircraft holds its street-view size, easing 30% wider up high
       * Height is followed with a little lag and the view banks gently into turns.
       */
      const STREET_PITCH = Math.atan2(680, 560),
        HIGH_PITCH = (74 * Math.PI) / 180,
        GROUND_FOV = 3,
        AIR_FOV = 40,
        HIGH_FOV = 30,
        flightCamera = new Three.PerspectiveCamera(GROUND_FOV, 1, 50, 60000);
      let flightAltitude = 0,
        // Camera-to-aircraft distance while the flight camera is active.
        flightDistance = 0,
        viewAgl = 0,
        flightBank = 0,
        flightViewActive = false;
      // What the renderer can see this frame, for culling and level of detail:
      // viewCenter is the ground point in the middle of the frame, viewReach the
      // half-size of a square around it that holds the whole visible ground, and
      // viewZoom the scale of that ground relative to the street view at zoom 1
      // (the same meaning worldZoom has, so LOD thresholds carry over).
      const viewCenter = { x: 0, y: 0 };
      let viewReach = 920,
        viewZoom = 1,
        viewGroundDistance = 880;
      const footprintRay = new Three.Ray(),
        footprintNdc = new Three.Vector3(),
        footprintHit = new Three.Vector3(),
        footprintCorners = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ];
      // Distance along a camera ray (through NDC x, y) to the horizontal plane at
      // `height`, capped for rays that run towards the horizon.
      function rayToGround(ndcX, ndcY, height, out) {
        footprintNdc.set(ndcX, ndcY, 0.5).unproject(flightCamera);
        footprintRay.origin.copy(flightCamera.position);
        footprintRay.direction.copy(footprintNdc).sub(flightCamera.position).normalize();
        const dy = footprintRay.direction.y,
          distance = dy < -0.02 ? Math.min(40000, (height - footprintRay.origin.y) / dy) : 40000;
        footprintRay.at(distance, out);
        return distance;
      }
      // Height above the street the street camera's near plane must clear: the
      // tallest roof (masts and plant included) and the cloud-shadow plane.
      let streetCeilingHeight = 0;
      function streetCeiling() {
        if (!streetCeilingHeight)
          streetCeilingHeight = Math.max(shadeHeight, ...allBuildings.map((b) => b.height || 0)) + 60;
        return streetCeilingHeight;
      }
      function streetFrameHeight() {
        return clamp(viewportHeight * 0.68, 430, 630);
      }
      /**
       * Sets `camera` for this frame and fills viewCenter/viewReach/viewZoom. Returns
       * nothing; render() carries on with whichever camera is active.
       */
      function updateFlightView(deltaSeconds, altitude, flying) {
        const ground = terrainHeight(cameraTarget.x, cameraTarget.y);
        // Follow height with a short lag so climbs and dives read as motion; a jump
        // (teleport, respawn, boarding) snaps instead of sweeping the view.
        if (!flying || Math.abs(altitude - flightAltitude) > 150) flightAltitude = altitude;
        else flightAltitude += (altitude - flightAltitude) * (1 - Math.exp(-deltaSeconds * 3.5));
        const agl = flying ? Math.max(0, flightAltitude - ground) : 0;
        if (Math.abs(agl - viewAgl) > 150) viewAgl = agl;
        else viewAgl += (agl - viewAgl) * (1 - Math.exp(-deltaSeconds * 4));
        flightViewActive = flying || viewAgl > 1;
        const frameH = streetFrameHeight(),
          aspect = viewportWidth / viewportHeight;
        if (!flightViewActive) {
          // Street view: the orthographic camera, looking down the same line as it
          // always has. An orthographic image does not change as the camera slides
          // back along that line, only what the near plane clips does; so the
          // camera stands far enough back that the bottom edge of its near plane
          // clears the tallest roof and the cloud-shadow plane over the city. Closer
          // in, zoomed to street level, the near plane sliced the tops off towers
          // south of the player and cut the cloud-shadow plane across the frame,
          // leaving a pale veil with a hard edge over the top half of the screen.
          camera = streetCamera;
          const viewH = frameH / worldZoom,
            distance = Math.hypot(680, 560) / worldZoom,
            sinPitch = 680 / Math.hypot(680, 560),
            cosPitch = 560 / Math.hypot(680, 560),
            clear = Math.max(distance, (streetCeiling() + (viewH / 2) * cosPitch) / sinPitch),
            setBack = clear - distance;
          camera.position.set(cameraTarget.x, clear * sinPitch + altitude, cameraTarget.y + clear * cosPitch);
          // Just deep enough for the ground at the top of the frame: a tight depth
          // range keeps the depth buffer precise for the ambient occlusion pass.
          camera.far = distance + setBack + viewH * 0.7 + altitude * 1.5 + 600;
          camera.lookAt(cameraTarget.x, altitude, cameraTarget.y);
          camera.left = (-viewH * aspect) / 2;
          camera.right = (viewH * aspect) / 2;
          camera.top = viewH / 2;
          camera.bottom = -viewH / 2;
          camera.updateProjectionMatrix();
          viewCenter.x = cameraTarget.x;
          viewCenter.y = cameraTarget.y;
          viewReach = Math.max(920, viewH * Math.max(1, aspect) * 0.95);
          viewZoom = worldZoom;
          viewGroundDistance = distance;
          // No haze in the street view. Measured from a camera looking down at 50
          // degrees, the top of the frame is only a little farther away than the
          // bottom, so distance haze there was no depth cue, just a pale gradient
          // over the top half of the screen (in rain, whose haze is 3.6 times
          // denser, a milky veil over the upper half). The haze starts beyond the
          // farthest ground in frame; the flight camera sets its own.
          scene.fog.near = setBack + distance + viewH * 1.2;
          scene.fog.density = STREET_FOG_DENSITY * Math.min(1, worldZoom);
          flightBank = 0;
          return;
        }
        camera = flightCamera;
        const widen = 1 - Math.pow(1 - clamp(viewAgl / 720, 0, 1), 2),
          tilt = clamp(viewAgl / 2600, 0, 1),
          fov = GROUND_FOV + (AIR_FOV - GROUND_FOV) * widen - (AIR_FOV - HIGH_FOV) * clamp((viewAgl - 3000) / 3600, 0, 1),
          pitch = STREET_PITCH + (HIGH_PITCH - STREET_PITCH) * tilt * tilt * (3 - 2 * tilt),
          frame = (frameH * (1 + 0.3 * clamp(viewAgl / 3000, 0, 1))) / worldZoom,
          distance = frame / 2 / Math.tan((fov * Math.PI) / 360);
        // Bank a little into turns, more as the view opens up.
        const craft = player.car,
          turnRate = craft && isAircraft(craft) ? craft.av || 0 : 0;
        flightBank += (clamp(-turnRate * 0.045, -0.06, 0.06) * widen - flightBank) * (1 - Math.exp(-deltaSeconds * 2.5));
        flightDistance = distance;
        flightCamera.fov = fov;
        flightCamera.aspect = aspect;
        flightCamera.position.set(
          cameraTarget.x,
          flightAltitude + Math.sin(pitch) * distance,
          cameraTarget.y + Math.cos(pitch) * distance,
        );
        flightCamera.lookAt(cameraTarget.x, flightAltitude, cameraTarget.y);
        flightCamera.rotateZ(flightBank);
        flightCamera.near = Math.max(20, distance * 0.2);
        flightCamera.far = 60000;
        flightCamera.updateProjectionMatrix();
        flightCamera.updateMatrixWorld(true);
        // Ground footprint: where the centre and the four corners of the frame land.
        viewGroundDistance = rayToGround(0, 0, ground, footprintHit);
        viewCenter.x = footprintHit.x;
        viewCenter.y = footprintHit.z;
        let reach = 0,
          farthest = viewGroundDistance;
        for (const [nx, ny] of footprintCorners) {
          farthest = Math.max(farthest, rayToGround(nx, ny, ground, footprintHit));
          reach = Math.max(reach, Math.abs(footprintHit.x - viewCenter.x), Math.abs(footprintHit.z - viewCenter.y));
        }
        viewReach = Math.max(920, reach + 160);
        flightCamera.far = Math.min(60000, farthest * 1.15 + 3000);
        flightCamera.updateProjectionMatrix();
        viewZoom = Math.min(worldZoom, frameH / (2 * viewGroundDistance * Math.tan((fov * Math.PI) / 360)));
        // Haze: clear over most of the way down to the middle of the frame, then the
        // sky colour gathers towards the far (top) edge. Near the ground the narrow
        // lens puts the camera far back, so the clear zone starts where the street
        // camera would have stood and the street fog comes out unchanged.
        const high = clamp(viewAgl / 1200, 0, 1),
          streetDistance = Math.hypot(680, 560) / worldZoom;
        // Just off the ground there is no haze, as in the street view; it gathers
        // over the first ~60 m of the climb.
        const lifted = clamp(viewAgl / 300, 0, 1);
        scene.fog.near = Math.max(
          viewGroundDistance - streetDistance + (streetDistance + frame * 1.2) * (1 - lifted),
          viewGroundDistance * 0.72 * high,
        );
        scene.fog.density = STREET_FOG_DENSITY * (1 + high * 0.6);
      }
      // Weather and time of day adjust `density`; the shader reads far = 1 / density.
      function applyAerialFog() {
        scene.fog.far = 1 / Math.max(1e-6, scene.fog.density);
      }
      /**
       * SHADOW COVERAGE
       * The sun's shadow camera is fitted to what the camera actually sees each
       * frame: the four corner rays of the view are cut by the ground and by a
       * plane SHADOW_RECEIVER_TOP above it, and the shadow box is the smallest one
       * (in the sun's own frame) that holds those eight points. On the street at
       * zoom 1 that is about a quarter of the old fixed 1800-unit box, so the same
       * shadow map gives four times the detail; zoomed out or flying, the box grows
       * with the view instead of leaving the edges unshadowed.
       *
       * Things that cast into the box stand between it and the sun, so only the
       * depth range reaches back towards the sun (far enough for the tallest tower,
       * or the aircraft). The box is anchored in a frame fixed to the world, its
       * size moves in 8% steps and its position in whole texels, so shadow edges
       * stay still while the camera scrolls instead of crawling.
       */
      const SHADOW_RECEIVER_TOP = 140,
        shadowCorner = new Three.Vector3(),
        shadowFar = new Three.Vector3(),
        shadowAxisX = new Three.Vector3(),
        shadowAxisY = new Three.Vector3(),
        shadowAnchor = new Three.Vector3(),
        shadowWorldUp = new Three.Vector3(0, 1, 0);
      let shadowHalfSize = 900;
      function placeSun() {
        const craft = player.car && isAircraft(player.car) ? player.car : player.parachute ? player : null,
          centerX = flightViewActive ? viewCenter.x : cameraTarget.x,
          centerZ = flightViewActive ? viewCenter.y : cameraTarget.y,
          ground = terrainHeight(centerX, centerZ),
          casterTop = craft ? Math.max(0, entityElevation(craft) - ground) + 80 : 0;
        // The sun's frame, as DirectionalLightShadow will build it with lookAt().
        shadowAxisX.crossVectors(shadowWorldUp, sunDirection).normalize();
        shadowAxisY.crossVectors(sunDirection, shadowAxisX);
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity,
          minD = Infinity,
          maxD = -Infinity;
        const reach = viewReach * 1.05;
        for (const [nx, ny] of footprintCorners)
          for (const top of [0, SHADOW_RECEIVER_TOP]) {
            shadowCorner.set(nx, ny, -1).unproject(camera);
            shadowFar.set(nx, ny, 1).unproject(camera).sub(shadowCorner);
            const plane = ground + top,
              t = shadowFar.y < -1e-3 ? (plane - shadowCorner.y) / shadowFar.y : 1e9;
            shadowCorner.addScaledVector(shadowFar, clamp(t, 0, 1e9));
            // Rays running towards the horizon stop at the edge of the visible ground.
            shadowCorner.x = clamp(shadowCorner.x, centerX - reach, centerX + reach);
            shadowCorner.z = clamp(shadowCorner.z, centerZ - reach, centerZ + reach);
            shadowCorner.y = plane;
            const x = shadowCorner.dot(shadowAxisX),
              y = shadowCorner.dot(shadowAxisY),
              d = shadowCorner.dot(sunDirection);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            minD = Math.min(minD, d);
            maxD = Math.max(maxD, d);
          }
        // Square box, size on a ladder of 8% steps, centre snapped to whole texels.
        const raw = Math.max(maxX - minX, maxY - minY) / 2 + 12,
          half = Math.pow(1.08, Math.ceil(Math.log(Math.max(raw, 64)) / Math.log(1.08))),
          texel = (2 * half) / sun.shadow.mapSize.x,
          cx = Math.round((minX + maxX) / 2 / texel) * texel,
          cy = Math.round((minY + maxY) / 2 / texel) * texel;
        // Anchor the light on the sun-ward side of the view, in the fixed frame.
        const lift = Math.max(700, casterTop + 200),
          anchorD = maxD + lift + 200;
        shadowAnchor
          .copy(shadowAxisX)
          .multiplyScalar(cx)
          .addScaledVector(shadowAxisY, cy)
          .addScaledVector(sunDirection, anchorD);
        sun.position.copy(shadowAnchor);
        sun.target.position.copy(shadowAnchor).sub(sunDirection);
        const cam = sun.shadow.camera,
          near = Math.max(1, anchorD - maxD - lift),
          far = anchorD - minD + 40;
        if (half !== shadowHalfSize || cam.near !== near || cam.far !== far) {
          shadowHalfSize = half;
          cam.left = cam.bottom = -half;
          cam.right = cam.top = half;
          cam.near = near;
          cam.far = far;
          cam.updateProjectionMatrix();
        }
        // Keep acne away without detaching contact shadows: bias in texels.
        sun.shadow.normalBias = clamp(texel * 1.6, 0.35, 4);
      }
      /**
       * LEVEL OF DETAIL FROM THE AIR
       * From a few hundred metres up the camera sees several square kilometres, most
       * of it made of things a few pixels across. These keep the draw count in check
       * (the far copy of the city further down does the rest):
       *  - Scenery detail layers: once the city is built, every small static prop
       *    (benches, bollards, court fittings...) moves to a detail layer the flight
       *    camera stops drawing below DETAIL_ZOOM, and mid-sized ones (lamp posts,
       *    signal gantries, kiosks) to a second layer dropped below FAR_DETAIL_ZOOM.
       *    Lights, sprites (the night glows) and batched scenery always stay.
       *  - People drop out below PEOPLE_ZOOM (render3d.js) and the shadow map is
       *    refreshed less often (static shadows stay put between refreshes).
       *  - Vehicle impostors: below IMPOSTOR_ZOOM, traffic other than the player's
       *    vehicle and aircraft is drawn as two instanced boxes (painted body, dark
       *    cabin) instead of a full model of twenty-odd meshes.
       */
      const DETAIL_LAYER = 3,
        DETAIL_ZOOM = 0.19,
        FAR_DETAIL_LAYER = 4,
        FAR_DETAIL_ZOOM = 0.12,
        PEOPLE_ZOOM = 0.32,
        IMPOSTOR_ZOOM = 0.4,
        PERSON_IMPOSTOR_ZOOM = 0.52,
        PERSON_IMPOSTOR_CAPACITY = 1200,
        IMPOSTOR_CAPACITY = 640;
      for (const layer of [DETAIL_LAYER, FAR_DETAIL_LAYER]) {
        streetCamera.layers.enable(layer);
        flightCamera.layers.enable(layer);
      }
      function tagSceneryDetail() {
        scene.updateMatrixWorld(true);
        scene.traverse((o) => {
          if (!(o.isMesh || o.isLine) || o.isInstancedMesh || o.name === 'static batch') return;
          if (o.userData.dynamic || !o.geometry) return;
          const material = Array.isArray(o.material) ? o.material[0] : o.material;
          if (!material || material.depthTest === false) return;
          // Lit, opaque props only: unlit or transparent meshes are effects, markers
          // and decals that are pooled small and scaled up when used.
          if (!o.isLine && (!material.isMeshStandardMaterial || material.transparent)) return;
          // Size as seen from above: a tall lamp post is still a speck from the air.
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          farBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          const size = Math.max(farBox.max.x - farBox.min.x, farBox.max.z - farBox.min.z);
          if (size < 12) o.layers.set(DETAIL_LAYER);
          else if (size < 30) o.layers.set(FAR_DETAIL_LAYER);
        });
      }
      const impostorBox = new Three.BoxGeometry(1, 1, 1),
        impostorBodies = new Three.InstancedMesh(
          impostorBox,
          new Three.MeshStandardMaterial({ roughness: 0.4, metalness: 0.35 }),
          IMPOSTOR_CAPACITY,
        ),
        impostorCabins = new Three.InstancedMesh(
          impostorBox,
          new Three.MeshStandardMaterial({ color: '#1d2a33', roughness: 0.2, metalness: 0.5 }),
          IMPOSTOR_CAPACITY,
        ),
        impostorMatrix = new Three.Matrix4(),
        impostorPosition = new Three.Vector3(),
        impostorRotation = new Three.Quaternion(),
        impostorScale = new Three.Vector3(),
        impostorUp = new Three.Vector3(0, 1, 0),
        impostorColor = new Three.Color();
      for (const m of [impostorBodies, impostorCabins]) {
        m.count = 0;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        scene.add(m);
      }
      impostorBodies.setColorAt(0, impostorColor);
      let impostorCount = 0;
      function beginVehicleImpostors() {
        impostorCount = 0;
        // Scenery detail drops out of the flight view at the same time.
        flightCamera.layers[flightViewActive && viewZoom < DETAIL_ZOOM ? 'disable' : 'enable'](DETAIL_LAYER);
        flightCamera.layers[flightViewActive && viewZoom < FAR_DETAIL_ZOOM ? 'disable' : 'enable'](FAR_DETAIL_LAYER);
      }
      /**
       * BODY IMPOSTORS
       * Between the full model and the two-box impostor there is a middle level for
       * ordinary cars: every car of a type shares that type's pristine body shell
       * and glasshouse (damage3d.js caches them by size), so all the cars of one
       * type in view are two instanced draws, the body tinted per car, under the
       * same clear-coat paint. The pool for a type is made from the first full
       * model of that type; until one exists the car is drawn normally.
       */
      const BODY_IMPOSTOR_ZOOM = 0.62,
        BODY_POOL_CAPACITY = 160,
        bodyPools = new Map(),
        bodyPaint = new Three.MeshPhysicalMaterial({ roughness: 0.42, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.1 }),
        bodyGroupMatrix = new Three.Matrix4(),
        bodyPartMatrix = new Three.Matrix4();
      function bodyPoolFor(c) {
        let pool = bodyPools.get(c.type);
        if (pool !== undefined) return pool;
        const m = carModels.get(c);
        if (!m) return null;
        // A dented body is its own copy: wait for a pristine one of this type.
        if (m.car && m.shell.geometry.attributes.position.array !== m.shellBase) return null;
        pool = false;
        // Only a closed body (not the roadster's open cockpit) makes a pool.
        if (m.car && m.cabin && m.cabinBase) {
          m.body.updateMatrix();
          m.shell.updateMatrix();
          m.cabin.updateMatrix();
          const make = (geometry, material) => {
            const im = new Three.InstancedMesh(geometry, material, BODY_POOL_CAPACITY);
            im.count = 0;
            im.castShadow = im.receiveShadow = true;
            im.frustumCulled = false;
            im.userData.dynamic = true;
            scene.add(im);
            return im;
          };
          pool = {
            shell: make(m.shell.geometry, bodyPaint),
            cabin: make(m.cabin.geometry, m.cabin.material),
            shellLocal: m.shell.matrix.clone(),
            cabinLocal: m.cabin.matrix.clone(),
            count: 0,
          };
          pool.shell.setColorAt(0, impostorColor);
        }
        bodyPools.set(c.type, pool);
        return pool;
      }
      function bodyImpostor(c) {
        const pool = bodyPoolFor(c);
        if (!pool || pool.count >= BODY_POOL_CAPACITY) return false;
        impostorRotation.setFromAxisAngle(impostorUp, -c.a);
        impostorPosition.set(c.x, 0.1 + entityElevation(c), c.y);
        bodyGroupMatrix.compose(impostorPosition, impostorRotation, impostorScale.set(1, 1, 1));
        pool.shell.setMatrixAt(pool.count, bodyPartMatrix.multiplyMatrices(bodyGroupMatrix, pool.shellLocal));
        pool.cabin.setMatrixAt(pool.count, bodyPartMatrix.multiplyMatrices(bodyGroupMatrix, pool.cabinLocal));
        pool.shell.setColorAt(pool.count, impostorColor.set(c.color || '#888888'));
        pool.count++;
        return true;
      }
      // True when `c` was drawn as an impostor this frame (the caller then hides its model).
      // Zoomed out on the street a car is a couple of dozen pixels long too, so the
      // impostors serve both cameras; the quality tier's lodBias moves the switch.
      function vehicleImpostor(c) {
        const lod = activeTier ? activeTier.lodBias : 1;
        if (viewZoom >= BODY_IMPOSTOR_ZOOM * lod || c === player.car || isAircraft(c)) return false;
        // Intact cars with a body pool; the badly damaged and everything else get
        // the two boxes once they are small enough.
        if (c.hp >= c.maxhp * 0.6 && bodyImpostor(c)) return true;
        if (viewZoom >= IMPOSTOR_ZOOM * lod || impostorCount >= IMPOSTOR_CAPACITY) return false;
        if (c === player.car || isAircraft(c)) return false;
        const spec = vehicleSpec(c),
          length = spec.l,
          width = spec.w * 0.9,
          tall = spec.truck ? 22 : spec.bike || spec.bicycle ? 6 : 10,
          ground = entityElevation(c);
        impostorRotation.setFromAxisAngle(impostorUp, -c.a);
        impostorPosition.set(c.x, ground + tall / 2 + 1, c.y);
        impostorScale.set(length, tall, width);
        impostorBodies.setMatrixAt(impostorCount, impostorMatrix.compose(impostorPosition, impostorRotation, impostorScale));
        impostorBodies.setColorAt(impostorCount, impostorColor.set(c.hp <= 0 ? '#303136' : c.color || '#888888'));
        // Cabin: a darker block set back from the nose (skipped for bikes).
        const cabin = spec.bike || spec.bicycle ? 0 : 1;
        impostorPosition.set(c.x - Math.cos(c.a) * length * 0.08, ground + tall + 2.5, c.y - Math.sin(c.a) * length * 0.08);
        impostorScale.set(length * 0.45 * cabin + 0.001, 5 * cabin + 0.001, width * 0.8);
        impostorCabins.setMatrixAt(impostorCount, impostorMatrix.compose(impostorPosition, impostorRotation, impostorScale));
        impostorCount++;
        return true;
      }
      // Frames between shadow-map refreshes: the street view's cadence, stretched in
      // the air where everything that casts is small and far away.
      function shadowRefreshInterval() {
        const base = activeTier ? activeTier.shadowEvery : touchEnabled() ? 5 : 2;
        if (!flightViewActive || viewZoom >= 0.3) return base;
        return viewZoom < 0.15 ? base * 3 : base * 2;
      }
      /**
       * PEOPLE AT A DISTANCE
       * A pedestrian model is a dozen meshes (torso, head, limbs, hands, gun
       * models); zoomed out, a crowd of them was the largest share of the draw
       * calls. Below PERSON_IMPOSTOR_ZOOM, anyone simply standing or walking is
       * drawn as three instanced parts instead (legs, torso in their own clothing
       * colour, head): three draw calls for the whole crowd. Anyone sitting,
       * falling, swimming, fighting for breath or otherwise posed keeps the full
       * model, as does the player.
       */
      const personMaterial = (color, roughness) => new Three.MeshStandardMaterial({ color, roughness }),
        personImpostorLegs = new Three.InstancedMesh(impostorBox, personMaterial('#343b44', 0.85), PERSON_IMPOSTOR_CAPACITY),
        personImpostorTorso = new Three.InstancedMesh(impostorBox, personMaterial('#ffffff', 0.8), PERSON_IMPOSTOR_CAPACITY),
        personImpostorHead = new Three.InstancedMesh(new Three.IcosahedronGeometry(1, 1), personMaterial('#af8b72', 0.7), PERSON_IMPOSTOR_CAPACITY);
      for (const m of [personImpostorLegs, personImpostorTorso, personImpostorHead]) {
        m.count = 0;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.userData.dynamic = true;
        scene.add(m);
      }
      personImpostorTorso.setColorAt(0, impostorColor);
      let personImpostorCount = 0;
      function personImpostor(p) {
        const lod = activeTier ? activeTier.lodBias : 1;
        if (viewZoom >= PERSON_IMPOSTOR_ZOOM * lod || personImpostorCount >= PERSON_IMPOSTOR_CAPACITY) return false;
        if (p.hp <= 0 || p.hidden || p.sitting || p.swimming || p.parachute || p.ejected || p.illness) return false;
        if (p.poisonCollapse !== undefined || p.drinking || personIncapacitated(p)) return false;
        const i = personImpostorCount++,
          ground = entityElevation(p);
        impostorRotation.setFromAxisAngle(impostorUp, -p.a);
        impostorPosition.set(p.x, ground + 3.6, p.y);
        impostorScale.set(2.6, 7.2, 5);
        personImpostorLegs.setMatrixAt(i, impostorMatrix.compose(impostorPosition, impostorRotation, impostorScale));
        impostorPosition.y = ground + 10.2;
        impostorScale.set(4.6, 6.4, 8.2);
        personImpostorTorso.setMatrixAt(i, impostorMatrix.compose(impostorPosition, impostorRotation, impostorScale));
        personImpostorTorso.setColorAt(i, impostorColor.set(p.color || '#6b5965'));
        impostorPosition.y = ground + 15.3;
        impostorScale.set(2.1, 2.5, 2.1);
        personImpostorHead.setMatrixAt(i, impostorMatrix.compose(impostorPosition, impostorRotation, impostorScale));
        return true;
      }
      // Called once the frame's people have been placed (from renderFrame).
      function endPersonImpostors() {
        const n = personImpostorCount;
        personImpostorCount = 0;
        for (const m of [personImpostorLegs, personImpostorTorso, personImpostorHead]) {
          m.count = n;
          if (n) m.instanceMatrix.needsUpdate = true;
        }
        if (n) personImpostorTorso.instanceColor.needsUpdate = true;
      }
      function endVehicleImpostors() {
        for (const pool of bodyPools.values()) {
          if (!pool) continue;
          pool.shell.count = pool.cabin.count = pool.count;
          if (pool.count) {
            pool.shell.instanceMatrix.needsUpdate = pool.cabin.instanceMatrix.needsUpdate = true;
            pool.shell.instanceColor.needsUpdate = true;
          }
          pool.count = 0;
        }
        impostorBodies.count = impostorCabins.count = impostorCount;
        if (!impostorCount) return;
        impostorBodies.instanceMatrix.needsUpdate = impostorCabins.instanceMatrix.needsUpdate = true;
        impostorBodies.instanceColor.needsUpdate = true;
      }
      /**
       * BUILDING BLOCKS IN TWO DRAW CALLS
       * Each building's main block is the shared unit box with six materials
       * [face, face, top, concrete, face, face], which three.js draws as six calls
       * although four of them are the same facade and the underside is never seen.
       * Once the city is built, every such block is pointed at a copy of the box
       * whose four walls are one index range and which has no underside: two calls
       * (walls, roof) instead of six, on the street as well as in the air.
       */
      function compactBuildingBlocks() {
        const source = boxGeo,
          walls = [0, 1, 4, 5].map((i) => source.groups[i]),
          roof = source.groups[2],
          index = source.index.array,
          order = [];
        for (const g of [...walls, roof]) for (let k = 0; k < g.count; k++) order.push(index[g.start + k]);
        const compact = source.clone();
        compact.setIndex(order);
        compact.clearGroups();
        compact.addGroup(0, walls.reduce((n, g) => n + g.count, 0), 0);
        compact.addGroup(walls.reduce((n, g) => n + g.count, 0), roof.count, 1);
        for (const o of allBuildings)
          o.group.traverse((mesh) => {
            const m = mesh.material;
            if (!mesh.isMesh || mesh.geometry !== source || !Array.isArray(m) || m.length !== 6) return;
            if (m[0] !== m[1] || m[0] !== m[4] || m[0] !== m[5]) return;
            mesh.geometry = compact;
            mesh.material = [m[0], m[2]];
          });
      }
      /**
       * FAR SCENERY
       * The static batches keep one material per building (for each building's own
       * window lighting), so the whole city is ~8000 draw
       * calls, and every building's main block is a six-material box on top. Seen
       * from the street only a few hundred are in view; from high up, all of them.
       * So a second, coarse copy of the city is built once: every piece of batched
       * scenery at least FAR_PIECE_SIZE across seen from above (so parapets, roofs and
       * tree crowns, not posts and trunks), plus the building blocks, merged
       * into a handful of shared materials per 3 km cell. A material's colour goes
       * into vertex colours and its texture repeat into the UVs, so ~7000 materials
       * collapse to the ~20 real combinations of texture and finish, and window
       * lighting follows the average of the buildings it stands for. Below
       * FAR_SCENERY_ZOOM (roughly 500 m up) the flight camera shows this copy instead.
       */
      const SHADOW_PROXY_ZOOM = 0.55,
        SHADOW_PROXY_LAYER = 6,
        FAR_SCENERY_ZOOM = 0.2,
        STREET_FAR_SCENERY_ZOOM = 0.2,
        FAR_PIECE_SIZE = 20,
        farBox = new Three.Box3(),
        FAR_CELL = 3072,
        farPieces = [],
        farScenery = new Three.Group(),
        farHidden = [];
      let farClasses = [],
        farSceneryShown = false,
        shadowProxyShown = false;
      // three.js tests an object's layers against the *view* camera in the shadow
      // pass too (WebGLShadowMap.renderObject), so enabling the proxy layer on the
      // sun's shadow camera does nothing: the proxy never reached the shadow map and
      // the city lost every building shadow between ~150 m and ~500 m up. The view
      // camera's render list is already built when the renderer draws the shadow
      // map, so turning the layer on for the view camera just for that pass puts the
      // proxy into the shadow map and nowhere else.
      {
        const renderShadowMap = renderer.shadowMap.render;
        renderer.shadowMap.render = function (lights, shadowScene, viewCamera) {
          const had = viewCamera.layers.isEnabled(SHADOW_PROXY_LAYER);
          viewCamera.layers.enable(SHADOW_PROXY_LAYER);
          try {
            renderShadowMap.call(this, lights, shadowScene, viewCamera);
          } finally {
            if (!had) viewCamera.layers.disable(SHADOW_PROXY_LAYER);
          }
        };
      }
      farScenery.visible = false;
      scene.add(farScenery);
      function farMaterialUsable(material) {
        return (
          !!material &&
          material.isMeshStandardMaterial &&
          !material.transparent &&
          !material.vertexColors &&
          !material.alphaTest &&
          !material.normalMap
        );
      }
      // Called by batchStaticGroups() for every mesh it merges.
      function noteFarScenery(mesh) {
        if (!farMaterialUsable(mesh.material)) return;
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        farBox.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        if (Math.max(farBox.max.x - farBox.min.x, farBox.max.z - farBox.min.z) < FAR_PIECE_SIZE) return;
        farPieces.push({ geometry, matrix: mesh.matrixWorld.clone(), material: mesh.material, start: 0, count: Infinity });
      }
      function buildFarScenery(staticBatches) {
        // Building blocks: one piece per face group of the multi-material box.
        for (const o of allBuildings)
          o.group.traverse((mesh) => {
            if (!mesh.isMesh || !Array.isArray(mesh.material)) return;
            mesh.updateMatrixWorld(true);
            if (!mesh.geometry.groups.every((g) => farMaterialUsable(mesh.material[g.materialIndex]))) return;
            for (const group of mesh.geometry.groups)
              farPieces.push({
                geometry: mesh.geometry,
                matrix: mesh.matrixWorld,
                material: mesh.material[group.materialIndex],
                start: group.start,
                count: group.count,
              });
            farHidden.push(mesh);
          });
        farHidden.push(...staticBatches.filter((m) => farMaterialUsable(m.material)));
        // Group the pieces by look (texture, finish) and by cell.
        // Tree crowns are finely tessellated spheres; a few pixels across, a coarse
        // one looks the same for a quarter of the vertices.
        const coarseCrowns = new Map();
        for (const piece of farPieces) {
          const g = piece.geometry;
          if (g.type !== 'IcosahedronGeometry' || g.parameters.detail < 2 || piece.count !== Infinity) continue;
          const radius = g.parameters.radius;
          if (!coarseCrowns.has(radius)) coarseCrowns.set(radius, new Three.IcosahedronGeometry(radius, 1));
          piece.geometry = coarseCrowns.get(radius);
        }
        const classes = new Map(),
          position = new Three.Vector3(),
          normal = new Three.Vector3(),
          normalMatrix = new Three.Matrix3(),
          uvMatrix = new Three.Matrix3(),
          uvPoint = new Three.Vector3();
        const keyOf = (m) =>
          [
            m.map ? m.map.source.uuid : '',
            m.emissiveMap ? m.emissiveMap.source.uuid : '',
            m.roughnessMap ? m.roughnessMap.source.uuid : '',
            m.metalnessMap ? m.metalnessMap.source.uuid : '',
            m.emissiveMap || m.emissiveIntensity > 0 ? m.emissive.getHexString() : '',
            m.roughness.toFixed(1),
            m.metalness.toFixed(1),
            m.side,
          ].join('|');
        for (const piece of farPieces) {
          const m = piece.material,
            key = keyOf(m),
            e = piece.matrix.elements,
            cell = Math.floor(e[12] / FAR_CELL) + ',' + Math.floor(e[14] / FAR_CELL);
          let c = classes.get(key);
          if (!c) classes.set(key, (c = { sample: m, members: new Set(), cells: new Map() }));
          c.members.add(m);
          let bucket = c.cells.get(cell);
          if (!bucket) c.cells.set(cell, (bucket = { pieces: [], vertices: 0, indices: 0 }));
          const index = piece.geometry.index,
            total = index ? index.count : piece.geometry.attributes.position.count;
          piece.count = Math.min(piece.count, total - piece.start);
          bucket.pieces.push(piece);
          bucket.vertices += piece.geometry.attributes.position.count;
          bucket.indices += piece.count;
        }
        const identity = (texture) => {
          if (!texture) return null;
          const t = texture.clone();
          t.repeat.set(1, 1);
          t.offset.set(0, 0);
          t.rotation = 0;
          t.needsUpdate = true;
          return t;
        };
        farClasses = [];
        for (const c of classes.values()) {
          const sample = c.sample,
            material = new Three.MeshStandardMaterial({
              vertexColors: true,
              map: identity(sample.map),
              emissiveMap: identity(sample.emissiveMap),
              roughnessMap: identity(sample.roughnessMap),
              metalnessMap: identity(sample.metalnessMap),
              emissive: sample.emissive.clone(),
              emissiveIntensity: sample.emissiveIntensity,
              roughness: sample.roughness,
              metalness: sample.metalness,
              side: sample.side,
            });
          farClasses.push({ material, members: [...c.members] });
          for (const bucket of c.cells.values()) {
            // Each piece copies its geometry's vertices and its own index range.
            const n = bucket.vertices,
              positions = new Float32Array(n * 3),
              normals = new Float32Array(n * 3),
              uvs = new Float32Array(n * 2),
              colors = new Uint8Array(n * 3),
              indices = new Uint32Array(bucket.indices);
            let o = 0,
              io = 0;
            for (const piece of bucket.pieces) {
              const geo = piece.geometry,
                pos = geo.attributes.position,
                nor = geo.attributes.normal,
                uv = geo.attributes.uv,
                idx = geo.index,
                m = piece.material,
                uvSource = m.map || m.emissiveMap || m.roughnessMap;
              normalMatrix.getNormalMatrix(piece.matrix);
              if (uvSource) {
                uvSource.updateMatrix();
                uvMatrix.copy(uvSource.matrix);
              } else uvMatrix.identity();
              for (let k = 0; k < piece.count; k++)
                indices[io++] = o + (idx ? idx.getX(piece.start + k) : piece.start + k);
              for (let i = 0; i < pos.count; i++, o++) {
                position.fromBufferAttribute(pos, i).applyMatrix4(piece.matrix);
                positions[o * 3] = position.x;
                positions[o * 3 + 1] = position.y;
                positions[o * 3 + 2] = position.z;
                if (nor) normal.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
                else normal.set(0, 1, 0);
                normals[o * 3] = normal.x;
                normals[o * 3 + 1] = normal.y;
                normals[o * 3 + 2] = normal.z;
                if (uv) {
                  uvPoint.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(uvMatrix);
                  uvs[o * 2] = uvPoint.x;
                  uvs[o * 2 + 1] = uvPoint.y;
                }
                colors[o * 3] = Math.round(m.color.r * 255);
                colors[o * 3 + 1] = Math.round(m.color.g * 255);
                colors[o * 3 + 2] = Math.round(m.color.b * 255);
              }
            }
            const geometry = new Three.BufferGeometry();
            geometry.setAttribute('position', new Three.BufferAttribute(positions, 3));
            geometry.setAttribute('normal', new Three.BufferAttribute(normals, 3));
            geometry.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
            geometry.setAttribute('color', new Three.BufferAttribute(colors, 3, true));
            geometry.setIndex(new Three.BufferAttribute(indices, 1));
            geometry.computeBoundingSphere();
            // Nothing reads these back on the CPU: let them go once on the GPU.
            for (const attribute of [...Object.values(geometry.attributes), geometry.index])
              attribute.onUpload(function () {
                this.array = null;
              });
            const mesh = new Three.Mesh(geometry, material);
            mesh.castShadow = mesh.receiveShadow = true;
            mesh.name = 'far scenery';
            farScenery.add(mesh);
          }
        }
        farPieces.length = 0;
      }
      // Swap between the full city and the far copy; keep window light in step.
      function updateFarScenery() {
        // Zoomed right out on the street the whole city is in view too, so the far
        // copy serves both cameras (the quality tier's lodBias moves the switch).
        const lod = activeTier ? activeTier.lodBias : 1,
          far = viewZoom < (flightViewActive ? FAR_SCENERY_ZOOM * lookTune.far : STREET_FAR_SCENERY_ZOOM) * lod && farClasses.length > 0; // TEMP-TUNE
        // Between the street and the far view, the full city is drawn but its
        // shadows come from the far copy on a layer only the sun's shadow camera
        // renders: a few dozen merged casters instead of every building batch.
        const proxy = !far && viewZoom < SHADOW_PROXY_ZOOM * lod && farClasses.length > 0;
        if (far !== farSceneryShown || proxy !== shadowProxyShown) {
          farSceneryShown = far;
          shadowProxyShown = proxy;
          farScenery.visible = far || proxy;
          for (const mesh of farScenery.children) mesh.layers.set(proxy ? SHADOW_PROXY_LAYER : 0);
          for (const mesh of farHidden) {
            mesh.visible = !far;
            mesh.castShadow = !proxy;
          }
        }
        if (!far) return;
        for (const c of farClasses) {
          if (!c.material.emissiveMap && !c.members[0].emissiveIntensity) continue;
          let sum = 0;
          for (const m of c.members) sum += m.emissiveIntensity;
          c.material.emissiveIntensity = sum / c.members.length;
        }
      }
      // END SUBSYSTEM: src/flight-view3d.js
