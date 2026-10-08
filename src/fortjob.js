    // BEGIN SUBSYSTEM: src/fortjob.js — Mission 4, Borrowed Stripes: an off-duty soldier's uniform, Fort Sentinel and the consul at CIRRUS
    /**
     * Mission 4: Borrowed Stripes (Vinny)
     * Source: src/fortjob.js
     * Scope: shared game closure.
     * Vinny hands over a lockpick (vehicle-trunk.js) and a name: PFC Dale Kessler,
     * off duty, driving out of Fort Sentinel to the Marea Beach Club in his red
     * muscle car. The player watches the gate from the end of the Sentinel
     * causeway and tails him across the city (too close for too long and he makes
     * the tail; too far and he is gone). Then either the quiet way (wait until he
     * is inside the club and pick his trunk) or the messy way (take the car or kill
     * him for the keys, with all the witnesses that brings). The trunk holds his
     * uniform and his ID; changed into them somewhere nobody watches, the player
     * walks up to the fort's gate and shows the papers (fort-cover.js does the
     * gate, the soldiers' suspicion, the military-vehicle alarm and the records
     * office), walks out calmly with the weapons papers and meets the consul at
     * EVOLUTION's door for the lift to CIRRUS, a drink and the handover
     * (skyline-meeting.js). The driving and the walk into the club are here.
     */
    const FORT_JOB = {
      // The coast road where the Sentinel causeway reaches the mainland: every car
      // leaving the fort passes it (the route turns north at x 7796).
      stakeout: { x: 7740, y: 8060 },
      // Kessler's car in the fort's lot by the gate, nose to the outbound lane.
      depart: { x: 9440, y: 8098, a: Math.PI },
      // Out through the gate's outbound lane (SENTINEL.gate lanes, military-base.js).
      gateOut: [
        { x: 9330, y: 8098 },
        { x: 9100, y: 8112 },
      ],
      // Marina Rd's north kerb opposite the Marea's door (he arrives westbound).
      park: { x: -2822, y: 5220, a: Math.PI },
      // Across the road to the door, then in (MAREA_NODES street, out, in: beachclub-plan.js).
      walkIn: [
        { x: -2800, y: 5236 },
        { x: -2776, y: 5300 },
        { x: -2768, y: 5322 },
        { x: -2768, y: 5342 },
        { x: -2768, y: 5368 },
      ],
      car: 'muscle',
      carColor: '#7a1c1a',
      // Tailing: noticed when this close behind him for a while, lost past `lost`.
      close: 150,
      tooClose: 70,
      lost: 1500,
      lostSeconds: 12,
    };
    const FORT_STAGE = {
      stakeout: 0,
      tail: 1,
      parked: 2,
      trunk: 3,
      take: 4,
      change: 5,
      gate: 6,
      inside: 7,
      out: 8,
      meet: 9,
    };
    function fortJob() {
      return mission?.index === 3 ? mission : null;
    }
    function startFortJob(m) {
      m.kcar = null;
      m.kessler = null;
      m.tailHeat = 0;
      m.lostFor = 0;
      m.stuckFor = 0;
      m.beats = {};
      m.keys = false;
      m.uniform = false;
      m.changeProgress = 0;
      m.parkedAt = 0;
      if (!lockpickOwned()) giveLockpick();
      setStage(FORT_STAGE.stakeout, FORT_JOB.stakeout, 'WATCH FORT SENTINEL’S GATE FROM THE CAUSEWAY’S END');
      tell(
        'Vinny’s lockpick is in your arsenal (' +
          keyName('lockpick') +
          '). Kessler drives a red muscle car. Tail him, don’t crowd him, and don’t make a scene unless you have to.',
        8,
      );
    }
    function fortBeat(m, id, text, speaker = 'vinny') {
      if (m.beats[id]) return;
      m.beats[id] = true;
      missionLine(speaker, text);
    }
    /* Kessler's road route from the fort's gate to the Marea's kerb: the city's
       navigation graph (navigation.js), held to the right-hand lane as the cabs
       drive it (taxi.js), the gate's outbound lane first and the kerb last. */
    function fortRoute() {
      const nodes = navigationGraph(),
        from = FORT_JOB.gateOut[1],
        path = navShortestPath(nodes, closestNavNode(from, nodes), closestNavNode(FORT_JOB.park, nodes)),
        route = FORT_JOB.gateOut.map((p) => ({ x: p.x, y: p.y }));
      for (let i = 0; i < path.length; i++) {
        const prev = i ? path[i - 1] : from,
          along = headingBetween(prev, path[i]),
          lane = 24;
        route.push({ x: path[i].x - Math.sin(along) * lane, y: path[i].y + Math.cos(along) * lane });
      }
      route.push({ x: FORT_JOB.park.x + 60, y: FORT_JOB.park.y }, { x: FORT_JOB.park.x, y: FORT_JOB.park.y });
      return route;
    }
    function fortDepart(m) {
      const d = FORT_JOB.depart,
        c = makeCar(FORT_JOB.car, d.x, d.y, d.a, true, FORT_JOB.carColor);
      assignDriver(c);
      c.locked = true;
      c.driverFemale = false;
      c.driverRole = 'casual';
      c.driverColor = '#c9b48a';
      c.passengers = 0;
      c.mission = true;
      c.missionDriver = 'kessler';
      c.trunkLoot = { label: 'UNIFORM AND ID' };
      c.countyRoute = fortRoute();
      c.countyIndex = 0;
      m.kcar = c;
      m.departedAt = gameTime;
      setStage(
        FORT_STAGE.tail,
        c,
        'TAIL KESSLER’S RED MUSCLE CAR · KEEP YOUR DISTANCE',
        'vinny',
        'That’s him, the red one coming through the gate. Hang back. If he sees you in his mirror twice, he’ll know.',
      );
    }
    /* Kessler on foot (out at the club, carjacked, or thrown out of a crash): a
       pedestrian made by makeCarDriver carrying the car's `missionDriver`. */
    function fortKessler(m) {
      if (m.kessler && pedestrians.includes(m.kessler)) return m.kessler;
      m.kessler = null;
      for (let i = 0; i < pedestrians.length; i++)
        if (pedestrians[i].missionDriver === 'kessler') return (m.kessler = pedestrians[i]);
      return null;
    }
    /* The scripted walk of a mission's pedestrian (Kessler across Marina Rd to the
       Marea's door): his own routine until something frightens him (game-people.js
       steps aside for a reaction first; this one does too). */
    function updateMissionWalker(p, deltaSeconds) {
      const w = p.missionWalk;
      if (!w || w.done || p.flee > 0 || p.react || p.knockedFor || p.ejected || p.dazedFor > 0) return false;
      const target = w.route[w.i];
      if (!target) {
        w.done = true;
        p.walking = false;
        return true;
      }
      const speed = cityTempo().speed * 0.9,
        a = headingBetween(p, target),
        step = Math.min(distanceBetween(p, target), speed * deltaSeconds);
      p.a = a;
      p.walking = true;
      p.x += Math.cos(a) * step;
      p.y += Math.sin(a) * step;
      p.walk += deltaSeconds * strideRate(speed);
      if (distanceBetween(p, target) < 4) w.i++;
      return true;
    }
    /* Whether Kessler, on foot, can see the player at his car (a forward look, ~100 m). */
    function fortKesslerSees(p) {
      if (!p || p.hp <= 0 || personIncapacitated(p)) return false;
      const d = distanceBetween(p, player);
      if (d > 320) return false;
      const off = Math.abs(normalizeAngle(headingBetween(p, player) - p.a));
      return (off < 1.2 || d < 60) && clearSight(p, player);
    }
    function fortParkCar(m) {
      const c = m.kcar;
      c.ai = false;
      c.countyRoute = null;
      c.vx = c.vy = c.speed = c.av = 0;
      c.occupied = false;
      m.parkedAt = gameTime;
      const door = driverDoor(c),
        p = makeCarDriver(c, door.x, door.y, door.a);
      p.missionDriver = 'kessler';
      p.missionWalk = { route: FORT_JOB.walkIn.map((q) => ({ x: q.x, y: q.y })), i: 0, done: false };
      m.kessler = p;
      setStage(
        FORT_STAGE.parked,
        trunkPoint(c, { x: 0, y: 0 }),
        'LET KESSLER GO INSIDE · THEN PICK HIS TRUNK',
        'vinny',
        'He’s parked. Let him get past the door before you touch that car. The bouncers have eyes too.',
      );
    }
    function updateFortTail(m, deltaSeconds) {
      const c = m.kcar;
      if (!c.occupied) return;
      const route = c.countyRoute;
      // Arrived: the kerb opposite the club.
      if (route && c.countyIndex === route.length - 1 && distanceBetween(c, route[route.length - 1]) < 60) {
        fortParkCar(m);
        return;
      }
      // countyRouteControl wraps to the start after the last point: never let it.
      if (route && c.countyIndex === 0 && gameTime - m.departedAt > 20) c.countyIndex = route.length - 1;
      // Wedged in traffic: a horn, then out of sight he finds his way round.
      if (Math.abs(c.speed || 0) < 6 && c.ai) {
        m.stuckFor += deltaSeconds;
        if (m.stuckFor > 4 && m.stuckFor - deltaSeconds <= 4) carHorn(c, 0.6, true);
        if (m.stuckFor > 9 && route) {
          const next = route[Math.min(route.length - 1, c.countyIndex + 1)];
          if (spotUnseen(next.x, next.y, 60, SPOT_CAR) && spotUnseen(c.x, c.y, 60, SPOT_CAR) && canSpawnCar(c.type, next.x, next.y, headingBetween(c, next))) {
            c.a = headingBetween(c, next);
            c.x = next.x;
            c.y = next.y;
            c.vx = c.vy = 0;
            c.countyIndex = Math.min(route.length - 1, c.countyIndex + 1);
          }
          m.stuckFor = 0;
        }
      } else m.stuckFor = 0;
      if (m.stage !== FORT_STAGE.tail) return;
      // The tail: close behind him (in his mirrors) builds his suspicion; out of
      // range for long and he is gone.
      const d = distanceBetween(player, c),
        behind = Math.cos(normalizeAngle(headingBetween(c, player) - c.a)) < -0.3,
        driving = !!player.car;
      if (d < FORT_JOB.tooClose) m.tailHeat += deltaSeconds / 2.5;
      else if (d < FORT_JOB.close && behind && driving) m.tailHeat += deltaSeconds / 9;
      else m.tailHeat = Math.max(0, m.tailHeat - deltaSeconds / 18);
      if (m.tailHeat > 0.45) fortBeat(m, 'close', 'Too close. Drop back a few cars.');
      if (m.tailHeat >= 1) {
        failMission('Kessler made the tail and drove back to the fort. The uniform is no use now.');
        return;
      }
      if (d > FORT_JOB.lost) {
        m.lostFor += deltaSeconds;
        if (m.lostFor > FORT_JOB.lostSeconds * 0.5) fortBeat(m, 'losing', 'Where is he? Don’t lose him, I can’t get you another name.');
        if (m.lostFor > FORT_JOB.lostSeconds) {
          failMission('You lost Kessler.');
          return;
        }
      } else m.lostFor = 0;
      if (gameTime - m.departedAt > 25) fortBeat(m, 'radio', 'He goes to the Marea every leave. Same car, same kerb, same table. Let him.');
    }
    function fortTrunkOpenOffer(m) {
      const c = m.kcar;
      return !player.car && c && !c.trunkOpen && distanceBetween(player, trunkPoint(c, fortScratch)) < 30;
    }
    const fortScratch = { x: 0, y: 0 };
    function updateFortJob(m, deltaSeconds) {
      if (m.stage === FORT_STAGE.stakeout) {
        if (distanceBetween(player, FORT_JOB.stakeout) < 450 && wantedStars === 0) {
          m.watchFor = (m.watchFor || 0) + deltaSeconds;
          fortBeat(m, 'watch', 'Good spot. He signs out any minute. Red muscle car, Dale Kessler, private first class.');
          if (m.watchFor > 4) fortDepart(m);
        }
        return;
      }
      const c = m.kcar;
      if (!c) return;
      if (c.occupied) updateFortTail(m, deltaSeconds);
      if (!mission) return;
      const k = fortKessler(m);
      // The messy way: out of the car before the club (carjacked, crashed), or down.
      if (k && k.hp <= 0 && !m.killed) {
        m.killed = true;
        fortBeat(m, 'killed', 'Christ. Well, he won’t need the uniform. Get his keys and get that trunk open.');
      }
      if (!c.occupied && m.stage === FORT_STAGE.tail) {
        // Taken from him on the road: the keys are in it.
        if (player.car === c) m.keys = true;
        setStage(FORT_STAGE.trunk, trunkPoint(c, { x: 0, y: 0 }), m.keys ? 'OPEN KESSLER’S TRUNK · ' + keyName('interact') : 'GET INTO KESSLER’S TRUNK');
        fortBeat(m, 'messy', 'That’s loud. Get the uniform out of that trunk and get gone before the police come.');
      }
      if (player.car === c && !m.keys) {
        m.keys = true;
        tell('The keys are in the ignition.', 2.5);
      }
      if (m.stage === FORT_STAGE.parked) {
        if (k && k.missionWalk?.done) {
          // Inside the club: out of the world until the job ends.
          pedestrians.splice(pedestrians.indexOf(k), 1);
          m.kessler = null;
          m.inside = true;
          setStage(FORT_STAGE.trunk, trunkPoint(c, { x: 0, y: 0 }), 'PICK KESSLER’S TRUNK · LOCKPICK (' + keyName('lockpick') + ')');
          fortBeat(m, 'inside', 'He’s in. The lockpick, the trunk, and walk away like it’s your car.');
        } else if (!k || k.hp <= 0) setStage(FORT_STAGE.trunk, trunkPoint(c, { x: 0, y: 0 }), 'GET INTO KESSLER’S TRUNK');
      }
      // Seen at his car while he can see it: he shouts, and someone calls it in.
      if ((m.stage === FORT_STAGE.parked || m.stage === FORT_STAGE.trunk) && k && !m.spotted && (c.trunkPick || 0) > 0 && fortKesslerSees(k)) {
        m.spotted = true;
        k.speech = 'HEY! THAT’S MY CAR!';
        k.speechUntil = gameTime + 2.5;
        k.missionWalk = null;
        witnessReport(k, 'theft', c.x, c.y);
      }
      if (m.stage === FORT_STAGE.trunk || m.stage === FORT_STAGE.parked) {
        if (c.trunkOpen) {
          setStage(FORT_STAGE.take, trunkPoint(c, { x: 0, y: 0 }), 'TAKE THE UNIFORM AND THE ID · ' + keyName('interact'));
          tell('A duffel bag: a pressed field uniform, boots, a patrol cap and a laminated ID. KESSLER, D. · PFC.', 4);
        } else if (m.keys || m.killed) {
          if (m.stage !== FORT_STAGE.trunk || m.instruction.indexOf('OPEN') !== 0) m.instruction = 'OPEN KESSLER’S TRUNK · ' + keyName('interact');
        }
        if (m.stage === FORT_STAGE.trunk) trunkPoint(c, m.target);
        return;
      }
      if (m.stage === FORT_STAGE.change) {
        const hidden = fortChangeSpot();
        if (hidden && actionHeld('interact')) {
          m.changeProgress += deltaSeconds;
          if (m.changeProgress >= 3) fortChanged(m);
        } else m.changeProgress = Math.max(0, m.changeProgress - deltaSeconds * 0.5);
        return;
      }
      if (m.stage === FORT_STAGE.gate) {
        if (fortCover.cleared) {
          setStage(
            FORT_STAGE.inside,
            FORT_RECORDS.door,
            'WALK TO HEADQUARTERS · THE RECORDS OFFICE',
            'vinny',
            'You’re in. Walk like you’ve been there two years. Headquarters, the records office round the side.',
          );
        } else if (wantedStars > 0 && m.instruction.indexOf('LOSE') !== 0) m.instruction = 'LOSE THE POLICE · THEN THE GATE';
        else if (wantedStars === 0 && m.instruction.indexOf('LOSE') === 0) m.instruction = 'WALK UP TO FORT SENTINEL’S GATE · SHOW YOUR PAPERS';
        return;
      }
      if (m.stage === FORT_STAGE.inside) {
        if (fortCover.alarmed && !fortCover.papers) {
          failMission('Your cover is blown. The records office is locked down.');
          return;
        }
        if (fortCover.papers)
          setStage(
            FORT_STAGE.out,
            SENTINEL.gate.booth,
            'WALK OUT THROUGH THE MAIN GATE · CALMLY',
            'vinny',
            'Got them? Don’t run. Nobody runs out of a base with nothing to hide.',
          );
        return;
      }
      if (m.stage === FORT_STAGE.out) {
        const out = fortCover.leftWithPapers || (!inMilitary(player.x, player.y) && distanceBetween(player, SENTINEL.gate.booth) > 260);
        if (fortCover.alarmed && m.instruction.indexOf('COVER') !== 0) {
          m.instruction = 'COVER BLOWN · GET OUT WITH THE PAPERS';
          updateUI();
        }
        if (out) {
          skyMeetingBegin({ name: 'ANTON VARGA', title: 'the consul' });
          setStage(
            FORT_STAGE.meet,
            skyMeetingTarget(),
            'MEET CONSUL VARGA AT EVOLUTION’S DOOR · NORTH POINT KEY',
            'vinny',
            'Out? Beautiful. The consul is waiting at the door of the EVOLUTION tower. He’ll buy you a drink upstairs. Be polite.',
          );
        }
        return;
      }
      if (m.stage === FORT_STAGE.meet) {
        const s = skyMeeting.stage,
          text =
            wantedStars > 0
              ? 'LOSE THE POLICE · VARGA WON’T MEET WITH HEAT ON YOU'
              : s === 'waiting'
                ? 'MEET CONSUL VARGA AT EVOLUTION’S DOOR · NORTH POINT KEY'
                : s === 'greeted' || s === 'lift'
                  ? 'TAKE THE ELEVATOR TO CIRRUS WITH VARGA'
                  : s === 'terrace'
                    ? 'SIT WITH VARGA AT HIS TABLE'
                    : s === 'seated' || s === 'drinks'
                      ? 'HAVE A DRINK WITH VARGA'
                      : 'HAND OVER THE PAPERS';
        const target = skyMeetingTarget();
        if (text !== m.instruction || target !== m.target) {
          m.instruction = text;
          m.target = target;
          updateUI();
        }
        if (s === 'done') winMission();
      }
    }
    /* Somewhere to change: inside a car that is standing still, or out of everyone's sight. */
    function fortChangeSpot() {
      if (player.car) return Math.abs(player.car.speed || 0) < 4 && !isAircraft(player.car) && !vehicleSpec(player.car).bike;
      for (let i = 0; i < pedestrians.length; i++) {
        const p = pedestrians[i];
        if (p.hp > 0 && Math.abs(p.x - player.x) < 260 && Math.abs(p.y - player.y) < 260 && distanceBetween(p, player) < 260 && clearSight(p, player)) return false;
      }
      return !inMilitary(player.x, player.y);
    }
    function fortChanged(m) {
      m.changeProgress = 0;
      m.uniform = true;
      wearUniform(true);
      fortCoverBegin();
      drawWeapon();
      announce('BORROWED STRIPES', 'PFC D. KESSLER', 2.6);
      setStage(
        FORT_STAGE.gate,
        SENTINEL.gate.booth,
        wantedStars > 0 ? 'LOSE THE POLICE · THEN THE GATE' : 'WALK UP TO FORT SENTINEL’S GATE · SHOW YOUR PAPERS',
        'vinny',
        'Fits? Good. Leave the car outside and walk up to the gate. Holster everything. You’re a tired private back from leave.',
      );
    }
    function fortJobInteract() {
      const m = fortJob();
      if (!m) return false;
      const c = m.kcar;
      // The messy way: his keys from the body, or the keys in a car taken from him.
      const k = fortKessler(m);
      if (k && k.hp <= 0 && !m.keys && !player.car && distanceBetween(player, k) < 34) {
        m.keys = true;
        player.lootUntil = gameTime + LOOT_CROUCH;
        player.lootFacing = headingBetween(player, k);
        tell('KESSLER’S KEYS', 2);
        return true;
      }
      if (c && !c.trunkOpen && m.keys && fortTrunkOpenOffer(m) && (m.stage === FORT_STAGE.trunk || m.stage === FORT_STAGE.parked)) {
        c.trunkOpen = true;
        tone(180, 0.05, 0.12, 'square');
        return true;
      }
      if (m.stage === FORT_STAGE.take && c && !player.car && distanceBetween(player, trunkPoint(c, fortScratch)) < 34) {
        player.lootUntil = gameTime + LOOT_CROUCH;
        player.lootFacing = headingBetween(player, c);
        m.bag = true;
        c.trunkLoot = null;
        setStage(
          FORT_STAGE.change,
          null,
          'CHANGE INTO THE UNIFORM · HOLD ' + keyName('interact') + ' IN A CAR OR OUT OF SIGHT',
          'vinny',
          'Not on the street, genius. In a car, or somewhere nobody’s looking.',
        );
        return true;
      }
      if (m.stage === FORT_STAGE.change && fortChangeSpot()) return true;
      return false;
    }
    function fortJobUI() {
      const m = fortJob();
      if (!m) return;
      if (m.stage === FORT_STAGE.tail && m.kcar?.occupied) {
        const box = getElement('stealthStatus');
        box.style.display = 'block';
        getElement('stealthLabel').textContent = m.lostFor > 0 ? 'TAIL · YOU’RE LOSING HIM' : m.tailHeat > 0.45 ? 'TAIL · HE’S CHECKING HIS MIRRORS' : 'TAIL · KESSLER';
        getElement('stealthFill').style.width = Math.round(Math.min(1, m.tailHeat) * 100) + '%';
        getElement('stealthHint').textContent = m.lostFor > 0 ? 'CLOSE THE GAP' : 'STAY BACK · NOT RIGHT BEHIND HIM';
        box.classList.toggle('hot', m.tailHeat > 0.45 || m.lostFor > 0);
        box.classList.toggle('seen', m.tailHeat > 0.45);
      }
      const k = fortKessler(m);
      if (k && k.hp <= 0 && !m.keys && !player.car && distanceBetween(player, k) < 34) offerPrompt('TAKE HIS KEYS', { id: 'fort-keys' });
      if (m.keys && fortTrunkOpenOffer(m)) offerPrompt('OPEN THE TRUNK', { id: 'fort-trunk' });
      if (m.stage === FORT_STAGE.take && m.kcar && !player.car && distanceBetween(player, trunkPoint(m.kcar, fortScratch)) < 34)
        offerPrompt('TAKE THE UNIFORM AND ID', { id: 'fort-take' });
      if (m.stage === FORT_STAGE.change) {
        if (fortChangeSpot())
          offerPrompt(m.changeProgress > 0 ? 'CHANGING · ' + Math.round((m.changeProgress / 3) * 100) + ' %' : 'CHANGE INTO THE UNIFORM', { hold: true, id: 'fort-change' });
        else offerPrompt('PEOPLE ARE WATCHING · CHANGE IN A CAR OR OUT OF SIGHT', { key: null, id: 'fort-change-seen' });
      }
    }
    function fortJobCleanup() {
      const m = fortJob();
      for (let i = pedestrians.length - 1; i >= 0; i--) if (pedestrians[i].missionDriver === 'kessler') pedestrians.splice(i, 1);
      if (m?.kcar) {
        m.kcar.missionDriver = undefined;
        m.kcar.trunkLoot = undefined;
      }
      if (player.uniform) wearUniform(false);
      fortCoverEnd();
      skyMeetingEnd();
    }
    function fortJobReport() {
      const m = fortJob();
      if (!m) return null;
      const pt = (p) => (p ? { x: Math.round(p.x), y: Math.round(p.y) } : null),
        k = fortKessler(m),
        c = m.kcar;
      return {
        stage: m.stage,
        instruction: m.instruction,
        target: pt(m.target),
        car: c
          ? { x: Math.round(c.x), y: Math.round(c.y), kmh: Math.round(Math.abs(c.speed || 0) / KMH), occupied: !!c.occupied, routeIndex: c.countyIndex, route: c.countyRoute?.length || 0, trunkOpen: !!c.trunkOpen, trunkPick: c.trunkPick || 0 }
          : null,
        kessler: k ? { x: Math.round(k.x), y: Math.round(k.y), hp: Math.round(k.hp), walking: !!k.missionWalk && !k.missionWalk.done } : null,
        inside: !!m.inside,
        tailHeat: Math.round(m.tailHeat * 100) / 100,
        lostFor: Math.round(m.lostFor * 10) / 10,
        keys: m.keys,
        killed: !!m.killed,
        spotted: !!m.spotted,
        uniform: !!player.uniform,
        changeProgress: Math.round(m.changeProgress * 10) / 10,
        lockpick: lockpickOwned(),
      };
    }
    // END SUBSYSTEM: src/fortjob.js
