      /* Where the player got into or out of a car, for the transition poses. */
      function trackCarTransition() {
        const car = player.car && !transitRide && !taxiRide ? player.car : null;
        if (car !== carTransition.car) {
          if (carTransition.car && !car) carTransition.kind = 'exit';
          else if (car && !carTransition.car) {
            carTransition.kind = 'enter';
            carTransition.x = player.x;
            carTransition.y = player.y;
          } else carTransition.kind = null;
          carTransition.at = gameTime;
          carTransition.car = car;
        }
      }
      // A stand-in for the player ducking into a car's driver seat.
      const enterGhost = { x: 0, y: 0, a: 0, hp: 100 };
      function drawEnterCar(deltaSeconds, detail) {
        const car = carTransition.car;
        if (carTransition.kind !== 'enter' || !car || gameTime - carTransition.at > 0.4 || isAircraft(car) || isBoat(car)) return;
        if (Math.hypot(car.vx || 0, car.vy || 0) > 30) return;
        const spec = vehicleSpec(car),
          side = car.a - Math.PI / 2,
          k = clamp((gameTime - carTransition.at) / 0.4, 0, 1);
        enterGhost.x = car.x + Math.cos(side) * (spec.w / 2 + 1.5 - k * 3) + Math.cos(car.a) * spec.l * 0.08;
        enterGhost.y = car.y + Math.sin(side) * (spec.w / 2 + 1.5 - k * 3) + Math.sin(car.a) * spec.l * 0.08;
        enterGhost.a = car.a + Math.PI / 2;
        const sp = specialSpec(player);
        sp.hold = null;
        sp.weapon = null;
        sp.pose = 'enterCar';
        sp.transition = k;
        sp.facing = enterGhost.a;
        sp.elevation = entityElevation(car);
        sp.look = specialLook(player);
        drawCrowdPerson(enterGhost, stateFor(enterGhost), deltaSeconds, detail, sp);
      }

      /* Dogs: a trotting body, four legs in diagonal pairs, and the leash. */
      function drawCrowdDog(p, hand, deltaSeconds) {
        const dog = p.dog;
        let s = crowdState.get(dog);
        if (!s) {
          s = { x: dog.x, y: dog.y, phase: 0, speed: 0 };
          crowdState.set(dog, s);
        }
        const moved = Math.hypot(dog.x - s.x, dog.y - s.y);
        s.x = dog.x;
        s.y = dog.y;
        if (moved < 40 && deltaSeconds > 0) {
          s.speed += (moved / deltaSeconds - s.speed) * (1 - Math.exp(-deltaSeconds * 8));
          s.phase += (moved / 9) * TAU;
        }
        const color = cachedCrowdColor(dogColors, dog.color),
          size = (dog.size || 1) * 0.85,
          trot = clamp(s.speed / 10, 0, 1),
          sit = dog.sit ? 1 : 0;
        crowdJoint(mRoot, mIdentity, dog.x, entityElevation(p) + Math.abs(Math.sin(s.phase)) * 0.3 * trot, dog.y, sit * 0.45, 0, -dog.a);
        mRoot.scale(crowdScale.set(size, size, size));
        crowdEmit(P.dogBody, mRoot, 1, 1, 1, color);
        for (let i = 0; i < 4; i++) {
          const front = i < 2,
            side = i % 2 ? 1 : -1,
            swing = Math.sin(s.phase + (front === (side > 0) ? 0 : Math.PI)) * 0.6 * trot;
          crowdJoint(mOut, mRoot, front ? 1.7 : -1.8, 2.5, side * 0.65, sit && !front ? 1.2 : swing);
          crowdEmit(P.dogLeg, mOut, 1, 1, 1, color);
        }
        if (hand && p.hp > 0) {
          // Leash from the hand to the collar.
          const e = hand.elements;
          crowdVec.set(e[12], e[13] - 0.6, e[14]);
          crowdVec2.set(dog.x + Math.cos(dog.a) * 2.8 * size, entityElevation(p) + 5 * size, dog.y + Math.sin(dog.a) * 2.8 * size);
          const length = crowdVec.distanceTo(crowdVec2);
          if (length > 0.5 && length < 40) {
            const mid = crowdVec.clone().add(crowdVec2).multiplyScalar(0.5);
            crowdQuat.setFromUnitVectors(crowdXAxis, crowdVec2.sub(crowdVec).normalize());
            mOut.compose(mid, crowdQuat, crowdScale.set(length, 0.2, 0.2));
            if (P.leash.n < P.leash.capacity) {
              P.leash.mesh.setMatrixAt(P.leash.n, mOut);
              P.leash.n++;
            }
          }
        }
      }
      function flushCrowdParts() {
        for (const part of Object.values(crowdParts)) {
          const mesh = part.mesh;
          mesh.count = part.n;
          if (part.n) {
            mesh.instanceMatrix.clearUpdateRanges();
            mesh.instanceMatrix.addUpdateRange(0, part.n * 16);
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) {
              mesh.instanceColor.clearUpdateRanges();
              mesh.instanceColor.addUpdateRange(0, part.n * 3);
              mesh.instanceColor.needsUpdate = true;
            }
            if (part.paint) {
              part.paint.clearUpdateRanges();
              part.paint.addUpdateRange(0, part.n * 4);
              part.paint.needsUpdate = true;
              part.meta.clearUpdateRanges();
              part.meta.addUpdateRange(0, part.n * 2);
              part.meta.needsUpdate = true;
            }
          }
          mesh.visible = part.n > 0;
          part.n = 0;
        }
      }
      /* Level of detail from the zoom: 2 full (hands and small props once a figure is 25 px
         or more), 1 without them, 0 far figures. */
      function crowdDetail() {
        const lod = activeTier ? activeTier.lodBias : 1,
          zoom = flightViewActive ? viewZoom : worldZoom;
        return zoom >= 1.3 * lod ? 2 : zoom >= 0.34 * lod ? 1 : 0;
      }
      /**
       * Per frame: pack every visible pedestrian, their dog, the special
       * characters (`specials`: the player, officers, gangs, guards, mission
       * characters) and the scene props. Returns how many people were drawn.
       */
      let crowdPackMs = 0;
      function updateCrowd3D(deltaSeconds, specials = []) {
        const packStart = performance.now();
        crowdStillShown = crowdStillCount;
        crowdStillCount = 0;
        let drawn = 0;
        lastDelta = deltaSeconds;
        const detail = crowdDetail(),
          zoom = flightViewActive ? viewZoom : worldZoom,
          zoomedIn = (flightViewActive ? viewZoom : worldZoom) > 0.22;
        // Close-up detail only where a head is more than a few pixels across.
        BODY = zoom >= 2.4 ? BODY_CLOSE : BODY_STREET;
        trackCarTransition();
        if (zoomedIn)
          for (const p of pedestrians) {
            if (p.hidden) continue;
            const view = entityInView(p, 30),
              dogView = p.dog && entityInView(p.dog, 20);
            if (!view && !dogView) {
              const s = crowdState.get(p);
              if (s) s.seen = false;
              continue;
            }
            const hand = drawCrowdPerson(p, stateFor(p), deltaSeconds, detail, null);
            drawn++;
            if (p.dog) drawCrowdDog(p, hand, deltaSeconds);
          }
        for (const p of specials) {
          const isPlayer = p === player;
          if (p.hidden) continue;
          if (isPlayer && (player.car || transitRide || taxiRide)) continue;
          if (!isPlayer && (!zoomedIn || !entityInView(p, 35))) {
            const s = crowdState.get(p);
            if (s) s.seen = false;
            continue;
          }
          const spec = specialSpec(p),
            s = stateFor(p);
          drawCrowdPerson(p, s, deltaSeconds, isPlayer ? Math.max(detail, 1) : detail, spec);
          drawn++;
        }
        drawEnterCar(deltaSeconds, detail);
        if (zoomedIn) drawn += drawBeachgoers(deltaSeconds, detail);
        crowdPackMs = performance.now() - packStart;
        for (const prop of crowd.props) {
          const part = propParts[prop.kind];
          if (!part || !entityInView(prop, 30)) continue;
          // A piece a car has knocked over lies tipped on its side (crowd.js).
          crowdJoint(mOut, mIdentity, prop.x, terrainHeight(prop.x, prop.y), prop.y, 0, prop.tip || 0, -(prop.a || 0));
          if (part.n < part.capacity) {
            part.mesh.setMatrixAt(part.n, mOut);
            part.n++;
          }
        }
        return drawn;
      }
      /* After the vehicles are posed: the riders, then upload every part (render3d.js). */
      function finishCrowd3D(deltaSeconds) {
        const start = performance.now();
        drawQueuedRiders(deltaSeconds, crowdDetail());
        drawQueuedAthletes(deltaSeconds, crowdDetail());
        flushCrowdParts();
        crowdPackMs += performance.now() - start;
        crowdPackAverage += (crowdPackMs - crowdPackAverage) * 0.05;
      }
      let crowdPackAverage = 0;
      /**
       * Measures for DeadEndCity.scaleReport: the rig's standing height at
       * look.height 1, and a person's drawn extents ({ l, w, h }, map units).
       */
      /* What the people cost this frame: instanced parts drawn, draw calls (camera
         and shadow) and triangles, and which body set is in use. */
      function crowdStats(byPart = false) {
        const list = [];
        let parts = 0,
          viewCalls = 0,
          shadowCalls = 0,
          triangles = 0,
          instances = 0;
        for (const part of Object.values(crowdParts)) {
          const mesh = part.mesh;
          if (!mesh.visible || !mesh.count) continue;
          const g = mesh.geometry,
            tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
          parts++;
          viewCalls++;
          if (mesh.castShadow) shadowCalls++;
          instances += mesh.count;
          triangles += tris * mesh.count;
          if (byPart) list.push([mesh.name, mesh.count, tris]);
        }
        return {
          parts,
          viewCalls,
          shadowCalls,
          instances,
          triangles: Math.round(triangles),
          bodySet: BODY === BODY_CLOSE ? 'close' : 'street',
          packMs: Math.round(crowdPackMs * 100) / 100,
          packMsAverage: Math.round(crowdPackAverage * 100) / 100,
          // People drawn from their recorded instances (STILL FIGURES).
          still: crowdStillShown,
          ...(byPart ? { byPart: list } : {}),
        };
      }
      /* Pack the people `frames` times back to back and report the average (ms):
         the CPU cost of the rig without the frame's other work in the timing. */
      function crowdBenchmark(frames = 20) {
        const start = performance.now();
        for (let i = 0; i < frames; i++) {
          updateCrowd3D(1 / 60, renderPeople);
          finishCrowd3D(1 / 60);
        }
        return Math.round(((performance.now() - start) / frames) * 1000) / 1000;
      }
      function crowdRigHeight() {
        return PERSON_HEIGHT;
      }
      function personExtents(p) {
        if (!p || !(p === player || pedestrians.includes(p) || renderPeople.includes(p))) return null;
        const look = p === player || !p.look ? specialLook(p) : p.look,
          R = compiledLook(look, p),
          H = R.height * RIG_UNIT;
        return { l: 2.3 * H * R.width, w: 3.9 * H * R.width, h: 14 * H };
      }
      function personStature(p) {
        const look = p.look || (renderPeople.includes(p) ? specialLook(p) : null);
        return look ? compiledLook(look, p).height * PERSON_HEIGHT : null;
      }
