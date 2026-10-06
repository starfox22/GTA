    // On foot: where the player's body faces (the aim while fighting, else the way they
    // go) and what facing one way while moving another costs the pace (footworkPace).
    /**
     * FACING AND FOOTWORK
     * With the mouse or the touch aim stick the player aims anywhere. In a fight (the
     * fire key or button held, a shot or a punch in the last moments, a reload) and
     * when standing still, the body faces the aim; running between fights it faces
     * the way it goes, at the full pace. In the chase view the reticle is the aim and
     * the body faces it in a fight or while aiming over the shoulder, not standing
     * still. Facing the aim while moving another way is
     * footwork, not a run: a side-step goes at FOOTWORK_SIDE of the pace, a backpedal
     * at FOOTWORK_BACK, diagonals in between. footPace() (game-state.js) applies it,
     * so the movement, the mountain footing, the footsteps and the police's aim all
     * see the same pace; crowd3d-draw.js BACKPEDAL steps the legs to match and
     * crowd3d-special.js faces the body by playerAimFacing().
     */
    const FOOTWORK_SIDE = 0.8,
      FOOTWORK_BACK = 0.6;
    /* The way the movement keys point (map heading), or null with none held: up the screen in the
       street view, along the camera's heading in the chase view (chase-camera.js). */
    function playerMoveHeading() {
      const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
        y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      if (!x && !y) return null;
      return chaseCameraLive() ? chaseMoveHeading(x, y) : Math.atan2(y, x);
    }
    function playerInFight() {
      return (
        !!(mouse.down || keys.KeyF || keys.Space) ||
        gameTime - (player.lastShotAt ?? -100) < 1.6 ||
        reloadSecondsRemaining > 0 ||
        gameTime - (player.punchAt ?? -100) < 2.5 ||
        (player.knifeSwingUntil || 0) > gameTime
      );
    }
    /* The heading the body faces on foot when it faces the aim, else null (it faces
       the way it goes, player.a). In the chase view only in a fight or aiming over the
       shoulder (whatever aims: the reticle is the aim), never for standing still, so
       the camera can go round an idle player and see their face. */
    function playerAimFacing() {
      if (player.car || player.swimming || player.carjack) return null;
      if (chaseCameraLive()) return touchAim !== null || playerInFight() || chaseCam.aimBlend > 0.3 ? aim() : null;
      if (!(mouse.active || touchAim !== null)) return null;
      if (touchAim !== null || playerInFight() || playerMoveHeading() === null) return aim();
      return null;
    }
    /* The share of the pace left moving at `heading` while facing the aim. */
    function footworkPace(heading) {
      if (heading === null) return 1;
      const facing = playerAimFacing();
      if (facing === null) return 1;
      const rel = normalizeAngle(heading - facing),
        across = Math.sin(rel),
        back = Math.max(0, -Math.cos(rel));
      return 1 - (1 - FOOTWORK_SIDE) * across * across - (1 - FOOTWORK_BACK) * back * back;
    }
    /* Console (DeadEndCity.footwork): the facing, the keys' heading and the pace share. */
    function footworkReport() {
      const heading = playerMoveHeading(),
        facing = playerAimFacing();
      return {
        facing: facing === null ? null : +facing.toFixed(3),
        faces: facing === null ? 'travel' : 'aim',
        heading: heading === null ? null : +heading.toFixed(3),
        inFight: playerInFight(),
        pace: +footworkPace(heading).toFixed(3),
        kmh: +(footPace() / KMH).toFixed(1),
      };
    }
