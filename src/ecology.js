    // BEGIN SUBSYSTEM: src/ecology.js — Wildlife behavior
    /**
     * Wildlife behavior
     * Source: src/ecology.js
     * Scope: shared game closure.
     * Habitats, harmless animals, bear warning/attack, damage and fallback drawing.
     */
    /* Bounded woodland habitats. Bears warn before charging; quiet animals graze and flee. */
    const wildlife = [];
    // Human meshes are about 18 world units tall. Keep these art scales shared with
    // both renderers: foxes are much smaller than a person; rabbits are smaller still.
    // The collision radius covers the scaled torso, rather than decorative tails.
    const WILDLIFE_SPECIES = {
      deer: { modelScale: 0.48, collisionRadius: 9 },
      fox: { modelScale: 0.3, collisionRadius: 4 },
      rabbit: { modelScale: 0.24, collisionRadius: 2 },
      bear: { modelScale: 0.55, collisionRadius: 13 },
    };
    const WILDLIFE_TOWN_BUFFER = 220;
    const WILDLIFE_HABITATS = [
      {
        name: 'Eagle Pass woodland',
        x: 6240,
        y: 1710,
        r: 215,
      },
      {
        name: 'Western foothills',
        x: 6600,
        y: 4700,
        r: 200,
      },
      {
        name: 'Needle Ridge woodland',
        x: 10300,
        y: 2500,
        r: 235,
      },
      {
        name: 'Southern forest',
        x: 8100,
        y: 5050,
        r: 230,
      },
      {
        name: 'East ridge meadow',
        x: 9360,
        y: 3780,
        r: 210,
      },
    ];
    function wildlifeClear(x, y, r = 7) {
      // Green city parks are recreation areas, not wildlife habitat. Restrict wild
      // animals to the forested county and keep a buffer around each town footprint.
      // Check the whole body against road verges, shorelines and solid scenery.
      if (countyRegionAt(x, y)?.id !== 'ridgeline') return false;
      const townMargin = WILDLIFE_TOWN_BUFFER + r;
      if (
        COUNTY_TOWNS.some(
          (town) =>
            x > town.x - townMargin &&
            x < town.x + BLOCK_SIZE * 2 + townMargin &&
            y > town.y - townMargin &&
            y < town.y + BLOCK_SIZE * 2 + townMargin,
        )
      )
        return false;
      return (
        groundAt(x, y, r) &&
        !onRoad(x, y) &&
        !onCountyRoad(x, y, r + 12) &&
        !solid(x, y, r) &&
        terrainHeight(x, y) < 420
      );
    }
    function wildlifePositionAllowed(home, x, y, radius) {
      return (
        !!home && Math.hypot(x - home.x, y - home.y) + radius <= home.r && wildlifeClear(x, y, radius)
      );
    }
    function wildlifeHabitatPoint(home, radius, sampleOffset = 0) {
      // One deterministic sampler serves spawning, roaming and recovery. Every
      // candidate uses the same footprint rules as actual movement.
      for (let sample = 0; sample < 48; sample++) {
        const angle = (sampleOffset * 13 + sample * 7) * 2.399,
          distance =
            sample === 47
              ? 0
              : (home.r - radius) * (0.12 + ((sample * 37 + sampleOffset * 19) % 80) / 100),
          x = home.x + Math.cos(angle) * distance,
          y = home.y + Math.sin(angle) * distance;
        if (wildlifePositionAllowed(home, x, y, radius)) return { x, y };
      }
      return null;
    }
    function moveWildlifeWithinHabitat(animal, x, y) {
      const radius = WILDLIFE_SPECIES[animal.species].collisionRadius,
        displacementX = x - animal.x,
        displacementY = y - animal.y,
        steps = Math.max(1, Math.ceil(Math.hypot(displacementX, displacementY) / 4));
      // Test the swept path, including vehicle pushes, so an endpoint cannot jump
      // an animal across a narrow obstacle or outside the home boundary.
      for (let step = 1; step <= steps; step++) {
        if (
          !wildlifePositionAllowed(
            animal.home,
            animal.x + (displacementX * step) / steps,
            animal.y + (displacementY * step) / steps,
            radius,
          )
        )
          return false;
      }
      animal.x = x;
      animal.y = y;
      return true;
    }
    function populateWildlife() {
      wildlife.length = 0;
      let i = 0;
      for (const home of WILDLIFE_HABITATS) {
        for (let k = 0; k < 5; k++) {
          const species = ['deer', 'deer', 'rabbit', 'fox', 'bear'][k],
            point = wildlifeHabitatPoint(home, WILDLIFE_SPECIES[species].collisionRadius, k);
          if (!point) continue;
          wildlife.push({
            ...point,
            id: i++,
            species,
            home,
            a: randomBetween(0, TAU),
            hp: species === 'bear' ? 180 : species === 'deer' ? 55 : 25,
            phase: randomBetween(0, TAU),
            speed: 0,
            state: 'graze',
            timer: randomBetween(1, 5),
            warning: 0,
            attack: 0,
          });
        }
      }
    }
    function strikeWildlife(a, damage) {
      if (a.hp <= 0) return;
      a.hp = Math.max(0, a.hp - damage);
      a.timer = 5;
      a.state = a.hp <= 0 ? 'down' : a.species === 'bear' ? 'charge' : 'flee';
      a.warning = 1.5;
      particle(a.x, a.y, '#9e8a70', 4, 35, 2);
    }
    function updateWildlife(deltaSeconds) {
      for (const a of wildlife) {
        const collisionRadius = WILDLIFE_SPECIES[a.species].collisionRadius;
        // Position validation is the expensive part (polygon and scenery tests), so
        // distant animals are checked about twice a second instead of every frame.
        const far = Math.abs(a.x - player.x) > 1700 || Math.abs(a.y - player.y) > 1700;
        a.validateIn = (a.validateIn ?? Math.random() * 0.5) - deltaSeconds;
        if (far && a.validateIn > 0) {
          if (a.hp > 0) a.speed = 0;
          continue;
        }
        if (far) a.validateIn = 0.5;
        if (!wildlifePositionAllowed(a.home, a.x, a.y, collisionRadius)) {
          // Recover a stale/out-of-bounds actor before distance culling. This also
          // prevents a distant animal from being frozen in a forbidden location.
          const home = WILDLIFE_HABITATS.includes(a.home)
              ? a.home
              : WILDLIFE_HABITATS.find((habitat) => wildlifeHabitatPoint(habitat, collisionRadius)),
            point = home && wildlifeHabitatPoint(home, collisionRadius, a.id);
          if (!point) {
            a.hidden = true;
            a.speed = 0;
            continue;
          }
          Object.assign(a, point, { home, hidden: false, speed: 0, timer: 0, goal: point });
        }
        if (a.hp <= 0) {
          a.downFor = (a.downFor || 0) + deltaSeconds;
          continue;
        }
        if (distanceBetween(a, player) > 1700) {
          a.speed = 0;
          continue;
        }
        a.phase += deltaSeconds * (a.speed > 2 ? (a.species === 'bear' ? 7 : 12) : 1.5);
        a.timer -= deltaSeconds;
        a.attack = Math.max(0, a.attack - deltaSeconds);
        const d = distanceBetween(a, player),
          nearGround = entityElevation(player) - terrainHeight(player.x, player.y) < 35,
          noise =
            ((player.car && Math.abs(player.car.speed) > 28) || shotCooldownSeconds > 0) && d < 190,
          bear = a.species === 'bear';
        let speed = 0,
          target = null;
        if (bear && nearGround && (d < 80 || (a.state === 'charge' && d < 260))) {
          if (a.state !== 'charge') {
            a.state = 'warn';
            a.warning += deltaSeconds;
            if (a.warning < 1.4) {
              if (d < 95 && a.warning - deltaSeconds <= 0)
                tell('BEAR · Back away. It is warning you.', 3);
            } else a.state = 'charge';
          }
          if (a.state === 'charge') {
            target = player;
            speed = d < 32 ? 35 : 125;
            if (
              d < 27 &&
              a.attack <= 0 &&
              Math.abs(entityElevation(player) - terrainHeight(a.x, a.y)) < 17 &&
              clearSight(a, player)
            ) {
              a.attack = 1.3;
              if (player.car) {
                if (player.car.type === 'bicycle') hurt(18, 'melee');
                else damageVehicle(player.car, 7, a.x, a.y);
              } else hurt(17, 'melee');
            }
          }
        } else if (
          !bear &&
          nearGround &&
          (noise || d < (a.species === 'fox' ? 27 : 55) || (a.state === 'flee' && a.timer > 0))
        ) {
          a.state = 'flee';
          if (a.timer < 0) a.timer = 3;
          target = {
            x: a.x + (a.x - player.x) * 2,
            y: a.y + (a.y - player.y) * 2,
          };
          speed = a.species === 'rabbit' ? 112 : 145;
        } else {
          if (a.state === 'charge' || a.state === 'warn') {
            a.state = 'walk';
            a.timer = 0;
          }
          a.warning = 0;
          if (a.timer <= 0) {
            a.timer = randomBetween(2, 6);
            a.state = seededRandom() < 0.4 ? 'graze' : 'walk';
            a.goal = wildlifeHabitatPoint(a.home, collisionRadius, randomBetween(0, 1000));
          }
          if (a.state === 'walk') {
            target = a.goal;
            speed = bear ? 23 : a.species === 'rabbit' ? 30 : 38;
          }
          if (a.species === 'fox' && d > 38 && d < 100 && nearGround && !player.car) {
            target = player;
            speed = 17;
            a.state = 'curious';
          }
        }
        if (target) {
          // A frightened animal turns back into its woodland instead of chasing or
          // fleeing across the boundary. Curious foxes obey the same rule.
          if (
            distanceBetween(a, a.home) > a.home.r - collisionRadius - 25 &&
            distanceBetween(target, a.home) > a.home.r - collisionRadius
          )
            target = a.home;
          const desired = headingBetween(a, target);
          a.a = normalizeAngle(a.a + normalizeAngle(desired - a.a) * Math.min(1, deltaSeconds * 5));
          const x = a.x + Math.cos(a.a) * speed * deltaSeconds,
            y = a.y + Math.sin(a.a) * speed * deltaSeconds;
          if (!moveWildlifeWithinHabitat(a, x, y)) {
            a.a += deltaSeconds * 5;
            a.timer = 0;
            speed = 0;
          }
        }
        a.speed = speed;
        for (const c of vehicles) {
          if (
            (isAircraft(c) && aircraftClearance(c) > 15) ||
            isBoat(c) ||
            Math.abs(c.speed) < 15 ||
            distanceBetween(a, c) > 70
          )
            continue;
          if (pointInCar(a.x, a.y, c, collisionRadius)) {
            strikeWildlife(a, Math.abs(c.speed) > 55 ? 250 : 8);
            moveWildlifeWithinHabitat(
              a,
              a.x + Math.cos(c.a + Math.PI / 2) * 15,
              a.y + Math.sin(c.a + Math.PI / 2) * 15,
            );
            break;
          }
        }
      }
    }
    function drawWildlife2D() {
      for (const a of wildlife) {
        if (a.hidden || !visible(a, 45) || a.downFor > 60) continue;
        worldContext.save();
        worldContext.translate(a.x, a.y - terrainHeight(a.x, a.y) * 0.12);
        worldContext.rotate(a.a);
        const modelScale = WILDLIFE_SPECIES[a.species].modelScale;
        worldContext.scale(modelScale, modelScale);
        const bear = a.species === 'bear',
          deer = a.species === 'deer',
          rabbit = a.species === 'rabbit',
          l = bear ? 18 : deer ? 14 : rabbit ? 6 : 10,
          w = bear ? 11 : deer ? 6 : rabbit ? 4 : 5;
        worldContext.globalAlpha = a.hp > 0 ? 1 : 0.5;
        worldContext.fillStyle = bear ? '#795643' : deer ? '#bb9a70' : rabbit ? '#c5bbab' : '#bd814c';
        worldContext.beginPath();
        worldContext.ellipse(0, 0, l, w, 0, 0, TAU);
        worldContext.fill();
        worldContext.beginPath();
        worldContext.arc(l - 2, 0, w * 0.7, 0, TAU);
        worldContext.fill();
        worldContext.strokeStyle = bear ? '#493c31' : '#705749';
        worldContext.lineWidth = rabbit ? 2 : 3;
        for (const side of [-1, 1])
          for (const x of [-l * 0.55, l * 0.4]) {
            const phase = Math.sin(a.phase + side * x) * 2;
            worldContext.beginPath();
            worldContext.moveTo(x, side * w * 0.6);
            worldContext.lineTo(x + phase, side * (w + 4));
            worldContext.stroke();
          }
        if (!bear && !deer && !rabbit) {
          worldContext.fillStyle = '#ead9b7';
          worldContext.beginPath();
          worldContext.ellipse(-15, 0, 7, 3, 0.2, 0, TAU);
          worldContext.fill();
        }
        if (rabbit || deer) {
          for (const side of [-1, 1]) {
            worldContext.beginPath();
            worldContext.ellipse(l + 1, side * 4, rabbit ? 5 : 4, 1.5, side * 0.5, 0, TAU);
            worldContext.fill();
          }
        }
        worldContext.restore();
      }
    }
    // END SUBSYSTEM: src/ecology.js
