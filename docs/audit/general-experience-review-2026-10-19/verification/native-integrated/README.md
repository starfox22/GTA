# Native mission 1 gameplay evidence

The successful run used the frozen `integrated.html` candidate, source `605b175e`, SHA-256
`c8565c1e0f4ed7dbf5a49ff14082e03e8c50c95426d1bce13bd96df5ce1fbfd9`,
with public-demo `?test&seed=1&hold` flags (no development-page bypass), a fresh profile and the real 3D renderer at
1000 × 700. The renderer used SwiftShader; its frame rate is not a desktop GPU
benchmark. Gameplay used Low graphics so shader warmup did not dominate the route.

After retry, the run completed Dockside Favor: actual truck pickup,
connected street driving, harbor entry, all three crates, harbor dispatch,
complete pursued road journey, warehouse entry, shutter closure, actual E exit,
ordinary on-foot movement through the personnel door, wanted cleared and payday
+$2,400. Final state is completed 1, player health 100, wanted 0, cash $2,475.
There were no frame faults, GPU losses, console errors or integrity problems.

There were no player/vehicle placements, stage skips, forced kills, enabled god mode,
debug health/ammunition refills or wanted edits in this run. E/Enter/Escape were real
DOM inputs. Held W/A/S/D stepped the ordinary update, collision and vehicle physics;
the named road and point pilots supplied those same steering/throttle/brake keys.
At trace line 143, real Escape opened pause. At line 144, the named console
`retryMission()` wrapper invoked the same production handler used by the pause
menu's RESTART CURRENT JOB button. There was no keyboard or mouse activation of
that button in this M1 trace. The handler ordinarily returns the player to the
original spawn, restores health/armor and restocks owned ammunition; this normal restart is distinct
from a debug placement or refill. Physical menu selection is separately recorded
in the M4 retry.

The first integrated attempt ended in an ordinary BUSTED after the road pilot hit
a pedestrian and was boxed by a cruiser. That failure, production-handler retry
and successful objective journey are retained in `experience.jsonl`. One mistaken hospital-to-truck foot
route after retry was cancelled and corrected from the player's actual position.
No placement was used to correct it. The complete earlier baseline attempt is
separate and partial; it must not be presented as a win.

The final warehouse approach matters: stop east of the entrance near
(-1550, 4224), turn forward toward (-1664, 4320), then enter toward
(-1664, 4450). The earlier western approach made the automated pilot try to turn
around into arriving pursuit vehicles. These are QA pilot limitations rather than
proof of a mission softlock. The finished route keeps the game's normal rules.

`summary.json` identifies the exact HTML/trace hashes and final state. Three raw
PNG captures and their camera/HUD/state/error receipts appear in the trace. The
separate graphics review deliberately uses stage/placement fixtures and is not
normal progression evidence.

The win receipt is `last.result='won'`, index 0, stage 7, completed 1. Its final
`frameFaults.count` is 0, `errors` is empty and the GPU context reports no losses.
This native M1 win belongs to the source above; later HUD fixtures, graphics
captures or console-pilot checks are narrower evidence on their own candidates.
It is not a fresh uninterrupted four-mission playthrough or a full M1 replay of
the final release artifact.
