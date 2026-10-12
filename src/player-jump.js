    // The player's jump on foot (the jump action, Space): a crouch, a tucked hop over low walls, railings, benches and
    // fences that stop a walker, and a knee-bent landing; the pose model the renderer reads (playerJumpPose).
    /**
     * PLAYER JUMP
     * A real person's hop: the hips rise JUMP_HEIGHT (0.5 m) and come down again
     * in JUMP_AIR (~0.64 s, the ballistic time for that height), after a short
     * crouch on the ground (JUMP_CROUCH) and before a short landing on bent knees
     * (JUMP_LAND). The run is carried through the air (JUMP_CARRY of the pace the
     * movement keys gave at take-off); there is no steering in the air, no double
     * jump and a short JUMP_COOLDOWN after each landing. A standing jump goes
     * straight up.
     *
     * OVER LOW THINGS
     * In the air the legs tuck: the feet rise towards the hips by up to
     * JUMP_TUCK_RISE (0.55 m) on top of the lift, so the soles clear `clearance`
     * (playerJumpClearance(), map units above the take-off ground, at most
     * JUMP_LOW_MAX, 1.05 m: a 1 m railing only at the top of a well-timed running
     * jump, a knee-high wall easily). The player's own foot steps (game-collision.js
     * footStepBlocked) then ask solid() twice: everything a jump can never clear
     * (no `height`, or taller than JUMP_LOW_MAX) at the body's full width, and the
     * low heighted solids (walls, railings, barriers, benches; `height` in map
     * units, `jumpH` on foot furniture, JUMP_PROP_HEIGHT for knockable props) only
     * at the legs' width (JUMP_BODY_R) and only while the feet are not above them
     * (`solidSkipBelow`). A heighted solid lower than SOLID_LOW_MIN marks water (a
     * pool's edge, a lily pond) and is never jumped.
     *
     * THE VAULT
     * A running jump (pace at least JUMP_VAULT_PACE) at something the hop
     * cannot clear but a hand on its top can (JUMP_LOW_MAX <= height <
     * JUMP_VAULT_MAX, 1.5 m: a villa's garden wall or railings, the sea railing on
     * the quays) is a vault: `jumpVaultAhead()` looks along the run at take-off,
     * and if the first thing in the way is vaultable the hips are pushed up by
     * the hand (JUMP_VAULT_LIFT over the flight) and the clearance holds at
     * JUMP_VAULT_MAX from JUMP_VAULT_FROM to JUMP_VAULT_TO of the flight, so
     * the timing of the take-off does not decide it. Anything at or above
     * JUMP_VAULT_MAX (tennis-court and street-end fences, privet hedges, the
     * squares' garden railings) still stops it.
     *
     * OFF THE QUAY
     * In the air the shoreline rule lets him leave dry land, a quay or a dock
     * for the sea (water.js shoreStepBlocked; never a bridge or the pier): the
     * flight ends over water, the landing hands over to the fall (`fall.jumped`,
     * which updateSwimming waits for) and the fall ends in the water swimming
     * (falls-body.js fallIntoWater); he climbs out at a ladder or a beach as any
     * swimmer does. Only some blockers take part
     * (rectListBlocked: Monarch Isle, the harbour, the marina, the airport's
     * scenery; the county, the street ends, North Point Key, the stadium, foot
     * furniture, props): Fort Sentinel's walls and barriers, the theme park
     * (its lagoon and flume pools) and the Marea beach club (its ropes, glass and
     * pool keep the door's queue) stay solid at any height. After the landing the low test
     * stays at the legs' width (`jumpSettle`) until the body's full width is clear
     * again, so the player is not left stuck against the railing behind him; a
     * landing on top of something is slid off along the jump. Landing lower than
     * the take-off (off a quay, a drop) hands the body to the fall on foot
     * (falls-body.js startPlayerFall); every landing goes through playerImpact().
     *
     * STATE
     * `player.jump` (a carrier while it lasts, under a second; teleportPlayer and
     * die() release it: cancelPlayerJump) holds the phase, its clock, the take-off
     * ground and the carried velocity; `player.jumpUntil` is set for the air time,
     * which every on-the-ground rule already reads (settleFootOnGround, footsteps,
     * the integrity check, Fort Sentinel's watch). Console jumpReport().
     */
    const JUMP_HEIGHT = 0.5 * UNITS_PER_METRE,
      JUMP_AIR = 2 * Math.sqrt((2 * JUMP_HEIGHT) / GRAVITY),
      JUMP_CROUCH = 0.1,
      JUMP_LAND = 0.2,
      JUMP_COOLDOWN = 0.3,
      JUMP_TUCK_RISE = 0.55 * UNITS_PER_METRE,
      JUMP_CARRY = 1.05,
      // The landing's walking pace, as a share of the pace.
      JUMP_LAND_PACE = 0.55,
      JUMP_LOW_MAX = JUMP_HEIGHT + JUMP_TUCK_RISE,
      // The vault (above): what a hand on the top clears (exclusive), the run it takes, the hips' extra lift, and the
      // share of the flight the clearance holds at JUMP_VAULT_MAX.
      JUMP_VAULT_MAX = 1.5 * UNITS_PER_METRE,
      JUMP_VAULT_PACE = 0.6 * FOOT_RUN,
      JUMP_VAULT_LIFT = JUMP_VAULT_MAX - JUMP_LOW_MAX,
      JUMP_VAULT_FROM = 0.12,
      JUMP_VAULT_TO = 0.85,
      // The legs' footprint against a low thing (the body's width is 8 units).
      JUMP_BODY_R = 3,
      // How far a landing on top of a low thing slides along the jump to come off it.
      JUMP_SLIDE_REACH = 20,
      // Knockable street props (damage-upkeep.js STREET_PROP_KINDS) a jump clears, by kind (map units high); a kind not
      // listed (lamps, trees, signals, planters with their tree, umbrellas) is too tall.
      JUMP_PROP_HEIGHT = {
        trash: 8,
        crate: 4.8,
        lounger: 3.2,
        bench: 6.8,
        seat: 6.8,
        bikerack: 7.2,
        hydrant: 6,
        bollard: 7.2,
        railing: 8,
      };
    const jumpLog = { jumps: 0, landed: 0, falls: 0, slid: 0, vaults: 0, intoWater: 0, refused: '', last: null };
    let jumpHeldBefore = false,
      jumpReadyAt = 0;
    /* Why a jump cannot start now ('' when it can). */
    function playerJumpRefusal() {
      if (gameMode !== 'play') return 'mode';
      if (player.hp <= 0) return 'dead';
      if (player.jump) return 'already jumping';
      if (gameTime < jumpReadyAt) return 'cooldown';
      if (player.car || player.parachute || player.coaster || transitRide || taxiRide) return 'aboard';
      if (player.swimming || player.wading || player.pool) return 'in the water';
      if (player.climbing || player.fall || player.thrown || player.tumble) return 'not on his feet';
      if (player.carjack) return 'carjacking';
      if (player.roof || player.buildingRoof || player.deck) return 'on a roof or a deck';
      if (player.sceneSeat || player.inConversation || player.hidden) return 'busy';
      if ((player.jumpUntil || 0) > gameTime || volley.human) return 'volleyball';
      if (lootCrouching() || summitDigging() || fortGateTalking() || lockpickWorking()) return 'busy';
      if (chaseAiming()) return 'aiming';
      return '';
    }
    /* The jump's shape at the clock `t` of its air time (0..JUMP_AIR): the lift (map units over the take-off
       ground) and the tuck (0..1, the feet drawn up towards the hips). */
    function jumpLiftAt(t, vault) {
      const u = clamp(t / JUMP_AIR, 0, 1);
      // A vault: the hand on the top pushes the hips up over it (the clearance itself is held, playerJumpClearance).
      return 4 * JUMP_HEIGHT * u * (1 - u) + (vault ? JUMP_VAULT_LIFT * Math.sin(Math.PI * u) : 0);
    }
    function jumpTuckAt(t) {
      const u = clamp(t / JUMP_AIR, 0, 1);
      // Up quickly after the push-off, held over the top, let down to reach for the ground.
      if (u < 0.3) return Math.sin((u / 0.3) * (Math.PI / 2));
      if (u < 0.65) return 1;
      const e = (u - 0.65) / 0.35;
      return 1 - 0.85 * e * e * (3 - 2 * e);
    }
    /* The soles' height over the take-off ground now (map units): what a low thing must be under. */
    function playerJumpClearance() {
      const j = player.jump;
      if (!j || j.phase !== 'air') return 0;
      const hop = jumpLiftAt(j.t, false) + JUMP_TUCK_RISE * jumpTuckAt(j.t),
        u = j.t / JUMP_AIR;
      return j.vault && u >= JUMP_VAULT_FROM && u <= JUMP_VAULT_TO ? Math.max(hop, JUMP_VAULT_MAX) : hop;
    }
    /* At take-off: is the first thing in the way along the run (within the flight's reach, at the legs' width) too
       high for the hop but low enough for a hand on its top? Probes solid() and the foot furniture with the skip
       height set to the hop's and then the vault's, as footSolid does in the step. */
    function jumpVaultAhead(x, y, heading, pace) {
      if (pace < JUMP_VAULT_PACE) return false;
      const reach = pace * JUMP_AIR * JUMP_VAULT_TO,
        c = Math.cos(heading),
        s = Math.sin(heading),
        blockedAt = (px, py, skip) => {
          solidSkipBelow = skip;
          const hit = solid(px, py, JUMP_BODY_R, true) || footObstacleBlocked(px, py, JUMP_BODY_R);
          solidSkipBelow = 0;
          return hit;
        };
      for (let d = 4; d <= reach; d += 2) {
        const px = x + c * d,
          py = y + s * d;
        if (!blockedAt(px, py, JUMP_LOW_MAX)) continue;
        return !blockedAt(px, py, JUMP_VAULT_MAX);
      }
      return false;
    }
    /* Airborne: the jump moves the player itself (game-update.js skips the walking). */
    function playerJumpFlying() {
      return player.jump?.phase === 'air';
    }
    /* The walking pace's share during the crouch and the landing. */
    function playerJumpPace() {
      return player.jump?.phase === 'land' ? JUMP_LAND_PACE : 1;
    }
    function cancelPlayerJump() {
      // The ground under him is set again by whatever holds him next (settleFootOnGround on foot).
      if (player.jump) player.jumpUntil = 0;
      player.jump = null;
      player.jumpSettle = false;
      jumpLow.on = false;
      jumpLow.clear = 0;
    }
    function startPlayerJump() {
      const heading = playerMoveHeading(),
        pace = heading === null ? 0 : footPace() * JUMP_CARRY;
      player.jump = {
        phase: 'crouch',
        t: 0,
        ground: terrainHeight(player.x, player.y),
        z: 0,
        vx: 0,
        vy: 0,
        heading: heading ?? player.a,
        pace,
        startX: player.x,
        startY: player.y,
        maxClear: 0,
        vault: false,
      };
      if (heading !== null) player.a = heading;
      jumpLog.jumps++;
    }
    /* The body is clear of everything at its full width (the ordinary walking test). */
    function jumpFullClear(x, y) {
      return !solid(x, y, 8, true) && !footObstacleBlocked(x, y, 4.5);
    }
    /* Off whatever low thing the landing came down on: along the jump, else back the way it came. */
    function jumpSlideOff(j) {
      const legsClear = (x, y) => !solid(x, y, JUMP_BODY_R, true) && !footObstacleBlocked(x, y, JUMP_BODY_R);
      if (legsClear(player.x, player.y)) return;
      const back = Math.atan2(j.startY - player.y, j.startX - player.x);
      for (const a of [j.heading, back])
        for (let d = 2; d <= JUMP_SLIDE_REACH; d += 2) {
          const x = player.x + Math.cos(a) * d,
            y = player.y + Math.sin(a) * d;
          if (legsClear(x, y)) {
            jumpLow.on = true;
            jumpLow.clear = JUMP_VAULT_MAX;
            moveBody(player, x - player.x, y - player.y, 8);
            jumpLow.clear = 0;
            jumpLog.slid++;
            return;
          }
        }
    }
    function landPlayerJump(j, deltaSeconds) {
      const water = !groundAt(player.x, player.y),
        ground = water ? 0 : terrainHeight(player.x, player.y);
      player.jumpUntil = 0;
      // Lower than the take-off (off a quay, over a drop): the rest of the way is a fall.
      if (water || j.ground - ground > 2) {
        player.jump = null;
        player.jumpSettle = !jumpFullClear(player.x, player.y);
        startPlayerFall(player.x - j.vx * deltaSeconds, player.y - j.vy * deltaSeconds, j.ground + j.z, deltaSeconds);
        if (player.fall) {
          player.fall.vz = -Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
          // Over the sea: updateSwimming leaves the body to the fall until it reaches the water (fallIntoWater).
          player.fall.jumped = true;
        }
        jumpLog.falls++;
        if (water) jumpLog.intoWater++;
        jumpLog.last = { from: [Math.round(j.startX), Math.round(j.startY)], to: [Math.round(player.x), Math.round(player.y)], metres: +worldMeters(Math.hypot(player.x - j.startX, player.y - j.startY)).toFixed(2), maxClearance: +worldMeters(j.maxClear).toFixed(2), vault: !!j.vault, into: water ? 'water' : 'drop' };
        jumpReadyAt = gameTime + JUMP_COOLDOWN;
        return;
      }
      jumpSlideOff(j);
      player.altitude = terrainHeight(player.x, player.y);
      j.phase = 'land';
      j.t = 0;
      j.z = 0;
      jumpLog.landed++;
      jumpLog.last = { from: [Math.round(j.startX), Math.round(j.startY)], to: [Math.round(player.x), Math.round(player.y)], metres: +worldMeters(Math.hypot(player.x - j.startX, player.y - j.startY)).toFixed(2), maxClearance: +worldMeters(j.maxClear).toFixed(2), vault: !!j.vault, into: 'ground' };
      // Both feet down at the speed of the drop (a soft landing: no harm on the one scale, the footfall).
      playerImpact(Math.sqrt(2 * GRAVITY * JUMP_HEIGHT), player.altitude, 'jump');
    }
    /* Every frame in play (game-update.js), before the walking: the press, the phases, the flight. */
    function updatePlayerJump(deltaSeconds) {
      const held = actionHeld('jump'),
        pressed = held && !jumpHeldBefore;
      jumpHeldBefore = held;
      const j = player.jump;
      if (j && (player.car || player.carjack || player.swimming || player.fall || player.thrown || player.parachute || player.coaster || transitRide || taxiRide || player.hp <= 0 || player.roof || player.buildingRoof || player.deck)) cancelPlayerJump();
      if (!player.jump) {
        if (player.jumpSettle && (player.car || jumpFullClear(player.x, player.y))) player.jumpSettle = false;
        if (pressed) {
          jumpLog.refused = playerJumpRefusal();
          if (!jumpLog.refused) startPlayerJump();
        }
      }
      const k = player.jump;
      jumpLow.on = !!k || !!player.jumpSettle;
      jumpLow.clear = 0;
      if (!k) return;
      k.t += deltaSeconds;
      if (k.phase === 'crouch') {
        if (k.t < JUMP_CROUCH) return;
        // Off the ground with the pace the keys give now (a run-up's last strides count).
        const heading = playerMoveHeading();
        k.phase = 'air';
        k.t -= JUMP_CROUCH;
        k.ground = terrainHeight(player.x, player.y);
        k.startX = player.x;
        k.startY = player.y;
        if (heading !== null) {
          k.heading = heading;
          k.pace = footPace() * JUMP_CARRY;
          player.a = heading;
        } else k.pace = 0;
        k.vx = Math.cos(k.heading) * k.pace;
        k.vy = Math.sin(k.heading) * k.pace;
        // A running jump at a wall or railing too high to hop: a hand on its top (THE VAULT).
        k.vault = jumpVaultAhead(player.x, player.y, k.heading, k.pace);
        if (k.vault) jumpLog.vaults++;
        player.jumpAt = gameTime;
        // The effort as he leaves the ground (player-jump-audio.js).
        jumpEffortSound(k.pace);
      }
      if (k.phase === 'air') {
        player.jumpUntil = gameTime + Math.max(0.02, JUMP_AIR - k.t);
        jumpLow.clear = playerJumpClearance();
        k.maxClear = Math.max(k.maxClear, jumpLow.clear);
        if (k.vx || k.vy) moveBody(player, k.vx * deltaSeconds, k.vy * deltaSeconds, 8);
        k.z = jumpLiftAt(k.t, k.vault);
        const water = !groundAt(player.x, player.y),
          ground = water ? 0 : terrainHeight(player.x, player.y);
        // Rising ground under the flight (a slope, a step up) ends it early.
        if (!water && ground >= k.ground + k.z && k.t > JUMP_AIR * 0.5) k.t = JUMP_AIR;
        player.altitude = Math.max(k.ground + k.z, water ? k.ground + k.z : ground);
        if (k.t >= JUMP_AIR) landPlayerJump(k, deltaSeconds);
        return;
      }
      if (k.phase === 'land' && k.t >= JUMP_LAND) {
        player.jump = null;
        player.jumpSettle = !jumpFullClear(player.x, player.y);
        jumpReadyAt = gameTime + JUMP_COOLDOWN;
      }
    }
    /**
     * THE POSE (read by crowd3d-special.js; the renderer never changes it)
     * playerJumpPose() -> null, or { phase: 'crouch' | 'air' | 'land', k: 0..1
     * through the phase, lift: map units, tuck: 0..1, rise: map units the feet
     * are drawn up by, crouch: 0..1 (knees bent on the ground), lead: the leading
     * leg (1 right, 0 left) }.
     */
    const jumpPoseOut = { phase: '', k: 0, lift: 0, tuck: 0, rise: 0, crouch: 0, lead: 1, vault: 0 };
    function playerJumpPose() {
      const j = player.jump;
      if (!j) return null;
      const o = jumpPoseOut;
      o.phase = j.phase;
      o.lead = Math.floor(jumpLog.jumps) % 2;
      o.vault = 0;
      if (j.phase === 'crouch') {
        o.k = clamp(j.t / JUMP_CROUCH, 0, 1);
        o.lift = 0;
        o.tuck = 0;
        o.crouch = Math.sin(o.k * (Math.PI / 2));
      } else if (j.phase === 'air') {
        o.k = clamp(j.t / JUMP_AIR, 0, 1);
        o.lift = jumpLiftAt(j.t, j.vault);
        o.tuck = jumpTuckAt(j.t);
        // The hand on the top: weighted over the middle of a vault's flight.
        o.vault = j.vault ? Math.sin(Math.PI * o.k) : 0;
        // The push-off straightens the crouch in the first tenth of the flight.
        o.crouch = Math.max(0, 1 - o.k / 0.1);
      } else {
        o.k = clamp(j.t / JUMP_LAND, 0, 1);
        o.lift = 0;
        o.tuck = 0;
        // The knees take it quickly and straighten slowly.
        o.crouch = o.k < 0.3 ? Math.sin((o.k / 0.3) * (Math.PI / 2)) : Math.cos(((o.k - 0.3) / 0.7) * (Math.PI / 2));
      }
      o.rise = JUMP_TUCK_RISE * o.tuck;
      return o;
    }
    /* Console jumpReport(): the constants, the state, the last jump and what a jump clears nearby. */
    function jumpReport() {
      const m = (u) => +worldMeters(u).toFixed(2),
        j = player.jump;
      return {
        constants: { heightM: m(JUMP_HEIGHT), airS: +JUMP_AIR.toFixed(3), crouchS: JUMP_CROUCH, landS: JUMP_LAND, cooldownS: JUMP_COOLDOWN, tuckM: m(JUMP_TUCK_RISE), clearsUpToM: m(JUMP_LOW_MAX), vaultsUpToM: m(JUMP_VAULT_MAX), vaultKmh: Math.round(speedKmh(JUMP_VAULT_PACE)), carry: JUMP_CARRY },
        state: j ? { phase: j.phase, t: +j.t.toFixed(3), liftM: m(j.z), clearanceM: m(playerJumpClearance()), paceKmh: Math.round(speedKmh(j.pace)), vault: !!j.vault } : null,
        settle: !!player.jumpSettle,
        refusal: playerJumpRefusal(),
        altitude: +(player.altitude || 0).toFixed(2),
        ground: +terrainHeight(player.x, player.y).toFixed(2),
        log: { ...jumpLog },
        effort: jumpEffortReport(),
      };
    }
    /* Console: what a jump clears. jumpObstacles(x, y, radius, count): the low heighted solids, foot furniture and
       standing props (SOLID_LOW_MIN <= height < JUMP_VAULT_MAX; `vault` when only a running vault clears it) counted
       by kind over the whole map, the quays' sea railing runs among them, and the `count` nearest within `radius` of
       (x, y) with their box (centre, half extents, turn). */
    function jumpObstacles(x, y, radius, count) {
      const low = (h) => h >= SOLID_LOW_MIN && h < JUMP_VAULT_MAX,
        census = {},
        near = [],
        add = (list, kind, h, cx, cy, hx, hy, a) => {
          const key = list + ':' + kind;
          census[key] = (census[key] || 0) + 1;
          const d = Math.hypot(cx - x, cy - y);
          if (d <= radius) near.push({ list, kind, heightM: +worldMeters(h).toFixed(2), vault: h >= JUMP_LOW_MAX, x: +cx.toFixed(1), y: +cy.toFixed(1), hx: +hx.toFixed(1), hy: +hy.toFixed(1), a: +a.toFixed(3), d: Math.round(d) });
        },
        rects = (name, list) => {
          for (const b of list) if (low(b.height)) add(name, b.kind || '?', b.height, b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0);
        };
      rects('monarch', monarchSolidList);
      rects('county', countyStaticSolids);
      rects('airport', AIRPORT_SCENERY_SOLIDS);
      rects('streetEnd', streetEndSolids());
      rects('northPointKey', NORTH_POINT_KEY_SOLIDS);
      rects('sports', SPORTS_GROUND_SOLIDS);
      rects('harbor', harborSolids());
      rects('marina', marinaSolids());
      for (const spot of promenadeSpots())
        if (spot.railLine)
          for (const run of spot.rail) {
            const mid = (run[0] + run[1]) / 2,
              L = spot.railLine;
            add('seaRail', 'sea railing', PROMENADE_RAIL_HEIGHT, L.cx + L.ux * mid, L.cy + L.uy * mid, (run[1] - run[0]) / 2, 1, Math.atan2(L.uy, L.ux));
          }
      const seen = new Set();
      for (const list of footObstacleGrid.values())
        for (const o of list) {
          if (seen.has(o) || !low(o.jumpH)) continue;
          seen.add(o);
          if (o.r !== undefined) add('foot', 'round', o.jumpH, o.x, o.y, o.r, o.r, 0);
          else add('foot', 'box', o.jumpH, o.x, o.y, o.hx, o.hy, Math.atan2(o.s, o.c));
        }
      for (const prop of streetProps) if (!prop.down && low(JUMP_PROP_HEIGHT[prop.kind])) add('prop', prop.kind, JUMP_PROP_HEIGHT[prop.kind], prop.x, prop.y, prop.hx, prop.hy, prop.a);
      near.sort((a, b) => a.d - b.d);
      return { census, near: near.slice(0, count) };
    }
    function playerJumpConsole() {
      return {
        // The jump: constants (height, air time, what it clears), the phase now, the last landing, why a press is refused.
        jumpReport: () => jumpReport(),
        // What a jump clears: counts by kind, and the nearest few to (x, y) (the player when omitted).
        jumpObstacles: (x, y, radius, count) => jumpObstacles(x ?? player.x, y ?? player.y, radius ?? 600, count ?? 8),
      };
    }
