    // Gore rules and state: how hard a hit lands by calibre, range and zone (goreHit), the point-blank shotgun load,
    // limbs and heads lost to a heavy hit (p.goreLost, goreSever), wounds soaking the clothes (p.goreWounds), stumps
    // that spurt, the maimed bleeding out. The renderers only read it (crowd3d-gore.js, player-body3d.js).
    /**
     * GORE
     * Every hit strikePerson takes goes through goreHit first: it names the hit's class ('handgun', 'rifle',
     * 'buck', 'heavy', 'blast', 'other'), its range (the shooter's distance, or detail.range), how close it was
     * (`close` 0..1: within GORE_BUCK_FULL a shotgun load hits as one mass, nothing past GORE_BUCK_NONE), how much
     * blood it lets (`scale`, read by bleed()'s bloodShotPlan) and whether it takes a part off (`sever`, a
     * GORE_* bit) or destroys the torso (`fatal`). Nothing here moves anyone: a round never moves a person
     * (combat-rules.js); only a blast throws the body.
     *
     * What comes off, and when (GORE_FULL only; Settings · Gameplay · Gore 'reduced' never severs):
     *   buck   a load within 3 m takes the part it lands on: the head, a leg (shin or whole) or, when a torso load
     *          catches the arm held in front (GORE_ARM_SHARE), an arm (forearm or whole); the chance falls off
     *          to none at 7 m. A torso load within ~4 m destroys the chest (fatal).
     *   heavy  a .50 or a 25 mm round (bullets' goreCal 'heavy', mounted-guns.js): the head always, a limb at 60 %.
     *   rifle  only a precision rifle's round (damage 90+) to the head within ~6 m.
     *   blast  within ~2.5 m x power up to two limbs, rarely the head; nothing past ~6 m x power.
     * Lethality: a head or a destroyed chest kills; a lost limb drops a survivor where they stand
     * (woundedDown, crawling, `downed` for police) and they bleed out in GORE_BLEED_OUT seconds (the kill is
     * the shooter's then, `goreSource`). Medics never revive anyone who lost a part (livingcity-medics.js).
     * The player loses parts only when a blast kills him (explode); WASTED's respawn gives them back.
     *
     * State on a person: `goreLost` (bits), `goreVersion` (bumped on any change: the renderers' still figures
     * re-record), `goreWounds` (at most GORE_WOUNDS_MAX: zone, h, rel, side, size, exit, t), `goreLoad` (the
     * shotgun load in flight). Lists: `goreStumps` (spurting, GORE_STUMPS_MAX), `goreTracked` (people with
     * wounds or bleeding out, GORE_TRACKED_MAX), `goreEvents` (a ring the renderer turns into bone chips and
     * mist, GORE_EVENTS_MAX), `severedParts` (gore-props.js). Randomness is `goreRandom`, never the game's
     * seeded stream: blood and gore are cosmetic and never shift the simulation.
     */
    const GORE_HEAD = 1,
      GORE_ARM = [2, 4],
      GORE_FOREARM = [8, 16],
      GORE_LEG = [32, 64],
      GORE_SHIN = [128, 256],
      GORE_BUCK_FULL = 3 * UNITS_PER_METRE,
      GORE_BUCK_NONE = 7 * UNITS_PER_METRE,
      GORE_BUCK_PELLETS = 6,
      GORE_LOAD_WINDOW = 0.08,
      GORE_ARM_SHARE = 0.3,
      GORE_DEFAULT_RANGE = 15 * UNITS_PER_METRE,
      GORE_WOUNDS_MAX = 6,
      GORE_STUMPS_MAX = 16,
      GORE_TRACKED_MAX = 64,
      GORE_EVENTS_MAX = 16,
      GORE_BLEED_OUT = [7, 13],
      GORE_SPURT_DEAD = 3.5,
      // The wound's height above the feet (units) by zone, for the spray and the spurts.
      GORE_ZONE_HEIGHT = { head: 12.6, torso: 10.2, arm: 9.4, leg: 4.6 },
      GORE_HEAVY_DETAIL = { heavy: true },
      // The cuts' heights above the feet on the reference adult (character-rig3d.js RIG: hip 7.3, waist 0.95,
      // neck 3.36, shoulders 3.06 over the waist, upper arm 2.55, thigh 3.3).
      GORE_NECK = 11.61,
      GORE_SHOULDER = 11.31,
      GORE_ELBOW = 8.76,
      GORE_HIP = 7.3,
      GORE_KNEE = 4.0,
      goreStumps = [],
      goreTracked = [],
      goreEvents = [];
    let goreSeed = 0x9e3779b9,
      goreEventCount = 0,
      // Console bloodPlanTable: the plan without the chances (no arm caught, nothing severed).
      goreDryRun = false;
    // The scratch hit goreHit fills (read straight after by strikePerson and bleed).
    const goreLastHit = { cls: 'handgun', range: 0, zone: 'torso', close: 0, scale: 1, height: 10, burst: 0, sever: 0, fatal: false, first: true };
    function goreRandom() {
      goreSeed ^= goreSeed << 13;
      goreSeed ^= goreSeed >>> 17;
      goreSeed ^= goreSeed << 5;
      return (goreSeed >>> 0) / 4294967296;
    }
    function goreBetween(lo, hi) {
      return lo + goreRandom() * (hi - lo);
    }
    function goreFull() {
      return goreLevel() !== 'reduced';
    }
    /* 1 within `near`, 0 from `far`, smooth between. */
    function goreCloseness(range, near, far) {
      const t = clamp((far - range) / (far - near), 0, 1);
      return t * t * (3 - 2 * t);
    }
    function goreClass(kind, calibre, detail) {
      if (kind === 'blast') return 'blast';
      if (kind !== 'ballistic' && kind !== 'headshot') return 'other';
      if (detail?.heavy) return 'heavy';
      if (calibre === 'buck') return 'buck';
      return calibre === 'rifle' || kind === 'headshot' ? 'rifle' : 'handgun';
    }
    /* Which bit a zone's hit takes off (0 if that part is gone already on both sides). `rel` is the direction
       the shot came from in the body's frame (0 ahead, positive to the right). */
    function gorePartFor(person, zone, rel, whole) {
      const lost = person.goreLost || 0;
      if (zone === 'head') return lost & GORE_HEAD ? 0 : GORE_HEAD;
      if (zone !== 'leg' && zone !== 'arm') return 0;
      const near = Math.sin(rel) >= 0 ? 1 : 0;
      for (let k = 0; k < 2; k++) {
        const side = k ? 1 - near : near,
          all = zone === 'leg' ? GORE_LEG[side] : GORE_ARM[side],
          part = zone === 'leg' ? GORE_SHIN[side] : GORE_FOREARM[side];
        if (lost & all) continue;
        if (lost & part || whole) return all;
        return part;
      }
      return 0;
    }
    /**
     * The hit's class, range and what it does (GORE). `zone` is pickHitZone's; a point-blank load keeps the
     * zone its first pellet took (the pattern is still one mass) and a torso load may catch an arm. Returns the
     * scratch goreLastHit: read it before the next strike.
     */
    function goreHit(person, zone, kind, calibre, source, detail, a, damage) {
      const h = goreLastHit,
        cls = goreClass(kind, calibre, detail),
        U = UNITS_PER_METRE,
        range = detail?.range ?? (source && source !== person ? Math.hypot(source.x - person.x, source.y - person.y) : GORE_DEFAULT_RANGE),
        full = goreFull();
      h.cls = cls;
      h.range = range;
      h.zone = zone;
      h.close = 0;
      h.scale = 1;
      h.burst = 0;
      h.sever = 0;
      h.fatal = false;
      h.first = true;
      h.height = GORE_ZONE_HEIGHT[zone] ?? 10;
      if (cls === 'other') return h;
      const power = detail?.power || 1;
      let close =
        cls === 'buck'
          ? goreCloseness(range, GORE_BUCK_FULL, GORE_BUCK_NONE)
          : cls === 'rifle'
            ? goreCloseness(range, 2 * U, 6 * U)
            : cls === 'heavy'
              ? goreCloseness(range, 25 * U, 90 * U)
              : cls === 'blast'
                ? goreCloseness(range, 2.5 * U * power, 6 * U * power)
                : goreCloseness(range, 0.5 * U, 2.5 * U) * 0.5;
      // A shotgun load: the pellets of one shot land within GORE_LOAD_WINDOW of each other.
      if (cls === 'buck') {
        const load = person.goreLoad;
        if (load && gameTime - load.t < GORE_LOAD_WINDOW && load.source === source) {
          h.first = false;
          load.n++;
          if (close > 0.25) h.zone = zone = load.zone;
        } else if (load) {
          load.t = gameTime;
          load.source = source;
          load.zone = zone;
          load.n = 1;
        } else person.goreLoad = { t: gameTime, source, zone, n: 1 };
      }
      // A torso load or a heavy round at close quarters catches the arm held in front of the body.
      if (full && h.first && !goreDryRun && zone === 'torso' && ((cls === 'buck' && close > 0.5) || cls === 'heavy') && goreRandom() < GORE_ARM_SHARE) {
        h.zone = zone = 'arm';
        if (cls === 'buck') person.goreLoad.zone = 'arm';
      }
      h.close = close;
      h.height = GORE_ZONE_HEIGHT[zone] ?? 10;
      const pellets = detail?.pellets || GORE_BUCK_PELLETS;
      let scale =
        cls === 'rifle'
          ? 1.6 * (1 + 0.4 * close)
          : cls === 'heavy'
            ? 2.8
            : cls === 'buck'
              ? h.first
                ? 0.55 * (1 + (pellets - 1) * close) * (1 + 0.5 * close)
                : 0.55 * (1 - 0.7 * close)
              : cls === 'blast'
                ? 1
                : 1 + 0.4 * close;
      if (range > 40 * U && cls !== 'blast') scale *= 0.85;
      scale *= zone === 'head' ? 1.3 : zone === 'torso' ? 1 : 0.8;
      h.scale = full ? scale : Math.min(scale * 0.5, 1.2);
      if (!full || !h.first) return h;
      // The burst, and what comes off (GORE). goreRandom() is under 1, so a sure chance always takes.
      let chance = 0;
      if (cls === 'buck') {
        chance = close >= 0.999 ? 1 : 0.9 * Math.pow(close, 1.5);
        h.burst = zone === 'torso' ? close : close * 0.8;
        if (zone === 'torso') h.fatal = close > 0.6;
      } else if (cls === 'heavy') {
        chance = zone === 'head' ? 1 : 0.6;
        h.burst = 0.7;
      } else if (cls === 'rifle') {
        chance = zone === 'head' && damage >= 90 ? close : 0;
        h.burst = close * 0.6;
      } else if (cls === 'blast') h.burst = close;
      if (goreDryRun) return h;
      if (cls === 'heavy' && zone === 'torso') h.fatal = goreRandom() < 0.5;
      const rel = normalizeAngle(a + Math.PI - (person.a || 0));
      if (chance > 0 && zone !== 'torso' && goreRandom() < chance) h.sever = gorePartFor(person, zone, rel, goreRandom() < 0.4);
      if (cls === 'blast' && close > 0) {
        // Up to two limbs and, rarely, the head; the side nearer the blast first.
        let bits = 0;
        if (goreRandom() < 0.18 * close * close) bits |= GORE_HEAD;
        for (let k = 0; k < 2; k++)
          if (goreRandom() < 0.45 * Math.pow(close, 1.2)) {
            const part = gorePartFor({ goreLost: (person.goreLost || 0) | bits }, goreRandom() < 0.55 ? 'leg' : 'arm', rel + (k ? Math.PI : 0), goreRandom() < 0.5);
            bits |= part;
          }
        h.sever = bits;
      }
      if (h.sever & GORE_HEAD) h.fatal = true;
      return h;
    }
    /* A part comes off: the bits, the stump that spurts, the severed piece (gore-props.js), a burst of blood and
       tissue, and for a survivor the fall and the bleeding out. Called by strikePerson after the wound. */
    function goreSever(person, bits, a, hit, source) {
      if (!bits || !goreFull()) return;
      person.goreLost = (person.goreLost || 0) | bits;
      person.goreVersion = (person.goreVersion || 0) + 1;
      person.goreSource = source;
      goreTrack(person);
      const list = goreListOf(person);
      for (const bit of [GORE_HEAD, GORE_ARM[0], GORE_ARM[1], GORE_FOREARM[0], GORE_FOREARM[1], GORE_LEG[0], GORE_LEG[1], GORE_SHIN[0], GORE_SHIN[1]]) {
        if (!(bits & bit)) continue;
        // The whole limb includes its lower part: one stump at the upper cut.
        if ((bit === GORE_FOREARM[0] && bits & GORE_ARM[0]) || (bit === GORE_FOREARM[1] && bits & GORE_ARM[1])) continue;
        if ((bit === GORE_SHIN[0] && bits & GORE_LEG[0]) || (bit === GORE_SHIN[1] && bits & GORE_LEG[1])) continue;
        goreStump(person, bit, hit);
        goreEvent(person, bit, a, hit?.cls === 'blast' ? 2 : 1);
        if (bit !== GORE_HEAD) launchSevered(person, bit, a, hit, list);
        if (bloodOn) goreBurst(person, bit, a, hit);
      }
      if (person.hp > 0) {
        // Down where they stand, crawling, bleeding out (GORE).
        person.woundedDown = true;
        person.hp = Math.min(person.hp, 7);
        person.limping = true;
        if (person.police && !person.downed) {
          person.downed = true;
          person.state = 'downed';
          person.fireToken = false;
        }
        person.goreBleedOut = gameTime + goreBetween(GORE_BLEED_OUT[0], GORE_BLEED_OUT[1]);
      }
    }
    // The list a person lives in (the severed piece retires when they are gone from it).
    function goreListOf(person) {
      for (const list of [pedestrians, officers, gangMembers, enemies, storyActors]) if (list.includes(person)) return list;
      return null;
    }
    function goreTrack(person) {
      if (goreTracked.includes(person)) return;
      if (goreTracked.length >= GORE_TRACKED_MAX) {
        // The oldest that is not bleeding out goes first.
        let i = goreTracked.findIndex((q) => !(q.goreBleedOut && q.hp > 0));
        if (i < 0) i = 0;
        goreTracked.splice(i, 1);
      }
      goreTracked.push(person);
    }
    /* A stump spurting: pulses that weaken, for GORE_SPURT_DEAD s after death or until the bleed-out. */
    function goreStump(person, bit, hit) {
      if (goreStumps.length >= GORE_STUMPS_MAX) goreStumps.shift();
      const strength = bit === GORE_HEAD ? 1.2 : bit === GORE_LEG[0] || bit === GORE_LEG[1] || bit === GORE_ARM[0] || bit === GORE_ARM[1] ? 1.1 : 0.8;
      goreStumps.push({ p: person, bit, at: gameTime, next: gameTime + 0.12, beat: 0, strength: strength * (hit?.cls === 'blast' ? 0.7 : 1) });
    }
    /* For the renderer (crowd3d-gore.js): bone chips and a red mist at a cut. */
    function goreEvent(person, bit, a, kind) {
      const out = goreJointPoint(person, bit, goreScratchPoint),
        e = goreEvents[goreEventCount % GORE_EVENTS_MAX] || (goreEvents[goreEventCount % GORE_EVENTS_MAX] = {});
      e.id = ++goreEventCount;
      e.t = gameTime;
      e.x = out.x;
      e.y = out.y;
      e.z = out.z;
      e.a = a;
      e.head = bit === GORE_HEAD;
      e.kind = kind;
    }
    /**
     * Where a cut is on the body now (map x, y and elevation z) and the way the missing part pointed (dx, dy,
     * dz): the rig's joints (GORE_NECK .. GORE_KNEE) on a body standing, falling or lying along its heading
     * (wounds.js chooseDeathFall; the renderer tips a body over about its heading, crowd3d-draw.js).
     */
    const goreScratchPoint = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
    function goreJointPoint(person, bit, out) {
      let fx = 0,
        up = 0,
        lat = 0,
        ux = 0,
        uy = -1,
        ul = 0;
      if (bit === GORE_HEAD) {
        fx = 0.04;
        up = GORE_NECK;
        uy = 1;
      } else if (bit === GORE_ARM[0] || bit === GORE_ARM[1]) {
        up = GORE_SHOULDER;
        lat = (bit === GORE_ARM[1] ? 1 : -1) * 1.5;
        ul = (bit === GORE_ARM[1] ? 1 : -1) * 0.3;
      } else if (bit === GORE_FOREARM[0] || bit === GORE_FOREARM[1]) {
        up = GORE_ELBOW;
        lat = (bit === GORE_FOREARM[1] ? 1 : -1) * 1.65;
      } else if (bit === GORE_LEG[0] || bit === GORE_LEG[1]) {
        up = GORE_HIP;
        lat = (bit === GORE_LEG[1] ? 1 : -1) * 0.7;
      } else {
        up = GORE_KNEE;
        lat = (bit === GORE_SHIN[1] ? 1 : -1) * 0.7;
      }
      const lying = person.hp <= 0 || person.woundedDown || person.downed || person.knockedFor > 0,
        fall = person.hp <= 0 ? deathFallAmount(person) : lying ? 1 : 0,
        sign = person.hp <= 0 ? (person.deathStyle?.slump ? 0 : (person.deathStyle?.sign ?? 1)) : lying ? -1 : 1,
        heading = (person.a || 0) + (person.hp <= 0 ? (person.deathStyle?.turn || 0) * fall : 0),
        th = (sign * fall * Math.PI) / 2,
        c = Math.cos(th),
        s = Math.sin(th),
        ch = Math.cos(heading),
        sh = Math.sin(heading),
        along = fx * c - up * s,
        height = fx * s + up * c,
        dAlong = ux * c - uy * s,
        dHeight = ux * s + uy * c;
      out.x = person.x + ch * along - sh * lat;
      out.y = person.y + sh * along + ch * lat;
      out.z = entityElevation(person) + height + fall * 1.2;
      out.dx = ch * dAlong - sh * ul;
      out.dy = sh * dAlong + ch * ul;
      out.dz = dHeight;
      return out;
    }
    /* The burst at a cut: tissue and blood thrown on along the shot (wide round a blast), a dense mist, and
       spatter on the ground beyond (blood.js bloodBurst); a drop under the cut. */
    function goreBurst(person, bit, a, hit) {
      const pt = goreJointPoint(person, bit, goreScratchPoint),
        roof = rooftopFloor(person) ? entityElevation(person) : null;
      bloodBurst(pt.x, pt.y, pt.z, a, bit === GORE_HEAD ? 1.3 : 0.9, roof, hit?.cls === 'blast' ? 1.2 : 0.5, null);
      addBloodDrop(pt.x, pt.y, goreBetween(1.4, 2.2), goreBetween(0, TAU), { surface: roof ?? bloodSurface(pt.x, pt.y) });
    }
    /**
     * WOUNDS (the clothes soak): bleed() records where a round went in. `zone` head | torso | arm | leg, `h`
     * 0..1 along it (the chest's top 1, a leg's hip 0), `rel` the entry's direction round the body (0 the
     * front, positive to the right), `side` for a limb, `size` in rig units, `exit` 1 if the round went
     * through (the far side soaks too). The renderers grow the stain over its first seconds from `t`.
     */
    function goreWound(person, zone, a, severity, scale, exit) {
      const rel = normalizeAngle(a + Math.PI - (person.a || 0)),
        size = clamp((0.55 + 0.35 * severity) * Math.sqrt(Math.max(scale, 0.3)), 0.45, 2.4),
        h = zone === 'head' ? goreBetween(0.2, 0.8) : zone === 'torso' ? goreBetween(0.15, 0.95) : goreBetween(0.1, 0.9),
        side = Math.sin(rel) >= 0 ? 1 : 0;
      let list = person.goreWounds;
      if (!list) list = person.goreWounds = [];
      if (list.length >= GORE_WOUNDS_MAX) {
        // Full: the nearest wound of that zone grows instead.
        let best = list[0];
        for (const w of list) if (w.zone === zone && Math.abs(w.h - h) < Math.abs(best.h - h)) best = w;
        best.size = Math.min(2.6, best.size + size * 0.4);
        best.t = Math.min(best.t, gameTime);
      } else list.push({ zone, h: +h.toFixed(3), rel: +rel.toFixed(3), side, size: +size.toFixed(3), exit: exit ? 1 : 0, t: gameTime });
      person.goreVersion = (person.goreVersion || 0) + 1;
      goreTrack(person);
    }
    /* Pulses from the stumps, the maimed bleeding out, wounds' stains growing (the still figures re-record),
       the player's wounds gone once he is healed. Every frame (updateCivic). */
    let goreClock = 0;
    function updateGore(deltaSeconds) {
      for (let i = goreStumps.length - 1; i >= 0; i--) {
        const s = goreStumps[i],
          p = s.p,
          end = p.hp > 0 ? (p.goreBleedOut ?? s.at + 12) : (p.deadTime ?? s.at) + GORE_SPURT_DEAD;
        if (gameTime > end || !(p.goreLost & s.bit) || p.hidden) {
          goreStumps.splice(i, 1);
          continue;
        }
        if (gameTime < s.next) continue;
        // The heart slows and the pressure falls: each beat weaker and later.
        const fade = clamp(1 - (gameTime - s.at) / Math.max(1, end - s.at), 0.15, 1);
        s.beat++;
        s.next = gameTime + 0.62 + (1 - fade) * 0.6;
        if (bloodOn) goreSpurt(p, s.bit, s.strength * fade);
      }
      goreClock += deltaSeconds;
      if (goreClock < 0.5) return;
      goreClock = 0;
      for (let i = goreTracked.length - 1; i >= 0; i--) {
        const p = goreTracked[i];
        if (p.hp > 0 && p.goreBleedOut && gameTime >= p.goreBleedOut) {
          // Bled out: the kill is the shooter's now.
          p.goreBleedOut = undefined;
          p.mutedUntil = gameTime + 2;
          strikePerson(p, p.hp + 100, p.hitDir ?? 0, p.goreSource ?? null, false, 'impact');
          continue;
        }
        // A fresh stain still spreading through the cloth: the renderers' still copies re-record.
        const w = p.goreWounds;
        if (w && w.length && gameTime - w[w.length - 1].t < 24) p.goreVersion = (p.goreVersion || 0) + 1;
        const retired = p !== player && p.hp <= 0 && gameTime - (p.deadTime ?? gameTime) > BLOOD_LIFE;
        if (retired) goreTracked.splice(i, 1);
      }
      // Healed: the player's clothes are clean again (bought health, the hospital).
      if (player.goreWounds?.length && player.hp >= 100 && gameMode === 'play') {
        player.goreWounds.length = 0;
        player.goreVersion = (player.goreVersion || 0) + 1;
      }
    }
    /* One beat from a stump: a jet of drops along the missing part and a little up, and a mist. */
    function goreSpurt(p, bit, strength) {
      const pt = goreJointPoint(p, bit, goreScratchPoint),
        ground = rooftopFloor(p) ? entityElevation(p) : undefined,
        n = Math.max(2, Math.round(6 * strength)),
        h = Math.hypot(pt.dx, pt.dy) || 1;
      for (let i = 0; i < n; i++) {
        const v = goreBetween(26, 64) * strength,
          spread = goreBetween(-0.18, 0.18),
          dx = (pt.dx / h) * Math.cos(spread) - (pt.dy / h) * Math.sin(spread),
          dy = (pt.dy / h) * Math.cos(spread) + (pt.dx / h) * Math.sin(spread);
        particles.push({
          x: pt.x,
          y: pt.y,
          vx: dx * v * Math.max(0.35, h),
          vy: dy * v * Math.max(0.35, h),
          z: pt.z,
          vz: (pt.dz * 0.6 + 0.45) * v,
          life: 1.3,
          max: 1.3,
          color: i % 2 ? '#6a0a13' : '#580810',
          size: goreBetween(0.45, 0.95),
          blood: true,
          surface: ground,
        });
      }
    }
    /* The player's limbs only when a blast kills him (explode): close blasts take what goreHit would. */
    function goreBlastDeath(range, power, a) {
      if (!goreFull() || player.hp > 0) return;
      const h = goreHit(player, 'torso', 'blast', 'handgun', null, { range, power }, a, 200);
      if (h.sever) goreSever(player, h.sever, a, h, null);
    }
    /* WASTED's respawn, a new game: whole again. */
    function goreRestore(p) {
      if (!p) return;
      p.goreLost = 0;
      p.goreBleedOut = undefined;
      if (p.goreWounds) p.goreWounds.length = 0;
      p.goreVersion = (p.goreVersion || 0) + 1;
    }
    function resetGore() {
      goreStumps.length = 0;
      goreTracked.length = 0;
      goreEvents.length = 0;
      goreEventCount = 0;
      severedParts.length = 0;
      goreRestore(player);
    }
    // @include src/gore-props.js
    // @include src/gore-console.js
