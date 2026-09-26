    // BEGIN SUBSYSTEM: src/beachvolley.js — Beach volleyball on Palm Keys Beach
    /**
     * Beach volleyball
     * Source: src/beachvolley.js
     * Scope: shared game closure.
     *
     * THE COURT
     * A regulation beach court (16 x 8 m, net 2.43 m) in a raked sand pit on the
     * upper sand at the west end of Palm Keys Beach, north of the umbrella rows
     * and clear of the kiosks (`volleyCourtPlan`, placed by buildBeachLayout and
     * reserved there so nothing else is laid on it). The long axis runs east-west:
     * team 0 plays the west half, team 1 the east. beachvolley3d.js draws the
     * pit, lines, poles, net and the scoreboard from the same plan; the poles and
     * the net are solid on foot (`volleyBlocked`, from beachBlocked).
     *
     * THE MATCH
     * The four `volley` beachgoers (beach.js) play 2 v 2 by rally scoring to 15
     * (win by two). The ball is a real projectile (gravity, a sand bounce that
     * kills most of its speed, the net), not a scripted arc: every touch is a
     * launch solved for a target and an apex, so the AI knows where it will come
     * down and can run there. A side has three touches: the receiver bumps it to
     * the setter by the net, the setter puts it up for the attacker, and the
     * attacker jumps and spikes into the open court (or rolls a shot over it).
     * Every touch can go wrong (a shanked pass, a set too tight, a spike into the
     * net or long), which is what ends rallies. A ball landing in (lines count)
     * scores for the other side; out, it scores against whoever touched it last.
     *
     * THE PLAYER
     * Walk onto the court and JOIN MATCH (E): the player takes the place of the
     * nearer player of the side they stand on, who goes and watches from the
     * sideline, and a fresh game starts. Move with the movement keys; E or a left
     * click hits a ball in reach (a press a moment early is held for it). The hit
     * goes to the other side, aimed with the mouse, or across the court with the
     * movement keys; with Walk (Shift) held it is a soft set to the partner; run
     * into a high ball by the net for a jump spike. The partner reads the play:
     * it takes balls nearer to it and sets the player up at the net. A ring on the
     * sand marks where a ball the player should take will come down. Walking off
     * the court, or LEAVE MATCH (E) while the ball is dead, hands the place back.
     * A hint card (`#volleyCard`) shows the score and the controls meanwhile.
     */
    // @include src/beachvolley-court.js
    // @include src/beachvolley-play.js
    // END SUBSYSTEM: src/beachvolley.js
