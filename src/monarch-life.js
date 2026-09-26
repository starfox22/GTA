    // BEGIN SUBSYSTEM: src/monarch-life.js — Monarch Isle: traffic, people, boats and sound
    /**
     * Monarch Isle: life
     * Source: src/monarch-life.js
     * Scope: shared game closure (after monarch.js and crowd.js).
     *
     * TRAFFIC. The island's streets are a graph (isleRoadGraph): nodes at the
     * grid junctions, the two roundabouts, the city end of the Sovereign Bridge
     * and the Eagle Pass end of the Regency Road; links along the streets with a
     * lane each way (right-hand traffic: 24 off the centre line on a plain
     * street, 36 on a boulevard's carriageway). A car (`c.isle`) follows its
     * lane and, as it nears a node, picks the next link (mostly straight on),
     * then drives the crossing: a straight line or a curve through a junction,
     * round the ring anticlockwise at a roundabout (entering only when the ring
     * is clear to its left), a U-turn at the end of the road. At a junction it
     * waits while another car is in the box (an all-way stop). Past the
     * Sovereign Bridge's city end the car becomes ordinary city traffic; city
     * traffic that drives east over the bridge becomes island traffic. The cars
     * follow, slow for corners and stop for people as the county traffic does.
     *
     * PEOPLE. Walkers (`p.isle`) use a pavement graph: the corners of every
     * junction, the pavements between them, the zebra crossings, the ring walks
     * of the roundabouts, the marina promenade, the beach paths, the garden's
     * walks. They go from place to place (shop doors, where they may go in for a
     * while, the Palm House, the pond, the fountains, the marina, the beach),
     * stop to look and take photographs, and some jog or walk the dog. Doormen
     * and valets stand at the hotel and the restaurant, security guards at the
     * villa gates. They only exist while the player is near the island.
     *
     * BOATS. A few tenders, speedboats and a launch cruise loops out of the
     * basin and along the channel (`c.isleBoat`, steered by isleBoatHelm).
     *
     * SOUND. Rigging clinking and halyards slapping in the marina, gulls,
     * running water near the fountains and the pond, birdsong in the garden.
     */
    // @include src/monarch-life-traffic.js
    // @include src/monarch-life-crowd.js
    // END SUBSYSTEM: src/monarch-life.js
