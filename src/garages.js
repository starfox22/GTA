    // BEGIN SUBSYSTEM: src/garages.js — Drive-in repair and respray
    /**
     * Drive-in repair and respray
     * Source: src/garages.js
     * Scope: shared game closure.
     * Garage geometry, vehicle fit, paint, repairs and pursuit clearance.
     */
    /* Physical repair bays: the same walls drive walking, vehicle contacts and rendering. */
    const GARAGES = [
      {
        id: 'eastside',
        name: 'EASTSIDE CUSTOMS',
        x: 1320,
        y: 2022,
        roadY: 2176,
        color: '#83c5bd',
      },
      {
        id: 'palm',
        name: 'PALM AUTO PAINT',
        x: 4900,
        y: 2530,
        roadY: 2688,
        color: '#e5ab9d',
      },
      {
        id: 'south',
        name: 'BATTERY MOTOR WORKS',
        x: 2470,
        y: 3555,
        roadY: 3712,
        color: '#d9bc78',
      },
      {
        id: 'county',
        name: 'STONECREEK GARAGE',
        x: 6950,
        y: 3555,
        roadY: 3712,
        color: '#8ebac8',
      },
    ];
    let repairJob = null,
      garageWallCache = null;
    function garageWalls() {
      return garageWallCache || (garageWallCache = computeGarageWalls());
    }
    function computeGarageWalls() {
      return GARAGES.flatMap((s) => [
        {
          x: s.x - 96,
          y: s.y - 86,
          w: 8,
          h: 172,
          height: 47,
        },
        {
          x: s.x + 88,
          y: s.y - 86,
          w: 8,
          h: 172,
          height: 47,
        },
        {
          x: s.x - 96,
          y: s.y - 86,
          w: 192,
          h: 8,
          height: 47,
        },
      ]);
    }
    function garageBlocked(x, y, r = 8) {
      return garageWalls().some(
        (b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h,
      );
    }
    function inGarageLot(x, y, r = 0) {
      return GARAGES.some(
        (s) => x > s.x - 108 - r && x < s.x + 108 + r && y > s.y - 98 - r && y < s.roadY - 55 + r,
      );
    }
    function garageForCar(vehicle) {
      if (
        !vehicle ||
        vehicle.hp <= 0 ||
        isBoat(vehicle) ||
        isAircraft(vehicle) ||
        vehicleSpec(vehicle).tank
      )
        return null;
      return (
        GARAGES.find((s) =>
          corners(vehicleShape(vehicle, 3)).every(
            (p) => p.x > s.x - 87 && p.x < s.x + 87 && p.y > s.y - 77 && p.y < s.y + 76,
          ),
        ) || null
      );
    }
    function garageServiceCost(c) {
      return cargoChase()?.car === c ? 0 : 250;
    }
    function garageInteract() {
      const c = player.car,
        s = garageForCar(c);
      if (!s) return false;
      if (repairJob) return true;
      if (Math.abs(c.speed) > 12) {
        tell('Stop fully inside the repair bay.');
        return true;
      }
      if (mission?.index === 10 && mission.stage === 5) {
        tell('They identified Daniel. Get him inside Vinny’s warehouse.', 4);
        return true;
      }
      if (mission?.index === 2 && [1, 2].includes(mission.stage)) {
        if (c === mission.car && s.id === 'eastside' && Math.abs(c.speed) < 8 && mission.stage === 1)
          setStage(2, c, 'GET OUT · HOLD E BESIDE THE COUPE TO REMOVE TRACKER');
        exitCar();
        if (!player.car)
          tell(
            mission.stage === 2
              ? 'Hold E beside the coupe to remove its transmitter before respraying.'
              : 'Take the marked coupe to Eastside Customs to remove its transmitter.',
            4,
          );
        return true;
      }
      if (cargoChase() && cargoChase().car !== c) {
        tell('They are tracking the cargo truck. Respray that truck to lose them.', 4);
        return true;
      }
      const cost = garageServiceCost(c);
      if (cash < cost) {
        tell('Respray and repair costs $250.');
        return true;
      }
      repairJob = {
        car: c,
        shop: s,
        time: 0,
        cost,
      };
      c.vx = c.vy = c.speed = c.av = 0;
      keys = {};
      tell('Respraying and repairing…', 3);
      return true;
    }
    function updateGarage(deltaSeconds) {
      if (!repairJob) return;
      const { car, shop, cost } = repairJob;
      if (car !== player.car || car.hp <= 0 || garageForCar(car) !== shop) {
        repairJob = null;
        return;
      }
      car.vx = car.vy = car.speed = car.av = 0;
      player.inv = Math.max(player.inv, 0.15);
      repairJob.time += deltaSeconds;
      if (repairJob.time < 2.2) return;
      cash -= cost;
      repairVehicle(car);
      car.color =
        VEHICLE_PAINT_COLORS[
          (VEHICLE_PAINT_COLORS.indexOf(car.color) + 1 + VEHICLE_PAINT_COLORS.length) %
            VEHICLE_PAINT_COLORS.length
        ];
      car.bloodTrackRemaining = 0;
      car.bloodyUntil = 0;
      const escaped = evadeCargoPolice(car);
      clearPolice(true);
      repairJob = null;
      announce(shop.name, 'Resprayed!', 3);
      tell(
        escaped
          ? 'Cops lost · Vinny covered the paint · Deliver the crates'
          : 'Fresh paint · Full repair · $' + cost,
        5,
      );
      save();
      tone(600, 0.2, 0.15, 'sine');
    }
    function prepareGarages() {
      for (let i = buildings.length - 1; i >= 0; i--) {
        const b = buildings[i];
        if (
          GARAGES.some(
            (s) =>
              b.x < s.x + 110 && b.x + b.w > s.x - 110 && b.y < s.roadY - 56 && b.y + b.h > s.y - 100,
          )
        )
          buildings.splice(i, 1);
      }
      for (let i = trees.length - 1; i >= 0; i--)
        if (inGarageLot(trees[i].x, trees[i].y, 20)) trees.splice(i, 1);
    }
    function paintGarages(drawingContext) {
      for (const s of GARAGES) {
        drawingContext.fillStyle = '#505d60';
        drawingContext.fillRect(s.x - 108, s.y - 98, 216, s.roadY - 56 - (s.y - 98));
        drawingContext.fillStyle = '#949c96';
        drawingContext.fillRect(s.x - 86, s.y - 77, 172, 157);
        drawingContext.strokeStyle = '#e0c47e';
        drawingContext.lineWidth = 3;
        drawingContext.strokeRect(s.x - 66, s.y - 61, 132, 120);
        drawingContext.fillStyle = '#d8c48a';
        drawingContext.beginPath();
        drawingContext.moveTo(s.x, s.y + 88);
        drawingContext.lineTo(s.x - 10, s.y + 105);
        drawingContext.lineTo(s.x + 10, s.y + 105);
        drawingContext.fill();
        drawingContext.fillStyle = '#26343c';
        for (const b of garageWalls().filter(
          (b) => Math.abs(b.x - s.x) < 110 && Math.abs(b.y - s.y) < 100,
        ))
          drawingContext.fillRect(b.x, b.y, b.w, b.h);
        drawingContext.fillStyle = s.color;
        drawingContext.fillRect(s.x - 95, s.y + 68, 190, 17);
        drawingContext.fillStyle = '#13252c';
        drawingContext.textAlign = 'center';
        drawingContext.font = 'bold 12px Arial';
        drawingContext.fillText(s.name, s.x, s.y + 81);
      }
    }
    function drawGarageMap(drawingContext, scale) {
      drawingContext.save();
      drawingContext.textAlign = 'center';
      drawingContext.font = 'bold ' + 12 / scale + 'px Arial';
      for (const s of GARAGES) {
        drawingContext.fillStyle = '#122e38';
        drawingContext.fillRect(s.x - 10 / scale, s.y - 9 / scale, 20 / scale, 18 / scale);
        drawingContext.fillStyle = s.color;
        drawingContext.fillText('R', s.x, s.y + 4 / scale);
      }
      drawingContext.restore();
    }
    // END SUBSYSTEM: src/garages.js
