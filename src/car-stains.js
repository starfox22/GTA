    // Car stains: the blood a vehicle carries after it hits someone (c.stains), aged and washed here; carblood3d.js draws it.
    /**
     * CAR STAINS
     * `c.stains` is plain data, at most CAR_STAIN_LIMIT records, oldest first:
     *   { id, t, face, x, z, sev, sx, sz, kph, seed, wash }
     * `face` is the side of the body the person met ('front' | 'rear' | 'left' |
     * 'right'), (x, z) the point on it in world units from the car's centre (x along
     * the heading, z to the right, as the model is laid out), `sev` 0.1-1 how much
     * blood it left, (sx, sz) the unit direction the blood is carried over the body
     * (away from the impact, back along the airflow), `seed` makes each stain its own
     * pattern and `wash` (0-1) is how much of it the rain has taken.
     *
     * Only a hit that hurts leaves any (20 km/h and up, blood setting on): a killing
     * one a proper splatter, more with speed; a survivor's a small one. A respray, a
     * full repair (garages.js, repairVehicle) or heavy rain clears them; they fade on
     * their own after CAR_STAIN_LIFE seconds. The renderers only read.
     */
    const CAR_STAIN_LIMIT = 3,
      CAR_STAIN_LIFE = 1500,
      CAR_STAIN_WASH_RATE = 0.09, // per second per unit of rain above 0.45 (a storm clears a stain in ~20 s)
      carStained = new Set();
    let carStainCounter = 0,
      carStainClock = 0;
    function carStainable(c) {
      return c && !isBoat(c) && !isAircraft(c) && !vehicleSpec(c)?.jetski;
    }
    // Where on the body `person` met `c`, and the stain it leaves. Returns the record or null.
    function addCarStain(c, person, kph, fatal) {
      if (!bloodOn || !carStainable(c) || kph < 20) return null;
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
      const sev = fatal ? clamp(0.55 + (kph - 40) / 100, 0.55, 1) : clamp((kph - 18) / 90, 0.12, 0.42),
        stain = {
          id: ++carStainCounter,
          t: gameTime,
          face,
          x: +x.toFixed(2),
          z: +z.toFixed(2),
          sev: +sev.toFixed(2),
          sx: +sx.toFixed(3),
          sz: +sz.toFixed(3),
          kph: Math.round(kph),
          seed: (Math.imul(carStainCounter + 1, 2654435761) ^ Math.imul(c.id | 0 || 7, 40503)) >>> 0,
          wash: 0,
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
    function updateCarStains(deltaSeconds) {
      if (!carStained.size) return;
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
    // The 2D fallback: a dark splat on the nose (or wherever the body was struck).
    function drawCarStains2D(c) {
      if (!c.stains?.length) return;
      const ca = Math.cos(c.a),
        sa = Math.sin(c.a);
      for (const s of c.stains) {
        const px = c.x + s.x * ca - s.z * sa,
          py = c.y + s.x * sa + s.z * ca,
          r = 1.6 + s.sev * 3.4,
          dry = carStainDryness(s);
        worldContext.globalAlpha = (1 - s.wash) * (1 - 0.25 * dry);
        worldContext.fillStyle = dry > 0.6 ? '#3c1612' : '#871428';
        worldContext.beginPath();
        worldContext.ellipse(px, py, r * 1.35, r, c.a, 0, TAU);
        worldContext.fill();
      }
      worldContext.globalAlpha = 1;
    }
    // Console: what a vehicle carries (default the player's car), with the renderer's share when it is drawing.
    function carStainConsole() {
      return {
        // The blood stains on a vehicle (default the player's car): each record (face, x, z, sev, age, dry 0-1, wash) and, when the 3D view is on, what it draws (`skin`).
        carBloodReport() {
          const c = player.car;
          if (!c) return { stains: [], car: null };
          return {
            car: c.type,
            stains: (c.stains || []).map((s) => ({
              id: s.id,
              face: s.face,
              x: s.x,
              z: s.z,
              sev: s.sev,
              kph: s.kph,
              age: +(gameTime - s.t).toFixed(1),
              dry: +carStainDryness(s).toFixed(2),
              wash: +s.wash.toFixed(2),
            })),
            skin: city3D?.carBloodInfo?.(c) ?? null,
          };
        },
        // Tests: the blood setting (on by default): `bloodEnabled(false)` stops all blood, stains included; no argument reports it.
        bloodEnabled(on) {
          if (on !== undefined) bloodOn = !!on;
          return bloodOn;
        },
        // Tests and looks: stain the player's car as a person struck on `face` ('front' | 'rear' | 'left' | 'right') at `kph` would (fatal or not), `across` units to the right of the centre line (or along a flank), aged `age` seconds; returns the record.
        carBloodMark(face = 'front', kph = 70, fatal = true, across = 0, age = 0) {
          const c = player.car;
          if (!c) return null;
          const spec = vehicleSpec(c),
            ca = Math.cos(c.a),
            sa = Math.sin(c.a),
            end = face === 'front' || face === 'rear',
            along = end ? (face === 'front' ? 1 : -1) * (spec.l / 2 + 2) : across,
            lateral = end ? across : (face === 'right' ? 1 : -1) * (spec.w / 2 - 1),
            stain = addCarStain(c, { x: c.x + ca * along - sa * lateral, y: c.y + sa * along + ca * lateral }, kph, fatal);
          if (stain) stain.t = gameTime - age;
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
