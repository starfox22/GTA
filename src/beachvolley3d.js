      // BEGIN SUBSYSTEM: src/beachvolley3d.js — Beach volleyball court meshes
      /**
       * Beach volleyball court meshes
       * Source: src/beachvolley3d.js
       * Scope: createCityRenderer() closure (included before beach3d.js, which
       * calls `paintVolleyCourt` while painting the sand and `buildVolleyCourt`
       * once its materials exist, and `updateVolleyVisuals` every frame near the
       * beach).
       *
       * Everything comes from the court plan (beachvolley.js `volleyCourtPlan`, in
       * BEACH_LAYOUT.court): the raked pit and the blue boundary tapes are painted
       * into the sand texture; the padded poles, guy ropes and the net with its
       * antennas are batched statics; the scoreboard is a small canvas redrawn
       * when the score changes; the ball's shadow on the sand and the ring where
       * the player's ball will come down move every frame.
       */
      const volley3d = { board: null, boardContext: null, boardTexture: null, version: -1, shadow: null, ring: null };
      /* The pit and the lines, into the sand canvas (map coordinates). */
      function paintVolleyCourt(g, rnd) {
        const c = BEACH_LAYOUT.court,
          x0 = c.x - c.w / 2 - c.pit,
          y0 = c.y - c.h / 2 - c.pit;
        g.fillStyle = 'rgba(248,236,206,0.55)';
        g.fillRect(x0, y0, c.w + c.pit * 2, c.h + c.pit * 2);
        // Rake marks across the pit.
        g.strokeStyle = 'rgba(190,168,122,0.35)';
        g.lineWidth = 0.5;
        for (let y = y0 + 3; y < y0 + c.h + c.pit * 2; y += 3.2) {
          g.beginPath();
          g.moveTo(x0 + rnd() * 4, y + rnd());
          g.lineTo(x0 + c.w + c.pit * 2 - rnd() * 4, y + rnd());
          g.stroke();
        }
        // Boundary tapes (lines count in): drawn a little wider than 5 cm to read from the air.
        g.strokeStyle = '#2d69b3';
        g.lineWidth = 1.1;
        g.strokeRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
        // Sand kicked up round the net where the play is.
        g.fillStyle = 'rgba(170,146,104,0.25)';
        for (let i = 0; i < 90; i++) g.fillRect(c.x + (rnd() - 0.5) * 30, c.y + (rnd() - 0.5) * c.h, 1 + rnd() * 2, 0.6);
      }
      /* Poles, net, antennas, guy ropes and the scoreboard. */
      function buildVolleyCourt() {
        const c = BEACH_LAYOUT.court,
          padding = staticMat('#2d69b3', 0.7),
          rope = staticMat('#e8e2d2', 0.9),
          top = c.net + 0.4 * UNITS_PER_METRE;
        for (const s of [-1, 1]) {
          const g = beachStatic(c.x, c.y + s * c.poleOffset);
          mesh(cylinderGeo, beachPaint.steel, g, 0, top / 2, 0, 1.1, top, 1.1);
          mesh(cylinderGeo, padding, g, 0, 7, 0, 1.9, 14, 1.9);
          // A guy rope out to a sand anchor.
          const out = 1.6 * UNITS_PER_METRE,
            len = Math.hypot(out, top),
            line = box(g, 0, top / 2, (s * out) / 2, 0.25, len, 0.25, rope);
          line.rotation.x = -s * Math.atan2(out, top);
          box(g, 0, 0.5, s * out, 2, 1, 2, beachPaint.darkTimber);
        }
        // The net: a metre-deep mesh band with a white tape along its top.
        const netCanvas = document.createElement('canvas');
        netCanvas.width = 128;
        netCanvas.height = 16;
        const ng = netCanvas.getContext('2d');
        ng.strokeStyle = 'rgba(20,24,28,0.9)';
        ng.lineWidth = 1;
        for (let x = 0; x <= 128; x += 4) ng.strokeRect(x, 0, 0.5, 16);
        for (let y = 0; y <= 16; y += 4) ng.strokeRect(0, y, 128, 0.5);
        ng.fillStyle = '#f7f5ee';
        ng.fillRect(0, 0, 128, 2.5);
        ng.fillRect(0, 14.5, 128, 1.5);
        const netTexture = new Three.CanvasTexture(netCanvas);
        netTexture.wrapS = Three.RepeatWrapping;
        netTexture.repeat.set((c.poleOffset * 2) / 64, 1);
        const net = new Three.Mesh(
          new Three.PlaneGeometry(c.poleOffset * 2, UNITS_PER_METRE),
          new Three.MeshBasicMaterial({ map: netTexture, transparent: true, side: Three.DoubleSide, depthWrite: false }),
        );
        net.name = 'volleyball net';
        net.rotation.y = Math.PI / 2;
        net.position.set(c.x, c.net - UNITS_PER_METRE / 2, c.y);
        net.userData.dynamic = true;
        beachGroup.add(net);
        // Antennas over the sidelines, striped red and white.
        const red = staticMat('#d23b33', 0.5);
        for (const s of [-1, 1]) {
          const g = beachStatic(c.x, c.y + (s * c.h) / 2);
          for (let k = 0; k < 9; k++) box(g, 0, c.net - UNITS_PER_METRE + 0.5 + k * 1.6, 0, 0.45, 1.6, 0.45, k % 2 ? beachPaint.white : red);
        }
        // The scoreboard on the sand north of the pit, facing the sea (and the camera).
        const b = c.board,
          boardGroup = beachStatic(b.x, b.y);
        for (const s of [-1, 1]) box(boardGroup, (s * b.w) / 2 - s * 1.5, 7, -0.6, 1.2, 14, 1.2, beachPaint.darkTimber);
        box(boardGroup, 0, 14.5 + b.h / 2, -0.8, b.w + 2, b.h + 2, 0.8, beachPaint.darkTimber);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 72;
        volley3d.boardContext = canvas.getContext('2d');
        volley3d.boardTexture = new Three.CanvasTexture(canvas);
        volley3d.boardTexture.colorSpace = Three.SRGBColorSpace;
        const panel = new Three.Mesh(new Three.PlaneGeometry(b.w, b.h), new Three.MeshBasicMaterial({ map: volley3d.boardTexture }));
        panel.name = 'volleyball scoreboard';
        panel.position.set(b.x, 14.5 + b.h / 2, b.y);
        panel.userData.dynamic = true;
        beachGroup.add(panel);
        volley3d.board = panel;
        drawVolleyBoard();
        // The ball's shadow and the landing ring.
        const shadow = new Three.Mesh(new Three.CircleGeometry(2.4, 18), new Three.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.renderOrder = 3;
        shadow.userData.dynamic = true;
        shadow.visible = false;
        beachGroup.add(shadow);
        volley3d.shadow = shadow;
        const ring = new Three.Mesh(new Three.RingGeometry(3.6, 4.8, 28), new Three.MeshBasicMaterial({ color: '#7fe3ee', transparent: true, opacity: 0.7, depthWrite: false, side: Three.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.renderOrder = 3;
        ring.userData.dynamic = true;
        ring.visible = false;
        beachGroup.add(ring);
        volley3d.ring = ring;
      }
      function drawVolleyBoard() {
        const g = volley3d.boardContext;
        if (!g) return;
        const w = 256,
          h = 72,
          human = volley.human,
          label = (team) => (human ? (human.team === team ? 'YOU' : 'THEM') : team === 0 ? 'WEST' : 'EAST');
        g.fillStyle = '#10171d';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#e2c897';
        g.font = 'bold 13px Arial';
        g.textAlign = 'center';
        g.fillText('BEACH VOLLEY · FIRST TO ' + VOLLEY.target, w / 2, 16);
        for (const team of [0, 1]) {
          const x = team === 0 ? w * 0.27 : w * 0.73;
          g.fillStyle = team === 0 ? '#e0574c' : '#4c93e0';
          g.font = 'bold 11px Arial';
          g.fillText(label(team) + (volley.serveTeam === team && volley.phase !== 'idle' ? ' •' : ''), x, 32);
          g.fillStyle = '#ffd98a';
          g.font = 'bold 30px monospace';
          g.fillText(String(volley.score[team]).padStart(2, '0'), x, 64);
        }
        g.fillStyle = '#6f7a80';
        g.fillRect(w / 2 - 1, 26, 2, 40);
        volley3d.boardTexture.needsUpdate = true;
        volley3d.version = volley.scoreVersion + (human ? 1000 : 0) + volley.serveTeam * 100000;
      }
      function updateVolleyVisuals() {
        const b = beachBall,
          shadow = volley3d.shadow,
          ring = volley3d.ring;
        if (!shadow) return;
        shadow.visible = b.active;
        if (b.active) {
          const k = 1 / (1 + b.z / 28);
          shadow.position.set(b.x, 0.55, b.y);
          shadow.scale.setScalar(0.5 + k * 0.7);
          shadow.material.opacity = 0.12 + k * 0.22;
        }
        const m = volley.marker;
        ring.visible = !!m && volley.phase === 'rally';
        if (ring.visible) {
          ring.position.set(m.x, 0.6, m.y);
          ring.material.opacity = 0.45 + Math.sin(gameTime * 9) * 0.25;
        }
        const version = volley.scoreVersion + (volley.human ? 1000 : 0) + volley.serveTeam * 100000;
        if (version !== volley3d.version) drawVolleyBoard();
      }
      // END SUBSYSTEM: src/beachvolley3d.js
