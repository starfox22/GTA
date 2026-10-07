# Handoff: where the project stands and how to carry on

Written for the next AI session (or human) picking this work up. Read `/CLAUDE.md` first (commands,
rules, workflow), then this page, then only the area doc your task needs (`docs/README.md`).

## State

- **The game**: Dead End City, a browser top-down 1997 crime game (Three.js 3D with a 2D fallback), now with a
  second camera: V switches the overhead STREET view and a GTA IV-style third-person CHASE view (October 6-7
  round, branch `claude/trusting-cannon-seq2mv`; not on `main` until the owner approves).
  Version 0.9.0 is the **public demo**: free roam over the whole map plus story missions 1 (the harbour
  job) and 2 (the Blue Hour hotel hit). Missions 3+ are gated for regular players (`DEMO_BUILD`,
  `demoLocked()`; god mode lifts the gates). Bug passes and polish target free roam and missions 1-2 only.
- **Branches**: `main` is the owner's approved game. On October 6 the owner approved moving the working
  branch `claude/tender-babbage-3t74xl` (rounds of October 4-6) to `main`, so both held the same commit then.
  A new session develops on its own working branch and fast-forwards `main` only when the owner approves in the
  current conversation (never assume it; the approval covers that one push).
- **Published build**: the claude.ai artifact https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B (split build:
  `index.html` + `media/`; version 53 is the latest round, the build that went to `main` on October 6). Version numbers on that link are the artifact's own
  counter, not `GAME_VERSION`.
  The downloadable zip is built by CI for whatever branch is pushed.
