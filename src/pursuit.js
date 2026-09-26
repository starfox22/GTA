    // BEGIN SUBSYSTEM: src/pursuit.js — Police response and pursuit tactics
    /**
     * Police response and pursuit tactics
     * Source: src/pursuit.js
     * Scope: shared game closure.
     * What each wanted star sends (POLICE_TIERS), where the reinforcements come
     * from, how the cars drive a pursuit (intercept, PIT, box, flank, stuck
     * recovery), how officers on foot fight (weapon profiles, fair accuracy, cover
     * behind their own car, flanking, suppressive fire), the arrest (BUSTED), the
     * tank the fifth star can bring, dispatch radio, and the search area drawn on
     * the radar.
     *
     * Units are vehicles with `cop` set. `lawUnit` marks the heavier kinds:
     * 'swat' (tactical van, four armoured officers with rifles), 'fed' (black SUV,
     * three agents with rifles) and 'army' (a Fort Sentinel tank, no crew on
     * foot). Patrol cars keep `type === 'police'` and no `lawUnit`.
     *
     * FIVE STARS brings the army in stages: first the light units, army jeeps
     * with a roof gunner ('armyJeep'), an APC with a turret gun and four soldiers
     * ('armyApc') and a truck with five ('armyTruck'); the tank ('army') only rolls
     * once the player has survived TANK_AFTER_SECONDS at five stars. Army units
     * carry `armyUnit` (not `military`, which is Fort Sentinel's own garrison).
     */
    // @include src/pursuit-dispatch.js
    // @include src/pursuit-officers.js
    // END SUBSYSTEM: src/pursuit.js
