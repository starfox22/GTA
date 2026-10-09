      // Boats from downloaded models (vehicle-assets3d.js ASSET CARS data, tools/vehicle_models_boat.py): the hull and its
      // fittings from the vehicle atlas, the see-through panes, a mast lamp, on the boat contract (vehicles3d.js makeBoat).
      /**
       * ASSET BOATS
       * A boat type the build carries a `kind: 'boat'` model for is drawn from it: the model at its own proportions,
       * scaled as a whole to the type's length, the waterline at y 0 (the converter's `waterline`); the collider, the
       * handling, the wakes (wakes3d.js, from the type's size) and the planing pitch (`boatDynamics`) stay the type's.
       * Three draws: the body (atlas, alpha-tested), the glass, the mast lamp.
       */
      // Types whose downloaded model is not drawn (not an upgrade over the procedural boat).
      const ASSET_BOATS_HELD = new Set(['workboat']);
      function makeAssetBoat(vehicle) {
        const model = specialVehicle(vehicle),
          b = model.body,
          data = vaData(),
          asset = data.header.models[vehicle.type],
          k = vehicleSpec(vehicle).l / asset.dims[0],
          materials = vaMaterials();
        model.boat = true;
        model.asset = asset.title;
        const body = vaGeometry(asset, data, 'body', k),
          glass = vaGeometry(asset, data, 'glass', k);
        if (body) mesh(body, materials.trim, b, 0, 0, 0);
        if (glass) mesh(glass, boatScreenGlass, b, 0, 0, 0).castShadow = false;
        // The mast lamp at the highest point.
        const [mx, my, mz] = asset.mast;
        box(b, mx * k, my * k - 0.3, mz * k, 0.8, 0.8, 0.8, warmLamp).castShadow = false;
        boatDynamics(model, 0.04);
        return model;
      }
