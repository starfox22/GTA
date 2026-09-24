    // BEGIN SUBSYSTEM: src/wounds.js — Wounds, hit reactions and death falls
    /**
     * Wounds, hit reactions and death falls
     * Source: src/wounds.js
     * Scope: shared game closure.
     * What a hit does to a body beyond its health: where it landed (head, torso,
     * legs), the flinch the renderers play for it (crowd3d.js for pedestrians,
     * render3d.js for officers, gangs and guards), a limp after a leg hit, a
     * blood trail from anyone wounded who keeps moving, and how the body goes
     * down: thrown back away from the shot, pitched forward, spun round, or slid
     * down a wall into a sitting slump. The fall itself takes half a second.
     *
     * Downed officers (hit hard but alive) stop fighting and crawl for their car;
     * a partner may drag them into cover (see updateOfficers, citylife.js).
     */
    const HIT_FLINCH_SECONDS = 0.4,
      DEATH_FALL_SECONDS = 0.55,
      BLEEDER_LIMIT = 48,
      bleeders = [];
    function pickHitZone(kind) {
      if (kind === 'headshot') return 'head';
      if (kind === 'blast' || kind === 'impact' || kind === 'melee') return 'torso';
      const r = seededRandom();
      return r < 0.12 ? 'head' : r < 0.7 ? 'torso' : 'leg';
    }
    /* Called by strikePerson for every hit that did damage. */
    function woundPerson(person, dealt, a, kind, source = null) {
      person.hitAt = gameTime;
      person.hitDir = a;
      person.hitZone = pickHitZone(kind);
      // Not every fatal-looking round kills outright: a body hit (not the head,
      // not a blast) leaves an officer down about one time in three and a
      // bystander about one time in four, alive on the ground, crawling.
      if (
        person.hp <= 0 &&
        kind === 'ballistic' &&
        person.hitZone !== 'head' &&
        !person.woundedDown &&
        (person.police || pedestrians.includes(person)) &&
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
      if (dealt < 4) return;
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
     */
    function chooseDeathFall(person, a, kind) {
      const facingShooter = Math.cos(normalizeAngle((person.a || 0) - (a + Math.PI))) > 0,
        style = { sign: 1, turn: 0, slump: false };
      // A wall within a couple of steps behind: stagger back into it.
      let wall = 0;
      if (kind !== 'blast' && kind !== 'impact')
        for (let d = 6; d <= 30 && !wall; d += 4)
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
      // A blast or a car throws the body; a round only knocks it back a step.
      if (kind !== 'blast' && kind !== 'impact' && !style.slump) moveBody(person, Math.cos(a) * 5, Math.sin(a) * 5, 6);
      person.deathStyle = style;
    }
    /* 0 standing to 1 on the ground, over the half second after death. */
    function deathFallAmount(p) {
      if (p.deathStyle?.slump) return 0;
      if (p.deadTime === undefined) return 1;
      const t = clamp((gameTime - p.deadTime) / DEATH_FALL_SECONDS, 0, 1);
      return t * t;
    }
    /* The flinch a fresh hit plays: 0..1, fading over 0.4 s. */
    function hitFlinch(p) {
      const since = gameTime - (p.hitAt ?? -10);
      return p.hp > 0 && since < HIT_FLINCH_SECONDS ? 1 - since / HIT_FLINCH_SECONDS : 0;
    }
    /* The wounded who keep moving leave drops behind them. */
    function updateWounds() {
      for (let i = bleeders.length - 1; i >= 0; i--) {
        const b = bleeders[i],
          p = b.p;
        if (p.hp <= 0 || gameTime > b.until || p.hidden) {
          bleeders.splice(i, 1);
          continue;
        }
        const moved = Math.hypot(p.x - b.x, p.y - b.y);
        if (moved < 13) continue;
        if (moved < 120 && Math.abs(p.x - player.x) < 1400 && Math.abs(p.y - player.y) < 1400)
          addBloodPool(p.x, p.y, randomBetween(1.6, 3.2), headingBetween(b, p), { opacity: 0.8 });
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
