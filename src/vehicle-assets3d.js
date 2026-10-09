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
        if (!url) return null;
        try {
          const text = atob(url.slice(url.indexOf(',') + 1)),
            bytes = new Uint8Array(text.length);
          for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw new Error('vehicle models: not a model file');
          const view = new DataView(bytes.buffer),
            headerLength = view.getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))),
            base = 12 + headerLength,
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array },
            arrays = {};
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) arrays[name] = new types[type](bytes.buffer, base + offset, count);
          vaCache = { header, arrays };
        } catch (error) {
          console.error(error);
        }
        return vaCache;
      }
      // Whether a type is drawn from its asset model.
      function vehicleAssetModel(type) {
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
        };
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
      function vaGeometry(model, data, name, k, uvAt) {
        if (Array.isArray(name)) return vaJoin(name.map((part) => vaGeometry(model, data, part, k, uvAt)).filter(Boolean));
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
          position = new Float32Array(q.length),
          normal = new Float32Array(q.length),
          uvs = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          position[i * 3] = (((q[i * 3] + 32767) / 65534) * ex + lx - o[0]) * k;
          position[i * 3 + 1] = (((q[i * 3 + 1] + 32767) / 65534) * ey + ly - o[1]) * k;
          position[i * 3 + 2] = (((q[i * 3 + 2] + 32767) / 65534) * ez + lz - o[2]) * k;
          const nx = n[i * 3] / 127,
            ny = n[i * 3 + 1] / 127,
            nz = n[i * 3 + 2] / 127,
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
        geo.setIndex(new Three.BufferAttribute(new Uint16Array(index), 1));
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
        for (const name of ['position', 'normal', 'uv']) {
          const size = list[0].attributes[name].itemSize,
            out = new Float32Array(list.reduce((n, g) => n + g.attributes[name].array.length, 0));
          let at = 0;
          for (const g of list) {
            out.set(g.attributes[name].array, at);
            at += g.attributes[name].array.length;
          }
          geo.setAttribute(name, new Three.BufferAttribute(out, size));
        }
        const index = new Uint32Array(list.reduce((n, g) => n + g.index.count, 0));
        let at = 0,
          base = 0;
        for (const g of list) {
          for (let i = 0; i < g.index.count; i++) index[at + i] = g.index.array[i] + base;
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
      function vaKit(type, l, w) {
        const key = type + ':' + l.toFixed(2) + ':' + w.toFixed(2);
        if (vaKits.has(key)) return vaKits.get(key);
        const data = vaData(),
          model = data.header.models[type],
          M = CAR_M,
          k = l / model.dims[0],
          clearUv = swatchUv(CAR_SWATCH.paint),
          paintUv = model.paintTexture ? null : clearUv,
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
            crown: 0,
            screenCurve: 0,
            backCurve: 0,
          },
          profile = model.profile,
          topY = (x) => {
            const t = clamp(((x / k - model.x0) / (model.x1 - model.x0)) * (profile.length - 1), 0, profile.length - 1),
              i = Math.min(profile.length - 2, Math.floor(t));
            return lerpNumber(profile[i], profile[i + 1], t - i) * k;
          },
          trim = vaGeometry(model, data, ['trim', 'cabin'], k),
          outer = model.parts.trim ? model.parts.trim.triangles * 3 : 0;
        const kit = {
          type,
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
          seats: carSeatPlan(g, l, w, M, type),
          badge: null,
          drl: null,
          lamps: {},
          halos: {},
          bumpers: [],
          assetWheels: [],
          door: policeSwatchBox(CAR_SWATCH.paint),
          trunk: policeSwatchBox(CAR_SWATCH.paint),
          sill: model.sill * k,
          trunkDeck: (() => {
            const tailX = -0.48 * l,
              hingeX = Math.max(g.xb * l + 0.02 * M, tailX + 0.06 * l);
            return { hingeX, hingeY: topY(hingeX), tailX, tailY: topY(tailX) };
          })(),
        };
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
          });
        });
        // Axle by axle, left then right (the order the merge plan pairs wheels in: vehicle-merge3d.js).
        kit.assetWheels.sort((a, b) => b.x - a.x || a.side - b.side);
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
          kit = vaKit(vehicle.type, l, w),
          model = kit.asset,
          materials = civSharedMaterials(),
          assetMaterials = vaMaterials(),
          lampMaterials = civLampSet(),
          group = new Three.Group(),
          bodyGroup = new Three.Group();
        group.add(bodyGroup);
        scene.add(group);
        const livery = model.paintTexture ? vaAtlas() : vaLivery(),
          finish = civFinish(vehicle.color, vehicle.id),
          paint = civPaintMaterial(model.paintTexture ? '#ffffff' : vehicle.color, livery, finish);
        const shell = mesh(kit.shell, paint, bodyGroup, 0, 0, 0),
          cabin = kit.cabin ? mesh(kit.cabin, materials.glass, bodyGroup, 0, 0, 0) : null,
          hood = mesh(kit.hood, paint, bodyGroup, 0, 0, 0),
          panels = mesh(kit.paint, paint, bodyGroup, 0, 0, 0),
          trim = kit.trim ? mesh(kit.trim, assetMaterials.trim, bodyGroup, 0, 0, 0) : null;
        // The shell, the paint panels and the trim cast the car's shadow (cars3d-interior.js CAR GLASS).
        hood.castShadow = false;
        panels.castShadow = true;
        if (cabin) cabin.castShadow = false;
        const wheels = [];
        for (const wh of kit.assetWheels) {
          const wheel = new Three.Group();
          wheel.position.set(wh.x, wh.y, wh.z);
          bodyGroup.add(wheel);
          wheels.push({ wheel, side: wh.side, front: wh.front, radius: wh.r });
          // The tyre stays the wheel's first child (hidden on a burnt wreck).
          const tyre = mesh(wh.tyre || policeSwatchBox(CAR_SWATCH.black), assetMaterials.rubber, wheel, 0, 0, 0);
          tyre.castShadow = false;
          if (wh.rim) mesh(wh.rim, assetMaterials.rim, wheel, 0, 0, 0).castShadow = false;
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
              lamps.push({ mesh: lamp, key, lit, kind });
            }
            const h = kit.halos[key] || { x: (kind === 'head' ? 0.49 : -0.49) * l, y: kit.glass.base * 0.75, z: side * w * 0.33, size: 1 };
            nightLights.push(halo(bodyGroup, h.x + (kind === 'head' ? 0.4 : -0.4), h.y, h.z, (kind === 'head' ? 11 : 7) * (h.size || 1), kind === 'head' ? '#ffe9bd' : '#ff5a44'));
          }
        const g = kit.glass;
        return {
          wipers: undefined,
          group,
          body: bodyGroup,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          car: true,
          civilian: true,
          asset: model.title,
          realSize: true,
          dims: { l, w, h: g.base, roof: g.roof, van: false, sill: kit.sill + 0.1 * CAR_M },
          shell,
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
          liveryColor: model.paintTexture ? '#ffffff' : null,
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
            { mesh: shell, material: civImpostorPaint(livery), tint: !model.paintTexture, shadow: true },
            ...(cabin ? [{ mesh: cabin, material: materials.glassFar, shadow: true }] : []),
            { mesh: hood, material: civImpostorPaint(livery), tint: !model.paintTexture },
            { mesh: panels, material: civImpostorPaint(livery), tint: !model.paintTexture },
            ...(kit.trimOuter ? [{ geometry: kit.trimOuter, material: assetMaterials.trim }] : []),
          ],
        };
      }
      // Console `assetCars()`: what the build carries and what each kit came to.
      function assetCarReport() {
        const data = vaData();
        if (!data) return { loaded: false };
        const models = {};
        for (const [type, m] of Object.entries(data.header.models))
          models[type] = { title: m.title, triangles: m.triangles, dims: m.dims, wheels: m.wheels.length, belt: m.glass.base, roof: m.glass.roof, paintTexture: m.paintTexture };
        return { loaded: true, atlas: !!vaAtlasCache?.image, models, kits: [...vaKits.keys()] };
      }
