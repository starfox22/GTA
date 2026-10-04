        // Render(): the per-frame 3D draw, split CPU timings for DeadEndCity.stats().
        render() {
          const deltaSeconds = Math.min(0.04, Math.max(0, gameTime - lastVisualTime));
          lastVisualTime = gameTime;
          // Split CPU timings of the frame for DeadEndCity.stats() (`r:` parts).
          let lap = performance.now();
          hiccupBegin();
          nightAmount = clamp(1 - daylight() * 1.6, 0, 1);
          updateCivicVisuals();
          // A boat passing under a road bridge is dropped 30 units below the deck
          // (boatSurfaceElevation, air-cover.js) so it slips under the roadway. The
          // camera, the shadow fit and the cutaway stay on the water: following that
          // drop jolted the whole view down and back up again at each bridge.
          const altitude = streetCameraAltitude(),
            flying = !!(isAircraft(player.car) || player.parachute);
          // Street (orthographic) or flight (perspective) camera, plus what it sees.
          updateFlightView(deltaSeconds, altitude, flying);
          // Riding the Falcon or the Eye: the ride camera takes over (themepark3d.js).
          updateParkCamera(deltaSeconds);
          // The camera's kick and tremor (camera-feel.js: game state, read here).
          const tremor = cameraShakeOffset(gameTime, cameraShakeLevel());
          camera.position.x += cameraKick.x + tremor.x;
          camera.position.z += cameraKick.y + tremor.y;
          if (camera === streetCamera) lockStreetCameraToPixels();
          camera.updateMatrixWorld(true);
          viewFrustum.setFromProjectionMatrix(
            viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
          );
          // Weather runs after the time-of-day pass so it modifies that day's light
          // rather than being overwritten by it; the clouds need the final camera.
          lap = profileLap('r:camera', lap);
          updateWeatherVisuals(deltaSeconds);
          updateLighting(deltaSeconds);
          updateSurfaces(deltaSeconds);
          applyAerialFog();
          updateCloudVisuals(deltaSeconds);
          lap = profileLap('r:sky', lap);
          updateTransitVisuals();
          updateWildlifeVisuals(deltaSeconds);
          updateSportsVisuals(deltaSeconds);
          updateSportsbookVisuals();
          updateGarageVisuals();
          updateWorldVisuals();
          updateCityscapeVisuals();
          updateSideJobVisuals();
          updateRoadblockVisuals();
          updateBikeShareVisuals();
          updateParkVisuals();
          updateCountyVisuals();
          updateHarborVisuals();
          updatePayphoneVisuals();
          updateMarinaVisuals(deltaSeconds);
          updateMonarchVisuals();
          updateDealershipVisuals(deltaSeconds);
          updateMissionVisuals();
          lap = profileLap('r:scenery', lap);
          placeSun();
          updateFarScenery();
          // Tree levels of detail and wind (vegetation3d.js), after the far city's switch.
          updateVegetation(deltaSeconds);
          // Scenery groups inside the visible ground footprint (flight-view3d.js);
          // small ones drop out once they would only be a few pixels across. Most
          // hang from a cell group (STATIC CELLS): a cell out of reach is hidden
          // whole and its groups are not visited at all.
          for (const cell of staticCells) {
            const show =
              Math.abs(cell.x - viewCenter.x) < viewReach + cell.reach &&
              Math.abs(cell.y - viewCenter.y) < viewReach + cell.reach;
            cell.group.visible = show;
            if (!show) continue;
            for (const s of cell.entries) s.group.visible = staticInView(s);
          }
          for (const s of looseStatics) s.group.visible = staticInView(s);
          for (let i = celledStatics; i < statics.length; i++) statics[i].group.visible = staticInView(statics[i]);
          // Whole cells of merged scenery out of reach (STATIC BATCH CELLS).
          const batchReach = viewReach + STATIC_BATCH_SHADOW_MARGIN;
          for (const cell of staticBatchCells.values())
            cell.group.visible =
              Math.abs(cell.x - viewCenter.x) < batchReach + cell.half &&
              Math.abs(cell.z - viewCenter.y) < batchReach + cell.half;
          // Signals are re-placed from their groups' visibility: after the cull, or a
          // junction coming into view drew its posts and bulbs a frame late (lights
          // popping in at the edge of the frame as the camera moved).
          updateTrafficVisuals();
          // Anything between the camera and the player is cut away round them
          // (lighting3d.js, CUTAWAY).
          updateCutaway(altitude);
          // Leaves between the camera and the player dissolve round them (vegetation3d-cutaway.js).
          updateFoliageCutaway(deltaSeconds);
          lap = profileLap('r:lod', lap);
          // Everyone on foot is drawn by the instanced character rig (crowd3d.js,
          // character-rig3d.js): pedestrians, and guards, gangs, officers, story
          // actors and the player in their outfits with what they hold.
          const people = renderPeople;
          people.length = 0;
          for (const list of [enemies, gangMembers, officers, storyActors]) for (let i = 0; i < list.length; i++) people.push(list[i]);
          people.push(player);
          updateCrowd3D(deltaSeconds, people);
          lap = profileLap('r:crowd', lap);
          pruneModels(carModels, vehicles);
          newModelsThisFrame = 0;
          modelBuildMs = 0;
          beginVehicleImpostors();
          for (const c of vehicles) {
            let m = carModels.get(c);
            const near =
              c === player.car ||
              entityInView(c, Math.max(65, Math.hypot(vehicleSpec(c).l, vehicleSpec(c).w) * 0.75));
            // High above the city, traffic is drawn as instanced boxes (flight-view3d.js).
            if (near && vehicleImpostor(c)) {
              if (m) m.group.visible = false;
              continue;
            }
            if (!m && !near) continue;
            if (!m) {
              // Building a car is a few dozen meshes: a view full of new traffic (a
              // teleport, a fast drive into a new street) is spread over a few
              // frames instead of one long one. The player's own is never held back.
              if ((newModelsThisFrame >= NEW_MODELS_PER_FRAME || modelBuildMs > MODEL_BUILD_BUDGET_MS) && c !== player.car) continue;
              const buildStart = performance.now();
              newModelsThisFrame++;
              modelsBuiltTotal++;
              m = makeVehicle(c);
              carModels.set(c, m);
              trimShadowCasters(m.group, 4 * m.modelScale);
              modelBuildMs += performance.now() - buildStart;
            }
            m.group.visible = near;
            if (!near) continue;
            // Suspension: weight transfer, the hop after a blast, a sag onto a flat (damage3d.js).
            const stance = vehiclePose(c);
            m.group.position.set(c.x, 0.1 + entityElevation(c) + stance.lift, c.y);
            m.group.rotation.y = -c.a;
            m.body.rotation.x =
              (c === player.car ? clamp(normalizeAngle(c.a - (c.moveA ?? c.a)) * -0.15, -0.05, 0.05) : 0) +
              stance.roll;
            m.body.rotation.z =
              Math.sin(gameTime * 7 + c.id) * Math.min(0.008, Math.abs(c.speed) * 0.00002) + stance.pitch;
            // Vinny's truck shows the crates loaded so far (vinnytruck3d.js).
            if (m.cargo) m.cargo.forEach((g, i) => (g.visible = i < (c.cargoCount || 0)));
            if (m.nightLights) {
              // Drawn together by the instanced halo pass (VEHICLE HALOS), not one
              // sprite draw call each.
              // Lamps on at night and in heavy rain (weather3d.js).
              // Brake lights glow by day too: from above the lamp itself is a sliver.
              const lampsOn = vehicleLampAmount(),
                // `showLamps`: a parked review car lit as if driven (DeadEndCity.carLineup).
                driven = c.hp > 0 && (c.ai || c === player.car || !!c.showLamps),
                lit = driven && lampsOn > 0.25,
                braking = driven && (!!c.braking || c.showLamps === 'brake'),
                reversing = driven && forwardSpeed(c) < -6;
              // Head lamps (even) face forward, tail lamps (odd) back: they glow
              // brighter facing the camera (VEHICLE HALOS). Brake lights flare;
              // reversing adds white lamps on the tail sprites.
              for (let k = 0; k < m.nightLights.length; k++) {
                const sprite = m.nightLights[k];
                sprite.visible = false;
                if (m.lampOut?.[k]) continue;
                if (k % 2 && braking) queueVehicleHalo(sprite, Math.max(0.75, lampsOn), -1, 2.2);
                else if (lit) queueVehicleHalo(sprite, (k % 2 ? 0.55 : 0.85) * lampsOn, k % 2 ? -1 : 1);
                if (k % 2 && reversing) queueVehicleHalo(sprite, 0.8 * Math.max(0.45, lampsOn), -1, 1.6, REVERSE_LAMP_TINT, 0.75);
              }
            }
            // Brake lights: tail lamps that aren't broken swap material while braking.
            const braking = (!!c.braking || c.showLamps === 'brake') && c.hp > 0;
            if (m.lamps && m.brakeLit !== braking) {
              m.brakeLit = braking;
              for (const lamp of m.lamps)
                if (lamp.lit === tailLamp && !c.damage?.lights?.[lamp.key]) lamp.mesh.material = braking ? brakeLamp : tailLamp;
            }
            // A pristine car drawn merged goes back to its own parts before anything changes them (vehicle-merge3d.js).
            if (m.merged && !vehicleMergeEligible(c, m)) splitVehicleModel(m);
            // Civilian lamps, DRLs, rolling and steering wheels (cars3d.js).
            if (m.civilian) {
              const lampsOn = vehicleLampAmount(),
                driven = c.hp > 0 && (c.ai || c === player.car || !!c.showLamps);
              animateCivilianCar(c, m, deltaSeconds, driven, lampsOn, braking);
              if (m.merged) syncMergedVehicle(m);
            }
            // Windscreen wipers in the rain (vehicles3d.js).
            if (m.wipers) updateWipers(c, m, deltaSeconds);
            const wear = clamp(1 - c.hp / c.maxhp, 0, 1);
            paintVehicle(c, m);
            // The player's cranks turn at their pedalling cadence (still when
            // coasting); anyone else's follow road speed.
            if (m.crank)
              m.crank.rotation.z -=
                deltaSeconds * (c === player.car ? pedalCadence() * Math.PI * 2 : c.speed * 0.13);
            if (m.heli) {
              // Spool, rotor blur, attitude, crew, Nightsun and lights (helicopter3d.js).
              animateHelicopter(c, m, deltaSeconds, wear);
            } else if (m.helicopter) {
              const running =
                (c === player.car ||
                  c.airUnit ||
                  (c.abandonedFlight && entityElevation(c) > terrainHeight(c.x, c.y) + 2)) &&
                c.hp > 0;
              m.rotor.rotation.y += deltaSeconds * (running ? 55 : 2);
              m.tail.rotation.z += deltaSeconds * (running ? 90 : 2);
              m.disc.visible = running;
              m.body.rotation.z = clamp(-c.speed * 0.00035, -0.13, 0.13);
              m.body.rotation.x = clamp(c.av * 0.065, -0.1, 0.1);
              m.canopy.material.roughness = 0.12 + wear * 0.65;
              // The Apache's chin gun and lights (apache3d.js).
              if (m.apache) animateApache(c, m);
            } else if (m.damageVersion !== c.damageVersion) {
              // Crumple, panels, glass, lamps and tyres follow the damage data (damage3d.js).
              m.damageVersion = c.damageVersion;
              applyVehicleDamage(c, m);
              m.brakeLit = null; // lamp materials were reset: re-apply brake lights
            }
            // PRISTINE MERGE (vehicle-merge3d.js): once its first damage pass has set it up, an untouched civilian car
            // draws its static parts merged per material.
            if ((m.civilian || m.police) && m.merged === undefined && m.damageVersion === c.damageVersion && vehicleMergeEligible(c, m)) mergeVehicleModel(c, m);
            // Control surfaces, gear, propeller, lights and buffet (plane3d.js).
            if (m.plane) animateAircraft(c, m, deltaSeconds);
            if (m.tank) {
              m.turret.rotation.y = -normalizeAngle((c.turretA ?? c.a) - c.a);
              m.barrel.position.x = (-Math.max(0, (c.cannonRecoilUntil || 0) - gameTime) / 0.25) * 4;
            }
            if (m.special) {
              if (!m.plane) m.body.rotation.z = -wear * 0.025 + stance.pitch;
              if (m.bike) {
                // Leaning into the turn, or down on its side after a crash (riders.js).
                m.body.rotation.x = c.fallen ? c.fallen.roll : clamp(c.av * 0.13, -0.28, 0.28);
                // (`showLamps`: a review bike shows its rider, DeadEndCity.carLineup.)
                m.rider.visible = c.hp > 0 && (c === player.car || c.ai || !!c.showLamps);
                // Lamps, the fork's steering and the wheelie (motorbikes3d.js).
                if (m.bikeUpdate) m.bikeUpdate(c, deltaSeconds);
                else if (m.bicycle) bicycleWheelie(c, m);
              }
              if (m.jetski) m.rider.visible = c === player.car && c.hp > 0;
              // The character rig draws the rider in their place (crowd3d.js RIDERS).
              if (m.rider?.visible && (m.bike || m.jetski) && m.group.visible && queueRider(c, m)) m.rider.visible = false;
              if (m.boat) {
                // Under a road bridge the hull slips below the deck (air-cover.js). It
                // starts down as soon as the bow or stern is under the roadway and eases
                // there, instead of popping 30 units when the middle of the boat crosses.
                const half = vehicleSpec(c).l * 0.5,
                  ux = Math.cos(c.a) * half,
                  uy = Math.sin(c.a) * half,
                  underBridge =
                    underBridgeWater(c.x, c.y) ||
                    underBridgeWater(c.x + ux, c.y + uy) ||
                    underBridgeWater(c.x - ux, c.y - uy),
                  float = underBridge ? -30 : 0.6 + Math.sin(gameTime * 1.7 + c.x * 0.02) * 0.45;
                m.float = m.float === undefined || Math.abs(float - m.float) > 60 ? float : m.float + (float - m.float) * (1 - Math.exp(-deltaSeconds * 12));
                m.group.position.y = m.float;
                m.body.rotation.z = Math.sin(gameTime * 2 + c.id) * 0.023;
                m.body.rotation.x = Math.sin(gameTime * 1.3 + c.y * 0.017) * 0.028;
                // Wake, bow wave and spray are drawn into the sea (wakes3d.js).
                const boatSpec = vehicleSpec(c);
                if (c.hp > 0 && (Math.abs(c.speed) > 2 || c === player.car))
                  wakeEmit(c, c.x, c.y, c.a, c.speed, boatSpec.l, boatSpec.w, boatSpec.max || 300, !underBridge);
                if (m.boatUpdate) m.boatUpdate(c);
              }
              for (const { wheel, radius } of m.wheels) wheel.rotation.z -= (c.speed * deltaSeconds) / (radius || 5 * (m.modelScale || 1));
            }
            // Blood on the bodywork (carblood3d.js; the records are c.stains).
            if (c.stains || m.bloodSkin) updateCarBlood(c, m);
            // The driver's door in a carjack (carjack3d.js).
            if (c.doorSwing || m.carjackDoor) swingDriverDoor(c, m);
            // SWAT van rear doors swing open for the team and stay open (swat.js).
            if (m.rearDoors) {
              const open = c.doorsOpenAt ? clamp((gameTime - c.doorsOpenAt) / 0.7, 0, 1) : 0;
              for (const { pivot, side } of m.rearDoors) pivot.rotation.y = side * open * 1.85;
            }
            // Flash patterns, wig-wag, halos (police3d.js).
            if (m.police) {
              animatePoliceVehicle(c, m);
              if (m.merged) syncMergedVehicle(m);
            }
            // Club trucks: wheel spin, steering, articulation, light bars; mud on any body (offroad3d.js).
            if (m.offroad) animateOffroadVehicle(c, m, deltaSeconds);
            else if (c.mudCoat > 0.01 || m.mudUniforms) applyVehicleMud(c, m);
            for (let i = 0; i < m.strobes.length; i++)
              m.strobes[i].material.color.copy(
                cachedColor(
                  emergencyBeacons(c) &&
                    Math.sin(gameTime * 17 + i * 3) > 0
                    ? i
                      ? '#78aefa'
                      : '#ff6751'
                    : '#3c4147',
                ),
              );
            // Engine smoke, fire and the burning wreck (damage3d.js).
            vehicleEffects(c, m, deltaSeconds);
          }
          endVehicleImpostors();
          // Riders on the vehicles just posed, then the people's instance upload (crowd3d.js).
          finishCrowd3D(deltaSeconds);
          lap = profileLap('r:vehicles', lap);
          // Dolphins, the shark and gulls, their splashes, the life map under the
          // surface (sealife3d.js); fins and dolphins at the surface report wakes.
          updateSeaLifeVisuals(deltaSeconds);
          // Every craft on the water has reported in: draw the wake map (wakes3d.js).
          updateWakes(deltaSeconds);
          // Mud and dust from the tyres, splats and tyre tracks, the 4x4 club's flag and smoke (offroad3d.js).
          updateOffroadVisuals(deltaSeconds);
          // Smoke, dust and road spray off the tyres (tyresmoke3d.js).
          updateTyreSmoke(deltaSeconds);
          for (const [c, m] of carModels)
            if (m.group.visible && !isAircraft(c) && !isBoat(c)) {
              m.body.rotation.x += c.slopeRoll || 0;
              m.body.rotation.z += c.slopePitch || 0;
            }
          // Marks on vehicles, debris, knocked furniture and decal uploads (damage3d.js).
          updateDamageVisuals(deltaSeconds);
          lap = profileLap('r:damage', lap);
          updateSniperSights();
          // The parachute hangs from the harness point the person pass just posed.
          updateParachute3D(deltaSeconds);
          // Settings · Graphics · Ring under your character: off unless switched on.
          playerRing.visible =
            playerRingOn() &&
            !transitRide && !taxiRide && !player.car && !player.parachute && !player.swimming;
          playerRing.position.set(player.x, 0.3 + entityElevation(player), player.y);
          // Settings · Graphics · Player outline at night turns it off.
          playerRim.value.copy(PLAYER_RIM_NIGHT).multiplyScalar(playerOutlineOn() ? nightAmount * 0.55 : 0);
          // A swimmer's wake, kick foam and the ripples round them are drawn into the
          // sea like a boat's (wakes3d.js). The flat V and ring planes that did this
          // sat at a fixed height, so the swell rose through them.
          if (player.swimming && !player.pool) wakeEmit(player, player.x, player.y, player.a, clamp(player.swimDrive || 0, 0, 1) * 70, 16, 7, 80, false);
          disposeRetiredModels();
          const target = objective(),
            targetAltitude = target ? entityElevation(target) : 0;
          // Only the floating arrow marks the objective (no ring on the ground); it stays
          // away while the Blue Hour job is just watching the spiked glass take effect.
          arrowGroup.visible = objectiveArrowShown(target);
          if (target) {
            arrowGroup.position.set(
              target.x,
              targetAltitude + 39 + Math.sin(gameTime * 3) * 3,
              target.y,
            );
            arrowGroup.rotation.y = gameTime * 0.6;
          }
          if (gameTime > muzzleUntil) muzzleLight.intensity = 0;
          for (const ring of blastRings) {
            if (!ring.visible) continue;
            const age = gameTime - ring.userData.born;
            ring.visible = age < 0.6;
            const radius = 12 + age * 220 * ring.userData.power;
            ring.scale.set(radius, radius, 1);
            ring.material.opacity = Math.max(0, 0.35 * (1 - age / 0.6));
          }
          let fi = 0,
            li = 0;
          for (const fire of fires) {
            if (distanceBetween(fire, cameraTarget) > 1000) continue;
            const fade = Math.min(1, fire.life / 3),
              age = fire.max - fire.life,
              altitude = fire.altitude ?? terrainHeight(fire.x, fire.y);
            for (let j = 0; j < 3 && fi < flamePool.length; j++) {
              const sp = flamePool[fi++],
                phase = gameTime * 7 + j * 2.4 + fire.x;
              sp.visible = true;
              sp.position.set(
                fire.x + Math.sin(phase * 0.5) * 13 * fire.power,
                altitude + 12 + Math.sin(phase) * 3,
                fire.y + Math.cos(phase * 0.4) * 11 * fire.power,
              );
              sp.scale.set(
                (28 + Math.sin(phase) * 6) * fire.power,
                (52 + Math.cos(phase * 1.3) * 12) * fire.power,
                1,
              );
              sp.material.opacity = fade * 0.9;
            }
            if (li < fireLights.length) {
              const light = fireLights[li++];
              light.position.set(fire.x, altitude + 20, fire.y);
              light.intensity = fade * fire.power * (540 + Math.sin(gameTime * 17) * 90);
            }
            if (deltaSeconds > 0 && Math.random() < deltaSeconds * 12)
              fx.push({
                x: fire.x + randomBetween(-10, 10),
                y: altitude + 18,
                z: fire.y + randomBetween(-10, 10),
                vx: 7,
                vy: randomBetween(22, 40),
                vz: 3,
                life: 3,
                max: 3,
                color: age > 8 ? '#3b4146' : '#606166',
                size: 18 * fire.power,
                smoke: true,
              });
          }
          for (; fi < flamePool.length; fi++) flamePool[fi].visible = false;
          for (; li < fireLights.length; li++) fireLights[li].intensity = 0;
          for (let i = 0; i < scorchMeshes.length; i++) {
            const d = debris[debris.length - 1 - i],
              m = scorchMeshes[i];
            m.visible = !!d && distanceBetween(d, cameraTarget) < 1000;
            if (d) {
              m.position.set(d.x, (d.altitude ?? terrainHeight(d.x, d.y)) + 0.2, d.y);
              m.scale.set(100, 85, 1);
              m.material.opacity = Math.min(0.8, d.life / 10);
            }
          }
          if (fx.length > 620) fx.splice(0, fx.length - 620);
          let pi = 0;
          // Sprites are unlit: blood drops, casings, glass and smoke take the scene's
          // light level so they do not glow in the dark (flames and sparks do).
          const spriteLight = 0.3 + 0.7 * daylight();
          for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.life -= deltaSeconds;
            if (p.life <= 0) {
              fx.splice(i, 1);
              continue;
            }
            p.x += p.vx * deltaSeconds;
            p.y += p.vy * deltaSeconds;
            p.z += p.vz * deltaSeconds;
            if (p.case) {
              // A spent case falls, bounces and lies a moment on the ground before it fades.
              p.vy -= 120 * deltaSeconds;
              if (p.y < (p.floor ?? 0.5)) {
                p.y = p.floor ?? 0.5;
                const bounce = p.vy < -12;
                p.vy = bounce ? -p.vy * 0.35 : 0;
                p.vx *= bounce ? 0.55 : 0.6;
                p.vz *= bounce ? 0.55 : 0.6;
              }
            } else {
              const drag = Math.pow(0.97, deltaSeconds * 60);
              p.vx *= drag;
              p.vz *= drag;
            }
            p.y = Math.max(0.5, p.y);
            if (pi >= particlePool.length) continue;
            const s = particlePool[pi++];
            s.visible = true;
            s.position.set(p.x, p.y, p.z);
            const a = p.life / p.max;
            s.material.map = p.glow ? haloTx : smokeTx;
            s.material.color.copy(cachedColor(p.color));
            if (!p.glow) s.material.color.multiplyScalar(spriteLight);
            s.material.opacity = Math.min(p.smoke ? 0.56 : 0.96, a * 1.7);
            s.material.blending = p.glow ? Three.AdditiveBlending : Three.NormalBlending;
            let sz = p.case ? p.size : p.size * (1 + (1 - a) * 2);
            s.scale.set(sz, sz, 1);
          }
          for (const p of particles) {
            if (pi >= particlePool.length) break;
            const s = particlePool[pi++];
            s.visible = true;
            s.position.set(
              p.x,
              p.blood || p.flame || p.mist ? Math.max(0.3, p.z) : 2 + (1 - p.life / p.max) * 13,
              p.y,
            );
            s.material.map = p.blood ? bloodDropTx : p.flame ? flameTx : smokeTx;
            s.material.color.copy(cachedColor(p.color));
            if (!p.flame) s.material.color.multiplyScalar(spriteLight);
            // A wound's mist (blood.js): a faint puff that spreads as it fades.
            s.material.opacity = p.blood ? 0.97 : p.mist ? clamp(p.life / p.max, 0, 1) * 0.45 : clamp(p.life / p.max, 0, 0.7);
            s.material.blending = p.flame ? Three.AdditiveBlending : Three.NormalBlending;
            const puff = p.mist ? 1.6 + (1 - p.life / p.max) * 2.2 : 1.6;
            s.scale.set(p.size * (p.blood ? 1.1 : puff), p.size * (p.blood ? 1.8 : puff), 1);
          }
          for (; pi < particlePool.length; pi++) particlePool[pi].visible = false;
          let bi = 0;
          for (const b of bullets) {
            if (bi + 6 > tracerPositions.length) break;
            // A sniper round (combat-rules.js SNIPER FIRE) leaves a longer streak.
            const tail = b.tracer || 0.009;
            tracerPositions[bi++] = b.x;
            tracerPositions[bi++] = 9 + (b.altitude || 0);
            tracerPositions[bi++] = b.y;
            tracerPositions[bi++] = b.x - b.vx * tail;
            tracerPositions[bi++] = 9 + (b.altitude || 0) - (b.vz || 0) * tail;
            tracerPositions[bi++] = b.y - b.vy * tail;
          }
          tracerGeo.setDrawRange(0, bi / 3);
          tracerGeo.attributes.position.needsUpdate = true;
          tracer.frustumCulled = false;
          // Skid marks: strips as wide as a tyre, as dark as the slide was, fading out
          // over their last dozen seconds.
          let si = 0,
            ci = 0;
          for (const s of skids) {
            if (si + 18 > skidPos.length) break;
            const cos = Math.cos(s.a),
              sin = Math.sin(s.a),
              half = (s.w || 2) / 2,
              px = -sin * half,
              pz = cos * half,
              x1 = s.x + cos * s.len,
              z1 = s.y + sin * s.len,
              // The ground under both ends, laid with the mark (tyre-effects.js pushTyreMark).
              h0 = s.h0 !== undefined ? s.h0 : terrainHeight(s.x, s.y) + 0.2,
              h1 = s.h1 !== undefined ? s.h1 : terrainHeight(x1, z1) + 0.2,
              alpha = 0.62 * (s.dark ?? 0.6) * Math.min(1, s.life / 12);
            // (a, b, c) (a, c, d): a, b along the near edge, c, d the far one.
            skidPos[si++] = s.x - px;
            skidPos[si++] = h0;
            skidPos[si++] = s.y - pz;
            skidPos[si++] = s.x + px;
            skidPos[si++] = h0;
            skidPos[si++] = s.y + pz;
            skidPos[si++] = x1 + px;
            skidPos[si++] = h1;
            skidPos[si++] = z1 + pz;
            skidPos[si++] = s.x - px;
            skidPos[si++] = h0;
            skidPos[si++] = s.y - pz;
            skidPos[si++] = x1 + px;
            skidPos[si++] = h1;
            skidPos[si++] = z1 + pz;
            skidPos[si++] = x1 - px;
            skidPos[si++] = h1;
            skidPos[si++] = z1 - pz;
            for (let k = 0; k < 6; k++, ci += 4) skidColor[ci + 3] = alpha;
          }
          skidGeo.setDrawRange(0, si / 3);
          // Only the marks drawn go to the GPU, not the whole 1100-mark buffer (184 KB a frame).
          if (si > 0) {
            skidGeo.attributes.position.addUpdateRange(0, si);
            skidGeo.attributes.position.needsUpdate = true;
            skidGeo.attributes.color.addUpdateRange(0, (si / 3) * 4);
            skidGeo.attributes.color.needsUpdate = true;
          }
          skidLines.visible = si > 0;
          skidLines.frustumCulled = false;
          // The sun's shadow map is redrawn every frame it is on (quality.js
          // SHADOWS): a map kept for a few frames left the shadows of the player
          // and the traffic trailing behind them. With shadows off, contact
          // blobs ground the cars and people instead.
          frames++;
          const shadowRefresh = renderer.shadowMap.enabled;
          renderer.shadowMap.needsUpdate = shadowRefresh;
          updateContactShadows();
          lap = profileLap('r:people+fx', lap);
          // World matrices of what is shown (SCENE MATRICES), then the HDR scene,
          // AO, bloom, tone curve and grade (postfx3d.js).
          refreshSceneMatrices();
          flushVehicleHalos();
          renderFrame();
          lap = profileLap(shadowRefresh ? 'r:submit+shadow' : 'r:submit', lap);
          if (bakedCanvases.length && frames % 30 === 0) releaseBakedCanvases();
          // Cleared only after a frame that drew on it (OVERLAY INK, render3d-resources.js).
          if (overlayInk) {
            worldContext.clearRect(0, 0, viewportWidth, viewportHeight);
            overlayInk = false;
          }
          if (target && gameMode === 'play') {
            const p = api.project(target.x, target.y, 32 + targetAltitude);
            if (p.x < 60 || p.x > viewportWidth - 60 || p.y < 130 || p.y > viewportHeight - 210) {
              const a = Math.atan2(p.y - viewportHeight / 2, p.x - viewportWidth / 2),
                r = Math.min(
                  (viewportWidth / 2 - 80) / Math.max(0.01, Math.abs(Math.cos(a))),
                  (viewportHeight / 2 - 125) / Math.max(0.01, Math.abs(Math.sin(a))),
                );
              const x = viewportWidth / 2 + Math.cos(a) * r,
                y = viewportHeight / 2 + Math.sin(a) * r;
              worldContext.save();
              worldContext.translate(x, y);
              worldContext.rotate(a);
              worldContext.fillStyle = '#efd7a1';
              worldContext.beginPath();
              worldContext.moveTo(12, 0);
              worldContext.lineTo(-7, -7);
              worldContext.lineTo(-3, 0);
              worldContext.lineTo(-7, 7);
              worldContext.closePath();
              worldContext.fill();
              worldContext.restore();
              worldContext.fillStyle = '#eee0c4';
              worldContext.font = 'bold 11px monospace';
              worldContext.textAlign = 'center';
              worldContext.fillText(distanceLabel(distanceBetween(player, target)), x, y + 24);
            }
          }
          for (const p of [...storyActors, ...enemies, ...gangMembers]) {
            if (
              p.guest ||
              p.boss ||
              p.hidden ||
              p.hp <= 0 ||
              // Soldiers going about their duties are not labelled until they engage.
              (p.military && !p.aiming) ||
              !sameFloor(p, player) ||
              distanceBetween(p, player) > (p.ally ? 400 : 230)
            )
              continue;
            const q = api.project(p.x, p.y, entityElevation(p) + PERSON_HEIGHT + 6.5);
            if (q.x < 20 || q.x > viewportWidth - 20 || q.y < 80 || q.y > viewportHeight - 180)
              continue;
            worldContext.font = 'bold 10px Arial';
            worldContext.textAlign = 'center';
            worldContext.strokeStyle = '#11202a';
            worldContext.lineWidth = 3;
            worldContext.strokeText(p.name || '', q.x, q.y);
            worldContext.fillStyle = p.ally
              ? '#f0ddae'
              : p.faction === 'harbor'
                ? '#d99b84'
                : '#c9b6e7';
            worldContext.fillText(p.name || '', q.x, q.y);
          }
          // Pedestrian speech: short lines drawn as bubbles above the speaker.
          // Drivers shouting out of the window use the same bubble over the car.
          // speechBubbles() (crowd.js) picks at most two, most important first, and
          // returns none with Settings · Gameplay · NPC chatter off. A second bubble
          // that would overlap the first rises clear above it. Seen from high up
          // (above 40 m, gone by 50 m: speechHeightFade, crowd.js) they fade out.
          // A Falcon rider's bubble is anchored over the head (`bubbleZ`).
          // A witness on the phone to 911 (crowd-witnesses.js) is never culled: a
          // caller outside that band (behind the HUD, off the edge) keeps the
          // bubble inside the frame, with a pointer toward them.
          // Text size: 11 px, 12 on a phone-sized screen; the 911 call a size up
          // and bold (the canvas is already at the screen's pixel ratio).
          const bubbleRects = [],
            bubbleFont = viewportWidth <= 600 || viewportHeight <= 480 ? 12 : 11;
          for (const p of speechBubbles()) {
            const q = api.project(p.x, p.y, p.bubbleZ ?? entityElevation(p) + (p.type ? 19 : PERSON_HEIGHT + 9.5));
            if (q.behind) continue;
            const call911 = p.speechKind === 'call911' && p.speechKindText === p.speech;
            const fs = bubbleFont + (call911 ? 1 : 0),
              bh = fs + 6;
            worldContext.font = (call911 ? '700 ' : '600 ') + fs + 'px Arial';
            const tw = worldContext.measureText(p.speech).width + 12,
              fade = clamp((p.speechUntil - gameTime) / 0.4, 0, 1) * speechHeightFade(p);
            if (fade <= 0.01) continue;
            let pointTo = null;
            if (q.x < 40 || q.x > viewportWidth - 40 || q.y < 90 || q.y > viewportHeight - 190) {
              if (!call911) continue;
              pointTo = { x: q.x, y: q.y };
              q.x = clamp(q.x, tw / 2 + 10, viewportWidth - tw / 2 - 10);
              // (Clear of the district name and the notices along the top.)
              q.y = clamp(q.y, 150, viewportHeight - 190);
            }
            for (const r of bubbleRects)
              if (Math.abs(q.x - r.x) < (tw + r.w) / 2 + 4 && Math.abs(q.y - r.y) < bh + 4)
                q.y = r.y - bh - 4;
            bubbleRects.push({ x: q.x, y: q.y, w: tw });
            const mid = q.y - 4 - bh / 2;
            worldContext.globalAlpha = fade;
            worldContext.fillStyle = '#f4efe2';
            worldContext.beginPath();
            if (worldContext.roundRect) worldContext.roundRect(q.x - tw / 2, q.y - 4 - bh, tw, bh, 5);
            else worldContext.rect(q.x - tw / 2, q.y - 4 - bh, tw, bh);
            worldContext.fill();
            if (call911) {
              // The emergency call stands out: a red edge round the bubble.
              const width = worldContext.lineWidth;
              worldContext.strokeStyle = '#c7583e';
              worldContext.lineWidth = 1.5;
              worldContext.stroke();
              worldContext.lineWidth = width;
            }
            worldContext.beginPath();
            if (pointTo) {
              // Held inside the frame: the tail points toward the caller.
              const a = Math.atan2(pointTo.y - mid, pointTo.x - q.x),
                ex = q.x + Math.cos(a) * (tw / 2 + 8) * Math.min(1, Math.abs(Math.cos(a)) * 2),
                ey = mid + Math.sin(a) * (bh + 2);
              worldContext.moveTo(q.x - 4 * Math.sin(a), mid + 4 * Math.cos(a));
              worldContext.lineTo(q.x + 4 * Math.sin(a), mid - 4 * Math.cos(a));
              worldContext.lineTo(ex, ey);
            } else {
              worldContext.moveTo(q.x - 3, q.y - 4);
              worldContext.lineTo(q.x + 3, q.y - 4);
              worldContext.lineTo(q.x, q.y);
            }
            worldContext.fill();
            worldContext.fillStyle = '#1b2026';
            worldContext.textAlign = 'center';
            worldContext.fillText(p.speech, q.x, mid + fs * 0.36);
            worldContext.globalAlpha = 1;
          }
          drawHarborLabels3D(api);
          // SHARK! and the arrow to the fin (sealife3d.js).
          drawSealifeOverlay3D(api);
          drawHitTargetLabel();
          if (flash > 0) {
            worldContext.fillStyle = 'rgba(199,88,62,' + flash * 0.7 + ')';
            worldContext.fillRect(0, 0, viewportWidth, viewportHeight);
          }
          hiccupEnd();
        },
