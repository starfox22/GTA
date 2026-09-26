# Dev console split into self-registering groups

- No player-visible change; `window.DeadEndCity` keeps the same 194 names, signatures and behaviour, still frozen.
- `src/game-console.js` is now a registry: `addConsoleMethods(group, {...})` (hoisted, callable from any game file) collects methods and the end of the file freezes them into `window.DeadEndCity`. A name registered twice logs a console error and keeps the first.
- The old three-file object literal became ten self-contained groups: `game-console-{core,missions,police,vehicles,world,rides,leisure,crowd,graphics,settings}.js`; the feature consoles (`damageConsole()`, `handlingConsole()`, `sportsConsole()` …) are registered from their area's group.
- Docs: the 41 KB method table moved to one file per group in `docs/console/<group>.md`; `docs/areas/testing-and-console.md` keeps the rules and an index. Added the missing `crashSounds()` row.