- **Tests**: `node tools/test.mjs` runs the whole regression suite (about 105 tests, ~30 minutes on the 4-core
  cloud box; the runner always loads the no-render page, so the render-* tests are null checks there: run them
  on a rendered page when a render change needs them). It must be green before a publish. Known flakes:
  `carjack-traffic` fails about one run in four when the picked traffic car stands beside a bike-share dock
  (E rents a bike instead); `living-medics` failed once (medics never reached the victim) and passed on rerun;
  the `hypot2` timing check in `sim-audits` fails under heavy CPU load (a smoke run beside it); `camera-feel`'s
  on-foot aim lead read zero about one run in fourteen (the lead target is exactly 0 with the pistol and the aim
  set, so an early return in cameraLeadTarget: fall/thrown/ride; the test now notes `integrity()` carriers when it
  happens); `living-key` failed once with a traffic car parked on the visitor spawn and passed on rerun;
  `wheelie`'s real-key part (W + ↑ held for 1.2 s of wall clock) lifts only ~2.5° when three browsers share the
  4-core box (the base build fails the same way under that load); `living-medics` once ended a lost run as
  revived and passed on rerun; `police-search-clock` once found no room for its cruiser (traffic) and passed.

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
   git push origin HEAD:refs/heads/main` (a plain fast-forward; refuse and ask if it is not one).

Lessons: a `fresh` test's reload rebuilds the page from the working tree, so never merge while a suite runs;
run the final suite in a frozen detached worktree (`git worktree add --detach .claude/worktrees/lead-suite
<commit>`) and keep merging in the main checkout. Count open browsers with `ps` (a frozen dev server keeps its
browser open without a slot): the owner's cap is 4 browsers machine-wide, so 4 helpers means the lead opens none.
Tests that pin positions on a trail or road break when it is re-laid: read spots off the data (`trailProfile`).
Worktrees can start far behind (merge the lead branch first); a container restart stops background
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
| October 4 round | police search clock (shown only while it runs, shorter times), second god-mode code, big TELEPORT map, driving camera (wider, speed pull-back, damped follow, `cameraComfort`), bonnet blood by speed (`carStainSeverity`), hill climb (`rideStep` suspension, hand-laid Mount Ascent trail, rock/ford dressing), liner grand tour and deck landings (`deck-landing.js`), see-through foliage, world-edge card off land, missions 1-2 and free-roam bug passes (replay frontier, `restartableJob`, fair harbour fight, ABANDON confirm, HUD clearance), performance (frame trace, `hitches.mjs`, DOM writes, buffer ranges, vehicle layouts and allocations, merged car parts) | `docs/changes/2026-10-0[34]-*`, CLAUDE.md rules, `audit/performance.md` (fourth and fifth pass) |
| October 5 round | open sea (RETURN TO THE CITY countdown after 10 s heading away from land, then a missile; replaces the world-edge warning), ride head-look on the Sunset Eye and the Falcon (`ride-look.js`), sound check (`soundOffText`, saved mute and master volume, `MIX_MAKEUP`, `wakeAudio`) | `docs/changes/2026-10-05-*`, `areas/world-and-map.md`, `areas/places-and-venues.md`, `areas/audio-and-radio.md` |
| October 6-7 round: the chase view | (plus, for both views: roof finishes and road wear, `2026-10-07-street-ground`; the chase view's draw budget, `2026-10-07-chase-budget`) V toggles a third-person CHASE camera (game-side `chaseCam` with its own projection; pointer lock or CURSOR LOOK, pad, touch; over-the-shoulder aim, lock-on, look behind, close-quarters crane); every on-screen rule asks it (`chase-rules.js`); its HUD layout; draw distance and level of detail (far copy, casters, props, people and vehicles by distance); sky dome, aerial haze, clouds from below, sun glare; rain at street level; shopfronts on every side; car cabins with seated people; a near body set for people up close; broken-glass crumbs; camera motion blur; a darker night at street level (CHASE NIGHT); the radio chip | `docs/changes/2026-10-06-*` (chase-camera, chase-lod, chase-rules, sky, street-rain, street-facades, close-cars, close-people), `areas/chase-view.md`, `areas/chase-view-input.md`, `areas/rendering-chase.md` |
| October 6 round | motion comfort: vehicle camera one step further back (1.12), flatter speed zoom, shorter slower lead, Settings · Gameplay · Motion comfort and Settings · Driving · Vehicle camera distance | `docs/changes/2026-10-06-motion-comfort.md`, CLAUDE.md camera rule |

## Rules added in the latest rounds (also in CLAUDE.md)

- **Chase view** (`src/chase-camera.js`, `chase-rules.js`, `chase-view3d*.js`; docs/areas/chase-view.md): the camera
  is game state (`chaseCam`, `chaseProject`/`chaseRay`/`chaseSees`/`chaseAimPoint`), the renderer only copies it.
  While `chaseCameraLive()`, every "is it on screen" rule asks the chase camera (`crowdInView`, `spotUnseen`,
  `shooterInView`), aim code reads `aim()`/`chaseAimScreen()`, movement keys go through `playerMoveHeading()`, and the
  street view's paths stay bit-identical when the chase view is off. The level-of-detail, frontage, cabin and rig
  rules have their own CLAUDE.md lines.

- **Wrecks and abandoned cars** (`src/livingcity-wrecks.js`, `WRECK_LIMITS`; rule and constants in
  `docs/areas/people-and-crowd-living-city.md`, numbers in `docs/audit/performance.md`): wrecks go after 50 s
  unseen, abandoned cars after 180 s, world-wide caps 16 and 24 (oldest first); nothing on screen, within 1,200
  units of the player, owned, occupied, police or mission-related is touched. The limit is world-wide because
  every vehicle that stays costs physics time wherever it is. Console `wreckReport()`.
- **Open sea** (`src/world-edge.js`; `docs/areas/world-and-map.md`): nothing over or near land. After 10 s
  flying or sailing away from all land a 10 s RETURN TO THE CITY countdown runs (heading back winds it up and
  clears it); at zero a missile from the coast kills the player in whatever they are in (god mode only warns).
  Console `worldEdge()`.
- **Ride head-look** (`src/ride-look.js`): on the Eye and the Falcon the pointer, a touch drag or the right stick
  turns the rider's head; the ride camera only reads `rideLookAngles()`. Console `rideLook()`.
- **Sound that is off is said on screen** (`soundOffText()`, audio.js): mute and master volume are saved, so a
  silent game always explains itself.
- **Motion comfort** (`motionComfortOn()`, settings.js; camera-drive.js, camera-feel.js, world-view.js): the owner
  gets motion sick. Vehicle framing 1.12 at rest (`CAMERA_CONTEXT.car` 0.56 × `vehicleCameraFactor()`), speed
  pull-back `1 / (1 + 0.0025 g)`, boarding zoom at most ~30 %/s, lead 0.25 of the half frame turning at most
  0.9 rad/s. Motion comfort holds the vehicle zoom fixed (0.86), halves the lead, drops kicks, tremor, the aim
  lean and the flight bank. Keep `cameraComfort()` numbers from rising (tools/tests/camera-comfort.mjs); if the
  owner still feels sick, the next candidates (in BACKLOG) are a steeper street pitch and a frame-rate floor.

## Open items and design questions (owner's call; details in docs/BACKLOG.md)

- The chase view (BACKLOG "Chase view"): no cover system yet (a design question: the player's rounds would hit the
  car they hide behind); motion blur is the camera's own; sky, haze, glare and the new materials were tuned on
  SwiftShader only (check on a real GPU); after the draw budget the chase view still draws ~2.5 times the street
  view's calls (avenue: LOW 474, MEDIUM 913, HIGH 989, ULTRA 1117; rendering-chase-budget.md has the table and what
  is left: crowd part pools, breakable pools, impostor pools).

- Mission 4's "GO HOME" goal now ends at the SUNSET MOTEL (the free-standing safehouse was removed); it is not
  in the demo.
- The night-and-rain mission scenario at HIGH graphics was never re-run after a container restart; real-GPU
  frame costs of the prewarm, staged tier change and cell pre-upload are unmeasured (only counts were).
- Remaining performance levers: an active-vehicle list for parked cars (exactness constraints in BACKLOG),
  heavy scenes with many awake police or gang members, a JS heap creep of ~0.1-0.2 MB per teleport stop, the
  ~640 KB/frame the simulation still allocates (controlVehicle, boxContact, footprintOffGround, solid, blood tracks,
  83 pedestrian layouts), `drawBikeShareMap` (up to 7 ms with the minimap pulled back at speed), the parts each
  pristine car still draws apart (shell, cabin, trim, DRL, front wheels, wipers) and instanced shells for distant
  traffic. GPU costs (foliage cutaway, wider driving view) are unmeasured: SwiftShader only counts.
- The liner cannot circle every island: they are joined by bridges she never passes under and the east and south
  coasts lie almost on the world edge; her tour covers the north and west coasts (BACKLOG has the deck notes).
- Mission 1's police chase all the way to Vinny's warehouse is not proven end to end by a test (the route pilot
  `followRoute` crosses the bridge but loses the last turns to a dozen officers); the surrender rule
  (`trackSurrender`) counts a wedged driver holding the throttle as giving up (owner's call).

## Where things are (fast index)

`docs/FILEMAP.md` (every file), `docs/README.md` (area docs), `docs/console/README.md` (named console
methods; no eval-style hooks, ever), `docs/areas/testing-and-console.md` (tests, dev server, bot, soak, A/B),
`docs/audit/` (QA logs and the performance audit), `docs/BACKLOG.md` (open issues per feature),
`docs/changes/` (one fragment per change; folded into `docs/CHANGELOG.md` at release only when the owner asks).
