    // 2D canvas fallback renderer: drawWorld, drawCar, drawPerson, markers.
    function carSprite(c) {
      const vehicleDefinition = vehicleSpec(c),
        s = document.createElement('canvas');
      s.width = Math.max(72, vehicleDefinition.l + 12);
      s.height = Math.max(52, vehicleDefinition.w + 16);
      const drawingContext = s.getContext('2d');
      drawingContext.translate(s.width / 2, s.height / 2);
      const l = vehicleDefinition.l,
        w = vehicleDefinition.w,
        body = c.hp > 0 ? c.color : '#393f36';
      const r = (x, y, ww, hh, color) => {
        drawingContext.fillStyle = color;
        drawingContext.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
      };
      r(-l / 2 + 7, -w / 2 - 2, 8, 4, '#101916');
      r(l / 2 - 14, -w / 2 - 2, 8, 4, '#101916');
      r(-l / 2 + 7, w / 2 - 2, 8, 4, '#101916');
      r(l / 2 - 14, w / 2 - 2, 8, 4, '#101916');
      r(-l / 2, -w / 2 + 3, l, w - 6, '#1a231f');
      r(-l / 2 + 2, -w / 2, l - 4, w, body);
      r(-l / 2 + 4, -w / 2 + 2, l - 7, 2, '#ffffff38');
      r(-l / 2 + 3, w / 2 - 3, l - 6, 2, '#00000044');
      r(-l / 2 + 1, -w / 2 + 3, 2, w - 6, '#c5c6af');
      r(l / 2 - 3, -w / 2 + 3, 3, w - 6, '#bdc7b8');
      r(-7, -w / 2 + 3, 19, w - 6, '#1d3030');
      r(-3, -w / 2 + 3, 9, w - 6, body);
      r(-8, -w / 2 + 5, 3, w - 10, '#618381');
      r(7, -w / 2 + 4, 5, w - 8, '#7fa3a0');
      r(8, -w / 2 + 5, 2, 4, '#b3c6b450');
      r(-3, -w / 2 + 4, 8, 1, '#ffffff40');
      r(l / 2 - 2, -w / 2 + 3, 2, 5, '#e9e4bb');
      r(l / 2 - 2, w / 2 - 8, 2, 5, '#e9e4bb');
      r(-l / 2, -w / 2 + 3, 2, 4, '#c25543');
      r(-l / 2, w / 2 - 7, 2, 4, '#c25543');
      r(12, -4, 5, 8, c.hp > 0 ? body : '#242e27');
      r(13, -4, 1, 8, '#ffffff18');
      r(3, -w / 2 - 1, 4, 2, body);
      r(3, w / 2 - 1, 4, 2, body);
      if (c.type === 'muscle' || c.type === 'sport') {
        r(13, -3, 7, 2, '#192925');
        r(-19, -3, 8, 2, '#192925');
      }
      if (c.type === 'roadster') {
        r(-10, -w * 0.34, 17, w * 0.68, '#26282b');
        for (const side of [-1, 1]) {
          r(-8, side * 5 - 2, 6, 4, '#b99c79');
          r(-11, side * 5 - 3, 2, 6, '#c7cbca');
        }
        r(8, -w * 0.37, 2, w * 0.74, '#9bbdc8');
      }
      if (c.type === 'rally') {
        r(-13, -w * 0.37, 22, w * 0.74, body);
        r(6, -w * 0.36, 5, w * 0.72, '#52737f');
        r(-18, -w * 0.51, 3, w * 1.02, '#1c2a32');
        r(12, -3, 7, 6, '#d8d6be');
        r(-8, -2, 10, 4, '#d8d6be');
        for (const y of [-5, 0, 5]) r(l * 0.47, y - 1, 3, 2, '#e1d8b5');
      }
      if (c.type === 'limousine') {
        r(-l * 0.36, -w * 0.39, l * 0.59, w * 0.78, '#1c303d');
        r(-l * 0.33, -w * 0.3, l * 0.52, w * 0.6, body);
        for (const x of [-l * 0.22, -l * 0.02, l * 0.17]) r(x, -w * 0.4, 1, w * 0.8, '#a7aca8');
      }
      if (c.type === 'hotrod') {
        r(-12, -w * 0.34, 12, w * 0.68, '#253741');
        r(-9, -w * 0.3, 7, w * 0.6, body);
        r(7, -5, 11, 10, '#b2b5b4');
        for (let x = 8; x < 18; x += 3) r(x, -4, 1, 8, '#485052');
        r(9, -w * 0.52, 11, 2, '#d2d2c9');
        r(9, w * 0.43, 11, 2, '#d2d2c9');
        r(-l * 0.32, -w * 0.57, 9, 5, '#171b20');
        r(-l * 0.32, w * 0.37, 9, 5, '#171b20');
      }
      if (vehicleDefinition.tank) {
        for (const side of [-1, 1]) {
          r(-l / 2, side * w * 0.4 - 5, l, 10, '#273429');
          for (let x = -l / 2; x < l / 2; x += 7) r(x, side * w * 0.4 - 5, 2, 10, '#80917b');
        }
        r(-24, -17, 48, 34, body);
        drawingContext.save();
        drawingContext.rotate(normalizeAngle((c.turretA ?? c.a) - c.a));
        r(-17, -14, 34, 28, body);
        r(12, -3, 49, 6, '#8c997d');
        r(57, -4, 6, 8, '#39483a');
        r(-8, -6, 10, 12, '#455642');
        drawingContext.restore();
      }
      if (c.type === 'taxi') {
        r(-1, -4, 5, 8, '#e9db91');
        r(0, -3, 3, 6, '#554e2a');
      }
      if (c.type === 'van') {
        r(-l / 2 + 5, -w / 2 + 3, 26, w - 6, body);
        r(-l / 2 + 7, -w / 2 + 5, 22, 1, '#ffffff35');
        r(-l / 2 + 7, w / 2 - 6, 22, 1, '#00000022');
      }
      if (c.type === 'police') {
        r(-19, -w / 2 + 2, 10, w - 4, '#253a34');
        r(12, -w / 2 + 2, 8, w - 4, '#253a34');
        r(-2, -7, 4, 14, '#18231f');
        r(-1, -6, 3, 5, '#91b6dd');
        r(-1, 1, 3, 5, '#ce6f5e');
      }
      if (vehicleDefinition.truck) {
        r(-l * 0.46, -w * 0.43, l * 0.59, w * 0.86, c.type === 'ambulance' ? '#e0ddd1' : body);
        r(-l * 0.45, -w * 0.4, l * 0.56, 2, '#ffffff55');
        if (c.type === 'bus')
          for (let x = -l * 0.4; x < l * 0.4; x += 13) {
            r(x, -w * 0.48, 10, 4, '#263d48');
            r(x, w * 0.33, 10, 4, '#263d48');
          }
        if (c.type === 'pickup' || c.type === 'flatbed')
          r(-l * 0.46, -w * 0.35, l * 0.61, w * 0.7, '#6a5943');
        if (c.type === 'flatbed')
          for (let i = 0; i < (c.cargoCount || 0); i++) {
            r(-42 + i * 19, -9, 17, 18, '#c5a05a');
            r(-39 + i * 19, -9, 2, 18, '#e8cb7f');
          }
        if (c.type === 'ambulance') {
          r(-l * 0.25, -7, 3, 14, '#b33c45');
          r(-l * 0.25 - 5, -2, 13, 4, '#b33c45');
        }
      }
      if (vehicleDefinition.bike) {
        drawingContext.clearRect(-s.width / 2, -s.height / 2, s.width, s.height);
        r(-l / 2, -2, 8, 4, '#151b21');
        r(l / 2 - 8, -2, 8, 4, '#151b21');
        r(-l * 0.3, -w * 0.4, l * 0.56, w * 0.8, body);
        r(-8, -3, 9, 6, '#222e36');
        r(6, -w * 0.6, 2, w * 1.2, '#b6bfc1');
        r(l * 0.3, -2, 2, 4, '#e1d8ab');
      }
      if (vehicleDefinition.boat) {
        drawingContext.clearRect(-s.width / 2, -s.height / 2, s.width, s.height);
        drawingContext.fillStyle = body;
        drawingContext.beginPath();
        drawingContext.moveTo(-l * 0.5, -w * 0.4);
        drawingContext.lineTo(l * 0.1, -w * 0.5);
        drawingContext.quadraticCurveTo(l * 0.4, -w * 0.35, l * 0.5, 0);
        drawingContext.quadraticCurveTo(l * 0.4, w * 0.35, l * 0.1, w * 0.5);
        drawingContext.lineTo(-l * 0.5, w * 0.4);
        drawingContext.closePath();
        drawingContext.fill();
        r(-l * 0.32, -w * 0.3, l * 0.52, w * 0.6, '#d9d7c8');
        r(1, -w * 0.3, 4, w * 0.6, '#476a78');
        r(-l * 0.26, -w * 0.22, 10, w * 0.44, c.type === 'workboat' ? body : '#273c45');
        r(-l * 0.5, -3, 4, 6, '#26333b');
      }
      if (vehicleDefinition.jetski) {
        r(-11, -3, 17, 6, '#242f35');
        r(7, -5, 2, 10, '#c2cbd0');
        r(9, -3, 3, 6, '#92adad');
      }
      if (c.hp <= 0) {
        r(-14, -6, 25, 12, '#222d23');
        for (let i = 0; i < 10; i++)
          r(randomBetween(-20, 20), randomBetween(-10, 10), randomBetween(2, 5), 2, '#616853');
      }
      return s;
    }
    function visible(o, pad = 80) {
      return (
        Math.abs(o.x - cameraTarget.x) < viewportWidth / canvasScale / 2 + pad &&
        Math.abs(o.y - cameraTarget.y) < viewportHeight / canvasScale / 2 + pad
      );
    }
    function drawCar(vehicle) {
      if (vehicle.type === 'plane') {
        drawPlane2D(vehicle);
        return;
      }
      if (vehicle.type === 'helicopter') {
        if (!visible(vehicle, 180)) return;
        worldContext.save();
        worldContext.translate(vehicle.x + 8, vehicle.y + 9);
        worldContext.rotate(vehicle.a);
        worldContext.fillStyle = '#07121b60';
        worldContext.beginPath();
        worldContext.ellipse(0, 0, 40, 18, 0, 0, TAU);
        worldContext.fill();
        worldContext.restore();
        worldContext.save();
        worldContext.translate(vehicle.x, vehicle.y - (vehicle.altitude || 0) * 0.3);
        worldContext.rotate(vehicle.a);
        worldContext.fillStyle = vehicle.hp > 0 ? vehicle.color : '#303136';
        worldContext.fillRect(-43, -3, 32, 6);
        worldContext.fillRect(-39, -12, 6, 24);
        worldContext.beginPath();
        worldContext.ellipse(0, 0, 24, 13, 0, 0, TAU);
        worldContext.fill();
        worldContext.fillStyle = '#94aeb8';
        worldContext.beginPath();
        worldContext.ellipse(11, 0, 10, 10, 0, 0, TAU);
        worldContext.fill();
        worldContext.strokeStyle = '#a4adb0';
        worldContext.lineWidth = 2;
        for (const side of [-1, 1]) {
          worldContext.beginPath();
          worldContext.moveTo(-18, side * 16);
          worldContext.lineTo(23, side * 16);
          worldContext.stroke();
        }
        worldContext.rotate(gameTime * (vehicle === player.car || vehicle.airUnit ? 36 : 1));
        worldContext.strokeStyle = '#202b34';
        worldContext.lineWidth = 3;
        worldContext.beginPath();
        worldContext.moveTo(-41, 0);
        worldContext.lineTo(41, 0);
        worldContext.moveTo(0, -41);
        worldContext.lineTo(0, 41);
        worldContext.stroke();
        worldContext.restore();
        return;
      }
      if (!visible(vehicle)) return;
      const vehicleDefinition = vehicleSpec(vehicle);
      worldContext.save();
      worldContext.translate(vehicle.x + 4, vehicle.y + 5);
      worldContext.rotate(vehicle.a);
      worldContext.fillStyle = '#06120db0';
      worldContext.fillRect(
        -vehicleDefinition.l / 2 - 1,
        -vehicleDefinition.w / 2 - 1,
        vehicleDefinition.l + 3,
        vehicleDefinition.w + 3,
      );
      worldContext.restore();
      worldContext.save();
      worldContext.translate(vehicle.x, vehicle.y);
      worldContext.rotate(vehicle.a);
      if (vehicleDefinition.boat && Math.abs(vehicle.speed) > 15) {
        worldContext.fillStyle = '#bddcdd55';
        worldContext.beginPath();
        worldContext.moveTo(-vehicleDefinition.l * 0.4, -vehicleDefinition.w * 0.3);
        worldContext.lineTo(-vehicleDefinition.l * 0.4 - 30, -vehicleDefinition.w);
        worldContext.lineTo(-vehicleDefinition.l * 0.4 - 30, vehicleDefinition.w);
        worldContext.lineTo(-vehicleDefinition.l * 0.4, vehicleDefinition.w * 0.3);
        worldContext.fill();
      }
      if (!vehicle.sprite) vehicle.sprite = carSprite(vehicle);
      worldContext.drawImage(vehicle.sprite, -vehicle.sprite.width / 2, -vehicle.sprite.height / 2);
      if (vehicleDefinition.jetski && vehicle === player.car) {
        worldContext.fillStyle = '#9f7545';
        worldContext.fillRect(-6, -4, 7, 8);
        worldContext.fillStyle = '#c6a18a';
        worldContext.beginPath();
        worldContext.arc(1, 0, 3, 0, TAU);
        worldContext.fill();
      }
      if (vehicle.hp < vehicle.maxhp * 0.8) {
        worldContext.strokeStyle = '#b3b7ac';
        worldContext.lineWidth = 1;
        for (const d of vehicle.dents) {
          worldContext.beginPath();
          worldContext.moveTo(d.x - 3, d.y - 3);
          worldContext.lineTo(d.x + 2, d.y + 2);
          worldContext.lineTo(d.x + 5, d.y - 1);
          worldContext.stroke();
        }
        worldContext.fillStyle = '#303532a0';
        const crush = vehicle.damage.front * 5;
        worldContext.fillRect(
          vehicleDefinition.l / 2 - crush,
          -vehicleDefinition.w / 2 + 3,
          crush,
          vehicleDefinition.w - 6,
        );
      }
      if (vehicleDefinition.bike && (vehicle === player.car || vehicle.ai) && vehicle.hp > 0) {
        worldContext.fillStyle = '#253340';
        worldContext.fillRect(-6, -5, 8, 10);
        worldContext.fillStyle = '#8597a2';
        worldContext.beginPath();
        worldContext.arc(1, 0, 3.5, 0, TAU);
        worldContext.fill();
      }
      if (vehicle.hp > 0) {
        const gradient = worldContext.createLinearGradient(
          vehicleDefinition.l / 2,
          0,
          vehicleDefinition.l / 2 + 73,
          0,
        );
        gradient.addColorStop(0, '#f8f3bf16');
        gradient.addColorStop(1, '#f8f3bf00');
        worldContext.fillStyle = gradient;
        worldContext.beginPath();
        worldContext.moveTo(vehicleDefinition.l / 2, -8);
        worldContext.lineTo(vehicleDefinition.l / 2 + 73, -28);
        worldContext.lineTo(vehicleDefinition.l / 2 + 73, 28);
        worldContext.lineTo(vehicleDefinition.l / 2, 8);
        worldContext.fill();
        if ((vehicle.cop && wantedStars > 0) || vehicle.gangTarget) {
          worldContext.globalAlpha = 0.5 + 0.4 * Math.sin(gameTime * 18);
          worldContext.fillStyle = Math.sin(gameTime * 18) > 0 ? '#8ed0fd' : '#f1716d';
          worldContext.shadowBlur = 14;
          worldContext.shadowColor = worldContext.fillStyle;
          worldContext.fillRect(-2, -7, 4, 14);
          worldContext.shadowBlur = 0;
          worldContext.globalAlpha = 1;
        }
        if (vehicle === player.car && (keys.Space || keys.KeyS)) {
          worldContext.fillStyle = '#ff6c45';
          worldContext.shadowColor = '#f95535';
          worldContext.shadowBlur = 9;
          worldContext.fillRect(-vehicleDefinition.l / 2, -vehicleDefinition.w / 2 + 2, 2, 5);
          worldContext.fillRect(-vehicleDefinition.l / 2, vehicleDefinition.w / 2 - 7, 2, 5);
          worldContext.shadowBlur = 0;
        }
      }
      worldContext.restore();
      if (vehicle.bloodyUntil > gameTime) {
        worldContext.fillStyle = '#871428';
        worldContext.fillRect(vehicle.x - 2, vehicle.y - 3, 7, 6);
      }
      if (
        !vehicleDefinition.bicycle &&
        vehicle.hp > 0 &&
        vehicle.hp < vehicle.maxhp * 0.3 &&
        Math.random() < 0.15
      )
        particle(
          vehicle.x + Math.cos(vehicle.a) * 12,
          vehicle.y + Math.sin(vehicle.a) * 12,
          '#363d35',
          1,
          14,
          8,
        );
      if (
        !vehicleDefinition.bicycle &&
        vehicle.hp <= 0 &&
        gameTime - vehicle.deadTime < 12 &&
        Math.random() < 0.25
      )
        particle(vehicle.x, vehicle.y, randomChoice(['#dfb05f', '#a5683b', '#424b3f']), 2, 23, 10);
    }
    function drawPerson(person, isPlayer = false, isEnemy = false) {
      if (!visible(person, 30)) return;
      worldContext.save();
      worldContext.translate(person.x, person.y);
      worldContext.rotate(
        person.a + (person.hp > 0 && person.dazedFor > 0 ? Math.sin(gameTime * 8) * 0.1 : 0),
      );
      if (person.hp <= 0 || person.knockedFor > 0 || person.poisonCollapse > 0.45) {
        worldContext.fillStyle = '#263a2b70';
        worldContext.fillRect(-9, -4, 18, 8);
        worldContext.fillStyle = person.color || '#abb39b';
        worldContext.fillRect(-5, -3, 8, 6);
        worldContext.fillStyle = '#c8ac85';
        worldContext.fillRect(4, -2, 4, 4);
        worldContext.restore();
        if (person.hp > 0) drawDizzy(person.x, person.y - 13);
        return;
      }
      if (isPlayer) {
        worldContext.strokeStyle = '#d9f59890';
        worldContext.lineWidth = 1;
        worldContext.beginPath();
        worldContext.arc(0, 0, 13, 0, TAU);
        worldContext.stroke();
        if (player.inv > 0) worldContext.globalAlpha = 0.45 + 0.4 * Math.sin(gameTime * 25);
      }
      worldContext.fillStyle = '#102b2380';
      worldContext.beginPath();
      worldContext.ellipse(3, 4, 9, 5, 0, 0, TAU);
      worldContext.fill();
      const step = Math.sin(person.walk || 0) * 2.5;
      worldContext.fillStyle = '#27382f';
      worldContext.fillRect(-6 + step, -4, 6, 3);
      worldContext.fillRect(-6 - step, 1, 6, 3);
      worldContext.fillStyle = isPlayer ? (player.disguised ? '#e5d7b2' : '#dde5cb') : person.color;
      worldContext.fillRect(-4, -6, 8, 12);
      worldContext.fillStyle = isPlayer ? (player.disguised ? '#233341' : '#71856c') : '#756c53';
      worldContext.fillRect(-4, -3, 6, 6);
      worldContext.fillStyle = '#c8ac85';
      worldContext.fillRect(-1, -3, 5, 6);
      worldContext.fillStyle = isPlayer ? '#393e33' : '#514939';
      worldContext.fillRect(-1, -3, 3, 6);
      if (
        !personIncapacitated(person) &&
        ((isPlayer && selectedWeaponIndex !== FISTS_INDEX && !(player.disguised && rooftopJob() && !rooftopJob().weaponDrawn)) ||
          (isEnemy && (!person.missionTag || person.aiming)))
      ) {
        worldContext.fillStyle = '#c2b48f';
        worldContext.fillRect(2, 3, 7, 3);
        worldContext.fillStyle =
          isPlayer && selectedWeaponIndex === KNIFE_INDEX ? '#e0e8ed' : '#1a2722';
        worldContext.fillRect(
          7,
          3,
          isPlayer && selectedWeaponIndex === 3 ? 12 : 7,
          isPlayer && selectedWeaponIndex === KNIFE_INDEX ? 1.5 : 3,
        );
      }
      worldContext.restore();
      if (person.dazedFor > 0) drawDizzy(person.x, person.y - 18);
    }
    function drawDizzy(x, y) {
      worldContext.save();
      worldContext.fillStyle = '#f3d583';
      for (let j = 0; j < 3; j++) {
        const a = gameTime * 3 + (j * TAU) / 3;
        worldContext.beginPath();
        worldContext.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 3, 1.8, 0, TAU);
        worldContext.fill();
      }
      worldContext.restore();
    }
    function marker(p, color = '#d7f970', symbol = '↓', size = 22) {
      if (!p || !visible(p, 80)) return;
      const y = p.y - 33 - Math.sin(gameTime * 3) * 4;
      worldContext.save();
      worldContext.strokeStyle = color;
      worldContext.lineWidth = 2;
      worldContext.globalAlpha = 0.35 + 0.15 * Math.sin(gameTime * 4);
      worldContext.beginPath();
      worldContext.ellipse(p.x, p.y, 28, 16, 0, 0, TAU);
      worldContext.stroke();
      worldContext.globalAlpha = 1;
      worldContext.translate(p.x, y);
      worldContext.fillStyle = '#13241dde';
      worldContext.beginPath();
      worldContext.moveTo(0, -size);
      worldContext.lineTo(size, 0);
      worldContext.lineTo(0, size);
      worldContext.lineTo(-size, 0);
      worldContext.closePath();
      worldContext.fill();
      worldContext.stroke();
      worldContext.fillStyle = color;
      worldContext.font = 'bold 21px Arial';
      worldContext.textAlign = 'center';
      worldContext.textBaseline = 'middle';
      worldContext.fillText(symbol, 0, -1);
      worldContext.restore();
    }
    // FRAME PRESENTATION: WebGL when available, otherwise the complete 2D fallback.
    function drawWorld() {
      if (city3D) {
        city3D.render();
        return;
      }
      drawWater2D();
      worldContext.save();
      worldContext.translate(
        viewportWidth / 2 + (Math.random() - 0.5) * shake,
        viewportHeight / 2 + (Math.random() - 0.5) * shake,
      );
      worldContext.scale(canvasScale, canvasScale);
      worldContext.translate(-cameraTarget.x, -cameraTarget.y);
      const sx = clamp(cameraTarget.x - viewportWidth / canvasScale / 2 - 20, CITY_LEFT, CITY_RIGHT),
        sy = clamp(cameraTarget.y - viewportHeight / canvasScale / 2 - 20, CITY_TOP, CITY_SIZE),
        sw = Math.min(viewportWidth / canvasScale + 40, CITY_RIGHT - sx),
        sh = Math.min(viewportHeight / canvasScale + 40, CITY_SIZE - sy);
      if (sw > 0 && sh > 0)
        worldContext.drawImage(
          groundCanvas,
          (sx - CITY_LEFT) * GROUND_PIXELS_PER_UNIT,
          (sy - CITY_TOP) * GROUND_PIXELS_PER_UNIT,
          sw * GROUND_PIXELS_PER_UNIT,
          sh * GROUND_PIXELS_PER_UNIT,
          sx,
          sy,
          sw,
          sh,
        );
      drawCounty2D();
      drawDistrictScenery2D();
      paintGarages(worldContext);
      paintGarageNames(worldContext);
      drawAviationGround(worldContext);
      drawHarbor2D();
      drawDepot2D();
      drawRoadblocks2D();
      drawUnderpass2D();
      drawAirSearch2D();
      drawTrafficLights2D();
      drawBlood2D();
      for (const s of skids)
        if (visible(s)) {
          worldContext.save();
          worldContext.globalAlpha = Math.min(0.6, s.life / 10);
          worldContext.translate(s.x, s.y);
          worldContext.rotate(s.a);
          worldContext.fillStyle = '#111d16';
          worldContext.fillRect(-s.len / 2, -1, s.len, 2);
          worldContext.restore();
        }
      for (const d of debris)
        if (visible(d)) {
          worldContext.fillStyle = '#15291d65';
          worldContext.beginPath();
          worldContext.ellipse(d.x, d.y, 38, 31, 0, 0, TAU);
          worldContext.fill();
        }
      // A payphone you can spot from the street.
      worldContext.fillStyle = '#132c26';
      worldContext.fillRect(phone.x - 8, phone.y - 6, 16, 18);
      worldContext.fillStyle = '#79a995';
      worldContext.fillRect(phone.x - 7, phone.y - 6, 14, 13);
      worldContext.fillStyle = '#243e34';
      worldContext.fillRect(phone.x - 4, phone.y - 3, 8, 9);
      worldContext.fillStyle = '#d1e3b3';
      worldContext.fillRect(phone.x - 2, phone.y - 1, 4, 5);
      worldContext.fillStyle = '#698c76';
      worldContext.fillRect(phone.x - 2, phone.y + 10, 4, 7);
      for (const p of pickups)
        if (p.ready < gameTime && visible(p)) {
          worldContext.save();
          worldContext.translate(p.x, p.y + Math.sin(gameTime * 3) * 2);
          worldContext.fillStyle = '#172e24e0';
          worldContext.fillRect(-9, -9, 18, 18);
          worldContext.strokeStyle =
            p.type === 'health' ? '#90dcb0' : p.type === 'ammo' ? '#cc9fda' : '#83b7d6';
          worldContext.strokeRect(-10, -10, 20, 20);
          worldContext.fillStyle = worldContext.strokeStyle;
          if (p.type === 'health') {
            worldContext.fillRect(-2, -6, 4, 12);
            worldContext.fillRect(-6, -2, 12, 4);
          } else if (p.type === 'ammo') {
            for (let j = -4; j <= 4; j += 4) worldContext.fillRect(j - 1, -5, 2, 10);
          } else {
            worldContext.beginPath();
            worldContext.moveTo(-5, -6);
            worldContext.lineTo(5, -6);
            worldContext.lineTo(5, 2);
            worldContext.lineTo(0, 7);
            worldContext.lineTo(-5, 2);
            worldContext.fill();
          }
          worldContext.restore();
        }
      drawWildlife2D();
      drawSports(worldContext);
      drawTransit2D();
      for (const p of pedestrians) drawPerson(p);
      for (const c of vehicles) drawCar(c);
      for (const e of [...enemies, ...gangMembers, ...officers])
        if (!rooftopFloor(e)) drawPerson(e, false, true);
      if (player.roof) {
        drawRooftop2D();
        drawRoofStealth2D();
        drawBlood2D(true);
        for (const e of enemies) if (rooftopFloor(e)) drawPerson(e, false, true);
      }
      for (const p of storyActors) if (!p.hidden && rooftopFloor(p) === !!player.roof) drawPerson(p);
      if (!player.car && !transitRide) {
        let drawP = {
          ...player,
          a: mouse.active ? aim() : player.a,
        };
        drawPerson(drawP, true);
      }
      for (const b of bullets) {
        if (rooftopFloor(b) !== !!player.roof) continue;
        worldContext.strokeStyle = b.enemy ? '#f1ac7b' : b.rocket ? '#f5d297' : '#f0edb4';
        worldContext.lineWidth = b.rocket ? 4 : 1.7;
        worldContext.beginPath();
        worldContext.moveTo(b.x, b.y);
        worldContext.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
        worldContext.stroke();
      }
      drawFire2D();
      for (const p of particles)
        if (visible(p)) {
          worldContext.globalAlpha = clamp(p.life / p.max, 0, 1);
          worldContext.fillStyle = p.color;
          worldContext.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      worldContext.globalAlpha = 1;
      // Streetlights give the city a subtle warm dusk.
      for (const l of lamps)
        if (visible(l, 50)) {
          const g = worldContext.createRadialGradient(l.x, l.y, 1, l.x, l.y, 42);
          g.addColorStop(0, '#f2d4921a');
          g.addColorStop(1, '#eadc9400');
          worldContext.fillStyle = g;
          worldContext.fillRect(l.x - 42, l.y - 42, 84, 84);
          worldContext.fillStyle = '#d4d2a2';
          worldContext.fillRect(l.x - 1, l.y - 1, 3, 3);
        }
      const target = objective();
      if (target) marker(target, '#d7f970', mission ? '↓' : '☎');
      for (const s of GARAGES) if (distanceBetween(player, s) < 400) marker(s, s.color, 'R', 16);
      drawStoryMarkers2D();
      drawRoofDialogue2D();
      drawParachute2D();
      worldContext.restore();
      // Film tint and edge direction, kept away from the central play area.
      worldContext.fillStyle = 'rgba(7,13,35,' + (1 - daylight()) * 0.25 + ')';
      worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
      if (flash > 0) {
        worldContext.fillStyle = 'rgba(205,111,72,' + flash * 0.6 + ')';
        worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
      }
      if (target && gameMode === 'play') {
        const tx = (target.x - cameraTarget.x) * canvasScale + viewportWidth / 2,
          ty = (target.y - cameraTarget.y) * canvasScale + viewportHeight / 2;
        if (tx < 55 || tx > viewportWidth - 55 || ty < 120 || ty > viewportHeight - 225) {
          let a = Math.atan2(ty - viewportHeight / 2, tx - viewportWidth / 2),
            radius = Math.min(
              (viewportWidth / 2 - 75) / Math.max(0.01, Math.abs(Math.cos(a))),
              (viewportHeight / 2 - 115) / Math.max(0.01, Math.abs(Math.sin(a))),
            );
          const px = viewportWidth / 2 + Math.cos(a) * radius,
            py = viewportHeight / 2 + Math.sin(a) * radius;
          worldContext.save();
          worldContext.translate(px, py);
          worldContext.rotate(a);
          worldContext.fillStyle = '#d8ef97';
          worldContext.strokeStyle = '#273727';
          worldContext.lineWidth = 3;
          worldContext.beginPath();
          worldContext.moveTo(13, 0);
          worldContext.lineTo(-6, -8);
          worldContext.lineTo(-2, 0);
          worldContext.lineTo(-6, 8);
          worldContext.closePath();
          worldContext.stroke();
          worldContext.fill();
          worldContext.restore();
          worldContext.fillStyle = '#e2ebcb';
          worldContext.font = 'bold 10px monospace';
          worldContext.textAlign = 'center';
          worldContext.fillText(distanceLabel(distanceBetween(player, target)), px, py + 25);
        }
      }
    }
