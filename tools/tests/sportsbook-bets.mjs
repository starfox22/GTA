// GOALLINE sportsbook: a live fixture takes bets at the showing price, refuses a stake
// over the cash, and a goal settles the next-goal market with the right payout.
// The old flake: the book starts tracking a new match object (its score) on the first
// frame after matchDay, so a bet and a goal sent before any frame ran left the goal
// unseen; and a real goal could land between console calls. So: one stepped frame to
// track the match, then the simulation is held and only stepped by simulate().
// And the cash is the test's own: a kill pays the player $10, and the soundscape test
// before it used to end with its shotgun pellets still in flight down a busy Midtown
// sidewalk ("cash after settlement: 1001"). So first two held seconds for anything
// left in the air to land (a rocket lives 1.8 s), then the fixture.
export default async function (t) {
  await t.call('holdSimulation', true);
  try {
    await t.wait(2);
    const m = await t.call('matchDay', 1, 10);
    t.assert(m.stage === 'live', 'fixture not live: ' + m.stage);
    await t.wait(1 / 30);
    await run(t);
  } finally {
    await t.call('holdSimulation', false);
  }
}
async function run(t) {
  await t.call('wanted', 0); // the shop takes no bets from a wanted man
  await t.call('setCash', 1000);
  const tooMuch = await t.call('sportsbookBet', 'result', 'home', 5000);
  t.assert(tooMuch.error, 'a $5000 stake on $1000 cash was accepted');
  const bet = await t.call('sportsbookBet', 'next:1', 'home', 10);
  t.assert(!bet.error, 'bet refused: ' + bet.error);
  t.assert(bet.cash === 990 && bet.odds > 1, `after bet: cash ${bet.cash}, odds ${bet.odds}`);
  const other = await t.call('sportsbookBet', 'result', 'away', 20);
  t.assert(!other.error && other.cash === 970, 'second bet: ' + JSON.stringify(other));
  await t.call('stadiumGoal', 0);
  await t.wait(0.1); // bets settle in the frame update after the goal
  const book = await t.call('sportsbook');
  const won = book.settled.find((b) => b.id === bet.id);
  t.assert(won && won.status === 'won', 'next-goal bet not settled as won: ' + JSON.stringify(won));
  t.near(won.payout, Math.floor(10 * bet.odds), Math.ceil(10 * bet.odds), 'payout $');
  t.assert(book.open.some((b) => b.id === other.id), 'match-result bet should still be open');
  t.near(book.cash, 970 + Math.floor(10 * bet.odds), 970 + Math.ceil(10 * bet.odds), 'cash after settlement');
}
