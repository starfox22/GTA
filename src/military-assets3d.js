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
      /* The model's parts into `model` (a specialVehicle) at length `l` (design units): returns the scale k. */
      function militaryAssetBody(model, vehicle, type, l) {
        const data = vaData(),
          asset = data.header.models[type],
          k = l / (asset.hull || asset.dims[0]),
          materials = vaMaterials(),
          b = model.body,
          scale = vehicleSpec(vehicle).modelScale || 1;
        model.asset = asset.title;
        // The atlas is its paint: wear, heat and the burnt shell reach it through char materials (vehicle-char3d.js).
        model.atlasPaint = true;
        const body = vaGeometry(asset, data, militaryAssetSlices(asset, 'body'), k),
          farBody = asset.parts.bodyFar ? vaGeometry(asset, data, 'bodyFar', k) : null,
          panes = vaGeometry(asset, data, 'glass', k);
        if (body && farBody) {
          // MILITARY LOD: the full body near, the coarser one far (militaryLod switches them); both are kept out of
          // makeMilitaryVehicle's merge.
          const near = new Three.Group(),
            far = new Three.Group();
          b.add(near, far);
          mesh(body, materials.trim, near, 0, 0, 0);
          mesh(farBody, materials.trim, far, 0, 0, 0);
          far.visible = false;
          model.lod = { near, far, isFar: false };
        } else if (body) mesh(body, materials.trim, b, 0, 0, 0);
        if (panes) mesh(panes, glass, b, 0, 0, 0).castShadow = false;
        for (const key of ['headLeft', 'headRight', 'tailLeft', 'tailRight']) {
          const geo = vaGeometry(asset, data, key, k);
          if (!geo) continue;
          const lit = key.startsWith('head') ? warmLamp : tailLamp,
            lamp = mesh(geo, lit, b, 0, 0, 0);
          lamp.castShadow = false;
          model.lamps.push({ mesh: lamp, key, lit });
        }
        asset.wheels.forEach((wh, i) => {
          const geo = vaGeometry(asset, data, 'wheel' + i + '.tyre', k);
          if (!geo) return;
          const pivot = new Three.Group();
          pivot.position.set(wh.x * k, wh.y * k, wh.z * k);
          b.add(pivot);
          // The wheel is the pivot's first child (hidden on a burnt wreck, damage3d-bodies.js specialDamage).
          mesh(geo, materials.trim, pivot, 0, 0, 0).castShadow = false;
          model.wheels.push({ wheel: pivot, side: wh.side, radius: wh.r * k * scale });
        });
        return k;
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
          far = chaseViewActive && c !== player.car && chaseZoomAt(c.x, c.y) < MILITARY_LOD_ZOOM * (activeTier ? activeTier.lodBias : 1);
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
