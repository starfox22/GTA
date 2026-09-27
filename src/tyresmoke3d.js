      // Tyre smoke, dust and road spray: soft billboards thrown up from the wheels of any road
      // vehicle in view (slides, wheelspin, locked wheels, the handbrake; sand and lawns; soaked roads).
      /**
       * TYRE SMOKE (updateTyreSmoke, after the vehicles are posed)
       * Reads what the physics already says about each vehicle, never changes it:
       *  - SMOKE on tarmac from the player's `c.tyreSlip` (a slide past ten degrees,
       *    locked or spinning wheels, the understeer scrub, the handbrake) and from a
       *    traffic or police car's `c.sliding`: grey-white puffs that swell, rise a
       *    little, drift with the car's wake and hang for a second or two; from the
       *    rear wheels, the fronts when they are the ones scrubbing (`c.skid`) or a
       *    front-driven car spins them.
       *  - DUST on the beach's sand and the city parks' lawns, from any wheel moving
       *    at speed (more when it slides). The county's dirt and mud are offroad3d's.
       *  - SPRAY on wet tarmac (`weather.wet`): a fine mist off every wheel from about
       *    35 km/h, growing with speed and wetness, so traffic in the rain trails it.
       * One instanced billboard pool (offroad3d-mud.js billboardPool): one draw call;
       * its size is TYRE_SMOKE_CAPACITY, of which the graphics tier uses a share
       * (TYRE_SMOKE_TIER). Nothing allocates per frame.
       */
      const TYRE_SMOKE_CAPACITY = 420,
        TYRE_SMOKE_TIER = { LOW: [140, 0.5], MEDIUM: [260, 0.75], HIGH: [420, 1], ULTRA: [420, 1] },
        TYRE_SMOKE_COLOR = new Three.Color('#e3e3df'),
        TYRE_DUST_SAND = new Three.Color('#dcc79c'),
        TYRE_DUST_LAWN = new Three.Color('#a39a78'),
        TYRE_SPRAY_COLOR = new Three.Color('#dfe7ee'),
        TYRE_SMOKE_ATTRIBUTES = ['iPos', 'iSize', 'iAlpha', 'iColor'];
      const tyreSmoke = billboardPool(TYRE_SMOKE_CAPACITY, 'tyre smoke');
      tyreSmoke.mesh.renderOrder = 4;
      const tyreSmokeStats = { emitted: 0, peak: 0 };
      function tyrePuff(x, y, z, vx, vy, vz, size, grow, alpha, life, color, cap) {
        const p = tyreSmoke;
        if (p.count >= cap) return;
        const i = p.count++;
        p.x[i] = x;
        p.y[i] = y;
        p.z[i] = z;
        p.vx[i] = vx;
        p.vy[i] = vy;
        p.vz[i] = vz;
        p.size[i] = size;
        p.grow[i] = grow;
        p.alpha[i] = alpha;
        p.life[i] = p.max[i] = life;
        p.r[i] = color.r;
        p.g[i] = color.g;
        p.b[i] = color.b;
        tyreSmokeStats.emitted++;
      }
      /* `count` puffs from each wheel of one axle, `forward` along the body from
         its middle (units). */
      function tyreAxlePuffs(c, spec, forward, count, kind, cap) {
        const cos = Math.cos(c.a),
          sin = Math.sin(c.a),
          track = spec.bike || spec.bicycle ? 0 : spec.w * 0.4,
          ground = entityElevation(c) + 0.35 * UNITS_PER_METRE,
          vx = c.vx || 0,
          vy = c.vy || 0,
          U = UNITS_PER_METRE;
        for (let n = 0; n < count; n++)
          for (let side = track ? -1 : 0; side <= (track ? 1 : 0); side += 2) {
            const x = c.x + cos * forward - sin * side * track + randomBetween(-0.3, 0.3) * U,
              z = c.y + sin * forward + cos * side * track + randomBetween(-0.3, 0.3) * U;
            if (kind === 'spray')
              tyrePuff(x, ground, z, vx * 0.55 + randomBetween(-1, 1) * U, randomBetween(0.6, 1.4) * U, vy * 0.55 + randomBetween(-1, 1) * U, 0.9 * U, 3.2 * U, 0.2, randomBetween(0.45, 0.8), TYRE_SPRAY_COLOR, cap);
            else if (kind === 'smoke')
              tyrePuff(x, ground, z, vx * 0.25 + randomBetween(-1.5, 1.5) * U, randomBetween(0.3, 1) * U, vy * 0.25 + randomBetween(-1.5, 1.5) * U, 1.3 * U, 2.4 * U, 0.42, randomBetween(1.3, 2.2), TYRE_SMOKE_COLOR, cap);
            else
              tyrePuff(x, ground, z, vx * 0.35 + randomBetween(-1.2, 1.2) * U, randomBetween(0.6, 1.8) * U, vy * 0.35 + randomBetween(-1.2, 1.2) * U, 1.1 * U, 2 * U, kind === 'sand' ? 0.5 : 0.32, randomBetween(0.8, 1.5), kind === 'sand' ? TYRE_DUST_SAND : TYRE_DUST_LAWN, cap);
          }
      }
      function vehicleTyreSmoke(c, m, deltaSeconds, cap, share) {
        const spec = vehicleSpec(c);
        if (spec.tank || c.cliffAir || c.deckAir || c.overturned || c.fallen) return;
        const speed = Math.hypot(c.vx || 0, c.vy || 0);
        if (!(speed > 4 * KMH) && !(c.wheelSpin > 0.3)) {
          m.tyreSmokeDue = 0;
          return;
        }
        // The county's dirt and mud belong to offroad3d.js (vehicleSpray).
        if (c.offroadState && !c.offroadState.paved) return;
        const rearX = c.x - Math.cos(c.a) * spec.l * 0.3,
          rearY = c.y - Math.sin(c.a) * spec.l * 0.3,
          sand = onBeach(rearX, rearY),
          lawn = !sand && !!parkAt(rearX, rearY) && !onRoad(rearX, rearY),
          slip = c === player.car ? c.tyreSlip || 0 : c.sliding ? 0.7 : 0,
          spin = spec.bicycle ? 0 : c.wheelSpin || 0;
        let rate = 0,
          kind = 'smoke';
        if (sand || lawn) {
          kind = sand ? 'sand' : 'lawn';
          rate = clamp((speed - 12 * KMH) / (60 * KMH), 0, 1) * (sand ? 16 : 8) + slip * 30 + spin * 20;
        } else if (!spec.bicycle) {
          const smoke = Math.max(slip, spin * 0.9);
          if (smoke > 0.15) rate = (smoke - 0.1) * (smoke - 0.1) * 60;
          const wet = weather.wet || 0;
          if (rate < 1 && wet > 0.25 && speed > 35 * KMH && !isBoat(c)) {
            kind = 'spray';
            rate = clamp((speed - 35 * KMH) / (90 * KMH), 0, 1) * (wet - 0.2) * 34;
          }
        }
        if (rate <= 0) {
          m.tyreSmokeDue = 0;
          return;
        }
        m.tyreSmokeDue = (m.tyreSmokeDue || 0) + rate * share * deltaSeconds;
        if (m.tyreSmokeDue < 1) return;
        const count = Math.min(4, Math.floor(m.tyreSmokeDue));
        m.tyreSmokeDue -= count;
        // Which axle: the fronts when they scrub wide or a front-driven car spins them.
        const front = c === player.car && ((c.skid || 0) > 0.3 || (spin > 0.3 && spec.drive === 'fwd'));
        tyreAxlePuffs(c, spec, (front ? 0.3 : -0.3) * spec.l, count, kind, cap);
        if (kind === 'spray') tyreAxlePuffs(c, spec, 0.3 * spec.l, count, kind, cap);
      }
      function updateTyreSmoke(deltaSeconds) {
        const p = tyreSmoke;
        if (deltaSeconds > 0) {
          const tier = TYRE_SMOKE_TIER[graphicsTier().name] || TYRE_SMOKE_TIER.MEDIUM,
            cap = tier[0],
            share = tier[1],
            reach = viewReach + 80;
          for (const [c, m] of carModels)
            if (m.group.visible && !isAircraft(c) && !isBoat(c) && Math.abs(c.x - viewCenter.x) < reach && Math.abs(c.y - viewCenter.y) < reach)
              vehicleTyreSmoke(c, m, deltaSeconds, cap, share);
          // Drift: the puffs slow in the air, rise a little and swell.
          const drag = Math.exp(-2.4 * deltaSeconds);
          let n = p.count;
          for (let i = n - 1; i >= 0; i--) {
            p.life[i] -= deltaSeconds;
            if (p.life[i] <= 0) {
              n--;
              p.x[i] = p.x[n];
              p.y[i] = p.y[n];
              p.z[i] = p.z[n];
              p.vx[i] = p.vx[n];
              p.vy[i] = p.vy[n];
              p.vz[i] = p.vz[n];
              p.life[i] = p.life[n];
              p.max[i] = p.max[n];
              p.size[i] = p.size[n];
              p.grow[i] = p.grow[n];
              p.alpha[i] = p.alpha[n];
              p.r[i] = p.r[n];
              p.g[i] = p.g[n];
              p.b[i] = p.b[n];
              continue;
            }
            p.vx[i] *= drag;
            p.vz[i] *= drag;
            p.vy[i] *= drag;
            p.x[i] += p.vx[i] * deltaSeconds;
            p.y[i] += p.vy[i] * deltaSeconds;
            p.z[i] += p.vz[i] * deltaSeconds;
            p.size[i] += p.grow[i] * deltaSeconds;
          }
          p.count = n;
          tyreSmokeStats.peak = Math.max(tyreSmokeStats.peak, n);
        }
        const at = p.geo.attributes,
          n = p.count;
        for (let i = 0; i < n; i++) {
          const t = p.life[i] / p.max[i];
          at.iPos.setXYZ(i, p.x[i], p.y[i], p.z[i]);
          at.iSize.setX(i, p.size[i]);
          // Fades in over the first moment, out with its age.
          at.iAlpha.setX(i, p.alpha[i] * t * Math.min(1, (1 - t) * 6));
          at.iColor.setXYZ(i, p.r[i], p.g[i], p.b[i]);
        }
        if (n) for (const name of TYRE_SMOKE_ATTRIBUTES) at[name].needsUpdate = true;
        p.geo.instanceCount = n;
        p.mesh.visible = n > 0;
        // Lit like the mud mist: the day's light, much less at night.
        p.mesh.material.uniforms.uLight.value = (1 - 0.72 * nightAmount) * 0.86;
      }
      /* DeadEndCity.tyreSmoke(): puffs alive, the tier's cap, emitted since boot, peak. */
      function tyreSmokeReport() {
        const cap = (TYRE_SMOKE_TIER[graphicsTier().name] || TYRE_SMOKE_TIER.MEDIUM)[0];
        return { live: tyreSmoke.count, cap, capacity: TYRE_SMOKE_CAPACITY, emitted: tyreSmokeStats.emitted, peak: tyreSmokeStats.peak };
      }
