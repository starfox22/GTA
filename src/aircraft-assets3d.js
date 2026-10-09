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
      // Console (aircraftAssets()): the models the build carries and the kits built.
      function aircraftAssetReport() {
        const data = acData();
        if (!data) return { loaded: false };
        return {
          loaded: true,
          enabled: acEnabled,
          models: Object.values(data.header.models).map((m) => ({ name: m.type, title: m.title, kind: m.kind, triangles: m.triangles, dims: m.dims, parts: Object.fromEntries(Object.entries(m.parts).map(([k, v]) => [k, v.triangles])) })),
          kits: [...acHeliKits.keys()],
          skins: acSkins.size,
        };
      }
