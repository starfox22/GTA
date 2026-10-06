      // Car cabins seen through the glass: the seat plan (carSeatPlan), the cabin merged into a kit's trim (carCabinParts:
      // seats and headrests, dashboard, steering wheel, mirror, parcel shelf, a patrol car's cage) and the see-through
      // tinted glass with its Fresnel reflection (carGlassMaterial, CAR GLASS).
      /**
       * CABINS
       * The glasshouse is see-through (CAR GLASS), so a car shows what is behind its glass: the tops of the seats and
       * their headrests, the dashboard, the steering wheel, a parcel shelf and the people in it (crowd3d-driveby.js
       * SEATED OCCUPANTS). The cabin is merged into the kit's trim after everything else (no draw call of its own);
       * the body impostors draw the trim without it (`kit.trimOuter`: the same buffers with a shorter draw range).
       * Only what shows above the belt is shaped (rounded seat backs and headrests, the binnacle, the wheel's rim);
       * cushions and the dash's body below it are plain boxes.
       *
       * The seat plan is the drive-by's (driveby.js driveBySeat): the driver's hip 1.4 m behind the windscreen's foot,
       * 0.42 m under the belt, a fifth of the width left of the centre line, so the drive-by pose and the seated pose
       * sit in the same seat. A low car seats its people lower and lies them back so a crown clears the roof; a short
       * glasshouse moves the seat forward until its back is inside the glass (`fit`); the steering wheel is 0.52 m
       * ahead of the hip and 0.34 m above it, its column 0.4 rad above level. A body may give its own (`seats`).
       */
      const CAR_TWO_SEATERS = new Set([
        'sport', 'roadster', 'hotrod', 'supercar', 'chevette', 'brutini', 'cavalino',
        'valkyrie', 'dbs', 'zr1x', 'chevetteSE', 'wayron', 'tourbillon', 'jasko', 'sirocco', 'novera', 'w1', 'lafera',
      ]);
      // Upholstery, dash and accent per body (the rest: charcoal cloth, a satin dash).
      const CAR_CABIN_TRIM = {
        default: { seat: '#34363a', dash: '#1b1c1f', accent: '#5b6066' },
        taxi: { seat: '#4a443d', dash: '#232220', accent: '#3c3a37', screen: false },
        coupe: { seat: '#e4e1da', dash: '#202124', accent: '#8f969d' },
        muscle: { seat: '#1e1e20', dash: '#18191b', accent: '#7a1e1e', screen: false },
        sport: { seat: '#7a4127', dash: '#1d1d1f', accent: '#8b8f94' },
        rally: { seat: '#26272b', dash: '#17181a', accent: '#2c5aa0' },
        hotrod: { seat: '#7c2a22', dash: '#2a1d16', accent: '#c9ced3', screen: false },
        supercar: { seat: '#8c2a24', dash: '#1a1a1c', accent: '#3a3c40' },
        luxury: { seat: '#cdb48e', dash: '#2b2420', accent: '#5a3a22' },
        limousine: { seat: '#d9d0c0', dash: '#24201d', accent: '#5a3a22' },
        suv: { seat: '#a88c6c', dash: '#1d1c1b', accent: '#4a3a2c' },
        van: { seat: '#2c2e31', dash: '#202224', accent: '#3a3d41', screen: false },
        pickup: { seat: '#3b3a37', dash: '#1f2022', accent: '#5a5d61' },
        chevette: { seat: '#1c1c1e', dash: '#161618', accent: '#b8202a' },
        brutini: { seat: '#1b1b1d', dash: '#121214', accent: '#c9a227' },
        cavalino: { seat: '#b5462c', dash: '#18181a', accent: '#2a2b2e' },
        police: { seat: '#26282b', dash: '#17181a', accent: '#3a3d41' },
      };
      const ciMatrix = new Three.Matrix4(),
        ciQuat = new Three.Quaternion(),
        ciPos = new Three.Vector3(),
        ciScale = new Three.Vector3(),
        ciA = new Three.Vector3(),
        ciB = new Three.Vector3(),
        ciC = new Three.Vector3(),
        ciZ = new Three.Vector3(0, 0, 1),
        ciY = new Three.Vector3(0, 1, 0);
      // The rear glass's x at height y (its foot to its top, as glassPoint lays it), and the front's.
      function cabinGlassX(g, l, y, front) {
        const t = clamp((y - g.base) / Math.max(1e-6, g.roof - g.base), 0, 1);
        return lerpNumber((front ? g.xf : g.xb) * l, (front ? g.rf : g.rb) * l, t);
      }
      // The glass's half width at height y.
      function cabinGlassHalf(g, w, y) {
        const t = clamp((y - g.base) / Math.max(1e-6, g.roof - g.base), 0, 1);
        return lerpNumber(g.wb, g.wt, t) * w + (g.bow || 0) * w * Math.sin(Math.PI * t);
      }
      /*
       * Where the people sit, in the model's frame (x ahead, y up, z right; `M` units to the metre): the driver's hip
       * (x, y, z), how far the seat backs lie back (`recline`, radians from upright), the passenger mirrored, the rear
       * bench's hip x (null: no rear seats), the wheel's centre, radius and column angle.
       */
      function carSeatPlan(g, l, w, M, name, own = null) {
        const width = w / 0.87,
          roof = g.roof + (g.arch || 0) * 0.6,
          floor = Math.max(0.2 * M, g.base - 0.62 * M);
        let x = own?.x !== undefined ? own.x * l : g.xf * l - 1.4 * M,
          y = own?.y !== undefined ? own.y * M : g.base - 0.42 * M;
        // A crown 0.88 m over the hip when upright: low roofs lie the seat back, then lower it.
        let recline = g.open ? 0.3 : clamp(Math.acos(clamp((roof - 0.07 * M - y) / (0.88 * M), 0, 1)), 0.3, 0.62);
        if (!g.open && y + 0.88 * M * Math.cos(recline) > roof - 0.07 * M) y = Math.max(floor, roof - 0.07 * M - 0.88 * M * Math.cos(recline));
        const back = (yy, along) => [x - 0.06 * M - Math.sin(recline) * along, yy + Math.cos(recline) * along];
        // The seat back's top (with its headrest) inside the rear glass, and the hip behind the wheel's room.
        if (!g.open && own?.x === undefined) {
          const [tx, ty] = back(y + 0.02 * M, 0.86 * M),
            limit = cabinGlassX(g, l, ty, false) + 0.08 * M;
          if (tx < limit) x += limit - tx;
          // Behind a cab (the van's bulkhead): the seat under the cab's glass.
          if (x < g.xb * l + 0.3 * M) x = g.xb * l + 0.3 * M;
        }
        // Side by side inside the glass at head height.
        const headY = y + 0.7 * M * Math.cos(recline),
          side = own?.z !== undefined ? own.z * M : Math.max(0.16 * M, Math.min(0.2 * width, cabinGlassHalf(g, w, headY) - 0.19 * M));
        // The rear bench a step back, its back (and headrests) as tall as the rear glass leaves room for: none in a
        // two-seater or where not even a low back fits under a fastback's glass.
        let rear = null,
          rearBack = 0;
        if (!CAR_TWO_SEATERS.has(name) && !g.open) {
          const step = name === 'limousine' ? Math.max(0.8 * M, x - (g.xb * l + 0.9 * M)) : 0.8 * M,
            rx = x - step,
            rearRecline = recline + 0.08;
          for (let along = 0.86; along >= 0.42; along -= 0.04) {
            const topX = rx - 0.06 * M - Math.sin(rearRecline) * along * M,
              topY = y + 0.06 * M + Math.cos(rearRecline) * along * M;
            if (topX > cabinGlassX(g, l, topY, false) + 0.05 * M && topY < roof - 0.05 * M) {
              rear = rx;
              rearBack = along;
              break;
            }
          }
        }
        const wheel = own?.wheel ? { x: own.wheel[0] * M + g.xf * l, y: own.wheel[1] * M } : { x: x + 0.52 * M, y: y + 0.34 * M };
        return {
          M,
          x,
          y,
          z: -side,
          recline,
          rear,
          rearY: y + 0.04 * M,
          // How far up the rear back reaches (metres, headrests included when it is 0.7 or more).
          rearBack,
          rearRecline: recline + 0.08,
          wheel: { x: wheel.x, y: wheel.y, z: -side, r: 0.185 * M, tilt: own?.tilt ?? 0.4 },
          two: CAR_TWO_SEATERS.has(name),
        };
      }
      // A point on the wheel's rim at `clock` radians from the top (positive to the right), into `out` ([x, y, z]).
      function carWheelRim(wheel, clock, out, reach = 1) {
        const s = Math.sin(wheel.tilt),
          c = Math.cos(wheel.tilt),
          r = wheel.r * reach;
        out[0] = wheel.x + Math.cos(clock) * r * s;
        out[1] = wheel.y + Math.cos(clock) * r * c;
        out[2] = wheel.z + Math.sin(clock) * r;
        return out;
      }
      /*
       * The cabin's parts for a kit, handed to `emit(geometry, matrix, color, finish)` (the civilian trim adds them with
       * a finish, the police trim with its colour only). `plan` from carSeatPlan, `trim` from CAR_CABIN_TRIM, `opts`:
       * { hatch, police, deckY(x) the shell's top along the centre line (the parcel shelf sits on it) }.
       */
      function carCabinParts(emit, g, l, w, plan, trim, opts = {}) {
        const M = plan.M,
          S = civShapeKit(),
          seat = trim.seat,
          base = g.base,
          // A bar from a to b (rounded where it is thick enough to show it): `height` along `up`'s side, `depth` across.
          bar = (a, b, height, depth, radius, color, finish, up = [1, 0, 0]) => {
            ciA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            const length = ciA.length();
            if (length < 1e-4) return;
            ciA.divideScalar(length);
            ciC.set(up[0], up[1], up[2]).cross(ciA);
            if (ciC.lengthSq() < 1e-8) ciC.set(0, 0, 1);
            ciC.normalize();
            ciB.crossVectors(ciA, ciC).normalize();
            const thin = Math.min(height, depth) < 0.07 * CAR_M * (M / CAR_M);
            if (thin) ciMatrix.makeBasis(ciC.multiplyScalar(depth), ciB.multiplyScalar(height), ciA.multiplyScalar(length));
            else ciMatrix.makeBasis(ciC, ciB, ciA);
            ciMatrix.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
            emit(thin ? boxGeo : roundedBar(+length.toFixed(2), +height.toFixed(2), +depth.toFixed(2), +Math.min(radius, height / 2, depth / 2).toFixed(2)), ciMatrix, color, finish);
          },
          box = (x0, y0, z0, x1, y1, z1, color, finish) => {
            ciMatrix.compose(ciPos.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ciQuat.identity(), ciScale.set(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)));
            emit(boxGeo, ciMatrix, color, finish);
          },
          // A unit shape round the axis `n` (from +y for cylinders, +z for the torus) at p, scaled (r, t, r).
          round = (geo, p, n, r, t, color, finish, fromAxis = ciY) => {
            ciA.set(n[0], n[1], n[2]).normalize();
            ciQuat.setFromUnitVectors(fromAxis, ciA);
            ciMatrix.compose(ciPos.set(p[0], p[1], p[2]), ciQuat, fromAxis === ciZ ? ciScale.set(r, r, t) : ciScale.set(r, t, r));
            emit(geo, ciMatrix, color, finish);
          },
          rec = plan.recline,
          // Up the seat back from the hip: [x, y] `along` metres up it, lying back `r`.
          up = (hipX, hipY, along, r = rec) => [hipX - 0.06 * M - Math.sin(r) * along * M, hipY + 0.02 * M + Math.cos(r) * along * M];
        // ---- Seats: the back's upper half rounded, a headrest over a gap, the cushion a box ----
        // A seat: the back `reach` metres up from the hip, a headrest over a gap when it reaches 0.7 m or more.
        const seatAt = (hipX, hipY, z, width, headrests, reach = 0.84, r = rec) => {
          const backTop = reach >= 0.7 ? reach - 0.24 : reach,
            [x0, y0] = up(hipX, hipY, 0.02, r),
            [x1, y1] = up(hipX, hipY, backTop, r);
          box(hipX - 0.08 * M, hipY - 0.12 * M, z - width / 2, hipX + 0.42 * M, hipY + 0.02 * M, z + width / 2, seat, 'leather');
          bar([x0, y0, z], [x1, y1, z], 0.13 * M, width, 0.05 * M, seat, 'leather');
          if (reach >= 0.7)
            for (const hz of headrests) {
              const [hx0, hy0] = up(hipX, hipY, backTop + 0.06, r),
                [hx1, hy1] = up(hipX, hipY, reach, r);
              bar([hx0, hy0, z + hz], [hx1, hy1, z + hz], 0.11 * M, 0.27 * M, 0.045 * M, seat, 'leather');
            }
        };
        const sz = Math.abs(plan.z),
          inner = cabinGlassHalf(g, w, base) - 0.05 * M;
        for (const side of [-1, 1]) seatAt(plan.x, plan.y, side * sz, Math.min(0.5 * M, sz * 2 - 0.08 * M), [0]);
        if (plan.rear !== null) {
          const benchHalf = Math.min(inner, sz + 0.27 * M);
          seatAt(plan.rear, plan.rearY, 0, benchHalf * 2, [-sz, sz], plan.rearBack, plan.rearRecline);
          // A parcel shelf from the bench's top back to the rear glass (saloons).
          if (!opts.hatch) {
            const [bx] = up(plan.rear, plan.rearY, Math.min(0.6, plan.rearBack), plan.rearRecline),
              shelfY = Math.max(base + 0.02 * M, opts.deckY ? opts.deckY(bx) + 0.015 * M : 0),
              gx = cabinGlassX(g, l, shelfY + 0.03 * M, false) + 0.03 * M;
            if (gx < bx - 0.1 * M) box(gx, shelfY - 0.04 * M, -inner * 0.95, bx - 0.04 * M, shelfY, inner * 0.95, trim.dash, 'matte');
          }
        } else if (plan.two && !g.open) {
          // A two-seater's bulkhead behind the seats (the engine or the boot beyond it), low enough to see heads over.
          const [bx] = up(plan.x, plan.y, 0.1);
          box(bx - 0.16 * M, base - 0.3 * M, -inner, bx - 0.1 * M, base + 0.1 * M, inner, trim.dash, 'matte');
        }
        // ---- Dashboard: the slab under the screen, the binnacle over the dials, a screen, a trim strip ----
        const wh = plan.wheel,
          dashTop = Math.max(base + 0.04 * M, wh.y + 0.1 * M),
          dashFront = cabinGlassX(g, l, dashTop, true) - 0.03 * M,
          dashRear = wh.x + 0.12 * M,
          half = cabinGlassHalf(g, w, dashTop) - 0.04 * M;
        if (dashFront > dashRear + 0.05 * M) {
          box(dashRear + 0.04 * M, base - 0.32 * M, -half, dashFront, dashTop - 0.03 * M, half, trim.dash, 'satin');
          // The top's rounded rear edge across the cabin and its face toward the people.
          bar([dashRear + 0.06 * M, dashTop - 0.045 * M, -half], [dashRear + 0.06 * M, dashTop - 0.045 * M, half], 0.07 * M, 0.12 * M, 0.035 * M, trim.dash, 'satin', [0, 1, 0]);
          bar([(dashRear + dashFront) / 2 + 0.04 * M, dashTop - 0.03 * M, -half], [(dashRear + dashFront) / 2 + 0.04 * M, dashTop - 0.03 * M, half], 0.03 * M, dashFront - dashRear - 0.1 * M, 0.01 * M, trim.dash, 'satin', [0, 1, 0]);
          box(dashRear + 0.02 * M, dashTop - 0.12 * M, -half * 0.96, dashRear + 0.04 * M, dashTop - 0.09 * M, half * 0.96, trim.accent, opts.police ? 'satin' : 'gloss');
          // The binnacle's hood over the dials, in front of the driver.
          bar([wh.x + 0.2 * M, dashTop + 0.01 * M, wh.z - 0.17 * M], [wh.x + 0.2 * M, dashTop + 0.01 * M, wh.z + 0.17 * M], 0.08 * M, 0.2 * M, 0.035 * M, trim.dash, 'satin', [0, 1, 0]);
          // A centre screen standing on the dash (a patrol car's laptop on its mount lower down).
          if (trim.screen !== false) box(dashRear + 0.1 * M, dashTop - 0.02 * M, -0.11 * M, dashRear + 0.12 * M, dashTop + 0.11 * M, 0.11 * M, '#0b0c0e', 'lens');
        }
        // ---- The steering wheel: rim, three spokes, hub and column ----
        const n = [-Math.cos(wh.tilt), Math.sin(wh.tilt), 0],
          p = [0, 0, 0],
          q = [0, 0, 0];
        round(S.torus, [wh.x, wh.y, wh.z], n, wh.r, wh.r, '#141416', 'leather', ciZ);
        for (const clock of [-Math.PI / 2, Math.PI / 2, Math.PI]) {
          carWheelRim(wh, clock, p, 0.95);
          carWheelRim(wh, clock, q, 0.25);
          bar(q, p, 0.02 * M, 0.05 * M, 0.01 * M, '#1d1e21', 'satin', n);
        }
        round(S.cylinderLow, [wh.x - n[0] * 0.01 * M, wh.y - n[1] * 0.01 * M, wh.z], n, 0.06 * M, 0.05 * M, '#1d1e21', 'satin');
        bar([wh.x, wh.y, wh.z], [wh.x + Math.cos(wh.tilt) * 0.34 * M, wh.y - Math.sin(wh.tilt) * 0.34 * M, wh.z], 0.07 * M, 0.07 * M, 0.03 * M, '#18191b', 'satin', [0, 1, 0]);
        // ---- The mirror at the top of the screen ----
        if (!g.open) {
          const my = g.roof - 0.09 * M,
            mx = cabinGlassX(g, l, my, true) - 0.07 * M;
          box(mx - 0.015 * M, my - 0.035 * M, -0.12 * M, mx + 0.015 * M, my + 0.035 * M, 0.12 * M, '#141517', 'satin');
          box(mx, my + 0.03 * M, -0.012 * M, mx + 0.05 * M, g.roof + (g.arch || 0) * 0.5, 0.012 * M, '#141517', 'satin');
        }
        // ---- A patrol car: the cage behind the front seats (bars to see the crew through) and the laptop ----
        if (opts.police) {
          const [cx] = up(plan.x, plan.y, 0.2),
            x = cx - 0.2 * M,
            top = g.roof - 0.06 * M,
            cageHalf = cabinGlassHalf(g, w, (base + top) / 2) - 0.03 * M;
          for (const yy of [base + 0.02 * M, lerpNumber(base, top, 0.5), top]) box(x - 0.015 * M, yy - 0.015 * M, -cageHalf, x + 0.015 * M, yy + 0.015 * M, cageHalf, '#1a1c1f', 'satin');
          for (const zz of [-cageHalf * 0.98, -cageHalf * 0.33, cageHalf * 0.33, cageHalf * 0.98]) box(x - 0.015 * M, base - 0.1 * M, zz - 0.015 * M, x + 0.015 * M, top, zz + 0.015 * M, '#1a1c1f', 'satin');
          box(wh.x - 0.05 * M, dashTop - 0.06 * M, -0.12 * M, wh.x + 0.14 * M, dashTop - 0.04 * M, 0.12 * M, '#202226', 'satin');
          box(wh.x + 0.12 * M, dashTop - 0.06 * M, -0.12 * M, wh.x + 0.14 * M, dashTop + 0.11 * M, 0.12 * M, '#0d0e10', 'lens');
        }
      }
      // ---- CAR GLASS ---------------------------------------------------------------------
      /**
       * CAR GLASS
       * A tinted, see-through pane: the cabin behind it shows through the tint (`opacity` is the tint's share), the
       * reflection lies over it unweakened (premultiplied alpha: the sky and street slide over the glass as the car
       * turns), and toward grazing angles the pane turns to mirror (Fresnel), as real side glass does. Past
       * CAR_GLASS_CLEAR the tint closes to CAR_GLASS_FAR_TINT over a few metres: the people are drawn only inside that
       * reach (crowd3d-driveby.js OCCUPANT_REACH), so an empty far cabin never shows. A dielectric with a coated glass's
       * F0 (0.07) under the city's lamp light (cityMaterialPatch); the haze is applied to the unpremultiplied colour.
       * The body impostors keep an opaque glass (`glassFar`): they are far beyond the reach.
       */
      const CAR_GLASS_CLEAR = [24 * CAR_M, 36 * CAR_M],
        CAR_GLASS_FAR_TINT = 0.92,
        CAR_GLASS_OUTPUT = `
        // CAR GLASS (cars3d-interior.js): the tint, then the reflection over it; mirror toward grazing angles.
        float carGlassNV = saturate( dot( geometryNormal, geometryViewDir ) );
        float carGlassTint = mix( diffuseColor.a, ${CAR_GLASS_FAR_TINT.toFixed(2)}, smoothstep( ${CAR_GLASS_CLEAR[0].toFixed(1)}, ${CAR_GLASS_CLEAR[1].toFixed(1)}, length( vViewPosition ) ) );
        float carGlassEdge = pow( 1.0 - carGlassNV, 5.0 );
        gl_FragColor = vec4( totalDiffuse * carGlassTint + totalSpecular + totalEmissiveRadiance, carGlassTint + ( 1.0 - carGlassTint ) * carGlassEdge );`;
      function carGlassPatch(material, key = 'car-glass') {
        material.onBeforeCompile = (shader) => {
          cityMaterialPatch(shader);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.specularColor = vec3( 0.07 );')
            .replace('#include <opaque_fragment>', CAR_GLASS_OUTPUT)
            .replace('#include <fog_fragment>', 'float carGlassAlpha = max( gl_FragColor.a, 1e-3 );\ngl_FragColor.rgb /= carGlassAlpha;\n#include <fog_fragment>\ngl_FragColor.rgb *= carGlassAlpha;')
            .replace('#include <premultiplied_alpha_fragment>', '');
        };
        material.customProgramCacheKey = () => key;
        return material;
      }
      // A see-through glass of tint `color`, `opacity` its share in front of the cabin.
      function carGlassMaterial(color, opacity = 0.5, envMapIntensity = 1.7) {
        return carGlassPatch(new Three.MeshStandardMaterial({ color, roughness: 0.04, metalness: 0, envMapIntensity, transparent: true, opacity, premultipliedAlpha: true }));
      }
