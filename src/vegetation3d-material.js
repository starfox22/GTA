      // Vegetation 3D foliage material (sway, alpha test), tree materials and FoliageMesh geometry helpers.
      /* ---- The material ---------------------------------------------------------------- */
      const foliageUniforms = {
        foliageTime: { value: 0 },
        foliageWind: { value: 0.3 },
      };
      const FOLIAGE_VERTEX_PARS = `
        attribute vec2 foliage;
        attribute vec3 morph;
        #ifdef USE_INSTANCING
          attribute vec2 instanceFoliage;
        #endif
        uniform float foliageTime;
        uniform float foliageWind;
        varying float vFoliageLeaf;
        varying float vFoliageDensity;`;
      // The morph, then the leaf mask and density for the fragment shader.
      const FOLIAGE_BEGIN = `
        #include <begin_vertex>
        float foliageMorph = 0.0;
        vFoliageDensity = 0.0;
        #ifdef USE_INSTANCING
          foliageMorph = instanceFoliage.x;
          vFoliageDensity = instanceFoliage.y;
        #endif
        transformed += morph * foliageMorph;
        vFoliageLeaf = foliage.x;`;
      // Wind: a slow sway that travels across the city in gusts (phase from the
      // world position), weighted per vertex (the tip of a frond, the top of a
      // crown), plus a quick leaf flutter; a world-space offset after the
      // transform, scaled by the tree's own scale.
      const FOLIAGE_SWAY = `
        {
          vec4 foliageWorld = vec4( transformed, 1.0 );
          float foliageScale = 1.0;
          #ifdef USE_INSTANCING
            foliageWorld = instanceMatrix * foliageWorld;
            foliageScale = length( instanceMatrix[ 1 ].xyz );
          #endif
          foliageWorld = modelMatrix * foliageWorld;
          float phase = foliageTime * 1.3 + foliageWorld.x * 0.012 + foliageWorld.z * 0.009;
          vec2 gust = vec2( sin( phase ) + 0.35 * sin( phase * 2.3 + 1.7 ), cos( phase * 0.9 + 0.5 ) * 0.6 );
          float flutter = sin( foliageTime * 7.0 + dot( foliageWorld.xyz, vec3( 0.9, 1.3, 0.7 ) ) ) * foliage.x;
          vec3 foliageOffset = ( vec3( gust.x, 0.0, gust.y ) * foliage.y * 1.4 + vec3( 0.12, 0.07, -0.1 ) * flutter ) * foliageWind * foliageScale;
          mvPosition.xyz += ( viewMatrix * vec4( foliageOffset, 0.0 ) ).xyz;
          gl_Position = projectionMatrix * mvPosition;
        }`;
      // Sparser crowns (instance density) drop more of their leaf-card pixels.
      const FOLIAGE_ALPHATEST = `
        #ifdef USE_ALPHATEST
          if ( diffuseColor.a < alphaTest + vFoliageDensity * 0.32 * step( 0.8, vFoliageLeaf ) ) discard;
        #endif`;
      function foliageVertexPatch(shader) {
        Object.assign(shader.uniforms, foliageUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + FOLIAGE_VERTEX_PARS)
          .replace('#include <begin_vertex>', FOLIAGE_BEGIN)
          .replace('#include <project_vertex>', '#include <project_vertex>\n' + FOLIAGE_SWAY);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vFoliageLeaf;\nvarying float vFoliageDensity;')
          .replace('#include <alphatest_fragment>', FOLIAGE_ALPHATEST);
      }
      const treeMaterial = new Three.MeshStandardMaterial({
        map: foliageAtlas.map,
        normalMap: foliageAtlas.normalMap,
        normalScale: new Three.Vector2(0.9, 0.9),
        vertexColors: true,
        alphaTest: 0.5,
        side: Three.DoubleSide,
        roughness: 0.84,
        metalness: 0,
      });
      treeMaterial.name = 'trees';
      treeMaterial.onBeforeCompile = (shader) => {
        cityMaterialPatch(shader);
        foliageVertexPatch(shader);
        shader.vertexShader = shader.vertexShader.replace(
          '#include <color_vertex>',
          // The instance colour (jitter, autumn) tints the leaves, not the bark.
          `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
            vColor = vec3( 1.0 );
          #endif
          #ifdef USE_COLOR
            vColor *= color;
          #endif
          #ifdef USE_INSTANCING_COLOR
            vColor *= mix( vec3( 1.0 ), instanceColor.rgb, smoothstep( 0.3, 0.5, foliage.x ) );
          #endif`,
        );
        shader.fragmentShader = shader.fragmentShader
          // Leaves keep their crown-shaped normal on both faces: a card seen from
          // behind is still the outside of the crown, not a dark hole in it.
          .replace(
            '#include <normal_fragment_begin>',
            '#include <normal_fragment_begin>\nif ( vFoliageLeaf > 0.3 ) { normal = normalize( vNormal ); nonPerturbedNormal = normal; }',
          )
          // Light through the leaves: shaded foliage is never as dark as bark.
          .replace(
            '#include <lights_fragment_end>',
            '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * vFoliageLeaf * 0.07;',
          );
      };
      treeMaterial.customProgramCacheKey = () => 'city-trees';
      // The shadow pass: the same cut-outs, morph and sway.
      const treeDepthMaterial = new Three.MeshDepthMaterial({
        depthPacking: Three.RGBADepthPacking,
        map: foliageAtlas.map,
        alphaTest: 0.5,
        side: Three.DoubleSide,
      });
      treeDepthMaterial.onBeforeCompile = foliageVertexPatch;
      treeDepthMaterial.customProgramCacheKey = () => 'city-trees-depth';
      /* ---- Geometry kit ---------------------------------------------------------------- */
      const UP = new Three.Vector3(0, 1, 0),
        vegA = new Three.Vector3(),
        vegB = new Three.Vector3(),
        vegC = new Three.Vector3();
      // Accumulates one tree's vertices: position, normal, uv, colour, the
      // foliage pair (leaf mask, sway) and the morph offset.
      class FoliageMesh {
        constructor() {
          this.p = [];
          this.n = [];
          this.t = [];
          this.c = [];
          this.f = [];
          this.m = [];
          this.i = [];
        }
        get count() {
          return this.p.length / 3;
        }
        vert(p, n, u, v, color, leaf, sway, morph) {
          this.p.push(p.x, p.y, p.z);
          this.n.push(n.x, n.y, n.z);
          this.t.push(u, v);
          this.c.push(color.r, color.g, color.b);
          this.f.push(leaf, sway);
          this.m.push(morph ? morph.x : 0, morph ? morph.y : 0, morph ? morph.z : 0);
          return this.count - 1;
        }
        tri(a, b, c) {
          this.i.push(a, b, c);
        }
        quad(a, b, c, d) {
          this.i.push(a, b, c, a, c, d);
        }
        geometry(meta) {
          const g = new Three.BufferGeometry();
          g.setAttribute('position', new Three.Float32BufferAttribute(this.p, 3));
          g.setAttribute('normal', new Three.Float32BufferAttribute(this.n, 3));
          g.setAttribute('uv', new Three.Float32BufferAttribute(this.t, 2));
          g.setAttribute('color', new Three.Float32BufferAttribute(this.c, 3));
          g.setAttribute('foliage', new Three.Float32BufferAttribute(this.f, 2));
          g.setAttribute('morph', new Three.Float32BufferAttribute(this.m, 3));
          g.setIndex(this.i);
          g.computeBoundingBox();
          // Room for the morph and the sway.
          g.boundingBox.expandByScalar(meta.reach * 0.35 + 4);
          g.computeBoundingSphere();
          g.boundingSphere.radius += meta.reach * 0.35 + 4;
          g.userData.foliage = meta;
          return g;
        }
      }
      const shade = (color, k) => ({ r: color.r * k, g: color.g * k, b: color.b * k });
      const linear = (hex) => new Three.Color(hex);
      // A tube along a polyline (trunks, limbs, stems) with bark from an atlas strip.
      function tube(fm, points, radii, sides, bark, color, o = {}) {
        const cell = atlasUV(barkCell(bark), 2),
          n = points.length,
          lengths = [0];
        for (let k = 1; k < n; k++) lengths.push(lengths[k - 1] + points[k].distanceTo(points[k - 1]));
        const total = lengths[n - 1] || 1,
          vSpan = Math.min(1, (o.vScale ?? 1) * (total / (radii[0] * 2 * Math.PI)) * 0.5),
          tangent = new Three.Vector3(),
          normal = new Three.Vector3(),
          binormal = new Three.Vector3(),
          previous = new Three.Vector3(),
          dir = new Three.Vector3(),
          pos = new Three.Vector3(),
          rings = [];
        for (let k = 0; k < n; k++) {
          tangent.subVectors(points[Math.min(n - 1, k + 1)], points[Math.max(0, k - 1)]).normalize();
          if (k === 0) normal.copy(Math.abs(tangent.y) < 0.9 ? UP : new Three.Vector3(1, 0, 0)).cross(tangent).normalize();
          else normal.sub(previous.copy(tangent).multiplyScalar(normal.dot(tangent))).normalize();
          binormal.crossVectors(tangent, normal);
          const t = lengths[k] / total,
            ring = [],
            tint = shade(color, o.shadeAt ? o.shadeAt(t) : 1),
            sway = o.sway ? o.sway(points[k], t) : 0,
            morph = o.morph ? o.morph(t) : null;
          for (let s = 0; s <= sides; s++) {
            const a = (s / sides) * TAU;
            dir.copy(normal).multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a));
            pos.copy(points[k]).addScaledVector(dir, radii[k]);
            ring.push(fm.vert(pos, dir, cell.u0 + (s / sides) * cell.du, cell.v0 + t * vSpan * cell.dv, tint, o.leaf ?? 0, sway, morph));
          }
          rings.push(ring);
        }
        for (let k = 1; k < n; k++)
          for (let s = 0; s < sides; s++) fm.quad(rings[k - 1][s], rings[k - 1][s + 1], rings[k][s + 1], rings[k][s]);
      }
      // A flat leaf card at `centre` facing `facing`, `w` x `h`, turned `spin`.
      function card(fm, centre, facing, w, h, spin, cellName, color, o) {
        const cell = atlasUV(ATLAS_CELLS[cellName]),
          n = vegA.copy(facing).normalize(),
          ref = Math.abs(n.y) < 0.95 ? UP : new Three.Vector3(1, 0, 0),
          tu = new Three.Vector3().crossVectors(ref, n).normalize(),
          tv = new Three.Vector3().crossVectors(n, tu),
          cs = Math.cos(spin),
          sn = Math.sin(spin),
          ax = tu.clone().multiplyScalar(cs).addScaledVector(tv, sn),
          ay = tv.clone().multiplyScalar(cs).addScaledVector(tu, -sn),
          // Hanging cards (willow) keep their top edge at the centre.
          top = o.hang ? 0 : 0.5,
          ids = [];
        for (const [u, v] of [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ]) {
          const p = centre.clone().addScaledVector(ax, (u - 0.5) * w).addScaledVector(ay, (v - 1 + top) * h);
          ids.push(fm.vert(p, o.normal(p), cell.u0 + u * cell.du, cell.v0 + v * cell.dv, o.tint ? o.tint(p, color) : color, o.leaf ?? 1, o.sway(p), o.morph));
        }
        fm.quad(ids[0], ids[1], ids[2], ids[3]);
      }
      const icoCache = new Map();
      function icoPositions(detail) {
        if (!icoCache.has(detail)) icoCache.set(detail, new Three.IcosahedronGeometry(1, detail).attributes.position);
        return icoCache.get(detail);
      }
      // A lumpy blob (crown cores, the mid level's crowns), its UVs projected from
      // above onto the dense middle of a leaf cell.
      function blob(fm, centre, rx, ry, rz, detail, cellName, color, o) {
        const cell = atlasUV(ATLAS_CELLS[cellName]),
          src = icoPositions(detail),
          spread = o.uvSpread ?? 0.22,
          lumpy = o.lumpy ?? 0.2,
          p = new Three.Vector3(),
          d = new Three.Vector3();
        const ids = [];
        for (let k = 0; k < src.count; k++) {
          d.fromBufferAttribute(src, k);
          const bump = 1 + lumpy * (vegHash(d.x * 97, d.y * 89 + d.z * 83, o.seed || 0) - 0.5) * 2;
          p.set(centre.x + d.x * rx * bump, centre.y + d.y * ry * bump, centre.z + d.z * rz * bump);
          const k2 = 0.6 + 0.4 * (d.y * 0.5 + 0.5);
          ids.push(fm.vert(p, o.normal(p), cell.u0 + (0.5 + d.x * spread) * cell.du, cell.v0 + (0.5 + d.z * spread) * cell.dv, shade(color, k2), o.leaf ?? 1, o.sway(p), o.morph));
        }
        for (let k = 0; k < ids.length; k += 3) fm.tri(ids[k], ids[k + 1], ids[k + 2]);
      }
      // A curved, keeled palm frond: `heading` round the crown, rising at `elev`
      // and falling away by `droop`; the leaflets (the texture) rise from the
      // rachis in a V, and the blade twists towards the tip.
      function frond(fm, base, heading, len, width, elev, droop, segments, color, o = {}) {
        const cell = atlasUV(ATLAS_CELLS.frond),
          H = new Three.Vector3(Math.cos(heading), 0, Math.sin(heading)),
          side = new Three.Vector3(-Math.sin(heading), 0, Math.cos(heading)),
          rows = [];
        for (let s = 0; s <= segments; s++) {
          const t = s / segments,
            spine = base.clone().addScaledVector(H, len * t * Math.cos(elev)).addScaledVector(UP, len * t * Math.sin(elev) - droop * len * t * t),
            w = width * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)), 0.6) + width * 0.04,
            twist = (o.twist ?? 0.3) * t,
            across = side.clone().multiplyScalar(Math.cos(twist)).addScaledVector(UP, Math.sin(twist)),
            lift = w * 0.3,
            tint = shade(color, 0.72 + 0.3 * t),
            sway = 0.12 + 0.88 * t * t,
            morph = UP.clone().multiplyScalar(-len * 0.22 * t * t);
          const L = spine.clone().addScaledVector(across, -w / 2).addScaledVector(UP, lift),
            R = spine.clone().addScaledVector(across, w / 2).addScaledVector(UP, lift),
            nL = vegB.copy(UP).addScaledVector(across, 0.45).normalize().clone(),
            nR = vegC.copy(UP).addScaledVector(across, -0.45).normalize().clone();
          rows.push([
            fm.vert(L, nL, cell.u0 + t * cell.du, cell.v0, tint, 1, sway, morph),
            fm.vert(spine, UP, cell.u0 + t * cell.du, cell.v0 + cell.dv * 0.5, tint, 1, sway, morph),
            fm.vert(R, nR, cell.u0 + t * cell.du, cell.v0 + cell.dv, tint, 1, sway, morph),
          ]);
        }
        for (let s = 1; s < rows.length; s++) {
          const [a0, b0, c0] = rows[s - 1],
            [a1, b1, c1] = rows[s];
          fm.quad(a0, b0, b1, a1);
          fm.quad(b0, c0, c1, b1);
        }
      }
      // A palmate fan leaf on its hub, spread outward and up; pleated.
      function fanLeaf(fm, hub, heading, elev, radius, color, o = {}) {
        const cell = atlasUV(ATLAS_CELLS.fan),
          out = new Three.Vector3(Math.cos(heading), 0, Math.sin(heading)),
          F = out.clone().multiplyScalar(Math.cos(elev)).addScaledVector(UP, Math.sin(elev)),
          flat = UP.clone().multiplyScalar(Math.cos(elev)).addScaledVector(out, -Math.sin(elev)),
          side = new Three.Vector3().crossVectors(flat, F),
          // Rolled about its own axis, so the fans of a crown face every way.
          roll = o.roll ?? 0,
          N = flat.clone().multiplyScalar(Math.cos(roll)).addScaledVector(side, Math.sin(roll)),
          S = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(flat, -Math.sin(roll)),
          wedges = o.wedges ?? 10,
          centre = fm.vert(hub, N, cell.u0 + 0.5 * cell.du, cell.v0 + 0.06 * cell.dv, shade(color, 0.75), 1, 0.3, null),
          rim = [],
          normal = UP.clone().multiplyScalar(0.6).add(N).normalize();
        for (let k = 0; k <= wedges; k++) {
          const phi = -1.6 + (k / wedges) * 3.2,
            pleat = (k % 2 ? 0.07 : -0.03) * radius,
            cup = 0.32 * radius * Math.pow(Math.abs(phi) / 1.6, 2),
            p = hub
              .clone()
              .addScaledVector(F, Math.cos(phi) * radius)
              .addScaledVector(S, Math.sin(phi) * radius)
              .addScaledVector(N, pleat + cup)
              .addScaledVector(UP, -radius * 0.25 * Math.max(0, Math.cos(phi)));
          rim.push(
            fm.vert(p, normal, cell.u0 + (0.5 + Math.sin(phi) * 0.47) * cell.du, cell.v0 + (0.06 + Math.cos(phi) * 0.9) * cell.dv, shade(color, k % 2 ? 1.02 : 0.86), 1, 0.9, UP.clone().multiplyScalar(-radius * 0.3)),
          );
        }
        for (let k = 1; k < rim.length; k++) fm.tri(centre, rim[k - 1], rim[k]);
      }
      // A conifer bough: a card bent down from the trunk to its tip.
      function bough(fm, root, heading, len, width, droop, color, o) {
        const cell = atlasUV(ATLAS_CELLS[o.cell || 'needle']),
          H = new Three.Vector3(Math.cos(heading), 0, Math.sin(heading)),
          side = new Three.Vector3(-Math.sin(heading), 0, Math.cos(heading)),
          rows = [];
        for (const t of [0, 0.5, 1]) {
          const spine = root.clone().addScaledVector(H, len * t).addScaledVector(UP, -droop * len * Math.pow(t, 1.5)),
            w = width * (t === 0.5 ? 1 : t ? 0.55 : 0.4),
            tint = shade(color, 0.7 + 0.35 * t),
            sway = o.sway * (0.2 + t),
            morph = UP.clone().multiplyScalar(-len * (o.morphDroop ?? 0.3) * t * t),
            normal = UP.clone().multiplyScalar(o.upBias ?? 1.1).addScaledVector(H, 0.6).normalize();
          rows.push([
            fm.vert(spine.clone().addScaledVector(side, -w / 2).addScaledVector(UP, -w * 0.12), normal, cell.u0, cell.v0 + t * cell.dv, tint, 1, sway, morph),
            fm.vert(spine.clone().addScaledVector(side, w / 2).addScaledVector(UP, -w * 0.12), normal, cell.u0 + cell.du, cell.v0 + t * cell.dv, tint, 1, sway, morph),
          ]);
        }
        for (let k = 1; k < rows.length; k++) fm.quad(rows[k - 1][0], rows[k - 1][1], rows[k][1], rows[k][0]);
      }
      /* ---- Species --------------------------------------------------------------------- */
      // Sizes in map units (8 to the metre) at the nominal plan radius of 13 (a
      // street tree of r 12 comes out at 0.92 of these). H: height; R: crown
      // radius; Ry: the crown's half height. Colours are the leaves', bark's and
      // (blossom) flowers'; `far` is the flat colour of the far city's blob.
      const TREE_SPECIES = {
        plane: { form: 'broad', H: 70, R: 27, Ry: 23, shape: 'round', lobes: 7, cards: 10, cell: 'leafLobed', leaf: '#6f8c45', bark: 0, trunk: '#bdb298', trunkR: 2.1, limbs: 4 },
        linden: { form: 'broad', H: 64, R: 21, Ry: 23, shape: 'oval', lobes: 7, cards: 10, cell: 'leafRound', leaf: '#5d813c', bark: 1, trunk: '#6a5a4c', trunkR: 1.8, limbs: 3 },
        locust: { form: 'broad', H: 64, R: 26, Ry: 18, shape: 'vase', lobes: 8, cards: 8, cell: 'leafFine', leaf: '#a3b555', bark: 1, trunk: '#4d423a', trunkR: 1.6, limbs: 5, airy: true },
        pear: { form: 'broad', H: 54, R: 17, Ry: 21, shape: 'teardrop', lobes: 6, cards: 10, cell: 'leafRound', leaf: '#4b7a3a', bark: 1, trunk: '#5e5047', trunkR: 1.4, limbs: 3 },
        // A Bradford pear in its white spring blossom (one pear in five).
        pearBlossom: { form: 'broad', H: 54, R: 17, Ry: 21, shape: 'teardrop', lobes: 6, cards: 10, cell: 'leafRound', leaf: '#4b7a3a', bark: 1, trunk: '#5e5047', trunkR: 1.4, limbs: 3, blossom: { color: '#f4f2ea', share: 0.7 } },
        maple: { form: 'broad', H: 60, R: 24, Ry: 21, shape: 'round', lobes: 7, cards: 10, cell: 'leafLobed', leaf: '#628a3e', bark: 1, trunk: '#6e6053', trunkR: 1.7, limbs: 4 },
        oak: { form: 'broad', H: 76, R: 33, Ry: 24, shape: 'spreading', lobes: 9, cards: 10, cell: 'leafLobed', leaf: '#58763a', bark: 1, trunk: '#55473a', trunkR: 2.6, limbs: 5 },
        willow: { form: 'broad', H: 66, R: 29, Ry: 22, shape: 'weeping', lobes: 7, cards: 14, cell: 'willow', leaf: '#a2b964', bark: 1, trunk: '#5f5245', trunkR: 2.2, limbs: 5 },
        jacaranda: { form: 'broad', H: 58, R: 29, Ry: 12, shape: 'umbrella', lobes: 8, cards: 9, cell: 'leafFine', leaf: '#6a8c45', bark: 1, trunk: '#6d5e50', trunkR: 1.7, limbs: 5, blossom: { color: '#9c7ee0', share: 0.62 } },
        flame: { form: 'broad', H: 52, R: 34, Ry: 9, shape: 'umbrella', lobes: 9, cards: 9, cell: 'leafFine', leaf: '#669a40', bark: 2, trunk: '#8a7d6e', trunkR: 1.9, limbs: 5, blossom: { color: '#ee4a26', share: 0.52 } },
        cherry: { form: 'broad', H: 50, R: 25, Ry: 17, shape: 'spreading', lobes: 7, cards: 10, cell: 'leafRound', leaf: '#678a44', bark: 2, trunk: '#5f433b', trunkR: 1.5, limbs: 4, blossom: { color: '#f5b8cc', share: 0.76 } },
        beech: { form: 'broad', H: 76, R: 27, Ry: 28, shape: 'oval', lobes: 7, cards: 9, cell: 'leafRound', leaf: '#607f3c', bark: 2, trunk: '#8c8b82', trunkR: 2.1, limbs: 4 },
        birch: { form: 'broad', H: 80, R: 16, Ry: 29, shape: 'teardrop', lobes: 6, cards: 9, cell: 'leafRound', leaf: '#94ad52', bark: 6, trunk: '#ebe8df', trunkR: 1.3, limbs: 3, airy: true },
        cypress: { form: 'cypress', H: 96, R: 9, Ry: 43, leaf: '#46693f', bark: 7, trunk: '#5c4c3e', trunkR: 1.3, fixedScale: true },
        stonePine: { form: 'stonePine', H: 88, R: 38, Ry: 10, leaf: '#56783f', bark: 5, trunk: '#8a6446', trunkR: 2.4 },
        spruce: { form: 'spruce', H: 88, R: 20, leaf: '#46704a', bark: 7, trunk: '#5e4d40', trunkR: 1.5, conifer: true },
        fir: { form: 'fir', H: 80, R: 17, leaf: '#4f7a68', bark: 7, trunk: '#6b6259', trunkR: 1.5, conifer: true },
        pine: { form: 'pine', H: 92, R: 25, Ry: 15, leaf: '#62824a', bark: 5, trunk: '#91603f', trunkR: 1.9, conifer: true },
        // Palms at makePalm's size 1 (plan radius 17): heights of the trunk top.
        canary: { form: 'palm', palm: 'canary', H: 64, R: 34, leaf: '#5a7a3b', bark: 3, trunk: '#86765b', trunkR: 3.9, fronds: 26, frondLen: 36, frondW: 9, elevTop: 1.0, elevLow: -0.35, droop: 0.55, girth: 1.5, breakKJ: 320 },
        fan: { form: 'palm', palm: 'fan', H: 100, R: 20, leaf: '#6a8a40', bark: 4, trunk: '#8f806b', trunkR: 1.7, fronds: 22, fanR: 10.5, girth: 0.8, breakKJ: 120 },
        coconut: { form: 'palm', palm: 'coconut', H: 76, R: 36, leaf: '#86a64a', bark: 4, trunk: '#9c8d74', trunkR: 1.9, fronds: 14, frondLen: 40, frondW: 11, elevTop: 0.7, elevLow: -0.45, droop: 0.8, girth: 1, breakKJ: 150 },
        royal: { form: 'palm', palm: 'royal', H: 84, R: 32, leaf: '#608a3e', bark: 2, trunk: '#bdb9b0', trunkR: 2.6, fronds: 13, frondLen: 36, frondW: 10, elevTop: 1.15, elevLow: -0.15, droop: 0.65, girth: 1.2, breakKJ: 220 },
      };
      for (const [key, S] of Object.entries(TREE_SPECIES)) {
        S.key = key;
        S.leafColor = linear(S.leaf);
        S.trunkColor = linear(S.trunk);
        if (S.blossom) S.blossom.linear = linear(S.blossom.color);
        S.seed = vegSeed(key.length * 131, key.charCodeAt(0) * 17, key.charCodeAt(1));
      }
      // Crown-shaped normals: from the crown's centre, a little towards the sky,
      // so a crown shades as one soft volume and not as a heap of flat cards.
      const crownNormal = (C, rx, ry) => (p) => new Three.Vector3((p.x - C.x) / rx, ((p.y - C.y) / ry) * 0.9, (p.z - C.z) / rx).normalize().addScaledVector(UP, 0.5).normalize();
      // Leaf colour by height in the crown: the underside and the inside in shade.
      const crownShade = (base, top) => (p, color) => shade(color, 0.62 + 0.46 * clamp((p.y - base) / Math.max(1, top - base), 0, 1));
      function buildBroadleaf(S, lod) {
        const fm = new FoliageMesh(),
          random = vegRandom(S.seed + lod),
          between = (a, b) => a + random() * (b - a),
          { H, R, Ry } = S,
          crownBase = H - Ry * 2,
          C = new Three.Vector3(0, crownBase + Ry, 0),
          lobes = [],
          count = lod ? Math.max(3, Math.round(S.lobes / 2)) : S.lobes;
        // The lobes: one on top, the rest round it, arranged by the crown's shape.
        lobes.push({ c: C.clone().add(new Three.Vector3(0, Ry * (S.shape === 'umbrella' ? 0.2 : 0.35), 0)), rx: R * 0.56, ry: Ry * 0.62, out: new Three.Vector3() });
        for (let j = 1; j < count; j++) {
          const a = j * 2.39996 + between(-0.3, 0.3),
            out = new Three.Vector3(Math.cos(a), 0, Math.sin(a));
          let ring = R * between(0.44, 0.58),
            y = between(-0.25, 0.25) * Ry,
            rx = R * between(0.42, 0.52),
            ry = Ry * between(0.5, 0.62);
          if (S.shape === 'oval') (ring *= 0.78), (y = ((j % 3) - 1) * Ry * 0.42);
          else if (S.shape === 'teardrop') (ring *= 0.66), (y = between(-0.55, 0.35) * Ry), (rx *= 1 - (y / Ry) * 0.3);
          else if (S.shape === 'vase') (ring *= 1.02), (y = Ry * between(0.05, 0.35));
          else if (S.shape === 'spreading') (ring *= 1.06), (y = between(-0.35, 0.15) * Ry);
          else if (S.shape === 'umbrella') (ring = R * between(0.3, 0.72)), (y = between(-0.15, 0.15) * Ry), (ry *= 0.8), (rx *= between(0.8, 1.15));
          else if (S.shape === 'weeping') (ring *= 0.92), (y = between(-0.15, 0.3) * Ry);
          lobes.push({ c: C.clone().addScaledVector(out, ring).add(new Three.Vector3(0, y, 0)), rx, ry, out });
        }
        // Trunk to the fork, and the limbs out towards the lobes: they show
        // under the crown's edge from the tilted camera.
        const fork = crownBase + Ry * (S.shape === 'umbrella' ? 0.2 : 0.45),
          bend = new Three.Vector3(between(-1, 1), 0, between(-1, 1)).multiplyScalar(S.trunkR * 0.5),
          trunkSides = lod ? 4 : 7,
          top = new Three.Vector3(bend.x, fork, bend.z);
        tube(
          fm,
          [new Three.Vector3(0, -1, 0), new Three.Vector3(0, fork * 0.08, 0), new Three.Vector3(bend.x * 0.5, fork * 0.55, bend.z * 0.5), top],
          [S.trunkR * 1.55, S.trunkR * 1.1, S.trunkR, S.trunkR * 0.82],
          trunkSides,
          S.bark,
          S.trunkColor,
          { shadeAt: (t) => 1 - t * 0.28, vScale: 1.4 },
        );
        const limbs = lod ? 0 : S.limbs;
        for (let j = 1; j <= limbs && j < lobes.length; j++) {
          const L = lobes[j],
            end = L.c.clone().multiplyScalar(0.72).setY(L.c.y - L.ry * 0.2),
            mid = top.clone().lerp(end, 0.5).add(new Three.Vector3(0, Ry * 0.15, 0)),
            morph = new Three.Vector3().copy(L.out).multiplyScalar(R * 0.2).add(new Three.Vector3(0, -Ry * 0.12, 0));
          tube(fm, [top.clone().setY(fork - S.trunkR), mid, end], [S.trunkR * 0.62, S.trunkR * 0.4, S.trunkR * 0.18], 5, S.bark, S.trunkColor, {
            shadeAt: (t) => 0.85 - t * 0.25,
            sway: (p, t) => t * t * 0.25,
            morph: (t) => morph.clone().multiplyScalar(t),
            vScale: 0.6,
          });
        }
        // Crown.
        const normal = crownNormal(C, R, Ry * 1.2),
          tint = crownShade(crownBase, H),
          sway = (p) => 0.35 + 0.65 * clamp((p.y - crownBase) / (Ry * 2), 0, 1),
          flowers = S.blossom;
        lobes.forEach((L, j) => {
          const morph = j ? L.out.clone().multiplyScalar(R * 0.2).add(new Three.Vector3(0, -Ry * 0.14, 0)) : new Three.Vector3(0, -Ry * 0.2, 0);
          if (lod) {
            blob(fm, L.c, L.rx * 1.08, L.ry * 1.05, L.rx * 1.08, 0, S.cell === 'willow' ? 'leafRound' : S.cell, shade(S.leafColor, 0.92), { normal, sway, morph, seed: j, uvSpread: 0.36, lumpy: 0.24 });
            return;
          }
          const coreK = S.airy ? 0.5 : 0.7;
          blob(fm, L.c, L.rx * coreK, L.ry * coreK, L.rx * coreK, 0, S.cell === 'willow' ? 'leafRound' : S.cell, shade(S.leafColor, 0.7), { normal, sway, morph, seed: j, leaf: 0.6 });
          const umbrella = S.shape === 'umbrella';
          for (let k = 0; k < S.cards; k++) {
            const dir = new Three.Vector3(between(-1, 1), umbrella ? between(0.05, 1) : between(-0.35, 1), between(-1, 1)).normalize(),
              pos = L.c.clone().add(new Three.Vector3(dir.x * L.rx * 0.78, dir.y * L.ry * 0.78, dir.z * L.rx * 0.78)),
              bloom = flowers && dir.y > -0.1 && random() < flowers.share,
              size = L.rx * between(1.0, 1.35) * (S.airy ? 1.1 : 1);
            if (S.shape === 'weeping' && k % 3) {
              // Willow: curtains of strands hanging from the crown's shell down
              // towards the ground, crossing at random turns.
              const a = random() * TAU,
                shell = new Three.Vector3(Math.cos(a), 0, Math.sin(a)),
                top = L.c.clone().addScaledVector(shell, L.rx * between(0.55, 0.95)).setY(L.c.y + L.ry * between(0.2, 0.6)),
                facing = new Three.Vector3(Math.cos(a + between(-1.2, 1.2)), 0, Math.sin(a + between(-1.2, 1.2)));
              card(fm, top, facing, L.rx * between(0.55, 0.8), L.ry * between(1.9, 2.6), between(-0.12, 0.12), 'willow', S.leafColor, {
                normal,
                sway: (p) => sway(p) + 0.5,
                morph,
                tint: (p, color) => shade(color, 0.8 + 0.3 * clamp((p.y - crownBase) / (Ry * 2), 0, 1)),
                hang: true,
              });
              continue;
            }
            const facing = umbrella ? dir.clone().multiplyScalar(0.35).addScaledVector(UP, 1.2) : dir.clone().multiplyScalar(0.7).addScaledVector(UP, 0.9);
            card(fm, pos, facing, size, size, random() * TAU, bloom ? 'blossom' : S.cell === 'willow' ? 'leafFine' : S.cell, bloom ? flowers.linear : S.leafColor, {
              normal,
              sway,
              morph,
              tint: (p, color) => shade(tint(p, color), between(0.9, 1.08)),
            });
          }
        });
        return fm.geometry({ species: S.key, lod, reach: Math.max(R, Ry), crown: { y: C.y, r: R, ry: Ry } });
      }
