// A city reset replaces match objects, but deducted stakes and the saved book
// are progress. Exercise the real reset chain and existing restore/settle rules.
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../../src/' + name + '.js', import.meta.url), 'utf8');
function functionSource(file, name) {
  const source = read(file), start = source.indexOf('    function ' + name + '(');
  if (start < 0) throw Error('Missing production function ' + name);
  return source.slice(start, source.indexOf('\n    }', start) + 6);
}

export default async function (t) {
  const source = read('sportsbook'), start = source.indexOf('    const sportsbook = {'),
    end = source.indexOf('    function sportsbookToken(', start),
    state = source.slice(start, end), noop = () => {};
  const functions = ['sportsbookToken', 'sportsbookMatch', 'sportsbookMoney', 'sportsbookLog',
    'sportsbookSuspended', 'sportsbookPlace', 'sportsbookTrim', 'sportsbookSettle',
    'sportsbookGoal', 'sportsbookHalfTime', 'sportsbookFullTime', 'sportsbookVoidAll',
    'sportsbookUpdate', 'sportsbookSaveData', 'loadSportsbook', 'resetSportsbook'];
  function fixture(stage) {
    const scope = vm.createContext({ Math, Number, Object, Array, Set, performance,
      SPORTSBOOK_HISTORY: 40, SPORTSBOOK_SUSPEND: 6, SPORTSBOOK_LINES: { clerk: ['win'] },
      cash: 1000, wantedStars: 0, worldMinutes: 900, gameTime: 10, gameMode: 'play',
      player: { car: null }, randomSeed: 10, worldPopulateSeed: null, worldResetSerial: 0,
      worldResetLog: { count: 0, byReason: {}, last: null }, vehicles: [], bullets: [],
      sportsMatches: { basketball: null, soccer: null },
      sportsAbandoned: { basketball: null, soccer: null }, sportsTargetList: [], sportsStepAccumulator: 0,
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)), clockText: () => '15:00',
      sportsBoardClock: () => '00:00', sportsbookInside: () => false,
      closeSportsbook: noop, tell: noop, tone: noop, save: noop,
      staffSportsbook: noop, updateSportsbookReactions: noop, renderSportsbook: noop,
      sportsbookClerkSays: noop, sportsbookPuntersReact: noop,
      randomChoice: a => a[0], worldDamageCounts: () => ({}), clearPolice: noop,
      resetOfficerCrews: noop, clearCarStains: noop, resetWreckPass: noop,
      clearBleeders: noop, resetCrowdLife: noop, restoreAllStreetProps: noop,
      dealershipWorldReset: noop, worldResetFade: noop, populateStoryWorld: noop,
      populateCounty: noop, populateCivilHelicopters: noop,
    });
    scope.sportsFollowSchedule = sport => {
      scope.sportsMatches[sport] = { stage, phase: 'play', period: 0, scores: [0, 0],
        fixture: { id: sport + '-fixture-1' }, teams: [{ short: 'HOME' }, { short: 'AWAY' }], abandoned: false };
    };
    const api = vm.runInContext(state + '\n' + functions.map(name => functionSource('sportsbook', name)).join('\n') + '\n' +
      functionSource('sports-setup', 'resetSports') + '\n' + functionSource('world-reset', 'populateWorld') + '\n' +
      functionSource('world-reset', 'resetWorld') + `
      function populate() { resetSports(); }
      function sportsbookRefreshMarkets() { sportsbook.state = { scores: [0, 0] }; }
      function sportsbookFindOutcome() {
        return { market: { id: 'result', kind: 'result', title: 'Match result', closed: false },
          outcome: { label: 'Home', odds: 2 } };
      }
      ({ resetSports, resetWorld, sportsbookPlace, sportsbookSettle, sportsbookUpdate,
        sportsbookSaveData, loadSportsbook, book: sportsbook });`, scope);
    api.resetSports();
    api.book.format = 'american';
    const history = api.sportsbookPlace('result', 'away', 50);
    api.sportsbookSettle(history, 'lost', 'OLD FULL TIME');
    const bet = api.sportsbookPlace('result', 'home', 100);
    return { scope, api, historyId: history.id, betId: bet.id, token: bet.token };
  }
  for (const reason of ['wasted', 'busted']) for (const stage of ['upcoming', 'live']) {
    const { scope, api, historyId, betId, token } = fixture(stage), label = reason + '/' + stage;
    const oldMatch = scope.sportsMatches.soccer;
    t.assert(scope.cash === 850, label + ': setup did not deduct the stakes');
    api.resetWorld(reason);
    t.assert(scope.sportsMatches.soccer !== oldMatch, label + ': world did not rebuild the match');
    t.assert(api.book.bets.length === 2, label + ': reset discarded open bets or history');
    t.assert(api.book.stats.placed === 2 && api.book.stats.staked === 150 && api.book.stats.lost === 1,
      label + ': reset discarded betting statistics');
    t.assert(api.book.format === 'american' && api.book.nextId === 3, label + ': reset lost format or next id');
    t.assert(scope.cash === 850, label + ': reset charged/refunded a stake before existing restore rules');
    api.sportsbookUpdate(0);
    const bet = api.book.bets.find(b => b.id === betId), history = api.book.bets.find(b => b.id === historyId);
    t.assert(history?.status === 'lost' && history.result === 'OLD FULL TIME', label + ': settled history changed');
    if (stage === 'upcoming') {
      t.assert(bet?.status === 'open' && bet.token !== token && bet.token === scope.sportsMatches.soccer.bookToken,
        label + ': upcoming stake was not rebound to its rebuilt fixture');
      t.assert(scope.cash === 850, label + ': restoring an upcoming stake changed cash');
      scope.sportsMatches.soccer.stage = 'fulltime';
      scope.sportsMatches.soccer.period = 1;
      scope.sportsMatches.soccer.scores = [1, 0];
      api.sportsbookUpdate(0);
      t.assert(bet?.status === 'won' && bet.payout === 200 && scope.cash === 1050,
        label + ': retained bet did not pay its original price');
      t.assert(api.book.stats.won === 1 && api.book.stats.returned === 200, label + ': win statistics wrong');
    } else {
      t.assert(bet?.status === 'void' && bet.payout === 100, label + ': interrupted live stake was not voided');
      t.assert(scope.cash === 950 && api.book.stats.void === 1 && api.book.stats.returned === 100,
        label + ': interrupted live stake was not refunded exactly');
    }
    const cash = scope.cash, stats = JSON.stringify(api.book.stats);
    api.sportsbookUpdate(0);
    t.assert(scope.cash === cash && JSON.stringify(api.book.stats) === stats, label + ': repeated update paid twice');
    const saved = api.sportsbookSaveData();
    api.loadSportsbook(saved);
    t.assert(api.book.bets.length === 2 && api.book.format === 'american' && api.book.nextId === 3,
      label + ': preserved book cannot round-trip through save data');
  }
  for (const stage of ['upcoming', 'live']) {
    const { scope, api } = fixture(stage);
    api.resetWorld('new-game');
    t.assert(api.book.bets.length === 0 && api.book.nextId === 1, stage + ': new game kept old bets');
    t.assert(Object.values(api.book.stats).every(n => n === 0), stage + ': new game kept old betting statistics');
    t.assert(scope.cash === 850, stage + ': book reset unexpectedly changed the caller-owned new-game cash');
  }
  t.note('actual city/sports reset chain, bet placement, save restore and settlement: death/arrest retain progress; interrupted live stakes refund once; new game clears');
}
