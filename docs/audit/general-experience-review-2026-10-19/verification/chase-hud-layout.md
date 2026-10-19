# Chase and street dialogue layout

This is a real Chromium DOM review of the frozen production CSS, HUD markup, `measureMissionCard`, and prompt/dock functions. It proves layout and text visibility; it does not render or complete a game mission.

- Baseline: `cc3683864df17eebb60fa325ffbdd1269c8ab05226f3411aff84db377f11d1d5` HTML, 144 failures / 384 cases.
- Candidate: `eb8bf806274783ade7a2cfb473a3398479f0d9ba12241b9ce7fd1e2464da705b` HTML, all 384 cases pass.
- Identical recorder: `5b76c0b38c236c574629086a7f3fd60ba8e6fcec095ea1514895197d759b1779`; final paired results are `chase-hud-before.json` / `chase-hud-after.json`.
- Matrix: 960×600, 1000×700, 1280×720, 1440×900; street/chase; opening/package/gate/long records dialogue; open/compact/folded-map HUD; no/fresh/terrain/docked-terrain prompts. Key hints use the default keyboard labels and cargo is visible only in the mission-one scene.
- Assertions retain visible dialogue, hints, district and navigation, full district text without clipped overflow, subtitle clearance from the mission card/map/hints/equipment, prompt clearance from subtitle/terrain, and an onscreen subtitle.

The package and long records lines reproduce the text in native captures 05 and 08. The Fort name and route reproduce capture 06's top-row collision. The gate fixture uses the new neutral greeting on both sources; this single-line text difference does not alter the fixed-width subtitle geometry. Touch CSS keeps its own layout: every new subtitle/short-chase rule excludes touch, and touch's more-specific district max-width remains unchanged.

`chase-hud-initial-before.json` / `chase-hud-initial-after.json` retain the first 152→16 failure run. That earlier fixture incorrectly showed mission-one cargo during all scenes; it still exposed the real 960×600 street cargo card with six populated keyboard hints wrapping to two rows. The final paired fixture corrects cargo visibility and verifies the measured short-window fix without relaxing an assertion.
