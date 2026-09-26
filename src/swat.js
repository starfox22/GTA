    // BEGIN SUBSYSTEM: src/swat.js — SWAT teams, riot shields and rooftop snipers
    /**
     * SWAT teams, riot shields and rooftop snipers
     * Source: src/swat.js
     * Scope: shared game closure.
     *
     * TEAMS: a SWAT van (pursuit.js, four stars and up) stops, throws its rear
     * doors open (the renderer swings them, render3d.js) and its team files out of
     * the back: four operators at four stars, five at five. The first carries a
     * ballistic shield and a pistol and leads; the rest form a stack behind the
     * shield in pairs, rifles up, and keep formation until the lead is within
     * about 150 units of the player, when they fan out to flank as before. A
     * shield stops rounds from the front (sparks, no wound); flank or rear hits
     * land. If the shield man goes down the stack breaks up.
     *
     * ROOFTOP SNIPERS: only now and then at five stars. The first may come
     * ROOF_SNIPER_FIRST seconds into the five-star chase, then one every
     * ROOF_SNIPER_EVERY seconds on a ROOF_SNIPER_CHANCE roll; one on the roofs at
     * a time, a second only after ROOF_SNIPER_SECOND_AFTER seconds at five stars
     * (and never both brought in together). A marksman takes a roof round the
     * player (30-200 units high, 220-650 away, a clear line to the street) and
     * telegraphs: a red laser from the rifle to the player, a glint on the scope,
     * the rising beep and the screen-edge warning (combat-rules.js SNIPER FIRE)
     * while it lines up for SNIPER_AIM_SECONDS, then one led tracer round the
     * player can dodge, then SNIPER_REST. Breaking the line resets the aim.
     * After ROOF_SNIPER_SHOTS rounds, or once the player is far away, it packs
     * up (gone when out of view). They can be shot like anyone else (rounds climb
     * to their roof); they stand down when the level drops.
     *
     * SNIPERS_ENABLED (below) switches the rooftop snipers off: with it false no
     * marksman is ever brought in (spawnRoofSniper refuses, whoever asks), any
     * already on a roof packs up at once, and their telegraph (laser, beep,
     * screen-edge warning, 'SNIPER' messages) never shows. The code is kept
     * whole so they can come back by setting the flag to true.
     */
    // Rooftop police snipers. Off at the owner's request (30.x): players were
    // being killed from off screen during five-star chases. Set to true to bring
    // them back exactly as they were (POLICE_TIERS `snipers` caps how many).
    const SNIPERS_ENABLED = false;
    const SWAT_STACK_SPACING = 13,
      SWAT_STACK_BREAK = 150,
      SNIPER_AIM_SECONDS = 2.4,
      SNIPER_REST = [6, 9],
      ROOF_SNIPER_FIRST = [25, 45],
      ROOF_SNIPER_EVERY = [60, 90],
      ROOF_SNIPER_CHANCE = 0.65,
      ROOF_SNIPER_SECOND_AFTER = 150,
      ROOF_SNIPER_SHOTS = 2,
      ROOF_SNIPER_FAR = 900;
    let roofSniperTimer = 30,
      roofSniperChase = 0,
      roofSniperWarningAt = -100;
    const swatStats = { teams: 0, shieldBlocks: 0, snipers: 0, sniperShots: 0 };
    function swatCrewSize(stars = Math.ceil(wantedStars)) {
      return stars >= 5 ? 5 : 4;
    }
    /* Where each operator climbs out: in pairs behind the van's rear doors. */
    function swatDeploySpots(c, size) {
      const spec = vehicleSpec(c),
        back = spec.l / 2 + 9,
        spots = [];
      for (let i = 0; i < size; i++) {
        const row = Math.floor(i / 2),
          side = i % 2 ? 1 : -1;
        for (const extra of [0, 14, 28, -40]) {
          const along = -(back + row * 11 + extra),
            lateral = side * 7 + (extra < 0 ? side * (spec.w / 2 + 12) : 0),
            p = {
              x: c.x + Math.cos(c.a) * along - Math.sin(c.a) * lateral,
              y: c.y + Math.sin(c.a) * along + Math.cos(c.a) * lateral,
            };
          if (!solid(p.x, p.y, 7) && !vehicles.some((o) => o !== c && pointInCar(p.x, p.y, o, 7))) {
            spots.push(p);
            break;
          }
        }
      }
      return spots;
    }
    /* Called by deployOfficers (citylife.js) for each operator of a SWAT van. */
    function equipSwatOperator(o, index, team) {
      if (index === 0) {
        // The point man: shield and pistol.
        o.shield = true;
        o.rifle = false;
        o.teamLead = true;
        team.lead = o;
        swatStats.teams++;
      } else {
        o.stackLeader = team.lead || null;
        o.stackSlot = index;
      }
    }
    /* The slot behind the shield, or null once the stack has broken up. */
    function swatStackSpot(o) {
      const lead = o.stackLeader;
      if (!lead || lead === o || lead.hp <= 0 || lead.downed || lead.returned || personIncapacitated(lead)) return null;
      if (distanceBetween(lead, player) < SWAT_STACK_BREAK) return null;
      const toward = headingBetween(lead, player),
        row = Math.ceil(o.stackSlot / 2),
        side = o.stackSlot % 2 ? 1 : -1,
        back = row * SWAT_STACK_SPACING,
        lateral = side * 6,
        spot = {
          x: lead.x - Math.cos(toward) * back - Math.sin(toward) * lateral,
          y: lead.y - Math.sin(toward) * back + Math.cos(toward) * lateral,
        };
      return solid(spot.x, spot.y, 7) ? null : spot;
    }
    /* The shield man walks straight at the player, to a short range. */
    function swatLeadSpot(o, d) {
      if (!o.shield) return null;
      const toward = headingBetween(player, o),
        r = clamp(d - 30, 55, 140),
        spot = { x: player.x + Math.cos(toward) * r, y: player.y + Math.sin(toward) * r };
      return solid(spot.x, spot.y, 7) ? null : spot;
    }
    /* A round from the front stops on the shield. */
    function shieldBlocks(p, b) {
      if (!p.shield || p.hp <= 0 || p.downed || personIncapacitated(p)) return false;
      const from = Math.atan2(-(b.vy || 0), -(b.vx || 0));
      if (Math.abs(normalizeAngle(from - p.a)) > 0.95) return false;
      swatStats.shieldBlocks++;
      return true;
    }

    /* ---- Rooftop snipers ------------------------------------------------------------- */
    function roofSniperSite() {
      const sites = [];
      for (const b of buildings) {
        if (b.depotWall || b.height < realBuildingHeight(30) || b.height > realBuildingHeight(200)) continue;
        const cx = b.x + b.w / 2,
          cy = b.y + b.h / 2;
        if (Math.abs(cx - player.x) > 800 || Math.abs(cy - player.y) > 800) continue;
        // The corner of the roof nearest the player, inside the parapet.
        const inset = 9,
          x = clamp(player.x, b.x + inset, b.x + b.w - inset),
          y = clamp(player.y, b.y + inset, b.y + b.h - inset),
          d = Math.hypot(x - player.x, y - player.y);
        if (d < 220 || d > 650) continue;
        if (officers.some((o) => o.roofSniper && o.hp > 0 && Math.hypot(o.x - x, o.y - y) < 260)) continue;
        const spot = { x, y, altitude: b.height };
        if (!clearSight(spot, player)) continue;
        sites.push({ ...spot, b, score: Math.abs(d - 420) + seededRandom() * 120 });
      }
      sites.sort((p, q) => p.score - q.score);
      return sites[0] || null;
    }
    function spawnRoofSniper() {
      if (!SNIPERS_ENABLED) return null;
      const site = roofSniperSite();
      if (!site) return null;
      const o = makeOfficer(site.x, site.y, headingBetween(site, player), 'sniper', {
        altitude: site.altitude,
        roofSniper: true,
        roof: site.b,
        hold: true,
        sniperLock: 0,
        sniperRestUntil: gameTime + 1.5,
      });
      officers.push(o);
      swatStats.snipers++;
      if (gameTime - lastDispatchLine > 5) dispatchCaption('POLICE SNIPERS ON THE ROOFTOPS', null);
      return o;
    }
    function updateRoofSnipers(deltaSeconds) {
      trackPlayerMotion(deltaSeconds);
      const stars = Math.ceil(wantedStars),
        wanted = SNIPERS_ENABLED && stars >= 5 && !playerAtSea() && player.x < CITY_SIZE && player.y < CITY_SIZE;
      let live = 0;
      for (const o of officers) {
        if (!o.roofSniper) continue;
        o.sniperAim = 0;
        if (o.hp <= 0 || o.returned) continue;
        // Stood down, done shooting or left far behind: they pack up, and are
        // gone once nobody is looking at their roof.
        if (!wanted || o.sniperShots >= ROOF_SNIPER_SHOTS || distanceBetween(o, player) > ROOF_SNIPER_FAR) {
          o.sniperDone = true;
          o.aiming = false;
          o.sniperLock = 0;
          if (!crowdInView(o.x, o.y, 80) || gameTime - (o.sniperDoneAt ??= gameTime) > 20) o.returned = true;
          continue;
        }
        live++;
        if (o.downed || personIncapacitated(o)) {
          o.sniperLock = 0;
          continue;
        }
        const d = combatDistance(o, player);
        // Its own clock: updateOfficers keeps `lookAt` for the gang checks.
        if (gameTime >= (o.sniperLookAt || 0)) {
          o.sniperLookAt = gameTime + 0.12 + seededRandom() * 0.05;
          o.sightClear = d < 760 && clearSight(o, player);
        }
        const sees = o.sightClear && !playerOnRoof();
        o.seesPlayer = sees;
        o.a = headingBetween(o, player);
        o.aiming = sees;
        if (!sees || policeHoldFire() || gameTime < o.sniperRestUntil) {
          o.sniperLock = Math.max(0, o.sniperLock - deltaSeconds * 2);
          continue;
        }
        o.sniperLock += deltaSeconds;
        o.sniperAim = clamp(o.sniperLock / SNIPER_AIM_SECONDS, 0, 1);
        noteSniperLock(o, o.sniperAim);
        if (o.sniperLock > 0.4 && gameTime - roofSniperWarningAt > 7) {
          roofSniperWarningAt = gameTime;
          tell('SNIPER ON THE ROOFTOPS · KEEP MOVING OR GET INTO COVER', 2.4);
        }
        if (o.sniperLock < SNIPER_AIM_SECONDS) continue;
        // The round: a tracer at where the marksman guesses the player will be.
        o.sniperLock = 0;
        o.sniperRestUntil = gameTime + randomBetween(...SNIPER_REST);
        o.sniperShots = (o.sniperShots || 0) + 1;
        swatStats.sniperShots++;
        const a0 = headingBetween(o, player),
          origin = { x: o.x + Math.cos(a0) * 12, y: o.y + Math.sin(a0) * 12, altitude: entityElevation(o) },
          round = fireSniperRound(o, origin, 1100, 0.9, 60),
          a = Math.atan2(round.vy, round.vx);
        playSample('pistol', 0.5, 0.6, o);
        if (city3D) city3D.fire(origin.x, origin.y, a, false, origin.altitude);
      }
      if (!wanted) {
        roofSniperChase = 0;
        roofSniperTimer = randomBetween(...ROOF_SNIPER_FIRST);
        return;
      }
      roofSniperChase += deltaSeconds;
      roofSniperTimer -= deltaSeconds;
      if (roofSniperTimer > 0) return;
      // Now and then, never two in quick succession.
      roofSniperTimer = randomBetween(...ROOF_SNIPER_EVERY);
      const allowed = Math.min(policeTier().snipers || 0, roofSniperChase >= ROOF_SNIPER_SECOND_AFTER ? 2 : 1);
      if (live < allowed && seededRandom() < ROOF_SNIPER_CHANCE && !spawnRoofSniper()) roofSniperTimer = 8;
    }
    // END SUBSYSTEM: src/swat.js
