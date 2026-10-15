# Gameplay/input/progress review — 15 October 2026

Five confirmed bugs were reproduced before changing production code. This review
does not claim uninterrupted normal-input wins through all missions or real laptop
GPU performance. FPS remains enabled by default and saved opt-outs remain supported.

| Defect | Correction | Matching host proof |
| --- | --- | --- |
| Thirteen modal/menu transitions cleared left fire but retained right aim/secondary fire. A missed mouseup could leave aiming held after returning. | Clear the existing `mouse.alt` with `mouse.down`; keep rejected-entry guards unchanged. | `modal-pointer-lifecycle`: 56 checks, 13 baseline failures → PASS. Existing pointer, elevator-entry and retry-save checks add 67 passing assertions. |
| Roof/skyline lifts and the Fort records search run outside ordinary play updates. They could finish into `play` while hidden/unfocused, bypassing the normal play-mode blur pause. | Freeze only these live travel timers until visible/focused; keep explicit developer stepping and unrelated frame phases. | `travel-focus-pause`: actual frame phase and three actual completion functions, 30 checks, 12 baseline failures → PASS. |
| WASTED/BUSTED also complete on wall-clock callbacks. Blur during `dead` could therefore leave the later respawn live in an unattended tab/window. | Finish the existing respawn/reset/save, then open the existing pause menu if still hidden/unfocused. Focused respawns remain live. | `respawn-focus-pause`: actual death/arrest entry, deferred callbacks and pause function, 112 checks, 16 baseline failures → PASS. Costs, confiscation, mission identity and reset behavior are unchanged. |
| A user could resume during lost graphics or the recovery delay; timed travel/deferred respawn could also enter unseen live gameplay. | Block live simulation/travel and pause resume until recovery reload. Keep explicit developer stepping, saved pause state and ordinary healthy frames. | `gpu-context-lifecycle`: actual loss/restore, pause, frame phases and deferred completions; 42 checks, 33 pre-fix failures → PASS. Actual WebGL loss/restoration and rejected resume checks also pass on FINAL4; see the rendered receipt below. |
| WASTED/BUSTED repopulated sports fixtures through `resetSportsbook`, deleting deducted stakes, settled history and counters. | Preserve the saved book around repopulation. Existing restore rules rebind upcoming bets or refund interrupted live matches once; NEW GAME still clears. | `world-reset-sportsbook`: actual reset/population, placement, restore and settlement functions; 54 checks, 30 baseline failures → PASS. |

The [host manifest](verification/gameplay/host-proof-manifest.json) links before/after
receipts with source/test hashes and the latest combined gate: 294 new assertions
plus 67 existing checks, **361 passing focused host assertions total**. The GPU
lifecycle baseline was captured after the earlier four fixes on the a59af721
production source; its exact input hashes remain separate from the 7a0f6f3 baselines. These fixtures execute production
functions in controlled VM contexts. They are not screenshots, WebGL compilation
or real-window focus evidence.

Production scope: pointer assignments in arsenal/campaign/story/settings/services/
transit/taxi/sportsbook/dealer files, one travel timer guard in `game-loop.js`, and
book snapshot/restore in `world-reset.js`, plus two post-respawn pause checks in
`game-player-actions.js`/`pursuit-officers.js`, and lost-context live dispatch/resume
guards in `game-loop.js`, `game-menus.js` and `gpu-context.js`. No gameplay physics, mission goals,
rewards, graphics presets or test thresholds were changed by these fixes.

## Broad current baseline run

The selected original 214 modules ran against immutable
`dist/review-2026-10-15-before.html` (SHA-256
`5b199b249eeb301af2722c21e84470c6b20902ff0976d17c3e439be1ab3e58da`).
This is the committed Oct14 runtime before the Oct15 fixes, not an after-build.
The first process completed 75 PASS/13 WebGL SKIP, then lost its dev-server
connection at `chase-budget` (`ECONNRESET`). The next 125 modules immediately
reported not-ready errors, so their assertions were not valid game results.
The failed process/log is retained; only those 126 interrupted modules were
selected after a clean owned-server restart. That second shard recorded 30 PASS,
2 SKIP and one real test failure before it was stopped to prioritize the frozen
after-build: `god-mode-codes` required each real 0.5-second A hold to move more
than two rounded world units, but both moved exactly two (1152→1150→1148).
Both presses reached movement; at that point a runtime cause had not been established.
No wait, distance assertion or runtime input rule was changed for this failure.
The unmodified module later passed all its assertions in the focused after run
(A taps 1152→1147→1139), then passed unchanged on the **same frozen baseline**
(1152→1148→1145), including its code/splash/audio assertions. The
[follow-up receipt](verification/gameplay/god-mode-codes-followup.json) retains
all three outcomes and the unchanged test hash; the initial result is a live-frame
timing sensitivity, not a reproduced code-swallowing defect. Completed passing/skipped modules were not
repeated. The third shard completed 89 PASS/3 SKIP/2 FAIL in 5,359 seconds.
The [per-module aggregate](verification/gameplay/original-baseline-progress.json)
retains every attempt and the hashed shard receipts. The original 214 modules
completed **196 PASS / 18 WebGL SKIP / 0 unresolved FAIL** across three main
processes and two unchanged whole-module follow-ups. This was a resumed run,
not a single uninterrupted pass.

