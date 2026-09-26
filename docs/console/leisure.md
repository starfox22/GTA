# Console: leisure

`addConsoleMethods('leisure', …)` in `src/game-console-leisure.js`. Beach, sea and leisure: swimming, beach, sea life, the Marea club and pool, volleyball, Sunset Pier. It also registers the feature consoles below.

| Method | Purpose |
| --- | --- |
| `swim()`, `ladders()` | The player and the water (swimming, wading, stamina, shore type, nearest way out); every ladder out of the sea |
| `beach()` | Palm Keys Beach: crowd density for the hour, who is there and what they are doing, prop counts |
| `sealife()` | Sea life (sealife.js): the sea field's state and the player's distance from land (m), dolphins (rate per game hour, sightings, each pod with its members' modes and depths, bow riding), gulls (pool, by mode, active flocks with perches, following boats), the shark (mode, position, depth, fin, speed, beach pass, distance), the encounter (phase, t, window, interest, cooldown, way out, counts of encounters / escapes / attacks, last outcome), the beach alarm, the last 24 log lines (interest → warning → circling → dive → breach / escape) and `render` (instances drawn, spray, rings, blood, life map on, draw calls, offscreen calls, CPU ms, triangles per model) |
| `sharkAttack(stage)` | Start the shark encounter now (the player is put in deep water off Palm Keys Beach first if not already in the shark's water): `'approach'` (default), `'circle'`, `'breach'` (straight to the attack); `'fin'` brings the fin up near the player without an encounter, `'beach'` starts a pass along the beach's buoy line (the SHARK! alarm). God mode is honoured. Returns `sealife()` |
| `spawnDolphins(count, x, y, leap)` | A pod of `count` dolphins near the player (or at x, y); with `leap` (default) each leaps within a few seconds |
| `beachClub(action)` | Marea Beach Club: phase, levels, people by slot kind, mode and pose, the queue and the conversation at the door, admitted/rejected/evacuated counts, the music (set, bar, section, gain, wall cutoff); `'trouble'` raises gunfire on its dance floor |
| `clubPool()`, `clubPoolEdge()` | The Marea pool: water rect, the player's phase (dive / swim / out), SWIM / GET OUT offered, breath, club swimmers; stand on its south deck |
| `clubTalk()`, `clubTalkApproach()` | Club conversations: script count by personality, the running one (lines, pose), the bubbles; stand beside the nearest talkable club-goer |
| `volley()`, `volleyJoin(team)`, `volleyLob()`, `volleyCourtCheck()` | Beach volleyball: court, phase, score, ball, players, the player, log; join on a side (0 west, 1 east); lob the ball to the player; the court against the beach plan |
| `themePark()`, `boardRide(kind)` | Sunset Pier: the Falcon's numbers and train, the Eye, fountain and fireworks state, guests, an overlap self-check; board `'coaster'` or `'wheel'` (then `interact()` cycles the ride camera) |
| `coasterVoices(reset)` | The Falcon riders' voices: running, track position (m), whether the first drop has passed, who is speaking, and the log of every scream cue (`first drop`, `drop`, `dip`, `airtime`, `inversion`: game time, car, track m, height m, vertical speed m/s, seat g, drop depth, voices played, lines said) and rider line (`say lift`, `say end`); `reset` clears the log |

## sports (`sportsConsole() in src/sports-frame.js`)

| Method | Purpose |
| --- | --- |
| `match(sport)` | A venue's fixture (`'soccer'` default, `'basketball'`): stage, clock, score, status, crowd, who is on the field, fleeing or dead, abandoned, pitch invader, the player's goals |
| `matchDay(day, minutesFromKickoff, slot, sport)` | Set the world clock relative to a fixture's kickoff (day 1 is the first day; negative minutes are the warm-up) and start that fixture afresh |
| `fixtures(sport, days)` | The coming fixtures |
| `ballState()`, `ballToPlayer(distance)` | The stadium ball (position, height, mode, owner, speed, whether the player is on the pitch); put it in front of the player |
| `stadiumGoal(team, byPlayer)`, `stadiumSound()` | Score a goal for team 0 (home) or 1 (away) at the stadium now, optionally as the pitch invader (whistle, cheer, boards); the stadium's sound: goal reactions playing (target gain, pan and cutoff for where the player is now, and `gainNow`, the live gain gliding to it), the last goal's voices with their distance-based gains, the player's distance and audibility, `bed` (always `null`: there is no crowd bed) |

## sportsbook (`sportsbookConsole() in src/sportsbook.js`)

| Method | Purpose |
| --- | --- |
| `sportsbook()` | GOALLINE, the betting shop by the stadium (sportsbook.js): the shop and its people, the player inside / menu open / prompt, the fixture (ratings, expected goals, stage, clock, score, share of the match left, suspended), every market with fair %, decimal / fractional / American odds and the book %, open and settled bets, totals and a log (placements, goals, settlements with the cash after each) |
| `sportsbookBet(marketId, key, stake)`, `sportsbookSlip(marketId, key, stake)` | Place a bet at the price showing as the slip would (market ids `result`, `next:<n>`, `total:<line>`, `btts`, `cs`, `ht`; keys `home`/`draw`/`away`, `none`, `over`/`under`, `yes`/`no`, `2-1`/`other`); returns the bet or `{ error }` (suspended, closed, under $1, more than the cash). Or only put it on the open menu's slip with that stake |
| `sportsbookShop(open, tab)`, `sportsbookFormat(format)` | Put the player inside the shop in front of the counter and, with `open`, bring up the betting menu on `'markets'` or `'bets'`; the odds format `'decimal'`, `'fractional'` or `'american'` |
