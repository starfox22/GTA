    // BEGIN SUBSYSTEM: src/story.js — Story characters and mission stages
    /**
     * Story characters and mission stages
     * Source: src/story.js
     * Scope: shared game closure.
     * Mission definitions, contact dialogue, stage transitions, restart and completion.
     */
    const CHARACTERS = {
      vinny: {
        id: 'vinny',
        name: 'Vinny Moretti',
        age: 44,
        role: 'Fixer',
        background:
          'A former taxi dispatcher who now moves stolen cars through his waterfront repair shop. He owes the Harbor Kings money and is running out of favors.',
        color: '#d6b572',
      },
      elena: {
        id: 'elena',
        name: 'Elena Cruz',
        age: 32,
        role: 'Courier and witness',
        background:
          'A former freight dispatcher who kept a copy of the shipping accounts when her employer started paying gang protection. She wants enough money to leave, not a crown.',
        color: '#7ac9c7',
      },
      mara: {
        id: 'mara',
        name: 'Mara Velez',
        age: 39,
        role: 'Rooftop club owner',
        background:
          "The owner of the Blue Hour rooftop bar once kept the Glasshouse Crew's books. Her venue is neutral ground, but her patience with its armed guests has run out.",
        color: '#d896b6',
      },
      leon: {
        id: 'leon',
        name: 'Leon Rusk',
        age: 48,
        role: 'Harbor Kings leader',
        background:
          'A former longshoreman who turned a stolen-cargo operation into a private toll on every load crossing the docks.',
        color: '#bb7357',
      },
      kit: {
        id: 'kit',
        name: "Charlotte 'Kit' Vale",
        age: 37,
        role: 'Glasshouse Crew leader',
        background:
          "A polished nightclub operator buying influence along the beachfront. She sees Leon's old docks as the last obstacle to controlling the city's nightlife and contraband.",
        color: '#ab8dd0',
      },
      rafe: {
        id: 'rafe',
        name: "Rafael 'Rafe' Serrano",
        age: 47,
        role: 'Charter pilot',
        background:
          'A former island mail pilot with a patched-up charter aircraft and a strict rule: no gunfire near the fuel trucks.',
        color: '#8fc0a2',
      },
    };
    const STORY = [
      {
        title: 'Dockside Favor',
        contact: 'vinny',
        reward: 2400,
        phoneMessage:
          'Vinny gave you a mission: take his truck, load three harbor crates, and drive them into his warehouse.',
        brief: 'Take the truck, load three harbor crates, and drive them into the warehouse.',
      },
      {
        title: 'A Seat at the Table',
        contact: 'vinny',
        reward: 4200,
        phoneMessage:
          'Vinny gave you a mission: dress as a guest, kill Luciano Vescari at Blue Hour, and escape.',
        brief: 'Dress as a guest, kill Luciano Vescari at Blue Hour, and escape.',
      },
      {
        title: "Vinny's Favor",
        contact: 'vinny',
        reward: 1400,
        phoneMessage: 'Vinny gave you a mission: steal the coupe and deliver it to Vinny.',
        brief: 'Steal the coupe and deliver it to Vinny.',
      },
      {
        title: 'Paper Trail',
        contact: 'elena',
        reward: 4600,
        phoneMessage: 'Elena gave you a mission: collect the receipts and lose the police.',
        brief: 'Collect the receipts and lose the police.',
      },
      {
        title: 'No Last Ferry',
        contact: 'elena',
        reward: 5400,
        phoneMessage: 'Elena gave you a mission: take Elena from the cinema to her motel.',
        brief: 'Take Elena from the cinema to her motel.',
      },
      {
        title: 'Both Sides of the Bay',
        contact: 'vinny',
        reward: 6800,
        phoneMessage: 'Vinny gave you a mission: collect both account books in the armored van.',
        brief: 'Collect both account books in the armored van.',
      },
      {
        title: 'Above the Noise',
        contact: 'mara',
        reward: 3000,
        phoneMessage: 'Mara gave you a mission: take the elevator and meet Mara upstairs.',
        brief: 'Take the elevator and meet Mara upstairs.',
      },
      {
        title: 'Saltwater Accounting',
        contact: 'mara',
        reward: 7200,
        phoneMessage:
          'Mara gave you a mission: recover the case by jet ski; deliver it to the airport.',
        brief: 'Recover the case by jet ski; deliver it to the airport.',
      },
      {
        title: 'One Clean Exit',
        contact: 'elena',
        reward: 14000,
        phoneMessage: 'Elena gave you a mission: clear the hangar and get Elena to Rafe.',
        brief: 'Clear the hangar and get Elena to Rafe.',
      },
    ];
    missions.push(...STORY);
    const gangMembers = [],
      storyActors = [];
    let dialogueAction = null,
      dialogueCanClose = true,
      liftTravel = null,
      lastDistrict = '',
      districtNoticeUntil = 0;
    const GANGS = [
      {
        id: 'harbor',
        name: 'HARBOR KINGS',
        color: '#b66951',
        x: 3130,
        y: 1480,
      },
      {
        id: 'glass',
        name: 'GLASSHOUSE CREW',
        color: '#b19bcc',
        x: -1920,
        y: 3712,
      },
    ];
    const LOC = {
      vinny: {
        x: 3150,
        y: 3200,
      },
      cinema: {
        x: 958,
        y: 1086,
      },
      motel: {
        x: -2183,
        y: 1990,
      },
      warehouse: {
        x: -1920,
        y: 3200,
      },
      hangar: {
        x: 1040,
        y: 5180,
      },
      terminal: {
        x: 1180,
        y: 5005,
      },
      waterCase: {
        x: -899,
        y: 2070,
      },
    };
    function findStreetPoint(x, y, r = 10) {
      if (!solid(x, y, r))
        return {
          x,
          y,
        };
      for (let d = 20; d < 400; d += 20)
        for (let i = 0; i < 16; i++) {
          const p = {
            x: x + Math.cos((i * TAU) / 16) * d,
            y: y + Math.sin((i * TAU) / 16) * d,
          };
          if (!solid(p.x, p.y, r)) return p;
        }
      return {
        ...spawn,
      };
    }
    function actor(name, x, y, color, altitude) {
      return {
        name,
        x,
        y,
        color,
        altitude,
        a: Math.PI,
        hp: 100,
        walk: 0,
        ally: true,
      };
    }
    function populateStoryWorld() {
      gangMembers.length = 0;
      storyActors.length = 0;
      storyActors.push(
        actor('VINNY MORETTI', LOC.vinny.x - 43, LOC.vinny.y - 67, '#bb9b6e'),
        actor('MARA VELEZ', ROOFTOP.contact.x, ROOFTOP.contact.y, '#a782aa', ROOFTOP.height + 3),
        actor('RAFE SERRANO', LOC.hangar.x + 25, LOC.hangar.y - 26, '#93a38d'),
      );
      for (const gang of GANGS)
        for (let i = 0; i < 5; i++) {
          const p =
            gang.id === 'harbor'
              ? findStreetPoint(3120 + (i % 2) * 40, 1390 + i * 48)
              : findStreetPoint(gang.x + (i - 2) * 26, gang.y + (i % 2 ? 72 : -72));
          gangMembers.push({
            ...p,
            a: 0,
            hp: 80,
            color: gang.color,
            faction: gang.id,
            home: {
              ...p,
            },
            name: gang.name,
            timer: 1 + i * 0.2,
            walk: 0,
          });
        }
      // Rival patrols face one another at the Palm Keys end of the Palm Sound causeway.
      for (const [id, x, color] of [
        ['harbor', -1330, '#b66951'],
        ['glass', -1530, '#b19bcc'],
      ])
        for (let i = 0; i < 2; i++) {
          const p = findStreetPoint(x, 3200 + (i ? 32 : -32));
          gangMembers.push({
            ...p,
            a: 0,
            hp: 80,
            color,
            faction: id,
            home: {
              ...p,
            },
            name: id === 'harbor' ? 'HARBOR KINGS' : 'GLASSHOUSE CREW',
            timer: 1 + i,
            walk: 0,
          });
        }
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const c = vehicles[i];
        if (
          !isBoat(c) &&
          !isAircraft(c) &&
          (corners(vehicleShape(c, 1)).some((p) => !groundAt(p.x, p.y)) ||
            buildings.some((b) =>
              boxContact(vehicleShape(c), {
                x: b.x + b.w / 2,
                y: b.y + b.h / 2,
                hx: b.w / 2,
                hy: b.h / 2,
                a: 0,
              }),
            ))
        )
          vehicles.splice(i, 1);
      }
      for (const p of pickups) {
        if (solid(p.x, p.y, 8)) Object.assign(p, findStreetPoint(p.x, p.y, 10));
      }
      spawnClearCar('sedan', 1180, 5005, Math.PI / 2, false, '#afb8aa');
      spawnClearCar('van', 1120, 5130, 0, false, '#b8bbae');
    }
    function showDialogue(contact, title, message, action, canClose = true, button = 'ACCEPT JOB') {
      const c = CHARACTERS[contact];
      dialogueAction = action;
      dialogueCanClose = canClose;
      gameMode = 'dialogue';
      keys = {};
      mouse.down = false;
      getElement('callName').textContent = c.name;
      getElement('callRole').textContent = c.role;
      setContactPortrait(getElement('callPortrait'), contact);
      getElement('callReward').textContent = dialogueCanClose
        ? '$' + missions[missionIndex].reward.toLocaleString()
        : '';
      getElement('callTitle').textContent = title;
      getElement('callMessage').textContent = message;
      getElement('callAccept').textContent = button + ' · ENTER';
      getElement('callDecline').style.display = canClose ? 'block' : 'none';
      getElement('callOverlay').classList.remove('hidden');
      getElement('callAccept').focus();
    }
    function acceptDialogue() {
      if (gameMode !== 'dialogue') return;
      const action = dialogueAction;
      dialogueAction = null;
      getElement('callOverlay').classList.add('hidden');
      gameMode = 'play';
      keys = {};
      canvas.focus();
      if (action) action();
      updateUI();
    }
    function closeDialogue() {
      if (!dialogueCanClose) {
        acceptDialogue();
        return;
      }
      dialogueAction = null;
      getElement('callOverlay').classList.add('hidden');
      gameMode = 'play';
      keys = {};
      canvas.focus();
    }
    function offerMission() {
      if (missionIndex >= missions.length) {
        tell('Every job is done. Explore the islands, rooftop and gang territories, or replay from pause.', 5);
        return;
      }
      const info = missions[missionIndex];
      showDialogue(
        info.contact,
        jobLabel(missionIndex) + ' · ' + info.title,
        info.phoneMessage,
        () => startMission(),
      );
    }
    function setContactPortrait(el, id) {
      const tile =
        {
          vinny: '0% 0%',
          elena: '100% 0%',
          mara: '0% 100%',
          rafe: '100% 100%',
        }[id] || '0% 0%';
      el.style.backgroundPosition = tile;
      el.title = CHARACTERS[id]?.name || 'Vinny Moretti';
    }
    const STORY_PROPER_NOUNS =
      /\b(vinny|elena|mara|rafe|daniel|vescari|vale|rusk|palm keys|blue hour|coral palms|southport|oceanview|northridge|glasshouse|bay launch|eastside customs|sunset motel|hangar three)\b/g;
    function missionSummary(m) {
      if (m.index >= SIDE_JOB_FIRST)
        return (
          CHARACTERS[missions[m.index].contact].name.split(' ')[0] +
          ' gave you a contract: ' +
          missions[m.index].brief
        );
      const name = CHARACTERS[missions[m.index].contact].name.split(' ')[0],
        task = (m.instruction || missions[m.index].brief)
          .toLowerCase()
          // Every name the stage instructions use, capitalised wherever it appears
          // ("fly to northridge", "daniel's guards" read as typos on the card).
          .replace(STORY_PROPER_NOUNS, (word) => word.replace(/(^|\s)\S/g, (c) => c.toUpperCase()));
      return name + ' gave you a mission: ' + task + '.';
    }
    function missionLine(speaker, text) {
      if (!mission) return;
      mission.lastLine = (CHARACTERS[speaker]?.name.split(' ')[0] || speaker || 'RADIO') + ': ' + text;
      mission.lineUntil = gameTime + 10;
      setContactPortrait(getElement('missionPortrait'), missions[mission.index].contact);
      getElement('storyLine').textContent = mission.lastLine;
      getElement('storyLine').classList.add('show');
    }
    function setStage(stage, target, instruction, speaker, text) {
      mission.stage = stage;
      mission.target = target;
      mission.instruction = instruction;
      mission.actionProgress = 0;
      if (text) missionLine(speaker, text);
      updateUI();
    }
    function spawnGuards(faction, count, center, tag) {
      for (let i = 0; i < count; i++) {
        const p = findStreetPoint(center.x + ((i % 3) - 1) * 66, center.y + (i < 3 ? -95 : 95));
        enemies.push({
          ...p,
          a: 0,
          hp: 85,
          timer: 1.5 + i * 0.2,
          color: faction === 'harbor' ? '#b66951' : '#b19bcc',
          faction,
          name: faction === 'harbor' ? 'HARBOR KINGS' : 'GLASSHOUSE CREW',
          missionTag: tag,
          walk: 0,
        });
      }
    }
    function startMission() {
      if (missionIndex >= missions.length) return;
      incomingCallRemaining = 0;
      resetMissionState();
      const missionState = (mission = {
          index: missionIndex,
          stage: 0,
          timer: 0,
          timeLimit: 0,
          target: null,
          car: null,
          packages: [],
          route: [],
          collected: 0,
          instruction: '',
          lastLine: '',
        }),
        info = missions[missionState.index];
      if (missionState.index === 0) startHarborJob(missionState);
      else if (missionState.index === 1) startRooftopHit(missionState);
      else if (missionState.index <= 8) startChallengeMission(missionState);
      else if (missionState.index < SIDE_JOB_FIRST) flightMissionStart(missionState);
      else startSideJob(missionState);
      announce(
        missionState.index >= SIDE_JOB_FIRST
          ? 'CONTRACT ' + (missionState.index + 1 - SIDE_JOB_FIRST) + ' / ' + (missions.length - SIDE_JOB_FIRST)
          : 'MISSION ' + (missionState.index + 1) + ' / ' + SIDE_JOB_FIRST,
        info.title.toUpperCase(),
        3,
      );
      missionLine(info.contact, info.brief);
      save();
    }
    // How the last mission ended (read by the developer console's missionState()).
    let lastMissionOutcome = null;
    function failMission(reason) {
      if (!mission) return;
      lastMissionOutcome = { result: 'failed', index: mission.index, stage: mission.stage, reason };
      const freight = mission.index === 0 && mission.policeNotified;
      cleanupMissionExtras();
      if (freight) clearPolice();
      radio('mission-failed');
      mission = null;
      enemies.length = 0;
      storyActors
        .filter((p) => p.name === 'ELENA CRUZ')
        .forEach((p) => storyActors.splice(storyActors.indexOf(p), 1));
      vehicles
        .filter((c) => c.mission)
        .forEach((c) => {
          c.mission = false;
          c.failedMission = true;
        });
      announce('THE SOUTH COAST LEDGER', 'JOB FAILED', 3);
      tell(reason + ' Return to the payphone or retry from pause.', 6);
      getElement('storyLine').classList.remove('show');
    }
    function retryMission() {
      if (!mission && missionIndex >= missions.length) return;
      if (transitRide) leaveTransit(transitRide.from, true);
      player.roof = false;
      player.buildingRoof = null;
      player.altitude = 0;
      player.car = null;
      player.x = spawn.x;
      player.y = spawn.y;
      gameMode = 'play';
      startMission();
      getElement('pauseMenu').classList.add('hidden');
      keys = {};
    }
    function winMission() {
      if (!mission) return;
      lastMissionOutcome = { result: 'won', index: mission.index, stage: mission.stage };
      cleanupMissionExtras();
      radio('mission-complete');
      const previousCompleted = completed,
        missionState = mission,
        reward = missions[missionState.index].reward;
      cash += reward;
      finishCampaignMission(missionState);
      mission = null;
      if (completed > previousCompleted) newCallNotice();
      enemies.length = 0;
      storyActors
        .filter((p) => p.name === 'ELENA CRUZ')
        .forEach((p) => storyActors.splice(storyActors.indexOf(p), 1));
      vehicles.filter((c) => c.mission).forEach((c) => (c.mission = false));
      const finale = missionState.index === SIDE_JOB_FIRST - 1,
        lastContract = missionState.index === missions.length - 1;
      announce(
        'PAYDAY +$' + reward.toLocaleString(),
        finale
          ? 'THE LEDGER DELIVERED'
          : lastContract
            ? 'EVERY CONTRACT CLOSED'
            : missionState.index >= SIDE_JOB_FIRST
              ? 'CONTRACT ' + (missionState.index + 1 - SIDE_JOB_FIRST) + ' COMPLETE'
              : 'MISSION ' + (missionState.index + 1) + ' COMPLETE',
        4,
      );
      tell(
        finale
          ? 'The ledger is delivered. Your crew is safe. The payphone still rings: contracts are open.'
          : lastContract
            ? 'Every contract is closed. The South Coast is yours.'
            : missionIndex >= missions.length
              ? 'Replay complete. Choose another mission from pause, or explore the city.'
              : 'The payphone is ringing. The next job is waiting.',
        7,
      );
      getElement('storyLine').classList.remove('show');
      save();
      updateUI();
    }
    function objective() {
      return mission ? mission.target : missionIndex < missions.length ? phone : null;
    }
    function passengerCar(vehicle) {
      return (
        vehicle &&
        vehicle.hp > 0 &&
        !vehicleSpec(vehicle).bike &&
        !isBoat(vehicle) &&
        !isAircraft(vehicle)
      );
    }
    function boardElena(m) {
      m.passengerCar = player.car;
      m.car = player.car;
      m.car.mission = true;
      for (const p of storyActors) if (p.name === 'ELENA CRUZ') p.hidden = true;
    }
    function missionUpdate(deltaSeconds) {
      const m = mission;
      if (!m) return;
      if (m.car && m.car.hp <= 0) {
        failMission(
          m.passengerCar ? 'Elena’s car was destroyed.' : 'The marked vehicle was destroyed.',
        );
        return;
      }
      if (m.timeLimit) {
        m.timer -= deltaSeconds;
        if (m.timer <= 0) {
          failMission('You ran out of time.');
          return;
        }
      }
      if (m.index >= SIDE_JOB_FIRST) {
        sideJobUpdate(m, deltaSeconds);
        return;
      }
      if (m.index >= 9) {
        flightMissionUpdate(m, deltaSeconds);
        return;
      }
      if (m.index >= 2) {
        updateChallengeMission(m, deltaSeconds);
        return;
      }
      if (m.index === 0) updateHarborMission(m, deltaSeconds);
      if (m.index === 1) updateRooftopHit(m, deltaSeconds);
    }
    function updateGangFights(deltaSeconds) {
      const all = [...enemies, ...gangMembers].filter(
        (e) => !e.military && e.missionTag !== 'rooftop-hit',
      );
      for (const e of all) {
        if (e.hp <= 0 || personIncapacitated(e)) continue;
        e.timer -= deltaSeconds;
        let target = null,
          best = 340;
        for (const rival of all)
          if (rival !== e && rival.hp > 0 && rival.faction !== e.faction) {
            const d = distanceBetween(e, rival);
            if (d < best && clearSight(e, rival)) {
              target = rival;
              best = d;
            }
          }
        if ((e.policeAggroUntil || 0) > gameTime || (e.policeThreatUntil || 0) > gameTime) {
          for (const cop of [
            ...officers,
            ...vehicles.filter((c) => lawVehicle(c) && !c.crewDeployed && c.gangTarget),
          ]) {
            if (cop.hp <= 0 || cop.returned) continue;
            const d = distanceBetween(e, cop);
            if (d < 335 && d < best * 1.3 && clearSight(e, cop)) {
              target = cop;
              best = d;
            }
          }
        }
        const d = distanceBetween(e, player),
          provoked =
            (e.playerThreatUntil || 0) > gameTime ||
            ((e.missionAggressive || e.missionTag === 'books' || e.missionTag === 'airport') &&
              d < 300);
        if (
          !playerOnRoof() &&
          sameFloor(e, player) &&
          provoked &&
          d < 360 &&
          d < best &&
          clearSight(e, player)
        ) {
          target = player;
          best = d;
        }
        if (!target) {
          e.aiming = false;
          continue;
        }
        e.aiming = true;
        e.a = headingBetween(e, target);
        e.walk += deltaSeconds * 8;
        if (best > 165) footStepTowards(e, target, deltaSeconds, 48);
        if (e.timer <= 0 && best < 335 && clearSight(e, target)) {
          e.timer = 0.8 + seededRandom() * 0.85;
          e.lastShotAt = gameTime;
          if (target.police || target.type === 'police') e.policeThreatUntil = gameTime + 15;
          const a = e.a + randomBetween(-0.12, 0.12);
          bullets.push({
            x: e.x + Math.cos(a) * 14,
            y: e.y + Math.sin(a) * 14,
            altitude: entityElevation(e),
            vx: Math.cos(a) * 460,
            vy: Math.sin(a) * 460,
            life: 0.75,
            dmg: 14,
            enemy: true,
            faction: e.faction,
            owner: e,
            target,
          });
          notifyViolence(e, 'gunfire', e);
          playSample('automatic', 0.25, 1, e);
          if (city3D) city3D.fire(e.x, e.y, a, false, entityElevation(e));
        }
      }
    }
    function moveOnRoof(dx, dy, r) {
      let blocked = false;
      if (roofPointFree(player.x + dx, player.y, r)) player.x += dx;
      else blocked = true;
      if (roofPointFree(player.x, player.y + dy, r)) player.y += dy;
      else blocked = true;
      return blocked;
    }
    function travelRoof(up) {
      if (up && rooftopJob() && !rooftopJob().disguise) {
        tell('The private party requires guest attire. Collect your clothes first.');
        return;
      }
      if (player.car) {
        tell('Park your vehicle and enter the elevator on foot.');
        return;
      }
      if (up && wantedStars > 0) {
        needToLosePolice();
        return;
      }
      const hit = rooftopJob();
      if (!up && hit?.liftRecalled > gameTime) {
        // Security holds the car at the lobby the moment the party breaks.
        tell(
          'The car has been recalled to the lobby · ' +
            Math.ceil(hit.liftRecalled - gameTime) +
            's — stay alive',
          2.5,
        );
        tone(180, 0.18, 0.2, 'square', 120);
        return;
      }
      liftTravel = {
        up,
        time: 0,
        duration: 1.7,
      };
      gameMode = 'elevator';
      keys = {};
      mouse.down = false;
      getElement('elevatorOverlay').classList.remove('hidden');
      getElement('elevatorDirection').textContent = up
        ? 'ASCENDING TO THE BLUE HOUR'
        : 'RETURNING TO STREET LEVEL';
    }
    function updateElevator(deltaSeconds) {
      if (!liftTravel) return;
      liftTravel.time += deltaSeconds;
      const t = clamp(liftTravel.time / liftTravel.duration, 0, 1);
      getElement('elevatorFloor').textContent =
        'FLOOR ' +
        String(
          Math.round((liftTravel.up ? t : 1 - t) * Math.round(worldMeters(ROOFTOP.height) / 3)),
        ).padStart(2, '0');
      getElement('elevatorProgress').style.width = t * 100 + '%';
      if (t === 1) {
        const up = liftTravel.up;
        liftTravel = null;
        player.roof = up;
        player.altitude = up ? ROOFTOP.height + 3 : 0;
        Object.assign(
          player,
          up
            ? {
                x: ROOFTOP.lift.x + 35,
                y: ROOFTOP.lift.y - 3,
              }
            : ROOFTOP.door,
        );
        cameraTarget.x = player.x;
        cameraTarget.y = player.y;
        gameMode = 'play';
        getElement('elevatorOverlay').classList.add('hidden');
        canvas.focus();
        tell(
          up
            ? rooftopJob()
              ? 'PRIVATE PARTY · Walk calmly. Hold E near Vescari for a takedown, or P at his reserved glass. F draws your pistol.'
              : 'THE BLUE HOUR · E at the bar or elevator · Weapons stay holstered on the terrace.'
            : 'Back at street level.',
          5,
        );
        missionUpdate(0);
        updateUI();
      }
    }
    function interactRooftop() {
      if (player.car) return false;
      if (player.roof) {
        if (distanceBetween(player, ROOFTOP.lift) < 48) {
          travelRoof(false);
          return true;
        }
        if (distanceBetween(player, ROOFTOP.bar) < 43) {
          openService({
            kind: 'bar',
            name: 'THE BLUE HOUR · ROOFTOP BAR',
          });
          return true;
        }
        tell(
          rooftopJob()
            ? 'Blend in. Hold E near Vescari for a takedown, or P beside his reserved drink; E at the elevator to leave.'
            : 'E at the bar, Mara, or the elevator. Weapons stay holstered here.',
          3,
        );
        return true;
      }
      if (distanceBetween(player, ROOFTOP.door) < 52) {
        travelRoof(true);
        return true;
      }
      return false;
    }
    function updateStoryWorld(deltaSeconds) {
      const d = districtAt(player.x, player.y);
      if (d !== lastDistrict) {
        // The location block (top left) plays its reveal; restarting the CSS
        // animation needs the class off for one layout.
        const location = getElement('hudLocation');
        lastDistrict = d;
        districtNoticeUntil = gameTime + 2.8;
        location.classList.remove('entering');
        void location.offsetWidth;
        location.classList.add('entering');
      }
      if (districtNoticeUntil && gameTime > districtNoticeUntil) {
        districtNoticeUntil = 0;
        getElement('hudLocation').classList.remove('entering');
      }
    }
    function storyUI() {
      const contact = missions[mission?.index ?? missionIndex]?.contact || 'vinny';
      setContactPortrait(getElement('missionPortrait'), contact);
      if (!mission || gameTime > (mission.lineUntil || 0))
        getElement('storyLine').classList.remove('show');
      if (player.roof) {
        getElement('interaction').style.display = 'block';
        getElement('interaction').textContent =
          distanceBetween(player, ROOFTOP.lift) < 48
            ? 'E · ELEVATOR TO STREET'
            : distanceBetween(player, ROOFTOP.bar) < 43
              ? 'E · ROOFTOP BAR'
              : mission?.index === 6 &&
                  [1, 4].includes(mission.stage) &&
                  distanceBetween(player, ROOFTOP.contact) < 42
                ? 'E · TALK TO MARA'
                : 'THE BLUE HOUR · ROOFTOP TERRACE';
      }
      if (mission?.lastLine) getElement('storyLine').textContent = mission.lastLine;
    }
    function drawRooftop2D() {
      worldContext.save();
      worldContext.fillStyle = '#ab967e';
      worldContext.fillRect(ROOFTOP.x + 5, ROOFTOP.y + 5, ROOFTOP.w - 10, ROOFTOP.h - 10);
      worldContext.strokeStyle = '#c7dadd';
      worldContext.lineWidth = 3;
      worldContext.strokeRect(ROOFTOP.x + 9, ROOFTOP.y + 9, ROOFTOP.w - 18, ROOFTOP.h - 18);
      for (let y = 12; y < ROOFTOP.h - 10; y += 12) {
        worldContext.strokeStyle = '#8c796252';
        worldContext.lineWidth = 0.6;
        worldContext.beginPath();
        worldContext.moveTo(ROOFTOP.x + 12, ROOFTOP.y + y);
        worldContext.lineTo(ROOFTOP.x + ROOFTOP.w - 12, ROOFTOP.y + y);
        worldContext.stroke();
      }
      worldContext.fillStyle = '#385b68';
      worldContext.fillRect(ROOFTOP.x + 245, ROOFTOP.y + 70, 93, 113);
      for (let x = 0; x < 6; x++)
        for (let y = 0; y < 5; y++) {
          worldContext.fillStyle = (x + y) % 2 ? '#70889b' : '#9b7890';
          worldContext.fillRect(ROOFTOP.x + 152 + x * 14, ROOFTOP.y + 210 + y * 15, 13, 14);
        }
      for (const b of roofCover) {
        worldContext.fillStyle = {
          pool: '#e1d9bf',
          bar: '#284955',
          lift: '#687f8a',
          table: '#e2c99f',
          hedge: '#5d7857',
          sofa: '#d3c8b2',
          buffet: '#d8c9b3',
          dj: '#283c4b',
        }[b.kind];
        worldContext.fillRect(b.x, b.y, b.w, b.h);
        worldContext.strokeStyle = '#344e5360';
        worldContext.lineWidth = 1;
        worldContext.strokeRect(b.x, b.y, b.w, b.h);
        if (b.kind === 'pool') {
          worldContext.fillStyle = '#55afbd';
          worldContext.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
          worldContext.strokeStyle = '#b4e1da85';
          for (let k = 0; k < 4; k++) {
            worldContext.beginPath();
            worldContext.moveTo(b.x + 10, b.y + 11 + k * 12);
            worldContext.quadraticCurveTo(
              b.x + 50,
              b.y + 7 + k * 12 + Math.sin(gameTime + k) * 3,
              b.x + b.w - 10,
              b.y + 11 + k * 12,
            );
            worldContext.stroke();
          }
        }
        if (b.kind === 'bar')
          for (let i = 0; i < 12; i++) {
            worldContext.fillStyle = i % 2 ? '#cdb878' : '#87b4a5';
            worldContext.fillRect(b.x + 5 + i * 9, b.y + 4, 3, 5);
          }
      }
      worldContext.font = 'bold 9px Arial';
      worldContext.fillStyle = '#f5ead3';
      worldContext.textAlign = 'center';
      for (const [name, x, y] of [
        ['ELEVATOR', 39, 294],
        ['COCKTAIL LOUNGE', 87, 135],
        ['POOL TERRACE', 90, 29],
        ['PRIVATE LOUNGE', 290, 80],
        ['THE BLUE HOUR', 195, 290],
        ['COCKTAILS', 252, 42],
      ])
        worldContext.fillText(name, ROOFTOP.x + x, ROOFTOP.y + y);
      worldContext.restore();
    }
    function drawStoryMarkers2D() {
      if (mission?.index === 7 && mission.stage === 1) {
        worldContext.fillStyle = '#edc36c';
        worldContext.fillRect(LOC.waterCase.x - 6, LOC.waterCase.y - 6, 12, 12);
      }
      for (const p of storyActors)
        if (!p.guest && !p.hidden && visible(p) && rooftopFloor(p) === !!player.roof) {
          worldContext.font = 'bold 10px monospace';
          worldContext.textAlign = 'center';
          worldContext.fillStyle = '#e8dbb6';
          worldContext.fillText(p.name, p.x, p.y - 19);
        }
    }
    getElement('callAccept').onclick = acceptDialogue;
    getElement('callDecline').onclick = closeDialogue;
    // END SUBSYSTEM: src/story.js
