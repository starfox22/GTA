    // North Point Key's lifts: the roof decks (FEDERATION EAST's helideck, EVOLUTION's sky-bar terrace), lobby and roof doors, the ride and its fade, the parked helicopter.
    /**
     * Tower lifts and roof decks
     * Source: src/skyline-lift.js
     * Scope: game closure. The decks are drawn by skyline3d-islet.js (helideck) and
     * skyline3d-bar.js (terrace); walking on them is rooftops.js (player.buildingRoof).
     *
     * - Roof deck: `b.roofDeck` is the walkable roof as shapes ({x, y, r} a disc,
     *   {x0, y0, x1, y1} a box, {poly} a polygon, world units); rooftops.js walks
     *   and lands inside it instead of the lot, round `b.deckKeepOuts` (the lift
     *   house, the bar's furniture). Each is measured from the tower's own loft
     *   (skylineRoofOutline: the plan math the renderer lofts it with).
     * - FEDERATION EAST: a helideck disc on the sail tower's roof, cantilevered
     *   past the prow, with the lift house on the north edge; its pad is
     *   `b.keyPad` (rooftops.js chooseRoofHelipads) and a helicopter is parked on
     *   it (populateNorthPointKey).
     * - EVOLUTION: the CIRRUS terrace on the twisted tower's oval top (skyline-bar.js);
     *   nothing lands there (`b.noLanding`).
     * - The ride: E at a lobby door (street level, on foot, not wanted) or at a
     *   roof door. The screen fades to black with the floor counting, the player
     *   is moved with teleportPlayer() at the dark moment (then put on the roof
     *   carrier going up) and it fades back. gameMode is 'elevator' meanwhile, as
     *   for the Blue Hour's lift; updateSkyLift runs from the frame loop and from
     *   the console's simulate().
     */
    // Loft sections the renderer builds these towers from (skyline3d-towers.js).
    function federationSections(H, helipad = false) {
      return helipad
        ? [{ y: 40 }, { y: H * 0.72 }, { y: H, s: 0.9 }]
        : [{ y: 40 }, { y: H * 0.72 }, { y: H, s: 0.9 }, { y: H + 46, s: 0.82 }];
    }
    function evolutionSections(H, twist = 2.6) {
      const sections = [];
      for (let k = 0; k <= 34; k++) {
        const t = k / 34;
        sections.push({ y: 40 + (H - 40) * t, r: t * twist, s: 1 + 0.05 * Math.sin(t * Math.PI) });
      }
      return sections;
    }
    const SKYLINE_ROOF_FORMS = {
      federation: { plan: () => planSailTriangle(1, 1), sections: (t, H) => federationSections(H, t.roof === 'helipad') },
      evolution: { plan: () => planSuper(1, 0.64, 2.6, 48), sections: (t, H) => evolutionSections(H, t.twist ?? 2.6) },
    };
    // A tower's outline at its main roof, as world points [x, y] (null for other designs).
    function skylineRoofOutline(b) {
      const form = SKYLINE_ROOF_FORMS[b.skyline.design];
      if (!form) return null;
      const H = b.height,
        plan0 = form.plan(),
        sections = form.sections(b.skyline, H),
        f = fitScale(plan0, sections, b.w / 2 - 6, b.h / 2 - 6),
        top = sections.filter((s) => s.y <= H + 0.01).at(-1),
        q = { x: 0, z: 0 };
      return plan0.map((p) => {
        sectionPoint({ x: p.x * f, z: p.z * f }, top, q);
        return [b.x + b.w / 2 + q.x, b.y + b.h / 2 + q.z];
      });
    }
    const SKY_LIFTS = [];
    let skyLift = null;
    const SKY_LIFT_SECONDS = 2.6;
    /* The decks and doors of the Key's towers with a roof use, measured once the
       towers stand (buildNorthPointKey). */
    function prepareSkylineRoofs() {
      SKY_LIFTS.length = 0;
      for (const b of buildings) {
        const t = b.skyline;
        if (!b.islet || !t.roof) continue;
        const cx = b.x + b.w / 2,
          cy = b.y + b.h / 2,
          outline = skylineRoofOutline(b),
          lobby = { x: cx, y: b.y + b.h + 14 },
          lift = { id: t.roof, tower: t, b, lobby, floors: Math.round((b.height - SHOP_FLOOR) / STOREY) + 1 };
        b.roofOutline = outline;
        if (t.roof === 'helipad') {
          // The lift house stands on the sail's straight north side, the pad south of it.
          const north = Math.min(...outline.filter(([x]) => Math.abs(x - cx) < 30).map(([, y]) => y)),
            // Wide enough to walk round a parked helicopter (86 long) to the lift.
            pad = { x: cx, y: cy + 20, r: 76 },
            house = { x: cx, y: north + 14, hx: 16, hy: 8 };
          b.keyPad = { x: pad.x, y: pad.y, r: pad.r - 12 };
          b.roofDeck = [pad, { x0: cx - 30, y0: house.y - house.hy, x1: cx + 30, y1: pad.y - pad.r + 30 }];
          b.deckKeepOuts = [{ x: house.x, y: house.y, hx: house.hx, hy: house.hy, a: 0 }];
          Object.assign(lift, { venue: 'THE HELIPAD', house, door: { x: cx, y: house.y + house.hy + 6 } });
        } else if (t.roof === 'bar') {
          // The terrace: the oval top to the glass balustrade (rooftops.js keeps
          // the walker's body a parapet's width inside it).
          const walk = outline.map(([x, y]) => {
            const d = Math.hypot(x - cx, y - cy) || 1,
              k = 1 - 2 / d;
            return [cx + (x - cx) * k, cy + (y - cy) * k];
          });
          b.noLanding = true;
          b.roofDeck = [{ poly: walk }];
          const plan = skyBarPlan(b);
          b.deckKeepOuts = plan.keepOuts;
          Object.assign(lift, { venue: 'CIRRUS · SKY BAR', house: plan.house, door: plan.door, bar: plan });
        }
        lift.arrive = { x: lift.door.x, y: lift.door.y + 12 };
        SKY_LIFTS.push(lift);
      }
    }
    // The lift the player can call from here: a roof door on its roof, or a lobby door at street level.
    function skyLiftInReach() {
      if (player.car || player.parachute || player.swimming || player.deck || player.roof || gameMode !== 'play') return null;
      for (const lift of SKY_LIFTS) {
        if (player.buildingRoof) {
          if (player.buildingRoof !== lift.b) continue;
          if (withinRange('key-lift-roof-' + lift.id, distanceBetween(player, lift.door), 26)) return { lift, up: false };
        } else if (onNorthPointKey(player.x, player.y) && withinRange('key-lift-lobby-' + lift.id, distanceBetween(player, lift.lobby), 34))
          return { lift, up: true };
      }
      return null;
    }
    // The prompt on the Key and on its roofs (game-ui.js asks before the vehicle prompt).
    function northPointKeyPrompt() {
      if (skyLift || player.car || (!player.buildingRoof?.islet && !onNorthPointKey(player.x, player.y))) return null;
      const reach = skyLiftInReach();
      if (reach)
        return reach.up
          ? { text: 'ELEVATOR TO ' + reach.lift.venue + ' · ' + reach.lift.tower.name, id: 'key-lift-up' }
          : { text: 'ELEVATOR TO THE STREET', id: 'key-lift-down' };
      return skyBarPrompt();
    }
    // The action key on the Key: a lift, or the bar (skyline-bar.js).
    function northPointKeyInteract() {
      if (skyLift || player.car || gameMode !== 'play') return false;
      const reach = skyLiftInReach();
      if (reach) {
        if (reach.up && wantedStars > 0) {
          needToLosePolice();
          return true;
        }
        startSkyLift(reach.lift, reach.up);
        return true;
      }
      return skyBarInteract();
    }
    function startSkyLift(lift, up) {
      if (gameMode !== 'play' || skyLift) return false;
      skyLift = { lift, up, t: 0, moved: false };
      gameMode = 'elevator';
      keys = {};
      mouse.down = false;
      const el = getElement('skyLift');
      el.style.opacity = '0';
      el.classList.remove('hidden');
      getElement('skyLiftVenue').textContent = lift.tower.name + ' · ' + (up ? lift.venue : 'STREET LEVEL');
      getElement('skyLiftFloor').textContent = up ? 'LOBBY' : 'FLOOR ' + lift.floors;
      tone(880, 0.14, 0.07, 'sine');
      return true;
    }
    /* The ride: 0.45 s to black, the counter runs, the move at the dark moment,
       0.5 s back. Wall time capped per frame, so a stall cannot skip the move. */
    function updateSkyLift(deltaSeconds) {
      const L = skyLift;
      if (!L) return;
      L.t += Math.min(0.1, Math.max(0, deltaSeconds));
      const t = L.t,
        fade = t < 0.45 ? t / 0.45 : t > SKY_LIFT_SECONDS - 0.5 ? Math.max(0, (SKY_LIFT_SECONDS - t) / 0.5) : 1,
        run = clamp((t - 0.45) / (SKY_LIFT_SECONDS - 0.95), 0, 1),
        floor = Math.round((L.up ? run : 1 - run) * L.lift.floors);
      getElement('skyLift').style.opacity = fade.toFixed(3);
      getElement('skyLiftFloor').textContent = floor <= 0 ? 'LOBBY' : floor >= L.lift.floors ? (L.lift.id === 'bar' ? 'ROOF TERRACE' : 'HELIPAD') : 'FLOOR ' + String(floor).padStart(2, '0');
      if (!L.moved && t >= 0.5) {
        L.moved = true;
        const b = L.lift.b;
        if (L.up) {
          teleportPlayer(L.lift.arrive.x, L.lift.arrive.y);
          player.buildingRoof = b;
          player.altitude = b.height;
          if (L.lift.id === 'bar') skyBarArrive();
        } else teleportPlayer(L.lift.lobby.x, L.lift.lobby.y + 18);
        player.a = Math.PI / 2;
      }
      if (t >= SKY_LIFT_SECONDS) {
        skyLift = null;
        getElement('skyLift').classList.add('hidden');
        if (gameMode === 'elevator') gameMode = 'play';
        canvas.focus();
        tone(1320, 0.12, 0.06, 'sine');
        if (L.up)
          tell(
            L.lift.id === 'bar'
              ? 'CIRRUS · ' + keyName('interact') + ' at the bar for a drink · the lift is behind you.'
              : 'THE HELIPAD · ' + keyName('interact') + ' by the helicopter to fly · the lift is behind you.',
            4,
          );
        else tell('NORTH POINT KEY · Back at street level.', 3);
      }
    }
    // Any ride under way is dropped (a new game or a reload, populate()).
    function resetSkyLift() {
      skyLift = null;
      getElement('skyLift').classList.add('hidden');
      if (gameMode === 'elevator' && !liftTravel) gameMode = 'play';
    }
    /* The Key's standing life: the helicopter on FEDERATION EAST's pad, and a
       doorman at each tower's lobby (skyline-bar.js keeps them at their posts). */
    function populateNorthPointKey() {
      resetSkyLift();
      // populate() emptied the pedestrians: the terrace fills again on the next approach.
      Object.assign(skyBar, { live: false, people: [], groups: [], talker: null });
      for (const lift of SKY_LIFTS) {
        if (lift.id === 'helipad') {
          // Parked across the deck, nose west: its door side faces the lift house.
          const pad = lift.b.keyPad,
            h = makeCar('helicopter', pad.x, pad.y, Math.PI, false);
          h.altitude = lift.b.height;
          h.roofSite = lift.b;
        }
      }
      for (const b of buildings)
        if (b.islet && b.skyline) spawnKeyStaff({ x: b.x + b.w / 2 + 34, y: b.y + b.h + 20, a: Math.PI / 2, role: 'doorman' });
      const C = NORTH_POINT_KEY.circle;
      spawnKeyStaff({ x: C.x + 30, y: C.y - C.r - C.width / 2 - 18, a: Math.PI / 2, role: 'valet' });
    }
