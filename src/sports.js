    // BEGIN SUBSYSTEM: src/sports.js — Live basketball and soccer matches
    /**
     * Live city sports
     * Source: src/sports.js
     * Scope: shared game closure.
     * Six basketball players and twenty-two football players make possession-based
     * decisions. Passes, shots, rebounds, saves and scores come from persistent match
     * state; the ball and the players do not follow a prerecorded decorative loop.
     *
     * MATCH DAY (sports-fixtures.js decides who plays and when)
     * - Each venue shows one fixture at a time. The world clock places it: before
     *   the warm-up the pitch is empty and the boards announce the next match;
     *   the teams come out to warm up, kick off at the listed time, break at half
     *   time (quarter breaks on the court), and leave after full time while the
     *   result stays on the boards. `match.stage` is that timeline stage and
     *   `match.phase` the state of play within it (play, restart, celebrate).
     * - Officials: a referee and two assistants at the stadium, one referee on the
     *   court. They whistle kickoffs, goals, breaks, full time and pitch invaders.
     *
     * PEOPLE LIKE ANYONE ELSE
     * - Athletes, officials and stewards are ordinary people to the combat code:
     *   sportsTargets() is added to the bullet, knife, blast and vehicle target
     *   lists, so they are hit by strikePerson()/knockPerson() like pedestrians
     *   and bleed the same way. sportsCheckHarm() notices the damage: the match
     *   is abandoned, everyone on the field runs for the exits, the stands empty
     *   (sports3d.js), fans stream out of the gates as real pedestrians who panic
     *   through crowd.js, and the crowd calls it in (crime()). The dead stay down
     *   and the venue stays closed until the next day's fixture.
     *
     * THE PLAYER ON THE PITCH (soccer)
     * - Gaps in the perimeter boards (sports-world.js) lead from the concourse on
     *   to the grass. Walking into the ball dribbles it (ownerId SPORTS_HUMAN);
     *   E kicks it the way you face (hold Shift, walking, for a softer, lower
     *   strike): sportsKick(). The ball rolls with friction, bounces off posts,
     *   the bar and the boards, and a goal is the whole ball crossing the line
     *   between the posts and under the bar.
     * - During a match the players contest the ball (chase, tackle, the keeper
     *   saves), the referee whistles, and after a while (or a goal) two stewards
     *   come to walk you out of the ground. Score and the crowd roars, the boards
     *   flash GOAL! and there is a small reward.
     *
     * Integration contract:
     * - Call updateSports(deltaSeconds) during play and resetSports() on a new game.
     * - Render match.people (players, officials, stewards; skip `hidden`) using the
     *   athlete model, with optional action-specific poses. The separate ball has
     *   world x/y and height z. Venue x/y is its top-left corner; both matches
     *   attack along the world x axis (team 0, the home side, attacks east).
     * - drawSports(context) draws people, balls and scores for the two-dimensional
     *   fallback renderer; sports-world.js owns the static ground markings.
     * - getSportsSnapshot() returns copies for tests and independent browser review;
     *   sportsConsole() adds the developer-console methods (match, ballState...).
     *
     * The established human meshes are approximately 18 world units tall. The court
     * and pitch use the existing city's compressed map scale; hoops, goals and balls
     * deliberately follow the HUMAN mesh proportions, rather than applying the
     * nominal map distance conversion to those visible objects.
     */

    // @include src/sports-setup.js

    // @include src/sports-play.js

    /**
     * BALL PHYSICS
     * A loose ball rolls with friction, bounces (losing half its speed), clips
     * the posts and the crossbar, and counts as a goal once it is wholly over
     * the line between the posts and under the bar. Outside live play the
     * perimeter boards keep it on the pitch; during play it goes out for a
     * throw-in, goal kick or corner as before.
     */
    // @include src/sports-ball.js

    /**
     * OFFICIALS
     * The referee keeps a diagonal off the ball; the assistants run their
     * touchlines level with it, each covering one half.
     */
    // @include src/sports-timeline.js

    /**
     * THE PLAYER ON THE PITCH
     */
    // @include src/sports-human.js

    // @include src/sports-frame.js
    // END SUBSYSTEM: src/sports.js
