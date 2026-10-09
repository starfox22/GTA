      // Motorbikes from downloaded models (vehicle-assets3d.js ASSET CARS data, tools/vehicle_models_moto.py): the frame,
      // the steering (fork, bars, head lamp), the wheels and the rider's pose, on the motorbike contract (motorbikes3d.js).
      /**
       * ASSET MOTORBIKES
       * A type the build carries a `kind: 'moto'` model for is built here instead of from MOTO_BODIES: the frame in the
       * bike's own paint colour (`paint`) and the model's other surfaces from the vehicle atlas (`trim`); everything
       * the converter found ahead of the steering axis or on the bars turns in the fork group (`steer`, pivoted on
       * the axis top, tilted back by the model's rake, as the procedural fork); the front wheel hangs from it. The
       * rider's pose (crowd3d-special.js RIDERS) is measured from the model: the saddle's top, the grips' ends, the
       * pegs; the wheelie pitches about the rear axle (`m.rearAxleX`). Same draw calls as a procedural bike.
       */
      const motoAssetKits = new Map();
      function motoAssetKit(type, l) {
        const key = type + ':' + l.toFixed(2);
        if (motoAssetKits.has(key)) return motoAssetKits.get(key);
        const data = vaData(),
          model = data.header.models[type],
          k = l / model.dims[0],
          [ax, ay, tx, ty] = model.axis,
          // The steering frame: on the axis top, tilted back by the rake (motorbikes3d.js forkPivot).
          pivot = new Three.Matrix4().makeRotationZ(model.rake).setPosition(tx * k, ty * k, 0),
          toSteer = pivot.clone().invert(),
          inSteer = (geo) => (geo ? geo.applyMatrix4(toSteer) : null),
          front = model.wheels.find((w) => w.front),
          rear = model.wheels.find((w) => !w.front),
          frontAt = new Three.Vector3(front.x * k, front.y * k, front.z * k).applyMatrix4(toSteer),
          box = (geo) => (geo ? (geo.computeBoundingBox(), geo.boundingBox) : null);
        const kit = {
          model,
          k,
          pivot: [tx * k, ty * k, model.rake],
          paint: vaGeometry(model, data, 'paint', k, [0.5, 0.5]),
          trim: vaGeometry(model, data, 'trim', k),
          steerPaint: inSteer(vaGeometry(model, data, 'steer.paint', k, [0.5, 0.5])),
          steerTrim: inSteer(vaGeometry(model, data, 'steer.trim', k)),
          head: vaGeometry(model, data, 'head', k),
          tail: vaGeometry(model, data, 'tail', k),
          front: { at: frontAt, r: front.r * k, tyre: vaGeometry(model, data, 'wheel' + model.wheels.indexOf(front) + '.tyre', k), rim: vaGeometry(model, data, 'wheel' + model.wheels.indexOf(front) + '.rim', k) },
          rear: { at: new Three.Vector3(rear.x * k, rear.y * k, rear.z * k), r: rear.r * k, tyre: vaGeometry(model, data, 'wheel' + model.wheels.indexOf(rear) + '.tyre', k), rim: vaGeometry(model, data, 'wheel' + model.wheels.indexOf(rear) + '.rim', k) },
        };
        // Lamp glows at the lamps' middles (the head lamp's taken before it moves into the fork's frame).
        const head = box(kit.head),
          tail = box(kit.tail);
        kit.headGlow = head ? head.getCenter(new Three.Vector3()) : new Three.Vector3(0.45 * l, 1.0 * k, 0);
        kit.tailGlow = tail ? tail.getCenter(new Three.Vector3()) : new Three.Vector3(-0.45 * l, 0.8 * k, 0);
        inSteer(kit.head);
        // The rider (metres): hips on the saddle, hands on the grips, soles on the pegs; the torso leaning `lean`.
        const [sx, sy] = model.seat,
          [gx, gy, gz] = model.grip,
          [px, py, pz] = model.peg,
          hip = [sx, sy + 0.02],
          shoulder = [hip[0] + 0.58 * Math.sin(-model.lean), hip[1] + 0.58 * Math.cos(model.lean)];
        kit.pose = {
          lean: model.lean,
          hip,
          shoulder,
          hand: [gx, gy],
          gripZ: gz,
          knee: [(hip[0] + px) / 2 + 0.16, (hip[1] + py) / 2 + 0.1],
          foot: [px, py],
          head: shoulder[1] + 0.2,
          suit: '#23272c',
          accent: '#8a9098',
          helmet: '#16181b',
          visor: '#2c3b4a',
        };
        kit.pegZ = pz;
        // A bicycle's crank about its middle, turned so the right pedal stands straight up at rest (the rider's feet
        // follow `m.crank.rotation.z` from there: crowd3d-special.js RIDERS).
        if (model.crank) {
          const [cx, cy, r, angle, z] = model.crank,
            geo = vaGeometry(model, data, 'crank', k);
          if (geo) geo.rotateZ(Math.PI / 2 - angle);
          kit.crank = { at: [cx * k, cy * k], r: r * k, z: z * k, geo };
          kit.pose.foot = [cx, cy - r];
        }
        motoAssetKits.set(key, kit);
        return kit;
      }
      function makeAssetMotorbike(vehicle) {
        const type = vehicle.type,
          spec = vehicleSpec(vehicle),
          kit = motoAssetKit(type, spec.l),
          k = kit.k,
          materials = civSharedMaterials(),
          assetMaterials = vaMaterials(),
          lampMaterials = civLampSet(),
          model = specialVehicle(vehicle),
          b = model.body;
        model.bike = true;
        model.realSize = true;
        model.moto = type;
        model.bicycle = !!kit.crank;
        model.asset = kit.model.title;
        model.badge = null;
        model.paint = new Three.MeshPhysicalMaterial({ color: vehicle.color, roughness: 0.26, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
        if (kit.paint) mesh(kit.paint, model.paint, b, 0, 0, 0);
        if (kit.trim) mesh(kit.trim, assetMaterials.trim, b, 0, 0, 0);
        const forkPivot = new Three.Group(),
          steer = new Three.Group();
        forkPivot.position.set(kit.pivot[0], kit.pivot[1], 0);
        forkPivot.rotation.z = kit.pivot[2];
        b.add(forkPivot);
        forkPivot.add(steer);
        if (kit.steerPaint) mesh(kit.steerPaint, model.paint, steer, 0, 0, 0);
        if (kit.steerTrim) mesh(kit.steerTrim, assetMaterials.trim, steer, 0, 0, 0);
        // Wheels: the tyre first (damage3d.js hides it on a burnt wreck), then the rim.
        const addWheel = (parent, w) => {
          const wheel = new Three.Group();
          wheel.position.copy(w.at);
          parent.add(wheel);
          mesh(w.tyre || policeSwatchBox(CAR_SWATCH.black), assetMaterials.rubber, wheel, 0, 0, 0).castShadow = false;
          if (w.rim) mesh(w.rim, assetMaterials.rim, wheel, 0, 0, 0);
          return wheel;
        };
        // The front wheel hangs from the fork (it steers with it), turned back square to the bike.
        const front = addWheel(steer, kit.front);
        front.rotation.z = -kit.pivot[2];
        const rear = addWheel(b, kit.rear);
        front.userData.front = true;
        model.wheels.push({ wheel: front, side: 1, radius: kit.front.r, front: true }, { wheel: rear, side: 1, radius: kit.rear.r });
        model.rearAxleX = kit.rear.at.x;
        const head = kit.head ? mesh(kit.head, lampMaterials.headOff, steer, 0, 0, 0) : null,
          tail = kit.tail ? mesh(kit.tail, lampMaterials.tailOff, b, 0, 0, 0) : null;
        if (head) {
          head.castShadow = false;
          model.lamps.push({ mesh: head, key: 'headLeft', lit: lampMaterials.headOff, kind: 'head' });
        }
        if (tail) {
          tail.castShadow = false;
          model.lamps.push({ mesh: tail, key: 'tailLeft', lit: lampMaterials.tailOff, kind: 'tail' });
        }
        // Head and tail glow, in the [head, tail] order the halo pass expects.
        model.nightLights = [halo(b, kit.headGlow.x + 0.1 * k, kit.headGlow.y, 0, 9, '#ffe9bd'), halo(b, kit.tailGlow.x - 0.05 * k, kit.tailGlow.y, 0, 6, '#ff5a44')];
        // The rider: the anchor the vehicle pass shows and hides (riders.js throws them off).
        const rider = new Three.Group();
        rider.userData.dynamic = true;
        b.add(rider);
        const pose = kit.pose,
          M = k;
        mesh(motoRiderGeometry('asset:' + type, pose, k / CAR_M), materials.trim, rider, 0, 0, 0);
        model.rider = rider;
        model.riderSeat = {
          seat: [pose.hip[0] * M, pose.hip[1] * M, 0],
          grip: [pose.hand[0] * M + 0.4, pose.hand[1] * M - 0.2, pose.gripZ * M],
          peg: [pose.foot[0] * M, (pose.foot[1] - 0.04) * M, kit.pegZ * M],
          lean: pose.lean,
        };
        if (kit.crank) {
          const crank = new Three.Group();
          crank.position.set(kit.crank.at[0], kit.crank.at[1], 0);
          b.add(crank);
          if (kit.crank.geo) mesh(kit.crank.geo, assetMaterials.trim, crank, 0, 0, 0).castShadow = false;
          model.crank = crank;
          model.riderSeat = { seat: model.riderSeat.seat, grip: model.riderSeat.grip, crank: kit.crank.r, pedalZ: kit.crank.z, lean: pose.lean };
        }
        model.drl = null;
        model.steer = steer;
        model.bikeUpdate = (c, deltaSeconds) => animateMotorbike(c, model, deltaSeconds);
        return model;
      }
