      // Effect recipes on the particle pool (fx3d-particles.js): a blast's flash, fireball, smoke column, dust ring,
      // sparks and debris; muzzle flashes; bullet strikes by surface; flames on fires and burning vehicles; smoke.
      /**
       * FX RECIPES (sizes in metres times UNITS_PER_METRE; renderer only: nothing here changes the game)
       *  - BLAST (fxExplosion, the api's explosion(); power 1 is a rocket, 0.65 a car's tank): a white-hot
       *    flash for a tenth of a second; a fireball of puffs thrown out at 9-22 m/s that stop within a few
       *    metres and cool from yellow-white through orange into soot in about half a second; a column of
       *    dark smoke that keeps rising for 6-10 s and leans with the wind; dust rolled out along the
       *    ground; sparks and embers that arc, streak and bounce; chunks of road (the debris pool,
       *    damage3d-decals.js); the flash light dying away over ~0.8 s (fxFlashLight). No flat ring on the
       *    ground (at eye level it was a disc lying in the street).
       *  - MUZZLE (fxMuzzle): a star-shaped flash turned at random, a plume stretched along the barrel, a
       *    hot core, a faint wisp of smoke and the spent case; a rocket's backblast.
       *  - STRIKES (fxImpact): masonry spits a cone of dust and chips out of the wall along its normal at the
       *    hole's height (bulletHole() notes the hole it just made, fxNoteHole), the ground kicks up a spurt of
       *    dirt, metal throws streaking sparks, glass a glitter, water a splash.
       *  - FLAMES (fxFlames): a fire is a stream of short-lived flame puffs, hot at birth, rising, stretched
       *    by their speed and cooling into smoke: a ground fire after a blast (fxGroundFire), a burning engine
       *    bay or a wreck (damage3d-bodies.js flameAt).
       * The counts of the big recipes follow the graphics tier (fxTierShare).
       */
      const FX_SOOT = new Three.Color('#24221f'),
        FX_SMOKE_DARK = new Three.Color('#36373a'),
        FX_SMOKE_GREY = new Three.Color('#55575a'),
        FX_DUST = new Three.Color('#968b7a'),
        FX_DUST_LIGHT = new Three.Color('#b9af9f'),
        FX_DIRT = new Three.Color('#6c604f'),
        FX_CHIP = new Three.Color('#8e877c'),
        FX_ASPHALT = '#3f4144',
        FX_SPARK = new Three.Color('#ffa543'),
        FX_SPARK_HOT = new Three.Color('#fff0c2'),
        FX_FLASH_COLOR = new Three.Color('#ffd89e'),
        FX_GUN_SMOKE = new Three.Color('#c3c5c6'),
        FX_ROCKET_SMOKE = new Three.Color('#c9c6bb'),
        FX_BRASS = new Three.Color('#caa55e'),
        FX_WATER = new Three.Color('#dcedf5'),
        FX_GLASS_A = new Three.Color('#e4f1f7'),
        FX_GLASS_B = new Three.Color('#9fc4d6'),
        FX_SPRAY_A = new Three.Color('#e2f1f8'),
        FX_SPRAY_B = new Three.Color('#bcd9e6');
      // The last blast's light: the flash, then the fireball's glow dying with it (fxFlashLight).
      const fxBlast = { born: -10, power: 0, x: 0, y: 0, z: 0 },
        // The bullet hole bulletHole() just made (damage3d-world.js): the strike that follows uses its height and normal.
        fxHole = { at: -1, x: 0, y: 0, z: 0, nx: 0, ny: 0 };
      function fxNoteHole(x, y, z, nx, ny) {
        fxHole.at = gameTime;
        fxHole.x = x;
        fxHole.y = y;
        fxHole.z = z;
        fxHole.nx = nx;
        fxHole.ny = ny;
      }
      function fxPuffFrame() {
        return Math.floor(fxRandom() * FX_PUFF_FRAMES);
      }
      /* A puff of smoke, dust or steam that grows `grow` times over its life, drifts with the wind and
         settles to its rise speed (rise / drag); `ground` is the height under it. */
      function fxPuff(x, y, z, vx, vy, vz, life, size, grow, color, alpha, ground, drag = 1.6, rise = 0) {
        const i = fxAdd(x, y, z, vx, vy, vz, life, size, color, alpha);
        if (i < 0) return -1;
        const s = fxs;
        s.frame[i] = fxPuffFrame();
        s.grow[i] = grow;
        s.drag[i] = drag;
        s.rise[i] = rise;
        s.wind[i] = 1;
        s.spin[i] = fxBetween(-0.5, 0.5);
        s.fadeIn[i] = 0.06;
        s.floor[i] = ground;
        return i;
      }
      /* A bit that falls and bounces: a chip, a casing, a drop (frame FX_DROP) or a glint. */
      function fxBit(x, y, z, vx, vy, vz, life, size, color, alpha, ground, frame = FX_DROP) {
        const i = fxAdd(x, y, z, vx, vy, vz, life, size, color, alpha);
        if (i < 0) return -1;
        const s = fxs;
        s.frame[i] = frame;
        s.gravity[i] = 9.81 * UNITS_PER_METRE;
        s.bounce[i] = 0.32;
        s.drag[i] = 0.25;
        s.floor[i] = ground;
        return i;
      }
      /* A spark or an ember: a glowing streak that arcs and bounces. */
      function fxSpark(x, y, z, vx, vy, vz, life, size, ground, gain = 3.5) {
        const i = fxBit(x, y, z, vx, vy, vz, life, size, fxRandom() < 0.3 ? FX_SPARK_HOT : FX_SPARK, 0, ground, FX_GLOW);
        if (i < 0) return -1;
        fxs.glow[i] = gain;
        fxs.streak[i] = 0.032;
        fxs.drag[i] = 0.5;
        return i;
      }
      /* The old effect record ({x, y, z, vx, vy, vz, life, max, color, size} with `case`, `glow`, `smoke`, `glass`,
         `spin`, `floor`) as a slot, with the same motion: a case falls (120 units/s/s) and bounces, a glow adds
         light, anything else is a puff that triples in size, slowing sideways and rising at its first speed. */
      function fxLegacy(o) {
        const i = fxAdd(o.x, o.y, o.z, o.vx, o.vy, o.vz, o.life, o.size, cachedColor(o.color), o.glow ? 0 : o.smoke ? 0.56 : 0.92);
        if (i < 0) return -1;
        const s = fxs;
        s.max[i] = Math.max(o.max || o.life, o.life);
        if (o.glass) {
          s.frame[i] = FX_GLASS;
          s.spin[i] = o.spin || 0;
        } else if (o.glow) {
          s.frame[i] = FX_GLOW;
          s.glow[i] = 1.8;
        } else if (o.case) s.frame[i] = FX_DROP;
        else {
          s.frame[i] = fxPuffFrame();
          s.grow[i] = 2;
          s.drag[i] = 1.83;
          s.rise[i] = o.vy * 1.83;
          s.wind[i] = 0.6;
          s.spin[i] = fxBetween(-0.4, 0.4);
          s.fadeIn[i] = 0.05;
        }
        if (o.case) {
          s.gravity[i] = 120;
          s.bounce[i] = 0.35;
          s.floor[i] = o.floor ?? 0.5;
        }
        return i;
      }
      // ---- Blasts --------------------------------------------------------------------------------
      function fxExplosion(x, z, power, altitude) {
        const U = UNITS_PER_METRE,
          s = fxs,
          share = fxTierShare(),
          p = Math.max(0.2, power),
          root = Math.sqrt(p),
          terrain = terrainHeight(x, z),
          // A burst well above the ground (the side jobs' fireworks, a shell in the air): no dust, no road.
          airborne = altitude > terrain + 5 * U,
          ground = airborne ? terrain : altitude,
          base = altitude + 1.4 * U * root;
        // The flash: a white-hot core, a star, gone in a tenth of a second.
        let i = fxAdd(x, base, z, 0, 0, 0, 0.09, 7 * U * p, FX_FLASH_COLOR, 0);
        if (i >= 0) {
          s.frame[i] = FX_GLOW;
          s.glow[i] = 6;
          s.floor[i] = -1e5;
        }
        i = fxAdd(x, base, z, 0, 0, 0, 0.05, 6 * U * p, FX_FLASH_COLOR, 0);
        if (i >= 0) {
          s.frame[i] = FX_FLASH;
          s.glow[i] = 5;
          s.floor[i] = -1e5;
        }
        // The fireball: one rolling mass of overlapping puffs thrown out and stopped within a few metres by the
        // air; the ones thrown furthest (its skin) cool first, so it chars from the outside in as it climbs.
        const balls = Math.max(10, Math.round(22 * share));
        for (let k = 0; k < balls; k++) {
          const a = fxRandom() * TAU,
            up = fxBetween(-0.2, 0.9),
            flat = Math.sqrt(1 - up * up),
            dx = Math.cos(a) * flat,
            dz = Math.sin(a) * flat,
            throwShare = fxRandom(),
            speed = (6 + 9 * throwShare) * U * root,
            r0 = fxRandom() * 1.2 * U * p;
          i = fxAdd(x + dx * r0, base + up * r0, z + dz * r0, dx * speed, up * speed + 2.5 * U, dz * speed, fxBetween(2.4, 3.6), fxBetween(3, 4.4) * U * p, k % 3 ? FX_SOOT : FX_SMOKE_DARK, 0.9);
          if (i < 0) break;
          s.frame[i] = k % FX_PUFF_FRAMES;
          s.grow[i] = 1.1;
          s.heat[i] = 1;
          s.cool[i] = (0.62 - 0.34 * throwShare) * fxBetween(0.85, 1.15);
          s.drag[i] = 5;
          // Hot gas: about 3 m/s up once the throw is spent (rise / drag).
          s.rise[i] = 14 * U;
          s.wind[i] = 0.5;
          s.spin[i] = fxBetween(-1, 1);
          s.fadeIn[i] = 0.012;
          s.floor[i] = ground;
        }
        // The column: dark smoke rolling up out of the fireball for most of a second, rising for 6-10 s.
        const column = Math.max(8, Math.round(20 * share));
        for (let k = 0; k < column; k++) {
          const a = fxRandom() * TAU,
            r = fxRandom() * 1.6 * U * p;
          i = fxAdd(x + Math.cos(a) * r, base + fxBetween(0.5, 2.5) * U * p, z + Math.sin(a) * r, fxBetween(-1.5, 1.5) * U, fxBetween(3, 6) * U * root, fxBetween(-1.5, 1.5) * U, fxBetween(6, 10), fxBetween(3, 4.4) * U * p, k % 2 ? FX_SMOKE_DARK : FX_SMOKE_GREY, fxBetween(0.62, 0.82));
          if (i < 0) break;
          s.delay[i] = 0.05 + (k / column) * 0.9;
          s.frame[i] = fxPuffFrame();
          s.grow[i] = 1.7;
          s.drag[i] = 0.55;
          s.rise[i] = 1.4 * U;
          s.wind[i] = 1;
          s.spin[i] = fxBetween(-0.3, 0.3);
          s.fadeIn[i] = 0.08;
          s.floor[i] = ground;
          // The first of it still glows from below.
          if (k < column / 3) {
            s.heat[i] = 0.35;
            s.cool[i] = 0.35;
          }
        }
        // Dust rolled out along the street by the shock.
        const ring = airborne ? 0 : Math.max(6, Math.round(14 * share));
        for (let k = 0; k < ring; k++) {
          const a = ((k + fxRandom() * 0.8) / ring) * TAU,
            speed = fxBetween(14, 26) * U * root;
          i = fxPuff(x + Math.cos(a) * U, ground + 0.6 * U, z + Math.sin(a) * U, Math.cos(a) * speed, fxBetween(0.3, 1.4) * U, Math.sin(a) * speed, fxBetween(1.8, 3), fxBetween(1.6, 2.4) * U * root, 1.8, FX_DUST, 0.5, ground, 3.2);
        }
        // Sparks and embers.
        const sparks = Math.max(10, Math.round(28 * share));
        for (let k = 0; k < sparks; k++) {
          const a = fxRandom() * TAU,
            up = fxBetween(0.1, 0.95),
            flat = Math.sqrt(1 - up * up),
            speed = fxBetween(12, 34) * U * root;
          i = fxSpark(x, base, z, Math.cos(a) * flat * speed, up * speed, Math.sin(a) * flat * speed, fxBetween(0.5, 1.5), fxBetween(0.12, 0.26) * U, ground, fxBetween(2.5, 5));
        }
        // Chunks of the road (the debris pool's lit, shadowed pieces).
        const chunks = airborne ? 0 : Math.max(4, Math.round(10 * share));
        for (let k = 0; k < chunks; k++) {
          const a = fxRandom() * TAU;
          spawnChunks(x, ground + 2, z, Math.cos(a), Math.sin(a), 1, FX_ASPHALT, 1.1 * root, false);
        }
        fxBlast.born = gameTime;
        fxBlast.power = p;
        fxBlast.x = x;
        fxBlast.y = base + 1.5 * U;
        fxBlast.z = z;
      }
      /* The muzzle light (render3d-effects.js) during a blast: the flash, then the fireball's glow, flickering;
         a shot's own flash takes it back. From render3d-frame.js each frame. */
      function fxFlashLight() {
        const age = gameTime - fxBlast.born;
        if (age >= 0 && age < 0.85 && hypot2(fxBlast.x - player.x, fxBlast.z - player.y) < 700) {
          const level = fxBlast.power * (2400 * Math.exp(-age * 16) + 1100 * Math.exp(-age * 3.4)) * (0.86 + 0.14 * Math.sin(gameTime * 53));
          if (gameTime > muzzleUntil || level > muzzleLight.intensity) {
            muzzleLight.position.set(fxBlast.x, fxBlast.y, fxBlast.z);
            muzzleLight.distance = 340;
            muzzleLight.intensity = level;
          }
        } else if (gameTime > muzzleUntil) muzzleLight.intensity = 0;
      }
      // ---- Guns ----------------------------------------------------------------------------------
      function fxMuzzle(x, z, a, rocket, altitude, height) {
        const U = UNITS_PER_METRE,
          s = fxs,
          y = height + altitude,
          ca = Math.cos(a),
          sa = Math.sin(a),
          reach = rocket ? 5 : 2.5;
        // The flash: a star at the muzzle (turned at random, never the same twice), a plume of flame stretched
        // along the barrel, a hot core.
        let i = fxAdd(x + ca * (reach + 1), y, z + sa * (reach + 1), 0, 0, 0, rocket ? 0.09 : 0.05, (rocket ? 2.4 : 0.62) * U, FX_FLASH_COLOR, 0);
        if (i >= 0) {
          s.frame[i] = FX_FLASH;
          s.glow[i] = rocket ? 7 : 6;
          s.floor[i] = -1e5;
        }
        i = fxAdd(x + ca * (reach + 3), y, z + sa * (reach + 3), ca * 10 * U, 0, sa * 10 * U, rocket ? 0.08 : 0.045, (rocket ? 1.2 : 0.34) * U, FX_FLASH_COLOR, 0);
        if (i >= 0) {
          s.frame[i] = FX_GLOW;
          s.glow[i] = 5;
          s.streak[i] = 0.05;
          s.floor[i] = -1e5;
        }
        i = fxAdd(x + ca * reach, y, z + sa * reach, 0, 0, 0, rocket ? 0.08 : 0.045, (rocket ? 3 : 0.45) * U, FX_FLASH_COLOR, 0);
        if (i >= 0) {
          s.frame[i] = FX_GLOW;
          s.glow[i] = rocket ? 4 : 2.5;
          s.floor[i] = -1e5;
        }
        if (rocket) {
          // The backblast: a cone of smoke thrown out behind the tube.
          for (let k = 0; k < 6; k++) {
            const spread = fxBetween(-0.35, 0.35),
              speed = fxBetween(8, 15) * U;
            fxPuff(x - ca * 4, y, z - sa * 4, -Math.cos(a + spread) * speed, fxBetween(0, 1.5) * U, -Math.sin(a + spread) * speed, fxBetween(1.4, 2.2), 0.8 * U, 3, FX_ROCKET_SMOKE, 0.45, altitude, 2.6, 0.4 * U);
          }
          return;
        }
        // A faint wisp of smoke, and the spent case thrown out to the right.
        for (let k = 0; k < 2; k++)
          fxPuff(x + ca * reach, y, z + sa * reach, ca * fxBetween(1.5, 3) * U, fxBetween(0.2, 0.6) * U, sa * fxBetween(1.5, 3) * U, fxBetween(0.9, 1.4), 0.3 * U, 3, FX_GUN_SMOKE, 0.2, altitude, 2.2, 0.5 * U);
        i = fxAdd(x, y, z, -sa * 42, 44, ca * 42, 1.7, 1.5, FX_BRASS, 0.95);
        if (i >= 0) {
          s.frame[i] = FX_DROP;
          s.gravity[i] = 120;
          s.bounce[i] = 0.35;
          s.floor[i] = altitude + 0.35;
          s.twinkle[i] = 0.5;
        }
      }
      /* A rocket's motor flame and its smoke trail (apache.js; `motor` 1 while it burns, less as it coasts). */
      function fxRocketTrail(x, z, altitude, motor) {
        const U = UNITS_PER_METRE,
          y = altitude + 9;
        if (motor >= 1) {
          const i = fxAdd(x, y, z, 0, 0, 0, 0.06, 0.9 * U, FX_FLASH_COLOR, 0);
          if (i >= 0) {
            fxs.frame[i] = FX_GLOW;
            fxs.glow[i] = 5;
            fxs.floor[i] = -1e5;
          }
        }
        fxPuff(x + fxBetween(-1.5, 1.5), y, z + fxBetween(-1.5, 1.5), fxBetween(-4, 4), fxBetween(2, 7), fxBetween(-4, 4), 1.4 * motor + 0.6, (0.5 + motor * 0.25) * U, 3.2, FX_ROCKET_SMOKE, 0.55, altitude, 1.2, 4);
      }
      // ---- Bullet strikes ---------------------------------------------------------------------
      function fxImpact(x, z, kind, altitude) {
        const U = UNITS_PER_METRE,
          s = fxs,
          ground = altitude;
        let px = x,
          py = 5 + altitude,
          pz = z,
          nx = 0,
          nz = 0,
          wall = false;
        // A strike into a wall or a shop window comes out of the hole just made, along the wall's normal.
        if ((kind === 'wall' || kind === 'glass') && fxHole.at === gameTime && Math.abs(fxHole.x - x) < 6 && Math.abs(fxHole.y - z) < 6) {
          px = fxHole.x + fxHole.nx * 1.5;
          py = fxHole.z;
          pz = fxHole.y + fxHole.ny * 1.5;
          nx = fxHole.nx;
          nz = fxHole.ny;
          wall = true;
        }
        if (kind === 'metal') {
          const flash = fxAdd(px, py, pz, 0, 0, 0, 0.045, 0.45 * U, FX_SPARK_HOT, 0);
          if (flash >= 0) {
            s.frame[flash] = FX_GLOW;
            s.glow[flash] = 3;
            s.floor[flash] = -1e5;
          }
          for (let k = 0; k < 9; k++) {
            const a = fxRandom() * TAU,
              up = fxBetween(0.05, 0.9),
              flat = Math.sqrt(1 - up * up),
              speed = fxBetween(9, 26) * U;
            fxSpark(px, py, pz, Math.cos(a) * flat * speed, up * speed, Math.sin(a) * flat * speed, fxBetween(0.15, 0.42), fxBetween(0.08, 0.14) * U, ground);
          }
          fxPuff(px, py, pz, 0, 0.4 * U, 0, 0.6, 0.22 * U, 2.5, FX_SMOKE_GREY, 0.22, ground, 2);
          return;
        }
        if (kind === 'glass') {
          for (let j = 0; j < 10; j++) {
            const i = fxAdd(px, py, pz, (fxRandom() - 0.5) * 100 + nx * 30, 35 + fxRandom() * 55, (fxRandom() - 0.5) * 100 + nz * 30, 0.18 + fxRandom() * 0.22, 2.6 + fxRandom() * 1.6, j % 2 ? FX_GLASS_A : FX_GLASS_B, 0.92);
            if (i < 0) break;
            s.frame[i] = FX_GLASS;
            s.max[i] = 0.4;
            s.spin[i] = (fxRandom() - 0.5) * 18;
            s.gravity[i] = 120;
            s.bounce[i] = 0.35;
            s.floor[i] = 0.5 + ground;
          }
          return;
        }
        if (kind === 'water') {
          for (let j = 0; j < 9; j++) fxBit(px, 5 + altitude, pz, (fxRandom() - 0.5) * 30, 50 + fxRandom() * 60, (fxRandom() - 0.5) * 30, 0.48 + fxRandom() * 0.22, 2.2, FX_WATER, 0.9, altitude - 2);
          for (let j = 0; j < 2; j++) fxPuff(px, 2 + altitude, pz, fxBetween(-6, 6), fxBetween(6, 14), fxBetween(-6, 6), 0.8, 0.5 * U, 2, FX_WATER, 0.28, altitude - 1, 2.4);
          return;
        }
        if (wall) {
          // Masonry: a cone of dust out of the hole and chips thrown after it.
          const tx = -nz,
            tz = nx;
          for (let k = 0; k < 4; k++) {
            const out = fxBetween(3, 8) * U,
              side = fxBetween(-1.6, 1.6) * U;
            fxPuff(px, py, pz, nx * out + tx * side, fxBetween(0.2, 1.4) * U, nz * out + tz * side, fxBetween(0.9, 1.6), fxBetween(0.3, 0.45) * U, 3.2, FX_DUST_LIGHT, 0.5, ground, 3.2, -0.25 * U);
          }
          for (let k = 0; k < 5; k++) {
            const out = fxBetween(4, 11) * U,
              side = fxBetween(-3, 3) * U;
            fxBit(px, py, pz, nx * out + tx * side, fxBetween(1, 4) * U, nz * out + tz * side, fxBetween(0.7, 1.2), fxBetween(0.5, 0.9), FX_CHIP, 1, ground);
          }
          return;
        }
        // The ground (or a strike with no wall to come out of): a spurt of dirt and dust.
        for (let k = 0; k < 3; k++) fxPuff(px + fxBetween(-1, 1), ground + 1, pz + fxBetween(-1, 1), fxBetween(-1.5, 1.5) * U, fxBetween(2.5, 6) * U, fxBetween(-1.5, 1.5) * U, fxBetween(0.8, 1.3), fxBetween(0.3, 0.42) * U, 3, kind === 'dust' ? FX_DUST : FX_DUST_LIGHT, 0.5, ground, 2.6, -0.3 * U);
        for (let k = 0; k < 3; k++) fxBit(px, ground + 1, pz, fxBetween(-2, 2) * U, fxBetween(3, 7) * U, fxBetween(-2, 2) * U, fxBetween(0.6, 1), fxBetween(0.5, 0.8), kind === 'dust' ? FX_DIRT : FX_CHIP, 1, ground);
      }
      // ---- Fire ------------------------------------------------------------------------------
      /* Flame puffs from a patch `width` units across at (x, height y, z): on average `rate` a second, `strength`
         0..1 (a dying fire is cooler and thinner), over `dt` seconds. */
      function fxFlames(x, y, z, width, strength, rate, dt, ground) {
        const U = UNITS_PER_METRE,
          s = fxs,
          due = rate * dt * fxTierShare();
        let count = Math.floor(due) + (fxRandom() < due % 1 ? 1 : 0);
        while (count-- > 0) {
          const i = fxAdd(x + fxBetween(-0.5, 0.5) * width, y + fxBetween(0, 0.25) * width, z + fxBetween(-0.5, 0.5) * width, fxBetween(-0.4, 0.4) * U, fxBetween(1.5, 3) * U, fxBetween(-0.4, 0.4) * U, fxBetween(0.42, 0.8), width * fxBetween(0.36, 0.58), FX_SOOT, 0.42 * strength);
          if (i < 0) return;
          s.frame[i] = fxPuffFrame();
          s.heat[i] = 0.55 + 0.45 * strength;
          s.cool[i] = fxBetween(0.2, 0.32);
          s.grow[i] = 0.6;
          s.rise[i] = 3.6 * U;
          s.drag[i] = 1.5;
          s.wind[i] = 0.6;
          // Tongues: stretched up along their rise.
          s.streak[i] = 0.15;
          s.fadeIn[i] = 0.1;
          s.floor[i] = ground;
        }
        // Embers carried up on the heat, flickering as they drift off with the wind.
        if (fxRandom() < rate * dt * 0.12 * strength) {
          const i = fxAdd(x + fxBetween(-0.4, 0.4) * width, y + width * 0.4, z + fxBetween(-0.4, 0.4) * width, fxBetween(-1, 1) * U, fxBetween(1.5, 3.5) * U, fxBetween(-1, 1) * U, fxBetween(1.2, 2.6), fxBetween(0.05, 0.09) * U, FX_SPARK, 0);
          if (i < 0) return;
          s.frame[i] = FX_GLOW;
          s.glow[i] = 2.2;
          s.twinkle[i] = 3;
          s.rise[i] = 1.2 * U;
          s.drag[i] = 0.9;
          s.wind[i] = 1;
          s.streak[i] = 0.05;
          s.floor[i] = ground;
        }
      }
      /* Smoke off a fire or a hurt engine: `size` units across at birth, rising at about `rise` units a second. */
      function fxSmoke(x, y, z, color, size, rise, alpha, ground, life = 2.4) {
        return fxPuff(x + fxBetween(-2, 2), y, z + fxBetween(-2, 2), fxBetween(-2, 2), rise * 0.7, fxBetween(-2, 2), life * fxBetween(0.85, 1.15), size * 0.7, 2.6, color, alpha, ground, 1.1, rise * 1.1);
      }
      /* A fire on the ground (a blast's burning fuel, game `fires`): flames over a patch by its power, dark smoke
         above (lighter once the first fuel has burnt off). */
      function fxGroundFire(fire, altitude, fade, deltaSeconds) {
        const U = UNITS_PER_METRE,
          age = fire.max - fire.life;
        fxFlames(fire.x, altitude + 0.4 * U, fire.y, 3 * U * fire.power, fade, 42 * Math.max(0.4, fire.power), deltaSeconds, altitude);
        if (fxRandom() < deltaSeconds * 9 * fxTierShare())
          fxSmoke(fire.x + fxBetween(-1, 1) * U, altitude + 2.2 * U * fire.power, fire.y + fxBetween(-1, 1) * U, age > 8 ? FX_SMOKE_GREY : FX_SMOKE_DARK, 2.4 * U * fire.power, 3.4 * U, 0.6 * fade, altitude, 4.2);
      }
