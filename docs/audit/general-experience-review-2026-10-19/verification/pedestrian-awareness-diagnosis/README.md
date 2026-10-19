# Pedestrian awareness: bounded diagnosis

The original live-world `pedestrian-awareness` integration failure remains open. No production code, test, threshold, seed or person trait was changed, and this prototype is **not a replacement for full-world acceptance**.

The unchanged 80 km/h / 330-unit (41.25 m) case uses seed **4242**, **10** specimens, and requires both attempted dodges and clearances to be at least **0.6**. The production-function microhost notices all 10, attempts 7 dodges and clears **5/10**, so the original clearance assertion still fails. Of the outcomes, 3 freeze, 2 retreat backward and are struck, and 5 lateral dodges/sidesteps clear. Running the original test module's assertions against these bounded results gives one failure; its thresholds are unmodified.

The two backward contacts fit the intended design. `carAct()` explicitly says “Back along the path, a half-sideways stumble: rarely enough.” That branch sets the leap to vehicle heading plus `side * 0.45`, speed 46 units/s and duration 0.36 s. Production `updateReaction()` fades that speed while moving through `moveBody()`. The specimens finish near lateral offsets −5 and +11 units, still inside the sedan's 11.52-unit padded contact half-width (17.04-unit collider width / 2 + 3-unit contact margin). The production swept-contact test therefore catches them. A backward retreat at this speed cannot outrun an 80 km/h car. Redirecting these stumbles sideways merely to produce a passing rate would remove deliberate panic behavior.

The six perception, reaction, appearance and speech source files recorded in `diagnosis.json` are byte-identical between published baseline `7f45832a` and candidate `339ba035`. The earlier retained live integration receipt also fails on the published baseline (0.4 clear) and earlier current source (0.5 clear), against the same 0.6 requirement. This evidence does not justify calling the regression fixed.

The integration fixture's seed resets do not isolate the random stream: each full-world `update()` consumes other systems' draws. Prior `gameTime`, `crowd.timers.near`, camera/view state and appended pedestrian index also persist. At 30 Hz the 0.08-second near-miss timer fires every 0.10 seconds; off-camera reaction movement runs every fourth or sixth frame based on `peopleFrame + actor index`. Clearing live population changes those phases rather than preserving the same experiment.

The bounded host loads the actual production RNG and `dressPerson`, awareness, speech, reaction, `moveBody`/vehicle-grid obstruction, `sweptPersonContact`, `pointInCar`, `touchPerson` and `knockPerson` functions. A local clock and near-miss timer reset before each unmodified dressing call, and a fixed in-view cadence removes actor-index throttling. No perception, decision, dodge or contact math is recreated.

Its explicit limits are an open-ground scene with clear sight and same-floor classification, prescribed constant vehicle velocity instead of full drivetrain integration, and bounded post-contact damage/flight/blood/crime/incident side effects. It cannot stand in for the shipping world's solid geometry, population, audio, contacts over time or performance. The original live integration failure and the existing threshold must remain visible.

Files:

- `prototype.mjs`: exploratory host, not an installed regression test.
- `prototype-results.json`: all nine original scenario results, including specimen details.
- `unchanged-assertions.json`: original module assertions; one clearance failure retained.
- `diagnosis.json`: exact source commits/hashes, mechanics, limits and artifact hashes.

No browser was launched. No game or test source was edited or committed.

For a bounded host reproduction against the pinned production checkout:

```sh
DEC_GAME_ROOT=/workspace/work/awareness-fixture node /workspace/GTA/work/general-review/pedestrian-awareness-diagnosis/prototype.mjs
```
