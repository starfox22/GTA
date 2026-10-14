      // Fort Sentinel's vehicles from downloaded models (vehicle-assets3d.js ASSET CARS data, tools/vehicle_models_special.py):
      // the M4 utility (HMMWV) and the M35 cargo truck on makeMilitaryVehicle's contract (a tank model would ride makeTank's).
      /**
       * ASSET MILITARY
       * A `kind: 'special'` model is drawn at the type's design size (the builders' units; makeVehicle scales the group
       * by the type's modelScale as before), its proportions its own, scaled as a whole to the design length: the body
       * from the vehicle atlas (its camouflage, markings and canvas are its texture), the glass, four lamps the damage
       * code can put out (`model.lamps`, keys as militaryLamps'), the road wheels on pivots that roll and drop flat or
       * burnt (specialDamage) and, for the tank, the turret and gun on their own pivots (`model.turret`, `model.barrel`:
       * the frame turns the turret to `c.turretA` and recoils the gun). The gun jeep keeps its ring mount and M2
       * (mounted-guns.js fires from base3d-vehicles.js's numbers). The LAV-8, the fuel bowser and the tank stay procedural:
       * the downloaded tank (~300k triangles of small closed parts) reached a game budget only by vertex clustering,
       * which broke it apart, so the build carries no 'army_tank'; makeAssetTank stays for a model that converts cleanly.
       */
      // Which model draws each militaryModel kind (and the tank, under `tank`), when the build carries it.
      const MILITARY_ASSET_TYPES = { jeep: 'army_jeep', truck: 'army_truck' };
      function militaryAssetType(kind) {
        const type = MILITARY_ASSET_TYPES[kind],
          asset = type && vehicleAssetModel(type);
        return asset && asset.kind === 'special' ? type : null;
      }
      // A part the converter wrote in slices (16-bit indices): every slice's name, joined into one geometry by vaGeometry.
      function militaryAssetSlices(asset, name) {
        const n = asset.slices?.[name] || 1;
        return n > 1 ? Array.from({ length: n }, (_, i) => name + (i ? i : '')) : name;
      }
      const militaryAssetKits = new Map();
      // The HMMWV source uses its glass material for the lamps too. Partition its
      // existing lens triangles, preserving vertices/UVs and leaving the windows alone.
      function militaryLensParts(panes, k) {
        const groups = { glass: [], headLeft: [], headRight: [], tailLeft: [], tailRight: [] },
          p = panes.attributes.position,
          index = panes.index;
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2),
            x = (p.getX(a) + p.getX(b) + p.getX(c)) / (3 * k),
            y = (p.getY(a) + p.getY(b) + p.getY(c)) / (3 * k),
            z = p.getZ(a) + p.getZ(b) + p.getZ(c),
            key = y < 1.2 && x > 2.1 ? 'head' + (z < 0 ? 'Left' : 'Right') :
              y < 1.2 && x < -2.1 ? 'tail' + (z < 0 ? 'Left' : 'Right') : 'glass';
          groups[key].push(a, b, c);
        }
        const parts = {};
        for (const [key, indices] of Object.entries(groups)) {
          if (!indices.length) continue;
          const geo = new Three.BufferGeometry();
          for (const [name, attribute] of Object.entries(panes.attributes)) geo.setAttribute(name, attribute);
          geo.setIndex(indices);
          // BufferGeometry's default bounds include every shared vertex, including
          // the windows. Bound only this part's indices so tiny lamps can cull and
          // leave the distant chase view at their actual size; keep one shared VBO.
          const bounds = new Three.Box3(), point = new Three.Vector3();
          for (const i of indices) bounds.expandByPoint(point.fromBufferAttribute(p, i));
          geo.boundingBox = bounds;
          geo.boundingSphere = bounds.getBoundingSphere(new Three.Sphere());
          sharedGeometries.add(geo);
          parts[key] = geo;
        }
        sharedGeometries.delete(panes);
        return parts;
      }
      // Shared immutable geometry: spawning a patrol no longer decodes/retains another
      // full body and wheel set. Damage moves pivots and swaps materials, never these buffers.
      function militaryAssetKit(type, l) {
        const key = type + ':' + l;
        if (militaryAssetKits.has(key)) return militaryAssetKits.get(key);
        const data = vaData(), asset = data.header.models[type],
          k = l / (asset.hull || asset.dims[0]),
          kit = { asset, k, body: vaGeometry(asset, data, militaryAssetSlices(asset, 'body'), k),
            farBody: asset.parts.bodyFar ? vaGeometry(asset, data, 'bodyFar', k) : null,
            panes: vaGeometry(asset, data, 'glass', k), lamps: {}, wheels: [] };
        if (type === 'army_jeep' && kit.panes) {
          const parts = militaryLensParts(kit.panes, k);
          kit.panes = parts.glass || null;
          for (const name of ['headLeft', 'headRight', 'tailLeft', 'tailRight']) if (parts[name]) kit.lamps[name] = parts[name];
        }
        for (const name of ['headLeft', 'headRight', 'tailLeft', 'tailRight']) {
          const geo = vaGeometry(asset, data, name, k);
          if (geo) kit.lamps[name] = geo;
        }
        const fixed = [];
        asset.wheels.forEach((wh, i) => {
          const packed = vaGeometry(asset, data, 'wheel' + i + '.tyre', k),
            part = packed ? militaryAssetWheelPartition(packed, wh, k, type) : null,
            geo = part?.wheel;
          if (part?.fixed) fixed.push(part.fixed);
          if (geo) {
            const p = geo.attributes.position, finish = new Float32Array(p.count * 2);
            for (let v = 0; v < p.count; v++) {
              const tyre = Math.hypot(p.getX(v), p.getY(v)) > part.r * 0.68;
              finish[v * 2] = tyre ? 0.9 : 0.78;
              finish[v * 2 + 1] = tyre ? 0.02 : 0.15;
            }
            geo.setAttribute('finish', new Three.BufferAttribute(finish, 2));
          }
          kit.wheels.push(part);
        });
        if (fixed.length) {
          kit.body = vaJoin([kit.body, ...fixed].filter(Boolean));
          if (kit.farBody) kit.farBody = vaJoin([kit.farBody, ...fixed]);
        }
        militaryAssetKits.set(key, kit);
        return kit;
      }
      /* The model's parts into `model` (a specialVehicle) at length `l` (design units): returns the scale k. */
      let militaryLampMaterials = null;
      function militaryLampSet() {
        if (militaryLampMaterials) return militaryLampMaterials;
        militaryLampMaterials = {
          headOff: new Three.MeshStandardMaterial({ color: '#b9b7aa', roughness: 0.18, metalness: 0.65, envMapIntensity: 1.2 }),
          headOn: new Three.MeshBasicMaterial({ color: new Three.Color(2.6, 2.3, 1.8) }),
          tailOff: new Three.MeshStandardMaterial({ color: '#5b1410', roughness: 0.18, metalness: 0.1 }),
          tailOn: tailLamp,
          brake: brakeLamp,
        };
        sharedMaterials.add(militaryLampMaterials.headOff);
        sharedMaterials.add(militaryLampMaterials.headOn);
        sharedMaterials.add(militaryLampMaterials.tailOff);
        return militaryLampMaterials;
      }
      function militaryAssetBody(model, vehicle, type, l) {
        const kit = militaryAssetKit(type, l),
          { asset, k, body, farBody, panes } = kit,
          materials = vaMaterials(),
          b = model.body,
          scale = vehicleSpec(vehicle).modelScale || 1;
        model.asset = asset.title;
        // The atlas is its paint: wear, heat and the burnt shell reach it through char materials (vehicle-char3d.js).
        model.atlasPaint = true;
        model.militaryWheels = true;
        model.militaryLamps = !!kit.lamps.headLeft;
        if (body && farBody) {
          // MILITARY LOD: the full body near, the coarser one far (militaryLod switches them); both are kept out of
          // makeMilitaryVehicle's merge.
          const near = new Three.Group(),
            far = new Three.Group();
          b.add(near, far);
          mesh(body, materials.armyBody, near, 0, 0, 0);
          mesh(farBody, materials.armyBody, far, 0, 0, 0);
          far.visible = false;
          model.lod = { near, far, isFar: false };
        } else if (body) mesh(body, materials.armyBody, b, 0, 0, 0);
        if (panes) mesh(panes, glass, b, 0, 0, 0).castShadow = false;
        for (const key of ['headLeft', 'headRight', 'tailLeft', 'tailRight']) {
          const geo = kit.lamps[key];
          if (!geo) continue;
          const lights = militaryLampSet(),
            lit = key.startsWith('head') ? lights.headOff : lights.tailOff,
            lamp = mesh(geo, lit, b, 0, 0, 0);
          lamp.castShadow = false;
          model.lamps.push({ mesh: lamp, key, lit });
        }
        asset.wheels.forEach((wh, i) => {
          const part = kit.wheels[i], geo = part?.wheel;
          if (!geo) return;
          const pivot = new Three.Group();
          pivot.position.set(...part.at);
          b.add(pivot);
          // The wheel is the pivot's first child (hidden on a burnt wreck, damage3d-bodies.js specialDamage).
          mesh(geo, materials.armyWheel, pivot, 0, 0, 0).castShadow = false;
          model.wheels.push({ wheel: pivot, side: wh.side, front: !!wh.front, radius: part.r * scale });
        });
        return k;
      }
      // Physics owns the steer/lock/spin values. The model only poses the wheels;
      // damage squash and terrain travel remain in the same un-raked wheel frame.
      function animateMilitaryWheels(c, m, deltaSeconds) {
        const steer = -clamp(c.tyres?.steer || 0, -0.7, 0.7),
          spin = c.spinSpeed || 0,
          rearSpeed = c.speed + (spin > 1 ? spin * (c.speed < -2 ? -1 : 1) : 0);
        for (const { wheel, radius, front } of m.wheels) {
          wheel.rotation.y = front ? steer : 0;
          const lock = c.tyres?.lock?.[front ? 0 : 1] || 0;
          wheel.rotation.z -= ((front ? c.speed : rearSpeed) * (1 - lock) * deltaSeconds) / radius;
        }
      }
      function animateMilitaryLamps(c, m) {
        if (!m.militaryLamps) return;
        const lights = militaryLampSet(),
          alive = c.hp > 0 && !c.damage?.burnt,
          driven = alive && (c.ai || c === player.car || !!c.showLamps),
          on = driven && vehicleLampAmount() > 0.05,
          braking = alive && (!!c.braking || c.showLamps === 'brake');
        for (const lamp of m.lamps) {
          const broken = !alive || c.damage?.lights?.[lamp.key],
            next = broken ? deadLamp : lamp.key.startsWith('head') ? (on ? lights.headOn : lights.headOff) :
              braking ? lights.brake : on ? lights.tailOn : lights.tailOff;
          if (lamp.mesh.material !== next) lamp.mesh.material = next;
        }
      }
      /**
       * MILITARY LOD
       * A model with a far body (`bodyFar`, the converter's `far`: the M4 utility's clustered body, about a quarter of
       * its triangles) draws it in the chase view where the vehicle is small: beyond MILITARY_LOD_ZOOM of the street
       * frame (about 55 m on HIGH; the tier's lodBias moves it), never for the player's own vehicle and never in the
       * street or flight view. The levels swap by their groups' visibility (one geometry each, the same material).
       */
      const MILITARY_LOD_ZOOM = 1;
      function militaryLod(c, m) {
        const lod = m.lod,
          // A little hysteresis avoids swapping both levels repeatedly at the threshold.
          far = chaseViewActive && c !== player.car && chaseZoomAt(c.x, c.y) < MILITARY_LOD_ZOOM * (activeTier ? activeTier.lodBias : 1) * (lod.isFar ? 1.1 : 0.9);
        if (far === lod.isFar) return;
        lod.isFar = far;
        lod.near.visible = !far;
        lod.far.visible = far;
      }
      /* The tank on the downloaded model: hull, turret and gun (county3d-forest.js makeTank's contract). */
      function makeAssetTank(vehicle) {
        const model = specialVehicle(vehicle),
          data = vaData(),
          type = militaryAssetType('tank'),
          asset = data.header.models[type],
          l = designSize(vehicle).l,
          k = militaryAssetBody(model, vehicle, type, l),
          materials = vaMaterials();
        model.tank = true;
        const turret = new Three.Group(),
          barrel = new Three.Group(),
          [tx, ty, tz] = asset.turretAt || [0, asset.dims[1] * 0.6, 0];
        turret.position.set(tx * k, ty * k, tz * k);
        model.body.add(turret);
        const top = vaGeometry(asset, data, militaryAssetSlices(asset, 'turret'), k);
        if (top) mesh(top, materials.trim, turret, 0, 0, 0);
        if (asset.barrelAt) {
          const [bx, by, bz] = asset.barrelAt;
          // The frame recoils the gun by setting the group's x (render3d-frame.js): its offset ahead lies on the mesh.
          barrel.position.set(0, (by - ty) * k, (bz - tz) * k);
          const gun = vaGeometry(asset, data, 'barrel', k);
          if (gun) mesh(gun, materials.trim, barrel, (bx - tx) * k, 0, 0);
        }
        turret.add(barrel);
        model.turret = turret;
        model.barrel = barrel;
        return model;
      }
