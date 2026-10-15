      // Downloaded Citation / Boeing 737. All helpers are declarations because
      // parkedJet() builds scenery before this include's position is reached.
      // Caches live on helpers; early scenery construction must not touch later
      // lexical caches or shared-resource Sets before their initialization.
      function jetAssetData() {
        if (jetAssetData.cache !== undefined) return jetAssetData.cache;
        jetAssetData.cache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.jetModels;
        if (!url || url.length < 64) return null;
        try {
          const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECVM001') throw new Error('jets: invalid asset pack');
          const view = new DataView(bytes.buffer), length = view.getUint32(8, true), base = 12 + length,
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, base))), arrays = {},
            types = { f4: Float32Array, i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array, u4: Uint32Array };
          for (const [name, [type, offset, count]] of Object.entries(header.arrays)) {
            const Type = types[type];
            if (!Type || offset < 0 || count < 0 || base + offset + count * Type.BYTES_PER_ELEMENT > bytes.length)
              throw new Error('jets: invalid array ' + name);
            arrays[name] = new Type(bytes.buffer, base + offset, count);
          }
          jetAssetData.cache = { header, arrays };
        } catch (error) { console.error(error); }
        return jetAssetData.cache;
      }
      function jetAssetModel(name) {
        return jetAssetData()?.header.models[name] || null;
      }
      function jetAssetGeometry(model, name) {
        const data = jetAssetData(), info = model.parts[name];
        if (!info) return null;
        const key = model.type + '.' + name, a = data.arrays,
          p = a[key + '.p'], n = a[key + '.n'], uv = a[key + '.uv'], index = a[key + '.i'], c = a[key + '.c'],
          origin = info.origin || [0, 0, 0], quant = model.quant,
          position = new Float32Array(p.length), normal = new Float32Array(n.length), uvs = new Float32Array(uv.length);
        for (let i = 0; i < p.length / 3; i++) {
          for (let axis = 0; axis < 3; axis++) position[i * 3 + axis] = (((p[i * 3 + axis] + 32767) / 65534) * quant[axis + 3] + quant[axis] - origin[axis]) * UNITS_PER_METRE;
          const x = n[i * 3] / 32767, y = n[i * 3 + 1] / 32767, z = n[i * 3 + 2] / 32767,
            length = Math.hypot(x, y, z);
          if (!length) throw new Error('jets: missing source normal');
          normal[i * 3] = x / length; normal[i * 3 + 1] = y / length; normal[i * 3 + 2] = z / length;
          const uvDivisor = uv.BYTES_PER_ELEMENT === 4 ? 1 : 65535;
          uvs[i * 2] = uv[i * 2] / uvDivisor; uvs[i * 2 + 1] = uv[i * 2 + 1] / uvDivisor;
        }
        const geometry = new Three.BufferGeometry();
        geometry.setAttribute('position', new Three.BufferAttribute(position, 3));
        geometry.setAttribute('normal', new Three.BufferAttribute(normal, 3));
        geometry.setAttribute('uv', new Three.BufferAttribute(uvs, 2));
        if (c) {
          const linear = new Float32Array(c.length);
          for (let i = 0; i < c.length; i++) {
            const v = c[i] / 255;
            linear[i] = v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
          }
          geometry.setAttribute('color', new Three.BufferAttribute(linear, 3));
        }
        geometry.setIndex(new Three.BufferAttribute(index.BYTES_PER_ELEMENT === 4 ? new Uint32Array(index) : new Uint16Array(index), 1));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        return geometry;
      }
      function jetAssetSkin() {
        if (jetAssetSkin.cache) return jetAssetSkin.cache;
        const texture = new Three.Texture();
        texture.colorSpace = Three.SRGBColorSpace; texture.flipY = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const url = typeof ASSETS !== 'undefined' && ASSETS.jetSkin;
        if (url && typeof Image !== 'undefined') {
          const image = new Image();
          image.onload = () => {
            texture.image = image; texture.needsUpdate = true;
            try { renderer.initTexture(texture); } catch (error) {}
          };
          image.src = url;
        }
        jetAssetSkin.cache = texture;
        return texture;
      }
      function jetAssetKit(name) {
        const cache = jetAssetKit.cache ||= new Map();
        if (cache.has(name)) return cache.get(name);
        const model = jetAssetModel(name);
        if (!model) return null;
        const parts = {}, materials = {};
        for (const part of Object.keys(model.parts)) parts[part] = jetAssetGeometry(model, part);
        if (name === 'airliner') {
          materials.body = new Three.MeshStandardMaterial({ vertexColors: true, roughness: .46, metalness: .08, side: Three.DoubleSide });
          materials.trim = new Three.MeshStandardMaterial({ vertexColors: true, roughness: .56, metalness: .35, side: Three.DoubleSide });
          materials.cabin = new Three.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: .02, side: Three.DoubleSide });
          materials.glass = new Three.MeshStandardMaterial({ vertexColors: true, roughness: .14, metalness: .3, transparent: true, opacity: .72, depthWrite: false, side: Three.DoubleSide });
          materials.glass.forceSinglePass = true;
        }
        const kit = { model, parts, materials };
        cache.set(name, kit);
        return kit;
      }
      function jetAssetShareKit(kit) {
        // Flying aircraft build after resource initialization. Static aircraft
        // are found by collectResources(scene) along with both of their LODs.
        for (const geo of Object.values(kit.parts)) sharedGeometries.add(geo);
        for (const material of Object.values(kit.materials)) sharedMaterials.add(material);
      }
      function jetAssetMesh(geometry, material, parent, name) {
        const object = new Three.Mesh(geometry, material);
        object.name = name; object.castShadow = true; object.receiveShadow = true;
        parent.add(object);
        return object;
      }
      function jetStaticLodUpdate(camera) {
        this.levels[1].distance = 760 / (activeTier?.lodBias || 1);
        Three.LOD.prototype.update.call(this, camera);
      }
      function makeParkedAssetJet(kind, parent) {
        const kit = jetAssetKit(kind);
        if (!kit || kind !== 'airliner') return null;
        const lod = new Three.LOD();
        lod.name = 'downloaded Boeing 737';
        // These meshes remain shared and live through the static batcher and
        // flight-camera detail tagging; Three.LOD selects the actual draw.
        lod.userData.dynamic = true;
        lod.update = jetStaticLodUpdate;
        const near = new Three.Group(), far = new Three.Group();
        for (const [name, material] of Object.entries(kit.materials)) {
          const close = kit.parts[name], distant = kit.parts[name + 'Far'];
          if (close) {
            const object = jetAssetMesh(close, material, near, name + ' near');
            if (name === 'glass' || name === 'cabin') object.castShadow = false;
          }
          if (distant) {
            const object = jetAssetMesh(distant, material, far, name + ' far');
            if (name === 'glass') object.castShadow = false;
          }
        }
        lod.addLevel(near, 0); lod.addLevel(far, 760);
        parent.add(lod);
        return { group: lod, model: kit.model };
      }
      function makeAssetJetPlane(vehicle) {
        const kit = jetAssetKit('jet'), model = kit.model, U = UNITS_PER_METRE;
        jetAssetShareKit(kit);
        const group = new Three.Group(), body = new Three.Group(), skin = jetAssetSkin(),
          paint = new Three.MeshStandardMaterial({ map: skin, color: '#ffffff', roughness: .46, metalness: .08, envMapIntensity: .9, side: Three.DoubleSide }),
          wingPaint = new Three.MeshStandardMaterial({ map: skin, color: '#ffffff', roughness: .46, metalness: .04, envMapIntensity: .9, side: Three.DoubleSide }),
          surfaces = { aileron: [], flap: [], elevator: [], rudder: [] }, gears = [], jetLodParts = [], rayTargets = [],
          attach = (name, material, parent) => {
            const near = kit.parts[name], far = kit.parts[name + 'Far'];
            if (!near) return null;
            const object = jetAssetMesh(near, material, parent, name);
            rayTargets.push(object);
            if (far) jetLodParts.push({ mesh: object, near, far });
            return object;
          };
        group.add(body); scene.add(group);
        group.name = 'Aurelia J8 (' + model.title + ')';
        attach('body', paint, body);
        for (const [name, hinge] of Object.entries(model.hinges)) {
          const pivot = new Three.Group(), axis = new Three.Vector3(hinge.b[0] - hinge.a[0], hinge.b[1] - hinge.a[1], hinge.b[2] - hinge.a[2]).normalize();
          pivot.name = name + ' adapted hinge';
          pivot.position.set(hinge.a[0] * U, hinge.a[1] * U, hinge.a[2] * U);
          body.add(pivot); attach(name, wingPaint, pivot);
          if (axis.z < -.5 || (Math.abs(axis.z) <= .5 && axis.y < 0)) axis.negate();
          const list = name.startsWith('aileron') ? 'aileron' : name.startsWith('flap') ? 'flap' : name.startsWith('elevator') ? 'elevator' : 'rudder';
          surfaces[list].push({ pivot, axis, angle: 0, side: name.endsWith('L') ? -1 : name.endsWith('R') ? 1 : 0 });
        }
        for (const [name, gear] of Object.entries(model.gears)) {
          const pivot = new Three.Group();
          pivot.name = name + ' adapted retraction';
          pivot.position.set(gear.origin[0] * U, gear.origin[1] * U, gear.origin[2] * U);
          body.add(pivot); attach(name, wingPaint, pivot);
          gears.push({ pivot, side: gear.side, retract: gear.retract });
        }
        const lights = { nav: [], strobes: [], beacons: [], landing: [] }, [wx, wy, wz] = model.wingtip;
        for (const side of [-1, 1]) {
          const colour = side < 0 ? '#ff4a3a' : '#4dff7a', z = side * wz * U;
          lights.nav.push(halo(body, wx * U, wy * U, z, 8, colour));
          lights.strobes.push(halo(body, wx * U, wy * U, z, 14, '#ffffff'));
        }
        lights.nav.push(halo(body, model.tail[0] * U, model.tail[1] * U, 0, 7, '#ffffff'));
        lights.beacons.push(halo(body, model.finTop[0] * U, model.finTop[1] * U + .4, 0, 9, '#ff4a36'));
        lights.landing.push(halo(body, model.gears.gearN.origin[0] * U, model.gears.gearN.origin[1] * U, 0, 16, '#fff3d0'));
        for (const list of Object.values(lights)) for (const sprite of list) sprite.visible = false;
        return { group, body, paint, wingPaint, canopy: null, prop: null, disc: null, fans: [], wheels: [], gears,
          surfaces, lights, livery: skin, liveryMap: skin, liveryColor: '#ffffff', bellyDrop: .9 * U, nightLights: [],
          length: model.length * U, strobes: [], special: true, plane: true, asset: 'jet', propSpeed: 0,
          jetLodParts, jetLodFar: false, rayTargets };
      }
      function jetAssetPlaneLod(vehicle, model) {
        if (!model.jetLodParts) return;
        const dx = vehicle.x - player.x, dy = vehicle.y - player.y,
          reach = 320 / (activeTier?.lodBias || 1),
          far = vehicle !== player.car && dx * dx + dy * dy > reach * reach * (model.jetLodFar ? .81 : 1.21);
        if (far === model.jetLodFar) return;
        model.jetLodFar = far;
        for (let i = 0; i < model.jetLodParts.length; i++) {
          const part = model.jetLodParts[i];
          part.mesh.geometry = far ? part.far : part.near;
        }
      }
      function jetAssetReport() {
        const data = jetAssetData();
        return { loaded: !!data,
          models: data ? Object.values(data.header.models).map(model => ({ name: model.type, title: model.title,
            nearTriangles: model.triangles, farTriangles: model.farTriangles, dims: model.dims,
            parts: model.parts, source: model.source, rigMethod: model.rigMethod || 'Static source geometry',
            nativeTexture: model.nativeTexture || null, cabin: model.cabin })) : [],
          kits: jetAssetKit.cache ? [...jetAssetKit.cache.keys()] : [] };
      }
