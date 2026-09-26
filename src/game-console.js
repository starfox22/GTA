    // BEGIN SUBSYSTEM: src/game-console.js — DeadEndCity console registry and assembly
    /**
     * DEVELOPER CONSOLE
     * `DeadEndCity` on window is a small, documented debugging surface used by
     * tools/smoke.mjs and by anyone maintaining the game from the browser
     * console. It reads and writes the same state the game itself uses; it is
     * not a cheat menu wired into the UI. Example: DeadEndCity.teleport(-1844, 2600).
     *
     * Each game-console-<group>.js below (or a feature file) hands its explicit,
     * named methods to addConsoleMethods(group, { ... }); the end of this file
     * copies them all into one frozen window.DeadEndCity. A name defined twice is
     * reported as a console error and the first definition is kept. Methods may
     * call each other through `this` (it is window.DeadEndCity when called as
     * DeadEndCity.name()). Never register an eval-style hook (eval, Function,
     * run-a-string, generic get/set): a security rule.
     */
    // A function declaration, so it is hoisted: any file in the game closure may call it.
    function addConsoleMethods(group, methods) {
      (addConsoleMethods.groups ||= []).push({ group, methods });
    }
    // @include src/game-console-core.js
    // @include src/game-console-missions.js
    // @include src/game-console-police.js
    // @include src/game-console-vehicles.js
    // @include src/game-console-world.js
    // @include src/game-console-rides.js
    // @include src/game-console-leisure.js
    // @include src/game-console-crowd.js
    // @include src/game-console-graphics.js
    // @include src/game-console-settings.js
    window.DeadEndCity = (() => {
      const methods = {},
        owner = new Map();
      for (const { group, methods: part } of addConsoleMethods.groups || [])
        for (const name of Object.keys(part)) {
          if (owner.has(name)) {
            console.error(`DeadEndCity.${name} is defined by both '${owner.get(name)}' and '${group}'; keeping '${owner.get(name)}'`);
            continue;
          }
          owner.set(name, group);
          methods[name] = part[name];
        }
      return Object.freeze(methods);
    })();
    // END SUBSYSTEM: src/game-console.js
