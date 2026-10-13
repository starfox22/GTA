    // Gunfire on road vehicles (VEHICLE GUNFIRE): what a round takes off a car's health by calibre and by where it
    // struck (engine bay, body, boot, glass), the small-arms rule (a car only goes up after an engine fire), and the
    // console's vehicleDurability() table and gunfireTest() range.
    /**
     * VEHICLE GUNFIRE
     * A car's `hp` is its engine and running gear: the renderer smokes it from 60% (grey wisps), heavier from 40%,
     * and below BURN_THRESHOLD (25%) the engine catches fire and burns down to the tank (damage-upkeep.js
     * burnSeconds: 7 s for traffic, 11 s for the player's car), the time to bail out. What one round takes is
     * VEHICLE_GUNFIRE[calibre].engine (hit points, the same for any vehicle: a truck's bigger health takes more
     * rounds) x VEHICLE_ZONE_SHARE[zone] x the round's weight against its class (sqrt(dmg / ref), 0.75..1.4):
     *   handgun  a pistol round barely hurts an engine: about 25 into a sedan's bonnet light the fire, a few
     *            hundred into its doors;
     *   buck     one pellet (a load is six);
     *   rifle    about 10 into the engine bay; machine guns' 7.62 (`mg` rounds) count as rifles;
     *   heavy    .50 and cannon rounds (`heavyRound`, goreCal 'heavy', anti-tank): a few wreck the car, and only
     *            they may take it past the fire straight to the explosion.
     * Small arms (handgun, buck, rifle) never take a car below just under the fire line, and nothing once it burns:
     * the fire, not the shooting, sets off the tank. Rockets, shells and blasts keep their own damage (explode());
     * crashes are physics-collisions.js's. Mission vehicles under gang fire keep their MISSION CAGE share of the
     * round's dmg (combat-rules.js; tools/tests/mission1-bay.mjs holds that balance). Bodies, boot and glass mostly
     * dent and break (damage-vehicles.js bulletHitVehicle draws the holes, stars and flats).
     */
    const VEHICLE_GUNFIRE = {
        handgun: { engine: 4.5, ref: 28 },
        buck: { engine: 1.3, ref: 19 },
        rifle: { engine: 11, ref: 33 },
        heavy: { engine: 40, ref: 40 },
      },
      VEHICLE_ZONE_SHARE = { engine: 1, body: 0.12, boot: 0.2, glass: 0.06 },
      // A heavy round wrecks whatever it goes through.
      VEHICLE_HEAVY_ZONE_SHARE = { engine: 1, body: 0.6, boot: 0.6, glass: 0.4 },
      // The engine bay: ahead of this share of the length from the middle (a sedan's bonnet); a motorbike's engine
      // sits between the wheels, inside it.
      ENGINE_BAY_FROM = 0.22,
      BOOT_FROM = 0.3,
      // How far under the fire line a small-arms round may leave the engine (it lights on the next frame).
      SMALL_ARMS_FLOOR = 0.92;
    // Where the last round that struck a vehicle went in (bulletHitVehicle sets it; vehicleRoundDamage reads it).
    const vehicleRoundHit = { zone: 'body' };
    // The zone of a round's entry point (vehicle space, x forward) for bulletHitVehicle: 'glass' it passes in.
    function noteVehicleRoundZone(vehicle, entryX, glass) {
      const spec = vehicleSpec(vehicle),
        bike = !!spec.bike;
      vehicleRoundHit.zone = glass
        ? 'glass'
        : bike
          ? Math.abs(entryX) < spec.l * ENGINE_BAY_FROM
            ? 'engine'
            : 'body'
          : entryX > spec.l * ENGINE_BAY_FROM
            ? 'engine'
            : entryX < -spec.l * BOOT_FROM
              ? 'boot'
              : 'body';
      return vehicleRoundHit.zone;
    }
    // The calibre class a round hits a vehicle with: bulletCalibre's, with heavy rounds and machine guns apart.
    function vehicleRoundCalibre(b) {
      if (b.heavyRound || b.goreCal === 'heavy' || b.antiTank || b.shell) return 'heavy';
      if (b.mg && !b.cal) return 'rifle';
      return bulletCalibre(b);
    }
    // Whether VEHICLE GUNFIRE rules this round on this vehicle (road vehicles; rockets and shells blow up instead).
    function vehicleGunfireRules(vehicle, b) {
      if (b.rocket || b.shell) return false;
      const type = damageClass(vehicle);
      return type === 'car' || type === 'truck' || type === 'bike';
    }
    /* Hit points one round takes off `vehicle`, struck in `zone` (vehicleRoundHit.zone): the calibre's engine
       damage by zone, weighted by the round, capped for small arms at the fire line and at nothing while it burns. */
    function vehicleRoundDamage(vehicle, b, zone = vehicleRoundHit.zone) {
      if (!vehicleGunfireRules(vehicle, b)) return b.dmg;
      const cal = vehicleRoundCalibre(b),
        rule = VEHICLE_GUNFIRE[cal] || VEHICLE_GUNFIRE.handgun,
        share = (cal === 'heavy' ? VEHICLE_HEAVY_ZONE_SHARE : VEHICLE_ZONE_SHARE)[zone] ?? VEHICLE_ZONE_SHARE.body,
        weight = clamp(Math.sqrt((b.dmg || rule.ref) / rule.ref), 0.75, 1.4);
      let amount = rule.engine * share * weight;
      if (cal !== 'heavy') {
        const max = vehicle.maxhp || 1,
          floor = vehicle.damage?.burning ? vehicle.hp : canBurn(vehicle) && !vehicle.damage?.fireSpent ? BURN_THRESHOLD * max * SMALL_ARMS_FLOOR : 1;
        amount = Math.min(amount, Math.max(0, vehicle.hp - floor));
      }
      return amount;
    }
    /* Console: rounds into a fresh `type` (pure arithmetic, nothing is shot): per calibre and zone, the hits that
       light the engine fire and that blow it up (small arms: never by themselves, the fire does it after its
       countdown), with the weapon each calibre is measured with. */
    function vehicleDurabilityTable(type = 'sedan') {
      const spec = VEHICLE_DEFINITIONS[type];
      if (!spec) throw Error('Unknown vehicle type ' + type);
      const hp = spec.hp || 150,
        fireAt = hp * BURN_THRESHOLD,
        out = { type, hp, fireBelow: Math.round(fireAt), burnSeconds: { traffic: 7, player: 11 } },
        guns = [
          ['handgun', '9MM PISTOL', 28, 1],
          ['buck', 'PUMP SHOTGUN (load of 6)', 19, 6],
          ['rifle', 'ASSAULT RIFLE', 33, 1],
          ['heavy', 'M2 .50 / 25 MM', 40, 1],
        ];
      for (const [cal, weapon, dmg, pellets] of guns) {
        const rule = VEHICLE_GUNFIRE[cal],
          weight = clamp(Math.sqrt(dmg / rule.ref), 0.75, 1.4),
          row = { weapon };
        for (const zone of ['engine', 'body', 'boot']) {
          const per = rule.engine * (cal === 'heavy' ? VEHICLE_HEAVY_ZONE_SHARE : VEHICLE_ZONE_SHARE)[zone] * weight * pellets;
          row[zone] = {
            toFire: Math.ceil((hp - fireAt) / per),
            toExplode: cal === 'heavy' ? Math.ceil(hp / per) : 'fire only',
          };
        }
        out[cal] = row;
      }
      out.rocket = { weapon: 'BAZOOKA', toExplode: 1 };
      return out;
    }
    function vehicleGunfireConsole() {
      return {
        // Shots to set a fresh `type` on fire and to blow it up, per calibre and zone (VEHICLE GUNFIRE).
        vehicleDurability(type = 'sedan') {
          return vehicleDurabilityTable(type);
        },
        /* Real rounds into a fresh parked `type` on the open strip by the Oceanview runway: weapon `weaponIndex`
           (0 pistol, 1 machine pistol, 2 shotgun, 3 bazooka, 4 rifle, 5 precision rifle) fired from the side at
           its `zone` ('engine', 'body' or 'boot') once every `gap` seconds until it burns (or `maxShots`), then
           the clock runs until it blows up (up to `after` s). `enemy` true fires them as a gang's rounds. Returns
           the shots to smoke (60%), heavy smoke (40%) and fire, whether it blew up while still being shot at
           before any fire (`instant`), and the seconds from the fire to the explosion. */
        gunfireTest(type = 'sedan', weaponIndex = 0, zone = 'engine', options = {}) {
          const { maxShots = 300, gap = 0.2, after = 20, enemy = false, x = -2600, y = 9650 } = options,
            w = weapons[weaponIndex];
          if (!VEHICLE_DEFINITIONS[type]) throw Error('Unknown vehicle type ' + type);
          if (!w || w.melee) throw Error('Not a gun: ' + weaponIndex);
          if (player.car) exitCar();
          const c = spawnClearCar(type, x, y, 0, false),
            spec = vehicleSpec(c),
            along = zone === 'engine' ? (spec.bike ? 0 : spec.l * 0.38) : zone === 'boot' ? -spec.l * 0.42 : 0,
            tx = c.x + along,
            ty = c.y,
            sx = tx,
            sy = ty - 150;
          teleportPlayer(sx, sy);
          const out = { type, weapon: w.name, zone, hp: c.maxhp, smoke: null, heavySmoke: null, fire: null, shots: 0, instant: false, exploded: false, fireToExplosion: null };
          let fireTime = null,
            time = 0;
          const step = (seconds) => {
            for (let i = 0; i < Math.round(seconds * 30) && c.hp > 0; i++) {
              update(1 / 30);
              time += 1 / 30;
              if (fireTime === null && c.damage?.burning) fireTime = time;
            }
          };
          while (out.shots < maxShots && c.hp > 0 && !c.damage?.burning && gameMode === 'play') {
            // Keep it where it stands: a shot car may roll a little.
            Object.assign(c, { vx: 0, vy: 0, av: 0 });
            const a = Math.atan2(ty - player.y, tx - player.x),
              altitude = entityElevation(player);
            for (let j = 0; j < (w.pellets || 1); j++) {
              const spread = a + randomBetween(-w.spread * 0.3, w.spread * 0.3);
              bullets.push({
                x: player.x + Math.cos(a) * 14,
                y: player.y + Math.sin(a) * 14,
                altitude,
                vx: Math.cos(spread) * w.speed,
                vy: Math.sin(spread) * w.speed,
                vz: 0,
                life: 1,
                dmg: w.dmg,
                cal: w.cal,
                rocket: w.rocket,
                enemy,
                faction: enemy ? 'gang' : undefined,
                owner: enemy ? null : undefined,
              });
            }
            out.shots++;
            step(gap);
            const share = c.hp / c.maxhp;
            if (out.smoke === null && share < 0.6) out.smoke = out.shots;
            if (out.heavySmoke === null && share < 0.4) out.heavySmoke = out.shots;
            if (c.hp <= 0 && fireTime === null) out.instant = true;
          }
          if (c.damage?.burning || fireTime !== null) out.fire = out.shots;
          if (c.hp > 0 && fireTime !== null) step(after);
          out.exploded = c.hp <= 0;
          out.fireToExplosion = out.exploded && fireTime !== null ? +(time - fireTime).toFixed(1) : null;
          out.hpLeft = Math.round(Math.max(0, c.hp));
          if (vehicles.includes(c)) vehicles.splice(vehicles.indexOf(c), 1);
          return out;
        },
      };
    }
