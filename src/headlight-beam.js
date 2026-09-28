    // Headlight light, game side: the LOW BEAM pattern (lowBeamIntensity), its strength, reach and the VEHICLE LIGHT
    // BUDGET that many overlapping beams share (headlightRoadLight), the JS mirror of CAR LAMPS in lighting3d-sky.js.
    /**
     * VEHICLE LIGHT BUDGET
     * Beams add up: at a junction the road in the middle lies in the beams of
     * every car waiting at it, and summed one on top of the other (each with
     * its own soft cap) eight low beams burned the crossing to a white sheet.
     * Real low beams do add, but film and the eye compress: the overlap reads a
     * little brighter, never as a floodlit stage. So a lit surface keeps one
     * budget for all vehicle light (the street lamps' pool counted at half, the
     * drive map, then the CAR LAMPS slots): each light fills a share of what is
     * left, `cap * (exp(-fill) - exp(-(fill + share)))`, so one beam alone
     * looks as its own soft cap makes it and many never pass the largest cap.
     * The road (surfaces facing up) takes CAR_LAMP_ROAD_CAP, faces square to a
     * car CAR_LAMP_FACE_CAP (a wall or a pedestrian in the lights stays
     * bright), grazed faces less. The renderer's GLSL (CITY_LIGHT_APPLY,
     * lighting3d-sky.js) and the drive map's beam texture use these numbers;
     * headlightRoadLight() below computes the same light on a level road, so a
     * test (tools/tests/headlight-budget.mjs) can hold the look without WebGL.
     */
    // The pattern's strength: hot-spot intensity x metres squared, in scene light.
    const CAR_LAMP_STRENGTH = 36000,
      CAR_LAMP_ROAD_CAP = 1.5,
      CAR_LAMP_FACE_CAP = 5,
      // Where a beam starts on the road (units ahead of the lamps: none on the
      // bumper's own shadow line, full by ~7 m) and where its light gives out
      // (metres from the lamps: a pool about 35 m long, not a floodlit block;
      // on the range, slots reading the TERRAIN HORIZON keep the long throw).
      CAR_LAMP_NEAR = [12, 56],
      CAR_LAMP_REACH = [18, 40],
      CAR_LAMP_RANGE_REACH = [26, 58],
      // A nominal pair of lamps: height and half spacing (m).
      NOMINAL_LAMP_HEIGHT = 0.65,
      NOMINAL_LAMP_SPAN = 0.62;
    function beamSmooth(x, a, b) {
      const t = clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    }
    /**
     * LOW BEAM
     * The photometric pattern of a pair of dipped headlights (right-hand
     * traffic), shared by the lit materials (CAR LAMPS), the rain and the drive
     * light map's beam texture, so near and far cars throw the same light. `t`
     * and `v` are the tangents of the angle to the kerb side and above the
     * lamps; the result is the intensity relative to the hot spot:
     *
     *   - a flat-topped fan about a lane and a half wide at 20 m, aimed a
     *     touch to the kerb and wider on that side, over a faint wide flood
     *     (the old fan, twice the flood, lit a junction's pavements from every
     *     car waiting at it)
     *   - a sharp cut-off just under the horizon on the oncoming side that
     *     rises 15 degrees from the elbow on the kerb side (so the beam reaches
     *     farther along the kerb and lights the pavement and signs there), with
     *     3% of stray light at the line fading within a few degrees above it
     *     (a flat 3% lit the roof of a van in the queue ahead like the road)
     *   - the hot spot just under the cut-off, falling off towards the road
     *     in front of the bumper (steep angles), so the road is lit from a few
     *     metres out and the far part fades rather than ends
     *
     * Keep CITY_LOW_BEAM (lighting3d-sky.js) in step.
     */
    function lowBeamIntensity(t, v) {
      const u = t - 0.03,
        spread = u > 0 ? 0.38 : 0.28,
        q = (u * u) / (spread * spread),
        lateral = 0.88 * Math.exp(-q * q) + 0.12 * Math.exp(-0.35 * q),
        cut = -0.011 + 0.27 * clamp(t + 0.02, 0, 0.12),
        glare = beamSmooth(v, cut - 0.005, cut + 0.005),
        down = Math.max(-v, 0),
        vertical = down < 0.02 ? 1 : Math.pow(down * 50, -2.3),
        hot = 1 + 0.7 * Math.exp(-(v + 0.02) * (v + 0.02) * 6944 - u * u * 100),
        stray = 0.03 * Math.exp(-Math.max(v - cut, 0) * 20);
      return lateral * vertical * hot * (1 + (stray - 1) * glare);
    }
    // What one car's low beams lay on a level road at `ahead` / `side` metres from
    // the lamps (side + to the kerb), before the budget: irradiance x cosine.
    function lowBeamRoad(ahead, side, strength = CAR_LAMP_STRENGTH, height = NOMINAL_LAMP_HEIGHT, span = NOMINAL_LAMP_SPAN) {
      if (ahead * UNITS_PER_METRE < 2) return 0;
      const s = Math.sign(side) * Math.max(Math.abs(side) - span, 0),
        d2 = ahead * ahead + s * s + height * height,
        near = beamSmooth(ahead * UNITS_PER_METRE, CAR_LAMP_NEAR[0], CAR_LAMP_NEAR[1]),
        reach = 1 - beamSmooth(d2, CAR_LAMP_REACH[0] ** 2, CAR_LAMP_REACH[1] ** 2);
      return ((strength * lowBeamIntensity(s / ahead, -height / ahead) * near * reach) / Math.max(d2, 0.3)) * (height / Math.sqrt(d2));
    }
    // The light a level road takes at map (x, y) from `lamps` ([{ x, y, a }] lamp
    // points and headings, nominal lamps), through the VEHICLE LIGHT BUDGET as
    // CITY_LIGHT_APPLY adds it: { total, beams (each alone, soft capped), sum }.
    function headlightRoadLight(lamps, x, y) {
      const cap = CAR_LAMP_ROAD_CAP,
        beams = [];
      let left = 1,
        total = 0;
      for (const lamp of lamps) {
        const dx = x - lamp.x,
          dy = y - lamp.y,
          c = Math.cos(lamp.a),
          s = Math.sin(lamp.a),
          e = lowBeamRoad((dx * c + dy * s) / UNITS_PER_METRE, (-dx * s + dy * c) / UNITS_PER_METRE),
          kept = Math.exp(-e / cap);
        beams.push(cap * (1 - kept));
        total += cap * left * (1 - kept);
        left *= kept;
      }
      return { total, beams, sum: beams.reduce((a, b) => a + b, 0), cap };
    }
