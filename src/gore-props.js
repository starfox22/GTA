    // Severed parts: a limb a heavy hit took off (gore.js goreSever), thrown as a physics prop that tumbles,
    // bounces off walls and the ground and comes to rest lying flat, bleeding a little where it lands; retired
    // with its body, after BLOOD_LIFE or past GORE_PARTS_MAX. crowd3d-gore.js draws it in its owner's clothes.
    /**
     * SEVERED PARTS
     * `severedParts` entries: { owner, list, bit, len, r, x, y, z (the piece's centre: map x, y, elevation),
     * vx, vy, vz, yaw, pitch, roll and their rates, rest, born, floor, landed }. The orientation is the
     * renderer's: the piece hangs from its cut along its own -y; `yaw` turns it about the vertical, `pitch`
     * tips it from hanging (0) to lying (pi/2) along `yaw`, `roll` turns it about its own length. A piece at
     * rest lies flat (pitch +-pi/2) with its centre `r` over the ground. Lengths are the reference adult's
     * (units): forearm and hand 3.35, the whole arm 5.9, shin and foot 4, the whole leg 7.3.
     */
    const GORE_PARTS_MAX = 24,
      GORE_PIECES = {
        forearm: { len: 3.35, r: 0.3 },
        arm: { len: 5.9, r: 0.45 },
        shin: { len: 4.0, r: 0.36 },
        leg: { len: 7.3, r: 0.55 },
      },
      severedParts = [];
    let severedClock = 0;
    function goreBitPiece(bit) {
      return bit === GORE_ARM[0] || bit === GORE_ARM[1] ? 'arm' : bit === GORE_FOREARM[0] || bit === GORE_FOREARM[1] ? 'forearm' : bit === GORE_LEG[0] || bit === GORE_LEG[1] ? 'leg' : 'shin';
    }
    function launchSevered(person, bit, a, hit, list) {
      if (severedParts.length >= GORE_PARTS_MAX) severedParts.shift();
      const kind = goreBitPiece(bit),
        piece = GORE_PIECES[kind],
        pt = goreJointPoint(person, bit, goreScratchPoint),
        horizontal = Math.hypot(pt.dx, pt.dy),
        blast = hit?.cls === 'blast',
        speed = blast ? goreBetween(60, 130) : goreBetween(28, 70),
        out = blast ? a + goreBetween(-0.6, 0.6) : a + goreBetween(-0.35, 0.35),
        roof = rooftopFloor(person);
      severedParts.push({
        owner: person,
        list,
        bit,
        kind,
        len: piece.len,
        r: piece.r,
        x: pt.x + pt.dx * piece.len * 0.5,
        y: pt.y + pt.dy * piece.len * 0.5,
        z: pt.z + pt.dz * piece.len * 0.5,
        vx: Math.cos(out) * speed,
        vy: Math.sin(out) * speed,
        vz: blast ? goreBetween(40, 90) : goreBetween(14, 40),
        yaw: horizontal > 0.2 ? Math.atan2(pt.dy, pt.dx) : person.a || 0,
        pitch: Math.atan2(horizontal, -pt.dz),
        roll: goreBetween(0, TAU),
        wYaw: goreBetween(-4, 4),
        wPitch: (goreRandom() < 0.5 ? -1 : 1) * goreBetween(6, blast ? 16 : 11),
        wRoll: goreBetween(-7, 7),
        rest: false,
        landed: 0,
        born: gameTime,
        floor: roof ? entityElevation(person) : null,
      });
    }
    /* The piece's half height over the ground at its tilt (a rod of `len` and radius `r`). */
    function severedExtent(s) {
      return Math.abs(Math.cos(s.pitch)) * s.len * 0.5 + s.r * Math.abs(Math.sin(s.pitch)) + s.r * 0.4;
    }
    function updateSeveredParts(deltaSeconds) {
      const dt = Math.min(deltaSeconds, 0.05);
      for (let i = 0; i < severedParts.length; i++) {
        const s = severedParts[i];
        if (s.rest) continue;
        s.vz -= GRAVITY * dt;
        const nx = s.x + s.vx * dt,
          ny = s.y + s.vy * dt;
        // Walls: the piece bounces back off a building or a fence.
        if (solid(nx, s.y, 1)) s.vx *= -0.3;
        else s.x = nx;
        if (solid(s.x, ny, 1)) s.vy *= -0.3;
        else s.y = ny;
        s.z += s.vz * dt;
        s.yaw += s.wYaw * dt;
        s.pitch += s.wPitch * dt;
        s.roll += s.wRoll * dt;
        const ground = s.floor ?? bloodSurface(s.x, s.y),
          extent = severedExtent(s);
        if (s.z - extent > ground) continue;
        s.z = ground + extent;
        if (s.vz < 0) s.vz = -s.vz * 0.26;
        s.vx *= 0.5;
        s.vy *= 0.5;
        s.wYaw *= 0.5;
        s.wRoll *= 0.4;
        // It topples onto its side: the tilt runs to the nearer of lying either way.
        const lie = Math.sin(s.pitch) >= 0 ? Math.PI / 2 : -Math.PI / 2,
          wrapped = Math.atan2(Math.sin(s.pitch), Math.cos(s.pitch));
        s.wPitch = s.wPitch * 0.35 + (lie - wrapped) * 6;
        if (bloodOn && s.landed < 2) {
          const cut = severedCut(s);
          addBloodDrop(cut.x, cut.y, goreBetween(0.9, 1.5), Math.atan2(s.vy, s.vx), { surface: ground, stretch: 1.2 });
        }
        s.landed++;
        if (Math.hypot(s.vx, s.vy) < 10 && Math.abs(s.vz) < 9) {
          s.rest = true;
          s.pitch = lie;
          s.z = ground + s.r;
          s.vx = s.vy = s.vz = 0;
          if (bloodOn) {
            const cut = severedCut(s);
            addBloodDrop(cut.x, cut.y, goreBetween(1.3, 2), goreBetween(0, TAU), { surface: ground });
          }
        }
      }
      severedClock += deltaSeconds;
      if (severedClock < 1) return;
      severedClock = 0;
      // Retired with the body (gone from its list), after BLOOD_LIFE, or when its owner is whole again.
      for (let i = severedParts.length - 1; i >= 0; i--) {
        const s = severedParts[i];
        if (gameTime - s.born > BLOOD_LIFE || (s.list && !s.list.includes(s.owner)) || !(s.owner.goreLost & s.bit)) severedParts.splice(i, 1);
      }
    }
    // The cut end of a piece (map x, y): half its length back along its tilt from the centre.
    const severedCutPoint = { x: 0, y: 0 };
    function severedCut(s) {
      const along = Math.sin(s.pitch) * s.len * 0.5;
      severedCutPoint.x = s.x - Math.cos(s.yaw) * along;
      severedCutPoint.y = s.y - Math.sin(s.yaw) * along;
      return severedCutPoint;
    }
