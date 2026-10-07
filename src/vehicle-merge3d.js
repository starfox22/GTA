      // PRISTINE MERGE: a civilian car nothing has touched draws its non-casting static parts merged per material
      // (hood + panels + paint bumpers, black and chrome bumpers, each lamp pair, each wheel's tyre and rim, each rear
      // axle's two wheels): 22 draw calls a car down to ~12. The originals stay hidden underneath and come back for good
      // the moment the car is damaged, stained, muddied, burnt or driven by the player (vehicleMergeEligible).
      /**
       * Exactness: a merged part is the original geometry with its local matrix baked in (positions by the matrix,
       * normals by its normal matrix, not renormalised, so the shader's interpolation is the original's), drawn with
       * the original's material, so the picture is the same. The tyre joins its rim under the rim's material, whose
       * finish patch reads roughness / metalness per vertex: its part is given the rubber's constants (0.88, 0).
       * Nothing merged casts a shadow but the paint set when its panels do (the roof panel and pillars over see-through glass:
       * cars3d-interior.js CAR GLASS; the shell and trim, the other casters, are left alone), merged wheels
       * hang under the original wheel groups (they roll and steer with them; a rear axle's two wheels share its line,
       * so they turn as one), and the merged geometries are built once per kit and shared (sharedGeometries).
       * Damage, blood and bullet marks read the originals: `rayTargets` skips hidden meshes, so the split bumps
       * `m.shapeVersion` before anything aims at the body.
       */
      const vmScratch = { matrix: new Three.Matrix4(), normal: new Three.Matrix3(), v: new Three.Vector3() },
        vmStats = { merged: 0, split: 0, kits: 0, savedDraws: 0, failed: 0, slowestMs: 0, slowestKitMs: 0 };
      // The renderer frame that last built a kit's plan: one a frame (a street of new car types spreads over frames).
      let vmKitFrame = -1;
      // One geometry from parts [{ geo, matrix, finish }] (finish: [roughness, metalness] in place of the part's own).
      // null when the parts do not share one attribute layout (then nothing is merged for that group).
      function vmMergeGeometry(parts) {
        if (!parts.length) return null;
        const names = Object.keys(parts[0].geo.attributes);
        for (const part of parts) {
          const g = part.geo;
          if (g.groups.length || Object.keys(g.attributes).length !== names.length || g.morphAttributes.position) return null;
          for (const name of names) {
            const a = g.attributes[name];
            if (!a || a.isInterleavedBufferAttribute || a.itemSize !== parts[0].geo.attributes[name].itemSize) return null;
          }
          if (part.finish && !g.attributes.finish) return null;
        }
        let vertices = 0,
          indices = 0;
        for (const part of parts) {
          vertices += part.geo.attributes.position.count;
          indices += part.geo.index ? part.geo.index.count : part.geo.attributes.position.count;
        }
        const arrays = {};
        for (const name of names) arrays[name] = new Float32Array(vertices * parts[0].geo.attributes[name].itemSize);
        const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
          { normal: normalMatrix, v } = vmScratch;
        let vo = 0,
          io = 0;
        for (const part of parts) {
          const g = part.geo,
            count = g.attributes.position.count,
            flip = part.matrix.determinant() < 0;
          normalMatrix.getNormalMatrix(part.matrix);
          for (const name of names) {
            const a = g.attributes[name],
              size = a.itemSize,
              out = arrays[name];
            for (let i = 0; i < count; i++) {
              const o = (vo + i) * size;
              if (name === 'position') {
                v.fromBufferAttribute(a, i).applyMatrix4(part.matrix);
                out[o] = v.x;
                out[o + 1] = v.y;
                out[o + 2] = v.z;
              } else if (name === 'normal') {
                v.fromBufferAttribute(a, i).applyMatrix3(normalMatrix);
                out[o] = v.x;
                out[o + 1] = v.y;
                out[o + 2] = v.z;
              } else if (name === 'finish' && part.finish) {
                out[o] = part.finish[0];
                out[o + 1] = part.finish[1];
              } else for (let k = 0; k < size; k++) out[o + k] = a.array[i * size + k];
            }
          }
          if (g.index)
            for (let t = 0; t < g.index.count; t += 3) {
              const a = g.index.getX(t) + vo,
                b = g.index.getX(t + 1) + vo,
                c = g.index.getX(t + 2) + vo;
              index[io++] = a;
              index[io++] = flip ? c : b;
              index[io++] = flip ? b : c;
            }
          else
            for (let t = 0; t < count; t += 3) {
              index[io++] = vo + t;
              index[io++] = vo + (flip ? t + 2 : t + 1);
              index[io++] = vo + (flip ? t + 1 : t + 2);
            }
          vo += count;
        }
        const geo = new Three.BufferGeometry();
        for (const name of names) geo.setAttribute(name, new Three.BufferAttribute(arrays[name], parts[0].geo.attributes[name].itemSize));
        geo.setIndex(new Three.BufferAttribute(index, 1));
        geo.computeBoundingSphere();
        sharedGeometries.add(geo);
        return geo;
      }
      // A part reference in a model: `['hood']`, `['bumpers', 1]`, `['lamp', 'headLeft']`, `['wheel', 2, 0]` (the wheel's
      // first child, the tyre), `['wheelGroup', 2]`. Kits store references, models resolve them (each has its own meshes).
      function vmPart(m, ref) {
        switch (ref[0]) {
          case 'body':
            return m.body;
          case 'bumpers':
            return m.bumpers[ref[1]];
          case 'lamp':
            return m.lamps.find((lamp) => lamp.key === ref[1])?.mesh || null;
          case 'wheel':
            return m.wheels[ref[1]]?.wheel.children[ref[2]] || null;
          case 'wheelGroup':
            return m.wheels[ref[1]]?.wheel || null;
          default:
            return m[ref[0]] || null;
        }
      }
      // An entry of a kit's merge plan: the parts (references) drawn as one, under `parent`, in the material of
      // `materialOf`; `sync` copies that part's material every frame (lamps switching on, off, to the brake light).
      function vmEntry(m, parent, materialOf, refs, extra = {}) {
        const parts = [],
          frame = vmPart(m, parent);
        if (!frame) return null;
        // Each part in the merged mesh's frame from the two world matrices (the hood hangs from a hinge pivot the
        // first damage pass adds; a right wheel sits on its own group, turned as the left one is).
        m.group.updateMatrixWorld(true);
        const inverse = frame.matrixWorld.clone().invert();
        for (const ref of refs) {
          const o = vmPart(m, ref.part || ref);
          if (!o || !o.geometry || !o.visible) return null;
          parts.push({ geo: o.geometry, matrix: inverse.clone().multiply(o.matrixWorld), finish: ref.finish });
        }
        const geo = vmMergeGeometry(parts);
        return geo ? { geo, parent, material: materialOf, hides: refs.map((ref) => ref.part || ref), sync: extra.sync || false } : null;
      }
      // A civilian kit's plan: hood + panels + paint bumpers; black, chrome bumpers; lamp pairs; a front wheel's tyre
      // and rim (it steers alone); a rear axle's two tyres and rims (the tyre under the rim's finish material, given the
      // rubber's roughness and metalness).
      function vmCivilianPlan(kit, m) {
        const plan = [],
          add = (entry) => entry && plan.push(entry),
          paint = [['hood'], ['panels']],
          byKind = {};
        kit.bumpers.forEach((b, i) => (b.material === 'paint' ? paint : (byKind[b.material] = byKind[b.material] || [])).push(['bumpers', i]));
        add(vmEntry(m, ['body'], ['hood'], paint));
        for (const kind in byKind) if (byKind[kind].length > 1) add(vmEntry(m, ['body'], byKind[kind][0], byKind[kind]));
        for (const kind of ['head', 'tail'])
          add(vmEntry(m, ['body'], ['lamp', kind + 'Left'], [['lamp', kind + 'Left'], ['lamp', kind + 'Right']], { sync: true }));
        for (let i = 0; i * 2 + 1 < m.wheels.length; i++) {
          const left = i * 2,
            right = i * 2 + 1;
          if (m.wheels[left].front) {
            for (const w of [left, right])
              add(vmEntry(m, ['wheelGroup', w], ['wheel', w, 1], [{ part: ['wheel', w, 0], finish: [0.88, 0] }, ['wheel', w, 1]]));
          } else {
            add(
              vmEntry(m, ['wheelGroup', left], ['wheel', left, 1], [
                { part: ['wheel', left, 0], finish: [0.88, 0] },
                ['wheel', left, 1],
                { part: ['wheel', right, 0], finish: [0.88, 0] },
                ['wheel', right, 1],
              ]),
            );
          }
        }
        return plan;
      }
      // A police kit's plan: hood + panels, the bumpers, the tail lamp pair (the head lamps wig-wag apart in a pursuit),
      // and the four tyres and the four rims (police wheels are never turned: animatePoliceVehicle leaves them alone).
      function vmPolicePlan(kit, m) {
        const plan = [],
          add = (entry) => entry && plan.push(entry);
        add(vmEntry(m, ['body'], ['hood'], [['hood'], ['panels']]));
        if (m.bumpers.length > 1) add(vmEntry(m, ['body'], ['bumpers', 0], m.bumpers.map((b, i) => ['bumpers', i])));
        add(vmEntry(m, ['body'], ['lamp', 'tailLeft'], [['lamp', 'tailLeft'], ['lamp', 'tailRight']], { sync: true }));
        for (const child of [0, 1]) add(vmEntry(m, ['body'], ['wheel', 0, child], m.wheels.map((w, i) => ['wheel', i, child])));
        return plan;
      }
      // The kit's merge plan, built from its first pristine model (geometry and placement are the kit's; each model
      // resolves the references to its own meshes and materials).
      function vmKitPlan(kit, m) {
        if (kit.mergePlan !== undefined) return kit.mergePlan;
        const started = performance.now();
        let plan = null;
        try {
          plan = m.civilian ? vmCivilianPlan(kit, m) : m.police ? vmPolicePlan(kit, m) : null;
        } catch (e) {
          vmStats.failed++;
          plan = null;
        }
        kit.mergePlan = plan && plan.length ? plan : null;
        if (kit.mergePlan) vmStats.kits++;
        vmStats.slowestKitMs = Math.max(vmStats.slowestKitMs, performance.now() - started);
        return kit.mergePlan;
      }
      function vmMesh(geo, material, parent) {
        const mesh = new Three.Mesh(geo, material);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.userData.vehicleMerged = true;
        parent.add(mesh);
        return mesh;
      }
      // Whether a car's model may stay merged: nothing has changed its parts from the kit's (see the header).
      function vehicleMergeEligible(c, m) {
        return (
          // lookSwitches({ vehicleMerge: false }) draws every car from its own parts (an A/B in one page).
          lookSwitchState.vehicleMerge &&
          c !== player.car &&
          c.hp > 0 &&
          c.hp >= c.maxhp &&
          c.damageVersion === 0 &&
          !(c.stains && c.stains.length) &&
          !(c.mudCoat > 0) &&
          !m.charred &&
          !m.doors
        );
      }
      // Merges a pristine civilian or police model (once; a model split again never merges back).
      function mergeVehicleModel(c, m) {
        const started = performance.now();
        // A kit not planned yet waits if one was planned this frame (m.merged stays undefined: asked again next frame).
        if (m.kit && m.kit.mergePlan === undefined) {
          if (vmKitFrame === frames) return;
          vmKitFrame = frames;
        }
        m.merged = null;
        if (!(m.civilian || m.police) || !m.kit || !m.panels || !m.hood || !m.bumpers || !m.wheels || !m.lamps) return;
        const plan = vmKitPlan(m.kit, m);
        if (!plan) return;
        const merged = { meshes: [], hidden: [], synced: [], parts: [] };
        for (const entry of plan) {
          const parent = vmPart(m, entry.parent),
            source = vmPart(m, entry.material),
            hidden = entry.hides.map((ref) => vmPart(m, ref));
          // A part missing or already hidden on this model (a body variant): leave this entry out.
          if (!parent || !source || hidden.some((o) => !o || !o.visible)) continue;
          const mesh = vmMesh(entry.geo, source.material, parent);
          // The paint set carries the roof panel and pillars: it casts when the panels do (see-through glass).
          if (m.panels.castShadow && m.cabin && !m.cabin.castShadow && entry.hides.some((ref) => ref[0] === 'panels')) mesh.castShadow = true;
          merged.meshes.push(mesh);
          merged.parts.push(hidden);
          if (entry.sync) merged.synced.push(mesh, source);
          for (const o of hidden) {
            o.visible = false;
            merged.hidden.push(o);
          }
        }
        if (!merged.meshes.length) return;
        m.merged = merged;
        vmStats.merged++;
        vmStats.slowestMs = Math.max(vmStats.slowestMs, performance.now() - started);
        vmStats.savedDraws += merged.hidden.length - merged.meshes.length;
      }
      // Back to the original parts for good (damage, blood or mud on the way, or the player at the wheel); with the
      // look switch off, until it is back on.
      function splitVehicleModel(m) {
        const merged = m.merged;
        m.merged = lookSwitchState.vehicleMerge ? null : undefined;
        if (!merged) return;
        for (const mesh of merged.meshes) if (mesh.parent) mesh.parent.remove(mesh);
        for (const o of merged.hidden) o.visible = true;
        // Bullet marks and car blood re-read the visible meshes (damage3d-bodies.js rayTargets).
        m.shapeVersion = (m.shapeVersion || 0) + 1;
        vmStats.split++;
        vmStats.savedDraws -= merged.hidden.length - merged.meshes.length;
      }
      // Once a frame for a merged model in view, after its lamps were set: the lamp pairs take the left lamp's material.
      function syncMergedVehicle(m) {
        const synced = m.merged.synced;
        for (let i = 0; i < synced.length; i += 2) if (synced[i].material !== synced[i + 1].material) synced[i].material = synced[i + 1].material;
      }
      // DeadEndCity.vehicleMergeAudit(): every merged mesh against the hidden parts it stands for, in world space now
      // (each vertex, in order: positions and the direction of the normals). maxError is in world units; 0 up to
      // rounding means the merged car is the same shape in the same place, wheels turned as the originals are.
      function vehicleMergeAudit() {
        const v = new Three.Vector3(),
          w = new Three.Vector3(),
          n = new Three.Vector3(),
          k = new Three.Vector3(),
          normalA = new Three.Matrix3(),
          normalB = new Three.Matrix3();
        let models = 0,
          meshes = 0,
          vertices = 0,
          maxError = 0,
          maxNormal = 0,
          worst = null;
        for (const [c, m] of carModels) {
          if (!m.merged) continue;
          models++;
          m.group.updateMatrixWorld(true);
          m.merged.meshes.forEach((mesh, i) => {
            meshes++;
            normalA.getNormalMatrix(mesh.matrixWorld);
            const pos = mesh.geometry.attributes.position,
              nor = mesh.geometry.attributes.normal;
            let at = 0;
            for (const o of m.merged.parts[i]) {
              const p = o.geometry.attributes.position,
                q = o.geometry.attributes.normal;
              normalB.getNormalMatrix(o.matrixWorld);
              for (let j = 0; j < p.count; j++, at++) {
                v.fromBufferAttribute(pos, at).applyMatrix4(mesh.matrixWorld);
                w.fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld);
                const error = v.distanceTo(w);
                if (error > maxError) {
                  maxError = error;
                  worst = { id: c.id, type: c.type, police: !!m.police, mesh: i, part: m.merged.parts[i].indexOf(o), parts: m.merged.parts[i].length, error: +error.toFixed(3) };
                }
                if (nor && q) {
                  n.fromBufferAttribute(nor, at).applyMatrix3(normalA).normalize();
                  k.fromBufferAttribute(q, j).applyMatrix3(normalB).normalize();
                  maxNormal = Math.max(maxNormal, n.distanceTo(k));
                }
                vertices++;
              }
            }
            if (at !== pos.count) maxError = Infinity;
          });
        }
        return { models, meshes, vertices, maxError: +maxError.toFixed(6), maxNormalError: +maxNormal.toFixed(6), worst };
      }
      // DeadEndCity.vehicleMerges(): models merged and split so far, kits built, draw calls saved now, failures.
      function vehicleMergeReport() {
        let live = 0;
        // Why the civilian and police models drawn from their own parts are not merged.
        const unmerged = {};
        const why = (k) => (unmerged[k] = (unmerged[k] || 0) + 1);
        for (const [c, m] of carModels) {
          if (m.merged) {
            live++;
            continue;
          }
          if (!m.civilian && !m.police) continue;
          if (c === player.car) why('player car');
          else if (c.hp <= 0 || m.charred) why('wrecked');
          else if (c.damageVersion !== 0) why('damaged');
          else if (c.hp < c.maxhp) why('hurt');
          else if (c.stains && c.stains.length) why('stained');
          else if (c.mudCoat > 0) why('mud');
          else if (m.doors) why('carjack door');
          else if (m.merged === undefined) why('not yet');
          else why('no plan');
        }
        return { ...vmStats, slowestMs: +vmStats.slowestMs.toFixed(2), slowestKitMs: +vmStats.slowestKitMs.toFixed(2), live, unmerged };
      }
