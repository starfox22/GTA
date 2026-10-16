# Handoff: where the project stands and how to carry on

Written for the next AI session (or human) picking this work up. Read `/CLAUDE.md` first (commands,
rules, workflow), then this page, then only the area doc your task needs (`docs/README.md`).

## October 16: independent wheelie controls and rider motion

Continue on **`codex-reviews`**. W/S now supplies throttle/brake by default; dedicated,
remappable ↑/↓ rider weight actions appear in Settings · Controls. Exact saved old default
pairs migrate; custom keys persist. The shift is gated below 3 km/h and fully active at
8 km/h. The Kuzuki can hold a long assisted wheelie within its actual available force,
with forward weight/rear brake recovery, finite bank response and inertia during jumps.
The meter measures actual settled airborne-front travel and celebrates beyond 100/200 m.
Rider motion adds tuck, corner posture, road-facing gaze, signed spills and supported
recovery. Fatal motorcycle falls keep moving and pool after settling through the bounded
hospital handoff. The [wheelie/rider audit](audit/wheelie-rider-review-2026-10-16/README.md)
records native evidence, exact release inputs, validation and simulation limits.

Published [game](https://starfox22.github.io/GTA/?review=e07df7a93ae2ba0f) and
[gallery](https://starfox22.github.io/GTA/review/). [Run 38945460131](https://github.com/starfox22/GTA/actions/runs/38945460131)
verified all 141 public files from `09f5570d`; the [success receipt](audit/wheelie-rider-review-2026-10-16/verification/successful-deployment.json)
retains actual deployment and verification results. This receipt-only follow-up leaves
the game and gallery bytes unchanged.

## October 16: vehicle impacts and motorcycles

Continue on **`codex-reviews`**. The current owner request covers airborne vehicle strikes,
walking away from overlapping car footprints, ROY’s licensed Dolcati/Panigale model,
real Japanese inline-four audio, the KUZUKI 600R name, Up/Down wheelie improvements,
and graphics defaults. See [the impact/motorcycle audit](audit/impact-motorcycle-review-2026-10-16/README.md)
for exact behavior, native screenshots, sound demonstrations, verification and limits.

The source model/credits are documented in [Dolcati source](audit/dolcati-source-2026-10-16/README.md);
[the sound audit](audit/2026-10-16-sportbike-audio.md) distinguishes real inline-four recordings
from an exact GSX-R600 sample. Player outline/ring default off; saved choices persist.
Motion blur is temporarily disabled and removed from Graphics, including old saved enablement.

Final release source is `9cdfb304` (bounded fatal-impact hospital return). The audit retains
qualified full/focused results, native release captures, packaged smoke and streamed audio.
Two known checks remain: the unchanged Mount Ascent pilot timer and the live-world
pedestrian-awareness rate fixture, which also fails the previous published build.

Published [game](https://starfox22.github.io/GTA/?review=871f214e44785d89) and
[review gallery](https://starfox22.github.io/GTA/review/). [Run 38911041748](https://github.com/starfox22/GTA/actions/runs/38911041748)
verified all 121 public files from `321b8de6`; the [success receipt](audit/impact-motorcycle-review-2026-10-16/verification/successful-deployment.json)
retains actual deployment and verification step results. Later documentation/receipt commits
produce the same game and gallery bytes.

## October 15: police, aircraft, airport access and hot rod

Continue from **`origin/codex-reviews`** in `starfox22/GTA`, the same permanent
GitHub branch. Do not start a new branch per owner prompt or move this work to
main without the owner's approval. Browser game: **https://starfox22.github.io/GTA/**;
native comparison and sound gallery: **https://starfox22.github.io/GTA/review/**.
The [verified deployment](audit/police-aviation-review-2026-10-15/verification/successful-deployment.json)
of game commit `6a9decb` passed all 63 public file hashes in run
[38818439357](https://github.com/starfox22/GTA/actions/runs/38818439357).

[Police/aviation review](audit/police-aviation-review-2026-10-15/README.md) lists
the complete change set, exact capture/test inputs, source licences and limits.
It covers straightened police lettering; C172/PC12/turbofan sound families and
shared visual prop RPM; reachable boarding, taxi steering, Cessna rotation,
nose-out stands and matching collision footprints; licensed Coupe 33/Citation/737
assets with source-exact close meshes and shared distant LODs; and the compact
SUV's rocky-trail contact-normal correction. Existing Bell/Cessna, SUV,
motorcycle and C8 source packs remain intact.

The close street view now shares an effective eye between occupant culling and
window tint. The physical orthographic camera's roof/cloud setback must not
hide drivers or force opaque glass; perspective/chase/ride views reset the offset.
Hot rod seat/glass tables use its actual 2.07 m production width. Its tests read
the production dimensions; do not reintroduce a smaller stand-in spec.

Read the linked area docs before changing these paths. Preserve independent
source UV channels (`avOrmSourceUv` on the hot rod), authored split normals,
source-triangle ownership and shared near/far resource protection. The Citation
is an exterior-only optimized export with a native 256px texture, estimated
hinges and no independent turbine blades. The 737 is static airport scenery;
the flyable airliner remains procedural. Do not describe CPU source previews
as game screenshots or software-renderer timings as M4 Max performance.

Two open polish items are explicit in the audit and backlog: deployed Citation
flaps reveal small seams along adapted triangle boundaries, and the scripted
trail pilot can leave the graded path and miss the unchanged 75 s climb target
at 60 Hz. The tested one-comparison controller change was rejected as unsafe;
preserve the corrected rock normals and the original safety assertions.

The Pages workflow also builds the gallery from checked-in native PNGs and
small production-graph MP3s. `tools/verify-pages.py` checks every public file.
The dev-RPC client deliberately uses fresh HTTP connections: a long synchronous
host test can outlive a keepalive socket. Do not add automatic retries around
commands that mutate game state.

## October 15: permanent browser preview

**Live: https://starfox22.github.io/GTA/**. The owner enabled GitHub Actions as the
Pages source. [Deployment 38793337239](https://github.com/starfox22/GTA/actions/runs/38793337239)
on `bd4ec11` succeeded, including exact public SHA-256 checks of all 18 game files.
The [success receipt](audit/browser-preview-2026-10-15/successful-deployment.json)
records actual deployment/verification step status and the URL from GitHub.

The owner wants browser play without downloading each ZIP. The
[browser-preview guide](browser-preview.md) documents the dedicated
`codex-review-pages.yml` workflow: every push to **`codex-reviews`** builds the split
game, deploys it with GitHub Pages and compares every public file's bytes with the
artifact. It uses a separate `codex-review-pages` environment, does not write to
main or commit builds, and keeps ZIP publication intact. Initial Pages enablement
may require the owner to select **Settings → Pages → Source: GitHub Actions**;
the workflow token cannot enable it. Use the deployment's actual URL and status,
not an assumed link. The claude.ai/chatgpt.site publications remain separate.

The [first deployment](https://github.com/starfox22/GTA/actions/runs/38792992642)
on `c023479` stopped at Pages configuration with `HttpError: Not Found`, before the
owner enabled Pages. That blocker is resolved. Local checks passed: all 18 split
files match the rendered FINAL4 package,
all files serve with exact hashes under a project subpath, nine radio tracks reach
`canplay`, and the required quick check passes. The
[initial receipt](audit/browser-preview-2026-10-15/initial-deployment.json) preserves
that historical failure. The cloud proxy blocks direct `github.io` requests;
public file verification ran successfully on GitHub's deployment runner instead.

## October 15: source fidelity, real door openings and Chevette replacement

Continue on **`codex-reviews`**, the permanent GitHub branch. The owner renamed it
on October 15 from `codex/chase-clouds-polish-2026-10-12` because reviews now cover
the whole game; its history is preserved. Main is not an output of this review. The
[October 15 audit](audit/vehicle-fidelity-2026-10-15/README.md) is the evidence index,
including native before/after captures, exact build/asset hashes, reproducible
source intake and qualified regression results.

- SUV paint defects came from conversion changing authored split normals, even
  at reduction ratio one. The Jimny now retains full near painted shell/panels/hood;
  all near SUVs retain precise source shading. Reduced zero normals recover only
  from nearby same-material source data with recorded repairs. Preserve the
  [source fidelity contract](areas/vehicles-and-driving-source-fidelity.md), all
  302 motorcycle arrays and the original 23-model pack. Do not smooth or aggressively
  decimate these hero paint surfaces again.
- Front doors now create an actual source-body aperture and move their source
  paint, trim and front window. The original filled panel/uncut hull hid the cabin.
  [Door contracts](areas/vehicles-and-driving-doors.md) cover source triangle IDs,
  clipping caches, both doors, marks, crumple, source closure/repair and native hinges.
  `assetCharAdopt` registers new layers inheriting a burnt body's existing material;
  otherwise doors first built after a fire stay scorched after repair.
  [Exit transitions](areas/vehicles-and-driving-door-transitions.md) use the existing
  foot IK during the half-second exit crouch. Preserve the actual pose/IK/easing
  source and shipped-shoe regression; the former pose buried feet up to 21 cm.
- Ordinary Chevette Z06 uses Hari's licensed C8 **Stingray** source, with a detailed
  cabin, native doors and separate steering/rolling/caliper frames. The existing
  Chevette identity/handling/collider and separate Carbon Aero SE remain intact.
  [Sports runtime](areas/vehicles-and-driving-models-sports.md) and
  [clean source recipe](areas/vehicles-and-driving-models-sports-source.md) cover the
  separate pack, exact ownership, source textures/emission and measured contacts.
  Driver and passenger cushions differ: each has a fitted plan. The steering rim
  centre differs from its authored column pivot; use the measured grip circle.
  All four lamps belong to the real near/far mesh pairs; the actual distant source
  draw is 9,407 triangles, including lamps, rather than the former 11,365.
- Five reproduced gameplay/input defects are fixed: right aim retained by modal
  transitions; travel/records completing while unfocused; death/arrest respawning
  into unattended play; paid sportsbook progress lost during world reset; and live
  gameplay/resume allowed while WebGL was lost or awaiting its recovery reload.
  [Gameplay review](audit/vehicle-fidelity-2026-10-15/gameplay-review.md) retains
  failing-before/passing-after production-function evidence and browser follow-ups.
- Military work is [proposal only](audit/vehicle-fidelity-2026-10-15/military-proposal.md).
  The HMMWV/M35 have not been replaced. A free Chieftain reference is previewed and
  licensed, but changes tank identity and requires owner approval before import.
- Keep native source previews distinct from in-game captures. The isolated SUV
  normal experiment deliberately uses old runtime + corrected data; integrated
  doors/C8 evidence uses its separately hashed candidate. Do not relabel inputs.
  A corrected door screenshot fixture stages `look` before `drive`: `look` teleports
  and exits land vehicles. Actual boarded identity is now asserted before capture.
  The first corrected origin crossed an airport building at the low camera angle;
  accepted door comparisons use the clear runway at (418, 6000).
- **Final October 15 rendered checks pass.** The separately frozen FINAL4 runtime
  (SHA-256 `21403cd7c63950f619da9e8818a60be14ef306b0d08ced79ac336cd247c4df1a`)
  has [293 passing runtime assertions](audit/vehicle-fidelity-2026-10-15/verification/final4-runtime.json),
  including the complete 267-assertion hybrid player-body test, the C8 near draw
  (85,031 triangles) on High and Far draw (9,407) on Low and Ultra, doors first
  opened after burning and then repaired, and entry/exit transitions. One deliberately induced WebGL loss
  and restoration kept resume blocked during recovery; errors and frame faults
  remained zero. The [packaged smoke](audit/vehicle-fidelity-2026-10-15/verification/final4-smoke.json)
  then passed with real-key walking/driving (16/24 world units), map, both cameras,
  visible default FPS, six PNGs and zero errors. The
  [sequential pipeline](audit/vehicle-fidelity-2026-10-15/verification/corrected-render-pipeline.json)
  records both successful exits. These used software WebGL through the managed
  file-to-HTTP adapter; they do not test native `file://` loading or hardware FPS.
  The earlier a59 gameplay checks and FINAL2 model comparison captures retain
  their original build/hash labels; do not relabel them as FINAL4 evidence.
- Hardware FPS on an M4 Max and four uninterrupted normal-input mission wins remain
  unverified. Software WebGL, lifecycle tests and budgets do not establish AAA
  production readiness. The branch workflow publishes a commit-specific playable
  ZIP; this environment has no tool to update the existing chatgpt.site website.

## Permanent Codex branch and current review (14 October 2026)

- **October 14 asset approval:** the owner approved all five replacement motorcycle and
  sheriff/RANGER 4X4 assets, **free assets only**.
  [Five actual-source candidates and ten native previews](audit/vehicle-asset-shortlist-2026-10-14/README.md)
  record source/licence evidence, detail budgets and period/body-role limits. This is
  the original research. The [approved integration audit](audit/approved-vehicle-integration-2026-10-14/README.md)
  records the import and validation. Preserve close-view materials/detail and the
  separate original 23-model pack; future work stays on the permanent branch below.

- **October 14 implementation:** VORTEX 900 uses the approved M2 sport bike and KR 500
  the M1 enduro; civilian RANGERs cycle deterministically through S1 Jimny, S2 four-door
  and S3 compact offroad. Sheriff utility/Tahoe uses S2 with its actual look palette,
  livery and equipment. Real source axles and measured rider/driver contacts drive the
  rigs. Native civilian footprints match their bodies. Near/far kits and material pools
  are shared; Low/Medium use 2048px atlases, High/Ultra 4096px. The original 23-model
  pack and atlas remain byte-identical. See the integration audit for pinned source
  licences, complete clean conversion instructions and input/output hashes.
  Jimny optical covers, S2 exterior paint ownership and the closed repaired trunk lid
  are fixed. Helicopter side-gun barrels and rounds now converge from their physical
  mounts, including close targets, while keeping original controls and traverse stops.
  The audit retains native before/after images, original failing receipts and focused
  passing follow-ups. Candidate hashes in those receipts are deliberate: do not replace
  them with the final published hash or treat earlier screenshots as final-build captures.

- **October 14 verification:** cumulative **196 passed / 18 expected no-WebGL skips /
  0 failures across 214 modules**; final host receipt has **3,105 assertions in 10 modules**.
  Motorcycle20 and SUV10 preset/camera cases pass; source optics, actual instancing and
  final sheriff burn/repair pass. Final packaged rendered smoke has zero errors and
  confirms real-key walking/driving, map, both cameras and default FPS. All57 vehicle
  PNGs have verified manifest hashes/native dimensions, plus six packaged smoke captures.
  Retained receipts distinguish original failures and focused fixes from a one-shot
  final full-suite run. Source, license and regeneration docs are complete for continuing
  these vehicle changes. Hardware frame rates and four continuous mission wins remain
  unverified. The branch workflow publishes a commit-specific review ZIP; this session
  cannot update the existing chatgpt.site website.

- **Permanent Codex development branch (owner instruction, October 13; renamed October 15):
  `codex-reviews` (formerly `codex/chase-clouds-polish-2026-10-12`).** Future Codex prompts update this same GitHub branch.
  This review continues from approved main `bde9ee4` (version 65), which already contains the
  previous Codex work. Merge newer approved main into this branch as needed; never reset or
  force-push it, and never push main without the owner's explicit approval. Shared checkout
  helpers use disjoint file scopes in this cloud session; no new worktrees were created.

- **Previous October 13 review:** [vehicle, mission and performance report](audit/vehicle-missions-performance-2026-10-13/README.md).
  It covers the M4's displaced rolling pivots and fixed running gear, motorcycle axle
  normalization/punctures, persistent mission-world cleanup, depot deployment, mission
  3/4 lifecycle, measured asymmetric rider grips/steering, terrain-aligned rider and
  occupant attachments, and exact-order crowd/gate optimizations. The report records the frozen
  inputs, actual validation and before/after captures. Read its limitations before
  treating a staged mission test or software-rendering timing as acceptance evidence.
  Original 208-module run plus focused follow-ups and one late rider module give cumulative
  **191 passed / 18 expected no-WebGL skips** across 209 modules; final package rendered smoke
  passes with default FPS and both cameras. Four continuous normal-input mission wins and
  actual M4 Max/laptop GPU frame rates remain unverified. Read the rider audit for small
  full-lock reach and source partition limitations before changing contact hints.

- **Integrating Codex**: current work accumulates on `codex-reviews`; the owner asks the lead to integrate
  it from time to time: `git fetch origin codex-reviews`, review the src diff against CLAUDE.md (only upgrades), merge it
  into the working branch (no PR), regenerate FILEMAP, run the suite. `codex/chase-clouds-polish-2026-10-12` was merged
  on October 12 (f0f3321, version 63). Codex's tools/smoke.mjs requires real key-driven movement. Slow software GL can use
  `DEC_SMOKE_MOVE_TIMEOUT_MS=240000`; this changes only wall-time allowance, retaining the
  original movement assertions. Audit screenshots committed under docs/audit/ make the repo bigger.

- **Previous October 12 follow-up: `codex/chase-clouds-polish-2026-10-12`**, based on `cbd5668` and containing both
  earlier Codex branches. [The chase-polish report](audit/chase-polish-2026-10-12/README.md) covers
  volumetric chase clouds, camera/positional audio, weapon/retry continuity, ambulance recovery
  and conservative rooftop culling, with actual captures and validation limits. The owner's
  high-end target is comfortable Ultra on M4 Max; [hardware profiling](audit/laptop-profiling.md)
  remains necessary. Main and the existing hosted site are unchanged.
- `codex/game-polish-2026-10-12` continues `codex/game-fixes-2026-10-11` at `370c1cf` and
  contains all of that earlier pass. Both start from main's October 11 version 62 (`9afe59d`).
  The branches are review work; Codex has not merged or pushed them to `main`.
- Start with [the October 12 report](audit/game-review-2026-10-12/README.md) for the preceding
  fixes, exact verification coverage, screenshots and suggested next work. The
  [October 11 report](audit/game-review-2026-10-11/README.md) documents the inherited fixes.
- This follow-up enables FPS by default (preserving a saved opt-out), corrects input release
  and focus handling, bounds night-traffic light instances, limits GPU uploads to changed
  or visible data, restores minimap bike icons, and reduces GPS nearest-node allocation/sorting.
- To integrate with concurrent Claude work, commit that work, create an integration branch
  from it, and merge this whole Codex branch. Preserve newer features and the documented fixes
  when resolving overlaps; regenerate FILEMAP and rerun affected checks on the combined version.
  Ask the owner to review the combined build before moving main.
- The historical state below describes the preceding Claude release. The dated reports take
  precedence for Codex review results; they do not claim real laptop GPU frame rates.

## State

- **The game**: Dead End City, a browser top-down 1997 crime game (Three.js 3D with a 2D fallback), now with a
  second camera: V switches the overhead STREET view and a GTA IV-style third-person CHASE view (October 6-7
  round, branch `claude/trusting-cannon-seq2mv`; not on `main` until the owner approves).
  Version 0.9.0 is the **public demo**: free roam over the whole map plus story missions 1 (the harbour
  job), 2 (the Blue Hour hotel hit), 3 (High Ground: the package on top of Mount Ascent) and 4 (Borrowed Stripes:
  Kessler's uniform, Fort Sentinel, the consul at CIRRUS), added October 8 on `claude/confident-johnson-vlpoqb`.
  Missions 5+ are gated for regular players (`DEMO_BUILD`, `DEMO_MISSIONS` = 4, `demoLocked()`; god mode lifts the
  gates). The owner is replacing the old story job by job: the old missions 3 (Vinny's Favor) and 4 (Paper Trail)
  are deleted, and the rest (challenges.js 5-9, aviation 10-11) will go the same way. Bug passes and polish target
  free roam and missions 1-4.
- **Branches**: `main` is the owner's approved game. On October 6 the owner approved moving the working
  branch `claude/tender-babbage-3t74xl` (rounds of October 4-6) to `main`, so both held the same commit then.
  On October 11 the owner approved moving `claude/confident-johnson-vlpoqb` (missions 3-4, the downloaded assets rounds,
  artifact version 62) to `main` (fast-forward to 9afe59d).
  On October 8 the owner approved moving `claude/trusting-cannon-seq2mv` (the chase view and chase detail rounds,
  artifact version 55) to `main`.
  Codex sessions continue on `codex-reviews`, the owner's permanent
  review branch. Claude keeps its own working branch. Moving `main` requires the owner's approval
  in the current conversation (never assume it; the approval covers that one push).
- **Published build**: the claude.ai artifact https://claude.ai/artifact/NtDPAmpmNsgU8LPW4hH13B (split build:
  `index.html` + `media/`; version 65 (October 13) is the owner's 25-point list: mission 3 opening line, briefs folded by Escape, Varga's meeting skipped with E, no stuck seat, the DEMO COMPLETE card, visible talk bubbles, Kessler parked off the lane with a closable trunk and his car marked, the GPS to the fort (`navRouteEnds`), the fort's solid gate arm, records office farther in past a ready line and helicopter (theft = 5 stars), the frame guard and GPU context-loss recovery, respray that loses the police, 1990s brakes/handbrake/reverse, gradual gunfire damage (engine fire then explosion), chase-view movement keys and real car doors, the KR 500 dirt bike (CC-BY) and straightened bike wheels, the wheelie hint, CC0 trail mud, a decluttered minimap with the pier's rides, roof lifts on every helipad roof, villa garage doors, the HMMWV rebuilt and the procedural tank back, and the walking camera kept in vehicles below 31 km/h in the chase view too (the fort fight's chase slowdown did not reproduce on software GL); version 63 (October 12) merges Codex's `codex/chase-clouds-polish-2026-10-12` (volumetric chase clouds on every tier, chase camera cover clearance, chase-relative sound panning, FPS counter on by default, remembered restart across reloads, ambulance detours, input fixes) and adds the walking zoom below 30 km/h in vehicles, look-ahead up to 300 % (default 200 %), the walking camera distance slider, running vaults over villa walls and the sea railing into the sea, a CC0 jump grunt (arther1974), world reset only on WASTED/BUSTED/new game, and 27 story payphones (two or more on every island); version 62 (October 11) adds the Kessler fixes (house on Broadway, pristine car, no 'lost' text), the Exchange underpass and CENTRAL GARDEN sign removed, the jump grunt (LibreQuake, BSD-3), airborne bullet blood and directional blast blood, charred downloaded wrecks and truck wipers, bullet-hole rings on downloaded bodies; version 61 (October 11) is assets round three (avatars for every role up close incl. the player in uniform, chase-view clouds, police/trucks/military/convertible/bus/ambulance models, the SKYRANGER 429, the SKYLARK 172, the Labrador); version 60 (October 9) adds vehicle round two (the crownvic police body in the game's liveries, the DUKE V8 muscle car, the VORTEX 900 as a 1970 four-cylinder; the tow boat held back); version 59 (October 9) adds the Rocketbox NPC avatars (near/mid/far), the CC0 wall skin and the first six downloaded period cars (sedan, taxi, coupe, sport, supercar, luxury); version 58 (October 8) is the jump on Space, the Rocketbox player model, the gradual sun, the world reset (WASTED / mission pick), the HELICOPTER cheat, god mode cash and the chase-only respray arrow; version 57 (October 8) is the missions 3-4 polish (step briefs, Kessler's alarm, the gate talked through) and version 56 demo missions 3-4, both from `claude/confident-johnson-vlpoqb`; version 55 is the chase detail round from `claude/trusting-cannon-seq2mv`, published October 8; version 54 the chase view round, October 7; version 53 is the build that went to `main` on October 6). Version numbers on that link are the artifact's own
  counter, not `GAME_VERSION`.
  The downloadable zip is built by CI for whatever branch is pushed.
- **Tests**: `node tools/test.mjs` runs the whole regression suite (153 tests, 152/153 on October 9 and 151/152 on October 8 with pedestrian-awareness passing on rerun; earlier: 137 tests, ~50 minutes on the 4-core
  cloud box; 136/137 at the end of the chase detail round of October 7-8, the one failure, hud-clearance at the new
  150 % look-ahead, fixed (`leadShareMax`) and rerun 7/7 with the camera and HUD tests; the runner always loads the no-render page, so the render-* tests are null checks there: run them
  on a rendered page when a render change needs them). It must be green before a publish. Known flakes: `police-search-clock` (traffic on the cruiser's spot; it now tries five spots, still ~1 in 6), `car-blood` (a flank stain, ~1 in 3 full runs), `pedestrian-awareness` failed in three full runs in a row (Oct 8-9, different assertions) and passed alone each time;
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

- **Only upgrades.** A change (a new asset, texture, model or system) goes in only where it is better than what the
  game has: never a downgrade in looks, features or performance on any tier. Where a downloaded asset is worse for one
  case, keep the current one there and say so.
- **Assets: download first, never build from scratch.** For any model, texture, sound or other asset, look for a
  ready-made one online first (a clean licence: CC0, MIT, CC-BY with credit; only GitHub reaches through the cloud
  proxy) and adapt it; build one by hand only when nothing usable exists, and say so. Show the owner preview sheets of
  a new collection before spending tokens on integrating it (October 8: Rocketbox for people; vehicles and buildings
  were surveyed with sheets first).
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
| Chase detail (Oct 7-8) | the player's own skinned body (player-body3d*.js), crash crumple and pinned bullet holes, cabin headroom, Chevette Z06 rebuild, badges on every vehicle, drive-by seat table, gore and dismemberment (gore.js, Gore setting), wet lamp glints, chimney wood smoke, Coronation Bridge and drawbridges on every multi-bridge island (god-mode controls), street camera defaults 120 % / 150 % | `docs/changes/2026-10-07-*`, areas `people-and-crowd-player`, `vehicles-and-driving-damage`, `vehicles-and-driving-cabins`, `police-and-combat-gore`, `rendering-weather-wet`, `world-and-map-drawbridges` |
| Night and driving feel | headlights without blow-out and with occlusion, no tyre smoke except burnouts, realistic blood per shot, bike falls and wheelies, drive-by arcs and cross, parachute opening, health only indoors | `docs/changes/2026-09-28-*`, area docs for blood, vehicle lights, driveby, vehicles |
| Carjack and stars | the full carjack struggle and pull-out, no stars over downed people | `2026-09-28-carjack-struggle` |
| Rings, signs, hotels, car blood | no ground rings, optional player ring, no stale demo arrow (`settleDemoStoryIndex`), no stray signs (`roadsideSign`), motels with real entrances (`dressHotel`), vehicle blood stains | `2026-09-30-*`, `areas/places-and-venues.md`, `areas/police-and-combat-blood.md` |
| Efficiency | simulation (`hypot2`, `rectListBlocked`, counted lists, parked-vehicle settle skip), rendering (title prewarm, staged tier change, cell pre-upload), boot time, soak and A/B tools | `2026-10-01-*`, `2026-10-02-*`, `areas/rendering-hiccups.md`, `areas/boot-and-memory.md`, `audit/performance.md` |
| Pedestrians and cars | awareness (`watchVehicle`), second run-over (`runOverDowned`), bloodier hood with long streaks | `areas/people-and-crowd-vehicles.md` |
| Bug passes | missions 1-2 under the demo gate, free roam, the random-walk bot, cab-ride crash | `2026-10-02-*`, `tools/bot.mjs`, `docs/BACKLOG.md` |
| Edge and wrecks | world-edge countdown, wreck and abandoned-car limit | `2026-10-03-*`, see below |
| October 4 round | police search clock (shown only while it runs, shorter times), second god-mode code, big TELEPORT map, driving camera (wider, speed pull-back, damped follow, `cameraComfort`), bonnet blood by speed (`carStainSeverity`), hill climb (`rideStep` suspension, hand-laid Mount Ascent trail, rock/ford dressing), liner grand tour and deck landings (`deck-landing.js`), see-through foliage, world-edge card off land, missions 1-2 and free-roam bug passes (replay frontier, `restartableJob`, fair harbour fight, ABANDON confirm, HUD clearance), performance (frame trace, `hitches.mjs`, DOM writes, buffer ranges, vehicle layouts and allocations, merged car parts) | `docs/changes/2026-10-0[34]-*`, CLAUDE.md rules, `audit/performance.md` (fourth and fifth pass) |
| October 5 round | open sea (RETURN TO THE CITY countdown after 10 s heading away from land, then a missile; replaces the world-edge warning), ride head-look on the Sunset Eye and the Falcon (`ride-look.js`), sound check (`soundOffText`, saved mute and master volume, `MIX_MAKEUP`, `wakeAudio`) | `docs/changes/2026-10-05-*`, `areas/world-and-map.md`, `areas/places-and-venues.md`, `areas/audio-and-radio.md` |
| October 6-7 round: the chase view | (plus, for both views: roof finishes and road wear, `2026-10-07-street-ground`; one lit, sorted effect pool for smoke, fire, sparks, flashes, glass and drops with new blast, muzzle and impact recipes, `2026-10-07-street-effects`; the chase view's draw budget, `2026-10-07-chase-budget`) V toggles a third-person CHASE camera (game-side `chaseCam` with its own projection; pointer lock or CURSOR LOOK, pad, touch; over-the-shoulder aim, lock-on, look behind, close-quarters crane); every on-screen rule asks it (`chase-rules.js`); its HUD layout; draw distance and level of detail (far copy, casters, props, people and vehicles by distance); sky dome, aerial haze, clouds from below, sun glare; rain at street level; shopfronts on every side; car cabins with seated people; a near body set for people up close; broken-glass crumbs; camera motion blur; a darker night at street level (CHASE NIGHT); the radio chip | `docs/changes/2026-10-06-*` (chase-camera, chase-lod, chase-rules, sky, street-rain, street-facades, close-cars, close-people), `areas/chase-view.md`, `areas/chase-view-input.md`, `areas/rendering-chase.md` |
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

- Missions 3-4 (October 8; `docs/changes/2026-10-08-*`, docs/areas/missions-summit-and-fort.md): the parachute was
  left as it is at the owner's word (a jump onto the summit uses the existing landing and scree rules). Open lines:
  vans and SUVs open their trunk with no lid drawn (tailgate part of the body); Varga's waistcoat is not modelled;
  the cocktail is the beach club's glass prop; the Marea's street is busy, so a quiet pick means waiting for a gap
  (`lockpickWatcher`: someone within ~15 m looking); Kessler walks in even when the club's door is shut (05:15-09:30).

- The chase view (BACKLOG "Chase view", "Effect particles"): no cover system yet (a design question: the player's rounds would hit the
  car they hide behind); motion blur is the camera's own; sky, haze, glare and the new materials were tuned on
  SwiftShader only (check on a real GPU); after the draw budget the chase view still draws ~2.5 times the street
  view's calls (avenue: LOW 474, MEDIUM 913, HIGH 989, ULTRA 1117; rendering-chase-budget.md has the table and what
  is left: crowd part pools, breakable pools, impostor pools).

- The chase detail round (October 7-8; fragments `docs/changes/2026-10-07-*`, open lines in BACKLOG):
  - Owner's call: the Ridgeline Viaduct lost its two H-pylons and their cables so it could be the island's drawbridge
    (no other Ridgeline bridge had room); the alternative is rebuilding another Ridgeline bridge as the bascule.
  - The Coronation Bridge's south-west approach runs north of the North Point Key towers (they can hide it overhead).
  - The player's body: no blinking/face rig beyond blink and gaze; real-GPU cost of its 92k triangles unmeasured.
  - Gore: no point-blank shotgun knockdown (the round rule holds); stump close-ups judged only on SwiftShader crops.
  - No badges on bicycles, the tank, boats or aircraft; small POLICE/BADGER/BRONCO lettering where room is short.
  - Wet glints: no reflection on roofs, cobbles, mountain terrain or decks (would need new programs); a tier change in
    play compiles the rain-only shaders at the first shower; the 40-slot glint list's uniform count is untested on
    low-end GPUs (HIGH/ULTRA only use 40).
  - Crumple: a sprung door covers the lower door only; street-view mark sizes unchanged.
  - Street camera: look-ahead 0-300 % (default 200 %); its frame share stops where the vehicle's far end reaches `leadShareTop` 0.7 of the half frame (HUD clearance). Below 30 km/h vehicles keep the walking framing (world-view.js SLOW FRAMING).

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
