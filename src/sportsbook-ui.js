    // BEGIN SUBSYSTEM: src/sportsbook-ui.js — The betting menu
    /**
     * The betting menu
     * Source: src/sportsbook-ui.js
     * Scope: shared game closure (after sportsbook.js).
     *
     * GOALLINE's sportsbook screen (`#sportsbook` in shell.html, SPORTSBOOK
     * stylesheet section): the match header (both crests in the clubs'
     * colours, the live score and clock with a pulsing LIVE badge, or the
     * kick-off countdown before the match), the MARKETS tab (every market as
     * a card of price buttons that flash up or down as they move, SUSPENDED
     * over a goal) and MY BETS (open bets with their potential return, then
     * the settled ones), and the bet slip: the pick, the stake (typed, quick
     * chips $10 / $50 / $100 / $500 / MAX, a slider over the cash in hand),
     * the potential return, the reason a bet cannot go on, and PLACE BET with
     * a stamp when it is accepted. Odds show decimal, fractional or American
     * (F, saved with the bets).
     *
     * Keys (sportsbookKey): arrows move between prices, Enter picks one (and
     * places the bet once the slip holds one), + / - step the stake, P places,
     * M switches MARKETS / MY BETS, F the odds format, Esc or the action key
     * leaves. Mouse and touch use the same buttons. The world keeps running.
     */
    const sportsbookUi = {
      structure: '',
      header: '',
      slip: '',
      bets: '',
      previous: new Map(), // "market|key" -> { odds, moved: +1/-1, until }
      stampUntil: 0,
      error: '',
      errorUntil: 0,
      crests: '',
    };
    function openSportsbook() {
      if (sportsbook.open) return;
      if (wantedStars > 0) {
        needToLosePolice();
        return;
      }
      sportsbook.open = true;
      keys = {};
      mouse.down = false;
      sportsbook.tab = 'markets';
      sportsbook.stake = clamp(Math.floor(sportsbook.stake) || 10, 1, Math.max(1, Math.floor(cash)));
      sportsbookUi.structure = sportsbookUi.header = sportsbookUi.slip = sportsbookUi.bets = sportsbookUi.crests = '';
      getElement('sportsbook').classList.remove('hidden');
      document.body.classList.add('sportsbook-open');
      syncPanelCover();
      renderSportsbook();
      tone(660, 0.05, 0.05);
      // Focus the first price, so the arrows work at once.
      const first = getElement('sbMarkets').querySelector('.sb-odd:not([disabled])');
      (first || getElement('sbClose')).focus();
    }
    function closeSportsbook() {
      if (!sportsbook.open) return;
      sportsbook.open = false;
      getElement('sportsbook').classList.add('hidden');
      document.body.classList.remove('sportsbook-open');
      syncPanelCover();
      keys = {};
      canvas.focus();
    }
    function sportsbookSetTab(tab) {
      sportsbook.tab = tab;
      renderSportsbook();
    }
    function sportsbookCycleFormat(format) {
      const order = ['decimal', 'fractional', 'american'];
      sportsbook.format = format || order[(order.indexOf(sportsbook.format) + 1) % order.length];
      sportsbookUi.structure = '';
      renderSportsbook();
      save();
    }
    function sportsbookPick(marketId, key) {
      sportsbook.selection = { marketId, key };
      sportsbookUi.error = '';
      renderSportsbook();
      tone(760, 0.04, 0.05);
    }
    function sportsbookSetStake(value) {
      const top = Math.max(1, Math.floor(cash));
      sportsbook.stake = clamp(Math.floor(Number(value) || 0), 0, 99999999);
      if (sportsbook.stake > top) sportsbook.stake = top;
      renderSportsbook();
    }
    function sportsbookStepStake(direction) {
      const ladder = [1, 2, 5, 10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 25000, 50000, 100000],
        stake = sportsbook.stake || 0,
        next = direction > 0 ? ladder.find((v) => v > stake) || stake * 2 : [...ladder].reverse().find((v) => v < stake) || 1;
      sportsbookSetStake(next);
    }
    function sportsbookFlashError(text) {
      sportsbookUi.error = text;
      sportsbookUi.errorUntil = gameTime + 3;
      tone(190, 0.08, 0.07, 'square');
    }
    function sportsbookPlaceFromSlip() {
      const pick = sportsbook.selection;
      if (!pick) return sportsbookFlashError('PICK A PRICE FIRST');
      const bet = sportsbookPlace(pick.marketId, pick.key, sportsbook.stake);
      if (bet.error) {
        sportsbookFlashError(bet.error);
        renderSportsbook();
        return;
      }
      sportsbookUi.stampUntil = gameTime + 1.6;
      sportsbookUi.stampText = 'BET #' + bet.id + ' PLACED';
      sportsbook.selection = null;
      sportsbook.stake = clamp(sportsbook.stake, 1, Math.max(1, Math.floor(cash)));
      const stamp = getElement('sbStamp');
      stamp.textContent = sportsbookUi.stampText;
      stamp.classList.remove('show');
      void stamp.offsetWidth;
      stamp.classList.add('show');
      getElement('sbTabBets').classList.remove('bump');
      void getElement('sbTabBets').offsetWidth;
      getElement('sbTabBets').classList.add('bump');
      tone(520, 0.06, 0.08);
      tone(1040, 0.12, 0.06);
      renderSportsbook();
    }

    /* ---- RENDER ------------------------------------------------------- */
    function sportsbookEscape(text) {
      return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    }
    function sportsbookOdds(odds) {
      return sportsbookFormatOdds(odds, sportsbook.format);
    }
    function sportsbookHeaderInfo(match) {
      const calendar = match.calendar,
        stage = match.stage;
      if (match.abandoned) return { badge: 'OFF', clock: 'ABANDONED', note: 'ALL BETS ON THIS MATCH ARE VOID' };
      if (stage === 'live') return { badge: 'LIVE', clock: sportsBoardClock(match), note: calendar.periodNames[match.period] };
      if (stage === 'break') return { badge: 'LIVE', clock: 'HT', note: 'HALF TIME · SECOND HALF IN ' + Math.ceil(match.remaining) + 's' };
      if (stage === 'fulltime' || stage === 'over') return { badge: 'FT', clock: 'FT', note: 'FULL TIME · BETS SETTLED' };
      const minutes = Math.max(0, match.fixture.kickoff - worldMinutes),
        hours = Math.floor(minutes / 60),
        rest = Math.floor(minutes % 60),
        countdown = hours ? hours + 'H ' + String(rest).padStart(2, '0') + 'M' : rest + 'M ' + String(Math.floor((minutes % 1) * 60)).padStart(2, '0') + 'S';
      return {
        badge: 'PRE',
        clock: sportsKickoffText(match.fixture.kickoff),
        note: (stage === 'warmup' ? 'WARM-UP · ' : 'NEXT MATCH · ') + 'KICK-OFF IN ' + countdown,
      };
    }
    function paintSportsbookCrest(id, team) {
      const cv = getElement(id),
        g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      drawSportsCrest(g, team, cv.width / 2, cv.height / 2, cv.height * 0.86);
    }
    function renderSportsbookHeader(match) {
      const [home, away] = match.teams,
        info = sportsbookHeaderInfo(match),
        crests = match.fixture.id;
      if (sportsbookUi.crests !== crests) {
        sportsbookUi.crests = crests;
        paintSportsbookCrest('sbCrestHome', home);
        paintSportsbookCrest('sbCrestAway', away);
        getElement('sbHomeName').textContent = home.name;
        getElement('sbAwayName').textContent = away.name;
        const hero = getElement('sbMatch');
        hero.style.setProperty('--home', match.kits[0].primary);
        hero.style.setProperty('--away', match.kits[1].primary);
        getElement('sbLeague').textContent = match.venue.league + ' · SOUTH COAST STADIUM · DAY ' + (match.fixture.day + 1);
      }
      const pre = info.badge === 'PRE',
        key = [info.badge, info.clock, info.note, match.scores.join(':'), match.status, Math.floor(match.clock), sportsbook.suspended].join('|');
      if (key === sportsbookUi.header) return;
      sportsbookUi.header = key;
      getElement('sbScore').textContent = pre ? 'v' : match.scores[0] + ' – ' + match.scores[1];
      getElement('sbScore').classList.toggle('pre', pre);
      getElement('sbClock').textContent = info.clock;
      const badge = getElement('sbBadge');
      badge.textContent = info.badge === 'PRE' ? 'PRE-MATCH' : info.badge === 'OFF' ? 'OFF' : info.badge === 'FT' ? 'FULL TIME' : 'LIVE';
      badge.dataset.state = info.badge.toLowerCase();
      getElement('sbNote').textContent = info.note;
      getElement('sbStatus').textContent = sportsbook.suspended ? 'MARKETS SUSPENDED' : match.stage === 'live' ? match.status : '';
      getElement('sbStatus').classList.toggle('alert', !!sportsbook.suspended);
      getElement('sbProgress').style.width = (Math.max(0, Math.min(90, match.clock)) / 90) * 100 + '%';
    }
    // A market's card: its price buttons, in columns.
    function sportsbookMarketCard(market) {
      const outcomes = market.outcomes,
        cols = market.kind === 'cs' ? 3 : outcomes.length;
      let body = '';
      const button = (o) =>
        '<button type="button" class="sb-odd" data-market="' + market.id + '" data-key="' + o.key + '"' + (o.odds ? '' : ' disabled') + '><span>' +
        sportsbookEscape(o.label) + '</span><b></b><i aria-hidden="true"></i></button>';
      if (market.kind === 'cs') {
        const columns = [[], [], []];
        let other = null;
        for (const o of outcomes) {
          if (o.key === 'other') {
            other = o;
            continue;
          }
          const [x, y] = o.key.split('-').map(Number);
          columns[x > y ? 0 : x === y ? 1 : 2].push(o);
        }
        body = '<div class="sb-cs">' + columns.map((c) => '<div>' + c.map(button).join('') + '</div>').join('') + '</div>' + (other ? '<div class="sb-outcomes cols-1">' + button(other) + '</div>' : '');
      } else body = '<div class="sb-outcomes cols-' + cols + '">' + outcomes.map(button).join('') + '</div>';
      const subtitle = market.kind === 'next' ? 'GOAL ' + market.goal : market.kind === 'result' ? '90 MINUTES' : market.kind === 'ht' ? 'FIRST 45' : market.kind === 'cs' ? 'FULL TIME' : '';
      return (
        '<section class="sb-market" data-kind="' + market.kind + '" data-id="' + market.id + '"><header><b>' + sportsbookEscape(market.title) + '</b>' +
        (subtitle ? '<small>' + subtitle + '</small>' : '') + '</header>' + body + '<div class="sb-suspended">SUSPENDED</div></section>'
      );
    }
    // The totals lines shown: the one nearest even money and a line either side.
    function sportsbookShownMarkets(markets) {
      const totals = markets.filter((m) => m.kind === 'total' && !m.closed);
      let main = 0,
        best = 9;
      totals.forEach((m, i) => {
        const gap = Math.abs(m.outcomes[0].p - 0.5);
        if (gap < best) [best, main] = [gap, i];
      });
      const keep = new Set(totals.slice(Math.max(0, main - 1), Math.max(0, main - 1) + 3));
      // Keep a line a bet is sitting on in the slip.
      const picked = sportsbook.selection && markets.find((m) => m.id === sportsbook.selection.marketId);
      if (picked?.kind === 'total') keep.add(picked);
      const order = { result: 0, next: 1, total: 2, btts: 3, ht: 4, cs: 5 };
      return markets.filter((m) => m.kind !== 'total' || keep.has(m)).sort((a, b) => order[a.kind] - order[b.kind]);
    }
    function renderSportsbookMarkets(match) {
      const list = getElement('sbMarkets'),
        markets = sportsbookShownMarkets(sportsbook.markets),
        suspended = sportsbook.suspended,
        structure = [sportsbook.format, match.fixture.id, markets.map((m) => m.id + ':' + m.outcomes.map((o) => o.key + (o.odds ? '' : '-')).join(',')).join(';')].join('|');
      if (structure !== sportsbookUi.structure) {
        sportsbookUi.structure = structure;
        const focused = document.activeElement?.classList?.contains('sb-odd') ? document.activeElement.dataset.market + '|' + document.activeElement.dataset.key : null;
        list.innerHTML = markets.length
          ? markets.map(sportsbookMarketCard).join('')
          : '<p class="sb-empty">' + (match.abandoned ? 'Match abandoned. Every bet on it is void and the stakes are back in your pocket.' : 'Full time. The next fixture’s prices go up shortly.') + '</p>';
        for (const b of list.querySelectorAll('.sb-odd')) b.onclick = () => sportsbookPick(b.dataset.market, b.dataset.key);
        if (focused) {
          const [m, k] = focused.split('|');
          list.querySelector('.sb-odd[data-market="' + m + '"][data-key="' + k + '"]')?.focus();
        }
      }
      list.classList.toggle('suspended', !!suspended);
      const now = gameTime;
      for (const market of markets)
        for (const o of market.outcomes) {
          const b = list.querySelector('.sb-odd[data-market="' + market.id + '"][data-key="' + o.key + '"]');
          if (!b) continue;
          const id = market.id + '|' + o.key,
            before = sportsbookUi.previous.get(id);
          if (before && o.odds && before.odds && o.odds !== before.odds) {
            before.moved = o.odds > before.odds ? 1 : -1;
            before.until = now + 2.5;
          }
          const entry = before || { moved: 0, until: 0 };
          entry.odds = o.odds;
          sportsbookUi.previous.set(id, entry);
          const text = sportsbookOdds(o.odds);
          if (b.children[1].textContent !== text) b.children[1].textContent = text;
          const moved = entry.until > now ? entry.moved : 0;
          b.classList.toggle('up', moved > 0);
          b.classList.toggle('down', moved < 0);
          b.children[2].textContent = moved > 0 ? '▲' : moved < 0 ? '▼' : '';
          const selected = sportsbook.selection && sportsbook.selection.marketId === market.id && sportsbook.selection.key === o.key;
          b.classList.toggle('selected', !!selected);
          b.setAttribute('aria-pressed', selected ? 'true' : 'false');
          b.disabled = !o.odds || !!suspended;
        }
    }
    function sportsbookBetCard(bet) {
      const open = bet.status === 'open',
        returns = open ? Math.round(bet.stake * bet.odds) : bet.payout,
        verdict = open ? 'OPEN' : bet.status === 'won' ? 'WON' : bet.status === 'lost' ? 'LOST' : 'VOID';
      return (
        '<article class="sb-bet" data-status="' + bet.status + '"><header><span class="sb-bet-state">' + verdict + '</span><b>' + sportsbookEscape(bet.label) +
        '</b><em>' + sportsbookOdds(bet.odds) + '</em></header><p>' + sportsbookEscape(bet.title) + ' · ' + bet.teams.join(' v ') + '</p><footer><span>#' + bet.id + ' · ' +
        bet.placedAt + ' at ' + bet.placedScore + '</span><span>STAKE ' + sportsbookMoney(bet.stake) + '</span><strong>' +
        (open ? 'TO RETURN ' + sportsbookMoney(returns) : bet.status === 'lost' ? '−' + sportsbookMoney(bet.stake) : '+' + sportsbookMoney(returns)) + '</strong></footer>' +
        (bet.result ? '<small>' + sportsbookEscape(bet.result) + '</small>' : '') + '</article>'
      );
    }
    function renderSportsbookBets() {
      const bets = sportsbook.bets,
        open = bets.filter((b) => b.status === 'open'),
        settled = bets.filter((b) => b.status !== 'open').reverse(),
        s = sportsbook.stats,
        key = [sportsbook.format, bets.map((b) => b.id + b.status).join(','), s.returned].join('|');
      if (key === sportsbookUi.bets) return;
      sportsbookUi.bets = key;
      const net = s.returned - s.staked;
      getElement('sbBets').innerHTML =
        '<div class="sb-summary"><span>OPEN <b>' + open.length + '</b></span><span>STAKED <b>' + sportsbookMoney(s.staked) + '</b></span><span>RETURNED <b>' +
        sportsbookMoney(s.returned) + '</b></span><span class="' + (net >= 0 ? 'plus' : 'minus') + '">P/L <b>' + (net >= 0 ? '+' : '−') + sportsbookMoney(Math.abs(net)) + '</b></span></div>' +
        (open.length ? '<h3>OPEN BETS</h3>' + open.map(sportsbookBetCard).join('') : '') +
        (settled.length ? '<h3>SETTLED</h3>' + settled.map(sportsbookBetCard).join('') : '') +
        (bets.length ? '' : '<p class="sb-empty">No bets yet. Pick a price on the MARKETS tab.</p>');
    }
    function renderSportsbookSlip() {
      const pick = sportsbook.selection,
        found = pick && sportsbookFindOutcome(pick.marketId, pick.key),
        outcome = found?.outcome,
        top = Math.max(0, Math.floor(cash)),
        stake = sportsbook.stake,
        odds = outcome?.odds || 0,
        suspended = sportsbook.suspended;
      if (pick && !outcome) sportsbook.selection = null;
      let reason = '';
      if (!sportsbook.selection) reason = 'PICK A PRICE';
      else if (suspended) reason = 'SUSPENDED · WAIT FOR THE RESTART';
      else if (!odds) reason = 'MARKET CLOSED';
      else if (top < 1) reason = 'YOU’RE BROKE';
      else if (!(stake >= 1)) reason = 'MINIMUM STAKE $1';
      else if (stake > top) reason = 'NOT ENOUGH CASH';
      const error = gameTime < sportsbookUi.errorUntil ? sportsbookUi.error : '',
        key = [pick?.marketId, pick?.key, odds, stake, top, reason, error, sportsbook.format].join('|');
      if (key === sportsbookUi.slip) return;
      sportsbookUi.slip = key;
      const slip = getElement('sbSlip');
      slip.classList.toggle('empty', !sportsbook.selection);
      if (sportsbook.selection && outcome) {
        getElement('sbPickMarket').textContent = found.market.title + (found.market.kind === 'next' ? ' · GOAL ' + found.market.goal : '');
        getElement('sbPickLabel').textContent = outcome.label;
        getElement('sbPickOdds').textContent = sportsbookOdds(odds);
      }
      const input = getElement('sbStake');
      if (document.activeElement !== input) input.value = stake ? String(stake) : '';
      input.max = String(Math.max(1, top));
      const slider = getElement('sbSlider');
      // The slider runs over the cash on a log scale (small stakes get room).
      slider.value = String(top > 1 ? Math.round((Math.log(Math.max(1, Math.min(stake, top))) / Math.log(top)) * 1000) : 0);
      slider.disabled = top <= 1;
      slider.style.setProperty('--fill', slider.value / 10 + '%');
      for (const chip of getElement('sbChips').children) chip.classList.toggle('on', chip.dataset.chip === 'max' ? stake === top && top > 0 : Number(chip.dataset.chip) === stake);
      const returns = odds && stake >= 1 ? Math.round(stake * odds) : 0;
      getElement('sbReturn').textContent = sportsbookMoney(returns);
      getElement('sbProfit').textContent = returns ? 'PROFIT ' + sportsbookMoney(returns - stake) : '';
      getElement('sbSlipError').textContent = error || (reason && sportsbook.selection ? reason : '');
      const place = getElement('sbPlace');
      place.disabled = !!reason;
      place.textContent = reason && !sportsbook.selection ? 'PICK A PRICE' : 'PLACE BET · ' + sportsbookMoney(Math.max(0, Math.min(stake, top)));
    }
    function renderSportsbook() {
      if (!sportsbook.open) return;
      const match = sportsbookMatch();
      if (!match) return;
      sportsbookRefreshMarkets();
      sportsbook.suspended = sportsbookSuspended(match);
      getElement('sbCash').textContent = sportsbookMoney(Math.floor(cash));
      renderSportsbookHeader(match);
      const markets = sportsbook.tab === 'markets';
      getElement('sbTabMarkets').setAttribute('aria-selected', markets ? 'true' : 'false');
      getElement('sbTabBets').setAttribute('aria-selected', markets ? 'false' : 'true');
      const open = sportsbook.bets.filter((b) => b.status === 'open').length;
      getElement('sbOpenCount').textContent = open ? String(open) : '';
      getElement('sbMarkets').classList.toggle('hidden', !markets);
      getElement('sbBets').classList.toggle('hidden', markets);
      for (const b of getElement('sbFormat').children) b.setAttribute('aria-checked', b.dataset.format === sportsbook.format ? 'true' : 'false');
      if (markets) renderSportsbookMarkets(match);
      else renderSportsbookBets();
      renderSportsbookSlip();
    }

    /* ---- INPUT -------------------------------------------------------- */
    // Arrow keys between the price buttons, by their place on screen.
    function sportsbookMoveFocus(dx, dy) {
      const buttons = [...getElement('sbMarkets').querySelectorAll('.sb-odd:not([disabled])')];
      if (!buttons.length) return;
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) {
        buttons[0].focus();
        return;
      }
      const from = buttons[current].getBoundingClientRect(),
        cx = from.left + from.width / 2,
        cy = from.top + from.height / 2;
      let best = null,
        bestScore = Infinity;
      for (const b of buttons) {
        if (b === buttons[current]) continue;
        const r = b.getBoundingClientRect(),
          x = r.left + r.width / 2 - cx,
          y = r.top + r.height / 2 - cy;
        const along = dx ? x * dx : y * dy,
          across = dx ? Math.abs(y) : Math.abs(x);
        if (along <= 4) continue;
        const score = along + across * (dx ? 4 : 0.6);
        if (score < bestScore) [best, bestScore] = [b, score];
      }
      if (best) {
        best.focus();
        best.scrollIntoView({ block: 'nearest' });
      }
    }
    function sportsbookKey(e) {
      const code = e.code,
        target = e.target,
        typing = target?.id === 'sbStake',
        onButton = target?.tagName === 'BUTTON',
        actions = actionsForKey(code);
      if (code === 'Tab') return;
      if (code === 'Escape' || (!typing && actions.includes('interact'))) {
        e.preventDefault();
        if (!e.repeat) closeSportsbook();
        return;
      }
      if (typing && !['Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown'].includes(code)) return;
      if (target?.id === 'sbSlider' && ['ArrowLeft', 'ArrowRight'].includes(code)) return;
      // Enter on the price already on the slip places the bet.
      if (onButton && (code === 'Enter' || code === 'NumpadEnter') && target.classList.contains('sb-odd') && target.classList.contains('selected')) {
        e.preventDefault();
        if (!e.repeat) sportsbookPlaceFromSlip();
        return;
      }
      if (onButton && ['Enter', 'NumpadEnter', 'Space'].includes(code) && !target.closest('#sbSlip')) return;
      e.preventDefault();
      if (e.repeat && !code.startsWith('Arrow') && code !== 'Equal' && code !== 'Minus') return;
      if (typing || target?.id === 'sbSlider') {
        if (code === 'ArrowUp') sportsbookStepStake(1);
        else if (code === 'ArrowDown') sportsbookStepStake(-1);
        else if (code === 'Enter' || code === 'NumpadEnter') {
          sportsbookSetStake(getElement('sbStake').value);
          sportsbookPlaceFromSlip();
        }
        return;
      }
      if (code === 'ArrowLeft') sportsbookMoveFocus(-1, 0);
      else if (code === 'ArrowRight') sportsbookMoveFocus(1, 0);
      else if (code === 'ArrowUp') sportsbookMoveFocus(0, -1);
      else if (code === 'ArrowDown') sportsbookMoveFocus(0, 1);
      else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
        if (onButton && target.closest('#sbSlip')) target.click();
        else if (sportsbook.selection) sportsbookPlaceFromSlip();
      } else if (code === 'KeyP') sportsbookPlaceFromSlip();
      else if (code === 'Equal' || code === 'NumpadAdd') sportsbookStepStake(1);
      else if (code === 'Minus' || code === 'NumpadSubtract') sportsbookStepStake(-1);
      else if (code === 'KeyM') sportsbookSetTab(sportsbook.tab === 'markets' ? 'bets' : 'markets');
      else if (code === 'KeyF') sportsbookCycleFormat();
    }
    getElement('sbClose').onclick = closeSportsbook;
    getElement('sbTabMarkets').onclick = () => sportsbookSetTab('markets');
    getElement('sbTabBets').onclick = () => sportsbookSetTab('bets');
    getElement('sbPlace').onclick = sportsbookPlaceFromSlip;
    getElement('sbClear').onclick = () => {
      sportsbook.selection = null;
      renderSportsbook();
    };
    for (const b of getElement('sbFormat').children) b.onclick = () => sportsbookCycleFormat(b.dataset.format);
    for (const chip of getElement('sbChips').children)
      chip.onclick = () => sportsbookSetStake(chip.dataset.chip === 'max' ? Math.floor(cash) : chip.dataset.chip);
    getElement('sbStake').oninput = () => {
      sportsbook.stake = clamp(Math.floor(Number(getElement('sbStake').value) || 0), 0, 99999999);
      sportsbookUi.slip = '';
      renderSportsbook();
    };
    getElement('sbStake').onchange = () => sportsbookSetStake(getElement('sbStake').value);
    getElement('sbSlider').oninput = () => {
      const top = Math.max(1, Math.floor(cash)),
        raw = Math.exp((Number(getElement('sbSlider').value) / 1000) * Math.log(top)),
        // Round to a sensible stake for the size.
        step = raw >= 1000 ? 50 : raw >= 200 ? 10 : raw >= 50 ? 5 : 1;
      sportsbookSetStake(Math.min(top, Math.max(1, Math.round(raw / step) * step)));
    };
    // A click on the backdrop outside the panel leaves.
    getElement('sportsbook').addEventListener('pointerdown', (e) => {
      if (e.target === getElement('sportsbook')) closeSportsbook();
    });
    // END SUBSYSTEM: src/sportsbook-ui.js
