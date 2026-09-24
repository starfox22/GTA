    // BEGIN SUBSYSTEM: src/casino.js — Casino roulette
    /**
     * Casino roulette
     * Source: src/casino.js
     * Scope: shared game closure.
     * Business layout, stakes, result settlement, roulette UI and saved cash.
     */
    const CASINO = {
      id: 'golden-tide',
      kind: 'casino',
      name: 'GOLDEN TIDE CASINO',
      bx: -5,
      by: 5,
      x: -2343,
      y: 2790,
      w: 320,
      h: 240,
      height: 84,
      color: '#edc887',
      symbol: 'CAS',
      door: {
        x: -2183,
        y: 3055,
      },
    };
    PLACES.push(CASINO);
    const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]),
      ROULETTE_ORDER = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
        31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
      ];
    let casinoBet = 'red',
      casinoNumber = 7,
      casinoRound = null,
      casinoAngle = 0,
      casinoResult = 'Choose your bet, then spin.';
    function visibleCash() {
      return cash - (casinoRound?.returned || 0);
    }
    function rouletteColor(number) {
      return number === 0 ? 'green' : ROULETTE_RED.has(number) ? 'red' : 'black';
    }
    function rouletteReturn(number, bet, picked, stake) {
      return (bet === 'number' ? number === picked : rouletteColor(number) === bet)
        ? stake * (bet === 'number' ? 36 : 2)
        : 0;
    }
    function rouletteDraw() {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const data = new Uint32Array(1),
          limit = Math.floor(4294967296 / 37) * 37;
        do {
          crypto.getRandomValues(data);
        } while (data[0] >= limit);
        return data[0] % 37;
      }
      return Math.floor(Math.random() * 37);
    }
    function drawRoulette() {
      const cv = getElement('rouletteWheel'),
        drawingContext = cv.getContext('2d'),
        r = 111,
        c = 140,
        angle = casinoAngle;
      drawingContext.clearRect(0, 0, 280, 280);
      drawingContext.save();
      drawingContext.translate(c, c);
      drawingContext.rotate(angle);
      for (let i = 0; i < 37; i++) {
        const a = (i * TAU) / 37,
          b = ((i + 1) * TAU) / 37,
          n = ROULETTE_ORDER[i];
        drawingContext.fillStyle =
          rouletteColor(n) === 'red' ? '#ab3949' : n === 0 ? '#368570' : '#182932';
        drawingContext.beginPath();
        drawingContext.moveTo(0, 0);
        drawingContext.arc(0, 0, r, a, b);
        drawingContext.closePath();
        drawingContext.fill();
        drawingContext.strokeStyle = '#bd98674d';
        drawingContext.lineWidth = 1;
        drawingContext.stroke();
        drawingContext.save();
        drawingContext.rotate((a + b) / 2);
        drawingContext.fillStyle = '#fff0d3';
        drawingContext.font = 'bold 11px Arial';
        drawingContext.textAlign = 'center';
        drawingContext.fillText(String(n), 92, 4);
        drawingContext.restore();
      }
      drawingContext.fillStyle = '#ac8855';
      drawingContext.beginPath();
      drawingContext.arc(0, 0, 66, 0, TAU);
      drawingContext.fill();
      drawingContext.fillStyle = '#1c403b';
      drawingContext.beginPath();
      drawingContext.arc(0, 0, 60, 0, TAU);
      drawingContext.fill();
      drawingContext.restore();
      drawingContext.strokeStyle = '#e6bf7d';
      drawingContext.lineWidth = 7;
      drawingContext.beginPath();
      drawingContext.arc(c, c, r + 5, 0, TAU);
      drawingContext.stroke();
      drawingContext.fillStyle = '#ffefc8';
      drawingContext.beginPath();
      drawingContext.moveTo(133, 12);
      drawingContext.lineTo(147, 12);
      drawingContext.lineTo(140, 30);
      drawingContext.closePath();
      drawingContext.fill();
      drawingContext.fillStyle = '#f6dfad';
      drawingContext.textAlign = 'center';
      drawingContext.font = 'bold 15px Georgia';
      drawingContext.fillText('GOLDEN TIDE', 140, 137);
      drawingContext.font = '11px Arial';
      drawingContext.fillText('ROULETTE', 140, 155);
    }
    function renderCasino() {
      const active = !!casinoRound;
      getElement('serviceClock').textContent =
        'DAY ' +
        (Math.floor(worldMinutes / 1440) + 1) +
        ' · ' +
        clockText() +
        ' · $' +
        Math.floor(visibleCash()).toLocaleString();
      getElement('casinoTable').classList.remove('hidden');
      getElement('casinoResult').textContent = active ? 'Ball in play…' : casinoResult;
      getElement('casinoBalance').textContent = '$' + Math.floor(visibleCash()).toLocaleString();
      getElement('casinoSpin').disabled = active || cash < 10;
      getElement('casinoStake').disabled = active;
      for (const bet of ['red', 'black', 'number']) {
        getElement('bet' + bet).classList.toggle('selected', casinoBet === bet);
        getElement('bet' + bet).disabled = active;
      }
      getElement('casinoNumbers').classList.toggle('hidden', casinoBet !== 'number');
      const list = getElement('casinoNumbers');
      list.replaceChildren();
      for (let n = 0; n <= 36; n++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'roulette-number ' + rouletteColor(n) + (n === casinoNumber ? ' selected' : '');
        b.textContent = String(n);
        b.disabled = active;
        b.onclick = () => {
          if (!casinoRound) {
            casinoNumber = n;
            renderCasino();
          }
        };
        list.appendChild(b);
      }
      drawRoulette();
    }
    function spinCasino() {
      if (gameMode !== 'service' || servicePlace?.kind !== 'casino' || casinoRound) return false;
      if (wantedStars > 0) return needToLosePolice();
      const stake = Number(getElement('casinoStake').value);
      if (!Number.isInteger(stake) || stake < 10 || stake > 5000 || stake > cash) {
        casinoResult = 'Choose a whole-dollar bet from $10 to $5,000 within your balance.';
        renderCasino();
        return false;
      }
      const number = rouletteDraw(),
        returned = rouletteReturn(number, casinoBet, casinoNumber, stake),
        index = ROULETTE_ORDER.indexOf(number),
        target = -Math.PI / 2 - ((index + 0.5) * TAU) / 37,
        start = casinoAngle,
        end = start + TAU * 5 + ((((target - start) % TAU) + TAU) % TAU);
      casinoRound = {
        number,
        stake,
        returned,
        remaining: 4,
        duration: 4,
        start,
        end,
      };
      cash = clamp(cash - stake + returned, 0, 99999999);
      save();
      renderCasino();
      updateUI();
      tone(520, 0.06, 0.08);
      return true;
    }
    function updateCasino(deltaSeconds) {
      if (!casinoRound) return;
      const r = casinoRound;
      r.remaining = Math.max(0, r.remaining - deltaSeconds);
      const p = 1 - r.remaining / r.duration;
      casinoAngle = r.start + (r.end - r.start) * (1 - (1 - p) ** 4);
      if (servicePlace?.kind === 'casino') drawRoulette();
      if (r.remaining === 0) {
        casinoAngle = r.end % TAU;
        casinoResult =
          r.number +
          ' · ' +
          rouletteColor(r.number).toUpperCase() +
          ' — ' +
          (r.returned
            ? 'Returned $' +
              r.returned.toLocaleString() +
              ' · profit $' +
              (r.returned - r.stake).toLocaleString()
            : 'Lost $' + r.stake.toLocaleString());
        casinoRound = null;
        if (servicePlace?.kind === 'casino') renderCasino();
        else tell('GOLDEN TIDE · ' + casinoResult, 5);
        tone(r.returned ? 720 : 190, 0.16, 0.1);
        updateUI();
      }
    }
    function paintCasinoGround(drawingContext) {
      const p = CASINO;
      drawingContext.save();
      drawingContext.fillStyle = '#aea38d';
      drawingContext.fillRect(p.x - 10, p.y + p.h, p.w + 20, 108);
      strokeRoad(
        drawingContext,
        [
          [-2183, 3060],
          [-2183, 3200],
        ],
        44,
        '#56666a',
      );
      drawingContext.fillStyle = '#243b3e';
      for (const side of [-1, 1])
        drawingContext.fillRect(p.door.x + side * 94 - 20, p.y + p.h + 35, 40, 48);
      drawingContext.strokeStyle = '#ddc08e';
      drawingContext.lineWidth = 2;
      drawingContext.strokeRect(p.x + 15, p.y + p.h + 14, p.w - 30, 82);
      drawingContext.fillStyle = '#e7d3a6';
      drawingContext.font = 'bold 12px Arial';
      drawingContext.textAlign = 'center';
      drawingContext.fillText('GOLDEN TIDE · VALET', p.door.x, 3136);
      drawingContext.restore();
    }
    function populateCasino() {
      for (let i = 0; i < 10; i++) {
        const x = CASINO.x + 20 + (i % 5) * 65,
          y = CASINO.y + CASINO.h + 24 + Math.floor(i / 5) * 58;
        if (!solid(x, y, 8))
          pedestrians.push({
            x,
            y,
            a: i % 2 ? 0 : Math.PI,
            hp: 30,
            color: randomChoice(['#c9a783', '#b0bac2', '#ac697c', '#e0d5b4']),
            flee: 0,
            timer: randomBetween(2, 7),
            walk: 0,
          });
      }
      if (canSpawnCar('taxi', 5045, 3140, 0, 6)) makeCar('taxi', 5045, 3140, 0, false);
    }
    for (const bet of ['red', 'black', 'number'])
      getElement('bet' + bet).onclick = () => {
        if (!casinoRound) {
          casinoBet = bet;
          renderCasino();
        }
      };
    getElement('casinoSpin').onclick = spinCasino;
    // END SUBSYSTEM: src/casino.js
