      // Downloaded Andrew Swihart CC-BY-4.0 AH-64: isolated exact-source geometry, shared Far kit and exact BVH rays.
      function apacheAssetData() {
        if (apacheAssetData.cache !== undefined) return apacheAssetData.cache;
        apacheAssetData.cache = null;
        const url = typeof ASSETS !== 'undefined' && ASSETS.apacheModel;
        if (!url) return null;
        try {
          const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          if (String.fromCharCode(...bytes.subarray(0, 8)) !== 'DECAP001') throw new Error('Apache: invalid source pack');
          const length = new DataView(bytes.buffer).getUint32(8, true), base = 12 + length,
            header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, base))), arrays = {},
            types = { f4: Float32Array, u1: Uint8Array, u4: Uint32Array };
          for (const [name, [kind, offset, count]] of Object.entries(header.arrays)) {
            const Type = types[kind];
            if (!Type || offset < 0 || count < 0 || base + offset + count * Type.BYTES_PER_ELEMENT > bytes.length)
              throw new Error('Apache: invalid array ' + name);
            arrays[name] = new Type(bytes.buffer, base + offset, count);
          }
          apacheAssetData.cache = { header, arrays };
        } catch (error) { console.error(error); }
        return apacheAssetData.cache;
      }
      function apacheAssetGeometry(name) {
        const data = apacheAssetData(), a = data.arrays, key = name + '.', info = data.header.parts[name],
          indices = a[key + 'm'], colors = new Float32Array(indices.length * 3), finish = new Float32Array(indices.length * 2);
        for (let i = 0; i < indices.length; i++) {
          const pbr = data.header.materials[indices[i]].pbrMetallicRoughness;
          colors.set(pbr.baseColorFactor.slice(0, 3), i * 3);
          finish[i * 2] = pbr.roughnessFactor; finish[i * 2 + 1] = pbr.metallicFactor;
        }
        const geometry = new Three.BufferGeometry(), position = new Float32Array(a[key + 'p'].length);
        for (let i = 0; i < position.length; i++) position[i] = a[key + 'p'][i] * UNITS_PER_METRE;
        geometry.setAttribute('position', new Three.BufferAttribute(position, 3));
        geometry.setAttribute('normal', new Three.BufferAttribute(a[key + 'n'], 3));
        geometry.setAttribute('uv', new Three.BufferAttribute(a[key + 'uv'], 2));
        geometry.setAttribute('color', new Three.BufferAttribute(colors, 3));
        geometry.setAttribute('apacheFinish', new Three.BufferAttribute(finish, 2));
        geometry.setAttribute('apacheSlot', new Three.BufferAttribute(a[key + 's'], 1));
        geometry.setIndex(new Three.BufferAttribute(a[key + 'i'], 1));
        geometry.userData.apacheBVH = { bounds: a[key + 'bounds'], nodes: a[key + 'nodes'], units: UNITS_PER_METRE };
        geometry.userData.apachePart = name;
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        return geometry;
      }
      function apacheSourceMaterial(beacon = false) {
        const state = { spent: { value: new Three.Vector2() }, wear: { value: new Three.Vector2() } },
          material = new Three.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, metalness: 1,
            side: Three.DoubleSide, transparent: beacon, opacity: beacon ? .033228556315104164 : 1, depthWrite: !beacon });
        material.forceSinglePass = true;
        material.userData.apacheSource = state;
        material.onBeforeCompile = shader => {
          if (typeof cityMaterialPatch === 'function') cityMaterialPatch(shader);
          shader.uniforms.uApacheSpent = state.spent;
          shader.uniforms.uApacheWear = state.wear;
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 apacheFinish; attribute float apacheSlot; varying vec2 vApacheFinish; varying float vApacheSlot;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvApacheFinish=apacheFinish; vApacheSlot=apacheSlot;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec2 uApacheSpent,uApacheWear; varying vec2 vApacheFinish; varying float vApacheSlot;')
            .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(vApacheSlot<12.0 && (vApacheSlot<8.0 ? vApacheSlot<uApacheSpent.x : vApacheSlot<8.0+uApacheSpent.y)) discard;')
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(min(1.0,vApacheFinish.x+uApacheWear.x*.35),.97,uApacheWear.y);')
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=mix(vApacheFinish.y*(1.0-uApacheWear.x*.4),.12,uApacheWear.y);');
        };
        material.customProgramCacheKey = () => 'apache-source-pbr-v1';
        return material;
      }
      function apacheAssetKit() {
        if (apacheAssetKit.cache) return apacheAssetKit.cache;
        const data = apacheAssetData();
        if (!data) return null;
        const parts = {};
        for (const name of Object.keys(data.header.parts)) {
          parts[name] = apacheAssetGeometry(name); sharedGeometries.add(parts[name]);
        }
        const shadow = new Three.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: Three.DoubleSide }),
          disc = new Three.MeshBasicMaterial({ color: '#777c75', transparent: true, opacity: .09, side: Three.DoubleSide, depthWrite: false }),
          discGeometry = new Three.CircleGeometry(data.header.rotorRadius * UNITS_PER_METRE, 48);
        discGeometry.rotateX(-Math.PI / 2);
        sharedMaterials.add(shadow); sharedMaterials.add(disc); sharedGeometries.add(discGeometry);
        apacheAssetKit.cache = { model: data.header, parts, shadow, disc, discGeometry };
        return apacheAssetKit.cache;
      }
      // Offline median tree, exact original triangles. Shared scratch is safe: raycast is synchronous.
      const apacheRay = new Three.Ray(), apacheInverse = new Three.Matrix4(), apacheBox = new Three.Box3(),
        apacheA = new Three.Vector3(), apacheB = new Three.Vector3(), apacheC = new Three.Vector3(),
        apacheHit = new Three.Vector3(), apacheWorldHit = new Three.Vector3(), apacheBary = new Three.Vector3(),
        apacheStack = [];
      function apacheAssetRaycast(raycaster, intersections) {
        const geometry = this.geometry, tree = geometry.userData.apacheBVH;
        if (!tree || !this.visible) return;
        apacheInverse.copy(this.matrixWorld).invert(); apacheRay.copy(raycaster.ray).applyMatrix4(apacheInverse);
        const p = geometry.attributes.position, uv = geometry.attributes.uv, slot = geometry.attributes.apacheSlot,
          index = geometry.index, bounds = tree.bounds, nodes = tree.nodes, U = tree.units,
          spent = this.material.userData.apacheSource?.spent.value;
        apacheStack.length = 0; apacheStack.push(0);
        while (apacheStack.length) {
          const node = apacheStack.pop(), b = node * 6, n = node * 4;
          apacheBox.min.set(bounds[b] * U, bounds[b + 1] * U, bounds[b + 2] * U);
          apacheBox.max.set(bounds[b + 3] * U, bounds[b + 4] * U, bounds[b + 5] * U);
          // Float32 storage and world-unit scaling can round outward by a few ulps.
          apacheBox.expandByScalar(.0001);
          if (!apacheRay.intersectsBox(apacheBox)) continue;
          if (!nodes[n + 1]) { apacheStack.push(nodes[n + 2], nodes[n + 3]); continue; }
          for (let k = nodes[n]; k < nodes[n] + nodes[n + 1]; k++) {
            const at = k * 3, ia = index.getX(at), ib = index.getX(at + 1), ic = index.getX(at + 2), s = slot.getX(ia);
            if (spent && s < 12 && (s < 8 ? s < spent.x : s < 8 + spent.y)) continue;
            apacheA.fromBufferAttribute(p, ia); apacheB.fromBufferAttribute(p, ib); apacheC.fromBufferAttribute(p, ic);
            if (!apacheRay.intersectTriangle(apacheA, apacheB, apacheC, false, apacheHit)) continue;
            apacheWorldHit.copy(apacheHit).applyMatrix4(this.matrixWorld);
            const distance = raycaster.ray.origin.distanceTo(apacheWorldHit);
            if (distance < raycaster.near || distance > raycaster.far) continue;
            const hit = { distance, point: apacheWorldHit.clone(), object: this, faceIndex: k,
              face: { a: ia, b: ib, c: ic, normal: Three.Triangle.getNormal(apacheA, apacheB, apacheC, new Three.Vector3()), materialIndex: 0 } };
            if (uv) {
              Three.Triangle.getBarycoord(apacheHit, apacheA, apacheB, apacheC, apacheBary);
              hit.uv = new Three.Vector2(uv.getX(ia) * apacheBary.x + uv.getX(ib) * apacheBary.y + uv.getX(ic) * apacheBary.z,
                uv.getY(ia) * apacheBary.x + uv.getY(ib) * apacheBary.y + uv.getY(ic) * apacheBary.z);
            }
            intersections.push(hit);
          }
        }
      }
      function apacheAssetMesh(kit, name, material, parent, lodParts) {
        const mesh = new Three.Mesh(kit.parts[name], material);
        mesh.name = 'downloaded Apache ' + name; mesh.receiveShadow = true; mesh.castShadow = false;
        mesh.raycast = apacheAssetRaycast;
        parent.add(mesh); lodParts.push({ mesh, name }); return mesh;
      }
      function apacheAssetLod(c, m) {
        const distance = Math.hypot(c.x - player.x, c.y - player.y),
          far = c !== player.car && distance > (m.apacheLodFar ? 570 : 650) / (activeTier?.lodBias || 1);
        if (far === m.apacheLodFar) return;
        m.apacheLodFar = far;
        for (const { mesh, name } of m.apacheLodParts) mesh.geometry = m.apacheKit.parts[name + (far ? 'Far' : '')];
      }
      function makeDownloadedApache(vehicle) {
        const kit = apacheAssetKit();
        if (!kit) return null;
        const group = new Three.Group(), body = new Three.Group(), lodParts = [],
          paint = apacheSourceMaterial(), beacon = apacheSourceMaterial(true),
          add = (name, parent = body) => apacheAssetMesh(kit, name, name === 'beacon' ? beacon : paint, parent, lodParts),
          place = (group, name) => group.position.fromArray(kit.model.origins[name]).multiplyScalar(UNITS_PER_METRE);
        group.name = 'AH-64 Helicopter / Andrew Swihart / CC BY 4.0';
        group.add(body); scene.add(group);
        add('body'); add('beacon');
        const carrier = new Three.Group(), rotor = new Three.Group();
        place(carrier, 'rotor'); carrier.rotation.z = kit.model.rotorTilt;
        body.add(carrier); carrier.add(rotor); add('rotor', rotor);
        const disc = new Three.Mesh(kit.discGeometry, kit.disc);
        disc.name = 'Apache rotor blur'; disc.raycast = () => {}; carrier.add(disc); disc.visible = false;
        const tail = new Three.Group(); place(tail, 'tail'); body.add(tail); add('tail', tail);
        const gunYaw = new Three.Group(), gunPitch = new Three.Group(), barrel = new Three.Group();
        place(gunYaw, 'gun'); body.add(gunYaw); gunYaw.add(gunPitch); gunPitch.add(barrel);
        add('gun', gunPitch); add('barrel', barrel); add('payload');
        const shadow = new Three.Mesh(kit.parts.shadow, kit.shadow);
        shadow.name = 'Apache bounded source-derived shadow'; shadow.castShadow = true;
        shadow.raycast = () => {}; body.add(shadow);
        // Source lenses remain in their original geometry. Small pooled halos make
        // the existing navigation/beacon states legible without new point lights.
        const lights = { nav: [halo(body, 22, 14, -22, 5, '#ff4a3a'), halo(body, 22, 14, 22, 5, '#57f08a'),
            halo(body, -58, 19, 0, 4, '#fff4dc')],
          beacons: [halo(body, 5, 27, 0, 7, '#ff2e22'), halo(body, 20, 5, 0, 6, '#ff2e22')] };
        for (const sprite of [...lights.nav, ...lights.beacons]) sprite.visible = false;
        return { group, body, paint, color: vehicle.color, liveryColor: '#ffffff', strobes: [], dead: false,
          rotor, disc, tail, canopy: { material: paint }, shell: null, helicopter: true, apache: true,
          gunYaw, gunPitch, barrel, lights, apacheKit: kit, apacheLodParts: lodParts, apacheLodFar: false,
          apacheBeacon: beacon, rayTargets: lodParts.map(part => part.mesh) };
      }
      function animateDownloadedApache(c, m) {
        apacheAssetLod(c, m);
        const spent = m.paint.userData.apacheSource.spent.value,
          wear = m.paint.userData.apacheSource.wear.value;
        spent.set(8 - clamp(c.arms?.missiles ?? 8, 0, 8), 4 - clamp(c.arms?.airMissiles ?? 4, 0, 4));
        wear.set(clamp(1 - c.hp / c.maxhp, 0, 1), c.hp <= 0 || c.damage?.burnt ? 1 : 0);
        m.apacheBeacon.userData.apacheSource.wear.value.copy(wear);
        if (typeof apacheBodyPitch === 'function') m.body.rotation.z = apacheBodyPitch(c);
        if (typeof apacheBodyRoll === 'function') m.body.rotation.x = apacheBodyRoll(c);
        // The source mast is tilted ten degrees; spin remains about its true axis.
        // Rotors retain exact source geometry while stopped; the shared disc takes
        // over at speed. The single reduced shadow draw remains bounded in both.
        m.rotor.visible = !m.disc.visible;
      }
