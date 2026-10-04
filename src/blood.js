    // Blood: wound spatter, drops, the pool a body bleeds out slowly (bleed, bodyPool, addBloodPool/Drop), their
    // stamps (bloodStamp), growth and ageing (updateBlood), the 2D decals and the blood console report.
    /**
     * BLOOD
     * One entry in `bloodPools` is one ground decal: a pool, a spatter, a drop or
     * a tyre track (physics-knockdowns.js). The renderers (civic3d.js, drawBlood2D)
     * only draw them: `r` is the decal's radius in world units, `stretch` its
     * length along `a`, `variant` the stamp.
     *
     * A hit is not a pool. A round that opens a wound throws a puff of red mist
     * and an exit spray away from the shooter (the heading of the shot): a plume,
     * a cone of fine drops landing a metre or more beyond the body, a directional
     * spatter behind it and a drop at its feet; the body itself does not move.
     * Only a body on the ground bleeds a pool: it starts small under the torso
     * and spreads fast, most of it in 10-15 s (a volume that flows out ever
     * slower), larger the more wounds it took (POOL SIZE). A blast or a car at speed gives a larger,
     * faster pool and a radial spray. Anyone wounded who keeps moving drips a
     * trail (wounds.js). Everything fades after BLOOD_LIFE seconds; at most
     * BLOOD_LIMIT decals exist, and the oldest spatter and drops go first.
     *
     * bleed(entity, severity, heading, kind) is the one entry for a wound: other
     * code (a rider thrown off a bike, a fall) calls it with kind 'impact' or
     * 'fall'; severity 0.25 a graze .. 1 a pistol round .. 2.5 the worst.
     */
    const BLOOD_LIMIT = 240,
      BLOOD_LIFE = 240,
      BLOOD_TRACK_DISTANCE = BLOCK_SIZE * 0.07,
      BLOOD_POOL = 0,
      BLOOD_SPATTER = 4,
      BLOOD_DROP = 8,
      BLOOD_VARIANTS = 12,
      bloodArt = [];
    function bloodSurface(x, y) {
      return DOCKS.some((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h)
        ? 2.2
        : terrainHeight(x, y);
    }
    /* The decal art, 128 px, drawn once per variant. A stamp's visible radius is
       about 51 px: drawn at 2.5 r across, it is r world units. Dark venous red,
       near black where it is thick, no highlight (the material gives the sheen). */
    function bloodStamp(variant = 0) {
      if (bloodArt[variant]) return bloodArt[variant];
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      let state = 731 + variant * 977;
      const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const blobs = (list, grow, style) => {
        g.fillStyle = style;
        g.beginPath();
        for (const c of list)
          if (c.r + grow > 0.4) {
            g.moveTo(c.x + c.r + grow, c.y);
            g.arc(c.x, c.y, c.r + grow, 0, TAU);
          }
        g.fill();
      };
      if (variant < BLOOD_SPATTER) {
        // A pool: a round body with rounded lobes where it ran, a thin redder
        // rim where it is shallow, near black at the centre.
        const lobes = [{ x: 64, y: 64, r: 34 + random() * 4 }],
          n = 5 + Math.floor(random() * 4);
        for (let i = 0; i < n; i++) {
          const a = random() * TAU,
            d = 12 + random() * 16;
          lobes.push({ x: 64 + Math.cos(a) * d, y: 64 + Math.sin(a) * d, r: Math.min(50 - d, 11 + random() * 13) });
        }
        blobs(lobes, 0, 'rgba(112, 13, 21, 0.8)');
        blobs(lobes, -2.5, 'rgba(76, 6, 13, 0.96)');
        blobs(lobes, -9, 'rgba(50, 3, 8, 0.95)');
        for (let i = 0; i < 5; i++) {
          const a = random() * TAU,
            d = 45 + random() * 9;
          blobs([{ x: 64 + Math.cos(a) * d, y: 64 + Math.sin(a) * d, r: 0.8 + random() * 1.6 }], 0, 'rgba(84, 8, 15, 0.9)');
        }
      } else if (variant < BLOOD_DROP) {
        // A spatter thrown along +x from the wound at the left: a few heavy
        // drops near it, then ever finer ones, each drawn out along its flight
        // with a tail, spread in a narrow fan.
        const ox = 18;
        blobs(
          [
            { x: ox, y: 64, r: 6 + random() * 3 },
            { x: ox + 7, y: 64 + (random() - 0.5) * 8, r: 4 + random() * 3 },
            { x: ox + 3, y: 64 + (random() - 0.5) * 14, r: 3 + random() * 2 },
          ],
          0,
          'rgba(84, 7, 14, 0.96)',
        );
        for (let i = 0; i < 42; i++) {
          const t = Math.pow(random(), 0.8),
            d = 10 + t * 94,
            a = (random() + random() - 1) * 0.45,
            size = (6.5 - t * 4.8) * (0.6 + random() * 0.6),
            x = ox + Math.cos(a) * d,
            y = 64 + Math.sin(a) * d;
          g.fillStyle = t > 0.55 && i % 2 ? 'rgba(128, 16, 26, 0.85)' : 'rgba(92, 8, 16, 0.96)';
          g.beginPath();
          g.ellipse(x, y, size * (1.2 + t * 1.3), size, a, 0, TAU);
          g.fill();
          if (size > 1.2) {
            const tail = size * (1.4 + t * 1.6);
            g.beginPath();
            g.ellipse(x + Math.cos(a) * tail, y + Math.sin(a) * tail, size * 0.45, size * 0.3, a, 0, TAU);
            g.fill();
          }
        }
      } else {
        // A drop: a round splash with a scalloped edge, darker in its middle,
        // and now and then a satellite or two.
        const r = 30 + random() * 6,
          phase = random() * TAU,
          k = 7 + Math.floor(random() * 5);
        g.fillStyle = 'rgba(96, 10, 17, 0.93)';
        g.beginPath();
        for (let i = 0; i <= 36; i++) {
          const a = (i * TAU) / 36,
            rr = r * (1 + 0.07 * Math.sin(a * k + phase) + (random() - 0.5) * 0.06);
          i ? g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr) : g.moveTo(64 + rr, 64);
        }
        g.fill();
        blobs([{ x: 63, y: 64, r: r * 0.66 }], 0, 'rgba(62, 5, 11, 0.9)');
        const satellites = Math.floor(random() * 4);
        for (let i = 0; i < satellites; i++) {
          const a = random() * TAU,
            d = r + 7 + random() * 14;
          blobs([{ x: 64 + Math.cos(a) * d, y: 64 + Math.sin(a) * d, r: 1.4 + random() * 2.4 }], 0, 'rgba(84, 8, 15, 0.92)');
        }
      }
      bloodArt[variant] = cv;
      return cv;
    }
    /* Add a ground decal (a pool unless `extra.variant` says otherwise). Over the
       limit, the oldest decal that is not a spreading pool goes. */
    function addBloodPool(x, y, r, a, extra = {}) {
      if (!groundAt(x, y)) return null;
      const b = {
        x,
        y,
        r,
        a,
        created: gameTime,
        variant: BLOOD_POOL + Math.floor(seededRandom() * 4),
        surface: bloodSurface(x, y),
        ...extra,
      };
      bloodPools.push(b);
      if (bloodPools.length > BLOOD_LIMIT) {
        const i = bloodPools.findIndex((o) => !o.rMax);
        bloodPools.splice(i < 0 ? 0 : i, 1);
      }
      return b;
    }
    /* A single drop, drawn out along `a` by `extra.stretch` when it landed moving. */
    function addBloodDrop(x, y, r, a, extra = {}) {
      return addBloodPool(x, y, r, a, { variant: BLOOD_DROP + Math.floor(seededRandom() * 4), opacity: 0.9, ...extra });
    }
    /* A spatter fanned out along `a` from (x, y): the stamp's origin sits on the point. */
    function addBloodSpatter(x, y, r, a, surface, stretch = 1.5) {
      const off = 0.36 * 2.5 * r * stretch;
      return addBloodPool(x + Math.cos(a) * off, y + Math.sin(a) * off, r, a, {
        variant: BLOOD_SPATTER + Math.floor(seededRandom() * 4),
        stretch,
        opacity: 0.92,
        surface,
      });
    }
    /* The drawn size of a decal (world units across and along its heading). */
    function bloodDecalScale(b) {
      if (b.track) return { along: b.r * 2.6, across: b.r * 0.46 };
      return { along: b.r * 2.5 * (b.stretch || 1), across: b.r * 2.5 };
    }
    function bloodFade(b) {
      return (b.opacity ?? 0.95) * clamp((BLOOD_LIFE - (gameTime - b.created)) / 35, 0, 1);
    }
    /* A wound. `a` is the heading the shot travelled (blood leaves the exit side). */
    function bleed(p, severity = 1, a = 0, kind = 'ballistic') {
      if (!bloodOn || !p || p.poisoned) return;
      // A living body that bled before long ago (or came back: the player) starts over;
      // someone wounded on the floor keeps their wounds and the pool they lie in.
      if (p.hp > 0 && ((p.bloodPool && !p.bloodPool.wounded) || gameTime - (p.bloodAt ?? -1e9) > 90)) {
        p.bloodHits = 0;
        p.bloodPool = null;
      }
      severity = clamp(severity, 0.1, 2.5);
      p.bloodHits = (p.bloodHits || 0) + 1;
      p.bloodAt = gameTime;
      const z = entityElevation(p),
        roof = rooftopFloor(p),
        ground = (x, y) => (roof ? z : bloodSurface(x, y)),
        blast = kind === 'blast',
        impact = kind === 'impact' || kind === 'fall';
      // The mist: a brief dark-red puff at the wound, drifting the way the round went.
      particles.push({
        x: p.x + Math.cos(a) * 2,
        y: p.y + Math.sin(a) * 2,
        vx: Math.cos(a) * 22,
        vy: Math.sin(a) * 22,
        z: z + (impact ? 4 : 10),
        vz: 3,
        life: 0.35,
        max: 0.35,
        color: '#6a0c13',
        size: 1.4 + severity * (blast ? 1.6 : 0.8),
        mist: true,
      });
      const round = !blast && !impact;
      // A round's exit plume: a finer, wider cloud carried a metre or two on past the
      // body, away from the shooter.
      if (round)
        particles.push({
          x: p.x + Math.cos(a) * 4,
          y: p.y + Math.sin(a) * 4,
          vx: Math.cos(a) * 46,
          vy: Math.sin(a) * 46,
          z: z + 10,
          vz: 1,
          life: 0.5,
          max: 0.5,
          color: '#5c0910',
          size: 1.6 + severity * 0.9,
          mist: true,
        });
      // Flying drops: for a round an exit spray, a narrow cone of fine drops flying
      // on along the shot and landing behind the body; a spray round a blast or a car.
      const drops = blast ? 16 + Math.round(severity * 6) : impact ? 7 + Math.round(severity * 4) : 3 + Math.round(severity * 4),
        cone = blast ? Math.PI : impact ? 0.9 : 0.32;
      for (let i = 0; i < drops; i++) {
        const spread = a + randomBetween(-cone, cone),
          v = round ? randomBetween(35, 100) : randomBetween(35, 115) * (blast ? 1.4 : 1),
          life = round ? randomBetween(0.7, 1.1) : randomBetween(0.5, 1);
        particles.push({
          x: p.x + (round ? Math.cos(a) * 2 : 0),
          y: p.y + (round ? Math.sin(a) * 2 : 0),
          vx: Math.cos(spread) * v,
          vy: Math.sin(spread) * v,
          z: z + (impact ? 5 : 10),
          vz: round ? randomBetween(4, 24) : randomBetween(8, 34),
          life,
          max: life,
          color: randomChoice(['#5e0710', '#720a15', '#4a050c']),
          size: round ? randomBetween(0.4, 1.05) : randomBetween(0.45, 1.15),
          blood: true,
          surface: roof ? z : undefined,
        });
      }
      // On the ground: the spatter behind the wound (radial round a blast), a second
      // one further on from a heavy round, and a drop at the feet.
      const splats = blast ? 5 + Math.round(severity * 2) : impact ? 2 : severity > 0.8 ? 2 : 1;
      for (let i = 0; i < splats; i++) {
        const aa = blast ? a + (i * TAU) / splats + randomBetween(-0.4, 0.4) : a + randomBetween(-0.25, 0.25),
          r = (blast ? randomBetween(3.2, 5) : impact ? randomBetween(2.6, 3.8) : randomBetween(2.6, 3.6)) * (0.75 + Math.min(severity, 2) * 0.2),
          d = round ? (i ? randomBetween(9, 15) : randomBetween(3, 7)) : randomBetween(2, 5),
          x = p.x + Math.cos(aa) * d,
          y = p.y + Math.sin(aa) * d;
        addBloodSpatter(x, y, round && i ? r * 0.8 : r, aa, ground(x, y), blast ? 1.3 : round ? 1.8 : 1.6);
      }
      // The drop at the feet falls from the wound: under the body, a little to the exit side.
      const lean = round ? randomBetween(0.3, 2) : 0,
        fx = p.x + Math.cos(a) * lean + randomBetween(-1.5, 1.5),
        fy = p.y + Math.sin(a) * lean + randomBetween(-1.5, 1.5);
      addBloodDrop(fx, fy, randomBetween(0.7, 1.2), randomBetween(0, TAU), { surface: ground(fx, fy) });
      if (p.hp <= 0) bodyPool(p, kind, a);
    }
    /**
     * POOL SIZE
     * The pool under a body on the ground: it spreads from under the torso and
     * grows as the body bleeds out. Called by bleed() for the dead (and by
     * updateWounds for the wounded lying still, kind 'wounded'); a later wound
     * only makes it larger and quicker. Every body holds about the same blood:
     * the pool grows with the number of wounds it runs from, not with how hard
     * the killing round hit. Units (8 a metre): one fatal round ends about r 6
     * (1.5 m across), several up to 8.5 (2.1 m); a car or a blast 7.5-11.5; a
     * wounded person lying still 2.6-4. The volume flows out on `tau` (most of the
     * spread in the first 10-15 s, easing out); a fresh pool starts at r 1.2.
     */
    const BLOOD_POOL_ROUND = 6,
      BLOOD_POOL_ROUND_MAX = 8.5,
      BLOOD_POOL_PER_WOUND = 0.8,
      BLOOD_POOL_TAU = 6.5,
      BLOOD_POOL_TAU_MIN = 3.5;
    function bodyPoolPlan(kind, hits) {
      const blast = kind === 'blast',
        impact = kind === 'impact' || kind === 'fall';
      if (kind === 'wounded') return { rMax: clamp(2.6 + (hits - 1) * 0.5, 2.6, 4), tau: 9, r0: 0.9 };
      if (blast || impact)
        return { rMax: clamp(BLOOD_POOL_ROUND + (hits - 1) * 0.7 + (blast ? 3 : 1.6), 7.5, 11.5), tau: blast ? 3 : 4, r0: blast ? 3 : 1.8 };
      return {
        rMax: clamp(BLOOD_POOL_ROUND + (hits - 1) * BLOOD_POOL_PER_WOUND, BLOOD_POOL_ROUND, BLOOD_POOL_ROUND_MAX),
        tau: clamp(BLOOD_POOL_TAU - (hits - 1) * 0.8, BLOOD_POOL_TAU_MIN, BLOOD_POOL_TAU),
        r0: 1.2,
      };
    }
    function bodyPool(p, kind = 'ballistic', a = 0, surface = null) {
      if (!bloodOn || !p || p.poisoned) return null;
      const hits = Math.max(1, p.bloodHits || 1),
        blast = kind === 'blast',
        impact = kind === 'impact' || kind === 'fall',
        wounded = kind === 'wounded',
        plan = bodyPoolPlan(kind, hits),
        rMax = plan.rMax,
        tau = plan.tau;
      let b = p.bloodPool;
      if (b && bloodPools.includes(b)) {
        b.rMax = Math.max(b.rMax, rMax);
        b.tau = Math.min(b.tau, tau);
        // The wounded die where they lay: the same pool, now a body's.
        if (!wounded) b.wounded = false;
        return b;
      }
      // Under the chest: the body lies along the line of the shot (wounds.js
      // chooseDeathFall); slumped against a wall it pools at the wall's foot.
      const style = p.deathStyle,
        lie = style?.slump || wounded ? 0 : blast || impact ? 1.5 : 4,
        la = a + (style?.turn || 0),
        x = p.x + Math.cos(la) * lie,
        y = p.y + Math.sin(la) * lie,
        r0 = plan.r0;
      b = addBloodPool(x, y, r0, randomBetween(0, TAU), {
        rMax,
        tau,
        wounded,
        vol: r0 * r0,
        opacity: 0.97,
        surface: surface ?? (rooftopFloor(p) ? entityElevation(p) : bloodSurface(x, y)),
      });
      p.bloodPool = b;
      return b;
    }
    /* Pools spread (a flow that slows as the body empties); old decals go. */
    function updateBlood(deltaSeconds) {
      for (let i = bloodPools.length - 1; i >= 0; i--) {
        const b = bloodPools[i];
        if (gameTime - b.created > BLOOD_LIFE) {
          bloodPools.splice(i, 1);
          continue;
        }
        if (!b.rMax) continue;
        const full = b.rMax * b.rMax;
        if (b.vol >= full * 0.998) continue;
        b.vol += (full - b.vol) * (1 - Math.exp(-deltaSeconds / b.tau));
        b.r = Math.max(b.r, Math.sqrt(b.vol));
      }
    }
    function drawBlood2D(roof = false) {
      for (const b of bloodPools)
        if (rooftopFloor(b) === roof && visible(b, 45)) {
          worldContext.save();
          worldContext.globalAlpha = bloodFade(b);
          worldContext.translate(b.x, b.y);
          worldContext.rotate(b.a);
          if (b.track) {
            worldContext.fillStyle = '#86101e';
            worldContext.fillRect(-b.r * 1.3, -b.r * 0.23, b.r * 2.6, b.r * 0.46);
            worldContext.fillStyle = '#3b171833';
            for (let x = -b.r; x < b.r; x += 1.4)
              worldContext.fillRect(x, -b.r * 0.23, 0.5, b.r * 0.46);
          } else {
            const s = bloodDecalScale(b);
            worldContext.drawImage(bloodStamp(b.variant || 0), -s.along / 2, -s.across / 2, s.along, s.across);
          }
          worldContext.restore();
        }
    }
    /* Console: the decals round a point, by kind, and the pools' sizes. */
    function bloodReport(x = player.x, y = player.y, radius = 120) {
      const near = bloodPools.filter((b) => Math.hypot(b.x - x, b.y - y) < radius),
        kindOf = (b) => (b.track ? 'track' : b.rMax ? 'pool' : b.variant >= BLOOD_DROP ? 'drop' : b.variant >= BLOOD_SPATTER ? 'spatter' : 'stain');
      const counts = { pool: 0, spatter: 0, drop: 0, track: 0, stain: 0 };
      for (const b of near) counts[kindOf(b)]++;
      return {
        total: bloodPools.length,
        near: counts,
        largest: +Math.max(0, ...near.filter((b) => !b.track).map((b) => b.r)).toFixed(2),
        pools: near.filter((b) => b.rMax).map((b) => ({ r: +b.r.toFixed(2), rMax: +b.rMax.toFixed(2), tau: b.tau, age: +(gameTime - b.created).toFixed(1), wounded: !!b.wounded })),
        flying: particles.filter((p) => p.blood && Math.hypot(p.x - x, p.y - y) < radius).length,
      };
    }
    function bloodConsole() {
      return {
        // Blood decals round a point (default the player, 120 units): counts by kind, the largest, the spreading pools.
        bloodReport: (x, y, radius) => bloodReport(x, y, radius),
        // Spatter and drops within `radius` (60) of a victim at (x, y), split by the shot's
        // heading `a` (radians, the way the round travelled): `downrange` (beyond the victim,
        // away from the shooter), `uprange` (more than 2 units toward the shooter), `level`;
        // `farthest` downrange distance. Pools and tracks are left out.
        bloodSides(x, y, a = 0, radius = 60) {
          const r = { downrange: 0, uprange: 0, level: 0, farthest: 0 },
            ux = Math.cos(a),
            uy = Math.sin(a);
          for (const b of bloodPools) {
            if (b.rMax || b.track || Math.hypot(b.x - x, b.y - y) > radius) continue;
            const along = (b.x - x) * ux + (b.y - y) * uy;
            if (along > 0.5) {
              r.downrange++;
              r.farthest = Math.max(r.farthest, +along.toFixed(1));
            } else if (along < -2) r.uprange++;
            else r.level++;
          }
          return r;
        },
        // Tests: stand a bystander `distance` ahead of the player and wound them `hits` times
        // (damage each, kind 'ballistic' | 'headshot' | 'blast' | 'impact'), as the player's shots would.
        bloodVictim(hits = 1, damage = 20, kind = 'ballistic', distance = 50) {
          if (player.car) exitCar();
          const a = player.a || 0,
            p = { x: player.x + Math.cos(a) * distance, y: player.y + Math.sin(a) * distance, a: a + Math.PI, dir: a + Math.PI, hp: 100, flee: 0, timer: 999, walk: 0, state: 'idle', stateTime: 900 };
          dressPerson(p, 'casual');
          pedestrians.push(p);
          for (let i = 0; i < hits && p.hp > 0; i++) strikePerson(p, damage, a, player, true, kind);
          return { x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), dead: p.hp <= 0, downed: !!p.woundedDown };
        },
      };
    }
