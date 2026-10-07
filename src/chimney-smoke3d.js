      // Wood smoke from the mountain chimneys (the village houses and the 4x4 club) and the club's grill and fire
      // ring: thin, lit, translucent plumes in the effect pool (fxWoodSmoke) from a few steady emitters near the view.
      /**
       * CHIMNEY SMOKE (updateChimneySmoke, from updateMountainVisuals)
       * A wood fire's smoke leaves the pot as a narrow, faint blue-grey thread that widens and thins as it rises,
       * bends over with the wind and wanders a little (the emitter's own slow meander), fading out a few metres up.
       * Each puff is a small slot in the effect pool (fx3d-particles.js: lit per pixel by the sun, sky and fill, so
       * the underside is darker, soft into whatever stands behind it on HIGH/ULTRA) with `thin` 1: its opacity falls
       * as its size grows, so the plume keeps one faint optical depth instead of piling into a white column; the
       * emission rate follows the plume's speed (puffs CHIMNEY_SMOKE.spacing units apart whatever the wind), so a
       * calm night does not stack the puffs into a solid post. Which chimneys burn is fixed per chimney (a hash):
       * a few by day, more at night (dimmer and darker then); the club's own chimney always burns. At most
       * `emitters` (by tier) of the burning chimneys nearest the view's centre (the chase view: the lens) smoke
       * at once; a plume that starts is seeded whole (chimneyPlumeSeed), never growing up out of the pot in view.
       * Console `chimneySmoke()`.
       */
      const CHIMNEY_SMOKE = {
          emitters: { LOW: 3, MEDIUM: 5, HIGH: 7, ULTRA: 8 },
          reach: 140, // beyond the view's reach (units) a chimney does not smoke
          chaseReach: 1200, // the chase view: units from the lens
          dayShare: 0.3, // the share of the houses whose fire is lit by day
          nightShare: 0.6,
          spacing: 3.6, // units between successive puffs along the plume
          minRate: 1.6, // puffs a second
          maxRate: 6,
          life: 7.5, // seconds (each puff 85-115 % of it)
          size: 3.2, // units across at the pot
          grow: 8, // times its first size added over its life (~3.6 m at the top)
          alpha: 0.45, // at the pot; `thin` thins it as it grows
          nightAlpha: 0.28,
          thin: 0.8, // opacity times (first size / size) ^ thin
          efflux: 1.25, // m/s up out of the pot
          buoyancy: 0.5, // m/s it settles to as it cools
          drag: 0.45, // how fast it takes the wind's speed (1/s)
          meander: 0.28, // m/s of the emitter's slow sideways wander
          day: '#9aa2ab', // blue-grey wood smoke (lit by the scene's lights)
          night: '#6a6f75',
        },
        chimneySmokeState = { built: false, lit: 0, emitting: 0, emitted: 0, seeded: 0, nearest: new Int32Array(8), nearestD: new Float64Array(8), rate: 0 },
        chimneySmokeDay = new Three.Color(),
        chimneySmokeNight = new Three.Color(),
        chimneySmokeTint = new Three.Color();
      chimneySmokeDay.set(CHIMNEY_SMOKE.day);
      chimneySmokeNight.set(CHIMNEY_SMOKE.night);
      let chimneySmokeAcc = new Float64Array(0),
        chimneySmokeFire = new Float32Array(0),
        // Whether each chimney smoked last frame (one that starts is given its whole plume at once).
        chimneySmokeOn = new Uint8Array(0),
        chimneyGrillAcc = 0,
        chimneyFireAcc = 0,
        chimneyYardOn = false;
      /* One puff of wood smoke at (x, height y, z) with a sideways start (vx, vz units/s), `scale` its size,
         `night` 0..1 (dimmer, darker), `floor` the height under it; `age` seconds already flown (a plume that comes
         into view whole: the puff is moved along the path the pool's own step would have taken it). */
      function fxWoodSmoke(x, y, z, vx, vz, scale, night, floor, age = 0) {
        const S = CHIMNEY_SMOKE,
          U = UNITS_PER_METRE,
          j = fxBetween(-0.08, 0.08) * U;
        chimneySmokeTint.copy(chimneySmokeDay).lerp(chimneySmokeNight, night);
        const i = fxPuff(
          x + j,
          y,
          z - j,
          vx + fxBetween(-0.12, 0.12) * U,
          S.efflux * U * fxBetween(0.85, 1.15),
          vz + fxBetween(-0.12, 0.12) * U,
          S.life * fxBetween(0.85, 1.15) * Math.sqrt(scale),
          S.size * scale * fxBetween(0.85, 1.15),
          S.grow,
          chimneySmokeTint,
          (S.alpha + (S.nightAlpha - S.alpha) * night) * fxBetween(0.8, 1.1),
          floor,
          S.drag,
          S.buoyancy * U * S.drag,
        );
        if (i < 0) return -1;
        const f = fxs;
        f.thin[i] = S.thin;
        f.fadeIn[i] = 0.1;
        f.spin[i] = fxBetween(-0.15, 0.15);
        if (age > 0) {
          // fxStep's motion in closed form: the velocity relaxes to the wind (sideways) and to rise / drag (up).
          const t = Math.min(age, f.life[i] * 0.95),
            d = f.drag[i],
            k = Math.exp(-d * t),
            breeze = (0.4 + 3.5 * (weather.wind || 0)) * U,
            wx = Math.cos(weather.windAngle || 0) * breeze,
            wz = Math.sin(weather.windAngle || 0) * breeze,
            vt = f.rise[i] / d;
          f.x[i] += wx * t + ((f.vx[i] - wx) * (1 - k)) / d;
          f.z[i] += wz * t + ((f.vz[i] - wz) * (1 - k)) / d;
          f.y[i] += vt * t + ((f.vy[i] - vt) * (1 - k)) / d;
          f.vx[i] = wx + (f.vx[i] - wx) * k;
          f.vz[i] = wz + (f.vz[i] - wz) * k;
          f.vy[i] = vt + (f.vy[i] - vt) * k;
          f.rot[i] += f.spin[i] * t;
          f.life[i] -= t;
        }
        return i;
      }
      /* A plume that comes into view: its puffs at the ages they would have now (one every 1 / rate s), so it
         never grows up out of the pot in front of the player. */
      function chimneyPlumeSeed(x, y, z, id, scale, night, floor, rate) {
        const S = CHIMNEY_SMOKE,
          n = Math.floor(rate * S.life * Math.sqrt(scale));
        let made = 0;
        for (let k = 1; k <= n; k++) {
          const age = k / rate;
          if (fxWoodSmoke(x, y, z, chimneyMeander(id, 0, gameTime - age), chimneyMeander(id, 1, gameTime - age), scale, night, floor, age) >= 0) made++;
        }
        return made;
      }
      // Puffs a second for puffs `spacing` units apart along a plume moving at the wind's speed and its own rise.
      function chimneySmokeRate() {
        const S = CHIMNEY_SMOKE,
          U = UNITS_PER_METRE,
          breeze = (0.4 + 3.5 * (weather.wind || 0)) * U,
          speed = Math.hypot(breeze, (S.efflux + S.buoyancy) * 0.5 * U);
        return clamp(speed / S.spacing, S.minRate, S.maxRate);
      }
      function chimneySmokeBuild() {
        const n = mvChimneys.length;
        chimneySmokeAcc = new Float64Array(n);
        chimneySmokeFire = new Float32Array(n);
        chimneySmokeOn = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          const c = mvChimneys[i];
          // A fixed order in which the fires are lit (a hash of the place): the same houses smoke every visit.
          const h = Math.sin(c.x * 12.9898 + c.z * 78.233) * 43758.5453;
          chimneySmokeFire[i] = c.club ? -1 : h - Math.floor(h);
          chimneySmokeAcc[i] = (i * 0.618) % 1;
        }
        chimneySmokeState.built = true;
      }
      // The emitter's slow sideways wander (m/s): two sines per axis at unrelated rates.
      function chimneyMeander(i, axis, time = gameTime) {
        const p = i * 2.399 + axis * 1.7;
        return (Math.sin(time * 0.53 + p) * 0.65 + Math.sin(time * 1.37 + p * 2.1) * 0.35) * CHIMNEY_SMOKE.meander * UNITS_PER_METRE;
      }
      function updateChimneySmoke(deltaSeconds, night) {
        const S = CHIMNEY_SMOKE,
          st = chimneySmokeState;
        if (!st.built) chimneySmokeBuild();
        if (deltaSeconds <= 0 || !mvChimneys.length) return;
        // (The pool steps at most 0.04 s a frame, render3d-frame.js: the emitters keep to the same clock.)
        deltaSeconds = Math.min(deltaSeconds, 0.04);
        st.lit = 0;
        st.emitting = 0;
        const share = S.dayShare + (S.nightShare - S.dayShare) * night,
          cap = Math.min(st.nearest.length, S.emitters[graphicsTier().name] || 5),
          // The view's centre (the chase view: the lens itself; its view's centre lies far down the street).
          cx = chaseViewActive ? chaseCam.x : viewCenter.x,
          cy = chaseViewActive ? chaseCam.y : viewCenter.y,
          reach = chaseViewActive ? S.chaseReach : viewReach + S.reach;
        // The burning chimneys within reach, the `cap` nearest the view's centre (insertion into a fixed list).
        let kept = 0;
        for (let i = 0; i < mvChimneys.length; i++) {
          if (chimneySmokeFire[i] >= share) continue;
          st.lit++;
          const c = mvChimneys[i],
            dx = c.x - cx,
            dz = c.z - cy;
          if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
          const d = dx * dx + dz * dz;
          let k;
          if (kept < cap) k = kept++;
          else if (d >= st.nearestD[cap - 1]) continue;
          else k = cap - 1;
          while (k > 0 && st.nearestD[k - 1] > d) {
            st.nearestD[k] = st.nearestD[k - 1];
            st.nearest[k] = st.nearest[k - 1];
            k--;
          }
          st.nearestD[k] = d;
          st.nearest[k] = i;
        }
        const rate = chimneySmokeRate();
        st.rate = rate;
        st.emitting = kept;
        // Those that stopped smoking (out of reach, or put out): the next start is seeded whole.
        for (let i = 0; i < chimneySmokeOn.length; i++) chimneySmokeOn[i] = chimneySmokeOn[i] === 1 ? 2 : 0;
        for (let k = 0; k < kept; k++) {
          const i = st.nearest[k],
            c = mvChimneys[i],
            floor = c.y - 6 * UNITS_PER_METRE;
          if (chimneySmokeOn[i] === 0) st.seeded += chimneyPlumeSeed(c.x, c.y, c.z, i, c.club ? 1.15 : 1, night, floor, rate);
          chimneySmokeOn[i] = 1;
          let acc = chimneySmokeAcc[i] + rate * deltaSeconds;
          while (acc >= 1) {
            acc -= 1;
            if (fxWoodSmoke(c.x, c.y, c.z, chimneyMeander(i, 0), chimneyMeander(i, 1), c.club ? 1.15 : 1, night, floor) >= 0) st.emitted++;
          }
          chimneySmokeAcc[i] = acc;
        }
        for (let i = 0; i < chimneySmokeOn.length; i++) if (chimneySmokeOn[i] === 2) chimneySmokeOn[i] = 0;
      }
      /* The 4x4 club's yard: the grill's thin cooking smoke, and the fire ring's wood smoke (more at night).
         `near` is whether the club is in view (offroad3d-mud.js updateOffroadVisuals). */
      function updateClubYardSmoke(deltaSeconds, near) {
        if (!near) chimneyYardOn = false;
        if (!near || deltaSeconds <= 0) return;
        deltaSeconds = Math.min(deltaSeconds, 0.04);
        const gr = OFFROAD_CLUB.grill,
          fr = OFFROAD_CLUB.fire,
          night = nightAmount > 0.3 ? 1 : nightAmount / 0.3,
          rate = chimneySmokeRate();
        if (!chimneyYardOn) {
          chimneyYardOn = true;
          chimneyPlumeSeed(gr.x, 8.2, gr.y, 901, 0.7, night * 0.5, 0.5, rate * 0.8);
          chimneyPlumeSeed(fr.x, 3, fr.y, 902, 1, night, 0.5, rate * (0.35 + 0.65 * night));
        }
        chimneyGrillAcc += rate * 0.8 * deltaSeconds;
        while (chimneyGrillAcc >= 1) {
          chimneyGrillAcc -= 1;
          fxWoodSmoke(gr.x, 8.2, gr.y, chimneyMeander(901, 0), chimneyMeander(901, 1), 0.7, night * 0.5, 0.5);
        }
        chimneyFireAcc += rate * (0.35 + 0.65 * night) * deltaSeconds;
        while (chimneyFireAcc >= 1) {
          chimneyFireAcc -= 1;
          fxWoodSmoke(fr.x, 3, fr.y, chimneyMeander(902, 0), chimneyMeander(902, 1), 1, night, 0.5);
        }
      }
      function chimneyPuffSummary() {
        const f = fxs;
        let n = 0,
          lo = Infinity,
          hi = -Infinity,
          big = 0,
          old = 0,
          top = -1;
        for (let i = 0; i < f.n; i++) {
          if (!(f.thin[i] > 0)) continue;
          n++;
          lo = Math.min(lo, f.y[i]);
          if (f.y[i] > hi) {
            hi = f.y[i];
            top = i;
          }
          const t = 1 - f.life[i] / f.max[i];
          big = Math.max(big, f.size[i] * (1 + f.grow[i] * (1 - (1 - t) * (1 - t))));
          old = Math.max(old, t);
        }
        if (!n) return { live: 0 };
        // How many the pool's draw would leave out now (behind the camera, or the chase view's budget).
        const e = camera.matrixWorld.elements;
        let culled = 0,
          hidden = 0;
        for (let i = 0; i < f.n; i++) {
          if (!(f.thin[i] > 0)) continue;
          const t = 1 - f.life[i] / f.max[i],
            size = f.size[i] * (1 + f.grow[i] * (1 - (1 - t) * (1 - t))),
            depth = -(f.x[i] - e[12]) * e[8] - (f.y[i] - e[13]) * e[9] - (f.z[i] - e[14]) * e[10];
          if (depth < -size) culled++;
          else if (chaseSpriteHidden(f.x[i], f.y[i], f.z[i], size)) hidden++;
        }
        // The highest puff as the pool draws it: map position, size and opacity (drawFxParticles' fades).
        const t = 1 - f.life[top] / f.max[top],
          size = f.size[top] * (1 + f.grow[top] * (1 - (1 - t) * (1 - t))),
          alpha = f.alpha[top] * (1 - t * t) * Math.pow(f.size[top] / size, f.thin[top]);
        return {
          live: n,
          lowest: Math.round(lo),
          highest: Math.round(hi),
          largest: Math.round(big),
          oldest: +old.toFixed(2),
          culled,
          hidden,
          top: { x: Math.round(f.x[top]), y: Math.round(f.z[top]), height: Math.round(f.y[top]), size: Math.round(size), alpha: +alpha.toFixed(3), age: +t.toFixed(2) },
        };
      }
      /* DeadEndCity.chimneySmoke(options): the chimney plumes' settings and what they emit now; `options` may set the
         look's numbers for an A/B ({ alpha, nightAlpha, size, grow, life, thin, spacing }, finite and positive; reseed: true seeds every
         plume again). */
      function chimneySmokeReport(options) {
        if (options && typeof options === 'object')
          for (const key of ['alpha', 'nightAlpha', 'size', 'grow', 'life', 'thin', 'spacing'])
            if (Number.isFinite(options[key]) && options[key] > 0) CHIMNEY_SMOKE[key] = options[key];
        // `reseed`: every plume (and the club's yard) is seeded whole again next frame, with the numbers now set.
        if (options?.reseed) {
          chimneySmokeOn.fill(0);
          chimneyYardOn = false;
        }
        const S = CHIMNEY_SMOKE,
          st = chimneySmokeState,
          live = Math.round(st.emitting * st.rate * S.life);
        return {
          chimneys: mvChimneys.length,
          club: mvChimneys.some((c) => c.club),
          lit: st.lit,
          emitting: st.emitting,
          cap: S.emitters[graphicsTier().name] || 5,
          rate: +st.rate.toFixed(2),
          puffsPerPlume: Math.round(st.rate * S.life),
          liveEstimate: live,
          emitted: st.emitted,
          seeded: st.seeded,
          // The plume nearest the view's centre: its pot (map x, y and height).
          nearest: st.emitting ? { x: Math.round(mvChimneys[st.nearest[0]].x), y: Math.round(mvChimneys[st.nearest[0]].z), height: Math.round(mvChimneys[st.nearest[0]].y), club: !!mvChimneys[st.nearest[0]].club } : null,
          life: S.life,
          sizeMetres: [+(S.size / UNITS_PER_METRE).toFixed(2), +((S.size * (1 + S.grow)) / UNITS_PER_METRE).toFixed(2)],
          alpha: [S.alpha, S.nightAlpha],
          thin: S.thin,
          wind: { speed: +(0.4 + 3.5 * (weather.wind || 0)).toFixed(2), angle: +(weather.windAngle || 0).toFixed(2) },
          pool: { live: fxs.n, dropped: fxs.dropped },
          // The wood-smoke slots alive now (the pool's `thin` puffs): how many, their heights and sizes.
          puffs: chimneyPuffSummary(),
        };
      }
