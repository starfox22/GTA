    // The camera on the car, off to the right of the card.
    function frameDealerMenu() {
      const m = dealer.menu;
      if (!m) return;
      const target = m.kind === 'garage' ? DEALER.handover : m.slot?.car || m.slot;
      if (!target) return;
      const narrow = viewportWidth < 700;
      cameraTarget.x = target.x - (narrow ? 0 : 5.5 * UNITS_PER_METRE);
      cameraTarget.y = target.y + (narrow ? 4 * UNITS_PER_METRE : 0.5 * UNITS_PER_METRE);
      worldZoom = Math.max(m.view.zoom, 1.8);
      canvasScale = clamp(Math.min(viewportWidth / 1250, viewportHeight / 850), 0.72, 1.35) * worldZoom;
    }
    function dealerSpecCell(value, unit, label, wide = false) {
      const d = dealerElement('div', wide ? 'wide' : ''),
        b = dealerElement('b', '', value);
      if (unit) b.appendChild(dealerElement('small', '', unit));
      d.append(b, dealerElement('span', '', label));
      return d;
    }
    function renderDealerMenu() {
      const m = dealer.menu,
        root = ensureDealerOverlay();
      if (!m) return;
      root.replaceChildren();
      root.appendChild(dealerElement('div', 'dl-shade'));
      const panel = dealerElement('div', 'dl-panel'),
        house = dealerElement('div', 'dl-house');
      house.append(dealerElement('span', '', DEALER.name + ' · ' + DEALER.sub), dealerElement('i'));
      panel.appendChild(house);
      if (m.kind === 'garage') renderDealerGarage(panel);
      else renderDealerCar(panel, m);
      root.appendChild(panel);
      if (m.kind === 'car') {
        const browse = dealerElement('div', 'dl-browse');
        for (const s of dealerBrowseList()) {
          const b = dealerElement('button', '', PRESTIGE_BY_TYPE.get(s.type).model.split(' ')[0]);
          b.setAttribute('aria-current', s.type === m.type ? 'true' : 'false');
          b.addEventListener('click', () => dealerBrowseTo(s));
          browse.appendChild(b);
        }
        root.appendChild(browse);
      }
    }
    function renderDealerCar(panel, m) {
      const item = dealerCatalogItem(m.type);
      if (!item) return;
      panel.appendChild(dealerElement('div', 'dl-marque', item.marque));
      panel.appendChild(dealerElement('h2', 'dl-model', item.model));
      panel.appendChild(dealerElement('span', 'dl-tier', { hypercar: 'HYPERCAR', gt: 'GRAND TOURER', supercar: 'SUPERCAR' }[item.tier] || 'SUPERCAR'));
      panel.appendChild(dealerElement('p', 'dl-blurb', item.blurb));
      const grid = dealerElement('div', 'dl-grid');
      grid.append(
        dealerSpecCell(item.hp.toLocaleString('en-US'), 'hp', 'POWER'),
        dealerSpecCell(item.torque.toLocaleString('en-US'), 'Nm', 'TORQUE'),
        dealerSpecCell(item.zeroTo100.toFixed(item.zeroTo100 < 2 ? 2 : 1), 's', '0 – 100 KM/H'),
        dealerSpecCell(String(item.topKmh), 'km/h', 'TOP SPEED'),
        dealerSpecCell(item.massKg.toLocaleString('en-US'), 'kg', 'WEIGHT'),
        dealerSpecCell(item.lengthM.toFixed(2), 'm', 'LENGTH'),
        dealerSpecCell(item.engine, '', 'ENGINE', true),
        dealerSpecCell(item.drivetrain, '', 'DRIVETRAIN', true),
      );
      panel.appendChild(grid);
      // Where it sits in the collection: power, top speed, acceleration.
      const all = PRESTIGE_CATALOG.map(prestigeFigures),
        bars = dealerElement('div', 'dl-bars'),
        bar = (label, value, max, min = 0) => {
          const row = dealerElement('div', 'dl-bar'),
            track = dealerElement('i'),
            fillEl = dealerElement('em');
          fillEl.style.width = Math.round(clamp((value - min) / (max - min), 0.04, 1) * 100) + '%';
          track.appendChild(fillEl);
          row.append(dealerElement('span', '', label), track);
          bars.appendChild(row);
        };
      bar('POWER', item.hp, Math.max(...all.map((c) => c.hp)));
      bar('TOP SPEED', item.topKmh, Math.max(...all.map((c) => c.topKmh)), 250);
      bar('ACCELERATION', 4 - item.zeroTo100, 4 - Math.min(...all.map((c) => c.zeroTo100)));
      panel.appendChild(bars);
      // Paint.
      const paints = dealerElement('div', 'dl-paints'),
        row = dealerElement('div', 'row');
      paints.appendChild(dealerElement('div', 'dl-label', 'PAINT · ' + item.paints.length + ' FINISHES'));
      item.paints.forEach(([name, color], i) => {
        const b = dealerElement('button', 'dl-swatch');
        b.style.background = color;
        b.title = name;
        b.setAttribute('aria-label', name);
        b.setAttribute('aria-pressed', i === m.paint ? 'true' : 'false');
        b.addEventListener('click', () => dealerPickPaint(i));
        row.appendChild(b);
      });
      paints.append(row, dealerElement('div', 'dl-paintname', item.paints[m.paint][0]));
      panel.appendChild(paints);
      // Price and the verdict.
      const price = dealerElement('div', 'dl-price'),
        left = dealerElement('div'),
        short = item.price - cash,
        blocked = dealer.alarmUntil > gameTime ? 'THE SHOWROOM IS IN LOCKDOWN' : wantedStars > 0 ? 'NO SALES WHILE THE POLICE ARE LOOKING FOR YOU' : '';
      left.append(dealerElement('b', '', prestigePrice(item.price)));
      const note = dealerElement('small', short > 0 || blocked ? 'short' : '', blocked || (short > 0 ? 'INSUFFICIENT FUNDS · SHORT BY ' + prestigePrice(short) : 'YOUR BALANCE ' + prestigePrice(cash) + ' · ' + prestigePrice(cash - item.price) + ' AFTER'));
      left.appendChild(note);
      price.appendChild(left);
      panel.appendChild(price);
      const actions = dealerElement('div', 'dl-actions'),
        buy = dealerElement('button', 'buy', short > 0 ? 'INSUFFICIENT FUNDS' : 'BUY · ' + prestigePrice(item.price, true));
      buy.disabled = short > 0 || !!blocked;
      buy.addEventListener('click', () => dealerConfirmBuy());
      const test = dealerElement('button', '', 'TEST DRIVE');
      test.disabled = !!blocked;
      test.addEventListener('click', () => startTestDrive(m.type, m.paint));
      const back = dealerElement('button', '', 'BACK');
      back.addEventListener('click', () => closeDealerMenu());
      actions.append(buy, test, back);
      panel.appendChild(actions);
      const help = dealerElement('div', 'dl-keys');
      help.innerHTML = '<kbd>←</kbd><kbd>→</kbd> PAINT &nbsp; <kbd>↑</kbd><kbd>↓</kbd> OTHER CARS &nbsp; <kbd>ENTER</kbd> BUY &nbsp; <kbd>T</kbd> TEST DRIVE &nbsp; <kbd>ESC</kbd> BACK';
      panel.appendChild(help);
      setTimeout(() => (buy.disabled ? back : buy).focus?.(), 0);
    }
    function renderDealerGarage(panel) {
      panel.appendChild(dealerElement('div', 'dl-marque', 'CONCIERGE'));
      panel.appendChild(dealerElement('h2', 'dl-model', 'MY GARAGE'));
      panel.appendChild(dealerElement('p', 'dl-blurb', dealer.owned.length ? 'Your cars are kept in the owners’ bays beside the lane, washed and fuelled. The concierge will bring any of them round to the handover bay.' : 'You do not own a car from the collection yet. Every car on the floor can be yours: speak to a salesman, or walk up to one you like.'));
      const list = dealerElement('div', 'dl-garage');
      for (const rec of dealer.owned) {
        const row = dealerElement('div', 'car'),
          dot = dealerElement('i', 'dot'),
          text = dealerElement('div'),
          live = ownedCarLive(rec),
          where = !live ? 'being prepared' : rec.car === player.car ? 'you are driving it' : onDealerLot(rec.car.x, rec.car.y, 0) ? 'on the lot' : districtAt(rec.car.x, rec.car.y) || 'out in the city';
        dot.style.background = rec.color;
        text.append(dealerElement('b', '', VEHICLE_DEFINITIONS[rec.type].name), dealerElement('small', '', rec.paint + ' · ' + where));
        const fetch = dealerElement('button', '', 'BRING ROUND');
        fetch.disabled = rec.car === player.car;
        fetch.addEventListener('click', () => bringOwnedCar(rec));
        row.append(dot, text, fetch);
        list.appendChild(row);
      }
      panel.appendChild(list);
      const actions = dealerElement('div', 'dl-actions'),
        back = dealerElement('button', '', 'BACK');
      back.addEventListener('click', () => closeDealerMenu());
      actions.appendChild(back);
      panel.appendChild(actions);
      setTimeout(() => back.focus?.(), 0);
    }
    function dealerPickPaint(i) {
      const m = dealer.menu;
      if (!m || m.kind !== 'car') return;
      const item = PRESTIGE_BY_TYPE.get(m.type);
      m.paint = (i + item.paints.length) % item.paints.length;
      if (displayCarIntact(m.slot?.car)) m.slot.car.color = item.paints[m.paint][1];
      renderDealerMenu();
    }
    function dealerBrowseTo(s) {
      const m = dealer.menu;
      if (!m || !s) return;
      if (displayCarIntact(m.slot?.car)) m.slot.car.color = m.slot.baseColor;
      m.slot = s;
      m.type = s.type;
      const item = PRESTIGE_BY_TYPE.get(s.type);
      m.paint = Math.max(0, item.paints.findIndex((p) => p[1] === (s.car?.color || s.baseColor)));
      frameDealerMenu();
      renderDealerMenu();
      dealershipSalesPitch(s, 'open');
    }
    function dealerBrowse(step) {
      const list = dealerBrowseList(),
        m = dealer.menu;
      if (!m || !list.length) return;
      const i = list.findIndex((s) => s.type === m.type);
      dealerBrowseTo(list[(i + step + list.length) % list.length]);
    }
    function dealerConfirmBuy() {
      const m = dealer.menu;
      if (!m || m.kind !== 'car') return;
      const result = buyPrestigeCar(m.type, m.paint);
      if (!result.ok) {
        tone(150, 0.1, 0.18, 'square');
        renderDealerMenu();
        return;
      }
      const slot = m.slot;
      closeDealerMenu();
      startDeliveryReveal(result.rec, slot);
    }
    // Keys while the card is open (game.js keydown hands them all here).
    function dealershipKeyDown(e, code, is) {
      const m = dealer.menu;
      if (!m) return;
      if (code === 'Tab') return;
      if (e.target?.tagName === 'BUTTON' && ['Enter', 'Space', 'NumpadEnter'].includes(code)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (code === 'Escape' || is('interact') || is('pause')) closeDealerMenu();
      else if (m.kind === 'car') {
        if (code === 'ArrowLeft' || code === 'KeyA') dealerPickPaint(m.paint - 1);
        else if (code === 'ArrowRight' || code === 'KeyD') dealerPickPaint(m.paint + 1);
        else if (code === 'ArrowUp' || code === 'KeyW') dealerBrowse(-1);
        else if (code === 'ArrowDown' || code === 'KeyS') dealerBrowse(1);
        else if (code === 'Enter' || code === 'NumpadEnter') dealerConfirmBuy();
        else if (code === 'KeyT') startTestDrive(m.type, m.paint);
      }
    }
    // The concierge brings an owned car round to the handover bay.
    function bringOwnedCar(rec) {
      if (rec.car === player.car) return;
      const h = DEALER.handover;
      if (vehicles.some((c) => c !== rec.car && c.hp > 0 && Math.hypot(c.x - h.x, c.y - h.y) < 22)) {
        tell('The handover bay is occupied: move the car standing in it first.', 3);
        return;
      }
      if (ownedCarLive(rec)) {
        Object.assign(rec.car, { x: h.x, y: h.y, a: h.a, vx: 0, vy: 0, speed: 0, av: 0, moveA: h.a, stepStartX: h.x, stepStartY: h.y, stepStartA: h.a });
        if (rec.car.damage && rec.car.hp < rec.car.maxhp * 0.6) repairVehicle(rec.car);
      } else {
        const c = makeCar(rec.type, h.x, h.y, h.a, false, rec.color);
        markOwned(c, rec);
        rec.lostAt = -1;
      }
      closeDealerMenu();
      tell('Your ' + VEHICLE_DEFINITIONS[rec.type].name + ' is waiting at the handover bay.', 3.5);
    }
    /* ---- The delivery reveal -------------------------------------------------------- */
    let dealerRevealEl = null,
      dealerConfetti = null;
    function ensureRevealOverlay() {
      if (dealerRevealEl) return dealerRevealEl;
      dealerStyles();
      dealerRevealEl = dealerElement('div', 'hidden');
      dealerRevealEl.id = 'dealerReveal';
      const confetti = document.createElement('canvas'),
        fade = dealerElement('div', 'fade'),
        card = dealerElement('div', 'card');
      card.append(dealerElement('small'), dealerElement('b'), dealerElement('span'));
      dealerRevealEl.append(confetti, fade, card);
      document.body.appendChild(dealerRevealEl);
      return dealerRevealEl;
    }
    function startDeliveryReveal(rec, slot) {
      const st = DEALER.stage,
        v = DEALER.viewing;
      // The new car waits on the stage behind the curtain.
      if (player.car) exitCar();
      teleportPlayer(v.x, v.y);
      player.a = v.a;
      const car = makeCar(rec.type, st.x, st.y, Math.PI / 2 - 0.6, false, rec.color);
      markOwned(car, rec);
      car.showLamps = true;
      dealer.reveal = { rec, car, t: 0, slot, spin: 0, curtain: 0, confettiAt: -1, handed: false, lines: 0 };
      const el = ensureRevealOverlay();
      el.classList.remove('hidden');
      el.querySelector('.fade').style.opacity = '1';
      const card = el.querySelector('.card');
      card.classList.remove('show');
      card.querySelector('small').textContent = DEALER.name + ' · DELIVERY';
      card.querySelector('b').textContent = VEHICLE_DEFINITIONS[rec.type].name;
      card.querySelector('span').textContent = rec.paint.toUpperCase() + ' · ' + prestigePrice(rec.price);
      dealerConfetti = null;
      dealershipRevealStaff(true);
    }
    // Held keys are dropped while the reveal plays (the player is a spectator).
    function updateDeliveryReveal(deltaSeconds) {
      const r = dealer.reveal;
      if (!r) return;
      r.t += deltaSeconds;
      document.body.classList.add('dealer-reveal');
      const el = ensureRevealOverlay(),
        fade = el.querySelector('.fade'),
        card = el.querySelector('.card');
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyF', 'Space']) keys[k] = false;
      mouse.down = false;
      // Held in front of the stage until the keys are handed over.
      if (!r.handed) {
        const v = DEALER.viewing;
        player.x = v.x;
        player.y = v.y;
        player.a = v.a;
      }
      if (r.t > 0.5 && r.t < 7.2) fade.style.opacity = '0';
      // The curtain draws back from 1.4 s to 4.2 s; the stage turns from 1 s.
      r.curtain = clamp((r.t - 1.4) / 2.8, 0, 1);
      if (r.t > 1) r.spin = Math.min(0.5, r.spin + deltaSeconds * 0.25);
      if (r.car && vehicles.includes(r.car) && r.t < 8) {
        r.car.a = normalizeAngle(r.car.a + r.spin * deltaSeconds);
        r.car.moveA = r.car.stepStartA = r.car.a;
        r.car.x = DEALER.stage.x;
        r.car.y = DEALER.stage.y;
      }
      if (r.t > 2.6 && r.confettiAt < 0) {
        r.confettiAt = r.t;
        dealerConfetti = makeConfetti();
        tone(880, 0.12, 0.12, 'sine');
        tone(1320, 0.18, 0.1, 'sine');
      }
      if (r.t > 3.2) card.classList.add('show');
      drawConfetti(el.querySelector('canvas'), deltaSeconds);
      if (r.t > 7.2) fade.style.opacity = '1';
      // The keys: at the handover bay outside, the car beside the player.
      if (r.t > 8 && !r.handed) {
        r.handed = true;
        // The handover bay, or the first free owner's bay if a car stands in it.
        const busy = vehicles.some((c) => c !== r.car && c.hp > 0 && Math.hypot(c.x - DEALER.handover.x, c.y - DEALER.handover.y) < 22),
          h = busy ? freeOwnerBay() || DEALER.handover : DEALER.handover;
        if (r.car && vehicles.includes(r.car)) Object.assign(r.car, { x: h.x, y: h.y, a: h.a, vx: 0, vy: 0, speed: 0, av: 0, moveA: h.a, stepStartX: h.x, stepStartY: h.y, stepStartA: h.a, showLamps: false });
        teleportPlayer(h.x + 26, h.y - 6);
        player.a = Math.PI;
        dealershipRevealStaff(false);
      }
      if (r.t > 8.6) {
        fade.style.opacity = '0';
        card.classList.remove('show');
      }
      if (r.t > 9.4) {
        el.classList.add('hidden');
        document.body.classList.remove('dealer-reveal');
        dealer.reveal = null;
        dealerConfetti = null;
        tell('The keys are yours: your ' + VEHICLE_DEFINITIONS[r.rec.type].name + ' is at the handover bay. ' + keyName('interact') + ' to get in.', 5);
      }
    }
    function makeConfetti() {
      const colors = ['#e2c897', '#f3efe6', '#c9a24e', '#ffffff', '#b99450', '#8fb8d8'],
        bits = [];
      for (let i = 0; i < 220; i++)
        bits.push({ x: Math.random(), y: -Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.12, vy: 0.12 + Math.random() * 0.22, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 9, w: 5 + Math.random() * 7, h: 3 + Math.random() * 4, c: colors[i % colors.length] });
      return bits;
    }
    function drawConfetti(canvasEl, deltaSeconds) {
      const w = (canvasEl.width = viewportWidth),
        h = (canvasEl.height = viewportHeight),
        g = canvasEl.getContext('2d');
      g.clearRect(0, 0, w, h);
      if (!dealerConfetti) return;
      for (const b of dealerConfetti) {
        b.x += b.vx * deltaSeconds;
        b.y += b.vy * deltaSeconds;
        b.vx += Math.sin(b.y * 9 + b.r) * 0.02 * deltaSeconds;
        b.r += b.vr * deltaSeconds;
        if (b.y > 1.1) continue;
        g.save();
        g.translate(b.x * w, b.y * h);
        g.rotate(b.r);
        g.scale(1, Math.abs(Math.cos(b.r * 1.3)) + 0.15);
        g.fillStyle = b.c;
        g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        g.restore();
      }
    }
    // The reveal frames the stage (world-view.js via garages.js garageCameraFrame).
    function dealershipCameraFrame() {
      const r = dealer.reveal;
      if (!r || r.t > 8) return null;
      return { x: DEALER.stage.x, y: DEALER.stage.y + 40, zoom: 1.7 };
    }
    /* ---- Test drive ----------------------------------------------------------------- */
    function startTestDrive(type, paintIndex = 0) {
      if (!dealershipCanTrade()) return;
      const item = PRESTIGE_BY_TYPE.get(type),
        h = DEALER.handover;
      if (!item) return;
      if (vehicles.some((c) => c.hp > 0 && Math.hypot(c.x - h.x, c.y - h.y) < 22 && !c.owned)) {
        tell('The handover bay is occupied.', 2.5);
        return;
      }
      closeDealerMenu();
      const c = makeCar(type, h.x, h.y, h.a, false, item.paints[clamp(paintIndex, 0, item.paints.length - 1)][1]);
      c.authorized = true;
      c.testDrive = true;
      teleportPlayer(h.x, h.y);
      enterVehicle(c);
      dealer.test = { car: c, until: gameTime + 120, type };
      announce(DEALER.name + ' · TEST DRIVE', VEHICLE_DEFINITIONS[type].name + ' · 2 MINUTES', 2.4);
      tell('The salesman buckles in beside you: “Two minutes. Please… be gentle.”', 4);
      dealerLog('test drive ' + type);
    }
    function endTestDrive(message) {
      const t = dealer.test;
      if (!t) return;
      dealer.test = null;
      const h = DEALER.handover;
      if (player.car === t.car) exitCar();
      const i = vehicles.indexOf(t.car);
      if (i >= 0) vehicles.splice(i, 1);
      if (dealer.alarmUntil <= gameTime) {
        teleportPlayer(h.x + 26, h.y - 6);
        player.a = Math.PI;
      }
      if (message) tell(message, 4);
    }
    function updateTestDrive() {
      const t = dealer.test;
      if (!t) return;
      const c = t.car,
        left = t.until - gameTime;
      if (!vehicles.includes(c) || c.hp <= 0) return endTestDrive('The test car is a write-off. The salesman is very quiet on the walk back.');
      if (player.car !== c) return endTestDrive('Test drive over. “Well? Shall we talk numbers?”');
      if (left <= 0) return endTestDrive('Time’s up: the salesman takes the car back to the showroom. “Thrilling, isn’t it?”');
      if (Math.hypot(c.x - DEALER.handover.x, c.y - DEALER.handover.y) > 2600) return endTestDrive('“This is far enough, sir.” The test drive ends and the car goes back.');
    }
    function testDrivePrompt() {
      const t = dealer.test;
      if (!t || player.car !== t.car) return '';
      const left = Math.max(0, Math.ceil(t.until - gameTime));
      return 'TEST DRIVE · ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + ' · ' + keyName('interact') + ' TO END';
    }
    /* ---- Prompt and action key ------------------------------------------------------ */
    function dealershipConcierge() {
      const f = DEALER.furniture?.reception;
      return !!f && !player.car && withinRange('dealer-concierge', Math.hypot(player.x - (f.x + f.w / 2), player.y - (f.y + f.h + 10)), 30, 40);
    }
    // The prompt's text and identity, or null (game.js updateUI).
    function dealershipPrompt() {
      if (!DEALER.planned || gameMode !== 'play' || dealer.reveal) return null;
      if (player.car) {
        const t = testDrivePrompt();
        return t ? { text: t, id: 'dealer-test', key: null } : null;
      }
      if (!onDealerLot(player.x, player.y, 10)) return null;
      const s = displayCarNear(player.x, player.y);
      if (s) {
        const spec = VEHICLE_DEFINITIONS[s.type],
          item = PRESTIGE_BY_TYPE.get(s.type);
        if (dealer.alarmUntil > gameTime) return { text: 'STEAL · ' + spec.name, id: 'dealer-steal' };
        return { text: spec.name + ' · ' + prestigePrice(item ? item.price : 0) + ' · VIEW', id: 'dealer-car' };
      }
      if (dealershipConcierge()) return { text: 'CONCIERGE · MY GARAGE' + (dealer.owned.length ? ' · ' + dealer.owned.length : ''), id: 'dealer-garage' };
      return null;
    }
    function dealershipInteract() {
      if (!DEALER.planned || dealer.reveal) return !!dealer.reveal;
      if (player.car) {
        if (dealer.test && player.car === dealer.test.car) {
          endTestDrive('Test drive over. “Well? Shall we talk numbers?”');
          return true;
        }
        return false;
      }
      if (!onDealerLot(player.x, player.y, 10)) return false;
      const s = displayCarNear(player.x, player.y);
      if (s) {
        if (dealer.alarmUntil > gameTime) {
          enterVehicle(s.car);
          return true;
        }
        if (wantedStars > 0) {
          tell('“I’m afraid we can’t help you while the police are looking for you, sir.”', 3);
          dealershipSalesPitch(s, 'wanted');
          return true;
        }
        openDealerMenu(s);
        return true;
      }
      if (dealershipConcierge()) {
        openDealerMenu(null, 'garage');
        return true;
      }
      return false;
    }
    /* ---- The frame ------------------------------------------------------------------ */
    function updateDealership(deltaSeconds) {
      if (!DEALER.planned) return;
      if (!dealer.loaded) loadDealerGarage();
      updateHypercarVoice(deltaSeconds);
      updateDeliveryReveal(deltaSeconds);
      updateTestDrive();
      dealer.clock -= deltaSeconds;
      const near = onDealerLot(player.x, player.y, 1500);
      if (dealer.clock <= 0) {
        dealer.clock = 2;
        keepOwnedCars();
        if (near || !DEALER.slots.some((s) => s.car)) stockDealership();
      }
      if (!near && dealer.alarmUntil <= gameTime) {
        dealer.shutter = Math.max(0, dealer.shutter - deltaSeconds * 0.1);
        return;
      }
      turnDisplayCars(deltaSeconds);
      watchDealershipHarm(deltaSeconds);
      // The alarm keeps going while the police are on the player; the shutters
      // roll down over eight seconds and back up once it is over.
      if (dealer.alarmUntil > gameTime && wantedStars > 0) dealer.alarmUntil = Math.max(dealer.alarmUntil, gameTime + 20);
      const alarmed = dealer.alarmUntil > gameTime;
      dealer.shutter = clamp(dealer.shutter + (alarmed ? deltaSeconds / 8 : -deltaSeconds / 12), 0, 1);
      updateDealershipSiren(deltaSeconds, alarmed);
      updateDealershipPeople(deltaSeconds);
    }
    // A two-tone electronic alarm bell from the building while it is armed.
    let dealerSiren = null;
    function updateDealershipSiren(deltaSeconds, alarmed) {
      if (!audio || !master) return;
      const on = alarmed && gameMode === 'play' && soundOn;
      if (!dealerSiren) {
        if (!on) return;
        try {
          const o = audio.createOscillator(),
            gain = audio.createGain(),
            filter = audio.createBiquadFilter();
          o.type = 'square';
          filter.type = 'bandpass';
          filter.frequency.value = 1400;
          filter.Q.value = 0.8;
          gain.gain.value = 0;
          o.connect(filter).connect(gain).connect(sirenBus);
          o.start();
          dealerSiren = { o, gain, phase: 0 };
        } catch {
          return;
        }
      }
      dealerSiren.phase += deltaSeconds;
      const H = DEALER.hall,
        d = Math.hypot(player.x - clamp(player.x, H.x, H.x1), player.y - clamp(player.y, H.y, H.y1)),
        level = on ? clamp(1 - d / 1400, 0, 1) * 0.05 : 0,
        hi = Math.floor(dealerSiren.phase * 2.6) % 2;
      dealerSiren.o.frequency.setTargetAtTime(hi ? 1480 : 1110, audio.currentTime, 0.01);
      dealerSiren.gain.gain.setTargetAtTime(level, audio.currentTime, 0.15);
    }
    /* ---- Console (DeadEndCity) ------------------------------------------------------ */
    function dealershipConsole() {
      return {
        // The dealership: plan, stock, owned cars, alarm, the reveal, recent events.
        dealership() {
          return {
            name: DEALER.name,
            planned: DEALER.planned,
            hall: DEALER.hall && { x: DEALER.hall.x, y: DEALER.hall.y, w: DEALER.hall.w, h: DEALER.hall.h },
            lot: DEALER.lot,
            door: DEALER.doorPeople,
            handover: DEALER.handover,
            stage: DEALER.stage,
            viewing: DEALER.viewing,
            panes: DEALER.panes.length,
            broken: DEALER.panes.filter((p) => p.broken).length,
            slots: DEALER.slots.map((s) => ({ id: s.id, type: s.type, where: s.where, x: Math.round(s.x), y: Math.round(s.y), car: s.car ? s.car.id : null, color: s.car?.color || null })),
            owned: dealer.owned.map((r) => ({ id: r.id, type: r.type, paint: r.paint, color: r.color, live: ownedCarLive(r), car: r.car?.id ?? null, x: r.car ? Math.round(r.car.x) : null, y: r.car ? Math.round(r.car.y) : null })),
            alarm: dealer.alarmUntil > gameTime ? { reason: dealer.alarmReason, seconds: Math.round(dealer.alarmUntil - gameTime), shutter: +dealer.shutter.toFixed(2) } : null,
            menu: dealer.menu ? { kind: dealer.menu.kind, type: dealer.menu.type, paint: dealer.menu.paint } : null,
            reveal: dealer.reveal ? { t: +dealer.reveal.t.toFixed(2), type: dealer.reveal.rec.type, curtain: +dealer.reveal.curtain.toFixed(2) } : null,
            test: dealer.test ? { type: dealer.test.type, left: Math.round(dealer.test.until - gameTime) } : null,
            people: dealershipPeopleReport(),
            sold: dealer.sold,
            stolen: dealer.stolen,
            log: dealer.log.slice(-10),
          };
        },
        // The collection: card figures and prices.
        prestigeCatalog: () => PRESTIGE_CATALOG.map((i) => { const f = prestigeFigures(i); return { type: f.type, name: f.name, price: f.price, hp: f.hp, torque: f.torque, zeroTo100: f.zeroTo100, topKmh: f.topKmh, massKg: f.massKg, engine: f.engine, drivetrain: f.drivetrain }; }),
        // Stand in the showroom (`where`: 'door', 'hall', 'hero', 'forecourt', 'stage',
        // 'bays', 'lounge'), looking at it; returns dealership().
        dealershipVisit(where = 'door', zoom) {
          const H = DEALER.hall,
            spots = {
              door: { x: (DEALER.doorPeople.x0 + DEALER.doorPeople.x1) / 2, y: H.y1 + 30 },
              hall: { x: H.x + 300, y: H.y + 250 },
              hero: { x: H.x + 306, y: H.y + 232 },
              forecourt: { x: H.x + 300, y: H.y1 + 150 },
              stage: DEALER.viewing,
              bays: { x: DEALER.lane.x0, y: H.y1 + 110 },
              lounge: { x: H.x + 470, y: H.y + 130 },
              street: { x: H.x + 300, y: DEALER.lot.y + DEALER.lot.h + 60 },
            },
            p = spots[where] || spots.door;
          if (player.car) exitCar();
          teleportPlayer(p.x, p.y);
          cameraTarget.x = p.x;
          cameraTarget.y = p.y;
          if (zoom) {
            setWorldZoom(Number(zoom));
            worldZoom = worldZoomTarget;
          }
          dealer.clock = 0;
          updateDealership(0);
          return this.dealership();
        },
        // Open the purchase card on a car on display (a type, or the nearest), or
        // the garage ('garage'); closeDealer() shuts it.
        dealerMenu(type) {
          if (type === 'garage') return openDealerMenu(null, 'garage');
          const s = DEALER.slots.find((q) => q.type === type && q.where === 'hall') || displayCarNear(player.x, player.y, 400) || DEALER.slots[0];
          if (!displayCarIntact(s.car)) spawnDisplayCar(s);
          return openDealerMenu(s);
        },
        dealerMenuPaint: (i) => (dealerPickPaint(i), dealer.menu?.paint ?? null),
        closeDealer: () => (closeDealerMenu(), gameMode),
        // Buy a car outright (a test of the sale: the cash must be there), with the
        // delivery reveal; `paint` indexes the catalogue's swatches.
        dealerBuy(type = 'wayron', paint = 0) {
          const result = buyPrestigeCar(type, paint);
          if (!result.ok) return result;
          if (dealer.menu) closeDealerMenu();
          startDeliveryReveal(result.rec, null);
          return { ok: true, id: result.rec.id, cash };
        },
        // Sound the alarm as an attack on the lot would.
        dealerAlarm: (reason = 'console') => (dealershipAlarm(reason), { stars: Math.ceil(wantedStars), alarm: dealer.alarmUntil > gameTime }),
        // Break a pane of the frontage (index, or the one nearest the player).
        dealerShatter(index) {
          const pane = DEALER.panes[index] || DEALER.panes.reduce((b, p) => (!b || Math.abs((p.x0 + p.x1) / 2 - player.x) < Math.abs((b.x0 + b.x1) / 2 - player.x) ? p : b), null);
          if (pane) dealershipShatter(pane, 'console');
          return pane ? { id: pane.id, broken: pane.broken } : null;
        },
        // Forget every owned car (the saved garage too).
        dealerResetGarage() {
          for (const rec of dealer.owned) if (rec.car && rec.car !== player.car) {
            const i = vehicles.indexOf(rec.car);
            if (i >= 0) vehicles.splice(i, 1);
          }
          dealer.owned = [];
          saveDealerGarage();
          return dealer.owned.length;
        },
        // End the alarm, raise the shutters, calm the staff (tests).
        dealerCalm() {
          dealer.alarmUntil = 0;
          dealer.shutter = 0;
          for (const s of DEALER.slots) s.hurtReported = false;
          dealershipCalmPeople();
          return true;
        },
      };
    }
