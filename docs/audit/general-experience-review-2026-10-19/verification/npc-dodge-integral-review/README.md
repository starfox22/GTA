# NPC dodge distance: proposed integration fix

**The cadence defect is reproduced and the minimal patch passes 472 host assertions and 24 collision cases.** The patch is uncommitted in `general-awareness-fixture`, based on `339ba035`. No browser was used.

Production `updateReaction()` first advances `r.t`, then previously sampled the fading leap speed at the interval endpoint. It omitted the entire last interval once `r.t >= leapFor`. Consequently a coarse update shortened the leap, and a step spanning its full duration moved the actor zero distance.

For the existing intended speed `v(t) = V * (1 - t/T) + 10` during `[0,T]`, clamp the elapsed interval to `a = clamp(r.t - dt,0,T)` and `b = clamp(r.t,0,T)`. The exact displacement is the interval length times its average linear speed: `(b-a) * (10 + V * (1-(a+b)/(2*T)))`. This keeps the original speed parameter, direction, duration, reaction outcome and RNG decisions. Existing `moveBody(..., radius=5)` handles the displacement and retains its <=5-unit collision substeps.

| Update step | Before, default leap | After | Analytic target |
| --- | ---: | ---: | ---: |
| 1/60 s | 15.261243 u | 15.75 u | 15.75 u |
| 1/30 s | 14.650794 u | 15.75 u | 15.75 u |
| 0.133 s | 12.0365 u | 15.75 u | 15.75 u |
| 0.2 s | 10.285714 u | 15.75 u | 15.75 u |
| 0.6 s | 0 u | 15.75 u | 15.75 u |

The host calls actual production `startReaction`/`updateReaction`/`endReaction`, with the same initial specimen, direction and unmodified dressed traits for each comparison. It compares every trajectory sample against the analytic cumulative distance, including final partial intervals. Default `V=55,T=.42`, backward `V=46,T=.36` and calm `V=30,T=.8` configurations are all covered. The intended backward panic outcome is retained.

Collision cases use the actual `moveBody`, `solid`/building grid, vehicle grid, `footVehicleEscape`, `pointInCar`, `sweptPersonContact`, `touchPerson` and `knockPerson` functions. A 0.25-unit wall stops a dodge, an outside step cannot enter a parked vehicle, an actor already penetrating its padding can escape, and a vehicle swept contact still lands before later reaction movement. These controls include update steps of 0.6 and 2 seconds; elapsed-time integration stays capped at the original full leap distance and cannot bypass the existing spatial substeps.

This patch does not change off-camera cadence or contact priority. Production vehicle sweeps run before person reaction movement; the fixture explicitly verifies that this earlier contact is retained. Correct total distance does not turn coarse person updates into simultaneous continuous person/vehicle time-of-impact integration. That temporal limitation is separate from the displacement arithmetic and is not claimed fixed.

This is not a replacement for the original full-world pedestrian-awareness test, and no >=0.6 clearance result is promised. All awareness decisions, freeze probabilities, risky backward stumbles, RNG, traits, population and vehicle handling remain unchanged. Empty-site callbacks and post-contact presentation/damage side effects are bounded host dependencies, while the tested movement and collision geometry are production functions.

Files: `candidate.diff`, `dodge-integral.mjs`, `host-base.mjs`, `dodge-integral-results.json`, frozen `crowd-reactions-before.js`, and `manifest.json` with exact source/artifact hashes.

```sh
DEC_GAME_ROOT=/workspace/work/awareness-fixture node /workspace/GTA/work/general-review/npc-dodge-integral-review/dodge-integral.mjs
```
