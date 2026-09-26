    // Drawbridge motion: vehicles riding the leaves, pose, sounds (bell, clank, horn), motor, drips and passing vessels.
    /* After the contacts (settleVehicle): follow a leaf's surface, take off from
       its tip, land, strike the far leaf's end or fall into the Sound. */
    function drawbridgeSettle(c, stepSeconds) {
      if (isAircraft(c) || isBoat(c)) return;
      const active = c.deckAir || c.deckLeaf || c.deckLift;
      // In the Sound (water.js floods it): the leaves have nothing more to do with it.
      if (c.sinkFor > 0) {
        if (active) drawbridgeLeaveDeck(c);
        return;
      }
      if (!active && (drawbridge.angle < 0.004 || !drawbridgeNear(c.x, c.y, 60))) return;
      const g = drawbridgeGeometry(),
        p = drawbridgeLocal(c.x, c.y),
        onDeckWidth = Math.abs(p.v) < g.half - 2,
        surface = onDeckWidth ? drawbridgeSurface(p.u) : undefined,
        speedU = c.vx * g.f.ux + c.vy * g.f.uy;
      if (c.deckAir) {
        // Past the far trunnion the approach span is road too, not the Sound (a
        // long jump used to splash down on the deck beyond the far leaf).
        const ground =
          surface === undefined ? (groundAt(c.x, c.y) || onBridgeDeck(c.x, c.y) ? 0 : null) : surface ? surface.h : null;
        /* The nose reaches the far leaf before the middle does: if it arrives below
           the tip (a bumper's height, pitched as the car is), it strikes the end
           of the leaf and the car drops into the gap. */
        const spec = vehicleSpec(c),
          ahead = (spec.l / 2) * Math.sign(speedU || 1),
          nose = drawbridgeSurface(p.u + ahead),
          noseHeight = c.deckLift + (spec.l / 2) * Math.sin(c.slopePitch || 0);
        if (surface === null && nose && nose.leaf !== c.deckJump?.leaf && noseHeight < nose.h - 3 && c.deckJump) {
          const closing = Math.abs(speedU);
          c.vx -= g.f.ux * speedU * 1.3;
          c.vy -= g.f.uy * speedU * 1.3;
          c.deckJump.struck = true;
          damageVehicle(c, Math.max(4, closing * 0.12), c.x, c.y, null, { kind: 'crash', nx: -Math.sign(speedU) * g.f.ux, ny: -Math.sign(speedU) * g.f.uy, closing, otherMass: 0 });
          playSample('crash-heavy-1', 0.7, 0.9, c);
          if (c === player.car) shake = Math.max(shake, 7);
          return drawbridgePose(c, stepSeconds);
        }
        if (surface && c.deckLift < surface.h - 7) {
          // Came in under the far leaf's tip: strike its end and drop into the gap.
          const start = drawbridgeLocal(c.stepStartX, c.stepStartY),
            before = drawbridgeSurface(start.u);
          if (before === null) {
            if (c.deckJump) c.deckJump.struck = true;
            const closing = Math.abs(speedU);
            c.x = c.stepStartX;
            c.y = c.stepStartY;
            c.vx -= g.f.ux * speedU * 1.3;
            c.vy -= g.f.uy * speedU * 1.3;
            damageVehicle(c, Math.max(4, closing * 0.12), c.x, c.y, null, { kind: 'crash', nx: -Math.sign(speedU) * g.f.ux, ny: -Math.sign(speedU) * g.f.uy, closing, otherMass: 0 });
            playSample('crash-heavy-1', 0.7, 0.9, c);
            if (c === player.car) shake = Math.max(shake, 7);
            return drawbridgePose(c, stepSeconds);
          }
        }
        if (ground !== null && c.deckLift <= ground) {
          // Touchdown: what hurts is the speed into the surface.
          const slope = surface ? surface.slope : 0,
            surfaceVz = slope * speedU,
            into = (surfaceVz - c.deckVz) / Math.sqrt(1 + slope * slope),
            jump = c.deckJump;
          c.deckAir = false;
          c.deckLift = ground;
          c.deckVz = surfaceVz;
          if (jump) jump.crossed = (p.u - g.m) * jump.leaf < 0;
          // A rider coming down this hard is thrown off (riders.js).
          if (jump) jump.riderThrown = riderLanding(c, into);
          // Coming down faster than 5 m/s (a fall of about 1.3 m) bends things; a
          // flat landing from a long flight (14 m/s, a ten-metre drop) costs a sedan
          // about a third of its health.
          if (into > 5 * UNITS_PER_METRE) {
            const hit = (into - 5 * UNITS_PER_METRE) * 0.7;
            damageVehicle(c, hit, c.x, c.y, null, { kind: 'crash', nx: 0, ny: 0, closing: into, otherMass: 0 });
            playSample(into > 12 * UNITS_PER_METRE ? 'crash-heavy-2' : 'crash-medium-1', clamp(into / (17 * UNITS_PER_METRE), 0.25, 0.9), 1, c);
            if (c === player.car) shake = Math.max(shake, Math.min(10, into / 12));
          } else playSample('crash-bump-1', 0.35, 1, c);
          const keep = into > 10 * UNITS_PER_METRE ? 0.8 : 0.93;
          c.vx *= keep;
          c.vy *= keep;
          if (jump) {
            jump.landed = true;
            jump.distance = Math.round(worldMeters(distanceBetween(jump, c)));
            jump.impact = Math.round(into);
            if (c === player.car && jump.crossed) announce('BRIDGE JUMP', jump.distance + ' M OVER PALM SOUND', 3.5);
            c.deckJump = null;
          }
          if (!surface) drawbridgeLeaveDeck(c);
          else {
            // Down on a leaf: it carries the car from this step on.
            c.deckLeaf = surface.leaf;
            c.deckSlope = surface.slope;
            c.slopePitch = Math.atan(surface.slope * Math.cos(c.a - g.f.a));
          }
        } else if (ground === null && c.deckLift <= 0) {
          // Into the Sound: water.js floods the car from here.
          c.deckAir = false;
          c.deckLift = 0;
          c.vx *= 0.3;
          c.vy *= 0.3;
          splashAt(c.x, c.y, 2.6);
          drawbridge.splashes++;
          if (c.deckJump) {
            c.deckJump.landed = false;
            c.deckJump.splash = true;
            c.deckJump = null;
          }
          if (c === player.car) tell('Short. The Sound takes the car.', 3);
          drawbridgeLeaveDeck(c);
          return;
        }
        return drawbridgePose(c, stepSeconds);
      }
      if (surface === undefined) {
        // Over the side of a raised leaf: down it goes. Otherwise back on the flat.
        if ((c.deckLift || 0) > 2) {
          c.deckAir = true;
          c.deckLeaf = 0;
          c.deckSlope = 0;
          return drawbridgePose(c, stepSeconds);
        }
        if (c.deckLeaf || c.deckLift) drawbridgeLeaveDeck(c);
        return;
      }
      if (surface === null) {
        // Already down in the gap (in the water): nothing to take off from.
        if (!c.deckLeaf && !((c.deckLift || 0) > 0.5)) return;
        // Off the tip: airborne, carrying the leaf's climb (and its lift as it rises).
        c.deckAir = true;
        c.deckVz = c.deckVz || 0;
        c.deckLeaf = 0;
        c.deckSlope = 0;
        c.deckJump = { x: c.x, y: c.y, leaf: p.u < g.m ? -1 : 1, speed: Math.round(Math.abs(speedU)), angle: Math.round((drawbridge.angle * 180) / Math.PI), at: gameTime, crossed: false };
        drawbridge.jumps.push(c.deckJump);
        if (drawbridge.jumps.length > 8) drawbridge.jumps.shift();
        return drawbridgePose(c, stepSeconds);
      }
      // On a leaf: ride its surface; the vertical speed is what a take-off carries.
      if (!c.deckAir && Math.abs(surface.slope - (c.deckSlope || 0)) > 0.004) drawbridgeKink(c, c.deckSlope || 0, surface.slope, speedU);
      const rise = (surface.h - (c.deckLift || 0)) / stepSeconds;
      c.deckVz = (c.deckVz || 0) * 0.5 + rise * 0.5;
      c.deckLift = surface.h;
      c.deckLeaf = surface.h > 0.01 || drawbridge.angle > 0.004 ? surface.leaf : 0;
      c.deckSlope = surface.slope;
      c.slopePitch = Math.atan(surface.slope * Math.cos(c.a - g.f.a));
      drawbridgePose(c, stepSeconds);
    }
    function drawbridgePose(c) {
      c.groundHeight = c.deckLift || 0;
      c.poseX = undefined;
      if (c === player.car) player.altitude = c.groundHeight;
    }
    /* ---- Sound ------------------------------------------------------------------- */
    // Level of a bridge sound at the player: fades out over a couple of kilometres.
    function drawbridgeSoundLevel(x, y) {
      const d = Math.hypot(x - player.x, y - player.y);
      return d > 2600 ? 0 : 1 / (1 + d / 320);
    }
    function drawbridgeVoice(level, pan, build) {
      if (!audio || !soundOn || level < 0.01) return;
      const out = audio.createGain(),
        panner = audio.createStereoPanner();
      out.gain.value = level;
      panner.pan.value = clamp(pan, -0.85, 0.85);
      out.connect(panner).connect(ambienceBus);
      build(out, audio.currentTime);
    }
    /* A warning bell: one strike, a few inharmonic partials ringing down (a
       struck bell's spectrum), repeated by the phase clock. */
    function drawbridgeBell(x, y) {
      drawbridgeVoice(drawbridgeSoundLevel(x, y) * 0.16, (x - player.x) / 500, (out, t) => {
        for (const [ratio, gain, decay] of [
          [1, 1, 0.5],
          [2.76, 0.45, 0.28],
          [5.4, 0.22, 0.16],
          [8.93, 0.1, 0.09],
        ]) {
          const o = audio.createOscillator(),
            g = audio.createGain();
          o.frequency.value = 1180 * ratio;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + decay + 0.02);
        }
      });
    }
    // A clank: the locks driving home, an arm reaching its stop.
    function drawbridgeClank(x, y, weight = 1) {
      drawbridgeVoice(drawbridgeSoundLevel(x, y) * 0.3 * weight, (x - player.x) / 500, (out, t) => {
        const n = Math.floor(audio.sampleRate * 0.35),
          buffer = audio.createBuffer(1, n, audio.sampleRate),
          data = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.05));
        const s = audio.createBufferSource(),
          filter = audio.createBiquadFilter(),
          ring = audio.createOscillator(),
          rg = audio.createGain();
        s.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = 520;
        filter.Q.value = 1.8;
        s.connect(filter).connect(out);
        ring.frequency.value = 96;
        rg.gain.setValueAtTime(0.5, t);
        rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        ring.connect(rg).connect(out);
        s.start(t);
        ring.start(t);
        ring.stop(t + 0.32);
      });
    }
    // A ship's or the tender's horn: a prolonged and a short blast.
    function drawbridgeHorn(x, y, pitch, pattern = [1.6, 0.5]) {
      drawbridgeVoice(drawbridgeSoundLevel(x, y) * 0.22, (x - player.x) / 500, (out, t) => {
        let at = t;
        for (const length of pattern) {
          const filter = audio.createBiquadFilter(),
            g = audio.createGain();
          filter.type = 'lowpass';
          filter.frequency.value = pitch * 4;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.5, at + 0.06);
          g.gain.setValueAtTime(0.5, at + length - 0.1);
          g.gain.exponentialRampToValueAtTime(0.0001, at + length);
          filter.connect(g).connect(out);
          for (const detune of [0, 1.007, 1.5]) {
            const o = audio.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = pitch * (detune || 1);
            o.connect(filter);
            o.start(at);
            o.stop(at + length + 0.02);
          }
          at += length + 0.35;
        }
      });
    }
    // The drive motors' hum while the leaves swing: a held voice whose level follows the swing speed.
    function updateDrawbridgeMotor(level) {
      const d = drawbridge;
      if (!audio || !soundOn) return;
      if (level <= 0.001) {
        if (d.motor) {
          d.motor.gain.gain.setTargetAtTime(0, audio.currentTime, 0.3);
          const m = d.motor;
          d.motor = null;
          setTimeout(() => {
            for (const o of m.sources) o.stop();
            m.gain.disconnect();
          }, 1500);
        }
        return;
      }
      if (!d.motor) {
        /* Four big drive motors under load: a deep sub-bass hum (the machinery
           room's rumble), the motors' mains buzz, and the open gear train's
           whine rising and falling with the swing speed. */
        const gain = audio.createGain(),
          filter = audio.createBiquadFilter(),
          sub = audio.createOscillator(),
          subGain = audio.createGain(),
          hum = audio.createOscillator(),
          hum2 = audio.createOscillator(),
          whine = audio.createOscillator(),
          whineGain = audio.createGain();
        gain.gain.value = 0;
        filter.type = 'lowpass';
        filter.frequency.value = 360;
        sub.type = 'sine';
        sub.frequency.value = 33;
        subGain.gain.value = 1.4;
        hum.type = 'sawtooth';
        hum.frequency.value = 50;
        hum2.type = 'sawtooth';
        hum2.frequency.value = 50.6;
        whine.type = 'triangle';
        whine.frequency.value = 170;
        whineGain.gain.value = 0.16;
        sub.connect(subGain).connect(gain);
        hum.connect(filter);
        hum2.connect(filter);
        whine.connect(whineGain).connect(filter);
        filter.connect(gain).connect(ambienceBus);
        for (const o of [sub, hum, hum2, whine]) o.start();
        d.motor = { gain, whine, sub, sources: [sub, hum, hum2, whine] };
      }
      const g = drawbridgeGeometry();
      // Held only while refreshed: if the game stops updating (paused), it dies away.
      const now = audio.currentTime;
      d.motor.gain.gain.cancelScheduledValues(now);
      d.motor.gain.gain.setTargetAtTime(level * drawbridgeSoundLevel(g.channel.x, g.channel.y) * 0.13, now, 0.4);
      d.motor.gain.gain.setTargetAtTime(0, now + 0.5, 0.3);
      d.motor.whine.frequency.setTargetAtTime(130 + 110 * level, now, 0.4);
      d.motor.sub.frequency.setTargetAtTime(30 + 6 * level, now, 0.4);
    }
    // A drop of water off a rising leaf into the Sound: a small plink.
    function drawbridgeDrip(x, y, size = 1) {
      drawbridgeVoice(drawbridgeSoundLevel(x, y) * 0.05 * size, (x - player.x) / 500, (out, t) => {
        const o = audio.createOscillator(),
          g = audio.createGain(),
          f = 700 + Math.random() * 900;
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.05);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.6, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.1);
      });
    }
    /* ---- The tall ship ---------------------------------------------------------------- */
    /* ALBATROSS, a brigantine (a 32 m hull, 40 m over the bowsprit, masts 30 m
       over the water): the tall ship the bridge opens for. She lies at anchor on
       one side of the causeway with her sails furled; each opening she sets them
       and passes through the channel to the other side (the opening between the
       raised leaves is 70 m wide where her mastheads pass). `across` is her
       distance from the deck's centre line (+ is the right of a -> b, south
       here); `sails` (0 furled .. 1 set) is for the renderer. */
    // Under sail and engine: about 5 knots through the bridge, 4 while she closes the hold point.
    const DRAWBRIDGE_VESSEL = { length: 256, beam: 60, masts: 30, anchor: 860, hold: 440, cruise: 5 * KNOTS, approach: 4 * KNOTS };
    function drawbridgeVessel() {
      if (drawbridge.vessel) return drawbridge.vessel;
      // `dir` is the way she goes next: +1 toward +across.
      drawbridge.vessel = { across: DRAWBRIDGE_VESSEL.anchor, dir: -1, speed: 0, leg: 'anchored', swing: 0, sails: 0, x: 0, y: 0, a: 0 };
      placeDrawbridgeVessel(drawbridge.vessel, 0);
      return drawbridge.vessel;
    }
    function placeDrawbridgeVessel(v, deltaSeconds) {
      const g = drawbridgeGeometry(),
        p = bridgePoint(g.bridge, g.m + Math.sin(v.swing) * 18, v.across),
        heading = g.f.a + (v.dir * Math.PI) / 2;
      v.x = p.x;
      v.y = p.y;
      // At anchor she lies to the breeze, then turns to face the bridge for the next passage.
      const want = v.leg === 'anchored' ? heading + Math.sin(gameTime * 0.05) * 0.12 : heading;
      v.a = deltaSeconds ? normalizeAngle(v.a + clamp(normalizeAngle(want - v.a), -0.12 * deltaSeconds, 0.12 * deltaSeconds)) : want;
    }
    function drawbridgeVesselHulls() {
      const v = drawbridge.vessel;
      if (!v) return [];
      return [{ x: v.x, y: v.y, hx: DRAWBRIDGE_VESSEL.length / 2, hy: DRAWBRIDGE_VESSEL.beam / 2, a: v.a }];
    }
    function updateDrawbridgeVessel(deltaSeconds) {
      const v = drawbridgeVessel(),
        spec = DRAWBRIDGE_VESSEL,
        open = drawbridge.phase === 'open' && drawbridge.held === null;
      // How far she has come across: -anchor at her anchorage, +anchor at the far one.
      const past = v.dir * v.across;
      let want = 0;
      if (v.leg === 'approach') {
        const toHold = -spec.hold - past;
        if (open) v.leg = 'transit';
        else want = toHold > 4 ? Math.min(spec.approach, Math.sqrt(2 * 6 * toHold)) : 0;
      }
      if (v.leg === 'transit') {
        const remaining = spec.anchor - past;
        want = remaining > 4 ? Math.min(spec.cruise, Math.sqrt(2 * 5 * remaining)) : 0;
        // Stand off a boat stopped in the channel ahead of her (the player's).
        const pc = player.car;
        if (pc && isBoat(pc)) {
          const ahead = (pc.x - v.x) * Math.cos(v.a) + (pc.y - v.y) * Math.sin(v.a),
            side = Math.abs(-(pc.x - v.x) * Math.sin(v.a) + (pc.y - v.y) * Math.cos(v.a));
          if (ahead > 0 && ahead < spec.length + 60 && side < spec.beam + 20) want = 0;
        }
        if (remaining <= 4 && v.speed < 2) {
          v.leg = 'anchored';
          v.speed = 0;
          v.across = v.dir * spec.anchor;
          v.dir = -v.dir;
        }
      }
      v.speed += clamp(want - v.speed, -6 * deltaSeconds, 3 * deltaSeconds);
      if (v.leg === 'anchored') v.swing += deltaSeconds * 0.02;
      else v.across += v.dir * v.speed * deltaSeconds;
      // The crew sets sail as she weighs anchor and hands it again at the far anchorage.
      const setSails = v.leg !== 'anchored' ? 1 : 0;
      v.sails = clamp(v.sails + Math.sign(setSails - v.sails) * deltaSeconds * 0.12, 0, 1);
      // Passing under the raised leaves she salutes the bridge; the tender answers.
      if (v.leg === 'transit' && !v.saluted && v.dir * v.across > -DRAWBRIDGE_VESSEL.length * 0.2) {
        v.saluted = true;
        drawbridgeHorn(v.x, v.y, 185, [2.2]);
        v.answerAt = gameTime + 3.2;
      }
      if (v.answerAt && gameTime > v.answerAt) {
        v.answerAt = 0;
        const g = drawbridgeGeometry();
        drawbridgeHorn(g.channel.x, g.channel.y, 150, [0.7, 0.7]);
      }
      placeDrawbridgeVessel(v, deltaSeconds);
    }
    function drawbridgeVesselSetOff() {
      const v = drawbridgeVessel();
      if (v.leg !== 'anchored') return;
      v.leg = 'approach';
      v.saluted = false;
      // One prolonged and one short blast: the signal asking for the bridge.
      drawbridgeHorn(v.x, v.y, 185);
    }
    // The ship is clear of the span on her far side (or has nowhere to go).
    function drawbridgeVesselClear() {
      const v = drawbridge.vessel;
      if (!v || v.leg === 'anchored') return true;
      if (v.leg === 'approach') return false;
      return v.dir * v.across > drawbridgeGeometry().half + DRAWBRIDGE_VESSEL.length / 2 + 70;
    }
    /* ---- Onlookers and the camera ------------------------------------------------- */
    /* A small crowd gathers on both approaches to watch an opening the player is
       near: a dozen people walk in along the footways from behind and stop at the
       holding positions just behind the sidewalk arms, facing the channel (a
       crowd scene, crowd.js: anything frightening breaks it up as it would any
       scene), and wander off once the arms are up. */
    const DRAWBRIDGE_SPECTATORS = 12;
    function drawbridgeHoldingSpots() {
      const g = drawbridgeGeometry(),
        spots = [];
      for (let k = 0; k < DRAWBRIDGE_SPECTATORS; k++) {
        const approach = k % 2 ? 1 : -1,
          side = k % 4 < 2 ? 1 : -1,
          row = Math.floor(k / 4),
          u = g.gates[approach < 0 ? 0 : 1] + approach * (12 + row * 13 + ((k * 7) % 5) * 2),
          v = side * (g.road + 3.5 + ((k * 5) % 3) * 2.2),
          spot = bridgePoint(g.bridge, u, v),
          look = bridgePoint(g.bridge, g.m, v * 0.4);
        spot.a = headingBetween(spot, look) + (((k * 13) % 7) - 3) * 0.06;
        spot.pose = ['watch', 'watch', 'film', 'watch', 'point', 'watch'][k % 6];
        spots.push({ spot, approach, u, v });
      }
      return spots;
    }
    function drawbridgeSpectators() {
      const d = drawbridge,
        g = drawbridgeGeometry();
      if (d.phase === 'idle' || d.reason === 'hold' || d.phase === 'lifting') {
        if (d.audience) {
          d.audience.done = true;
          d.audience = null;
        }
        return;
      }
      if (d.audience || d.audienceFor === d.openings || ['lowering', 'seating'].includes(d.phase)) return;
      if (distanceBetween(player, g.channel) > 1500 || typeof makeScene !== 'function') return;
      d.audienceFor = d.openings;
      const scene = (d.audience = makeScene('bridgeWatch', g.channel.x, g.channel.y)),
        roles = ['tourist', 'tourist', 'casual', 'casual', 'elder', 'commuter', 'casual', 'kid'];
      for (const [k, { spot, approach, u, v }] of drawbridgeHoldingSpots().entries()) {
        const p = spawnSceneMember(scene, 'bridgeWatcher', spot, roles[k % roles.length]);
        if (!p) break;
        scene.spawned = (scene.spawned || 0) + 1;
        // They walk in from further back along the approach footway.
        const from = bridgePoint(g.bridge, u + approach * (70 + ((k * 37) % 60)), v);
        if (onBridgeDeck(from.x, from.y, 4) && !solid(from.x, from.y, 5)) {
          p.x = from.x;
          p.y = from.y;
          p.a = headingBetween(from, spot);
        }
      }
    }
