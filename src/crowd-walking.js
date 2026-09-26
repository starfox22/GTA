    // Walking the grid: crossings, sidewalks, going indoors, rain, updateStreetWalker() and encounters.
    function nextCrossing(lines, v, sign) {
      let best;
      for (const r of lines) if ((r - v) * sign > 0 && (best === undefined || (r - best) * sign < 0)) best = r;
      return best;
    }
    function snapAxis(a) {
      return (Math.round(a / (Math.PI / 2)) * Math.PI) / 2;
    }
    function walkerSpeed(p) {
      let s = crowd.tempo.speed * (p.pace || 1);
      if (p.shakenUntil > gameTime) s *= 1.35;
      if (p.injured) s *= 0.45;
      if (weather.rain > 0.3 && !p.look?.umbrella && p.role !== 'jogger') s *= p.rainRun ? 2.9 : 1.25;
      return s;
    }
    /* Step a person along a heading at a speed; returns true when something stopped them. */
    function crowdStep(p, heading, speed, deltaSeconds, radius = 5) {
      p.a = heading;
      p.walking = speed > 0.5;
      p.walk += deltaSeconds * strideRate(speed);
      return moveBody(p, Math.cos(heading) * speed * deltaSeconds, Math.sin(heading) * speed * deltaSeconds, radius);
    }
    function faceToward(p, target, deltaSeconds, rate = 6) {
      const d = normalizeAngle(headingBetween(p, target) - p.a);
      p.a += clamp(d, -rate * deltaSeconds, rate * deltaSeconds);
    }
    function goIndoors(p, door, seconds, why) {
      const i = pedestrians.indexOf(p);
      if (i < 0) return;
      if (p.bench) p.bench.taken = null;
      p.bench = null;
      pedestrians.splice(i, 1);
      const party = [p];
      for (let k = pedestrians.length - 1; k >= 0; k--)
        if (pedestrians[k].leader === p) party.push(...pedestrians.splice(k, 1));
      crowd.indoors.push({ party, door, until: gameTime + seconds, why });
    }
    function updateIndoors() {
      for (let i = crowd.indoors.length - 1; i >= 0; i--) {
        const stay = crowd.indoors[i];
        if (gameTime < stay.until) continue;
        // Sheltering from a shower: wait until it has eased off.
        if (stay.why === 'rain' && weather.rain > 0.3) {
          stay.until = gameTime + 8;
          continue;
        }
        // Nobody comes out while shooting is still going on nearby.
        if (crowd.incidents.some((inc) => inc.loud && gameTime - inc.time < 12 && distanceBetween(inc, stay.door) < 380)) {
          stay.until = gameTime + 6;
          continue;
        }
        crowd.indoors.splice(i, 1);
        if (distanceBetween(stay.door, player) > 1700 || pedestrians.length >= CROWD_HARD_CAP) continue;
        for (const p of stay.party) {
          if (p.hp <= 0) continue;
          const leader = p.leader;
          resetWalkerState(p);
          p.leader = leader;
          p.x = stay.door.out.x + randomBetween(-3, 3);
          p.y = stay.door.out.y;
          p.a = p.dir = randomChoice([0, Math.PI]);
          if (stay.why === 'shelter') {
            p.shakenUntil = gameTime + 20;
            crowdSay(p, 'recover', 0.6);
          } else if (stay.why === 'shop' && !p.carry && p.role !== 'kid' && seededRandom() < 0.7)
            p.carry = randomChoice(['shopping', 'shopping', 'coffee']);
          pedestrians.push(p);
        }
      }
    }
    /**
     * RAIN ON THE STREET
     * Ahead of a shower (weather.approach) people look up and remark on it. When
     * it starts (once per shower, `weather.shower`), those with an umbrella open
     * it (crowd3d.js) and walk on; of the rest some duck into the nearest door
     * and wait it out, some run for it and the others hurry, heads down. When it
     * stops someone may say so. Lines go through crowdSay, so the chatter
     * setting and the two-bubble limit apply.
     */
    function rainReaction(p, deltaSeconds) {
      if (p.hp <= 0 || p.react || p.role === 'jogger' || p.military || p.police) return false;
      const near = distanceBetween(p, cameraTarget) < 480;
      if (weather.approach > 0.1 && weather.rain < 0.25 && near && seededRandom() < deltaSeconds * 0.01 * weather.approach) crowdSay(p, 'rainComing');
      if (weather.rain > 0.3 && p.rainShower !== weather.shower) {
        p.rainShower = weather.shower;
        p.rainRun = false;
        if (p.look?.umbrella) {
          if (near) crowdSay(p, 'rainUmbrella', 0.05);
          return false;
        }
        const roll = seededRandom();
        if (near) crowdSay(p, 'rainStart', 0.12);
        if (roll < 0.35 && (p.state === 'walk' || p.state === 'idle' || p.state === 'phone')) {
          const door = doorNear(p, 200);
          if (door && !/hospital|school|guns/.test(door.place?.kind || '')) {
            p.state = 'enter';
            p.enterDoor = door;
            p.atDoorFront = false;
            p.rainShelter = true;
            p.walking = true;
            return true;
          }
        }
        p.rainRun = roll < 0.75;
      }
      if (weather.rain < 0.12 && p.rainRun) {
        p.rainRun = false;
        if (near) crowdSay(p, 'rainStop', 0.08);
      }
      return false;
    }
    function updateStreetWalker(p, deltaSeconds) {
      const tempo = crowd.tempo;
      p.timer -= deltaSeconds;
      p.pose = null;
      if (!p.leader && rainReaction(p, deltaSeconds)) return;
      // Walking pairs: the follower keeps a shoulder offset from the leader.
      if (p.leader) {
        const leader = p.leader;
        if (leader.hp <= 0 || personIncapacitated(leader) || !pedestrians.includes(leader)) {
          p.leader = null;
          if (leader.hp <= 0) startReaction(p, 'gasp', 1.4, leader, null, { then: 'flee' });
          return;
        }
        const side = p.pairSide || 1,
          gap = p.role === 'kid' ? 7 : 9,
          tx = leader.x + Math.cos(leader.a + Math.PI / 2) * gap * side,
          ty = leader.y + Math.sin(leader.a + Math.PI / 2) * gap * side,
          d = Math.hypot(tx - p.x, ty - p.y);
        p.sitting = false;
        p.walking = d > 2;
        p.pose = ['chat', 'phone', 'idle', 'sit', 'wait'].includes(leader.pose) || !leader.walking ? 'idle' : null;
        if (d > 2) {
          const speed = Math.min((p.role === 'kid' ? 14 : 12) * KMH, 4.5 * KMH + d * 1.2);
          crowdStep(p, Math.atan2(ty - p.y, tx - p.x), speed, deltaSeconds);
        } else p.a += normalizeAngle(leader.a - p.a) * Math.min(1, deltaSeconds * 5);
        return;
      }
      if (p.state === 'idle' || p.state === 'shop' || p.state === 'phone') {
        p.stateTime -= deltaSeconds;
        p.walking = false;
        p.pose = p.state === 'phone' ? 'phone' : p.texting ? 'text' : 'idle';
        if (p.state === 'idle' && seededRandom() < deltaSeconds * 0.08) pedSay(p, 'idle');
        if (p.state === 'phone' && seededRandom() < deltaSeconds * 0.18) crowdSay(p, 'phoneTalk');
        if (p.state === 'idle' && seededRandom() < deltaSeconds * 0.4) p.a += (seededRandom() - 0.5) * 0.6;
        if (p.stateTime <= 0) {
          p.state = 'walk';
          p.walking = true;
          p.a = p.dir = snapAxis(p.a);
          p.timer = randomBetween(4, 10);
        }
        return;
      }
      if (p.state === 'chat') {
        p.stateTime -= deltaSeconds;
        p.walking = false;
        p.pose = 'chat';
        const other = p.chatWith;
        if (other && other.hp > 0 && other.state === 'chat') faceToward(p, other, deltaSeconds);
        if (seededRandom() < deltaSeconds * 0.22) crowdSay(p, 'chat');
        if (p.stateTime <= 0 || !other || other.state !== 'chat' || other.hp <= 0) {
          p.state = 'walk';
          p.chatWith = null;
          p.a = p.dir ?? snapAxis(p.a);
          p.timer = randomBetween(4, 10);
        }
        return;
      }
      if (p.state === 'enter') {
        const door = p.enterDoor;
        if (!door) {
          p.state = 'walk';
          return;
        }
        if (!p.atDoorFront && distanceBetween(p, door.out) < 5) p.atDoorFront = true;
        const target = p.atDoorFront ? door : door.out;
        if (p.atDoorFront && distanceBetween(p, door) < 4) {
          p.atDoorFront = false;
          goIndoors(p, door, p.rainShelter ? randomBetween(40, 120) : randomBetween(18, 75), p.rainShelter ? 'rain' : 'shop');
          p.rainShelter = false;
          return;
        }
        if (crowdStep(p, headingBetween(p, target), walkerSpeed(p) * 0.8, deltaSeconds)) {
          p.blocked = (p.blocked || 0) + deltaSeconds;
          if (p.blocked > 2.5 && !p.atDoorFront) {
            p.state = 'walk';
            p.blocked = 0;
          } else if (p.blocked > 1 && p.atDoorFront) {
            // The door is flush with the wall: arriving against it counts.
            p.atDoorFront = false;
            p.blocked = 0;
            goIndoors(p, door, p.rainShelter ? randomBetween(40, 120) : randomBetween(18, 75), p.rainShelter ? 'rain' : 'shop');
            p.rainShelter = false;
          }
        }
        return;
      }
      if (p.state === 'toBench') {
        const spot = p.bench;
        if (!spot || (spot.taken && spot.taken !== p)) {
          p.state = 'walk';
          p.bench = null;
          return;
        }
        if (distanceBetween(p, spot) < 4) {
          Object.assign(p, { state: 'sit', sitting: true, walking: false, a: spot.a, x: spot.x, y: spot.y });
          p.stateTime = randomBetween(9, 24);
        } else if (crowdStep(p, headingBetween(p, spot), 24, deltaSeconds)) {
          p.state = 'walk';
          spot.taken = null;
          p.bench = null;
        }
        return;
      }
      if (p.state === 'sit') {
        p.stateTime -= deltaSeconds;
        p.pose = 'sit';
        p.walking = false;
        if (seededRandom() < deltaSeconds * 0.05) pedSay(p, 'idle');
        if (p.stateTime <= 0) {
          p.sitting = false;
          p.walking = true;
          p.state = 'walk';
          if (p.bench) p.bench.taken = null;
          p.bench = null;
          p.a = p.dir = randomChoice([0, Math.PI]);
          p.timer = randomBetween(5, 12);
        }
        return;
      }
      if (p.timer < 0) {
        p.timer = randomBetween(5, 12);
        const roll = seededRandom(),
          wet = weather.rain > 0.3 ? 0.4 : 1;
        if (p.role === 'jogger') {
          if (roll > 0.9) p.dir = snapAxis((p.dir ?? p.a) + Math.PI);
        } else {
          if (roll < tempo.idle * wet) {
            p.state = seededRandom() < 0.3 ? 'phone' : 'idle';
            p.stateTime = randomBetween(2.5, p.state === 'phone' ? 12 : 6);
            p.walking = false;
            return;
          }
          if (roll < tempo.shop) {
            const door = crowd.hour > 7 && crowd.hour < 21.5 && seededRandom() < 0.45 ? doorNear(p, 60) : null;
            if (door && !/hospital|school|guns/.test(door.place?.kind || '')) {
              p.state = 'enter';
              p.enterDoor = door;
              p.atDoorFront = false;
              return;
            }
            if (shopfrontNear(p)) {
              p.state = 'shop';
              p.stateTime = randomBetween(3, 7);
              p.a = -Math.PI / 2;
              p.walking = false;
              return;
            }
          }
          if (roll < tempo.bench * wet) {
            const spot = nearestFreeBench(p, 160);
            if (spot) {
              spot.taken = p;
              p.bench = spot;
              p.state = 'toBench';
              return;
            }
          }
          if (roll > 0.88) p.dir = snapAxis((p.dir ?? p.a) + Math.PI);
        }
      }
      walkSidewalk(p, deltaSeconds);
    }
    /* The actual stride along the grid: lanes, corners, kerbs and overtaking. */
    function walkSidewalk(p, deltaSeconds) {
      const dir = snapAxis(p.dir ?? p.a);
      p.dir = dir;
      const vertical = Math.abs(Math.sin(dir)) > 0.5,
        sign = vertical ? Math.sign(Math.sin(dir)) : Math.sign(Math.cos(dir)),
        v = vertical ? p.y : p.x,
        next = nextCrossing(vertical ? ROAD_ROWS : ROAD_CENTERS, v, sign),
        remaining = Math.abs((next ?? 1e6) - v),
        beside = vertical ? roadNear(p.x) : rowNear(p.y),
        lateral = (vertical ? p.x : p.y) - beside,
        crossOff = next !== undefined ? sidewalkOffset(next, !vertical) : 67,
        // Walking down the middle of the road they run alongside (knocked or
        // shoved off the kerb, dodged a car, turned a corner short): steer back
        // onto the pavement instead of carrying on along the lane, where traffic
        // stopped for them and they stood blocked by the traffic, for ever.
        strayed =
          inCityGrid(p.x, p.y) && Math.abs(lateral) <= 40 && remaining > crossOff + 25 && cityStreetAt(p.x, p.y),
        onWalk = strayed || (inCityGrid(p.x, p.y) && Math.abs(lateral) > 40 && Math.abs(lateral) < 100);
      let speed = walkerSpeed(p);
      // Corners: decide once per junction whether to carry straight on or turn
      // onto the cross street (turning away from the road, so no crossing).
      if (onWalk && next !== undefined && remaining < 120) {
        const key = next * 4 + sign;
        if (p.cornerKey !== key) {
          p.cornerKey = key;
          p.turnPlan = seededRandom() < (p.role === 'jogger' ? 0.25 : 0.38) ? Math.sign(lateral) : 0;
        }
        if (p.turnPlan && remaining <= crossOff + 1) {
          const turned = vertical ? (p.turnPlan > 0 ? 0 : Math.PI) : p.turnPlan > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (!solid(p.x + Math.cos(turned) * 22, p.y + Math.sin(turned) * 22, 5)) p.dir = turned;
          p.turnPlan = 0;
          return;
        }
        // The kerb: wait for the walk signal, then glance and go.
        if (!p.turnPlan && remaining > crossOff + 3 && remaining < crossOff + 21 && !(p.shakenUntil > gameTime)) {
          const signal = trafficSignal(roadNear(p.x), rowNear(p.y))[vertical ? 'vertical' : 'horizontal'];
          if (signal !== 'green') {
            p.walking = false;
            p.waiting = true;
            p.pose = p.texting ? 'text' : 'wait';
            p.a += normalizeAngle(dir - p.a) * Math.min(1, deltaSeconds * 6);
            return;
          }
          if (p.waiting) {
            p.waiting = false;
            p.glanceUntil = gameTime + 0.9;
          }
        }
        // Caught mid-crossing by the change: hurry.
        if (remaining < crossOff - 10 && remaining > 20) {
          const signal = trafficSignal(roadNear(p.x), rowNear(p.y))[vertical ? 'vertical' : 'horizontal'];
          if (signal !== 'green') speed *= 1.6;
        }
      }
      p.waiting = false;
      // Keep right: hold a lane offset from the sidewalk centre, and step out
      // further to pass someone slow or standing in the way.
      let lateralSpeed = 0;
      if (onWalk) {
        const centre = beside + Math.sign(lateral || 1) * sidewalkOffset(beside, vertical),
          right = vertical ? -Math.sin(dir) : Math.cos(dir),
          pass = p.passUntil > gameTime ? p.passSide * 10 : 0,
          targetLateral = centre + right * clamp((p.lane || 5) + pass, -12, 14),
          error = targetLateral - (vertical ? p.x : p.y);
        lateralSpeed = clamp(error * 2.5, -speed * 0.45, speed * 0.45);
      }
      if (p.tipsy) lateralSpeed += Math.sin(gameTime * 1.7 + (p.walk || 0) * 0.3) * speed * 0.3;
      const vx = Math.cos(dir) * speed + (vertical ? lateralSpeed : 0),
        vy = Math.sin(dir) * speed + (vertical ? 0 : lateralSpeed),
        heading = Math.atan2(vy, vx),
        pace = Math.hypot(vx, vy);
      p.pose = p.texting ? 'text' : p.dog ? 'leash' : null;
      if (crowdStep(p, heading, pace, deltaSeconds)) {
        p.blocked = (p.blocked || 0) + deltaSeconds;
        if (p.blocked > 0.35) {
          const a = dir + (Math.PI / 2) * (p.passSide || 1);
          if (!solid(p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 15, 7))
            moveBody(p, Math.cos(a) * speed * deltaSeconds, Math.sin(a) * speed * deltaSeconds, 5);
          if (p.blocked > 2) {
            p.dir = snapAxis(dir + Math.PI);
            p.blocked = 0;
          }
        }
      } else p.blocked = 0;
    }
    /* A few times a second: overtake slow walkers, and now and then stop to chat. */
    function crowdEncounters(deltaSeconds) {
      crowd.timers.chat -= deltaSeconds;
      if (crowd.timers.chat > 0) return;
      crowd.timers.chat = 0.3;
      for (const cell of crowd.grid.values())
        for (const p of cell) {
          if (p.state !== 'walk' || p.react || p.leader || p.flee > 0 || p.hp <= 0 || p.scene) continue;
          const dir = p.dir ?? p.a,
            c = Math.cos(dir),
            s = Math.sin(dir);
          forPeopleNear(p.x + c * 10, p.y + s * 10, 10, (q) => {
            if (q === p || q.leader === p || p.passUntil > gameTime) return;
            const along = (q.x - p.x) * c + (q.y - p.y) * s,
              side = -(q.x - p.x) * s + (q.y - p.y) * c;
            if (along < 2 || along > 16 || Math.abs(side) > 6) return;
            const facing = Math.cos((q.dir ?? q.a) - dir);
            // Two walkers meeting head on occasionally know each other.
            if (
              facing < -0.8 &&
              q.state === 'walk' &&
              !q.isle &&
              !p.isle &&
              !q.react &&
              !q.leader &&
              !q.scene &&
              !(q.flee > 0) &&
              crowd.tempo.idle > 0.07 &&
              seededRandom() < 0.035
            ) {
              for (const [a, b] of [
                [p, q],
                [q, p],
              ]) {
                a.state = 'chat';
                a.chatWith = b;
                a.stateTime = randomBetween(8, 18);
                a.walking = false;
              }
              crowdSay(p, 'chat');
              return;
            }
            if (facing > 0.5 || !q.walking) {
              p.passUntil = gameTime + 1.3;
              p.passSide = side > 0 ? -1 : 1;
            }
          });
        }
    }
