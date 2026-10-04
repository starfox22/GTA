# Handoff: where the project stands and how to carry on

Written for the next AI session (or human) picking this work up. Read `/CLAUDE.md` first (commands,
rules, workflow), then this page, then only the area doc your task needs (`docs/README.md`).

## State

- **The game**: Dead End City, a browser top-down 1997 crime game (Three.js 3D with a 2D fallback).
  Version 0.9.0 is the **public demo**: free roam over the whole map plus story missions 1 (the harbour
  job) and 2 (the Blue Hour hotel hit). Missions 3+ are gated for regular players (`DEMO_BUILD`,
  `demoLocked()`; god mode lifts the gates). Bug passes and polish target free roam and missions 1-2 only.
- **Branches**: `claude/stoic-newton-qvpewc` is the working branch; `main` is the owner's approved game and
  was fast-forwarded to it when the owner approved. Never push `main` without the owner's explicit approval in
  the current conversation (the owner has given it for specific releases: ask each time unless they say
  "push to main when done").
- **Published build**: the claude.ai artifact https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B (split build:
  `index.html` + `media/`). Version numbers on that link are the artifact's own counter, not `GAME_VERSION`.
  The downloadable zip is built by CI for whatever branch is pushed.
- **Tests**: `node tools/test.mjs` runs the whole regression suite (about 80 tests, ~18 minutes on the 4-core
  cloud box; the runner always loads the no-render page). It must be green before a publish. Known flake:
  `carjack-traffic` fails about one run in four when the picked traffic car stands beside a bike-share dock
  (E rents a bike instead).

## The owner's standing preferences (keep following them)

- AAA realism, never cartoonish: no floor rings or glow pads (the floating arrow is the only objective
  pointer), no stars over downed people, no health boxes on the street (health is bought indoors), blood only
  where it belongs (`bleed()`; pools only under bodies; car stains through `addCarStain`), smoke only from
  burnouts, believable pedestrians (they react to what they can see or hear).
- Performance matters on every graphics tier (low, medium, high, ultra, auto): measure before and after, prefer
  counts (draw calls, programs, allocations) to noisy milliseconds, remove hiccups (first uses are warmed in the
  title prewarm).
- At most 4 helper agents at once and no more than 4 browser pages (`DEC_BROWSER_SLOTS` stays at 2).
- Publish only the link unless told otherwise; update the same artifact URL (CLAUDE.md "Publish").
- Every change gets a regression test where practical, a `docs/changes/` fragment, the area doc updated and a
  CLAUDE.md contract line when other code must keep a rule.

## How the last sessions worked (a pattern that held up)

1. The lead reads the request, finds the code with `grep -i word docs/FILEMAP.md`, writes **precise briefs**
   (files, symbols, the check to run, the output wanted) and launches up to 4 `game-dev` helpers, each in its own
   git worktree. Briefs always include: merge the lead branch first, commit on the worktree branch only, never
   push or touch main, run `sh tools/quick-check.sh`, the attribution lines for commits, a timebox, and a
   short final report.
2. The lead merges each helper branch as it reports (`git merge --no-edit worktree-agent-<id>`); a
   `docs/FILEMAP.md` conflict is resolved with `git checkout --ours docs/FILEMAP.md && python3 tools/filemap.py`.
   Never `git commit -a` while a merge has conflicts. The lead (not the helpers) edits CLAUDE.md.
3. Full suite, then `python3 tools/build.py --split-media dist/publish`, `node tools/smoke.mjs
   dist/publish/index.html dist/smoke` (0 errors; the three.js deprecation warning is normal),
   `node tools/media-check.mjs dist/publish/index.html` (9 tracks, 0 failed), then publish with the Artifact tool
   (CLAUDE.md "Publish": a `files` map entry for every file in `dist/publish/media/`, `force: true`).
4. `main` (only with approval): `git fetch -q origin main && git merge-base --is-ancestor origin/main HEAD &&
   git push origin claude/stoic-newton-qvpewc:refs/heads/main` (a plain fast-forward).

Lessons: worktrees can start far behind (merge the lead branch first); a container restart stops background
helpers but their worktrees survive, so resume them with `SendMessage` to the agent id; removing other
worktrees is denied by the permission classifier (leave them); browser slots are the bottleneck, so stop dev
servers (`node tools/dev.mjs stop`) between runs; a leftover server breaks test boots; two files declaring one
top-level function silently override each other (quick-check now fails on it); software GL (SwiftShader) cannot
measure GPU cost, so real-GPU gains of render changes are unverified.

