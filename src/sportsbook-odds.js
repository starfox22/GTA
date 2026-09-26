    // BEGIN SUBSYSTEM: src/sportsbook-odds.js — Sportsbook pricing model
    /**
     * Sportsbook pricing model
     * Source: src/sportsbook-odds.js
     * Scope: shared game closure (after sports-fixtures.js, before sportsbook.js).
     *
     * Prices the stadium's football fixture the way a real bookmaker would:
     * a goal model gives fair probabilities, a margin turns them into odds.
     *
     * THE GOAL MODEL. The match simulation (sports.js) scores when a shot on
     * target beats the keeper, with sportsFinishChance(fixture, team) from the
     * clubs' ratings (sports-fixtures.js). A side's expected goals over the 90
     * minutes are its shots on target (SPORTSBOOK_MODEL.shotsOnTarget,
     * measured from thousands of simulated matches) times that chance; goals
     * arrive as a Poisson process through the playing time. Live, each side's
     * remaining goals are Poisson with its rate times the share of the 90
     * minutes still to play (none at half time's whistle, none after full
     * time), added to the score on the board: every market comes from that
     * grid of final scores (sportsbookGrid).
     *
     * THE MARGIN (sportsbookPriceOutcomes). Fair probabilities p_i are raised
     * to one power k < 1 so that the implied probabilities p_i^k add up to
     * 1 + margin (the "power method": longshots carry more of the margin than
     * favourites, as on a real book); odds are 1 / p_i^k rounded DOWN to the
     * price ladder real books quote (1.01 .. 1.99 in hundredths, then coarser).
     * 6% on the main markets, 12% on correct score (real books take more on
     * it); a lopsided market carries less (half for a favourite at 90% and
     * above), or the whole margin would sit on the longshot. A market with an
     * outcome above 99% is closed: nothing to price.
     *
     * Odds formats: decimal (the stake returned included), fractional (the
     * nearest price a bookmaker would chalk up) and American (+ / -).
     */
    const SPORTSBOOK_MODEL = {
      // Shots on target a side over 90 minutes (measured: see docs/SOURCE_GUIDE.md 4d).
      shotsOnTarget: 7.4,
      margin: 0.06,
      correctScoreMargin: 0.12,
      // Scores counted per side in the grid (the tail beyond is lumped in).
      maxGoals: 10,
      matchMinutes: 90,
      halfMinutes: 45,
    };
    // Every outcome of the correct-score market: the 16 scores up to 3-3 by
    // result, then ANY OTHER (either side scoring four or more).
    const SPORTSBOOK_CORRECT_SCORES = [
      [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2],
      [0, 0], [1, 1], [2, 2], [3, 3],
      [0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3],
    ];
    const SPORTSBOOK_TOTAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5];

    /* Expected goals over the full 90 minutes for [home, away]. */
    function sportsbookRates(fixture) {
      return [0, 1].map((team) => SPORTSBOOK_MODEL.shotsOnTarget * sportsFinishChance(fixture, team));
    }

    /* Poisson probabilities 0..n with the tail folded into the last cell. */
    function sportsbookPoisson(lambda, n = SPORTSBOOK_MODEL.maxGoals) {
      const row = new Array(n + 1);
      let term = Math.exp(-lambda),
        sum = 0;
      for (let k = 0; k <= n; k++) {
        row[k] = term;
        sum += term;
        term *= lambda / (k + 1);
      }
      row[n] += Math.max(0, 1 - sum);
      return row;
    }

    /**
     * Where the match is for pricing: the score, the share of the 90 minutes
     * still to be played (`share`) and of the first half (`halfShare`), and
     * whether it is finished. `match` is sports.js's live match.
     */
    function sportsbookMatchState(match) {
      const M = SPORTSBOOK_MODEL,
        stage = match.stage,
        clock = Math.max(0, Math.min(M.matchMinutes, match.clock || 0));
      let share = 1,
        halfShare = M.halfMinutes / M.matchMinutes;
      if (stage === 'live') {
        share = (M.matchMinutes - clock) / M.matchMinutes;
        halfShare = match.period === 0 ? Math.max(0, M.halfMinutes - clock) / M.matchMinutes : 0;
      } else if (stage === 'break') {
        share = (M.matchMinutes - M.halfMinutes) / M.matchMinutes;
        halfShare = 0;
      } else if (stage === 'fulltime' || stage === 'over') share = halfShare = 0;
      return {
        stage,
        clock,
        period: match.period,
        scores: [...match.scores],
        share,
        halfShare,
        preMatch: stage === 'upcoming' || stage === 'warmup' || stage === 'new',
        finished: stage === 'fulltime' || stage === 'over',
      };
    }

    /* The distribution of goals still to come for each side over `share` of the match. */
    function sportsbookGrid(rates, share) {
      return [sportsbookPoisson(rates[0] * share), sportsbookPoisson(rates[1] * share)];
    }

    /* Sum a predicate over final scores: score + goals still to come. */
    function sportsbookSum(grid, scores, test) {
      const [home, away] = grid;
      let p = 0;
      for (let i = 0; i < home.length; i++)
        for (let j = 0; j < away.length; j++) if (test(scores[0] + i, scores[1] + j)) p += home[i] * away[j];
      return p;
    }

    /**
     * Fair probabilities for every open market at this state. Each market is
     * { id, kind, title, line?, goal?, outcomes: [{ key, label, p }] }; a
     * market whose result is already decided is left out.
     */
    function sportsbookFairMarkets(fixture, state) {
      const rates = sportsbookRates(fixture),
        grid = sportsbookGrid(rates, state.share),
        [h, a] = state.scores,
        total = h + a,
        home = fixture.home.short,
        away = fixture.away.short,
        markets = [];
      if (state.finished) return markets;
      markets.push({
        id: 'result',
        kind: 'result',
        title: 'MATCH RESULT',
        outcomes: [
          { key: 'home', label: home, p: sportsbookSum(grid, state.scores, (x, y) => x > y) },
          { key: 'draw', label: 'DRAW', p: sportsbookSum(grid, state.scores, (x, y) => x === y) },
          { key: 'away', label: away, p: sportsbookSum(grid, state.scores, (x, y) => x < y) },
        ],
      });
      // Next goal: the (total + 1)th goal of the match.
      const lh = rates[0] * state.share,
        la = rates[1] * state.share,
        none = Math.exp(-(lh + la));
      markets.push({
        id: 'next:' + (total + 1),
        kind: 'next',
        goal: total + 1,
        title: 'NEXT GOAL',
        outcomes: [
          { key: 'home', label: home, p: lh + la > 0 ? (lh / (lh + la)) * (1 - none) : 0 },
          { key: 'none', label: 'NO GOAL', p: none },
          { key: 'away', label: away, p: lh + la > 0 ? (la / (lh + la)) * (1 - none) : 0 },
        ],
      });
      // Total goals: every line not yet passed.
      for (const line of SPORTSBOOK_TOTAL_LINES) {
        if (total > line) continue;
        const over = sportsbookSum(grid, state.scores, (x, y) => x + y > line);
        markets.push({
          id: 'total:' + line,
          kind: 'total',
          line,
          title: 'TOTAL GOALS ' + line,
          outcomes: [
            { key: 'over', label: 'OVER ' + line, p: over },
            { key: 'under', label: 'UNDER ' + line, p: 1 - over },
          ],
        });
      }
      if (!(h > 0 && a > 0)) {
        const yes = sportsbookSum(grid, state.scores, (x, y) => x > 0 && y > 0);
        markets.push({
          id: 'btts',
          kind: 'btts',
          title: 'BOTH TEAMS TO SCORE',
          outcomes: [
            { key: 'yes', label: 'YES', p: yes },
            { key: 'no', label: 'NO', p: 1 - yes },
          ],
        });
      }
      // Correct score: the scores still possible, and ANY OTHER.
      const scores = SPORTSBOOK_CORRECT_SCORES.filter(([x, y]) => x >= h && y >= a),
        exact = scores.map(([x, y]) => ({
          key: x + '-' + y,
          label: x + ' - ' + y,
          p: sportsbookSum(grid, state.scores, (fx, fy) => fx === x && fy === y),
        }));
      const listed = exact.reduce((sum, o) => sum + o.p, 0);
      exact.push({ key: 'other', label: 'ANY OTHER', p: Math.max(0, 1 - listed) });
      markets.push({ id: 'cs', kind: 'cs', title: 'CORRECT SCORE', outcomes: exact });
      // Half-time result: before the break only.
      if (state.preMatch || (state.stage === 'live' && state.period === 0)) {
        const half = sportsbookGrid(rates, state.halfShare);
        markets.push({
          id: 'ht',
          kind: 'ht',
          title: 'HALF-TIME RESULT',
          outcomes: [
            { key: 'home', label: home, p: sportsbookSum(half, state.scores, (x, y) => x > y) },
            { key: 'draw', label: 'DRAW', p: sportsbookSum(half, state.scores, (x, y) => x === y) },
            { key: 'away', label: away, p: sportsbookSum(half, state.scores, (x, y) => x < y) },
          ],
        });
      }
      return markets;
    }

    /* The price ladder real books quote: the step size for odds at or above `from`. */
    const SPORTSBOOK_LADDER = [
      [1.01, 0.01],
      [2, 0.02],
      [3, 0.05],
      [4, 0.1],
      [6, 0.2],
      [10, 0.5],
      [20, 1],
      [30, 2],
      [50, 5],
      [100, 10],
      [200, 50],
    ];
    function sportsbookLadder(odds) {
      if (!(odds > 1.01)) return 1.01;
      if (odds >= 1000) return 1000;
      let step = 0.01,
        from = 1.01;
      for (const [start, size] of SPORTSBOOK_LADDER) if (odds >= start) [from, step] = [start, size];
      // Round down (in the house's favour), clear of float noise.
      return Math.round((from + Math.floor((odds - from) / step + 1e-9) * step) * 100) / 100;
    }

    /**
     * Fair probabilities -> offered odds with the margin (the power method).
     * Impossible outcomes (p = 0) are dropped. Returns the outcomes with `odds`
     * and `implied` (1 / odds), or null when one outcome is all but certain.
     */
    function sportsbookPriceOutcomes(outcomes, margin) {
      const live = outcomes.filter((o) => o.p > 1e-7);
      if (!live.length || live.some((o) => o.p > 0.99)) return null;
      // A near-certain market carries less margin (as on a real book), or the
      // power method would load it all on the longshot: full margin up to an
      // 80% favourite, down to half of it for a 90% one and beyond.
      const favourite = Math.max(...live.map((o) => o.p)),
        target = 1 + margin * Math.max(0.5, Math.min(1, (1 - favourite) / 0.2)),
        total = (k) => live.reduce((sum, o) => sum + Math.pow(o.p, k), 0);
      let low = 0.2,
        high = 1;
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (total(mid) > target) low = mid;
        else high = mid;
      }
      const k = (low + high) / 2;
      return live.map((o) => {
        const odds = sportsbookLadder(1 / Math.pow(o.p, k));
        return { ...o, odds, implied: 1 / odds };
      });
    }

    /* Priced markets: each with `book`, the sum of its implied probabilities. */
    function sportsbookPricedMarkets(fixture, state) {
      const markets = [];
      for (const market of sportsbookFairMarkets(fixture, state)) {
        const priced = sportsbookPriceOutcomes(market.outcomes, market.kind === 'cs' ? SPORTSBOOK_MODEL.correctScoreMargin : SPORTSBOOK_MODEL.margin);
        markets.push({
          ...market,
          outcomes: priced || market.outcomes.map((o) => ({ ...o, odds: null, implied: 0 })),
          closed: !priced,
          book: priced ? priced.reduce((sum, o) => sum + o.implied, 0) : 0,
        });
      }
      return markets;
    }

    // The fractional prices a bookmaker chalks up, for the nearest-price display.
    const SPORTSBOOK_FRACTIONS = [
      [1, 100], [1, 50], [1, 33], [1, 25], [1, 20], [1, 16], [1, 14], [1, 12], [1, 10], [1, 9], [1, 8], [2, 15], [1, 7], [1, 6],
      [2, 11], [1, 5], [2, 9], [1, 4], [2, 7], [3, 10], [1, 3], [4, 11], [2, 5], [4, 9], [1, 2], [8, 15], [4, 7], [8, 13], [4, 6],
      [8, 11], [4, 5], [5, 6], [10, 11], [1, 1], [21, 20], [11, 10], [6, 5], [5, 4], [11, 8], [6, 4], [13, 8], [7, 4], [15, 8],
      [2, 1], [9, 4], [5, 2], [11, 4], [3, 1], [10, 3], [7, 2], [4, 1], [9, 2], [5, 1], [11, 2], [6, 1], [13, 2], [7, 1], [15, 2],
      [8, 1], [17, 2], [9, 1], [10, 1], [11, 1], [12, 1], [14, 1], [16, 1], [18, 1], [20, 1], [22, 1], [25, 1], [28, 1], [33, 1],
      [40, 1], [50, 1], [66, 1], [80, 1], [100, 1], [125, 1], [150, 1], [200, 1], [250, 1], [300, 1], [400, 1], [500, 1], [750, 1], [999, 1],
    ];
    function sportsbookFormatOdds(odds, format = 'decimal') {
      if (!odds) return '—';
      if (format === 'american') {
        const profit = odds - 1;
        return profit >= 1 ? '+' + Math.round(profit * 100) : '-' + Math.round(100 / profit);
      }
      if (format === 'fractional') {
        const profit = odds - 1;
        let best = SPORTSBOOK_FRACTIONS[0];
        for (const f of SPORTSBOOK_FRACTIONS)
          if (Math.abs(Math.log(f[0] / f[1]) - Math.log(profit)) < Math.abs(Math.log(best[0] / best[1]) - Math.log(profit))) best = f;
        return best[0] === best[1] ? 'EVS' : best[0] + '/' + best[1];
      }
      return odds.toFixed(2);
    }
    // END SUBSYSTEM: src/sportsbook-odds.js
