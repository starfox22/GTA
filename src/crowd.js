    // BEGIN SUBSYSTEM: src/crowd.js — Crowd life, perception and reactions
    /**
     * Crowd life, perception and reactions
     * Source: src/crowd.js
     * Scope: shared game closure.
     * Who is on the pavement (appearance, role, time of day, streaming around the
     * player), how they walk it (lanes, corners, signals, doors), the little scenes
     * that make a street feel used (vendors, buskers, cafes, bus stops, club queues,
     * deliveries, taxi fares), and how people perceive and react to danger:
     * gunfire, crashes, near misses, bodies, a gun pointed at them, and the police
     * asking which way you went.
     *
     * The renderer never decides behaviour. Everything it needs is on the person:
     * `look` (appearance), `pose` (what the body is doing), `carry`, `dog`, and the
     * movement itself, from which it derives stride and speed.
     */

    /**
     * APPEARANCE
     * A look is chosen once per person and kept: skin, hair, clothes, build and
     * the few things they carry. Palettes are deliberately broad so a street of
     * forty people never repeats itself in an obvious way.
     */
    // @include src/crowd-looks.js

    /**
     * SPOKEN LINES
     * Short enough to read in a bubble at a glance. The pedestrian lines in
     * game.js still cover the everyday chatter; these are the reactions.
     */
    // @include src/crowd-speech.js

    /**
     * SHARED STATE
     * One object holds the director's timers and lists so the rest of the closure
     * sees a single name.
     */
    // @include src/crowd-space.js

    /**
     * STREAMING
     * The city is large and the camera is small. Rather than spreading six
     * hundred people evenly across forty square kilometres, ordinary walkers are
     * kept in a ring around the player: whoever drifts far away and out of sight
     * is re-dressed and placed back on a sidewalk just beyond the edge of the
     * screen, so the streets you can see are always busy. How busy follows the
     * hour (cityTempo) and the district (the docks are quiet, Broadway is not).
     */
    // @include src/crowd-streaming.js

    /**
     * WALKING THE GRID
     * Walkers keep to the right-hand side of the sidewalk (so two streams pass
     * without walking through each other), turn at corners onto the cross
     * street, wait at the kerb for their signal and glance before stepping out,
     * and break the walk with small routines: stopping to take a call, looking
     * in a window, going into a shop, sitting on a bench, or stopping to talk to
     * someone they know.
     */
    // @include src/crowd-walking.js

    /**
     * PERCEPTION
     * An incident (a shot, a blast, a crash, a person hit by a car, a body) is
     * heard and seen outward from where it happened. Each person within reach
     * decides whether they perceived it: gunfire and explosions are heard by
     * everyone in range, the rest must be seen (building-aware line of sight) or
     * be very close. The reaction is scheduled after a delay that grows with
     * distance, so a shot sends a visible ripple through a street instead of
     * flipping everyone at once. Someone staring at their phone is slower.
     */
    // @include src/crowd-perception.js

    /**
     * RUNNING A REACTION
     * One branch per reaction. Each sets the pose the renderer shows and moves
     * the person if the reaction moves them; `dur` ends it, and `then` chains
     * the next (cover → run, gasp → watch, dodge → shake a fist).
     */
    // @include src/crowd-reactions.js

    /**
     * STREET SCENES
     * Small set pieces staged around the player, off screen, so there is always
     * something going on when you arrive: a hot-dog cart with a queue, a busker
     * with a few people listening, cafe tables with people over coffee, smokers
     * outside an office door, a delivery van double-parked with its driver
     * wheeling boxes in (and the traffic behind it leaning on the horn), people
     * waiting at bus shelters, and after dark a queue and a bouncer outside every
     * bar and club. Members are ordinary pedestrians with a `scene`: anything
     * that frightens them breaks the scene like it would break anyone's walk, and
     * the people who work there come back once it is over.
     */
    // @include src/crowd-scenes.js
    /**
     * TAXIS AND BUSES
     * A free cab heading down a street picks up the person waving at the kerb:
     * it pulls in, they get in, it goes. Buses stop at shelters and take on
     * whoever is waiting. The stop itself is a speed cap the traffic AI obeys
     * (curbsideStop), so it brakes like it does for anything else.
     */
    // @include src/crowd-transit.js

    /**
     * TRAFFIC LIFE
     * Drivers are people too. A car stuck behind something that is not a red
     * light (a double-parked van, a wreck, the player's car, people standing in
     * the road) waits a moment and then leans on the horn, harder the longer it
     * goes on. After a real crash both drivers stop; they get out, and depending
     * on who they are they argue, stand holding their head, call it in, or leave
     * the car and walk away shaken. A fender-bender earns a horn blast.
     */
    // @include src/crowd-traffic.js
    /**
     * THE DIRECTOR
     * Runs once a frame before the people loop.
     */
    function updateCrowd(deltaSeconds) {
      crowd.hour = crowdHour();
      crowd.tempo = cityTempo();
      buildCrowdGrid();
      refreshBodies(deltaSeconds);
      aimReactions(deltaSeconds);
      policeTips(deltaSeconds);
      nearMisses(deltaSeconds);
      crowdEncounters(deltaSeconds);
      updateScenes(deltaSeconds);
      knockSceneProps(deltaSeconds);
      updateIndoors();
      updateTrafficLife(deltaSeconds);
      for (let i = crowd.incidents.length - 1; i >= 0; i--)
        if (gameTime - crowd.incidents[i].time > 90) crowd.incidents.splice(i, 1);
    }
    /* Developer console summary: who is where doing what. */
    function pedestrianReport() {
      const tally = (fn) => {
        const out = {};
        for (const p of pedestrians) {
          const k = fn(p);
          if (k !== undefined && k !== null) out[k] = (out[k] || 0) + 1;
        }
        return out;
      };
      const nearby = pedestrians.filter((p) => p.hp > 0 && crowdInView(p.x, p.y, 0));
      return {
        total: pedestrians.length,
        alive: pedestrians.filter((p) => p.hp > 0).length,
        inView: nearby.length,
        withinRing: pedestrians.filter((p) => p.hp > 0 && Math.abs(p.x - player.x) < CROWD_RING && Math.abs(p.y - player.y) < CROWD_RING).length,
        target: Math.round(CROWD_STREET_TARGET * cityTempo().out * districtBustle(player.x, player.y)),
        tempo: cityTempo().name,
        reactions: tally((p) => p.react?.kind),
        poses: tally((p) => (p.hp > 0 && crowdInView(p.x, p.y, 0) ? p.pose || (p.walking ? 'walk' : 'stand') : null)),
        roles: tally((p) => p.role),
        states: tally((p) => p.state),
        indoors: crowd.indoors.reduce((n, s) => n + s.party.length, 0),
        scenes: crowd.scenes.map((s) => ({ kind: s.kind, x: Math.round(s.x), y: Math.round(s.y), members: s.members.length })),
        incidents: crowd.incidents.map((i) => ({ kind: i.kind, age: +(gameTime - i.time).toFixed(1), callers: i.callers, watchers: i.watchers, filmers: i.filmers, spread: i.spread, reported: i.reported })),
        reports: crowd.reports,
        dogs: pedestrians.filter((p) => p.dog).length,
        busStops: BUS_STOPS.length,
        frontages: streetFrontages().length,
        props: crowd.props.length,
        // The speech bubbles on screen (at most SPEECH_BUBBLES_MAX) and the lines
        // still live but not shown (waiting for a slot, or out of range).
        bubbles: speechShown.map((p) => ({
          text: p.speech,
          rank: speechPriority(p),
          seconds: +(p.speechUntil - gameTime).toFixed(1),
          d: Math.round(distanceBetween(p, player)),
          // Height of the view over the speaker (m) and the bubble's fade for it.
          viewHeight: +worldMeters(speechViewHeight(p)).toFixed(1),
          fade: +speechHeightFade(p).toFixed(2),
          rider: !!p.coasterRider,
        })),
        unshownLines: [...pedestrians, ...vehicles, ...gangMembers, ...coasterSpeakers()].filter(
          (p) => p.speech && p.speechUntil >= gameTime && !speechShown.includes(p) && !(p.posed && p.speech === p.posed),
        ).length,
        honking: vehicles.filter((c) => (c.blockedFor || 0) > 2).length,
        honks: crowd.honks,
        driversOut: pedestrians.filter((p) => p.car && p.hp > 0).length,
        nearestDoor: (() => {
          const door = doorNear(player, 250);
          return door ? { x: Math.round(door.x), y: Math.round(door.y), place: door.place?.name || null } : null;
        })(),
      };
    }
    // END SUBSYSTEM: src/crowd.js