## What changed in the latest rounds (read the fragment for details)

| Round | Topics | Where |
| --- | --- | --- |
| Night and driving feel | headlights without blow-out and with occlusion, no tyre smoke except burnouts, realistic blood per shot, bike falls and wheelies, drive-by arcs and cross, parachute opening, health only indoors | `docs/changes/2026-09-28-*`, area docs for blood, vehicle lights, driveby, vehicles |
| Carjack and stars | the full carjack struggle and pull-out, no stars over downed people | `2026-09-28-carjack-struggle` |
| Rings, signs, hotels, car blood | no ground rings, optional player ring, no stale demo arrow (`settleDemoStoryIndex`), no stray signs (`roadsideSign`), motels with real entrances (`dressHotel`), vehicle blood stains | `2026-09-30-*`, `areas/places-and-venues.md`, `areas/police-and-combat-blood.md` |
| Efficiency | simulation (`hypot2`, `rectListBlocked`, counted lists, parked-vehicle settle skip), rendering (title prewarm, staged tier change, cell pre-upload), boot time, soak and A/B tools | `2026-10-01-*`, `2026-10-02-*`, `areas/rendering-hiccups.md`, `areas/boot-and-memory.md`, `audit/performance.md` |
| Pedestrians and cars | awareness (`watchVehicle`), second run-over (`runOverDowned`), bloodier hood with long streaks | `areas/people-and-crowd-vehicles.md` |
| Bug passes | missions 1-2 under the demo gate, free roam, the random-walk bot, cab-ride crash | `2026-10-02-*`, `tools/bot.mjs`, `docs/BACKLOG.md` |
| Edge and wrecks | world-edge countdown, wreck and abandoned-car limit | `2026-10-03-*`, see below |

## Rules added in the latest rounds (also in CLAUDE.md)

- **Wrecks and abandoned cars** (`src/livingcity-wrecks.js`, `WRECK_LIMITS`; rule and constants in
  `docs/areas/people-and-crowd-living-city.md`, numbers in `docs/audit/performance.md`): wrecks go after 50 s
  unseen, abandoned cars after 180 s, world-wide caps 16 and 24 (oldest first); nothing on screen, within 1,200
  units of the player, owned, occupied, police or mission-related is touched. The limit is world-wide because
  every vehicle that stays costs physics time wherever it is. Console `wreckReport()`.
- **World edge** (`src/world-edge.js`; `docs/areas/world-and-map.md`): the line is 24 m inside the world box,
  clear of all land. A calm APPROACHING THE WORLD EDGE card appears when an edge is within ~25 s of travel along
  the player's velocity (or 400 m while closing); past the line a 10 s RETURN TO THE CITY countdown runs, and at
  zero the vehicle explodes and the player is wasted (on foot or swimming they die; god mode only warns).
  Console `worldEdge()`. The courier plane turns back in time; the jet cannot turn inside the box at full speed.

## Open items and design questions (owner's call; details in docs/BACKLOG.md)

- Treatment ($150), body armour ($350) and meals charge full price at full health or armour.
- Mission 4's "GO HOME" goal now ends at the SUNSET MOTEL (the free-standing safehouse was removed); it is not
  in the demo.
- The night-and-rain mission scenario at HIGH graphics was never re-run after a container restart; real-GPU
  frame costs of the prewarm, staged tier change and cell pre-upload are unmeasured (only counts were).
- Remaining performance levers: an active-vehicle list for parked cars (exactness constraints in BACKLOG),
  heavy scenes with many awake police or gang members, a JS heap creep of ~0.1-0.2 MB per teleport stop.

## Where things are (fast index)

`docs/FILEMAP.md` (every file), `docs/README.md` (area docs), `docs/console/README.md` (named console
methods; no eval-style hooks, ever), `docs/areas/testing-and-console.md` (tests, dev server, bot, soak, A/B),
`docs/audit/` (QA logs and the performance audit), `docs/BACKLOG.md` (open issues per feature),
`docs/changes/` (one fragment per change; folded into `docs/CHANGELOG.md` at release only when the owner asks).
