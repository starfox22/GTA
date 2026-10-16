      // Vehicle models from downloaded assets (assets/vehicle-models.bin + vehicle-atlas.webp, tools/vehicle_models.py):
      // decoded into kits on the civilian car's damage contract and built by makeAssetCar(); the procedural body stays
      // the fallback for every type the build carries no model for.
      /**
       * ASSET CARS
       * tools/vehicle_models.py splits each ready-made model into the parts the game reads (shell and panels in the
       * car's paint, the hood on its hinge, the glasshouse as five panes in PANE_ORDER, the trim with the cabin's
       * inside last, four lamps, the wheels about their own centres) and measures what the procedural bodies give by
       * hand: the glasshouse as a CAR_BODIES `glass` record (so carSeatPlan, the cabin headroom and the drive-by seat
       * work unchanged), the sill, the hood's hinge and the top line the trunk lid lies on. The model is drawn at its
       * own proportions, scaled as a whole to the type's length (`vehicleSpec(v).l`): the collider and the handling stay
       * the type's. The paint is the car's colour on a clear livery (respray, wear, soot as before); a body whose paint
       * is its texture (the taxi) samples the atlas through the livery instead (`liveryColor` white). Console
       * `assetCars()` reports what was loaded.
       */
      let vaCache;
      /* The decoded asset ({ header, arrays }), or null when the build has none. */
      function vaData() {
        if (vaCache !== undefined) return vaCache;
        vaCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.vehicleModels;
        // No models in this build (or an emptied block: an A/B build without them): every type procedural.
        if (!url || url.length < 64) return null;
        try {
          const text = atob(url.slice(url.indexOf(',') + 1)),
            bytes = new Uint8Array(text.length);
          for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw new Error('vehicle models: not a model file');
          const view = new DataView(bytes.buffer),
            headerLength = view.getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))),
            base = 12 + headerLength,
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array },
            arrays = {};
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) arrays[name] = new types[type](bytes.buffer, base + offset, count);
          vaCache = { header, arrays };
        } catch (error) {
          console.error(error);
        }
        return vaCache;
      }
      // Whether a type is drawn from its asset model (`vaEnabled` off: every model built from now on is procedural, the
      // console's before/after switch `assetCarsOn(false)`).
      let vaEnabled = true;
      function vehicleAssetModel(type) {
        if (!vaEnabled) return null;
        if (type === 'brutini' && typeof svjVehicleModel === 'function') {
          const svj = svjVehicleModel();
          if (svj) return svj;
        }
        if (type === 'dolcati' && typeof dolcatiVehicleModel === 'function') {
          const dolcati = dolcatiVehicleModel();
          if (dolcati) return dolcati;
        }
        if (type === 'hotrod' && typeof hotrodVehicleModel === 'function') {
          const hotrod = hotrodVehicleModel();
          if (hotrod) return hotrod;
        }
        if (type === 'chevette' && typeof sportsVehicleModel === 'function') {
          const sports = sportsVehicleModel();
          if (sports) return sports;
        }
        const approvedKey = type === 'bike' ? 'm2_sport' : type === 'kr500' ? 'm1_enduro' : type === 'suv' ? 's1_jimny' : type.startsWith('s') ? type : null,
          approved = approvedKey && typeof approvedVehicleModel === 'function' ? approvedVehicleModel(approvedKey) : null;
        if (approved) return approved;
        const data = vaData();
        return (data && data.header.models[type]) || null;
      }
      let vaAtlasCache = null;
      function vaAtlas() {
        if (vaAtlasCache) return vaAtlasCache;
        const texture = new Three.Texture();
        texture.colorSpace = Three.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const url = typeof ASSETS !== 'undefined' && ASSETS.vehicleAtlas;
        if (url && typeof Image !== 'undefined') {
          const image = new Image();
          image.onload = () => {
            texture.image = image;
            texture.needsUpdate = true;
            try {
              renderer.initTexture(texture);
            } catch (error) {}
          };
          image.src = url;
        }
        vaAtlasCache = texture;
        return texture;
      }
      let vaMaterialSet = null;
      function vaMaterials() {
        if (vaMaterialSet) return vaMaterialSet;
        const atlas = vaAtlas();
        vaMaterialSet = {
          // Everything not paint, glass or lamp: one atlas, alpha-tested (number plates and badges are cut out).
          trim: new Three.MeshStandardMaterial({ map: atlas, roughness: 0.48, metalness: 0.32, envMapIntensity: 1.1, alphaTest: 0.5 }),
          rubber: new Three.MeshStandardMaterial({ map: atlas, roughness: 0.86, metalness: 0.02 }),
          rim: new Three.MeshStandardMaterial({ map: atlas, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.2 }),
          // Coated military bodywork and canvas are matte, unlike civilian chrome/trim.
          armyBody: new Three.MeshStandardMaterial({ map: atlas, roughness: 0.86, metalness: 0.04, envMapIntensity: 0.7, alphaTest: 0.5 }),
          // The packed military wheel contains both tyre and painted hub. A vertex finish
          // keeps the rubber matte without splitting every wheel into another draw call.
          armyWheel: civFinishPatch(new Three.MeshStandardMaterial({ map: atlas, roughness: 0.86, metalness: 0.04, alphaTest: 0.5 }), 'army-wheel'),
        };
        vaMaterialSet.armyBody.userData.assetAtlas = 'cut';
        vaMaterialSet.armyWheel.userData.assetAtlas = 'finish';
        for (const m of Object.values(vaMaterialSet)) sharedMaterials.add(m);
        return vaMaterialSet;
      }
      // The clear livery every plain-painted asset car shares: transparent with the swatch band (cars3d-models.js LIVERY).
      let vaLiveryCache = null;
      function vaLivery() {
        if (vaLiveryCache) return vaLiveryCache;
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const g = canvas.getContext('2d'),
          swatches = ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', '#0c0d0f', '#1b1d20', '#0c0d0f', '#b9bec3', '#1c1e21', '#eeeeea'];
        g.clearRect(0, 0, 1024, 512);
        swatches.forEach((color, i) => {
          g.fillStyle = color;
          g.fillRect((i * 1024) / 8, 512 * (1 - POLICE_SWATCH_BAND), 1024 / 8, 512 * POLICE_SWATCH_BAND);
        });
        const texture = policeCanvasTexture(canvas);
        texture.premultiplyAlpha = true;
        vaLiveryCache = texture;
        return texture;
      }
      /*
       * One part as a geometry in model units: positions from the quantised metres times `k` (units per model metre)
       * less the part's origin (a wheel's centre), normals, UVs (or every vertex on `uvAt`), lamp colours.
       */
      function vaGeometry(model, data, name, k, uvAt, rawPart = false) {
        if (Array.isArray(name)) return vaJoin(name.map((part) => vaGeometry(model, data, part, k, uvAt)).filter(Boolean));
        if (!rawPart && model.roleParts?.[name]) {
          const names = model.roleParts[name];
          if (names.length === 1) return vaGeometry(model, data, names[0], k, uvAt, true);
          return sportsRoleGeometry(model, data, name, k, uvAt);
        }
        const info = model.parts[name];
        if (!info) return null;
        const a = data.arrays,
          key = model.type + '.' + name,
          q = a[key + '.p'],
          n = a[key + '.n'],
          uv = a[key + '.uv'],
          c = a[key + '.c'],
          index = a[key + '.i'],
          [lx, ly, lz, ex, ey, ez] = model.quant,
          o = info.origin || [0, 0, 0],
          count = q.length / 3,
          normalDivisor = n.BYTES_PER_ELEMENT === 2 ? 32767 : 127,
          position = new Float32Array(q.length),
          normal = new Float32Array(q.length),
          uvs = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          position[i * 3] = (((q[i * 3] + 32767) / 65534) * ex + lx - o[0]) * k;
          position[i * 3 + 1] = (((q[i * 3 + 1] + 32767) / 65534) * ey + ly - o[1]) * k;
          position[i * 3 + 2] = (((q[i * 3 + 2] + 32767) / 65534) * ez + lz - o[2]) * k;
          const nx = n[i * 3] / normalDivisor,
            ny = n[i * 3 + 1] / normalDivisor,
            nz = n[i * 3 + 2] / normalDivisor,
            len = Math.hypot(nx, ny, nz) || 1;
          normal[i * 3] = nx / len;
          normal[i * 3 + 1] = ny / len;
          normal[i * 3 + 2] = nz / len;
          uvs[i * 2] = uvAt ? uvAt[0] : uv[i * 2] / 65535;
          uvs[i * 2 + 1] = uvAt ? uvAt[1] : uv[i * 2 + 1] / 65535;
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', new Three.BufferAttribute(position, 3));
        geo.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        geo.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
        if (c) geo.setAttribute('color', new Three.BufferAttribute(new Uint8Array(c), 3, true));
        else if (model.approved) geo.setAttribute('color', new Three.BufferAttribute(new Uint8Array(q.length).fill(255), 3, true));
        // Approved models retain authored material finish independently of their atlas UVs.
        const finish = a[key + '.f'];
        if (finish) geo.setAttribute('finish', new Three.BufferAttribute(new Uint8Array(finish), 2, true));
        const sourceUv = a[key + '.a'], atlasRect = a[key + '.t'], ormUv = a[key + '.o'];
        if (ormUv) geo.setAttribute('avOrmSourceUv', new Three.BufferAttribute(new Float32Array(ormUv), 2));
        if (sourceUv) geo.setAttribute('avSourceUv', new Three.BufferAttribute(new Float32Array(sourceUv), 2));
        if (atlasRect) geo.setAttribute('avAtlasRect', new Three.BufferAttribute(new Uint16Array(atlasRect), 4, true));
        geo.setIndex(new Three.BufferAttribute(index.BYTES_PER_ELEMENT === 4 ? new Uint32Array(index) : new Uint16Array(index), 1));
        geo.userData.vehiclePartRanges = { [name]: [[0, index.length]] };
        if (info.panes) {
          let start = 0;
          info.panes.forEach((tris, pane) => {
            geo.addGroup(start, tris * 3, pane);
            start += tris * 3;
          });
        }
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        sharedGeometries.add(geo);
        return geo;
      }
      // Parts drawn as one geometry (the trim with the cabin's inside after it): attributes and triangles in order.
      function vaJoin(list) {
        if (list.length < 2) return list[0] || null;
        const geo = new Three.BufferGeometry();
        for (const name of Object.keys(list[0].attributes)) {
          // All joined approved parts have the same layout. Legacy optional colours stay outside the trim join.
          if (!list.every(g => g.attributes[name]?.itemSize === list[0].attributes[name].itemSize)) continue;
          const size = list[0].attributes[name].itemSize,
            out = new Float32Array(list.reduce((n, g) => n + g.attributes[name].array.length, 0));
          let at = 0;
          for (const g of list) {
            const attr = g.attributes[name];
            if (attr.normalized) {
              for (let i = 0; i < attr.count; i++) for (let c = 0; c < size; c++) out[at + i * size + c] = attr.getComponent(i, c);
            } else out.set(attr.array, at);
            at += attr.array.length;
          }
          geo.setAttribute(name, new Three.BufferAttribute(out, size));
        }
        const index = new Uint32Array(list.reduce((n, g) => n + g.index.count, 0));
        let at = 0,
          base = 0;
        for (const g of list) {
          for (let i = 0; i < g.index.count; i++) index[at + i] = g.index.array[i] + base;
          if (g.userData.vehiclePartRanges) {
            const ranges = geo.userData.vehiclePartRanges ||= {};
            for (const [name, spans] of Object.entries(g.userData.vehiclePartRanges)) {
              const target = ranges[name] ||= [];
              for (const span of spans) target.push([span[0] + at, span[1]]);
            }
          }
          at += g.index.count;
          base += g.attributes.position.count;
        }
        geo.setIndex(new Three.BufferAttribute(base < 65536 ? new Uint16Array(index) : index, 1));
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        for (const g of list) sharedGeometries.delete(g);
        sharedGeometries.add(geo);
        return geo;
      }
      const vaKits = new Map();
      /*
       * A type's kit at length `l` (model units), shaped as civKit's (cars3d-kit.js) so the damage, merge, impostor,
       * blood and seat code reads it the same: shell, cabin (panes), hood, paint (panels), trim and trimOuter, lamps,
       * halos, seats, trunkDeck; `assetWheels` replaces the procedural tyre and rims.
       */
      function vaKit(type, l, w, approvedKey = null) {
        const key = (approvedKey || type) + ':' + l.toFixed(2) + ':' + w.toFixed(2);
        if (vaKits.has(key)) return vaKits.get(key);
        const sports = approvedKey === 'c8_hari', hotrod = approvedKey === 'coupe33_zhab', svj = approvedKey === 'svj_sdc',
          data = svj ? svjVehicleData() : hotrod ? hotrodVehicleData() : sports ? sportsVehicleData() : approvedKey ? approvedVehicleData() : vaData(),
          model = data.header.models[approvedKey || type],
          M = CAR_M,
          k = approvedKey ? Math.min(l / model.dims[0], w / 0.87 / model.dims[2], M) : l / model.dims[0],
          clearUv = swatchUv(CAR_SWATCH.paint),
          paintUv = approvedKey || model.paintTexture ? null : clearUv,
          gm = model.glass,
          g = {
            base: gm.base * k,
            roof: gm.roof * k,
            xf: (gm.xf * k) / l,
            xb: (gm.xb * k) / l,
            rf: (gm.rf * k) / l,
            rb: (gm.rb * k) / l,
            wb: (gm.halfBase * k) / w,
            wt: (gm.halfTop * k) / w,
            bow: 0,
            bulge: 0,
            arch: 0,
            crown: (gm.crown || 0) * k,
            screenCurve: 0,
            backCurve: 0,
            // An open car (the convertible): a windscreen and no side glass (the seats, wipers and headroom read it).
            open: !!((model.rolePanes?.glass || model.parts.glass?.panes) && !(model.rolePanes?.glass || model.parts.glass.panes)[0] && !(model.rolePanes?.glass || model.parts.glass.panes)[2]),
          },
          profile = model.profile,
          topY = (x) => {
            const t = clamp(((x / k - model.x0) / (model.x1 - model.x0)) * (profile.length - 1), 0, profile.length - 1),
              i = Math.min(profile.length - 2, Math.floor(t));
            return lerpNumber(profile[i], profile[i + 1], t - i) * k;
          },
          trim = vaGeometry(model, data, ['trim', 'cabin'], k),
          outer = (model.roleParts ? sportsRoleTriangles(model, 'trim') : model.parts.trim?.triangles || 0) * 3;
        const kit = {
          type,
          approvedKey,
          asset: model,
          l,
          k,
          glass: g,
          shell: vaGeometry(model, data, 'shell', k, paintUv),
          cabin: vaGeometry(model, data, 'glass', k, clearUv),
          hood: vaGeometry(model, data, 'hood', k, paintUv) || policeSwatchBox(CAR_SWATCH.paint),
          hoodBaseY: model.hinge[1] * k,
          hoodHinge: model.hinge[0] * k,
          paint: vaGeometry(model, data, 'panels', k, paintUv) || policeSwatchBox(CAR_SWATCH.paint),
          trim,
          trimOuter: trim ? civDrawRange(trim, outer) : null,
          opticalGlass: approvedKey ? vaGeometry(model, data, 'opticalGlass', k) : null,
          // The fit starts where real cars of this size seat the driver: 1.15 m behind the screen's foot.
          // The C8's actual cushion is ahead of the generic screen-based guess.
          // Its measured lower bound keeps the fitted actor out of the seat back.
          seats: carSeatPlan(g, l, w, M, type, sports
            ? { hipX: .035 * k / l, y: .23 * k / M, z: .464 * k / M, minY: .23 * k / M,
              wheel: [(.31392 - gm.xf) * k / M, .72501 * k / M], wheelZ: -.358883 * k / M,
              radius: .165 * k / M, tilt: .25284 }
            : { hipX: ((gm.xf - 1.15) * k) / l }),
          badge: null,
          drl: null,
          lamps: {},
          halos: {},
          bumpers: [],
          assetWheels: [],
          door: approvedKey ? approvedSuvPanelBox(model, CAR_SWATCH.paint) : policeSwatchBox(CAR_SWATCH.paint),
          trunk: approvedKey ? approvedSuvPanelBox(model, CAR_SWATCH.paint) : policeSwatchBox(CAR_SWATCH.paint),
          sill: model.sill * k,
          trunkDeck: (() => {
            const tailX = approvedKey ? model.x0 * k : -0.48 * l,
              hingeX = Math.max(g.xb * l + 0.02 * M, tailX + 0.06 * l);
            return { hingeX, hingeY: topY(hingeX), tailX, tailY: topY(tailX) };
          })(),
        };
        if (sports) kit.seats.passenger = carSeatPlan(g, l, w, M, type,
          { hipX: 0, y: .24581404 * k / M, z: .464 * k / M, minY: .24581404 * k / M });
        for (const name of ['headLeft', 'headRight', 'tailLeft', 'tailRight']) {
          kit.lamps[name] = vaGeometry(model, data, name, k);
          const h = model.lamps[name];
          if (h) kit.halos[name] = { x: h.x * k, y: h.y * k, z: h.z * k, size: clamp(h.size / 0.22, 0.6, 1.4) };
        }
        model.wheels.forEach((wh, i) => {
          kit.assetWheels.push({
            x: wh.x * k,
            y: wh.y * k,
            z: wh.z * k,
            r: wh.r * k,
            side: wh.side,
            front: wh.front,
            tyre: vaGeometry(model, data, 'wheel' + i + '.tyre', k),
            rim: vaGeometry(model, data, 'wheel' + i + '.rim', k),
            caliper: sports || svj ? vaGeometry(model, data, wh.caliper, k) : null,
          });
        });
        // Axle by axle, left then right (the order the merge plan pairs wheels in: vehicle-merge3d.js).
        kit.assetWheels.sort((a, b) => approvedKey ? Number(b.front) - Number(a.front) || a.side - b.side : b.x - a.x || a.side - b.side);
        if (approvedKey) approvedSuvFarKit(kit, model, data, k);
        if (sports) sportsNativeDoors(kit);
        if (svj) svjVehicleKitFit(kit, model, data, k);
        if (hotrod) hotrodVehicleKitFit(kit, model, data, k);
        vaKits.set(key, kit);
        return kit;
      }
      /*
       * An asset car on the damage contract (makeCivilianCar's model: render3d.js makeVehicle, damage3d.js,
       * vehicle-merge3d.js, carblood3d.js, crowd3d-driveby.js): animateCivilianCar runs it.
       */
      function makeAssetCar(vehicle) {
        const spec = vehicleSpec(vehicle),
          l = spec.l,
          w = spec.w * 0.87,
          sports = vaEnabled && vehicle.type === 'chevette' && typeof sportsVehicleModel === 'function' && sportsVehicleModel(),
          hotrod = vaEnabled && vehicle.type === 'hotrod' && typeof hotrodVehicleModel === 'function' && hotrodVehicleModel(),
          svj = vaEnabled && vehicle.type === 'brutini' && typeof svjVehicleModel === 'function' && svjVehicleModel(),
          approvedKey = svj ? 'svj_sdc' : hotrod ? 'coupe33_zhab' : sports ? 'c8_hari' : approvedSuvKey(vehicle),
          approvedModel = svj || hotrod || sports || (approvedKey && vaEnabled ? approvedVehicleModel(approvedKey) : null),
          kit = vaKit(vehicle.type, l, w, approvedModel ? approvedKey : null),
          model = kit.asset,
          materials = svj ? svjVehicleMaterials() : hotrod ? hotrodVehicleMaterials() : sports ? sportsVehicleMaterials() : kit.approvedKey ? approvedVehicleMaterials(model) : civSharedMaterials(),
          assetMaterials = kit.approvedKey ? materials : vaMaterials(),
          lampMaterials = svj ? svjVehicleLamps() : hotrod ? hotrodVehicleLamps() : sports ? sportsVehicleLamps() : civLampSet(),
          group = new Three.Group(),
          bodyGroup = new Three.Group();
        group.add(bodyGroup);
        scene.add(group);
        if (kit.approvedKey && !kit.impostorPaint) {
          kit.impostorPaint = svj ? svjVehiclePaint({ color: '#ffffff' }) : hotrod ? hotrodVehiclePaint({ color: '#ffffff' }) : sports ? sportsVehiclePaint({ color: '#ffffff' }) : approvedVehicleImpostorPaint(model);
          if (sports || hotrod || svj) sharedMaterials.add(kit.impostorPaint);
        }
        const livery = kit.approvedKey ? materials.trim.map : model.paintTexture ? vaAtlas() : vaLivery(),
          finish = civFinish(vehicle.color, vehicle.id),
          paint = svj ? svjVehiclePaint(vehicle) : hotrod ? hotrodVehiclePaint(vehicle) : sports ? sportsVehiclePaint(vehicle) : kit.approvedKey ? approvedVehiclePaint(vehicle, model) : civPaintMaterial(model.paintTexture ? '#ffffff' : vehicle.color, livery, finish);
        const shell = mesh(kit.shell, paint, bodyGroup, 0, 0, 0),
          cabin = kit.cabin ? mesh(kit.cabin, materials.glass, bodyGroup, 0, 0, 0) : null,
          hood = mesh(kit.hood, paint, bodyGroup, 0, 0, 0),
          panels = mesh(kit.paint, paint, bodyGroup, 0, 0, 0),
          trim = kit.trim ? mesh(kit.trim, assetMaterials.trim, bodyGroup, 0, 0, 0) : null;
        const approvedInterior = kit.interiorFallback ? mesh(kit.interiorFallback, approvedSuvCabinMaterial(), bodyGroup, 0, 0, 0) : null;
        if (approvedInterior) approvedInterior.castShadow = false;
        const opticalGlass = kit.opticalGlass ? mesh(kit.opticalGlass, assetMaterials.opticalGlass, bodyGroup, 0, 0, 0) : null;
        if (opticalGlass) opticalGlass.castShadow = opticalGlass.receiveShadow = false;
        // The shell, the paint panels and the trim cast the car's shadow (cars3d-interior.js CAR GLASS).
        hood.castShadow = false;
        panels.castShadow = true;
        if (cabin) cabin.castShadow = false;
        const wheels = [];
        for (const wh of kit.assetWheels) {
          const wheel = new Three.Group();
          wheel.position.set(wh.x, wh.y, wh.z);
          bodyGroup.add(wheel);
          const record = { wheel, side: wh.side, front: wh.front, radius: wh.r, caliper: null };
          wheels.push(record);
          // The tyre stays the wheel's first child (hidden on a burnt wreck).
          const tyre = mesh(wh.tyre || policeSwatchBox(CAR_SWATCH.black), assetMaterials.rubber, wheel, 0, 0, 0);
          tyre.castShadow = false;
          if (wh.rim) mesh(wh.rim, assetMaterials.rim, wheel, 0, 0, 0).castShadow = false;
          if (wh.caliper) {
            record.caliper = mesh(wh.caliper, assetMaterials.trim, wheel, 0, 0, 0);
            record.caliper.castShadow = false;
          }
        }
        const lamps = [],
          nightLights = [];
        for (const side of [-1, 1])
          for (const kind of ['head', 'tail']) {
            const key = kind + (side < 0 ? 'Left' : 'Right'),
              geo = kit.lamps[key],
              lit = kind === 'head' ? lampMaterials.headOff : lampMaterials.tailOff;
            if (geo) {
              const lamp = mesh(geo, lit, bodyGroup, 0, 0, 0);
              lamp.castShadow = false;
              lamps.push({ mesh: lamp, key, lit, kind, materials: sports || hotrod || svj ? lampMaterials : null });
            }
            const h = kit.halos[key] || { x: (kind === 'head' ? 0.49 : -0.49) * l, y: kit.glass.base * 0.75, z: side * w * 0.33, size: 1 };
            nightLights.push(halo(bodyGroup, h.x + (kind === 'head' ? 0.4 : -0.4), h.y, h.z, (kind === 'head' ? 11 : 7) * (h.size || 1), kind === 'head' ? '#ffe9bd' : '#ff5a44'));
          }
        const g = kit.glass,
          // An emergency vehicle's beacons (the ambulance): two lamps on the cab roof that flash red and blue
          // (render3d-frame.js runs `strobes` while emergencyBeacons(c)).
          strobes = [];
        // The model's own beacon lenses when it has them (`beacon` roles), split left and right; else two roof lamps.
        if (vehicle.type === 'ambulance' && model.parts.beacon && !kit.beacons) kit.beacons = vaSplitSides(vaGeometry(model, vaData(), 'beacon', kit.k));
        const beacons = vehicle.type === 'ambulance' ? kit.beacons : null;
        if (beacons) for (const geo of beacons) strobes.push(mesh(geo, new Three.MeshBasicMaterial({ color: '#cf4545' }), bodyGroup, 0, 0, 0));
        else if (vehicle.type === 'ambulance')
          for (const side of [-1, 1]) {
            const p = glassPoint(g, l, w, 'front', side * 0.5, 1);
            strobes.push(box(bodyGroup, p[0] - 0.6 * CAR_M, g.roof + g.crown + 0.12 * CAR_M, p[2], 0.35 * CAR_M, 0.2 * CAR_M, 0.45 * CAR_M, new Three.MeshBasicMaterial({ color: '#cf4545' })));
          }
        for (const s of strobes) s.castShadow = false;
        // Wipers on a truck's upright screen, at the foot of the measured windscreen (the downloaded truck, bus,
        // ambulance and pickup models have none of their own; vehicles3d.js addWipers, swept in the rain).
        const wiperHost = {};
        // The arms reach no higher than the glass (a truck's screen is lower than half its width).
        if (spec.truck && !g.open)
          addWipers(wiperHost, bodyGroup, g.xf * l + 0.3, g.base + 0.2, g.rf * l + 0.3, g.roof - 0.4, g.wb * w * 0.85, 0.92 * Math.hypot((g.rf - g.xf) * l, g.roof - g.base));
        const result = {
          wipers: wiperHost.wipers,
          group,
          body: bodyGroup,
          paint,
          color: vehicle.color,
          strobes,
          dead: false,
          car: true,
          civilian: true,
          asset: model.title,
          realSize: true,
          dims: { l, w, h: g.base, roof: g.roof, van: false, sill: kit.sill + 0.1 * CAR_M,
            ...(hotrod ? { door: model.doorSpan.map(value => value * kit.k) } : {}) },
          shell,
          assetTrim: trim,
          approvedInterior,
          opticalGlass,
          shellBase: shell.geometry.attributes.position.array,
          kit,
          panels,
          cabin,
          cabinBase: cabin ? cabin.geometry.attributes.position.array : null,
          wheels,
          bumpers: [],
          bumperOrigins: [],
          hood,
          hoodBaseY: kit.hoodBaseY,
          hoodHinge: kit.hoodHinge,
          lamps,
          damageVersion: -1,
          nightLights,
          rearDoors: null,
          drl: null,
          extra: null,
          liveryMap: livery,
          liveryColor: !kit.approvedKey && model.paintTexture ? '#ffffff' : null,
          finish,
          bumperMaterial: null,
          bumperMaterials: [],
          glass: materials.glass,
          panelGeometry: kit.door,
          trunkGeometry: kit.trunk,
          trunkDeck: kit.trunkDeck,
          seats: kit.seats,
          seated: 0,
          dirt: paint.userData.carDirt,
          dirtBase: 0.12 + (((vehicle.id * 2654435761) % 1000) / 1000) * 0.36,
          impostorParts: [
            { mesh: shell, geometry: kit.far?.shell, material: kit.approvedKey ? kit.impostorPaint : civImpostorPaint(livery), tint: !!kit.approvedKey || !model.paintTexture, shadow: true },
            ...(cabin ? [{ mesh: cabin, geometry: kit.far?.cabin, material: materials.glassFar, shadow: true }] : []),
            { mesh: hood, geometry: kit.far?.hood, material: kit.approvedKey ? kit.impostorPaint : civImpostorPaint(livery), tint: !!kit.approvedKey || !model.paintTexture },
            { mesh: panels, geometry: kit.far?.paint, material: kit.approvedKey ? kit.impostorPaint : civImpostorPaint(livery), tint: !!kit.approvedKey || !model.paintTexture },
            ...(kit.trimOuter ? [{ geometry: kit.far?.trimOuter || kit.trimOuter, material: assetMaterials.trim }] : []),
            ...(opticalGlass ? [{ mesh: opticalGlass, geometry: kit.far?.opticalGlass || kit.opticalGlass, material: assetMaterials.opticalGlass }] : []),
          ],
        };
        if (kit.approvedKey) approvedSuvLodParts(result);
        return result;
      }
      // A geometry's triangles on the left (z < 0) and on the right, as two geometries (an ambulance's two beacon halves).
      function vaSplitSides(geo) {
        const pos = geo.attributes.position,
          index = geo.index.array,
          sides = [[], []];
        for (let t = 0; t < index.length; t += 3) {
          const z = pos.getZ(index[t]) + pos.getZ(index[t + 1]) + pos.getZ(index[t + 2]);
          sides[z < 0 ? 0 : 1].push(index[t], index[t + 1], index[t + 2]);
        }
        return sides.map((list) => {
          const half = geo.clone();
          half.setIndex(list);
          half.computeBoundingSphere();
          sharedGeometries.add(half);
          return half;
        });
      }
      // Console `assetCars()`: what the build carries and what each kit came to.
      function assetCarReport() {
        const data = vaData();
        if (!data) return { loaded: false };
        const models = {}, effective = { ...data.header.models }, approved = approvedVehicleData();
        if (vaEnabled && approved) {
          if (approved.header.models.m2_sport) effective.bike = approved.header.models.m2_sport;
          if (approved.header.models.m1_enduro) effective.kr500 = approved.header.models.m1_enduro;
          for (const key of APPROVED_SUV_KEYS) if (approved.header.models[key]) effective[key] = approved.header.models[key];
        }
        const sports = typeof sportsVehicleModel === 'function' && sportsVehicleModel();
        if (vaEnabled && sports) effective.chevette = sports;
        const hotrod = typeof hotrodVehicleModel === 'function' && hotrodVehicleModel();
        if (vaEnabled && hotrod) effective.hotrod = hotrod;
        const svj = typeof svjVehicleModel === 'function' && svjVehicleModel();
        if (vaEnabled && svj) effective.brutini = svj;
        const dolcati = typeof dolcatiVehicleModel === 'function' && dolcatiVehicleModel();
        if (vaEnabled && dolcati) effective.dolcati = dolcati;
        for (const [type, m] of Object.entries(effective))
          models[type] = { title: m.title, sourceKey: m.type, kind: m.kind || 'car', triangles: m.triangles, farTriangles: m.farTriangles || null, dims: m.dims, wheels: m.wheels.length, belt: m.glass?.base ?? null, roof: m.glass?.roof ?? null, paintTexture: m.paintTexture };
        return { loaded: true, enabled: vaEnabled, atlas: !!vaAtlasCache?.image, approvedAtlas: !!approvedVehicleTextures[0]?.image, rangerStyles: vaEnabled && approved ? APPROVED_SUV_KEYS : [], models, kits: [...vaKits.keys()] };
      }
