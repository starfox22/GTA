# Native military-combat performance replay

Frozen baseline: prior published f350b4be / aviation candidate 5. Frozen candidate:
`../candidate-1/game.html`, monolith SHA256
`e73c7022c2659d1690b3de2a884d575f2e228d78437c1930c41e9b305051f968`.
`final-source-identities.json` retains every source identity and dev-server flags.

`replay-ops.json` lists the exact 81 named console requests, including profile
options. `replay-final.mjs` replayed those inputs in order with High graphics,
clear weather, 13:00 starting clock, seed 1, god mode and held simulation. All
replies had zero console errors. `final-extra-reports.json` includes the final
particle/blood/render reports and empty native error list. No source edits,
reloads, added combat staging or extra budget probes occurred during this replay.

`01…12` are raw baseline responses; `final-01…12` are raw candidate responses.
`final-comparison.json` pairs each sampled pass, allocation/upload count, draw
report and tail state. `final-native-images.json` pins the unedited full PNGs.
The visible image shows three wrecks, burning effects, several vehicles and the
player's APC; earlier phases 07–09 are retained as partial controls because those
wrecks were above the earlier viewport. Both original and corrected staging are
replayed, rather than discarding the less useful earlier captures.

## What was measured

| Visible sample | Baseline vehicle pass, ms/frame | Candidate vehicle pass, ms/frame |
| --- | ---: | ---: |
| First corrected view, 3 frames | 26.07 | 20.17 |
| Warm corrected view, 6 frames | 20.75 | 11.32 |

These are small, noisy named-section observations, not controlled hardware
speedup percentages. Live held frames still render between requests: fitting,
painting, atlas completion, shader/model warmup and renderer effect emission can
progress differently over wall time. The first corrected candidate sample still
included five cold shader links and a newly built model. Simultaneous SwiftShader
contexts competed for CPU; blocked native GL calls dominate some profiles.

The final warm FX report estimates 2,808,310 square billboard pixels versus
1,707,890 after conservative bounds (rasterShare 0.6082), about 39% less *unclipped
projected billboard area*. It remains one instanced draw. This estimate does not
measure occupied screen pixels, fragment GPU time or hardware FPS. The focused
host proof separately checks filtered alpha support across the atlas/mips.

The blood module's full-history worst slice was 27.1 ms baseline and 24.8 ms candidate;
this does **not** demonstrate a hard 3 ms maximum. Its 3 ms shared allowance is
cooperative, and indivisible canvas/GL work, scheduling and GC can overrun it.
Focused clock/generator checks prove no within-render replenishment, bounded
fitting work and exact geometry; native warm profiles show substantially less
sampled fitting work, with the above wall-time limitations.

## Native FPS chip and aggregate state limits

The unmodified final screenshot's native FPS chip reads **0 FPS · 43498 ms**. It
includes batched CDP/hitchRun stepping, shader waits and software-GL wall time;
it is not an ordinary live-frame FPS measurement. The chip was neither hidden,
modified nor replaced. No hardware-FPS claim can be made from these captures.

Final `status`, `military`, `damageReport` and `shotLog` match baseline exactly.
Observed soak `lists`, `counts` and `bad` fields match in the compared phases too.
The aggregate state hashes differ: baseline `7f602c65683b2ad5`,
candidate `24c1e06f13c8e960`. Full-world positions, velocities, rest-step counters
and game-effect coordinates feed that hash; the baseline did not capture every
component, so this difference is not localized. Renderer-only `fxs` counters are
not hash inputs and their differences alone do not explain it. This replay
therefore establishes matching reported combat state, **not** bit-identical
entire simulation state. The source also intentionally changes Apache physical
bounds to fit the downloaded aircraft; that is a possible factor, not a proven
cause of this hash difference.

At handoff the candidate dev server remained held at Fort Sentinel, player APC
id 282 at 9794,9009, HP 950, wanted 5, High clear 13:06, god mode, mounted aim 9560,8950.
Apache QA then received explicit exclusive server ownership. No further browser
calls were made by this performance task after handoff.
