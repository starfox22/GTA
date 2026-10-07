    // BEGIN SUBSYSTEM: src/wounds.js — Wounds, hit reactions and death falls
    /**
     * Wounds, hit reactions and death falls
     * Source: src/wounds.js
     * Scope: shared game closure.
     * What a hit does to a body beyond its health: where it landed (head, torso,
     * legs), the flinch the renderers play for it (crowd3d.js for pedestrians,
     * render3d.js for officers, gangs and guards), a limp after a leg hit, a
     * blood trail from anyone wounded who keeps moving, and how the body goes
     * down: over backwards away from the shot, pitched forward, spun round, or slid
     * down a wall into a sitting slump (a round never moves the body). The fall itself takes half a second.
     *
     * Downed officers (hit hard but alive) stop fighting and crawl for their car;
     * a partner may drag them into cover (see updateOfficers, citylife.js).
     */
    const HIT_FLINCH_SECONDS = 0.4,
      DEATH_FALL_SECONDS = 0.55,
      BLEEDER_LIMIT = 48,
      bleeders = [];
    // Console tests only (combat-rules.js strikeTest): the zone every round lands in.
    let hitZoneOverride = null;
    function pickHitZone(kind) {
      if (kind === 'headshot') return 'head';
      if (kind === 'blast' || kind === 'impact' || kind === 'melee') return 'torso';
      // A punch lands on the jaw or the body.
      if (kind === 'punch') return seededRandom() < 0.4 ? 'head' : 'torso';
      if (hitZoneOverride) return hitZoneOverride;
      const r = seededRandom();
      return r < 0.12 ? 'head' : r < 0.7 ? 'torso' : 'leg';
    }
    /* Called by strikePerson for every hit that did damage (`zone` chosen there; a
       round `stopped` by a vest bruises: a flinch, no limp, no blood trail). */
    function woundPerson(person, dealt, a, kind, source = null, zone = null, stopped = false) {
      // Poisoned (mission 2): no wound, no fall of its own, no blood trail.
      if (person.poisoned) return;
      person.hitAt = gameTime;
      person.hitDir = a;
      person.hitZone = zone || pickHitZone(kind);
      // Not every fatal-looking round kills outright: a body hit (not the head,
      // not a blast) leaves an officer down about one time in three and a
      // bystander about one time in four, alive on the ground, crawling.
      if (
        person.hp <= 0 &&
        kind === 'ballistic' &&
        person.hitZone !== 'head' &&
        !person.woundedDown &&
        // A chest destroyed at point blank (gore.js GORE) leaves no one crawling.
        !person.goreFatal &&
        (person.police || pedestrians.includes(person)) &&
        // Mission 1's sealed warehouse: no one left crawling on the floor (harbor.js depotPoliceInside).
        !(person.police && depotSealed && insideDepot(person.x, person.y)) &&
        seededRandom() < (person.police ? 0.35 : 0.25)
      ) {
        person.hp = person.police ? 9 : 7;
        person.woundedDown = true;
        if (source === player) recordWounding(person);
      }
      if (person.hp <= 0) {
        chooseDeathFall(person, a, kind);
        return;
      }
      if (dealt < 4 || stopped) return;
      // A leg wound slows anyone for the rest of the fight.
      if (person.hitZone === 'leg' || person.hp < (person.maxhp || 100) * 0.3) {
        person.limping = true;
        if (pedestrians.includes(person)) person.injured = true;
      }
      // Hit hard but alive: an officer goes down and crawls for cover.
      if (person.police && person.hp < 26 && !person.downed) {
        person.downed = true;
        person.state = 'downed';
        person.fireToken = false;
        policeRadioEvent('officer-down', person);
      }
      if (bleeders.length < BLEEDER_LIMIT && !bleeders.some((b) => b.p === person))
        bleeders.push({ p: person, x: person.x, y: person.y, until: gameTime + 40 });
    }
    /**
     * How a body goes down. It lands along the line of the shot: facing the
     * shooter it goes over backwards, facing away it pitches forward; about one
     * in three spins round as it drops, and with a wall a few steps behind it
     * staggers back into it and slides down
     * into a sitting slump instead. The heading is turned so the renderers,
     * which tip a body over backwards about its own heading, land it right.
     * A round never moves the body: it drops where it stood (only a wall right
     * behind it turns the fall into a slump); a blast or a car throws it
     * (physics-knockdowns.js, explode).
     */
    function chooseDeathFall(person, a, kind) {
      const facingShooter = Math.cos(normalizeAngle((person.a || 0) - (a + Math.PI))) > 0,
        style = { sign: 1, turn: 0, slump: false },
        round = kind === 'ballistic' || kind === 'headshot';
      // A wall within a couple of steps behind: stagger back into it (a round:
      // only a wall the body already stands against).
      let wall = 0;
      if (kind !== 'blast' && kind !== 'impact')
        for (let d = 6; d <= (round ? 9 : 30) && !wall; d += 4)
          if (solid(person.x + Math.cos(a) * d, person.y + Math.sin(a) * d, 4)) wall = d;
      if (wall && seededRandom() < 0.75) {
        style.slump = true;
        person.a = a + Math.PI;
        if (wall > 9) moveBody(person, Math.cos(a) * (wall - 9), Math.sin(a) * (wall - 9), 6);
      } else {
        style.sign = kind === 'headshot' || kind === 'blast' || facingShooter ? 1 : -1;
        person.a = style.sign > 0 ? a + Math.PI : a;
        if (kind !== 'headshot' && seededRandom() < 0.35) style.turn = (seededRandom() < 0.5 ? -1 : 1) * randomBetween(0.7, 1.4);
      }
      // A blast or a car throws the body; a knife or a punch knocks it back a step;
      // a round leaves it where it stood.
      if (kind !== 'blast' && kind !== 'impact' && !round && !style.slump) moveBody(person, Math.cos(a) * 5, Math.sin(a) * 5, 6);
      person.deathStyle = style;
    }
    /* 0 standing to 1 on the ground, over the half second after death. Poison
       (the Blue Hour's glass, roofmission-poison.js) has already laid the body
       down through its own faint: it stays down. */
    function deathFallAmount(p) {
      if (p.deathStyle?.slump) return 0;
      if (p.poisoned) return 1;
      if (p.deadTime === undefined) return 1;
      const t = clamp((gameTime - p.deadTime) / DEATH_FALL_SECONDS, 0, 1);
      return t * t;
    }
    /* The flinch a fresh hit plays: 0..1, fading over 0.4 s. */
    function hitFlinch(p) {
      const since = gameTime - (p.hitAt ?? -10);
      return p.hp > 0 && since < HIT_FLINCH_SECONDS ? 1 - since / HIT_FLINCH_SECONDS : 0;
    }
    /* The wounded who keep moving leave drops behind them; someone wounded on the
       floor (crawling or down) who lies still for a moment bleeds a small pool
       (blood.js bodyPool 'wounded'), left behind as it was when they crawl on. */
    function updateWounds() {
      for (let i = bleeders.length - 1; i >= 0; i--) {
        const b = bleeders[i],
          p = b.p;
        if (p.hp <= 0 || gameTime > b.until || p.hidden || p.poisoned) {
          bleeders.splice(i, 1);
          continue;
        }
        if (p.woundedDown || p.downed) {
          if (b.restX === undefined || Math.hypot(p.x - b.restX, p.y - b.restY) > 3) {
            b.restX = p.x;
            b.restY = p.y;
            b.restAt = gameTime;
            const pool = p.bloodPool;
            if (pool?.wounded) {
              pool.rMax = Math.max(pool.r, 0.5);
              pool.vol = pool.rMax * pool.rMax;
              p.bloodPool = null;
            }
          } else if (!p.bloodPool && gameTime - b.restAt > 1.5) bodyPool(p, 'wounded', p.hitDir || 0);
        }
        const moved = Math.hypot(p.x - b.x, p.y - b.y);
        if (moved < 13) continue;
        if (moved < 120 && Math.abs(p.x - player.x) < 1400 && Math.abs(p.y - player.y) < 1400)
          addBloodDrop(p.x + randomBetween(-1.5, 1.5), p.y + randomBetween(-1.5, 1.5), randomBetween(0.55, 1), headingBetween(b, p), { stretch: 1.3, opacity: 0.85 });
        b.x = p.x;
        b.y = p.y;
      }
    }
    /* For policeReport(): how the dead fell and how the living are hurt. */
    function woundReport() {
      const r = { back: 0, faceDown: 0, spun: 0, slumped: 0, downedOfficers: 0, dragged: 0, limping: 0, crawling: 0, bleeding: bleeders.length };
      for (const list of [pedestrians, officers, gangMembers, enemies])
        for (const p of list) {
          if (p.hp <= 0 && p.deathStyle) {
            const d = p.deathStyle;
            if (d.slump) r.slumped++;
            else if (d.sign < 0) r.faceDown++;
            else r.back++;
            if (d.turn) r.spun++;
          } else if (p.hp > 0) {
            if (p.downed) r.downedOfficers++;
            if (p.draggedBy || p.inCover) r.dragged++;
            if (p.limping) r.limping++;
            if (p.pose === 'crawl') r.crawling++;
          }
        }
      return r;
    }
    // END SUBSYSTEM: src/wounds.js
