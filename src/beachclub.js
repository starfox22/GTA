    // BEGIN SUBSYSTEM: src/beachclub.js — Marea Beach Club (plan, people, door, schedule)
    /**
     * Marea Beach Club
     * Source: src/beachclub.js
     * Scope: shared game closure.
     *
     * The club on the reserved plot at the west end of Palm Keys Beach
     * (BEACH_CLUB_PLOT, geography.js): a social beach club by day and a
     * nightclub by night.
     *
     * THE PLAN
     * Everything is laid out in plot-local units: `u` east from the plot's west
     * edge (0..400), `v` south from the Marina Rd kerb (0..300); `mareaPoint(u, v)`
     * turns that into a map point. The street side (v < 44) is a public forecourt
     * with the queue lane, the velvet ropes and the door; a white wall with one
     * door in it closes the club off. Inside: the staff block and the lobby at the
     * back, a raised DJ booth against an LED wall facing an open-air dance floor
     * under a lighting truss, the main bar along the west side under a sail roof,
     * the VIP terrace behind ropes on the east side, a row of daybeds, the long
     * infinity pool with cabanas to the west, the swim-up pool bar and the sunken
     * fire lounge to the east, and a deck with a gate down to the sand. beachclub3d.js
     * draws exactly this plan; `beachClubBlocked` (called from solid()) makes
     * the same rectangles solid on foot and `addBeachClubColliders` for vehicles.
     *
     * THE DAY
     *   closed   05:15-09:30  cleaners, nobody else
     *   day      09:30-18:30  social club: daybeds, pool, bars, waiters, a chill set
     *   sunset   18:30-21:45  the day crowd thins, staff set up, people watch the sun go
     *   night    21:45-04:15  the nightclub: queue and bouncers outside, a packed floor
     *   closing  04:15-05:15  lights up, people spill out, taxis at the kerb
     *
     * THE PEOPLE
     * Everyone here is an ordinary pedestrian (so they can be shot, run over,
     * frightened and seen by the crowd's perception) with a `club` record. The
     * cast is a fixed list of slots (a daybed, a place on the dance floor, a stool,
     * a post by the door), each with a threshold: when the club's level for that
     * kind of slot rises above it the slot is filled, and when it falls the person
     * gets up and leaves. Out of sight people simply appear in place; in sight they
     * walk in from the door (or up from the beach, or out of the staff door) along
     * a small graph of walkways, and walk out the same way. At night the dance
     * floor fills from the queue: the head bouncer talks to whoever is at the front
     * (routed through `crowdSay`, so it follows the crowd's speech rules), lets
     * them in or turns them away, and the line shuffles up.
     *
     * TROUBLE
     * Gunfire or an explosion near the club (`beachClubHearsViolence`, called
     * from notifyViolence) empties it: the music cuts, the house lights come up,
     * guests run for the door or the beach gate and are handed to the crowd as
     * ordinary fleeing pedestrians once out; people right next to it react as the
     * crowd decides. The bouncers hold the door, one calls it in, and for a while
     * they go for the player on foot and shove them away.
     *
     * THE PLAYER AT THE DOOR
     * By day the door is open. At night it is closed to anyone without a band:
     * E by the door pays the $40 cover (refused while wanted); E at the VIP rope
     * buys the $250 VIP band. Bands last until the club closes.
     */
    // @include src/beachclub-plan.js

    // @include src/beachclub-people.js

    // @include src/beachclub-queue.js
    // END SUBSYSTEM: src/beachclub.js
