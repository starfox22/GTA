      // Aircraft from downloaded models (assets/aircraft-models.bin, tools/aircraft_models.py): the SKYRANGER 429 civil
      // helicopter (a Bell 429) on the helicopter model contract animateHelicopter drives; acData()/acGeometry decode.
      /**
       * ASSET AIRCRAFT
       * The converter splits the model into paint (the scheme's base colour), accent (its stripe), trim and glass with
       * per-vertex colours (the source's flat-colour texture sampled), the main rotor about its mast and the tail rotor
       * about its hub, and measures what the lights and the rotor blur need (rotor centre, height and radius, tail
       * hub, stabiliser tips, fin, roof, belly). makeAssetHelicopter returns the object makeHelicopter does (rotor,
       * blades, disc, tail, tailBlades, tailDisc, glass, pilot / observer stand-ins, lights on HELI_CH channels, halos),
       * so animateHelicopter spins, blurs, banks and lights it unchanged; the Nightsun and door guns are absent.
       * Scheme colours are the paint and accent vertices' colours (one geometry per scheme sharing the positions), on a
       * white paint material, so respray wear and the burnt wreck work as on the other helicopters.
       */
      let acCache;
      function acData() {
        if (acCache !== undefined) return acCache;
        acCache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.aircraftModels;
        if (!url || url.length < 64) return null;
        try {
          const text = atob(url.slice(url.indexOf(',') + 1)),
            bytes = new Uint8Array(text.length);
          for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw new Error('aircraft models: not a model file');
          const view = new DataView(bytes.buffer),
            headerLength = view.getUint32(8, true),
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))),
            base = 12 + headerLength,
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array },
            arrays = {};
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) arrays[name] = new types[type](bytes.buffer, base + offset, count);
          acCache = { header, arrays };
        } catch (error) {
          console.error(error);
        }
        return acCache;
      }
      let acEnabled = true;
      function aircraftAssetModel(name) {
        if (!acEnabled) return null;
        const data = acData();
        return (data && data.header.models[name]) || null;
      }
      // sRGB byte to linear (vertex colours are linear, as Color.set gives the procedural kits).
      const acLinear = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const c = i / 255;
        acLinear[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      }
      /* A part in game units (vehicle-assets3d.js vaGeometry) with its vertex colours as linear floats. */
      function acGeometry(model, data, name) {
        const geo = vaGeometry(model, data, name, UNITS_PER_METRE);
        if (!geo) return null;
        const c = data.arrays[model.type + '.' + name + '.c'];
        if (c) {
          const linear = new Float32Array(c.length);
          for (let i = 0; i < c.length; i++) linear[i] = acLinear[c[i]];
          geo.setAttribute('color', new Three.BufferAttribute(linear, 3));
        }
        return geo;
      }
      // ---- The SKYRANGER 429 kit: shared geometries per airframe, the skin's colours per scheme ----
      const acHeliKits = new Map(),
        acSkins = new Map();
      function acHeliKit(name) {
        if (acHeliKits.has(name)) return acHeliKits.get(name);
        const model = aircraftAssetModel(name),
          data = acData(),
          U = UNITS_PER_METRE,
          paint = acGeometry(model, data, 'paint'),
          accent = acGeometry(model, data, 'accent'),
          skin = vaJoin([paint, accent].filter(Boolean)),
          // Which skin vertices are the accent (the stripe colour): those after the paint's.
          accentFrom = paint ? paint.attributes.position.count : 0;
        sharedGeometries.add(skin);
        // Lights: navigation lights and strobes at the stabiliser tips, the white tail light at the fin's foot, red
        // beacons on the roof and the belly, the landing light under the nose.
        const S = policeShapeKit(),
          k = { lights: policeSet(), anchors: [], S },
          [sx, sy, sz] = model.stab,
          [ex, ey] = model.end;
        for (const side of [-1, 1]) {
          const z = side * sz * U,
            navColor = side < 0 ? '#ff3a2c' : '#3dff79',
            ch = side < 0 ? HELI_CH.navRed : HELI_CH.navGreen;
          heliLens(k, ch, navColor, sx * U + 0.6, sy * U + 0.2, z, 0.5, 0.45, 0.35);
          heliLens(k, HELI_CH.strobe, '#ffffff', sx * U - 0.6, sy * U + 0.2, z, 0.42, 0.38, 0.3);
          k.anchors.push({ x: sx * U + 0.8, y: sy * U + 0.2, z: z + side * 0.3, size: 7, color: navColor, channel: ch, strength: 1 });
          k.anchors.push({ x: sx * U - 0.6, y: sy * U + 0.2, z: z + side * 0.3, size: 18, color: '#ffffff', channel: HELI_CH.strobe, strength: 1 });
        }
        const tailY = model.tail.y * U - 3;
        heliLens(k, HELI_CH.navWhite, '#fff4e0', ex * U + 0.4, tailY, 0, 0.4, 0.4, 0.3);
        k.anchors.push({ x: ex * U - 0.2, y: tailY, z: 0, size: 7, color: '#fff4e0', channel: HELI_CH.navWhite, strength: 1 });
        heliBeacon(k, model.rotor.x * U - 9, model.roof[1] * U - 1.2, 1);
        heliBeacon(k, model.belly[0] * U, model.belly[1] * U - 0.1, -1);
        const [nx, ny] = model.nose;
        heliLens(k, HELI_CH.work, '#fff6e2', nx * U - 6, ny * U - 4, 0, 0.9, 0.5, 0.9);
        k.anchors.push({ x: nx * U - 5, y: ny * U - 5, z: 0, size: 13, color: '#fff3d6', channel: HELI_CH.work, strength: 0.8 });
        const kit = {
          model,
          skin,
          accentFrom,
          trim: acGeometry(model, data, 'trim'),
          glass: acGeometry(model, data, 'glass'),
          rotor: acGeometry(model, data, 'rotor'),
          tail: acGeometry(model, data, 'tail'),
          lights: policeGeometry(k.lights, { channels: true }),
          anchors: k.anchors,
        };
        sharedGeometries.add(kit.lights);
        acHeliKits.set(name, kit);
        return kit;
      }
      /* The skin with the scheme's colours: positions, normals and triangles shared with the kit's. */
      function acSkinFor(kit, base, stripe) {
        const key = kit.model.type + ':' + base + ':' + stripe;
        if (acSkins.has(key)) return acSkins.get(key);
        const src = kit.skin,
          n = src.attributes.position.count,
          colors = new Float32Array(n * 3),
          a = heliColor.set(base).clone(),
          b = heliColor.set(stripe).clone();
        for (let i = 0; i < n; i++) {
          const c = i < kit.accentFrom ? a : b;
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }
        const geo = new Three.BufferGeometry();
        geo.setAttribute('position', src.attributes.position);
        geo.setAttribute('normal', src.attributes.normal);
        geo.setAttribute('uv', src.attributes.uv);
        geo.setAttribute('color', new Three.BufferAttribute(colors, 3));
        geo.setIndex(src.index);
        geo.boundingSphere = src.boundingSphere;
        geo.boundingBox = src.boundingBox;
        sharedGeometries.add(geo);
        acSkins.set(key, geo);
        return geo;
      }
      function makeAssetHelicopter(vehicle) {
        const look = helicopterLookFor(vehicle),
          kit = acHeliKit(look.airframe),
          model = kit.model,
          U = UNITS_PER_METRE,
          M = heliMaterials(),
          group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        group.name = look.kind + ' helicopter (' + model.title + ')';
        const finish = look.finish,
          paint = new Three.MeshPhysicalMaterial({
            color: '#ffffff',
            vertexColors: true,
            emissive: '#000000',
            roughness: finish.roughness,
            metalness: finish.metalness,
            clearcoat: finish.clearcoat,
            clearcoatRoughness: 0.07,
            envMapIntensity: 1,
          }),
          glass = heliGlassMaterial(look.glass).clone(),
          lightMaterial = heliLightMaterial(),
          quiet = (m) => {
            m.castShadow = false;
            return m;
          };
        // The model has no cabin inside: darker glass than the procedural machines' (the opacity animateHelicopter
        // sets starts from `glassOpacity`).
        glass.opacity = 0.82;
        const skin = mesh(acSkinFor(kit, look.paint || '#eef0f1', look.stripe || '#d86c00'), paint, body, 0, 0, 0),
          canopy = mesh(kit.glass, glass, body, 0, 0, 0),
          trim = mesh(kit.trim, M.trim, body, 0, 0, 0);
        canopy.receiveShadow = false;
        canopy.castShadow = false;
        const pilot = new Three.Group(),
          observer = new Three.Group();
        body.add(pilot, observer);
        pilot.visible = observer.visible = false;
        const lights = quiet(mesh(kit.lights, lightMaterial, body, 0, 0, 0));
        lights.receiveShadow = false;
        const rotor = new Three.Group();
        rotor.position.set(model.rotor.x * U, 0, 0);
        body.add(rotor);
        const blades = mesh(kit.rotor, M.blade, rotor, 0, 0, 0);
        blades.receiveShadow = false;
        const R = model.rotor.radius * U,
          discMaterial = heliDiscMaterial({ blades: 4, hub: 0.12, tip: 0.9, trail: 0.13, smear: 0.1, color: look.blade, tipColor: look.tip }),
          disc = quiet(new Three.Mesh(M.discGeometry, discMaterial));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(model.rotor.x * U, model.rotor.top * U + 0.1, 0);
        disc.scale.setScalar(R);
        disc.visible = false;
        disc.receiveShadow = false;
        body.add(disc);
        const tailMount = new Three.Group();
        tailMount.position.set(model.tail.x * U, model.tail.y * U, model.tail.z * U);
        body.add(tailMount);
        const tail = new Three.Group();
        tailMount.add(tail);
        const tailBlades = quiet(mesh(kit.tail, M.blade, tail, 0, 0, 0)),
          tailDiscMaterial = heliDiscMaterial({ blades: 4, hub: 0.14, tip: 0.86, trail: 0.2, smear: 0.14, color: look.blade, tipColor: '#d8d8d2' }),
          tailDisc = quiet(new Three.Mesh(M.discGeometry, tailDiscMaterial));
        tailDisc.scale.setScalar(model.tail.radius * U);
        tailDisc.position.z = model.tail.z < 0 ? -0.6 : 0.6;
        tailDisc.visible = false;
        tailMount.add(tailDisc);
        // helicopterSearchlightMount's anchor (no Nightsun on a civil machine: under the belly).
        const searchlightMount = new Three.Object3D();
        searchlightMount.position.set(model.belly[0] * U, model.belly[1] * U - 1, 0);
        body.add(searchlightMount);
        const halos = kit.anchors.map((a) => {
          const sprite = new Three.Sprite(heliHaloMaterial(a.color));
          sprite.position.set(a.x, a.y, a.z);
          sprite.scale.set(a.size, a.size, 1);
          sprite.visible = false;
          body.add(sprite);
          return { sprite, channel: a.channel, strength: a.strength };
        });
        return {
          group,
          body,
          paint,
          color: vehicle.color,
          strobes: [],
          dead: false,
          helicopter: true,
          heli: true,
          asset: model.type,
          realSize: true,
          look,
          rotor,
          blades,
          disc,
          tail,
          tailBlades,
          tailDisc,
          canopy,
          glass,
          glassOpacity: 0.82,
          pilot,
          observer,
          shell: null,
          nightsun: null,
          doorGuns: null,
          searchlightMount,
          lightMaterial,
          levels: lightMaterial.uniforms.levels.value,
          halos,
          rpm: -1,
          ghost: 0,
          lastSpeed: 0,
          accel: 0,
          reflective: -1,
          liveryMap: null,
          liveryColor: '#ffffff',
          finish,
          rayTargets: [skin, canopy, trim],
        };
      }
      // ---- Planes (the SKYLARK 172: a Cessna 172) ----------------------------------------------------------------
      let acSkinCache = null;
      function acSkin() {
        if (acSkinCache) return acSkinCache;
        const texture = new Three.Texture();
        texture.colorSpace = Three.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const url = typeof ASSETS !== 'undefined' && ASSETS.aircraftSkin;
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
        acSkinCache = texture;
        return texture;
      }
      const acPlaneKits = new Map();
      // A control's leading edge must span the whole part. The original pack
      // selected vertices within 3 cm of its single foremost point: dihedral
      // made the C172 aileron hinge collapse to a vertical line at the wingtip.
      // Fit at both span ends instead, and keep the neutral skin exactly where
      // the downloaded model put it. All fitting happens once per shared kit.
      function acPlaneControlHinge(model, geometry, name) {
        const position = geometry.attributes.position,
          origin = model.parts[name].origin || [0, 0, 0],
          span = name === 'rudder' ? 1 : 2,
          U = UNITS_PER_METRE,
          points = [];
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < position.count; i++) {
          const p = [position.getX(i) / U + origin[0], position.getY(i) / U + origin[1], position.getZ(i) / U + origin[2]];
          points.push(p); lo = Math.min(lo, p[span]); hi = Math.max(hi, p[span]);
        }
        if (hi - lo < 0.05) return model.hinges[name];
        const band = Math.min(0.06, (hi - lo) * 0.04),
          atEnd = (end) => {
            const edge = points.filter(p => Math.abs(p[span] - end) <= band),
              front = Math.max(...edge.map(p => p[0])),
              leading = edge.filter(p => p[0] >= front - 0.02),
              mid = [0, 0, 0];
            for (const p of leading) for (let k = 0; k < 3; k++) mid[k] += p[k] / leading.length;
            return mid;
          },
          a = atEnd(lo), b = atEnd(hi);
        geometry.translate((origin[0] - a[0]) * U, (origin[1] - a[1]) * U, (origin[2] - a[2]) * U);
        return { a, b };
      }
      function acPlaneKit(name) {
        if (acPlaneKits.has(name)) return acPlaneKits.get(name);
        const model = aircraftAssetModel(name),
          data = acData(),
          kit = { model, parts: {}, hinges: {} };
        for (const part of Object.keys(model.parts)) kit.parts[part] = acGeometry(model, data, part);
        for (const part of Object.keys(model.hinges || {})) if (kit.parts[part])
          kit.hinges[part] = acPlaneControlHinge(model, kit.parts[part], part);
        const shared = {
          cabin: new Three.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }),
          glass: new Three.MeshStandardMaterial({ color: '#28323b', roughness: 0.05, metalness: 0.5, envMapIntensity: 1.6, transparent: true, opacity: 0.42, depthWrite: false }),
          disc: new Three.MeshBasicMaterial({ color: '#1d1f22', transparent: true, opacity: 0, depthWrite: false, side: Three.DoubleSide }),
        };
        for (const m of Object.values(shared)) sharedMaterials.add(m);
        kit.materials = shared;
        acPlaneKits.set(name, kit);
        return kit;
      }
      /*
       * A flyable plane from a downloaded model on buildAircraft's contract (animateAircraft drives it): the airframe in
       * its own texture (paint and wingPaint share the skin), the control surfaces in hinge pivots (positive deflection
       * trailing edge down or right, as hingedSurface), the propeller and spinner spinning about x with a blur disc, the
       * cabin and glass, nav lights at the wingtips, the white tail light, the beacon on the fin, a landing light.
       * Fixed gear: no gear pivots, the belly never drops.
       */
      function makeAssetPlane(vehicle) {
        const kit = acPlaneKit(vehicle.airframe),
          model = kit.model,
          U = UNITS_PER_METRE,
          group = new Three.Group(),
          body = new Three.Group();
        group.add(body);
        scene.add(group);
        group.name = model.title + ' (' + vehicle.airframe + ')';
        const skin = acSkin(),
          paint = new Three.MeshStandardMaterial({ map: skin, color: '#ffffff', roughness: 0.42, metalness: 0.12, envMapIntensity: 0.9 }),
          wingPaint = new Three.MeshStandardMaterial({ map: skin, color: '#ffffff', roughness: 0.42, metalness: 0.04, envMapIntensity: 0.9 }),
          P = kit.parts,
          M = kit.materials;
        mesh(P.body, paint, body, 0, 0, 0);
        if (P.cabin) {
          const cabin = mesh(P.cabin, M.cabin, body, 0, 0, 0);
          cabin.castShadow = false;
        }
        const canopy = P.glass ? mesh(P.glass, M.glass, body, 0, 0, 0) : null;
        if (canopy) canopy.castShadow = canopy.receiveShadow = false;
        // Control surfaces about their hinge lines.
        const surfaces = { aileron: [], elevator: [], rudder: [], flap: [] },
          hingeAxis = new Three.Vector3();
        for (const [part, list, side] of [['aileronL', 'aileron', -1], ['aileronR', 'aileron', 1], ['flapL', 'flap', -1], ['flapR', 'flap', 1], ['elevatorL', 'elevator', -1], ['elevatorR', 'elevator', 1], ['rudder', 'rudder', 0]]) {
          const h = kit.hinges[part];
          if (!h || !P[part]) continue;
          const pivot = new Three.Group();
          pivot.position.set(h.a[0] * U, h.a[1] * U, h.a[2] * U);
          body.add(pivot);
          mesh(P[part], wingPaint, pivot, 0, 0, 0);
          hingeAxis.set(h.b[0] - h.a[0], h.b[1] - h.a[1], h.b[2] - h.a[2]).normalize();
          const axis = hingeAxis.clone();
          if (axis.z < -0.5 || (Math.abs(axis.z) <= 0.5 && axis.y < 0)) axis.negate();
          surfaces[list].push({ pivot, axis, angle: 0, side });
        }
        // Propeller and spinner about the crankshaft (x), the blur disc in front.
        const prop = new Three.Group(),
          [px, py, pz] = model.prop;
        prop.position.set(px * U, py * U, pz * U);
        body.add(prop);
        if (P.prop) mesh(P.prop, wingPaint, prop, 0, 0, 0);
        if (P.spinner) mesh(P.spinner, paint, prop, 0, 0, 0);
        const disc = new Three.Mesh(heliMaterials().discGeometry, M.disc.clone());
        disc.rotation.y = Math.PI / 2;
        disc.position.set(px * U + 0.3, py * U, pz * U);
        disc.scale.setScalar(model.propRadius * U);
        disc.visible = false;
        disc.castShadow = disc.receiveShadow = false;
        body.add(disc);
        // Lights (halos, as buildAircraft's: animateAircraft runs them).
        const lights = { nav: [], strobes: [], beacons: [], landing: [] },
          lens = (colour) => new Three.MeshBasicMaterial({ color: colour, toneMapped: false }),
          [wx, wy, wz] = model.wingtip;
        for (const side of [-1, 1]) {
          const colour = side < 0 ? '#ff4a3a' : '#4dff7a',
            z = side * (wz * U + 0.2);
          mesh(sphereGeo, lens(colour), body, wx * U, wy * U, z, 0.4, 0.3, 0.4).castShadow = false;
          lights.nav.push(halo(body, wx * U, wy * U, z, 8, colour));
          lights.strobes.push(halo(body, wx * U - 0.6, wy * U, z, 13, '#ffffff'));
        }
        const [tx, ty] = model.tail;
        lights.nav.push(halo(body, tx * U - 0.3, ty * U, 0, 7, '#ffffff'));
        const [fx, fy] = model.finTop;
        mesh(sphereGeo, lens('#ff3b2f'), body, fx * U, fy * U + 0.2, 0, 0.35, 0.3, 0.35).castShadow = false;
        lights.beacons.push(halo(body, fx * U, fy * U + 0.7, 0, 9, '#ff4a36'));
        lights.landing.push(halo(body, wx * U * 0.55, wy * U - 0.6, -wz * U * 0.3, 18, '#fff3d0'));
        for (const list of Object.values(lights)) for (const sprite of list) sprite.visible = false;
        return {
          body,
          paint,
          wingPaint,
          canopy,
          prop,
          disc,
          fans: [],
          wheels: [],
          gears: [],
          surfaces,
          lights,
          livery: skin,
          liveryMap: skin,
          liveryColor: '#ffffff',
          bellyDrop: 0,
          nightLights: [],
          length: model.length * U,
          group,
          strobes: [],
          special: true,
          plane: true,
          asset: model.type,
          propSpeed: 0,
        };
      }
      // Console (aircraftAssets()): the models the build carries and the kits built.
      function aircraftAssetReport() {
        const data = acData();
        if (!data) return { loaded: false };
        return {
          loaded: true,
          enabled: acEnabled,
          models: Object.values(data.header.models).map((m) => ({ name: m.type, title: m.title, kind: m.kind, triangles: m.triangles, dims: m.dims, parts: Object.fromEntries(Object.entries(m.parts).map(([k, v]) => [k, v.triangles])) })),
          kits: [...acHeliKits.keys(), ...acPlaneKits.keys()],
          skins: acSkins.size,
        };
      }
