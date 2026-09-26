    // BEGIN SUBSYSTEM: src/military.js — Fort Sentinel
    /**
     * Fort Sentinel
     * Source: src/military.js
     * Scope: shared game closure.
     * The base plan (SENTINEL), perimeter and gate security, military vehicles,
     * garrison life (posts, patrols, drill, range practice, supply runs), the
     * alarm and lockdown, and base combat. base3d.js draws everything here.
     *
     * Plan (x east, y south; the island is x 8680..11000, y 7060..10500):
     *   - A double chain-link fence with razor wire round x 9300..10560,
     *     y 7750..9950, a clear zone inside it, eight watch towers and a
     *     perimeter road the patrol jeeps drive.
     *   - The main gate on the west side where the Sentinel Causeway lands
     *     (y 8150): a jersey-barrier funnel, a guard booth on a centre island
     *     under a canopy, a drop arm and anti-ram bollards per lane and a
     *     sliding palisade gate in the fence line that closes on lockdown.
     *   - North: HQ and its car park, the comms compound (lattice mast, radome,
     *     rotating radar, water tower). Middle: obstacle course, parade ground,
     *     three barracks, mess hall, clinic. South-middle: motor pool, container
     *     yard, fuel depot, ammunition bunkers, rifle range. South: two hangars,
     *     the control tower, helipads, apron and a short runway.
     * Gate pieces the renderer animates are exposed as `militaryGateState`.
     */
    // @include src/military-base.js
    // @include src/military-life.js
    // END SUBSYSTEM: src/military.js
