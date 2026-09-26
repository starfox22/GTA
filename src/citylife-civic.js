    function updateOfficers(deltaSeconds) {
      assignFireTokens(deltaSeconds);
      for (const c of vehicles) {
        // Sight and gang checks are staggered: each unit looks about seven times
        // a second, which reads the same and costs a fraction at five stars.
        const look = gameTime >= (c.lookAt || 0);
        if (look) c.lookAt = gameTime + 0.12 + seededRandom() * 0.06;
        if (c.cop && (look || c.crewDeployed)) c.seesPlayer = !c.crewDeployed && policeSees(c);
        if (!lawVehicle(c)) continue;
        if (look) c.gangTarget = c.pursuitTarget ? null : policeGangTarget(c);
        // The crew gets out for a runner on foot, and for a driver who has
        // stopped: a car sitting still is surrounded (pursuit.js).
        const onFoot = !player.car || isAircraft(player.car),
          gangClose = c.gangTarget && distanceBetween(c, c.gangTarget) < 300,
          playerClose =
            c.cop &&
            wantedStars > 0 &&
            !harborPoliceProtected(player.x, player.y, 30) &&
            !playerOnRoof() &&
            (onFoot || (player.carStoppedFor || 0) > 1.2) &&
            combatDistance(c, player) < (onFoot ? 350 : 240);
        if (!c.crewDeployed && (gangClose || playerClose) && Math.abs(c.speed) < 24) deployOfficers(c);
      }
      for (const o of officers) {
        // Standing for a screenshot (DeadEndCity.characterLineup): no orders.
        if (o.lineup) continue;
        if (o.hp <= 0) {
          o.state = 'dead';
          continue;
        }
        if (personIncapacitated(o)) {
          o.aiming = false;
          o.state = 'stunned';
          continue;
        }
        // Down but alive: no more shooting, a slow crawl for the car (or out of
        // the way once the police are gone), unless a partner is dragging them.
        if (o.downed) {
          o.state = 'downed';
          o.fireToken = false;
          o.seesPlayer = false;
          if (wantedStars <= 0 && !crowdInView(o.x, o.y, 60)) o.returned = true;
          else if (!o.draggedBy && !o.inCover) {
            const cover = officerCoverSpot(o);
            if (cover && distanceBetween(o, cover) > 10) footStepTowards(o, cover, deltaSeconds, 4 * KMH);
            else o.inCover = true;
          }
          continue;
        }
        if (o.dragging && updateOfficerDrag(o, deltaSeconds)) continue;
        const look = gameTime >= (o.lookAt || 0);
        if (look) {
          o.lookAt = gameTime + 0.12 + seededRandom() * 0.06;
          o.gangTarget = policeGangTarget(o);
        }
        if (
          ((wantedStars <= 0 || harborPoliceProtected(player.x, player.y, 30)) && !o.gangTarget) ||
          (o.state === 'return' && !o.gangTarget)
        ) {
          o.state = 'return';
          o.target = null;
          if (o.car?.hp > 0 && o.car !== player.car && !o.car.stolen && distanceBetween(o, o.car) > 28)
            footStepTowards(o, o.car, deltaSeconds, 11 * KMH);
          else {
            o.returned = true;
          }
          continue;
        }
        // Rooftop marksmen hold their roof and shoot on their own clock (swat.js).
        if (o.roofSniper) continue;
        if (look || o.seesPlayer === undefined) o.seesPlayer = wantedStars > 0 && policeSees(o);
        const seesPlayer = wantedStars > 0 && o.seesPlayer,
          gang = o.gangTarget,
          kind = officerKind(o);
        if (seesPlayer) {
          o.sightTime = (o.sightTime || 0) + deltaSeconds;
          o.lastSawPlayerAt = gameTime;
        } else o.sightTime = 0;
        const target =
          gang && (!seesPlayer || distanceBetween(o, gang) < distanceBetween(o, player) * 1.2)
            ? gang
            : wantedStars > 0
              ? player
              : gang;
        if (!target) {
          o.state = 'return';
          continue;
        }
        if (
          o.post &&
          target === player &&
          !seesPlayer &&
          distanceBetween(o, player) > 340 &&
          distanceBetween(o, o.post) > 16
        ) {
          o.state = 'post';
          o.target = null;
          footStepTowards(o, o.post, deltaSeconds, 13 * KMH);
          continue;
        }
        // The runner drove off: back to the car and after them.
        if (
          target === player &&
          !o.blockade &&
          player.car &&
          !isAircraft(player.car) &&
          Math.abs(player.car.speed || 0) > 70 &&
          distanceBetween(o, player) > 190 &&
          o.car?.hp > 0 &&
          !o.car.stolen &&
          o.car !== player.car
        ) {
          o.state = 'remount';
          footStepTowards(o, o.car, deltaSeconds, kind.run * 1.15);
          if (distanceBetween(o, o.car) < 32) o.returned = true;
          continue;
        }
        const seen = target === player ? seesPlayer : clearSight(o, target),
          d = distanceBetween(o, target),
          changed = o.target !== target;
        o.target = target;
        const chase = seen ? target : target === player ? lastSeen : o.gangLastSeen || target;
        o.a = headingBetween(o, chase);
        const range =
          target === player ? (isAircraft(player.car) ? 330 : kind.range) : 210;
        if (seen && combatDistance(o, target) < range) {
          if (!['aim', 'approach', 'arrest'].includes(o.state) || changed) {
            o.state = 'aim';
            o.timer = Math.max(0.65, o.timer);
            o.engagedSaid = false;
          }
          // One star, or a runner who has stopped fighting with officers close
          // by: walk up and make the arrest (pursuit.js).
          if (target === player && (!officerMayShoot(o, player) || (policeMayArrest && d < 120))) {
            if (o.state !== 'arrest') o.state = 'approach';
            if (d > 22) footStepTowards(o, player, deltaSeconds, 9 * KMH);
            o.a = headingBetween(o, player);
            if (!o.challengeSaid && d < 200) o.challengeSaid = radio(policeMayArrest ? 'police-under-arrest' : 'police-challenge', o);
            continue;
          }
          o.state = 'aim';
          if (target === player && !o.engagedSaid && radio('target-engaged', o)) o.engagedSaid = true;
          if (gameTime < (o.staggerUntil || 0)) continue;
          if (d < 42)
            moveBody(o, -Math.cos(o.a) * 5 * KMH * deltaSeconds, -Math.sin(o.a) * 5 * KMH * deltaSeconds, 8);
          else {
            const spot = officerPosition(o, target, d, !o.fireToken && target === player);
            if (spot) {
              footStepTowards(o, spot, deltaSeconds, kind.run * (o.fireToken ? 0.65 : 0.9));
              o.a = headingBetween(o, target);
            }
          }
          // Only the officers holding a firing token shoot at the player; the
          // rest hold aim and move up (pursuit.js assignFireTokens).
          if (target !== player || o.fireToken) officerShoot(o, target, deltaSeconds);
        } else {
          if (target === player && !seen && officerSuppress(o, deltaSeconds)) {
            o.state = 'suppress';
            if (distanceBetween(o, lastSeen) > 90) footStepTowards(o, lastSeen, deltaSeconds, 8 * KMH);
            o.a = headingBetween(o, lastSeen);
            continue;
          }
          o.state = 'pursue';
          // A SWAT stack moves up in file behind its shield (swat.js).
          const goal = (target === player && swatStackSpot(o)) || chase;
          if (distanceBetween(o, goal) > (goal === chase ? 20 : 4))
            footStepTowards(o, goal, deltaSeconds, target === player && player.car ? 18 * KMH : kind.run);
        }
      }
      for (let i = officers.length - 1; i >= 0; i--) if (officers[i].returned) officers.splice(i, 1);
      for (const c of vehicles)
        if (!c.blockade && c.crewDeployed && c.crew?.every((o) => o.returned || o.hp <= 0)) {
          c.crewLost = c.crew.every((o) => o.hp <= 0);
          if (c.crewLost) {
            c.cop = false;
            c.seesPlayer = false;
            c.gangTarget = null;
          }
          c.crewDeployed = false;
          c.ai = !c.crewLost && wantedStars <= 0 && c.hp > 0 && !c.stolen && !c.lawUnit;
          c.crew = [];
        }
    }
    function updateWanted(deltaSeconds) {
      updateStarProgress(deltaSeconds);
      updatePursuit(deltaSeconds);
      if (mission?.index === 2 && [1, 2].includes(mission.stage)) {
        wantedStars = Math.max(1, wantedStars);
        searchActive = false;
        lastSeen = {
          x: mission.car.x,
          y: mission.car.y,
        };
        copSpawn -= deltaSeconds;
        if (copSpawn <= 0) {
          copSpawn = 6;
          spawnCop();
        }
        return;
      }
      if (mission?.index === 10 && mission.stage === 5) {
        wantedStars = Math.max(mission.escapeHeat, wantedStars);
        searchActive = false;
        lastSeen = {
          x: player.x,
          y: player.y,
        };
        return;
      }
      if (cargoChase()) {
        updateCargoPursuit(deltaSeconds);
        return;
      }
      // Mission 1, inside Vinny's sealed warehouse (harbor.js THE DROP): the
      // police know where the truck went and cannot get in after it. The heat
      // is held, and no more units are sent, until the player slips out the back.
      if (depotStakeout()) {
        wantedStars = Math.max(mission.depotHeat, wantedStars);
        searchActive = false;
        searchRemaining = policeSearchSeconds();
        lastSeen = {
          x: player.x,
          y: player.y,
        };
        return;
      }
      if (wantedStars <= 0) {
        searchActive = false;
        searchRemaining = 0;
        return;
      }
      const seen = policeHaveEyesOnPlayer();
      if (seen) {
        lastSeen = {
          x: player.x,
          y: player.y,
        };
        searchActive = false;
        searchRemaining = policeSearchSeconds();
      } else {
        if (!searchActive) {
          searchActive = true;
          searchRemaining = policeSearchSeconds();
          if (wantedStars >= 2) policeRadioEvent('lost');
        }
        // Inside the search area (the circle on the radar) the clock barely
        // moves: the police are combing those streets. Get out of it.
        const inZone = distanceBetween(player, lastSeen) < policeSearchRadius();
        searchRemaining = Math.max(0, searchRemaining - deltaSeconds * (inZone ? 0.2 : 1));
        if (searchRemaining === 0) {
          clearPolice(true);
          return;
        }
      }
      dispatchPolice(deltaSeconds);
    }
    const BLOOD_LIMIT = 240,
      BLOOD_TRACK_DISTANCE = BLOCK_SIZE * 0.07,
      bloodArt = [];
    function bloodSurface(x, y) {
      return DOCKS.some((d) => x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h)
        ? 2.2
        : terrainHeight(x, y);
    }
    function bloodStamp(variant = 0) {
      if (bloodArt[variant]) return bloodArt[variant];
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const drawingContext = cv.getContext('2d');
      let state = 731 + variant * 977;
      const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const gr = drawingContext.createRadialGradient(64, 64, 8, 64, 64, 49);
      gr.addColorStop(0, '#43030c');
      gr.addColorStop(0.55, '#720819');
      gr.addColorStop(1, '#a21b2bcc');
      drawingContext.fillStyle = gr;
      drawingContext.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = (i * TAU) / 40,
          r = 34 + random() * 15,
          x = 64 + Math.cos(a) * r,
          y = 64 + Math.sin(a) * r * 0.75;
        i ? drawingContext.lineTo(x, y) : drawingContext.moveTo(x, y);
      }
      drawingContext.closePath();
      drawingContext.fill();
      for (let i = 0; i < 30; i++) {
        const a = random() * TAU,
          r = 35 + random() * 25;
        drawingContext.fillStyle = i % 3 ? '#821025d9' : '#b92c36bd';
        drawingContext.beginPath();
        drawingContext.ellipse(
          64 + Math.cos(a) * r,
          64 + Math.sin(a) * r,
          1 + random() * 3,
          0.7 + random() * 2,
          a,
          0,
          TAU,
        );
        drawingContext.fill();
      }
      drawingContext.fillStyle = '#ca4c493a';
      drawingContext.beginPath();
      drawingContext.ellipse(58, 56, 14, 4, -0.25, 0, TAU);
      drawingContext.fill();
      bloodArt[variant] = cv;
      return cv;
    }
    function addBloodPool(x, y, r, a, extra = {}) {
      if (!groundAt(x, y)) return;
      bloodPools.push({
        x,
        y,
        r,
        a,
        created: gameTime,
        variant: Math.floor(seededRandom() * 4),
        surface: bloodSurface(x, y),
        ...extra,
      });
      while (bloodPools.length > BLOOD_LIMIT) bloodPools.shift();
    }
    function bleed(p, severity = 1, a = 0) {
      if (!bloodOn) return;
      severity = clamp(severity, 0.25, 2.5);
      const n = Math.ceil(10 + severity * 12),
        z = entityElevation(p),
        roof = rooftopFloor(p);
      for (let i = 0; i < n; i++) {
        const spread = a + randomBetween(-1.05, 1.05),
          v = randomBetween(24, 110) * Math.min(1.6, severity),
          life = randomBetween(0.45, 0.9);
        particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(spread) * v,
          vy: Math.sin(spread) * v,
          z: z + 9,
          vz: randomBetween(16, 44),
          life,
          max: life,
          color: randomChoice(['#a90c20', '#c42a35', '#760718']),
          size: randomBetween(1.1, 3.1),
          blood: true,
          surface: roof ? z : undefined,
        });
      }
      addBloodPool(p.x, p.y, clamp(7 + severity * 5, 8, 22), a, {
        grow: p.hp <= 0,
        opacity: 0.96,
        surface: roof ? z : bloodSurface(p.x, p.y),
      });
      for (let i = 0; i < 3 + Math.ceil(severity * 3); i++) {
        const aa = a + randomBetween(-0.8, 0.8),
          d = randomBetween(9, 22) * severity,
          x = p.x + Math.cos(aa) * d,
          y = p.y + Math.sin(aa) * d;
        addBloodPool(x, y, randomBetween(1.8, 4.4), aa, {
          opacity: 0.86,
          surface: roof ? z : bloodSurface(x, y),
        });
      }
    }
    function scream(p) {
      if (!voicesOn || gameTime < screamAt || distanceBetween(p, player) > 470) return;
      screamAt = gameTime + 1.7;
      playSample(
        randomChoice([
          'civilian-scream-male-1',
          'civilian-scream-male-2',
          'civilian-scream-female-1',
          'civilian-scream-female-2',
        ]),
        0.65,
        randomBetween(0.95, 1.05),
        p,
      );
    }
    function strikePerson(person, damage, a = 0, source = null, showBlood = true, kind = 'ballistic') {
      if (person.hp <= 0) return;
      const dealt = ballisticDamage(person, damage, kind);
      if (person.faction && source === player) alertGang(person.faction);
      if (source) {
        person.threat = {
          x: source.x,
          y: source.y,
        };
      }
      if (person.police && source?.faction) {
        person.gangTarget = source;
        person.gangSeenAt = gameTime;
        person.gangLastSeen = {
          x: source.x,
          y: source.y,
        };
        source.policeThreatUntil = gameTime + 15;
        source.policeAggroUntil = gameTime + 15;
      }
      if (person.faction && source?.police) person.policeAggroUntil = gameTime + 15;
      person.hp -= dealt;
      person.flee = 8;
      // A hit officer staggers: a half-second with no aimed fire, shoved back.
      if (person.police && person.hp > 0 && dealt > 4) {
        person.staggerUntil = gameTime + (kind === 'blast' ? 1.2 : 0.45);
        moveBody(person, Math.cos(a) * 6, Math.sin(a) * 6, 8);
      }
      // A round the vest ate sparks off the plate instead of opening a wound.
      const stopped = dealt < damage * 0.4 && wearingVest(person);
      if (stopped) particle(person.x, person.y, '#e8dfb6', 4, 55, 2);
      else if (showBlood) bleed(person, Math.min(2, dealt / 38), a);
      scream(person);
      // Where it landed, the flinch, a limp, a blood trail, the fall (wounds.js).
      if (dealt > 0) woundPerson(person, dealt, a, kind, source);
      if (person.hp <= 0) {
        person.deadTime = gameTime;
        // Witnesses who find the body later report whoever did it.
        person.killedBy = source;
        if (showBlood) bleed(person, 2, a);
        if (source === player) recordKill(person, kind);
      }
    }
    function updateCivic(deltaSeconds) {
      if (!godTimeFrozen()) worldMinutes += deltaSeconds; // GOD PANEL: freeze time (god-panel.js)
      updateHarbor(deltaSeconds);
      updateStoryWorld(deltaSeconds);
      // Police parts are timed on their own so stats() shows the cost of a chase.
      timed('police:officers', () => updateOfficers(deltaSeconds));
      timed('police:wanted', () => updateWanted(deltaSeconds));
      timed('police:roadblocks', () => updateRoadblocks(deltaSeconds));
      updateDepotDoors(deltaSeconds);
      updateCrowdDensity(deltaSeconds);
      timed('police:air', () => updateAirPolice(deltaSeconds));
      updateWounds();
      for (let i = bloodPools.length - 1; i >= 0; i--)
        if (gameTime - bloodPools[i].created > 240) bloodPools.splice(i, 1);
    }
    function navigationState() {
      const waypoint = waypointNavigation();
      if (waypoint) return waypoint;
      const target = objective();
      return target
        ? {
            visible: true,
            distance: Math.round(worldMeters(distanceBetween(player, target))),
            a: headingBetween(player, target),
            name: mission
              ? mission.instruction || missions[mission.index].title
              : 'NEXT JOB · PAYPHONE',
          }
        : {
            visible: false,
          };
    }
    function civicUI() {
      storyUI();
      const hm = harborCargoJob();
      // The cargo bar matters until the crates are in Vinny's warehouse.
      getElement('cargoStatus').style.display = hm && hm.stage < 4 ? 'block' : 'none';
      if (hm) {
        getElement('cargoLabel').textContent = hm.loading
          ? 'LOADING ' + (hm.collected + 1) + ' / 3'
          : 'CARGO ' + hm.collected + ' / 3';
        getElement('cargoFill').style.width =
          ((hm.collected + (hm.loading ? hm.loading.time / 2.1 : 0)) / 3) * 100 + '%';
      }
      if (gameMode === 'play' && harborGate < 0.82 && withinRange('harbor-gate', distanceBetween(player, HARBOR.gate), 110, 130))
        offerPrompt('OPEN HARBOR BARRIER', { id: 'harbor-gate' });
      else if (gameMode === 'play') {
        harborBayPrompt(hm);
        // Inside Vinny's warehouse after the shutter (harbor.js THE DROP).
        depotDropPrompt(hm);
      }
      getElement('worldClock').textContent =
        'DAY ' + (Math.floor(worldMinutes / 1440) + 1) + ' · ' + clockText();
      const nav = navigationState();
      getElement('navigation').style.display = nav.visible ? 'flex' : 'none';
      if (nav.visible) {
        getElement('navArrow').style.transform = 'rotate(' + ((nav.a * 180) / Math.PI + 90) + 'deg)';
        getElement('navTitle').textContent = nav.name;
        getElement('navDistance').textContent = nav.distance + ' m';
      }
      const cargo = cargoChase(),
        dispatching = !!cargo && !cargo.policeArrived;
      getElement('chaseStatus').classList.toggle('dispatching', dispatching);
      getElement('chaseStatus').textContent = dispatching
        ? 'Cops alerted · ' + Math.ceil(cargo.policeArrivalIn - 1e-7) + 's'
        : mission?.index === 10 && mission.stage === 5
          ? 'MANIFEST EXPOSED · GET DANIEL INSIDE VINNY’S WAREHOUSE'
          : depotStakeout()
            ? mission.stage === 5
              ? 'OFFICERS INSIDE THE WAREHOUSE'
              : 'POLICE OUTSIDE · OUT THE BACK'
          : cargo
            ? 'COPS TRACKING TRUCK · RESPRAY AT R'
            : wantedStars > 0
              ? searchActive
                ? distanceBetween(player, lastSeen) < policeSearchRadius()
                  ? 'LEAVE THE SEARCH AREA'
                  : 'OUT OF SIGHT · STAY HIDDEN'
                : 'POLICE HAVE EYES ON YOU'
              : '';
      const airText = airPursuitStatus();
      if (airText) getElement('chaseStatus').textContent += '\n' + airText;
      getElement('chaseStatus').classList.toggle('searching', searchActive);
      const timer = getElement('policeEscapeTimer');
      timer.classList.toggle('hidden', !(wantedStars > 0 && searchActive));
      document.body?.classList.toggle('police-search-active', wantedStars > 0 && searchActive);
      getElement('policeEscapeSeconds').textContent = Math.ceil(searchRemaining) + 's';
      if (gameMode === 'play' && !player.car && !playerOnRoof()) {
        const place = nearestPlace();
        if (place) offerPrompt(place.name, { id: 'place|' + place.name });
      }
      roofMissionUI();
      militaryUI();
      offroadClubUI();
    }
    function drawCivicMap(drawingContext, big) {
      for (const p of PLACES) {
        const font = big ? 90 : 65,
          w = p.symbol.length * (big ? 59 : 43) + 35,
          h = big ? 115 : 87;
        drawingContext.fillStyle = '#101d25';
        drawingContext.fillRect(p.door.x - w / 2, p.door.y - h / 2, w, h);
        drawingContext.strokeStyle = p.color;
        drawingContext.lineWidth = big ? 8 : 5;
        drawingContext.strokeRect(p.door.x - w / 2, p.door.y - h / 2, w, h);
        drawingContext.fillStyle = p.color;
        drawingContext.font = 'bold ' + font + 'px monospace';
        drawingContext.textAlign = 'center';
        drawingContext.fillText(p.symbol, p.door.x, p.door.y + font * 0.34);
      }
      for (const d of DOCKS) {
        drawingContext.fillStyle = '#8fbad5';
        drawingContext.fillRect(d.x, d.y, d.w, d.h);
        if (big) {
          drawingContext.fillStyle = '#101d25';
          drawingContext.fillRect(d.boatX - 145, d.boatY + 20, 290, 100);
          drawingContext.fillStyle = '#a8d7e5';
          drawingContext.font = 'bold 78px monospace';
          drawingContext.textAlign = 'center';
          drawingContext.fillText(d.type === 'jetski' ? 'JET' : 'BOAT', d.boatX, d.boatY + 99);
        }
      }
    }
    function policeMapUnits() {
      const units = [];
      for (const c of vehicles)
        if (c.hp > 0 && c !== player.car && (c.airUnit || lawVehicle(c)))
          units.push({
            unit: c,
            kind: c.airUnit ? 'air' : 'car',
            alerted:
              !c.airRetreat && !!(c.missionPursuit || c.gangTarget || (c.cop && wantedStars > 0)),
          });
      for (const o of officers)
        if (o.hp > 0 && !o.returned && o.state !== 'dead')
          units.push({
            unit: o,
            kind: 'foot',
            alerted: !!(o.gangTarget || (wantedStars > 0 && o.state !== 'return')),
          });
      return units;
    }
    function drawPoliceMap(drawingContext, scale) {
      drawPoliceSearch(drawingContext, scale);
      // Markers retain a readable screen size on both the local radar and city map.
      for (const { unit: u, kind, alerted } of policeMapUnits()) {
        drawingContext.save();
        drawingContext.translate(u.x, u.y);
        drawingContext.scale(1 / scale, 1 / scale);
        const color = alerted && Math.sin(gameTime * 8) > 0 ? '#ff736d' : '#6ccfff';
        drawingContext.strokeStyle = '#081822';
        drawingContext.lineWidth = 2.5;
        drawingContext.fillStyle = color;
        if (kind === 'air') {
          drawingContext.beginPath();
          drawingContext.arc(0, 0, 7.5, 0, TAU);
          drawingContext.stroke();
          drawingContext.fill();
          drawingContext.strokeStyle = '#eef9ff';
          drawingContext.lineWidth = 1.8;
          drawingContext.beginPath();
          drawingContext.moveTo(-5, 0);
          drawingContext.lineTo(5, 0);
          drawingContext.moveTo(0, -5);
          drawingContext.lineTo(0, 5);
          drawingContext.stroke();
          drawingContext.fillStyle = '#173248';
          drawingContext.fillRect(-1.5, -2.5, 3, 5);
        } else if (kind === 'foot') {
          drawingContext.beginPath();
          drawingContext.arc(0, 0, 4, 0, TAU);
          drawingContext.stroke();
          drawingContext.fill();
          drawingContext.fillStyle = '#f4fcff';
          drawingContext.beginPath();
          drawingContext.arc(0, 0, 1.3, 0, TAU);
          drawingContext.fill();
        } else {
          drawingContext.rotate(u.a);
          drawingContext.beginPath();
          drawingContext.moveTo(7, 0);
          drawingContext.lineTo(4, -4);
          drawingContext.lineTo(-6, -4);
          drawingContext.lineTo(-6, 4);
          drawingContext.lineTo(4, 4);
          drawingContext.closePath();
          drawingContext.stroke();
          drawingContext.fill();
          drawingContext.fillStyle = '#effaff';
          drawingContext.fillRect(1, -2.5, 1.8, 5);
          drawingContext.fillStyle = alerted ? '#ff736d' : '#205a85';
          drawingContext.fillRect(-2, -3, 2, 6);
        }
        drawingContext.restore();
      }
    }
    function drawBlood2D(roof = false) {
      for (const b of bloodPools)
        if (rooftopFloor(b) === roof && visible(b, 45)) {
          const age = gameTime - b.created,
            growth = b.grow ? 1 + Math.min(0.28, age * 0.045) : 1;
          worldContext.save();
          worldContext.globalAlpha = (b.opacity ?? 0.95) * clamp((240 - age) / 35, 0, 1);
          worldContext.translate(b.x, b.y);
          worldContext.rotate(b.a);
          if (b.track) {
            worldContext.fillStyle = '#86101e';
            worldContext.fillRect(-b.r * 1.3, -b.r * 0.23, b.r * 2.6, b.r * 0.46);
            worldContext.fillStyle = '#3b171833';
            for (let x = -b.r; x < b.r; x += 1.4)
              worldContext.fillRect(x, -b.r * 0.23, 0.5, b.r * 0.46);
          } else {
            const size = b.r * 2.5 * growth;
            worldContext.drawImage(bloodStamp(b.variant || 0), -size / 2, -size / 2, size, size);
          }
          worldContext.restore();
        }
    }
    getElement('closeService').onclick = closeService;
