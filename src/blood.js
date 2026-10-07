    // Blood: wound spatter, drops, the pool a body bleeds out slowly (bleed, bodyPool, addBloodPool/Drop), their
    // stamps (bloodStamp), growth and ageing (updateBlood), the 2D decals and the blood console report.
    /**
     * BLOOD
     * One entry in `bloodPools` is one decal: a pool, a spatter, a drop or a tyre
     * track (physics-knockdowns.js) on the ground, or a splash on a wall (`wall`,
     * with the face's normal nx, ny; `surface` is then its height). The renderers
     * (blood3d.js, drawBlood2D) only draw them: `r` is the decal's radius in world
     * units, `stretch` its length along `a`, `variant` the stamp.
     *
     * A hit is not a pool. A round that opens a wound throws a puff of red mist
     * and an exit spray away from the shooter (the heading of the shot): a plume,
     * a cone of fine drops landing a metre or more beyond the body, a directional
     * spatter behind it and a drop at its feet; the body itself does not move.
     * Only a body on the ground bleeds a pool: it starts small under the torso
     * and spreads fast, most of it in 10-15 s (a volume that flows out ever
     * slower), larger the more wounds it took (POOL SIZE). A blast or a car at speed gives a larger,
     * faster pool and a radial spray. Anyone wounded who keeps moving drips a
     * trail (wounds.js). How much a round lets out grows with its calibre, range
     * and zone (HOW MUCH A ROUND LETS OUT; gore.js goreHit); the spray marks a wall
     * or a vehicle it reaches. Everything fades after BLOOD_LIFE seconds; at most
     * BLOOD_LIMIT decals exist, and the oldest spatter and drops go first. Blood's
     * randomness is gore.js goreRandom: it never draws on the game's seeded stream.
     *
     * bleed(entity, severity, heading, kind) is the one entry for a wound: other
     * code (a rider thrown off a bike, a fall) calls it with kind 'impact' or
     * 'fall'; severity 0.25 a graze .. 1 a pistol round .. 2.5 the worst.
     */
    const BLOOD_LIMIT = 480,
      BLOOD_LIFE = 240,
      BLOOD_TRACK_DISTANCE = BLOCK_SIZE * 0.07,
      BLOOD_POOL = 0,
      BLOOD_SPATTER = 4,
      BLOOD_DROP = 8,
      BLOOD_WALL = 12,
      BLOOD_VARIANTS = 16,
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
      } else if (variant < BLOOD_WALL) {
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
        blobs([{ x: 63, y: 64, r: r * 0.62 }], 0, 'rgba(62, 5, 11, 0.5)');
        const satellites = Math.floor(random() * 4);
        for (let i = 0; i < satellites; i++) {
          const a = random() * TAU,
            d = r + 7 + random() * 14;
          blobs([{ x: 64 + Math.cos(a) * d, y: 64 + Math.sin(a) * d, r: 1.4 + random() * 2.4 }], 0, 'rgba(84, 8, 15, 0.92)');
        }
      } else {
        // On a wall (+y is down the wall): the spray struck about (64, 44) and burst outwards in fine
        // droplets drawn out radially; its heavier drops ran down in thin trickles, each ending in a bead.
        const cx = 64,
          cy = 44,
          core = [{ x: cx, y: cy, r: 9 + random() * 4 }];
        for (let i = 0; i < 6; i++) {
          const a = random() * TAU,
            d = 4 + random() * 9;
          core.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, r: 3 + random() * 5 });
        }
        blobs(core, 0, 'rgba(98, 9, 17, 0.9)');
        blobs(core, -2.5, 'rgba(70, 6, 12, 0.94)');
        for (let i = 0; i < 70; i++) {
          const a = random() * TAU,
            t = Math.pow(random(), 0.7),
            d = 12 + t * 38,
            size = (3 - t * 2.3) * (0.5 + random() * 0.7),
            x = cx + Math.cos(a) * d,
            y = cy + Math.sin(a) * d * 0.85;
          g.fillStyle = i % 3 ? 'rgba(92, 8, 16, 0.92)' : 'rgba(120, 14, 24, 0.82)';
          g.beginPath();
          g.ellipse(x, y, size * (1.3 + t), size, a, 0, TAU);
          g.fill();
        }
        const runs = 3 + Math.floor(random() * 4);
        for (let i = 0; i < runs; i++) {
          const x0 = cx + (random() - 0.5) * 26,
            y0 = cy + 4 + random() * 8,
            length = 22 + random() * 52,
            w = 1.1 + random() * 1.4;
          g.fillStyle = 'rgba(84, 7, 14, 0.94)';
          g.beginPath();
          g.moveTo(x0 - w, y0);
          // A trickle wavers a little and thins as it runs.
          const sway = (random() - 0.5) * 3;
          g.quadraticCurveTo(x0 - w * 0.6 + sway, y0 + length * 0.5, x0 - w * 0.45 + sway * 0.4, y0 + length);
          g.lineTo(x0 + w * 0.45 + sway * 0.4, y0 + length);
          g.quadraticCurveTo(x0 + w * 0.6 + sway, y0 + length * 0.5, x0 + w, y0);
          g.fill();
          blobs([{ x: x0 + sway * 0.4, y: y0 + length + w * 0.6, r: w * 1.25 }], 0, 'rgba(70, 6, 12, 0.95)');
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
        variant: BLOOD_POOL + Math.floor(goreRandom() * 4),
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
      return addBloodPool(x, y, r, a, { variant: BLOOD_DROP + Math.floor(goreRandom() * 4), opacity: 0.9, ...extra });
    }
    /* A flying drop (a game particle, game-update.js) lands: into a body's pool (where it will spread) it is
       lost in it; onto a drop already there it adds to it; a fine one leaves no mark half the time; else a
       drop drawn out along its flight. Overlapping round drops read as bubbles in a pool. */
    function landBloodDrop(p) {
      const surface = p.surface ?? bloodSurface(p.x, p.y);
      for (let i = bloodPools.length - 1; i >= 0; i--) {
        const b = bloodPools[i];
        if (b.wall || b.track || Math.abs(b.surface - surface) > 3) continue;
        const dx = p.x - b.x,
          dy = p.y - b.y,
          d2 = dx * dx + dy * dy;
        if (b.rMax) {
          if (d2 < b.rMax * b.rMax * 0.75) return null;
        } else if (b.variant >= BLOOD_DROP && b.variant < BLOOD_WALL && d2 < 0.7 && gameTime - b.created < 3) {
          b.r = Math.min(b.r + p.size * 0.2, 2);
          return b;
        }
      }
      if (p.size < 0.6 && goreRandom() < 0.6) return null;
      // A drop on the ground is a centimetre or few across (BLOOD_DROP_LAND of its flying size), drawn out
      // by its speed; a lump of tissue a little more.
      return addBloodDrop(p.x, p.y, p.size * (p.gore ? 0.55 : BLOOD_DROP_LAND), Math.atan2(p.vy, p.vx), { stretch: 1 + Math.min(1.8, Math.hypot(p.vx, p.vy) / 60), surface });
    }
    /* A spatter fanned out along `a` from (x, y): the stamp's origin sits on the point. */
    function addBloodSpatter(x, y, r, a, surface, stretch = 1.5) {
      const off = 0.36 * 2.5 * r * stretch;
      return addBloodPool(x + Math.cos(a) * off, y + Math.sin(a) * off, r, a, {
        variant: BLOOD_SPATTER + Math.floor(goreRandom() * 4),
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
    /**
     * HOW MUCH A ROUND LETS OUT (deterministic; console bloodPlanTable lists it). `severity` is the wound's
     * (dealt / 38, at most 2), `hit` gore.js goreHit's scratch: its `scale` grows with the calibre (a rifle
     * 1.6, a .50 2.8), at close range (a shotgun load's first pellet carries the whole load within 3 m, ~5x)
     * and by zone (head 1.3, a limb 0.8); null is a pistol round at mid range (scale 1, the old spray). The
     * spray: entry mist (`mist` puffs, toward the shooter, never landing), exit plume, `drops` flying on in a
     * cone of +-`cone` at up to `speed`, `spatters` on the ground behind the body (larger by `spatterSize`),
     * and `reach` (units): how far the spray carries onto a wall or a vehicle (bloodSprayObstacle).
     */
    function bloodShotPlan(severity, hit) {
      const s = clamp(hit ? hit.scale : 1, 0.25, 9),
        close = hit?.close || 0,
        more = Math.min(Math.max(s - 1, 0), 4);
      return {
        scale: +s.toFixed(3),
        mist: s >= 4 ? 3 : s >= 1.5 ? 2 : 1,
        plume: Math.min(4, Math.max(1, Math.round(1 + (s - 1) * 0.6))),
        drops: Math.min(48, Math.max(2, Math.round((3 + 4 * severity) * s))),
        cone: +(0.32 + (hit?.cls === 'buck' ? 0.14 : 0) + 0.12 * close).toFixed(3),
        speed: Math.round(100 * (1 + 0.16 * more)),
        spatters: Math.min(5, Math.max(1, Math.round((severity > 0.8 ? 2 : 1) * Math.sqrt(s)))),
        spatterSize: +(1 + 0.12 * more).toFixed(3),
        reach: Math.round((1.6 + 1.1 * Math.min(s, 5)) * UNITS_PER_METRE),
      };
    }
    /**
     * WALLS AND VEHICLES IN THE SPRAY: the first building face or vehicle the exit spray meets along `a`
     * within `reach` (units) at the wound's height `height` over the feet; null if none. A building face takes
     * wall spatter (`wall` decals, blood3d.js draws them standing on the face); a vehicle a stain through
     * addCarStain's rules (car-stains.js, the severity given). Flying drops stop there (`stopX/stopY`).
     */
    const sprayHit = { kind: '', d: 0, x: 0, y: 0, nx: 0, ny: 0, building: null, car: null };
    function bloodSprayObstacle(x, y, a, reach, height, elevation) {
      const ux = Math.cos(a),
        uy = Math.sin(a);
      let best = reach,
        found = false,
        lastList = null;
      // Buildings in the cells the ray crosses (start, middle, end).
      for (let k = 0; k <= 2; k++) {
        const list = buildingsNear(x + ux * reach * k * 0.5, y + uy * reach * k * 0.5);
        if (list === lastList) continue;
        lastList = list;
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if ((b.height ?? 999) < height + 2) continue;
          // Slabs: entering the box at t0 along the ray, through the face with that normal.
          let t0 = -Infinity,
            t1 = Infinity,
            nx = 0,
            ny = 0;
          if (Math.abs(ux) < 1e-6) {
            if (x < b.x || x > b.x + b.w) continue;
          } else {
            const ta = (b.x - x) / ux,
              tb = (b.x + b.w - x) / ux;
            t0 = Math.min(ta, tb);
            nx = ux > 0 ? -1 : 1;
            t1 = Math.max(ta, tb);
          }
          if (Math.abs(uy) < 1e-6) {
            if (y < b.y || y > b.y + b.h) continue;
          } else {
            const ta = (b.y - y) / uy,
              tb = (b.y + b.h - y) / uy,
              lo = Math.min(ta, tb);
            if (lo > t0) {
              t0 = lo;
              nx = 0;
              ny = uy > 0 ? -1 : 1;
            }
            t1 = Math.min(t1, Math.max(ta, tb));
          }
          if (t0 > t1 || t0 < 0.5 || t0 >= best) continue;
          best = t0;
          found = true;
          sprayHit.kind = 'wall';
          sprayHit.nx = nx;
          sprayHit.ny = ny;
          sprayHit.building = b;
          sprayHit.car = null;
        }
      }
      // Vehicles: the ray against each nearby body's footprint (in its own frame).
      for (let i = 0; i < vehicles.length; i++) {
        const c = vehicles[i];
        if (Math.abs(c.x - x) > best + 48 || Math.abs(c.y - y) > best + 48 || !carStainable(c)) continue;
        if (Math.abs(entityElevation(c) - elevation) > 12) continue;
        const spec = vehicleSpec(c),
          ca = Math.cos(c.a),
          sa = Math.sin(c.a),
          px = (x - c.x) * ca + (y - c.y) * sa,
          py = -(x - c.x) * sa + (y - c.y) * ca,
          dx = ux * ca + uy * sa,
          dy = -ux * sa + uy * ca,
          hl = spec.l / 2,
          hw = spec.w / 2;
        let t0 = -Infinity,
          t1 = Infinity;
        if (Math.abs(dx) < 1e-6) {
          if (Math.abs(px) > hl) continue;
        } else {
          t0 = Math.max(t0, Math.min((-hl - px) / dx, (hl - px) / dx));
          t1 = Math.min(t1, Math.max((-hl - px) / dx, (hl - px) / dx));
        }
        if (Math.abs(dy) < 1e-6) {
          if (Math.abs(py) > hw) continue;
        } else {
          t0 = Math.max(t0, Math.min((-hw - py) / dy, (hw - py) / dy));
          t1 = Math.min(t1, Math.max((-hw - py) / dy, (hw - py) / dy));
        }
        if (t0 > t1 || t0 < 0.5 || t0 >= best) continue;
        best = t0;
        found = true;
        sprayHit.kind = 'car';
        sprayHit.car = c;
        sprayHit.building = null;
      }
      if (!found) return null;
      sprayHit.d = best;
      sprayHit.x = x + ux * best;
      sprayHit.y = y + uy * best;
      return sprayHit;
    }
    /* Wall spatter: `n` splashes on the face `hit` met, centred about elevation `z`, radius about r (blood3d.js
       draws them standing on the face, drips running down). */
    function addBloodWall(hit, z, r, n) {
      const tx = -hit.ny,
        ty = hit.nx;
      for (let i = 0; i < n; i++) {
        const along = goreBetween(-0.6, 0.6) * r * (i ? 1 : 0.3);
        addBloodPool(hit.x + tx * along, hit.y + ty * along, r * goreBetween(0.7, 1.15) * (i ? 0.75 : 1), goreBetween(-0.25, 0.25), {
          variant: BLOOD_WALL + Math.floor(goreRandom() * 4),
          wall: true,
          nx: hit.nx,
          ny: hit.ny,
          surface: z + goreBetween(-1.2, 1.2) * (i ? 1 : 0.4),
          building: hit.building,
          opacity: 0.94,
        });
      }
    }
    /* A dense burst (a point-blank load, a heavy round, a close blast, a cut): tissue and drops thrown on along
       `a` (within +-`cone`), a heavy mist and spatter further out, short of `obstacle` (bloodSprayObstacle).
       `amount` 0..1.4. */
    function bloodBurst(x, y, z, a, amount, ground, cone, obstacle) {
      const k = Math.min(amount, 1.4),
        n = Math.round(10 + 20 * k);
      for (let i = 0; i < n; i++) {
        const off = goreBetween(-cone, cone),
          dir = a + off,
          v = goreBetween(30, 120),
          chunk = i % 3 === 0,
          drop = {
            x,
            y,
            vx: Math.cos(dir) * v,
            vy: Math.sin(dir) * v,
            z,
            vz: goreBetween(6, 42),
            life: 1.4,
            max: 1.4,
            color: chunk ? '#3d070b' : i % 2 ? '#5a0810' : '#6e0b14',
            size: chunk ? goreBetween(0.9, 1.7) : goreBetween(0.5, 1.2),
            blood: true,
            gore: chunk,
            surface: ground ?? undefined,
          };
        if (obstacle && Math.abs(off) < 0.5) {
          drop.stopX = obstacle.x;
          drop.stopY = obstacle.y;
          drop.ux = Math.cos(a);
          drop.uy = Math.sin(a);
        }
        particles.push(drop);
      }
      for (let i = 0; i < 2 + Math.round(k); i++)
        particles.push({
          x,
          y,
          vx: Math.cos(a) * goreBetween(14, 44),
          vy: Math.sin(a) * goreBetween(14, 44),
          z,
          vz: goreBetween(1, 6),
          life: 0.9,
          max: 0.9,
          color: '#55090f',
          size: goreBetween(2.2, 3.6) * (0.8 + 0.3 * k),
          mist: true,
        });
      const far = obstacle ? obstacle.d - 1.5 : Infinity;
      for (let i = 0; i < 1 + Math.round(1.5 * k); i++) {
        const aa = a + goreBetween(-cone * 0.8, cone * 0.8),
          d = Math.min(far, goreBetween(5, 30)),
          px = x + Math.cos(aa) * d,
          py = y + Math.sin(aa) * d;
        addBloodSpatter(px, py, goreBetween(3, 4.4), aa, ground ?? bloodSurface(px, py), 1.8);
      }
    }
    /* A wound. `a` is the heading the shot travelled (blood leaves the exit side); `hit` is gore.js goreHit's
       scratch for a hit strikePerson took (calibre, range, zone: bloodShotPlan), null otherwise. */
    const BLOOD_DROP_LAND = 0.4,
      BLOOD_DROP_COLORS = ['#5e0710', '#720a15', '#4a050c'],
      BLOOD_REDUCED_HIT = { scale: 0.6, cls: 'handgun', close: 0 };
    function bleed(p, severity = 1, a = 0, kind = 'ballistic', hit = null) {
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
        impact = kind === 'impact' || kind === 'fall',
        round = !blast && !impact,
        full = goreFull(),
        zone = hit?.zone ?? (p === player ? bloodPlayerZone() : p.hitZone || 'torso'),
        woundZ = z + (hit?.height ?? (impact ? 4 : round ? (GORE_ZONE_HEIGHT[zone] ?? 10) : 10)),
        plan = round ? bloodShotPlan(severity, hit || (full ? null : BLOOD_REDUCED_HIT)) : null,
        ca = Math.cos(a),
        sa = Math.sin(a);
      // The clothes soak where it went in (gore.js WOUNDS): rounds and blades.
      if (round && kind !== 'punch')
        goreWound(p, zone, a, severity, plan.scale, kind !== 'melee' && (hit ? hit.cls === 'rifle' || hit.cls === 'heavy' || hit.close > 0.5 || (hit.cls === 'handgun' && goreRandom() < 0.6) : goreRandom() < 0.5));
      // ENTRY: a fine puff on the side the round came in (it lands nowhere).
      if (round)
        for (let i = 0; i < plan.mist; i++)
          particles.push({
            x: p.x - ca * 1.4,
            y: p.y - sa * 1.4,
            vx: -ca * goreBetween(5, 14) + goreBetween(-4, 4),
            vy: -sa * goreBetween(5, 14) + goreBetween(-4, 4),
            z: woundZ,
            vz: goreBetween(1, 4),
            life: 0.3,
            max: 0.3,
            color: '#6a0c13',
            size: 0.8 + severity * 0.35,
            mist: true,
          });
      // The mist at the wound, drifting the way the round went.
      particles.push({
        x: p.x + ca * 2,
        y: p.y + sa * 2,
        vx: ca * 22,
        vy: sa * 22,
        z: impact ? z + 4 : woundZ,
        vz: 3,
        life: 0.35,
        max: 0.35,
        color: '#6a0c13',
        size: 1.4 + severity * (blast ? 1.6 : 0.8),
        mist: true,
      });
      // A round's exit plume: a finer, wider cloud carried a metre or two on past the body.
      if (round)
        for (let i = 0; i < plan.plume; i++)
          particles.push({
            x: p.x + ca * 4,
            y: p.y + sa * 4,
            vx: ca * goreBetween(38, 54) * Math.sqrt(plan.scale),
            vy: sa * goreBetween(38, 54) * Math.sqrt(plan.scale),
            z: woundZ,
            vz: 1,
            life: 0.5,
            max: 0.5,
            color: '#5c0910',
            size: (1.6 + severity * 0.9) * (i ? 0.8 : 1),
            mist: true,
          });
      // What the spray meets: a wall or a vehicle within its reach takes spatter, and the drops stop there.
      const obstacle = round ? bloodSprayObstacle(p.x, p.y, a, plan.reach, woundZ - z, z) : null;
      if (obstacle) {
        const near = 1 - obstacle.d / plan.reach;
        if (obstacle.kind === 'wall') addBloodWall(obstacle, woundZ, (2.2 + 1.1 * Math.min(plan.scale, 4)) * (0.55 + 0.45 * near), 1 + (plan.scale > 2 ? 1 : 0) + (plan.scale > 4 ? 1 : 0));
        else addCarStain(obstacle.car, obstacle, 0, false, clamp(0.06 * plan.scale * severity * (0.4 + 0.6 * near), 0.04, 0.45));
      }
      // Flying drops: for a round an exit spray, a cone of fine drops flying on along the shot and landing
      // behind the body (or stopping at the wall or vehicle it met); a spray round a blast or a car.
      const drops = round ? plan.drops : Math.round((blast ? 16 + Math.round(severity * 6) : 7 + Math.round(severity * 4)) * (full ? 1 : 0.6)),
        cone = round ? plan.cone : blast ? Math.PI : 0.9;
      for (let i = 0; i < drops; i++) {
        const spread = a + goreBetween(-cone, cone),
          v = round ? goreBetween(35, plan.speed) : goreBetween(35, 115) * (blast ? 1.4 : 1),
          life = round ? goreBetween(0.7, 1.1) : goreBetween(0.5, 1),
          drop = {
            x: p.x + (round ? ca * 2 : 0),
            y: p.y + (round ? sa * 2 : 0),
            vx: Math.cos(spread) * v,
            vy: Math.sin(spread) * v,
            z: impact ? z + 5 : round ? woundZ : z + 10,
            vz: round ? goreBetween(4, 24) : goreBetween(8, 34),
            life,
            max: life,
            color: BLOOD_DROP_COLORS[Math.floor(goreRandom() * 3)],
            size: round ? goreBetween(0.4, 1.05) : goreBetween(0.45, 1.15),
            blood: true,
            surface: roof ? z : undefined,
          };
        if (obstacle) {
          drop.stopX = obstacle.x;
          drop.stopY = obstacle.y;
          drop.ux = ca;
          drop.uy = sa;
        }
        particles.push(drop);
      }
      // On the ground: the spatter behind the wound (radial round a blast), more of it further on from a heavy
      // round, and a drop at the feet; never past the wall the spray met (it lands at the wall's foot).
      const splats = round ? plan.spatters : Math.round((blast ? 5 + Math.round(severity * 2) : 2) * (full ? 1 : 0.6)),
        far = obstacle ? obstacle.d - 1.5 : Infinity;
      for (let i = 0; i < splats; i++) {
        const aa = blast ? a + (i * TAU) / splats + goreBetween(-0.4, 0.4) : a + goreBetween(-0.25, 0.25) * (round ? 1 + plan.cone - 0.32 : 1),
          r = (blast ? goreBetween(3.2, 5) : impact ? goreBetween(2.6, 3.8) : goreBetween(2.6, 3.6)) * (0.75 + Math.min(severity, 2) * 0.2) * (round ? plan.spatterSize : 1),
          d = Math.min(far, round ? (i ? goreBetween(9, 15) * (1 + 0.15 * Math.min(i - 1, 4)) * plan.spatterSize : goreBetween(3, 7)) : goreBetween(2, 5)),
          x = p.x + Math.cos(aa) * d,
          y = p.y + Math.sin(aa) * d;
        addBloodSpatter(x, y, round && i ? r * 0.8 : r, aa, ground(x, y), blast ? 1.3 : round ? 1.8 : 1.6);
      }
      // A point-blank load, a heavy round, a close blast: a dense burst of blood and tissue (GORE).
      if (full && hit && hit.burst > 0.05) bloodBurst(p.x + ca * 2, p.y + sa * 2, woundZ, a, hit.burst, roof ? z : null, blast ? 1.4 : 0.45, obstacle);
      // The drop at the feet falls from the wound: under the body, a little to the exit side.
      const lean = round ? goreBetween(0.3, 2) : 0,
        fx = p.x + ca * lean + goreBetween(-1.5, 1.5),
        fy = p.y + sa * lean + goreBetween(-1.5, 1.5);
      addBloodDrop(fx, fy, goreBetween(0.7, 1.2), goreBetween(0, TAU), { surface: ground(fx, fy) });
      if (p.hp <= 0) bodyPool(p, kind, a);
    }
    // Where a hit the player takes (hurt) lands, for his clothes (gore.js WOUNDS): hurt() picks no zone.
    function bloodPlayerZone() {
      const r = goreRandom();
      return r < 0.1 ? 'head' : r < 0.72 ? 'torso' : r < 0.84 ? 'arm' : 'leg';
    }
    /**
     * POOL SIZE
     * The pool under a body on the ground: it spreads from under the torso and
     * grows as the body bleeds out. Called by bleed() for the dead (and by
     * updateWounds for the wounded lying still, kind 'wounded'); a later wound
     * only makes it larger and quicker. Every body holds about the same blood:
     * the pool grows with the number of wounds it runs from, not with how hard
     * the killing round hit. Units (8 a metre): one fatal round ends about r 7
     * (1.75 m across), several up to 10 (2.5 m); a car or a blast 8.5-13; a body
     * that lost a part (gore.js) BLOOD_POOL_MAIMED more, up to 13.5; a wounded
     * person lying still 2.6-4. The volume flows out on `tau` (most of the spread
     * in the first 10-15 s, easing out); a fresh pool starts at r 1.2.
     */
    const BLOOD_POOL_ROUND = 7,
      BLOOD_POOL_ROUND_MAX = 10,
      BLOOD_POOL_PER_WOUND = 0.9,
      BLOOD_POOL_MAIMED = 2.5,
      BLOOD_POOL_TAU = 6.5,
      BLOOD_POOL_TAU_MIN = 3.5;
    function bodyPoolPlan(kind, hits, maimed = false) {
      const blast = kind === 'blast',
        impact = kind === 'impact' || kind === 'fall',
        more = maimed ? BLOOD_POOL_MAIMED : 0;
      if (kind === 'wounded') return { rMax: clamp(2.6 + (hits - 1) * 0.5 + more, 2.6, 4 + more), tau: 9, r0: 0.9 };
      if (blast || impact)
        return { rMax: clamp(BLOOD_POOL_ROUND + (hits - 1) * 0.7 + (blast ? 3 : 1.6) + more, 8.5, 13.5), tau: blast ? 3 : 4, r0: blast ? 3 : 1.8 };
      return {
        rMax: clamp(BLOOD_POOL_ROUND + (hits - 1) * BLOOD_POOL_PER_WOUND + more, BLOOD_POOL_ROUND, BLOOD_POOL_ROUND_MAX + more),
        tau: clamp(BLOOD_POOL_TAU - (hits - 1) * 0.8 - (maimed ? 1.5 : 0), BLOOD_POOL_TAU_MIN, BLOOD_POOL_TAU),
        r0: 1.2,
      };
    }
    function bodyPool(p, kind = 'ballistic', a = 0, surface = null) {
      if (!bloodOn || !p || p.poisoned) return null;
      const hits = Math.max(1, p.bloodHits || 1),
        blast = kind === 'blast',
        impact = kind === 'impact' || kind === 'fall',
        wounded = kind === 'wounded',
        plan = bodyPoolPlan(kind, hits, !!p.goreLost),
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
      b = addBloodPool(x, y, r0, goreBetween(0, TAU), {
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
        // A splash on a wall stands on the face: the top-down map cannot show it.
        if (!b.wall && rooftopFloor(b) === roof && visible(b, 45)) {
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
        kindOf = (b) => (b.track ? 'track' : b.wall ? 'wall' : b.rMax ? 'pool' : b.variant >= BLOOD_DROP ? 'drop' : b.variant >= BLOOD_SPATTER ? 'spatter' : 'stain');
      const counts = { pool: 0, spatter: 0, drop: 0, track: 0, stain: 0, wall: 0 };
      for (const b of near) counts[kindOf(b)]++;
      return {
        total: bloodPools.length,
        near: counts,
        largest: +Math.max(0, ...near.filter((b) => !b.track && !b.wall).map((b) => b.r)).toFixed(2),
        pools: near.filter((b) => b.rMax).map((b) => ({ r: +b.r.toFixed(2), rMax: +b.rMax.toFixed(2), tau: b.tau, age: +(gameTime - b.created).toFixed(1), wounded: !!b.wounded })),
        flying: particles.filter((p) => p.blood && Math.hypot(p.x - x, p.y - y) < radius).length,
        // The 3D decal layer (blood3d.js): decals drawn, rewrites, draw calls; null without the renderer.
        drawn: city3D?.bloodDecals ? city3D.bloodDecals() : null,
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
