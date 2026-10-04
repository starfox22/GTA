    // Car stains: the blood a vehicle carries after it hits someone (c.stains), aged and washed here; carblood3d.js draws it.
    /**
     * CAR STAINS
     * `c.stains` is plain data, at most CAR_STAIN_LIMIT records, oldest first:
     *   { id, t, face, x, z, sev, sx, sz, kph, seed, wash, reach, flow, creep, hits, load, adds }
     * `face` is the side of the body the person met ('front' | 'rear' | 'left' |
     * 'right'), (x, z) the point on it in world units from the car's centre (x along
     * the heading, z to the right, as the model is laid out), `sev` 0.1-1 how much
     * blood it left, (sx, sz) the unit direction the blood is carried over the body
     * (away from the impact, back along the airflow), `seed` makes each stain its own
     * pattern and `wash` (0-1) is how much of it the rain has taken.
     * `reach` is how far (metres) the airflow can drag it back along the bodywork;
     * `flow` (0-1) how much of that it has covered: it advances only while the car is
     * moving (so a car that brakes at once stops the streaks short, one that keeps
     * going blows them the whole length of the bonnet); `creep` (0-1) is how far the
     * slow gravity runs have crept, which only happens once the car has slowed.
     *
     * HOW MUCH (carStainSeverity): nothing under CAR_STAIN_MIN_KPH (a crawl over
     * someone leaves the bonnet clean; the tyres may still carry a pool), then a
     * smooth curve with speed: sev = CAR_STAIN_MAX (1 - exp(-((kph - 14) / 37)^1.45))
     * for a killing hit, about 0.05 at 20 km/h (a few drops), 0.12 at 25, 0.47 at 50
     * (a clear splash), 0.69 at 80 (heavy, with streaks), never over 0.76: a third
     * less per person than the old 0.62-1. A survivor's is CAR_STAIN_SURVIVOR of that.
     * (A first hit under 20 km/h hurts nobody, so it never gets here.)
     * PILING UP: several people pile up on the bodywork instead of replacing each
     * other. Once a car holds CAR_STAIN_LIMIT records (the renderer's three tile
     * pairs), a new hit on a face that already has one tops up the nearest of them:
     * the record keeps its place and pattern, `hits` and `load` (the sum of every
     * hit's sev) grow, the hit joins `adds` ({x, z, sev, kph, seed}, painted over the
     * record's tiles, CAR_STAIN_ADDS at most) and the record is fresh again (`t`).
     * Only a hit on a face with no record replaces the oldest.
     * A respray, a full repair (garages.js, repairVehicle) or heavy rain clears them;
     * they fade on their own after CAR_STAIN_LIFE seconds. The renderers only read.
     */
    const CAR_STAIN_LIMIT = 3,
      CAR_STAIN_ADDS = 12,
      CAR_STAIN_MIN_KPH = 14,
      CAR_STAIN_MAX = 0.76,
      CAR_STAIN_SURVIVOR = 0.6,
      CAR_STAIN_LIFE = 1500,
      CAR_STAIN_WASH_RATE = 0.09, // per second per unit of rain above 0.45 (a storm clears a stain in ~20 s)
      CAR_STAIN_FLOW_RATE = 0.25, // the blown blood's front travels this share of the car's speed above the wind that does nothing (4 m/s)
      CAR_STAIN_CREEP_SECONDS = 18, // seconds at rest for the gravity runs to finish
      carStained = new Set();
    let carStainCounter = 0,
      carStainClock = 0;
    function carStainable(c) {
      return c && !isBoat(c) && !isAircraft(c) && !vehicleSpec(c)?.jetski;
    }
    // How far back along the bodywork (metres, from the point struck) a stain can be dragged: a small one a bonnet's length, a fatal one at speed bumper to roof edge.
    function carStainReach(sev, kph) {
      return +(1.2 + 0.8 * sev + 1.2 * clamp(kph / 90, 0, 1.2) * sev).toFixed(2);
    }
    // How much blood a hit at `kph` leaves on the bodywork (HOW MUCH): 0 under CAR_STAIN_MIN_KPH.
    function carStainSeverity(kph, fatal) {
      if (!(kph >= CAR_STAIN_MIN_KPH)) return 0;
      const sev = CAR_STAIN_MAX * (1 - Math.exp(-Math.pow((kph - CAR_STAIN_MIN_KPH) / 37, 1.45)));
      return Math.max(0.01, fatal ? sev : sev * CAR_STAIN_SURVIVOR);
    }
    // Where on the body `person` met `c`, and the stain it leaves. Returns the record (a new
    // one, or the one it topped up) or null.
    function addCarStain(c, person, kph, fatal) {
      if (!bloodOn || !carStainable(c) || !(kph >= CAR_STAIN_MIN_KPH)) return null;
      const spec = vehicleSpec(c),
        ca = Math.cos(c.a),
        sa = Math.sin(c.a),
        dx = person.x - c.x,
        dy = person.y - c.y,
        halfL = spec.l / 2,
        halfW = spec.w / 2,
        along = dx * ca + dy * sa,
        lateral = -dx * sa + dy * ca,
        ex = along / halfL,
        ez = lateral / halfW,
        end = Math.abs(ex) > 0.85 || Math.abs(ex) >= Math.abs(ez),
        face = end ? (ex >= 0 ? 'front' : 'rear') : ez >= 0 ? 'right' : 'left',
        x = end ? Math.sign(ex || 1) * halfL : clamp(along, -halfL * 0.8, halfL * 0.8),
        z = end ? clamp(lateral, -halfW * 0.85, halfW * 0.85) : Math.sign(ez || 1) * halfW,
        // The car's velocity in its own frame: the air blows the blood back along it.
        vx = (c.vx || 0) * ca + (c.vy || 0) * sa,
        vz = -(c.vx || 0) * sa + (c.vy || 0) * ca,
        speed = Math.hypot(vx, vz) || 1,
        inwardX = end ? -Math.sign(ex || 1) : 0,
        inwardZ = end ? 0 : -Math.sign(ez || 1);
      let sx = inwardX * 0.55 - (vx / speed) * 0.85,
        sz = inwardZ * 0.55 - (vz / speed) * 0.85;
      const n = Math.hypot(sx, sz) || 1;
      sx /= n;
      sz /= n;
      const sev = carStainSeverity(kph, fatal),
        seed = (Math.imul(carStainCounter + 1, 2654435761) ^ Math.imul(c.id | 0 || 7, 40503)) >>> 0;
      // Full: pile onto the nearest record on the same face (PILING UP).
      if (c.stains && c.stains.length >= CAR_STAIN_LIMIT) {
        let host = null,
          gap = Infinity;
        for (const r of c.stains) {
          const d = Math.hypot(r.x - x, r.z - z);
          if (r.face === face && d < gap) {
            gap = d;
            host = r;
          }
        }
        if (host) {
          carStainCounter++;
          host.t = gameTime;
          host.hits = (host.hits || 1) + 1;
          host.load = +((host.load ?? host.sev) + sev).toFixed(2);
          host.kph = Math.max(host.kph, Math.round(kph));
          if (!host.adds) host.adds = [];
          if (host.adds.length < CAR_STAIN_ADDS) host.adds.push({ x: +x.toFixed(2), z: +z.toFixed(2), sev: +sev.toFixed(2), kph: Math.round(kph), seed });
          carStained.add(c);
          return host;
        }
      }
      const stain = {
          id: ++carStainCounter,
          t: gameTime,
          face,
          x: +x.toFixed(2),
          z: +z.toFixed(2),
          sev: +sev.toFixed(2),
          sx: +sx.toFixed(3),
          sz: +sz.toFixed(3),
          kph: Math.round(kph),
          seed,
          wash: 0,
          reach: carStainReach(sev, kph),
          flow: 0,
          creep: 0,
          hits: 1,
          load: +sev.toFixed(2),
          adds: null,
        };
      if (!c.stains) c.stains = [];
      c.stains.push(stain);
      if (c.stains.length > CAR_STAIN_LIMIT) c.stains.shift();
      carStained.add(c);
      return stain;
    }
    function clearCarStains(c) {
      if (!c) return;
      c.stains = null;
      carStained.delete(c);
    }
    // 0 wet .. 1 dry, from the age of the newest wet stain: the renderer's drying curve.
    function carStainDryness(s) {
      const age = gameTime - s.t;
      return clamp((age - 8) / 100, 0, 1);
    }
    // Every frame, for the stains still moving: the airflow drags the blood back while the car runs, the gravity runs creep once it has slowed.
    function updateCarStainFlow(deltaSeconds) {
      for (const c of carStained) {
        const list = c.stains;
        if (!list) continue;
        const v = Math.hypot(c.vx || 0, c.vy || 0) / UNITS_PER_METRE,
          air = clamp((v - 2) / 5, 0, 1);
        for (const s of list) {
          if (s.flow < 1 && v > 4) s.flow = Math.min(1, s.flow + (deltaSeconds * CAR_STAIN_FLOW_RATE * (v - 4)) / s.reach);
          if (s.creep < 1) s.creep = Math.min(1, s.creep + (deltaSeconds * (1 - air)) / CAR_STAIN_CREEP_SECONDS);
        }
      }
    }
    function updateCarStains(deltaSeconds) {
      if (!carStained.size) return;
      updateCarStainFlow(deltaSeconds);
      carStainClock += deltaSeconds;
      if (carStainClock < 0.5) return;
      const dt = carStainClock;
      carStainClock = 0;
      const raining = weather.rain > 0.5;
      for (const c of carStained) {
        if (!vehicles.includes(c)) {
          carStained.delete(c);
          continue;
        }
        const list = c.stains;
        if (!list?.length) {
          carStained.delete(c);
          continue;
        }
        const washing = raining && !overheadCover(c.x, c.y, entityElevation(c));
        for (let i = list.length - 1; i >= 0; i--) {
          const s = list[i];
          if (washing) s.wash = Math.min(1, s.wash + dt * (weather.rain - 0.45) * CAR_STAIN_WASH_RATE);
          if (s.wash >= 1 || gameTime - s.t > CAR_STAIN_LIFE) list.splice(i, 1);
        }
        if (!list.length) clearCarStains(c);
      }
    }
    // The 2D fallback: a dark splat on the nose (or wherever the body was struck) with a few streaks dragged back along the airflow.
    function drawCarStains2D(c) {
      if (!c.stains?.length) return;
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a);
      worldContext.lineCap = 'round';
      for (const s of c.stains) {
        // The people piled onto it: a splat each, under the record's own.
        if (s.adds) {
          worldContext.globalAlpha = (1 - s.wash) * (1 - 0.25 * carStainDryness(s));
          worldContext.fillStyle = carStainDryness(s) > 0.6 ? '#3c1612' : '#871428';
          for (const a of s.adds) {
            worldContext.beginPath();
            worldContext.ellipse(c.x + a.x * ca - a.z * sa, c.y + a.x * sa + a.z * ca, (1.8 + a.sev * 3.6) * 1.35, 1.8 + a.sev * 3.6, c.a, 0, TAU);
            worldContext.fill();
          }
        }
        const px = c.x + s.x * ca - s.z * sa,
          py = c.y + s.x * sa + s.z * ca,
          r = 1.8 + s.sev * 3.6,
          dry = carStainDryness(s),
          wx = s.sx * ca - s.sz * sa,
          wy = s.sx * sa + s.sz * ca,
          color = dry > 0.6 ? '#3c1612' : '#871428';
        worldContext.globalAlpha = (1 - s.wash) * (1 - 0.25 * dry);
        worldContext.fillStyle = worldContext.strokeStyle = color;
        // Streaks: each a little different in length, as far as the airflow has dragged it.
        const run = s.reach * UNITS_PER_METRE * 0.8 * s.flow * (0.3 + 0.7 * s.sev);
        if (run > 2)
          for (let i = 0; i < 5; i++) {
            const side = (i - 2) * 0.9,
              len = run * (0.45 + 0.55 * (((s.seed >>> (i * 3)) & 7) / 7));
            worldContext.lineWidth = 1.1 - Math.abs(i - 2) * 0.22;
            worldContext.beginPath();
            worldContext.moveTo(px - wy * side, py + wx * side);
            worldContext.lineTo(px - wy * side + wx * len, py + wx * side + wy * len);
            worldContext.stroke();
          }
        worldContext.beginPath();
        worldContext.ellipse(px, py, r * 1.35, r, c.a, 0, TAU);
        worldContext.fill();
      }
      worldContext.globalAlpha = 1;
    }
    // Console: what a vehicle carries (default the player's car), with the renderer's share when it is drawing.
    function carStainConsole() {
      return {
        // The blood stains on a vehicle (default the player's car): `hits` (everyone who bled on it) and `load` (their sev summed), each record (face, x, z, sev, hits, load, adds piled onto it, age, dry 0-1, wash, reach, flow, creep) and, when the 3D view is on, what it draws (`skin`: fit and paint cost, the work and frame gaps of the last frames); `reset` true clears those frame probes.
        carBloodReport(reset = false) {
          const c = player.car;
          if (!c) return { stains: [], car: null, hits: 0, load: 0 };
          const list = c.stains || [];
          return {
            car: c.type,
            // Everyone who has bled on it (stains and the hits piled onto them) and the sum of their sev.
            hits: list.reduce((n, s) => n + (s.hits || 1), 0),
            load: +list.reduce((n, s) => n + (s.load ?? s.sev), 0).toFixed(2),
            stains: list.map((s) => ({
              id: s.id,
              face: s.face,
              x: s.x,
              z: s.z,
              sev: s.sev,
              hits: s.hits || 1,
              load: s.load ?? s.sev,
              adds: s.adds ? s.adds.length : 0,
              kph: s.kph,
              age: +(gameTime - s.t).toFixed(1),
              dry: +carStainDryness(s).toFixed(2),
              wash: +s.wash.toFixed(2),
              reach: s.reach,
              flow: +s.flow.toFixed(2),
              creep: +s.creep.toFixed(2),
            })),
            skin: city3D?.carBloodInfo?.(c, reset) ?? null,
          };
        },
        // Tests: the blood setting (on by default): `bloodEnabled(false)` stops all blood, stains included; no argument reports it.
        bloodEnabled(on) {
          if (on !== undefined) bloodOn = !!on;
          return bloodOn;
        },
        // Tests and looks: stain the player's car as a person struck on `face` ('front' | 'rear' | 'left' | 'right') at `kph` would (fatal or not), `across` units to the right of the centre line (or along a flank), aged `age` seconds; returns the record (null under 14 km/h; the older record it piled onto when the car already holds three). A mark of any age starts with the airflow's streaks done (`flow` 1) and the gravity runs crept by its age; `flow` (0-1) overrides that, and a car that is moving carries on from there.
        carBloodMark(face = 'front', kph = 70, fatal = true, across = 0, age = 0, flow = age > 0 ? 1 : 0) {
          const c = player.car;
          if (!c) return null;
          const spec = vehicleSpec(c),
            ca = Math.cos(c.a),
            sa = Math.sin(c.a),
            end = face === 'front' || face === 'rear',
            along = end ? (face === 'front' ? 1 : -1) * (spec.l / 2 + 2) : across,
            lateral = end ? across : (face === 'right' ? 1 : -1) * (spec.w / 2 - 1),
            stain = addCarStain(c, { x: c.x + ca * along - sa * lateral, y: c.y + sa * along + ca * lateral }, kph, fatal);
          // A hit piled onto an older record (PILING UP) leaves that record's timing alone.
          if (stain && stain.hits === 1) {
            stain.t = gameTime - age;
            stain.flow = clamp(flow, 0, 1);
            stain.creep = clamp((age - 2) / CAR_STAIN_CREEP_SECONDS, 0, 1);
          }
          return stain;
        },
        // Tests: stand a bystander on the player's car, `along` units ahead of its centre and `lateral` to its right (try the nose: half the length plus 30; a flank: 0 and half the width minus 3); a moving car then knocks them down.
        carBloodVictim(along = 50, lateral = 0, hp = 100) {
          const c = player.car;
          if (!c) return null;
          const ca = Math.cos(c.a),
            sa = Math.sin(c.a),
            p = {
              x: c.x + ca * along - sa * lateral,
              y: c.y + sa * along + ca * lateral,
              a: c.a + Math.PI,
              dir: c.a + Math.PI,
              hp,
              flee: 0,
              timer: 999,
              walk: 0,
              state: 'idle',
              stateTime: 900,
            };
          dressPerson(p, 'casual');
          pedestrians.push(p);
          return { x: Math.round(p.x), y: Math.round(p.y), hp: p.hp };
        },
      };
    }