The third shard initially retained two timing-sensitive failures under concurrent
software WebGL load. `lockpick` reached progress 0.92/pin 4 in reach when its
original 60-second wall deadline expired after only 5.17 game seconds.
`player-jump` passed its deterministic vault/water phases but observed zero jumps
from the original 0.2-second real Space hold. After external GPU load ended,
both unmodified whole modules passed on the **same frozen baseline** in the
[75-second follow-up](verification/gameplay/review15-before-quiet.log): the trunk
opened on pin 5 at 5.42 game seconds, the door unlocked at 4.11, and the real
Space jump/grunt and vehicle handbrake assertions passed (54.2→11 speed).
The [lockpick](verification/gameplay/lockpick-followup.json) and
[jump](verification/gameplay/player-jump-followup.json) receipts keep the original
failures and unchanged test hashes. No wait, threshold or runtime rule was changed
for these outcomes. The 18 WebGL skips require separate rendered coverage.

## Focused frozen after checks

The affected selection completed **15 PASS / 0 SKIP / 0 FAIL** on immutable
`dist/review-2026-10-15-integrated.html`, SHA-256
`a59af721e5c0c880521421abf9ad94bff55f94023549c810b154a90386afef63`.
The byte-identical executable is preserved locally as
`dist/review-2026-10-15-gameplay-checked-a59af721.html`; later renderer builds
must retain their own hashes. The [browser proof manifest](verification/gameplay/browser-proof-manifest.json)
hashes the selection, logs, receipts, original/strengthened fixtures and runner.
See [selection/source hashes](verification/gameplay/review15-final-affected-selection.json),
[log](verification/gameplay/review15-final-affected.log) and
[exit receipt](verification/gameplay/review15-final-affected-exit.json).
This includes the first four new host fixtures, independent mouse release, real drive-by
pointer input, Fort records, seven real-key/wall-clock roof lift round trips,
retry/ammunition save-and-reload, FPS default/preferences, normal entry and
surrender, sportsbook settlement and the unmodified god-code case.

An additional [world-reset/book browser receipt](verification/gameplay/review15-world-reset-browser-after.json)
passes **38 assertions with no console errors** on that same frozen HTML.
It preserves the original world-reset test's 29 assertions/waits and adds nine
financial progress checks: a real deducted $100 live slip is voided/refunded once
after WASTED, the wallet receives it after the hospital bill, and odds format,
history and counters remain through the original BUSTED/mission-reset phase.
The [original](verification/gameplay/world-reset-original-fixture.txt),
[strengthened exact tested source](verification/gameplay/world-reset-strengthened-fixture.txt)
and [named-method runner](verification/gameplay/world-reset-followup-runner.mjs)
are retained. After the original 214 baseline modules completed, the canonical
`tools/tests/world-reset.mjs` was replaced byte-for-byte with this proven source
(SHA-256 `81f0810da7f135dda535797d6ea23f820cd6f57aaeba9458311da3ab237c9750`).
The original 29 assertions and waits remain; the nine financial checks are additional.

Important qualification: browser modules use the immutable HTML, while some
host/VM modules read current workspace source ([29 selected source readers](verification/gameplay/host-source-qualification.json)). Concurrently changed vehicle
host modules must be rerun on final source and reported separately; a frozen
browser page alone does not freeze their inputs. The five new gameplay host tests were
added after the original selection, and are not included in that 214-module count.
The later context lifecycle fix is separately covered by the final 361-assertion
host gate and the actual WebGL checks below. The a59af721 browser receipts retain
their original build/hash labels.

## Final frozen runtime and packaged smoke

The [FINAL4 rendered runtime receipt](verification/final4-runtime.json) records
**293 passing assertions**, zero console errors and zero frame faults on immutable
HTML SHA-256 `21403cd7c63950f619da9e8818a60be14ef306b0d08ced79ac336cd247c4df1a`.
It includes the complete **267-assertion hybrid `player-body` module**; its earlier
host-only adapter attempt could not execute the browser portion and is not a
passing whole-module result. The actual C8 near draw is 85,031 triangles on High;
the Far draw is 9,407 on both Low and Ultra. Doors first opened after burning
return to their original materials/source geometry after repair, and entry/exit transitions pass. The
strengthened context test deliberately induces one actual WebGL loss and one
restoration: gameplay stays paused and resume remains blocked during the recovery
reload delay. It does not claim the deferred page reload has completed.

The [packaged rendered smoke](verification/final4-smoke.json) then passes with
real-key walking and driving (16 and 24 world units, respectively), map opening,
both cameras, default FPS visible, six PNG captures and zero console errors.
The [sequential pipeline receipt](verification/corrected-render-pipeline.json)
records successful exits for both stages. The smoke retains its original movement
assertions with a 240-second cloud wall-time allowance. These checks used software
WebGL and the managed file-to-HTTP adapter; native `file://` protocol loading,
real laptop GPU frame rates and four uninterrupted normal-input mission wins
remain unverified. FINAL4 evidence supplements the earlier a59 gameplay checks
and FINAL2 model comparison captures without changing their historical labels.

The [independently checked test inventory](verification/gameplay/final-test-inventory.json)
contains **222 current modules: the original 214 plus eight additions**, with none
removed. The additions are the five gameplay host fixtures, sports-vehicle assets,
source fidelity and car-exit feet. Five existing fixtures changed: approved SUV
rigs, GPU context, mouse buttons, player body and world reset; their historical
baseline outcomes do not stand in for current-source checks. All linked gameplay
manifest hashes, both unchanged quiet-retry test hashes and the exact strengthened
world-reset source were independently verified. This inventory does not claim
that all 222 modules ran together or passed on the final rendered build.

No new graphical bug was diagnosed by these gameplay fixtures; vehicle visual
changes/captures and their native evidence are owned by the parallel renderer audit.
