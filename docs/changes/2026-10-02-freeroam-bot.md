# Random-walk bot, integrity sweep and the job restart carriers
- Restarting a job from the pause menu (RESTART CURRENT JOB, CHOOSE MISSION, NEW GAME) now moves the player through `teleportPlayer`: a fall in progress or a ladder climb no longer carries on from its old height or path at the spawn.
- `tools/bot.mjs`: a seeded random-walk bot (`node tools/bot.mjs --seed N --minutes M [--wall S] [--render] [--only a,b]`) that plays random free-roam actions on the dev page (teleports, every vehicle class, shooting, run-overs, police, deaths and arrests, menus and random keys, settings, rides, swimming and falls, rebinding, save and reload) and checks the game after each one: console errors, `integrity()`, stuck modes and carriers, trapped player or vehicle, respawn rules, saves.
- Console: `integrity()` (docs/console/integrity.md), a read-only sweep for impossible state.
- Tests: `restart-carriers`, `parked-vehicle-hits` (a parked car shoved, blasted and shot, with `settleAudit`).
