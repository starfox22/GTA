    // Gore console (DeadEndCity, group 'gore', registered in game-console-crowd.js): goreReport, goreShot,
    // goreBlast, goreSeed and bloodPlanTable (docs/console/crowd.md).
    const GORE_NAMES = [
      [GORE_HEAD, 'head'],
      [GORE_ARM[0], 'arm L'],
      [GORE_ARM[1], 'arm R'],
      [GORE_FOREARM[0], 'forearm L'],
      [GORE_FOREARM[1], 'forearm R'],
      [GORE_LEG[0], 'leg L'],
      [GORE_LEG[1], 'leg R'],
      [GORE_SHIN[0], 'shin L'],
      [GORE_SHIN[1], 'shin R'],
    ];
    function goreLostNames(bits) {
      const out = [];
      for (const [bit, name] of GORE_NAMES) if ((bits || 0) & bit) out.push(name);
      return out;
    }
    // Test targets by role: hit points and armour (combat-rules.js NPC BODY ARMOUR).
    function goreTestTarget(role, a, distance) {
      const kinds = { civilian: { hp: 30 }, gang: { hp: 80 }, patrol: { hp: OFFICER_KINDS.patrol.hp, vest: OFFICER_KINDS.patrol.vest }, swat: { hp: OFFICER_KINDS.swat.hp, vest: OFFICER_KINDS.swat.vest, vestPlate: true } },
        r = kinds[role];
      if (!r) throw Error('gore: role is civilian, gang, patrol or swat');
      const p = { x: player.x + Math.cos(a) * distance, y: player.y + Math.sin(a) * distance, a: a + Math.PI, dir: a + Math.PI, hp: r.hp, maxhp: r.hp, vest: r.vest || 0, vestPlate: !!r.vestPlate, flee: 0, timer: 999, walk: 0, state: 'idle', stateTime: 900 };
      dressPerson(p, 'casual');
      pedestrians.push(p);
      return p;
    }
    function goreOutcome(p, before) {
      return {
        x: +p.x.toFixed(1),
        y: +p.y.toFixed(1),
        // The heading the shot travelled (radians; bloodSides).
        a: +(player.a || 0).toFixed(4),
        hp: Math.round(p.hp),
        dead: p.hp <= 0,
        down: !!p.woundedDown,
        lost: goreLostNames(p.goreLost),
        pieces: severedParts.filter((s) => s.owner === p).length,
        thrown: severedParts.length - before,
        wounds: p.goreWounds?.length || 0,
        bleedOut: p.hp > 0 && p.goreBleedOut ? +(p.goreBleedOut - gameTime).toFixed(1) : null,
        hit: { cls: goreLastHit.cls, zone: goreLastHit.zone, close: +goreLastHit.close.toFixed(3), scale: +goreLastHit.scale.toFixed(3), burst: +goreLastHit.burst.toFixed(3) },
      };
    }
    function goreShotRun(role = 'civilian', weaponIndex = 2, metres = 1.5, zone = null, heavy = false) {
      const w = weapons[weaponIndex];
      if (!w || w.melee || w.rocket) throw Error('goreShot: a firearm index (0 9mm, 1 machine pistol, 2 shotgun, 4 rifle, 5 precision)');
      if (player.car) exitCar();
      const a = player.a || 0,
        p = goreTestTarget(role, a, metres * UNITS_PER_METRE),
        before = severedParts.length;
      hitZoneOverride = zone || null;
      try {
        for (let j = 0; j < (w.pellets || 1) && p.hp > 0; j++) strikePerson(p, w.dmg, a, player, true, 'ballistic', w.cal || 'handgun', heavy ? GORE_HEAVY_DETAIL : null);
      } finally {
        hitZoneOverride = null;
      }
      return goreOutcome(p, before);
    }
    function goreConsole() {
      return {
        // The gore state: the setting, severed pieces (kind, at rest, age, where), spurting stumps, people with
        // wounds or bleeding out, the last hit's class, range, zone, closeness and blood scale.
        goreReport() {
          return {
            level: goreLevel(),
            severed: severedParts.map((s) => ({ kind: s.kind, lost: goreLostNames(s.bit)[0], rest: s.rest, age: +(gameTime - s.born).toFixed(1), x: Math.round(s.x), y: Math.round(s.y), z: +s.z.toFixed(2), ownerDead: s.owner.hp <= 0 })),
            stumps: goreStumps.length,
            tracked: goreTracked.length,
            // The people with wounds or a lost part: where, dead or alive, what they lost, seconds to bleeding out.
            people: goreTracked.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), dead: p.hp <= 0, lost: goreLostNames(p.goreLost), wounds: p.goreWounds?.length || 0, bleedOut: p.hp > 0 && p.goreBleedOut ? +(p.goreBleedOut - gameTime).toFixed(1) : null })),
            events: goreEventCount,
            caps: { severed: GORE_PARTS_MAX, stumps: GORE_STUMPS_MAX, tracked: GORE_TRACKED_MAX, wounds: GORE_WOUNDS_MAX, decals: BLOOD_LIMIT },
            player: { lost: goreLostNames(player.goreLost), wounds: (player.goreWounds || []).map((w) => ({ zone: w.zone, size: w.size, exit: w.exit })) },
            lastHit: { ...goreLastHit, range: +(goreLastHit.range / UNITS_PER_METRE).toFixed(2) },
          };
        },
        // Tests: a dressed bystander `metres` ahead of the player (`role` civilian, gang, patrol or swat for
        // their hit points and vest) takes ONE trigger pull from weapon `weaponIndex` (every pellet of a
        // shotgun load), fired by the player from there, in `zone` (head, torso, leg; null: as it falls);
        // `heavy` true makes it a .50 round. Returns hp, dead, down, lost parts, pieces thrown, the hit.
        goreShot: (role, weaponIndex, metres, zone, heavy) => goreShotRun(role, weaponIndex, metres, zone, heavy),
        // Tests: the player shoots a bystander standing `gap` metres in front of the south face of the nearest
        // building (taller than 4 m) from `metres` further south, facing north, with weapon `weaponIndex` in
        // `zone`: the spray reaches the wall or not. Returns the outcome and `wall` (splashes on that face).
        goreWallShot(weaponIndex = 2, metres = 1.5, gap = 1, zone = 'torso') {
          if (player.car) exitCar();
          let best = null,
            bestD = Infinity;
          for (const b of buildings) {
            if ((b.height ?? 0) < 32 || b.w < 40 || b.shopPanes) continue;
            const d = Math.hypot(b.x + b.w / 2 - player.x, b.y + b.h - player.y);
            if (d < bestD) {
              best = b;
              bestD = d;
            }
          }
          if (!best) throw Error('goreWallShot: no building');
          const vx = best.x + best.w / 2,
            vy = best.y + best.h + gap * UNITS_PER_METRE;
          teleportPlayer(vx, vy + metres * UNITS_PER_METRE);
          player.a = -Math.PI / 2;
          const result = goreShotRun('civilian', weaponIndex, metres, zone);
          result.wall = bloodPools.filter((b) => b.wall && Math.abs(b.x - vx) < 40 && Math.abs(b.y - (best.y + best.h)) < 2).length;
          result.face = { x: Math.round(vx), y: Math.round(best.y + best.h) };
          return result;
        },
        // Tests: a sedan parked broadside `gap` metres (to its flank) beyond a bystander the player shoots from
        // `metres` with weapon `weaponIndex` in `zone`: the spray stains it (car-stains.js) only within its reach.
        // Returns the outcome and `stains` (records on that car) and their severity.
        goreCarShot(weaponIndex = 2, metres = 1.5, gap = 1, zone = 'torso') {
          if (player.car) exitCar();
          const a = player.a || 0,
            d = (metres + gap) * UNITS_PER_METRE,
            c = makeCar('sedan', player.x + Math.cos(a) * d + Math.cos(a) * 8.5, player.y + Math.sin(a) * d + Math.sin(a) * 8.5, a + Math.PI / 2, false, '#d8d4c8');
          const result = goreShotRun('civilian', weaponIndex, metres, zone);
          result.stains = c.stains ? c.stains.length : 0;
          result.stainSev = c.stains ? c.stains.map((s) => s.sev) : [];
          return result;
        },
        // Tests: a blast of `power` (1 a rocket) `metres` beyond a fresh bystander 50 units ahead of the player.
        goreBlast(metres = 2, power = 1) {
          if (player.car) exitCar();
          const a = player.a || 0,
            p = goreTestTarget('civilian', a, 50),
            before = severedParts.length;
          explode(p.x + Math.cos(a) * metres * UNITS_PER_METRE, p.y + Math.sin(a) * metres * UNITS_PER_METRE, power, 'player');
          return goreOutcome(p, before);
        },
        // Inspection only: hide the player's own figure (true) for close-ups of what lies at his feet
        // (closeUp, inspectView); false shows him again.
        goreInspect(on = true) {
          player.hidden = !!on;
          return player.hidden;
        },
        // Seed gore.js goreRandom (blood and gore's own stream) for a repeatable run.
        goreSeed(seed = 1) {
          goreSeed = seed >>> 0 || 1;
          return goreSeed;
        },
        // The blood a round lets out (blood.js HOW MUCH A ROUND LETS OUT) by weapon, range and zone, with no
        // chance in it: blood scale, drops, ground spatters, the spray's reach (m) and how close it counts.
        bloodPlanTable() {
          const rows = [
            ['9mm 15 m torso', 0, 15, 'torso'],
            ['9mm 15 m head', 0, 15, 'head'],
            ['9mm 15 m leg', 0, 15, 'leg'],
            ['9mm 1 m torso', 0, 1, 'torso'],
            ['rifle 15 m torso', 4, 15, 'torso'],
            ['rifle 3 m torso', 4, 3, 'torso'],
            ['shotgun 20 m leg', 2, 20, 'leg'],
            ['shotgun 6 m leg', 2, 6, 'leg'],
            ['shotgun 4 m leg', 2, 4, 'leg'],
            ['shotgun 1.5 m leg', 2, 1.5, 'leg'],
            ['shotgun 1.5 m head', 2, 1.5, 'head'],
            ['.50 30 m torso', -1, 30, 'torso'],
          ];
          const out = {};
          goreDryRun = true;
          try {
            for (const [name, index, metres, zone] of rows) {
              const w = index >= 0 ? weapons[index] : { dmg: 34 },
                dummy = { x: 0, y: 0, a: Math.PI, hp: 100 },
                h = goreHit(dummy, zone, 'ballistic', index >= 0 ? w.cal || 'handgun' : 'rifle', null, { range: metres * UNITS_PER_METRE, heavy: index < 0 }, 0, w.dmg),
                plan = bloodShotPlan(Math.min(2, (w.dmg * BALLISTIC_LETHALITY) / 38), h);
              out[name] = { scale: plan.scale, drops: plan.drops, spatters: plan.spatters, reach: +(plan.reach / UNITS_PER_METRE).toFixed(1), close: +h.close.toFixed(3), burst: +h.burst.toFixed(3) };
            }
          } finally {
            goreDryRun = false;
          }
          return out;
        },
      };
    }
