      // Ride wheels: every four-wheeled model's wheels follow their springs' travel on terrain (terrain-suspension.js
      // ride.d), as the 4x4 club trucks' axles do, so a tyre neither sinks into a rock nor hangs in the air.
      /**
       * RIDE WHEELS
       * rideStep (terrain-suspension.js) poses the body on four tyre springs and leaves each wheel's travel in
       * `c.ride.d` (world units: the ground under that tyre less the body's corner over it, + pushed up, − hanging).
       * The club trucks' knuckles read it (offroad3d-kits.js animateOffroadVehicle); every other model with four or more
       * wheels (cars, the downloaded bodies, police, trucks) moves each wheel group up or down by it here, eased, within
       * the springs' droop and bump. Off the terrain (or settled) the offsets ease back to nothing and stop being written;
       * a car drawn merged is left as built (no extra draw calls).
       * A wheel's height is `userData.baseY - userData.drop` (damage3d-bodies.js: a flat or burnt tyre) `+ userData.rideY`.
       * Only reads game state.
       */
      function rideWheels(c, m, deltaSeconds) {
        const wheels = m.wheels;
        // A car drawn merged (vehicle-merge3d.js) keeps its wheels where they were built.
        if (!wheels || wheels.length < 4 || m.knuckles || m.bike || m.merged) return;
        const ride = c.ride && !c.ride.handed && c.offroadState ? c.ride : null;
        if (!ride && !m.rideWheelsOn) return;
        const spec = vehicleSpec(c),
          rm = rideModel(spec),
          ease = 1 - Math.exp(-deltaSeconds * 40);
        // Model units per world unit (the body may be drawn at a scale), measured once.
        if (m.rideWheelScale === undefined) {
          const parent = wheels[0].wheel.parent;
          parent.updateWorldMatrix(true, false);
          m.rideWheelScale = 1 / Math.max(1e-6, rideWheelsScale.setFromMatrixScale(parent.matrixWorld).y);
        }
        let moving = false;
        for (let i = 0; i < wheels.length; i++) {
          const wheel = wheels[i].wheel;
          if (!wheel.position) continue;
          const u = wheel.userData;
          if (u.baseY === undefined) u.baseY = wheel.position.y;
          let target = 0;
          if (ride) {
            const right = wheel.position.z > 0 ? 1 : 0,
              w = clamp((wheel.position.x / m.rideWheelScale / rm.a + 1) / 2, 0, 1),
              d = ride.d[2 + right] + (ride.d[right] - ride.d[2 + right]) * w;
            target = clamp(d, -rm.droop, rm.bump + RIDE_STOP) * m.rideWheelScale;
          }
          const was = u.rideY || 0;
          let next = was + (target - was) * ease;
          if (!ride && Math.abs(next) < 0.002) next = 0;
          if (next !== was) {
            u.rideY = next;
            wheel.position.y = u.baseY - (u.drop || 0) + next;
          }
          if (next !== 0) moving = true;
        }
        m.rideWheelsOn = moving;
      }
      const rideWheelsScale = new Three.Vector3();
