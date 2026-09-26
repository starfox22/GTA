    // BEGIN SUBSYSTEM: src/sportsbook.js — GOALLINE sports betting office
    /**
     * GOALLINE sports betting office
     * Source: src/sportsbook.js
     * Scope: shared game closure (after sports-world.js and sportsbook-odds.js).
     *
     * A betting shop beside South Coast Stadium's entrance plaza where the
     * player bets on the stadium's football fixture while it is played.
     * sportsbook-odds.js prices it; sportsbook3d.js draws the shop.
     *
     * THE SHOP (SPORTSBOOK_SHOP, map units, 8 to the metre): a 16 x 12 m
     * single-storey sportsbook south-west of the plaza, its glass frontage and
     * double door facing south (the way the street camera looks), the back wall
     * on the forecourt. Inside: the counter with the clerk along the west wall,
     * three self-service terminals on the east wall, a video wall on the back
     * wall (the live match and the odds board) and a ledge with low stools in
     * front of it where the punters watch. Walls, counter, ledge and terminals
     * are solid for people (sportsBlocked), vehicles (physics statics, through
     * SPORTS_VEHICLE_BARRIERS) and rounds (sportsbookWalls in the shot lists).
     *
     * THE COUNTER. Inside the shop the prompt is PLACE A BET (the action key)
     * and it opens the betting menu. The world keeps running while it is open,
     * so the match goes on and the odds move under your finger; the player is
     * sheltered meanwhile (hurt() ignores them, the keys drive the menu, not
     * the player) and the menu closes by itself with a wanted level, a pause or
     * the player leaving. It will not open while the police are after you.
     *
     * BETS. A bet is placed at the price showing (the stake leaves the cash at
     * once) and belongs to the match object it was placed on (`token`). They
     * settle as their market resolves (sportsbookUpdate, once a frame after
     * the match steps): next goal on the goal it names (or NO GOAL at full
     * time), OVER and BOTH TEAMS YES the moment they are made, a correct score
     * lost the moment it is passed, half-time result at the break, the rest at
     * full time. Winnings are credited automatically wherever the player is
     * (BET WON · +$1,250 toast); an abandoned match, or one the clock jumped
     * past (sleep, a skipped ride, a reload mid-match), is VOID and the stake
     * comes back. Markets are SUSPENDED around a goal (until the restart and at
     * least SPORTSBOOK_SUSPEND seconds). The bets and their history are saved
     * with the game (campaign.js save: `sportsbook`).
     *
     * PEOPLE. While the player is near, a clerk stands behind the counter and
     * a few punters watch the screens, each backing one side: they cheer or
     * groan at every goal with a speech bubble, and the clerk has a word for
     * a big win.
     */
    const SPORTSBOOK_SHOP = (() => {
      const x0 = 2462,
        x1 = 2590,
        y0 = 4992,
        y1 = 5088,
        wall = 2.4,
        inner = { x0: x0 + wall, x1: x1 - wall, y0: y0 + wall, y1: y1 - wall },
        door = { x0: 2553, x1: 2571 },
        height = 4.6 * UNITS_PER_METRE;
      return {
        id: 'goalline',
        name: 'GOALLINE SPORTS BET',
        brand: 'GOALLINE',
        x0,
        x1,
        y0,
        y1,
        wall,
        height,
        inner,
        door,
        // The paved apron in front and the path to the Garden Ave pavement.
        apron: { x: x0 - 6, y: y1, w: x1 - x0 + 12, h: 26 },
        path: { x: x1, y: y1 + 2, w: 2616 - x1, h: 22 },
        // Where the prompt looks: anywhere inside, a step in from the walls.
        counter: { x: inner.x0 + 17, y: inner.y0 + 16, w: 7, h: 48, height: 1.1 * UNITS_PER_METRE },
        ledge: { x: inner.x0 + 40, y: inner.y0 + 27, w: 52, h: 3, height: 1.05 * UNITS_PER_METRE },
        terminals: [22, 40, 58].map((v) => ({ x: inner.x1 - 6, y: inner.y0 + v - 2.5, w: 6, h: 5, height: 1.6 * UNITS_PER_METRE })),
        stools: [46, 58, 70, 82].map((u) => ({ x: inner.x0 + u, y: inner.y0 + 36 })),
        // Scene spots: the clerk behind the counter, punters at the ledge, a
        // terminal and the screens.
        spots: {
          clerk: { x: inner.x0 + 9, y: inner.y0 + 34, a: 0, pose: 'serve' },
          punters: [
            { x: inner.x0 + 46, y: inner.y0 + 37, a: -Math.PI / 2, pose: 'sit' },
            { x: inner.x0 + 70, y: inner.y0 + 37, a: -Math.PI / 2, pose: 'sit' },
            { x: inner.x1 - 13, y: inner.y0 + 38, a: 0, pose: 'text' },
            { x: inner.x0 + 96, y: inner.y0 + 46, a: -Math.PI / 2 - 0.3, pose: 'watch' },
            { x: inner.x0 + 34, y: inner.y0 + 54, a: -Math.PI / 2 + 0.4, pose: 'arms' },
          ],
        },
      };
    })();
    // Seconds the markets stay suspended after a goal, at least.
    const SPORTSBOOK_SUSPEND = 6;
    const SPORTSBOOK_HISTORY = 40;
    const SPORTSBOOK_CHIPS = [10, 50, 100, 500];
    const SPORTSBOOK_LINES = {
      cheer: ['GET IN!', 'YES! YES! YES!', 'Come on!!', 'Pay me!', 'What a goal!', 'Told you!'],
      groan: ['Oh, come ON…', 'Unbelievable.', 'There goes my rent.', 'Useless!', 'Ref!', 'Not again…'],
      clerk: ['Lucky day, huh?', 'Don’t spend it all at once.', 'Somebody’s buying the drinks.', 'The house will remember that.'],
      idle: ['Come on, lads…', 'Just one goal.', 'Hold on, hold on…', 'Cash out? Never.'],
    };

    /* The walls, the counter, the ledge and the terminals: everything solid in the shop. */
    const SPORTSBOOK_SOLIDS = (() => {
      const S = SPORTSBOOK_SHOP,
        h = S.height + 0.6 * UNITS_PER_METRE;
      return [
        { id: 'sportsbook-wall', x: S.x0, y: S.y0, w: S.x1 - S.x0, h: S.wall, height: h },
        { id: 'sportsbook-wall', x: S.x0, y: S.y0, w: S.wall, h: S.y1 - S.y0, height: h },
        { id: 'sportsbook-wall', x: S.x1 - S.wall, y: S.y0, w: S.wall, h: S.y1 - S.y0, height: h },
        { id: 'sportsbook-glass', x: S.x0, y: S.y1 - S.wall, w: S.door.x0 - S.x0, h: S.wall, height: h },
        { id: 'sportsbook-glass', x: S.door.x1, y: S.y1 - S.wall, w: S.x1 - S.door.x1, h: S.wall, height: h },
        { id: 'sportsbook-counter', ...S.counter },
        { id: 'sportsbook-ledge', ...S.ledge },
        ...S.terminals.map((t) => ({ id: 'sportsbook-terminal', ...t })),
      ];
    })();
    // Vehicles meet the walls through the stadium's barrier list (physics.js).
    SPORTS_VEHICLE_BARRIERS.push(...SPORTSBOOK_SOLIDS.filter((s) => s.id !== 'sportsbook-ledge'));
    function sportsbookWalls() {
      return SPORTSBOOK_SOLIDS;
    }
    function sportsbookNearShop(x, y, margin = 0) {
      const S = SPORTSBOOK_SHOP;
      return x > S.x0 - margin && x < S.x1 + margin && y > S.y0 - margin && y < S.y1 + margin;
    }
    /* People: the shop's solids (asked by sportsBlocked, i.e. solid()). */
    function sportsbookBlocked(x, y, radius = 0) {
      if (!sportsbookNearShop(x, y, radius + 1)) return false;
      return rectListBlocked(SPORTSBOOK_SOLIDS, x, y, radius);
    }
    function sportsbookInside(x = player.x, y = player.y) {
      const I = SPORTSBOOK_SHOP.inner;
      return x > I.x0 + 2 && x < I.x1 - 2 && y > I.y0 + 2 && y < I.y1 - 1;
    }

    /* ---- STATE ---------------------------------------------------------- */
    const sportsbook = {
      open: false,
      format: 'decimal',
      tab: 'markets',
      bets: [],
      nextId: 1,
      stats: { placed: 0, staked: 0, returned: 0, won: 0, lost: 0, void: 0, biggest: 0 },
      // The match being followed: its token, the score and stage last seen.
      tracked: null,
      suspendedUntil: 0,
      lastGoal: null,
      selection: null, // { marketId, key }
      stake: 10,
      scene: null,
      staffTimer: 0,
      reactions: [],
      log: [],
      markets: [],
      marketsKey: '',
      state: null,
    };
    let sportsbookTokenSeq = 0;
    function sportsbookToken(match) {
      if (!match.bookToken) match.bookToken = 'm' + ++sportsbookTokenSeq;
      return match.bookToken;
    }
    function sportsbookMatch() {
      return sportsMatches.soccer;
    }
    function sportsbookMoney(value) {
      return '$' + Math.round(value).toLocaleString('en-US');
    }
    function sportsbookLog(text) {
      sportsbook.log.push(clockText() + ' ' + text);
      if (sportsbook.log.length > 60) sportsbook.log.shift();
    }

    /* ---- MARKETS -------------------------------------------------------- */
    /**
     * The markets as offered now: priced, with `suspended` (around a goal, or
     * the match abandoned) and `status` for the header. Rebuilt at most a few
     * times a second (the odds only move with the clock and the score).
     */
    function sportsbookSuspended(match) {
      if (!match || match.abandoned) return true;
      if (gameTime < sportsbook.suspendedUntil) return true;
      if (match.stage === 'live' && match.phase === 'celebrate') return true;
      // Until the kick-off after a goal is taken.
      return !!(sportsbook.lastGoal && match.stage === 'live' && match.phase === 'restart' && gameTime - sportsbook.lastGoal.at < 20);
    }
    function sportsbookRefreshMarkets(force = false) {
      const match = sportsbookMatch();
      if (!match) return (sportsbook.markets = []);
      const state = sportsbookMatchState(match),
        // Odds move with the match minute; a quarter of a minute is plenty.
        key = [match.fixture.id, state.stage, state.period, state.scores.join(':'), Math.floor(state.clock * 4), match.abandoned].join('|');
      if (!force && key === sportsbook.marketsKey) return sportsbook.markets;
      sportsbook.marketsKey = key;
      sportsbook.state = state;
      sportsbook.markets = match.abandoned ? [] : sportsbookPricedMarkets(match.fixture, state);
      return sportsbook.markets;
    }
    function sportsbookFindOutcome(marketId, key) {
      const market = sportsbook.markets.find((m) => m.id === marketId);
      return market ? { market, outcome: market.outcomes.find((o) => o.key === key) || null } : null;
    }

    /* ---- BETS ------------------------------------------------------------ */
    /**
     * Place a bet on outcome `key` of market `marketId` for `stake` dollars at
     * the price showing. Returns the bet, or { error } with the reason.
     */
    function sportsbookPlace(marketId, key, stake) {
      const match = sportsbookMatch();
      stake = Math.floor(Number(stake));
      if (!match) return { error: 'NO MATCH' };
      if (wantedStars > 0) return { error: 'LOSE THE POLICE FIRST' };
      sportsbookRefreshMarkets();
      if (sportsbookSuspended(match)) return { error: 'MARKETS SUSPENDED' };
      const found = sportsbookFindOutcome(marketId, key);
      if (!found || !found.outcome || found.market.closed || !found.outcome.odds) return { error: 'MARKET CLOSED' };
      if (!Number.isFinite(stake) || stake < 1) return { error: 'MINIMUM STAKE $1' };
      if (stake > Math.floor(cash)) return { error: 'NOT ENOUGH CASH' };
      const { market, outcome } = found,
        state = sportsbook.state,
        bet = {
          id: sportsbook.nextId++,
          token: sportsbookToken(match),
          fixture: match.fixture.id,
          teams: [match.teams[0].short, match.teams[1].short],
          market: market.id,
          kind: market.kind,
          line: market.line,
          goal: market.goal,
          title: market.title + (market.kind === 'next' ? ' · GOAL ' + market.goal : ''),
          key,
          label: outcome.label,
          odds: outcome.odds,
          stake,
          placedAt: sportsBoardClock(match),
          placedScore: state.scores.join('-'),
          placedMinutes: worldMinutes,
          status: 'open',
          payout: 0,
          result: '',
        };
      cash -= stake;
      sportsbook.bets.push(bet);
      sportsbook.stats.placed++;
      sportsbook.stats.staked += stake;
      sportsbookLog('PLACED #' + bet.id + ' ' + bet.title + ' ' + bet.label + ' @' + bet.odds + ' $' + stake + ' (cash ' + Math.floor(cash) + ')');
      sportsbookTrim();
      save();
      return bet;
    }
    /* Keep every open bet and the last SPORTSBOOK_HISTORY settled ones. */
    function sportsbookTrim() {
      const settled = sportsbook.bets.filter((b) => b.status !== 'open');
      if (settled.length <= SPORTSBOOK_HISTORY) return;
      const drop = new Set(settled.slice(0, settled.length - SPORTSBOOK_HISTORY));
      sportsbook.bets = sportsbook.bets.filter((b) => !drop.has(b));
    }
    function sportsbookSettle(bet, status, result) {
      if (bet.status !== 'open') return;
      bet.status = status;
      bet.result = result;
      bet.settledAt = clockText();
      if (status === 'won') {
        bet.payout = Math.round(bet.stake * bet.odds);
        cash = clamp(cash + bet.payout, 0, 99999999);
        sportsbook.stats.won++;
        sportsbook.stats.returned += bet.payout;
        sportsbook.stats.biggest = Math.max(sportsbook.stats.biggest, bet.payout);
        tell('BET WON · +' + sportsbookMoney(bet.payout) + ' · ' + bet.label, 4);
        tone(880, 0.09, 0.08);
        tone(1320, 0.14, 0.06);
        // The clerk has a word for a big one, if you are there to hear it.
        if (bet.payout >= 1000 || bet.odds >= 6) sportsbookClerkSays(randomChoice(SPORTSBOOK_LINES.clerk));
      } else if (status === 'void') {
        bet.payout = bet.stake;
        cash = clamp(cash + bet.stake, 0, 99999999);
        sportsbook.stats.void++;
        sportsbook.stats.returned += bet.stake;
        tell('BET VOID · ' + sportsbookMoney(bet.stake) + ' RETURNED', 3.5);
      } else {
        sportsbook.stats.lost++;
        if (sportsbook.open || sportsbookInside()) tell('BET LOST · ' + bet.title + ' · ' + bet.label, 2.5);
      }
      sportsbookLog(status.toUpperCase() + ' #' + bet.id + ' ' + bet.title + ' ' + bet.label + ' ' + result + (bet.payout ? ' +$' + bet.payout : '') + ' (cash ' + Math.floor(cash) + ')');
      sportsbookTrim();
      sportsbook.uiBetsKey = '';
    }
    /**
     * A goal for `team` making `scores`: settle what it decides and suspend
     * the markets. `goalNumber` is the goal's place in the match (1 = first).
     */
    function sportsbookGoal(match, team, scores) {
      const token = match.bookToken,
        [h, a] = scores,
        total = h + a,
        side = team === 0 ? 'home' : 'away',
        text = match.teams[team].short + ' GOAL ' + h + '-' + a;
      for (const bet of sportsbook.bets) {
        if (bet.status !== 'open' || bet.token !== token) continue;
        if (bet.kind === 'next' && bet.goal === total) sportsbookSettle(bet, bet.key === side ? 'won' : 'lost', text);
        else if (bet.kind === 'total' && total > bet.line) sportsbookSettle(bet, bet.key === 'over' ? 'won' : 'lost', text);
        else if (bet.kind === 'btts' && h > 0 && a > 0) sportsbookSettle(bet, bet.key === 'yes' ? 'won' : 'lost', text);
        else if (bet.kind === 'cs') {
          if (bet.key === 'other') {
            if (h >= 4 || a >= 4) sportsbookSettle(bet, 'won', text);
          } else {
            const [x, y] = bet.key.split('-').map(Number);
            if (h > x || a > y || h >= 4 || a >= 4) sportsbookSettle(bet, 'lost', text);
          }
        }
      }
      sportsbook.suspendedUntil = gameTime + SPORTSBOOK_SUSPEND;
      sportsbook.lastGoal = { at: gameTime, team, scores: [...scores], clock: sportsBoardClock(match) };
      sportsbookLog('GOAL ' + text + ' at ' + sportsBoardClock(match));
      sportsbookPuntersReact(team);
    }
    /* The break (or anything past it): settle the half-time bets on the score now. */
    function sportsbookHalfTime(match) {
      const [h, a] = match.scores,
        result = h > a ? 'home' : h < a ? 'away' : 'draw';
      for (const bet of sportsbook.bets)
        if (bet.status === 'open' && bet.token === match.bookToken && bet.kind === 'ht')
          sportsbookSettle(bet, bet.key === result ? 'won' : 'lost', 'HALF TIME ' + h + '-' + a);
    }
    /* Full time: everything still open on the match is decided by the result. */
    function sportsbookFullTime(match) {
      const [h, a] = match.scores,
        result = h > a ? 'home' : h < a ? 'away' : 'draw',
        text = 'FULL TIME ' + h + '-' + a;
      for (const bet of sportsbook.bets) {
        if (bet.status !== 'open' || bet.token !== match.bookToken) continue;
        let won = false;
        if (bet.kind === 'result' || bet.kind === 'ht') won = bet.key === result;
        else if (bet.kind === 'next') won = bet.key === 'none';
        else if (bet.kind === 'total') won = bet.key === (h + a > bet.line ? 'over' : 'under');
        else if (bet.kind === 'btts') won = bet.key === (h > 0 && a > 0 ? 'yes' : 'no');
        else if (bet.kind === 'cs') won = bet.key === 'other' ? h >= 4 || a >= 4 : bet.key === h + '-' + a;
        sportsbookSettle(bet, won ? 'won' : 'lost', text);
      }
    }
    function sportsbookVoidAll(filter, reason) {
      let any = false;
      for (const bet of sportsbook.bets)
        if (bet.status === 'open' && filter(bet)) {
          sportsbookSettle(bet, 'void', reason);
          any = true;
        }
      return any;
    }

    /**
     * Once a frame after the match steps (sports.js updateSports): follow the
     * stadium's fixture, settle what it decides, run the shop's people.
     */
    function sportsbookUpdate(deltaSeconds) {
      const match = sportsbookMatch();
      if (!match) return;
      const token = sportsbookToken(match);
      let dirty = false;
      let tracked = sportsbook.tracked;
      if (!tracked || tracked.token !== token) {
        // A new match object: bets restored from a save may carry on if their
        // fixture has not started; anything else on a vanished match is void.
        const fresh = match.stage === 'upcoming' || match.stage === 'warmup';
        for (const bet of sportsbook.bets)
          if (bet.status === 'open' && bet.restored && bet.fixture === match.fixture.id && fresh) {
            bet.token = token;
            bet.restored = false;
          }
        dirty = sportsbookVoidAll((bet) => bet.token !== token, 'MATCH NOT COMPLETED') || dirty;
        tracked = sportsbook.tracked = {
          token,
          fixture: match.fixture.id,
          scores: [...match.scores],
          halfDone: !(match.stage === 'upcoming' || match.stage === 'warmup' || (match.stage === 'live' && match.period === 0)),
          fullDone: match.stage === 'fulltime' || match.stage === 'over',
          abandoned: match.abandoned,
        };
        sportsbook.suspendedUntil = 0;
        sportsbook.lastGoal = null;
        sportsbook.selection = null;
      }
      if (match.abandoned) {
        if (!tracked.abandoned) {
          tracked.abandoned = true;
          dirty = sportsbookVoidAll((bet) => bet.token === token, 'MATCH ABANDONED') || dirty;
        }
      } else {
        for (const team of [0, 1])
          while (match.scores[team] > tracked.scores[team]) {
            tracked.scores[team]++;
            sportsbookGoal(match, team, tracked.scores);
            dirty = true;
          }
        const pastHalf = match.stage === 'break' || match.period >= 1 || match.stage === 'fulltime' || match.stage === 'over';
        if (!tracked.halfDone && pastHalf && match.stage !== 'upcoming' && match.stage !== 'warmup') {
          tracked.halfDone = true;
          sportsbookHalfTime(match);
          dirty = true;
        }
        if (!tracked.fullDone && (match.stage === 'fulltime' || match.stage === 'over')) {
          tracked.fullDone = true;
          sportsbookFullTime(match);
          dirty = true;
        }
      }
      if (dirty) save();
      staffSportsbook(deltaSeconds);
      updateSportsbookReactions();
      if (sportsbook.open) {
        if (wantedStars > 0 || !sportsbookInside() || player.car || gameMode !== 'play') closeSportsbook();
        else renderSportsbook();
      }
    }

    /* ---- SAVE ------------------------------------------------------------ */
    function sportsbookSaveData() {
      return {
        format: sportsbook.format,
        nextId: sportsbook.nextId,
        stats: { ...sportsbook.stats },
        bets: sportsbook.bets.map((bet) => ({ ...bet })),
      };
    }
    function loadSportsbook(data) {
      if (!data || typeof data !== 'object') return;
      if (['decimal', 'fractional', 'american'].includes(data.format)) sportsbook.format = data.format;
      sportsbook.nextId = Math.max(1, Math.floor(Number(data.nextId) || 1));
      if (data.stats && typeof data.stats === 'object')
        for (const key of Object.keys(sportsbook.stats)) sportsbook.stats[key] = Math.max(0, Number(data.stats[key]) || 0);
      sportsbook.bets = Array.isArray(data.bets)
        ? data.bets
            .filter((bet) => bet && typeof bet === 'object' && Number.isFinite(bet.stake) && Number.isFinite(bet.odds) && typeof bet.key === 'string')
            .map((bet) => ({ ...bet, token: null, restored: bet.status === 'open' }))
        : [];
      for (const bet of sportsbook.bets) sportsbook.nextId = Math.max(sportsbook.nextId, (bet.id || 0) + 1);
      sportsbook.tracked = null;
    }
    function resetSportsbook() {
      closeSportsbook();
      sportsbook.bets = [];
      sportsbook.nextId = 1;
      for (const key of Object.keys(sportsbook.stats)) sportsbook.stats[key] = 0;
      sportsbook.tracked = null;
      sportsbook.selection = null;
      sportsbook.log.length = 0;
    }

    /* ---- THE SHOP'S PEOPLE ----------------------------------------------- */
    function staffSportsbook(deltaSeconds) {
      sportsbook.staffTimer -= deltaSeconds;
      if (sportsbook.staffTimer > 0) return;
      sportsbook.staffTimer = 1.5;
      const S = SPORTSBOOK_SHOP,
        cx = (S.x0 + S.x1) / 2,
        cy = (S.y0 + S.y1) / 2,
        near = Math.abs(player.x - cx) < 900 && Math.abs(player.y - cy) < 900;
      let scene = sportsbook.scene;
      if (scene && (!crowd.scenes.includes(scene) || !near)) {
        if (crowd.scenes.includes(scene)) removeScene(scene);
        scene = sportsbook.scene = null;
      }
      if (!near || scene) return;
      scene = sportsbook.scene = makeScene('sportsbook', cx, cy, { shop: S.id });
      const clerk = spawnSceneMember(scene, 'clerk', S.spots.clerk, 'worker');
      if (clerk) {
        // The house colours: a green polo with the brand on it.
        clerk.color = '#1f8f55';
        Object.assign(clerk.look, { top: '#1f8f55', pants: '#1c2328', sleeves: false, umbrella: null, backpack: false, carry: null });
        clerk.carry = null;
        clerk.sportsbookClerk = true;
      }
      // Evening fixtures pull a bigger crowd.
      const hour = (worldMinutes % 1440) / 60,
        count = hour >= 11 && hour < 23 ? S.spots.punters.length : 2;
      S.spots.punters.slice(0, count).forEach((spot, index) => {
        const p = spawnSceneMember(scene, 'punter', spot, index % 2 ? 'casual' : 'commuter');
        if (!p) return;
        Object.assign(p.look, { umbrella: null, backpack: false });
        p.carry = null;
        p.punter = { backs: index % 2, home: spot };
      });
    }
    function sportsbookScenePeople() {
      const scene = sportsbook.scene;
      return scene && crowd.scenes.includes(scene) ? scene.members.filter((p) => p.hp > 0) : [];
    }
    function sportsbookSay(p, text, kind = 'chat') {
      p.speech = text;
      p.speechUntil = gameTime + 3;
      p.speechKind = kind;
      p.speechKindText = text;
    }
    function sportsbookClerkSays(text) {
      const clerk = sportsbookScenePeople().find((p) => p.sportsbookClerk);
      if (clerk && distanceBetween(clerk, player) < 260) sportsbookSay(clerk, text, 'greet');
    }
    /* A goal on the screens: the punters who backed the scorers leap up, the rest groan. */
    function sportsbookPuntersReact(team) {
      let spoken = 0;
      for (const p of sportsbookScenePeople()) {
        if (!p.punter || !p.sceneSpot) continue;
        const happy = p.punter.backs === team;
        p.sceneSpot = { ...p.punter.home, pose: happy ? 'cheer' : 'despair' };
        sportsbook.reactions.push({ p, until: gameTime + 3.2 });
        if (spoken < 2 && randomBetween(0, 1) < 0.75) {
          sportsbookSay(p, randomChoice(happy ? SPORTSBOOK_LINES.cheer : SPORTSBOOK_LINES.groan), happy ? 'dodge' : 'gasp');
          spoken++;
        }
      }
    }
    function updateSportsbookReactions() {
      for (let i = sportsbook.reactions.length - 1; i >= 0; i--) {
        const r = sportsbook.reactions[i];
        if (gameTime < r.until) continue;
        if (r.p.punter && r.p.scene) r.p.sceneSpot = { ...r.p.punter.home };
        sportsbook.reactions.splice(i, 1);
      }
      // Now and then a punter mutters at the screen during play.
      const match = sportsbookMatch();
      if (match?.stage === 'live' && randomBetween(0, 1) < 0.004) {
        const people = sportsbookScenePeople().filter((p) => p.punter);
        if (people.length) {
          const p = randomChoice(people);
          if ((p.speechUntil || 0) < gameTime) sportsbookSay(p, randomChoice(SPORTSBOOK_LINES.idle));
        }
      }
    }

    /* ---- PROMPT AND DOOR -------------------------------------------------- */
    function sportsbookPrompt() {
      if (sportsbook.open || player.car || !sportsbookInside()) return '';
      return 'PLACE A BET';
    }
    function sportsbookInteract() {
      if (player.car || !sportsbookInside()) return false;
      openSportsbook();
      return true;
    }
    /* hurt() asks this: nobody lays a finger on you at the counter. */
    function sportsbookShelters() {
      return sportsbook.open;
    }

    /* ---- THE PLOT, THE GROUND AND THE MAP ---------------------------------- */
    /* Clear the plot of generic scenery; the roof is cover from the police helicopter. */
    function prepareSportsbookShop() {
      for (const scenery of [trees, lamps])
        for (let index = scenery.length - 1; index >= 0; index--)
          if (sportsbookNearShop(scenery[index].x, scenery[index].y, 24)) scenery.splice(index, 1);
      const S = SPORTSBOOK_SHOP;
      registerOverheadCover((S.x0 + S.x1) / 2, (S.y0 + S.y1) / 2, (S.x1 - S.x0) / 2, (S.y1 - S.y0) / 2, 0, S.height, S.height + 5, 'sportsbook');
    }
    /* The ground: the paved apron and the path to the Garden Ave pavement, the floor. */
    function paintSportsbookGround(context, detail = true) {
      const S = SPORTSBOOK_SHOP;
      if (detail) {
        paintPavers(context, S.apron.x, S.apron.y, S.apron.w, S.apron.h, 10);
        paintPavers(context, S.path.x, S.path.y, S.path.w, S.path.h, 10);
      } else {
        context.fillStyle = '#b1aa9a';
        context.fillRect(S.apron.x, S.apron.y, S.apron.w, S.apron.h);
        context.fillRect(S.path.x, S.path.y, S.path.w, S.path.h);
      }
      context.fillStyle = '#1c2326';
      context.fillRect(S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0);
      context.fillStyle = '#20553a';
      context.fillRect(S.inner.x0, S.inner.y0, S.inner.x1 - S.inner.x0, S.inner.y1 - S.inner.y0);
      if (!detail) return;
      context.fillStyle = '#3dff8e';
      context.font = 'bold 10px Arial';
      context.textAlign = 'center';
      context.fillText('GOALLINE', (S.x0 + S.x1) / 2, (S.y0 + S.y1) / 2 + 4);
    }
    /* The city map: a green badge by the stadium; zoomed in, its name. */
    function drawSportsbookMap(context, scale, big) {
      const S = SPORTSBOOK_SHOP,
        x = (S.door.x0 + S.door.x1) / 2,
        y = S.y1 + 6;
      context.save();
      context.fillStyle = '#06140c';
      context.strokeStyle = '#3dff8e';
      context.lineWidth = 2 / scale;
      context.beginPath();
      context.arc(x, y, (big ? 8 : 5) / scale, 0, TAU);
      context.fill();
      context.stroke();
      context.fillStyle = '#3dff8e';
      context.textAlign = 'center';
      context.font = 'bold ' + (big ? 8 : 6) / scale + 'px Arial';
      context.fillText('$', x, y + (big ? 3 : 2) / scale);
      if (big && scale > 0.09) {
        context.font = 'bold ' + 9 / scale + 'px Arial';
        context.strokeStyle = '#152731';
        context.lineWidth = 3 / scale;
        context.strokeText('GOALLINE · BETS', x, y + 20 / scale);
        context.fillText('GOALLINE · BETS', x, y + 20 / scale);
      }
      context.restore();
    }

    /* ---- DEVELOPER CONSOLE (spread into window.DeadEndCity by game.js) ---- */
    function sportsbookReport() {
      const match = sportsbookMatch(),
        markets = sportsbookRefreshMarkets(true),
        state = sportsbook.state,
        compact = (bet) => ({
          id: bet.id,
          market: bet.title,
          pick: bet.label,
          odds: bet.odds,
          stake: bet.stake,
          placed: bet.placedAt + ' ' + bet.placedScore,
          status: bet.status,
          payout: bet.payout,
          result: bet.result,
        });
      return {
        shop: {
          name: SPORTSBOOK_SHOP.name,
          x0: SPORTSBOOK_SHOP.x0,
          y0: SPORTSBOOK_SHOP.y0,
          x1: SPORTSBOOK_SHOP.x1,
          y1: SPORTSBOOK_SHOP.y1,
          door: { x: (SPORTSBOOK_SHOP.door.x0 + SPORTSBOOK_SHOP.door.x1) / 2, y: SPORTSBOOK_SHOP.y1 },
          sizeM: [(SPORTSBOOK_SHOP.x1 - SPORTSBOOK_SHOP.x0) / UNITS_PER_METRE, (SPORTSBOOK_SHOP.y1 - SPORTSBOOK_SHOP.y0) / UNITS_PER_METRE],
          people: sportsbookScenePeople().map((p) => ({ role: p.sceneRole, pose: p.pose || null, backs: p.punter ? p.punter.backs : null, says: (p.speechUntil || 0) > gameTime ? p.speech : null })),
        },
        playerInside: sportsbookInside(),
        menuOpen: sportsbook.open,
        prompt: sportsbookPrompt(),
        format: sportsbook.format,
        cash: Math.floor(cash),
        match: match
          ? {
              fixture: match.teams[0].name + ' v ' + match.teams[1].name,
              ratings: [match.teams[0].rating, match.teams[1].rating],
              expectedGoals: sportsbookRates(match.fixture).map((v) => +v.toFixed(2)),
              stage: match.stage,
              clock: sportsBoardClock(match),
              score: match.scores.join('-'),
              share: state ? +state.share.toFixed(3) : null,
              suspended: sportsbookSuspended(match),
              abandoned: match.abandoned,
            }
          : null,
        markets: markets.map((m) => ({
          id: m.id,
          title: m.title,
          closed: m.closed,
          bookPercent: +(m.book * 100).toFixed(1),
          outcomes: m.outcomes.map((o) => ({ key: o.key, label: o.label, fair: +(o.p * 100).toFixed(1), odds: o.odds, fractional: sportsbookFormatOdds(o.odds, 'fractional'), american: sportsbookFormatOdds(o.odds, 'american') })),
        })),
        open: sportsbook.bets.filter((b) => b.status === 'open').map(compact),
        settled: sportsbook.bets.filter((b) => b.status !== 'open').slice(-12).map(compact),
        stats: { ...sportsbook.stats },
        log: sportsbook.log.slice(-24),
      };
    }
    function sportsbookConsole() {
      return {
        // The shop, the stadium fixture, every market with fair % and odds, the bets and a log.
        sportsbook: () => sportsbookReport(),
        // Place a bet as the slip would (anywhere): market id ('result', 'next:1',
        // 'total:2.5', 'btts', 'cs', 'ht'), outcome key, stake. Returns the bet or { error }.
        sportsbookBet(marketId = 'result', key = 'home', stake = 10) {
          const bet = sportsbookPlace(String(marketId), String(key), stake);
          return bet.error ? { error: bet.error, cash: Math.floor(cash) } : { id: bet.id, market: bet.title, pick: bet.label, odds: bet.odds, stake: bet.stake, cash: Math.floor(cash) };
        },
        // Walk into the shop (in front of the counter) and, with `open`, bring up the menu on `tab`.
        sportsbookShop(open = false, tab = 'markets') {
          const S = SPORTSBOOK_SHOP;
          teleportPlayer(S.inner.x0 + 60, S.inner.y1 - 16);
          player.a = -Math.PI / 2;
          if (open) {
            openSportsbook();
            sportsbookSetTab(tab === 'bets' ? 'bets' : 'markets');
          } else closeSportsbook();
          return { inside: sportsbookInside(), menuOpen: sportsbook.open, prompt: sportsbookPrompt() };
        },
        // Pick an outcome on the slip and set the stake (the menu must be open to see it).
        sportsbookSlip(marketId = 'result', key = 'home', stake = 10) {
          sportsbookRefreshMarkets(true);
          sportsbook.selection = { marketId: String(marketId), key: String(key) };
          sportsbook.stake = Math.floor(stake);
          renderSportsbook();
          return { selection: sportsbook.selection, stake: sportsbook.stake, found: !!sportsbookFindOutcome(marketId, key)?.outcome };
        },
        // 'decimal', 'fractional' or 'american'.
        sportsbookFormat(format = 'decimal') {
          if (['decimal', 'fractional', 'american'].includes(format)) sportsbookCycleFormat(format);
          return sportsbook.format;
        },
      };
    }
    // END SUBSYSTEM: src/sportsbook.js
