    // HUD panels: prompts, centre cards and toasts, sniper warning, panel covers, updateHud() and the flight HUD.
    /* What the prompt shows, for DeadEndCity.promptState(). */
    function promptReport() {
      return {
        visible: promptView.id !== null,
        text: promptView.id !== null ? promptView.text : '',
        id: promptView.id,
        docked: promptView.docked,
        age: promptView.id !== null ? +(hudNow() - promptView.freshAt).toFixed(2) : 0,
        offered: promptOffer ? promptOffer.text : null,
      };
    }
    /**
     * CENTRE CARDS
     * The headline card (#announcement) and, in touch mode, the toast settle
     * after CARD_SETTLE_AFTER seconds on screen: the headline slides up and
     * shrinks out of the middle, the touch toast dims. WASTED / BUSTED stay
     * put (the round is over). announce() and tell() (game.js) reset them.
     */
    const CARD_SETTLE_AFTER = 3;
    const centreCards = { announceAt: 0, toastAt: 0 };
    function freshAnnouncement() {
      centreCards.announceAt = hudNow();
      getElement('announcement').classList.remove('docked');
    }
    function freshToast() {
      centreCards.toastAt = hudNow();
      getElement('toast').classList.remove('settled');
    }
    function settleCentreCards() {
      const now = hudNow(),
        card = getElement('announcement'),
        toastBox = getElement('toast'),
        roundOver = document.body.classList.contains('wasted') || document.body.classList.contains('busted');
      const settle = card.classList.contains('show') && !roundOver && now - centreCards.announceAt >= CARD_SETTLE_AFTER;
      if (settle && !card.classList.contains('docked')) placeDockLine();
      card.classList.toggle('docked', settle);
      toastBox.classList.toggle(
        'settled',
        toastBox.classList.contains('show') && now - centreCards.toastAt >= CARD_SETTLE_AFTER,
      );
    }
    /**
     * SNIPER WARNING
     * While a rooftop sniper locks on (combat-rules.js sniperThreat), the screen
     * edge toward the shooter glows red, stronger as the lock closes. The
     * direction is taken on screen (the camera is tilted), or on the map without
     * the 3D view. Never shown while the snipers are switched off
     * (swat.js SNIPERS_ENABLED); the police helicopter no longer shoots.
     */
    function updateSniperWarning() {
      const box = getElement('sniperWarning'),
        on = SNIPERS_ENABLED && gameMode === 'play' && gameTime - sniperThreat.at < 0.25 && sniperThreat.aim > 0;
      box.classList.toggle('on', on);
      if (!on) return;
      let dx = sniperThreat.x - player.x,
        dy = sniperThreat.y - player.y;
      if (city3D) {
        const from = city3D.project(player.x, player.y, entityElevation(player) + 20),
          to = city3D.project(sniperThreat.x, sniperThreat.y, sniperThreat.altitude + 20);
        if (Number.isFinite(to.x) && Number.isFinite(to.y) && Math.hypot(to.x - from.x, to.y - from.y) > 1) {
          dx = to.x - from.x;
          dy = to.y - from.y;
        }
      }
      const a = Math.atan2(dy, dx),
        c = Math.cos(a),
        s = Math.sin(a),
        k = 1 / Math.max(Math.abs(c), Math.abs(s));
      box.style.setProperty('--sniper-x', (50 + 50 * c * k).toFixed(1) + '%');
      box.style.setProperty('--sniper-y', (50 + 50 * s * k).toFixed(1) + '%');
      box.style.setProperty('--sniper-aim', (0.35 + 0.65 * sniperThreat.aim).toFixed(2));
    }
    /**
     * PANEL COVER
     * While a full-screen panel is up (pause, settings, the phone call, the
     * sportsbook, the Monarch purchase card, the arsenal, transit, taxi...),
     * body.panel-open hides the floating world HUD: the help toast, the headline
     * card, the district plate, the navigation pill, the story line and the
     * mission pager. A toast raised while the panel is open (a bet settling at
     * the GOALLINE counter) is about the panel, so tell() tags it .over-panel
     * and it stays visible. frame() (game.js) calls this every frame, whatever
     * the mode (rAF runs before paint, so a panel never shows a frame with the
     * hint over it); the sportsbook and the dealer card also call it at once.
     */
    const PANEL_MODES = new Set(['pause', 'settings', 'help', 'missions', 'arsenal', 'dealer', 'transit', 'taxi', 'service', 'demo', 'dialogue', 'elevator']);
    function hudCovered() {
      return PANEL_MODES.has(gameMode) || !!sportsbook.open || mapOpen;
    }
    function syncPanelCover() {
      const covered = hudCovered();
      if (covered !== document.body.classList.contains('panel-open')) document.body.classList.toggle('panel-open', covered);
    }
    /* Called at the end of updateUI(). */
    function updateHud() {
      commitPrompt();
      updateSniperWarning();
      settleCentreCards();
      watchDockLine();
      updateFlightHud();
      watchWeaponBox();
      watchRadioBox();
      updateHudPops();
      renderQuickKeys();
      getElement('bottom').dataset.context = hudContext();
    }
    /**
     * FLIGHT HUD
     * In an aircraft (flightData(), aviation.js) a glass-cockpit HUD frames the
     * aircraft without covering it: an attitude indicator (pitch ladder, bank
     * scale), the airspeed tape with its stall band, and the power lever / engine
     * power, flaps and gear on the left; the altitude tape with the ground band
     * and a vertical-speed scale, AGL, vertical speed and g on the right; a
     * heading strip with the objective's bearing above; and STALL / GEAR / PULL
     * UP warnings under it. The helicopter gets the slim version (no attitude,
     * flaps or gear; ROTOR for power). The instruments are 2D canvases redrawn
     * every frame (updateFlightHud, from the game loop); showing and hiding is a
     * CSS transition on #flightHud.on.
     */
    const FLIGHT_HUD_FONT = "'Helvetica Neue', Arial, Helvetica, sans-serif",
      FH_LINE = '#e9efe6',
      FH_ACCENT = '#7fe3ee',
      FH_GOLD = '#e2c897',
      FH_DANGER = '#f08672',
      FH_PANEL = 'rgba(11, 16, 21, 0.62)';
    const flightHud = {
      root: getElement('flightHud'),
      shown: false,
      canvases: {},
      text: {},
    };
    // Canvases are sized once for the device pixel ratio; drawing is in CSS pixels.
    for (const [key, id, width, height] of [
      ['attitude', 'fhAttitude', 124, 124],
      ['speed', 'fhSpeed', 92, 200],
      ['altitude', 'fhAltitude', 124, 200],
      ['heading', 'fhHeading', 352, 34],
    ]) {
      const canvasElement = getElement(id),
        ratio = Math.min(2, window.devicePixelRatio || 1);
      canvasElement.width = Math.round(width * ratio);
      canvasElement.height = Math.round(height * ratio);
      canvasElement.style.width = width + 'px';
      canvasElement.style.height = height + 'px';
      const context = canvasElement.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      flightHud.canvases[key] = { context, width, height };
    }
    for (const id of ['fhPower', 'fhPowerLabel', 'fhPowerFill', 'fhThrottleMark', 'fhFlaps', 'fhGear', 'fhAgl', 'fhVs', 'fhG', 'fhWarning'])
      flightHud.text[id] = getElement(id);
    function fhSetText(id, value) {
      const el = flightHud.text[id];
      if (el.textContent !== value) el.textContent = value;
    }
    function fhRoundedRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
    /* A vertical tape: `value` at the middle, `scale` pixels per unit, a tick every
       `minor`, a label every `major`; `side` is where the readout points ('right'
       for the airspeed on the left of the screen, 'left' for the altitude). */
    function drawFlightTape(g, w, h, value, scale, minor, major, side, format, bands) {
      g.clearRect(0, 0, w, h);
      g.save();
      fhRoundedRect(g, 0, 0, w, h, 9);
      g.fillStyle = FH_PANEL;
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      g.lineWidth = 1;
      g.stroke();
      g.clip();
      const mid = h / 2,
        edge = side === 'right' ? w : 0,
        dir = side === 'right' ? -1 : 1,
        valueAt = (v) => mid - (v - value) * scale;
      // Coloured bands along the pointer edge (stall, ground).
      for (const band of bands || []) {
        const top = clamp(valueAt(band.to), -10, h + 10),
          bottom = clamp(valueAt(band.from), -10, h + 10);
        if (bottom <= top) continue;
        g.fillStyle = band.color;
        g.fillRect(side === 'right' ? w - band.width : 0, top, band.width, bottom - top);
      }
      const span = h / 2 / scale,
        first = Math.floor((value - span) / minor) * minor;
      g.font = '600 11px ' + FLIGHT_HUD_FONT;
      g.textBaseline = 'middle';
      g.textAlign = side === 'right' ? 'right' : 'left';
      for (let v = first; v <= value + span + minor; v += minor) {
        const y = valueAt(v),
          isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        g.strokeStyle = isMajor ? FH_LINE : 'rgba(233, 239, 230, 0.55)';
        g.lineWidth = isMajor ? 1.4 : 1;
        g.beginPath();
        g.moveTo(edge, y);
        g.lineTo(edge + dir * (isMajor ? 12 : 7), y);
        g.stroke();
        const label = isMajor ? format(v) : '';
        if (label) {
          g.fillStyle = FH_LINE;
          g.fillText(label, edge + dir * 17, y);
        }
      }
      // Fade the ends so the scale reads as a drum.
      const fade = g.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, 'rgba(11, 16, 21, 0.85)');
      fade.addColorStop(0.18, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(0.82, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(1, 'rgba(11, 16, 21, 0.85)');
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
      g.restore();
      // The readout box, pointing at the aircraft.
      const boxW = w - 16,
        boxH = 28,
        boxX = side === 'right' ? 4 : 12,
        tip = side === 'right' ? w : 0;
      g.save();
      g.beginPath();
      if (side === 'right') {
        g.moveTo(boxX, mid - boxH / 2);
        g.lineTo(boxX + boxW - 2, mid - boxH / 2);
        g.lineTo(tip, mid);
        g.lineTo(boxX + boxW - 2, mid + boxH / 2);
        g.lineTo(boxX, mid + boxH / 2);
      } else {
        g.moveTo(boxX + boxW, mid - boxH / 2);
        g.lineTo(boxX + 2, mid - boxH / 2);
        g.lineTo(tip, mid);
        g.lineTo(boxX + 2, mid + boxH / 2);
        g.lineTo(boxX + boxW, mid + boxH / 2);
      }
      g.closePath();
      g.fillStyle = '#081015';
      g.fill();
      g.strokeStyle = FH_ACCENT;
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.font = '700 17px ' + FLIGHT_HUD_FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(format(value, true), boxX + boxW / 2 + (side === 'right' ? -3 : 3), mid + 1);
      g.restore();
    }
    function drawAttitude(g, size, pitchDeg, bankDeg) {
      const r = size / 2,
        pxPerDeg = 2.3;
      g.clearRect(0, 0, size, size);
      g.save();
      g.beginPath();
      g.arc(r, r, r - 1, 0, TAU);
      g.clip();
      g.translate(r, r);
      g.rotate((-bankDeg * Math.PI) / 180);
      const horizon = clamp(pitchDeg, -40, 40) * pxPerDeg;
      const sky = g.createLinearGradient(0, -size, 0, horizon);
      sky.addColorStop(0, '#1f4f7c');
      sky.addColorStop(1, '#6fb3dc');
      g.fillStyle = sky;
      g.fillRect(-size, -size * 1.5, size * 2, size * 1.5 + horizon);
      const ground = g.createLinearGradient(0, horizon, 0, size);
      ground.addColorStop(0, '#8a6139');
      ground.addColorStop(1, '#3a2716');
      g.fillStyle = ground;
      g.fillRect(-size, horizon, size * 2, size * 1.5);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-size, horizon);
      g.lineTo(size, horizon);
      g.stroke();
      // Pitch ladder every 5 degrees, labelled every 10.
      g.font = '700 9px ' + FLIGHT_HUD_FONT;
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.lineWidth = 1.1;
      for (let d = -30; d <= 30; d += 5) {
        if (!d) continue;
        const y = horizon - d * pxPerDeg;
        if (Math.abs(y) > r - 8) continue;
        const half = d % 10 ? 9 : 18;
        g.beginPath();
        g.moveTo(-half, y);
        g.lineTo(half, y);
        g.stroke();
        if (!(d % 10)) {
          g.textAlign = 'right';
          g.fillText(String(Math.abs(d)), -half - 3, y);
          g.textAlign = 'left';
          g.fillText(String(Math.abs(d)), half + 3, y);
        }
      }
      g.restore();
      // Bank scale (fixed) and pointer (turns with the horizon).
      g.save();
      g.translate(r, r);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(0, 0, r - 12, (-150 * Math.PI) / 180, (-30 * Math.PI) / 180);
      g.stroke();
      for (const d of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
        const a = ((d - 90) * Math.PI) / 180,
          long = d % 30 === 0;
        g.beginPath();
        g.moveTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12));
        g.lineTo(Math.cos(a) * (r - (long ? 3 : 7)), Math.sin(a) * (r - (long ? 3 : 7)));
        g.stroke();
      }
      g.rotate((-bankDeg * Math.PI) / 180);
      g.fillStyle = Math.abs(bankDeg) > 45 ? FH_DANGER : FH_GOLD;
      g.beginPath();
      g.moveTo(0, -r + 13);
      g.lineTo(-5, -r + 22);
      g.lineTo(5, -r + 22);
      g.closePath();
      g.fill();
      g.restore();
      // The aircraft symbol, fixed.
      g.save();
      g.translate(r, r);
      g.strokeStyle = '#0b0f12';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const wings = () => {
        g.beginPath();
        g.moveTo(-34, 0);
        g.lineTo(-13, 0);
        g.lineTo(-7, 6);
        g.moveTo(34, 0);
        g.lineTo(13, 0);
        g.lineTo(7, 6);
        g.stroke();
      };
      wings();
      g.strokeStyle = FH_GOLD;
      g.lineWidth = 2.6;
      wings();
      g.fillStyle = FH_GOLD;
      g.beginPath();
      g.arc(0, 0, 2.6, 0, TAU);
      g.fill();
      g.restore();
      g.beginPath();
      g.arc(r, r, r - 1, 0, TAU);
      g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      g.lineWidth = 1.5;
      g.stroke();
    }
    function drawHeadingStrip(g, w, h, heading, bearing) {
      g.clearRect(0, 0, w, h);
      g.save();
      fhRoundedRect(g, 0, 6, w, h - 6, 8);
      g.fillStyle = FH_PANEL;
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.11)';
      g.stroke();
      g.clip();
      const pxPerDeg = 3.1,
        mid = w / 2,
        names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const first = Math.floor((heading - mid / pxPerDeg) / 5) * 5;
      for (let d = first; d <= heading + mid / pxPerDeg + 5; d += 5) {
        const x = mid + (d - heading) * pxPerDeg,
          compass = ((d % 360) + 360) % 360,
          major = compass % 15 === 0;
        g.strokeStyle = major ? FH_LINE : 'rgba(233, 239, 230, 0.5)';
        g.lineWidth = major ? 1.3 : 1;
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x, h - (major ? 8 : 5));
        g.stroke();
        if (compass % 45 === 0 || compass % 30 === 0) {
          const name = names[compass];
          g.font = (name ? '800 12px ' : '600 10px ') + FLIGHT_HUD_FONT;
          g.fillStyle = name ? FH_GOLD : FH_LINE;
          g.fillText(name || String(compass / 10).padStart(2, '0'), x, h - 16);
        }
      }
      // The objective's bearing, a gold marker (clamped to the ends when off-strip).
      if (bearing !== null) {
        const off = ((bearing - heading + 540) % 360) - 180,
          x = clamp(mid + off * pxPerDeg, 8, w - 8);
        g.fillStyle = FH_GOLD;
        g.beginPath();
        g.moveTo(x, h - 3);
        g.lineTo(x - 5, h - 10);
        g.lineTo(x + 5, h - 10);
        g.closePath();
        g.fill();
      }
      const fade = g.createLinearGradient(0, 0, w, 0);
      fade.addColorStop(0, 'rgba(11, 16, 21, 0.9)');
      fade.addColorStop(0.16, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(0.84, 'rgba(11, 16, 21, 0)');
      fade.addColorStop(1, 'rgba(11, 16, 21, 0.9)');
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
      g.restore();
      // Lubber box with the heading.
      g.save();
      fhRoundedRect(g, mid - 25, 0, 50, 21, 5);
      g.fillStyle = '#081015';
      g.fill();
      g.strokeStyle = FH_ACCENT;
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.font = '700 13px ' + FLIGHT_HUD_FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(Math.round(heading) % 360).padStart(3, '0') + '°', mid, 11);
      g.fillStyle = FH_ACCENT;
      g.beginPath();
      g.moveTo(mid, 26);
      g.lineTo(mid - 4, 21);
      g.lineTo(mid + 4, 21);
      g.closePath();
      g.fill();
      g.restore();
    }
    // Altitude tape plus a vertical-speed scale down its right edge (+-10 m/s).
    function drawAltitudeTape(g, w, h, data) {
      const tapeW = w - 14,
        ground = data.altitude - data.agl;
      drawFlightTape(g, tapeW, h, data.altitude, 0.8, 10, 50, 'left', (v, box) => (box || v >= 0 ? String(Math.round(v)) : ''), [
        { from: ground - 400, to: ground, color: 'rgba(160, 110, 60, 0.55)', width: 10 },
      ]);
      g.save();
      const x = tapeW + 4,
        mid = h / 2,
        range = 10,
        pxPer = (h / 2 - 16) / range;
      g.clearRect(tapeW, 0, w - tapeW, h);
      g.strokeStyle = 'rgba(233, 239, 230, 0.5)';
      g.lineWidth = 1;
      for (const v of [-10, -5, 0, 5, 10]) {
        const y = mid - v * pxPer;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (v ? 5 : 9), y);
        g.stroke();
      }
      const vs = clamp(data.vs, -range, range),
        y = mid - vs * pxPer;
      g.strokeStyle = data.vs < -8 && data.agl < 150 ? FH_DANGER : FH_ACCENT;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + 2, mid);
      g.lineTo(x + 2, y);
      g.stroke();
      g.beginPath();
      g.moveTo(x - 1, y);
      g.lineTo(x + 9, y);
      g.stroke();
      g.restore();
    }
    function objectiveBearing() {
      const target = userWaypoint || objective();
      if (!target) return null;
      return (((headingBetween(player, target) * 180) / Math.PI + 90) % 360 + 360) % 360;
    }
    function updateFlightHud() {
      const c = player.car,
        data = (gameMode === 'play' || gameMode === 'pause') && c?.hp > 0 ? flightData(c) : null,
        show = !!data;
      if (show !== flightHud.shown) {
        flightHud.shown = show;
        flightHud.root.classList.toggle('on', show);
        flightHud.root.setAttribute('aria-hidden', String(!show));
      }
      if (!show) return;
      const heli = data.type === 'helicopter';
      // Instruments off: only the warning line below is kept up to date.
      if (hudState.flightHud) drawFlightInstruments(data, heli);
      // One warning at a time, the most urgent first.
      const pullUp = data.agl < 90 && data.vs < -14 && data.agl > 2,
        warning = data.stall
          ? 'STALL'
          : pullUp
            ? 'PULL UP'
            : data.gearWarning
              ? 'GEAR'
              : data.stallWarning
                ? 'STALL WARNING'
                : data.hp < 0.3
                  ? 'ENGINE DAMAGE'
                  : '';
      // On a runway with nothing more urgent: which runway and how much is left.
      const runway = !warning && data.runway ? 'RWY ' + data.runway.designation + ' · ' + data.runway.remaining + ' M LEFT' : '';
      const box = flightHud.text.fhWarning;
      fhSetText('fhWarning', warning || runway);
      box.classList.toggle('show', !!(warning || runway));
      box.classList.toggle('caution', warning === 'STALL WARNING' || warning === 'ENGINE DAMAGE' || !!runway);
    }
    function drawFlightInstruments(data, heli) {
      flightHud.root.classList.toggle('heli', heli);
      const { attitude, speed, altitude, heading } = flightHud.canvases;
      if (!heli) drawAttitude(attitude.context, attitude.width, data.pitch, data.bank);
      drawFlightTape(
        speed.context,
        speed.width,
        speed.height,
        kmhReading(data.airspeed),
        1.5,
        10,
        20,
        'right',
        // No labels below zero on the scale; the readout never shows a negative.
        (v, box) => (box ? String(Math.max(0, Math.round(v))) : v < 0 ? '' : String(Math.round(v))),
        heli
          ? []
          : [
              { from: -100, to: kmhReading(data.stallSpeed), color: 'rgba(240, 134, 114, 0.85)', width: 6 },
              { from: kmhReading(data.stallSpeed), to: kmhReading(data.stallSpeed) * 1.1, color: 'rgba(226, 200, 151, 0.85)', width: 6 },
            ],
      );
      drawAltitudeTape(altitude.context, altitude.width, altitude.height, data);
      drawHeadingStrip(heading.context, heading.width, heading.height, data.heading, objectiveBearing());
      // Power: the fill is the engine, the tick is the lever.
      fhSetText('fhPowerLabel', heli ? 'ROTOR' : 'PWR');
      fhSetText('fhPower', Math.round(data.power * 100) + '%');
      flightHud.text.fhPowerFill.style.width = (data.power * 100).toFixed(1) + '%';
      flightHud.text.fhThrottleMark.style.left = (data.throttle * 100).toFixed(1) + '%';
      fhSetText('fhAgl', Math.round(data.agl) + ' m');
      fhSetText('fhVs', (data.vs >= 0 ? '+' : '−') + Math.abs(data.vs).toFixed(1) + ' m/s');
      fhSetText('fhG', data.g.toFixed(1) + ' g');
      if (!heli) {
        const flapsMoving = Math.abs(data.flapPos - ['UP', '1', '2', 'FULL'].indexOf(data.flaps) / 3) > 0.02,
          flaps = flightHud.text.fhFlaps,
          gear = flightHud.text.fhGear;
        fhSetText('fhFlaps', 'FLAPS ' + data.flaps);
        flaps.classList.toggle('set', data.flaps !== 'UP' && !flapsMoving);
        flaps.classList.toggle('moving', flapsMoving);
        fhSetText('fhGear', data.gear === 'DOWN' ? 'GEAR ▼' : data.gear === 'UP' ? 'GEAR ▲' : 'GEAR ···');
        gear.classList.toggle('set', data.gear === 'DOWN');
        gear.classList.toggle('moving', data.gear === 'TRANSIT' && !data.gearWarning);
        gear.classList.toggle('alert', data.gearWarning);
      }
    }
    /**
     * TITLE MENU
     */
    const titleItems = () => [...getElement('menu').querySelectorAll('.menu-item')];
    let newGameArmedUntil = 0;
    function hasSavedStory() {
      return completed > 0 || missionIndex > 0;
    }
    function updateTitleMenu() {
      const saved = hasSavedStory(),
        next = missions[Math.min(missionIndex, missions.length - 1)];
      getElement('startBtn').querySelector('.menu-label').textContent = saved ? 'CONTINUE' : 'ENTER THE CITY';
      getElement('startMeta').textContent = saved
        ? demoStoryOver()
          ? 'DEMO COMPLETE · FREE ROAM'
          : missionIndex >= missions.length
            ? 'FREE ROAM'
            : (missionIndex >= SIDE_JOB_FIRST ? 'CONTRACT ' + (missionIndex + 1 - SIDE_JOB_FIRST) : 'MISSION ' + String(missionIndex + 1).padStart(2, '0')) +
              (next ? ' · ' + next.title.toUpperCase() : '')
        : 'NEW STORY';
      getElement('startBtn').dataset.caption = saved
        ? 'Pick up where you left off: $' + Math.floor(cash).toLocaleString() + ' in your pocket, ' +
          (DEMO_BUILD
            ? Math.min(completed, DEMO_MISSIONS) + ' of ' + DEMO_MISSIONS + ' demo missions done.'
            : completed + ' of ' + missions.length + ' jobs done.')
        : 'Take the wheel. Work the payphones. Keep one step ahead of the law.';
      getElement('newGameMeta').textContent = saved ? 'ERASES PROGRESS' : '';
      getElement('chooseMeta').textContent = DEMO_BUILD
        ? Math.min(completed, DEMO_MISSIONS) + ' / ' + DEMO_MISSIONS + ' · DEMO'
        : completed + ' / ' + missions.length;
      getElement('menuVersion').textContent = 'VERSION ' + GAME_VERSION + ' · AN ORIGINAL TOP-DOWN CRIME GAME';
      // PUBLIC DEMO (campaign.js): the badge beside the version.
      getElement('menuDemoBadge').classList.toggle('hidden', !DEMO_BUILD);
      getElement('menuDemoBadge').textContent = demoCompleted ? 'DEMO · COMPLETED' : 'DEMO';
      const focused = document.activeElement?.classList?.contains('menu-item') ? document.activeElement : null;
      // The title menu opens with its first item selected, so Enter plays.
      if (!focused && gameMode === 'menu') getElement('startBtn').focus({ preventScroll: true });
      showTitleCaption(focused || getElement('startBtn'));
    }
    function showTitleCaption(item) {
      getElement('menuCaption').textContent = item?.dataset.caption || '';
    }
    for (const item of titleItems()) {
      item.addEventListener('focus', () => showTitleCaption(item));
      item.addEventListener('pointerenter', () => {
        if (gameMode === 'menu') item.focus({ preventScroll: true });
      });
    }
    // NEW GAME over a saved story asks for a second press.
    getElement('newGameStart').onclick = () => {
      if (hasSavedStory() && performance.now() > newGameArmedUntil) {
        newGameArmedUntil = performance.now() + 4000;
        getElement('newGameMeta').textContent = 'PRESS AGAIN TO ERASE';
        getElement('newGameStart').classList.add('armed');
        setTimeout(() => {
          getElement('newGameStart').classList.remove('armed');
          if (gameMode === 'menu') updateTitleMenu();
        }, 4000);
        return;
      }
      newGameArmedUntil = 0;
      getElement('newGameStart').classList.remove('armed');
      getElement('menu').classList.add('hidden');
      newGame();
    };
    let creditsOpener = null;
    function openCredits(opener) {
      creditsOpener = opener;
      getElement('credits').classList.remove('hidden');
      getElement('closeCredits').focus();
    }
    getElement('creditsMenuBtn').onclick = () => openCredits(getElement('creditsMenuBtn'));
    /* Up/down through the buttons of the title menu or the pause menu. */
    function menuArrowKey(e) {
      const root = gameMode === 'menu' ? getElement('menu') : getElement('pauseMenu'),
        items =
          gameMode === 'menu'
            ? titleItems()
            : [...root.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      if (!items.length || !getElement('credits').classList.contains('hidden')) return false;
      e.preventDefault();
      const at = items.indexOf(document.activeElement),
        step = e.code === 'ArrowDown' ? 1 : -1;
      items[at < 0 ? 0 : (at + step + items.length) % items.length].focus();
      return true;
    }
