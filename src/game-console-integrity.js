    // BEGIN SUBSYSTEM: src/game-console-integrity.js — DeadEndCity console: integrity(), the invariants tools/bot.mjs checks after every action
    // A read-only sweep for impossible state: non-finite numbers, the player or a vehicle inside solid
    // geometry, below the ground or off the map, carriers still held, overlays outliving their mode,
    // bad words in the HUD. Nothing here changes the game.
    // The world box (game-state.js WORLD_LEFT..WORLD_SIZE, WORLD_TOP..WORLD_SIZE: the sea, the map), grown by a margin.
    // Aircraft and boats may leave it (world-edge.js warns them at a line inside the box and destroys them after 10 s, so a bot run can see them out there briefly); everything else is off the map out there.
    const INTEGRITY_MARGIN = 400;
    function integrityReport() {
      const bad = [],
        flag = (what) => {
          if (bad.length < 60) bad.push(what);
        },
        finite = (v) => typeof v === 'number' && Number.isFinite(v),
        off = (x, y) => x < WORLD_LEFT - INTEGRITY_MARGIN || x > WORLD_SIZE + INTEGRITY_MARGIN || y < WORLD_TOP - INTEGRITY_MARGIN || y > WORLD_SIZE + INTEGRITY_MARGIN,
        at = (e) => Math.round(e.x) + ',' + Math.round(e.y),
        insideBuilding = (e) => {
          for (const b of buildingsNear(e.x, e.y)) if (e.x > b.x && e.x < b.x + b.w && e.y > b.y && e.y < b.y + b.h) return true;
          return false;
        };
      // The player.
      for (const k of ['x', 'y', 'a', 'hp', 'armor']) if (!finite(player[k])) flag('player.' + k + ' = ' + player[k]);
      if (player.altitude !== undefined && !finite(player.altitude)) flag('player.altitude = ' + player.altitude);
      if (!finite(cash) || cash < 0) flag('cash = ' + cash);
      if (!finite(wantedStars) || wantedStars < 0 || wantedStars > 5) flag('wantedStars = ' + wantedStars);
      if (!finite(gameTime) || !finite(worldMinutes)) flag('clock is not finite');
      const car = player.car;
      if (finite(player.x) && finite(player.y) && off(player.x, player.y) && !(car && (isAircraft(car) || isBoat(car)))) flag('player off the map at ' + at(player));
      const onFoot =
        !car &&
        !player.swimming &&
        !player.wading &&
        !player.roof &&
        !player.buildingRoof &&
        !player.deck &&
        !player.pool &&
        !player.parachute &&
        !player.fall &&
        !player.climbing &&
        !player.coaster &&
        !transitRide &&
        !taxiRide &&
        !((player.jumpUntil || 0) > gameTime);
      if (onFoot && gameMode === 'play') {
        if (solid(player.x, player.y, 3)) flag('player inside solid geometry at ' + at(player) + ' in ' + districtAt(player.x, player.y));
        const ground = terrainHeight(player.x, player.y);
        if (finite(player.altitude) && player.altitude < ground - 4) flag('player below the ground at ' + at(player) + ' (' + Math.round(player.altitude) + ' < ' + Math.round(ground) + ')');
      }
      if (car) {
        if (!vehicles.includes(car)) flag('player.car is not in vehicles (' + car.type + ')');
        if (!isAircraft(car) && !isBoat(car) && !(car.altitude > 4) && !car.deckAir && gameMode === 'play') {
          let deepest = 0;
          for (const b of nearbyStatics(car)) {
            if (b.minHeight !== undefined && entityElevation(car) + vehicleCollisionHeight(car) < b.minHeight) continue;
            const hit = boxContact(contactShape(car), b);
            if (hit && hit.depth > deepest) deepest = hit.depth;
          }
          if (deepest > 9) flag('player ' + car.type + ' sunk ' + deepest.toFixed(1) + ' units into a static at ' + at(car));
        }
      }
      // Every vehicle.
      const seenCars = new Set();
      let carsInBuildings = 0,
        carsOff = 0,
        carsBroken = 0;
      for (const c of vehicles) {
        if (seenCars.has(c)) flag('vehicle listed twice: ' + c.type + ' #' + c.id);
        seenCars.add(c);
        // vx / vy are NaN by design until the first physics step derives them (makeCar), and stay so on a far parked
        // car that skips integration: only the player's own car, once it has been through a step (it has statics then).
        const broken = ['x', 'y', 'a', 'hp', 'speed', 'av', 'altitude', ...(c === car && c.stepStatics ? ['vx', 'vy'] : [])].filter((k) => c[k] !== undefined && c[k] !== null && !finite(c[k]));
        if (broken.length) {
          carsBroken++;
          flag('vehicle ' + c.type + ' #' + c.id + ' has non-finite ' + broken.map((k) => k + ' ' + c[k]).join(', ') + ' at ' + at(c));
          continue;
        }
        if (off(c.x, c.y)) {
          carsOff++;
          if (!isAircraft(c) && !isBoat(c)) flag('vehicle ' + c.type + ' #' + c.id + ' off the map at ' + at(c));
        }
        if (!isAircraft(c) && !isBoat(c) && !(c.altitude > 4) && !c.roofSite && insideBuilding(c)) carsInBuildings++;
      }
      // Everyone on two feet.
      let peopleBroken = 0,
        peopleInBuildings = 0,
        peopleOff = 0,
        stuckReactions = 0;
      const stuckPeople = [];
      const seenPeople = new Set();
      for (const list of [pedestrians, officers, enemies, gangMembers])
        for (const p of list) {
          if (seenPeople.has(p)) flag('person listed twice at ' + at(p));
          seenPeople.add(p);
          if (!(finite(p.x) && finite(p.y) && finite(p.hp))) {
            peopleBroken++;
            flag('person has a non-finite field (x ' + p.x + ', y ' + p.y + ', hp ' + p.hp + ')');
            continue;
          }
          if (off(p.x, p.y)) peopleOff++;
          else if (p.hp > 0 && !p.indoors && !p.hidden && !p.roof && !(p.altitude > 4) && insideBuilding(p)) peopleInBuildings++;
          // A reaction (startReaction) that ran well past its length near the player: someone frozen for good.
          const r = p.react;
          if (r && p.hp > 0 && finite(r.t) && r.t > (finite(r.dur) ? r.dur : 0) + 25 && Math.abs(p.x - player.x) < 700 && Math.abs(p.y - player.y) < 700) {
            stuckReactions++;
            if (stuckPeople.length < 3) stuckPeople.push({ kind: r.kind, t: Math.round(r.t), dur: finite(r.dur) ? +r.dur.toFixed(1) : r.dur, state: p.state, at: at(p) });
          }
        }
      if (peopleOff) flag(peopleOff + ' people off the map');
      for (const [i, w] of weapons.entries())
        if (!finite(w.ammo) || !finite(w.reserve) || w.ammo < 0 || w.reserve < 0 || w.ammo > w.clip) flag('weapon ' + i + ' ' + w.name + ' ammo ' + w.ammo + ' reserve ' + w.reserve);
      // Bad words anywhere in the visible text.
      const text = document.body ? document.body.innerText || '' : '',
        word = /\b(NaN|undefined|Infinity|null)\b|\[object/.exec(text);
      if (word) flag('HUD text has "' + word[0] + '": ' + text.slice(Math.max(0, word.index - 30), word.index + 30).replace(/\s+/g, ' '));
      // Overlays: none stays up in play.
      const overlays = [...document.querySelectorAll('.overlay:not(.hidden)')].map((e) => e.id);
      if (gameMode === 'play' && overlays.length) flag('overlay open in play: ' + overlays.join(','));
      if (gameMode === 'play' && mapOpen) flag('map open in play');
      return {
        problems: bad,
        mode: gameMode,
        overlays,
        player: { x: Math.round(player.x), y: Math.round(player.y), hp: Math.round(player.hp), vehicle: car ? car.type : null, onFoot },
        carriers: {
          swimming: !!player.swimming,
          wading: !!player.wading,
          parachute: !!player.parachute,
          fall: !!player.fall,
          climbing: !!player.climbing,
          carjack: !!player.carjack,
          thrown: !!player.thrown,
          tumble: !!player.tumble,
          coaster: !!player.coaster,
          pool: !!player.pool,
          deck: !!player.deck,
          roof: !!(player.roof || player.buildingRoof),
          transit: !!transitRide,
          taxi: !!taxiRide,
          loot: lootCrouching(),
          rideSkip: rideSkipActive(),
          hidden: !!player.hidden,
          conversation: !!player.inConversation,
        },
        counts: {
          vehicles: vehicles.length,
          pedestrians: pedestrians.length,
          officers: officers.length,
          particles: particles.length,
          skids: skids.length,
          debris: debris.length,
          bullets: bullets.length,
          fires: fires.length,
          notices: notices.length,
          carsInBuildings,
          carsOff,
          carsBroken,
          peopleInBuildings,
          peopleBroken,
          stuckReactions,
        },
        stuckPeople,
      };
    }
    addConsoleMethods('integrity', {
      // Impossible state right now (see integrityReport): `problems` empty is a pass.
      integrity: () => integrityReport(),
    });
    // END SUBSYSTEM: src/game-console-integrity.js
