      // Lighting 3D cutaway occluders (updateCutaway, setCharacterCutaway) and the default material patches.
      /* Occluders: buildings, and decks or roofs over the street (airCoverVolumes),
         that stand between the camera and the player, found by casting rays from
         the player's middle and head towards the camera through each one's box
         (grown by `margin`, so the hole opens just before the player is lost). */
      const occluderRay = { x: 0, y: 0, z: 0 };
      // The slab test on one axis: narrows [slabNear, slabFar] and says whether it is still non-empty.
      // (Plain module-level numbers: this runs for every building near the player on every frame,
      // and an array per axis and a closure per height were most of the cutaway's garbage.)
      let slabNear = 0,
        slabFar = 0;
      function slabHit(origin, direction, half) {
        if (Math.abs(direction) < 1e-6) return Math.abs(origin) <= half;
        let t0 = (-half - origin) / direction,
          t1 = (half - origin) / direction;
        if (t0 > t1) {
          const swap = t0;
          t0 = t1;
          t1 = swap;
        }
        if (t0 > slabNear) slabNear = t0;
        if (t1 < slabFar) slabFar = t1;
        return slabNear <= slabFar;
      }
      function rayHitsBox(px, py, pz, localX, localZ, hx, hz, bottom, top) {
        // Slab test in the box's own frame: px/pz and localX/localZ are the ray's
        // origin and direction already turned into it; y is shared.
        slabNear = 0.5;
        slabFar = 1e9;
        if (!slabHit(px, localX, hx) || !slabHit(pz, localZ, hz)) return false;
        // Height: the ray climbs, so it is inside the box's span between these.
        const dy = occluderRay.y;
        if (dy > 1e-6) {
          slabNear = Math.max(slabNear, (bottom - py) / dy);
          slabFar = Math.min(slabFar, (top - py) / dy);
        } else if (py < bottom || py > top) return false;
        return slabNear < slabFar;
      }
      // Whether the ray from any of `heights` (metres up the subject) hits the box.
      function rayHitsBoxAt(heights, px, pz, localX, localZ, hx, hz, bottom, top) {
        for (let i = 0; i < heights.length; i++) if (rayHitsBox(px, heights[i], pz, localX, localZ, hx, hz, bottom, top)) return true;
        return false;
      }
      function findOccluders(x, y, heights, margin, list) {
        const ray = occluderRay;
        if (camera.isPerspectiveCamera) {
          ray.x = camera.position.x - x;
          ray.y = camera.position.y - heights[0];
          ray.z = camera.position.z - y;
        } else {
          camera.getWorldDirection(cutawayEdge);
          ray.x = -cutawayEdge.x;
          ray.y = -cutawayEdge.y;
          ray.z = -cutawayEdge.z;
        }
        const length = Math.hypot(ray.x, ray.y, ray.z) || 1;
        ray.x /= length;
        ray.y /= length;
        ray.z /= length;
        if (ray.y < 0.05) return;
        // How far a ray can travel sideways before it clears the tallest roof.
        const reach = ((streetCeiling() - heights[0]) / ray.y) * Math.hypot(ray.x, ray.z) + margin;
        for (const o of allBuildings) {
          const b = o.b;
          if (o.height <= heights[0]) continue;
          if (b.x > x + reach || b.x + b.w < x - reach || b.y > y + reach || b.y + b.h < y - reach) continue;
          // The player inside this building is coversOver()'s case.
          if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) continue;
          const cx = b.x + b.w / 2,
            cy = b.y + b.h / 2;
          if (!rayHitsBoxAt(heights, x - cx, y - cy, ray.x, ray.z, b.w / 2 + margin, b.h / 2 + margin, -60, o.height)) continue;
          list.push({ x: cx, y: cy, hx: b.w / 2 + 2, hy: b.h / 2 + 2, a: 0, bottom: -60, top: o.height + 24, near: Math.hypot(cx - x, cy - y) });
        }
        for (const b of airCoverVolumes()) {
          if (b.height <= heights[0] || b.minHeight <= heights[0] + 4) continue;
          if (Math.abs(b.x - x) > reach + b.hx + b.hy || Math.abs(b.y - y) > reach + b.hx + b.hy) continue;
          const local = coverLocal(b, x, y),
            cos = b.cos ?? Math.cos(b.a),
            sin = b.sin ?? Math.sin(b.a),
            localX = ray.x * cos + ray.z * sin,
            localZ = -ray.x * sin + ray.z * cos;
          if (!rayHitsBoxAt(heights, local.x, local.y, localX, localZ, b.hx + margin, b.hy + margin, b.minHeight, b.height)) continue;
          list.push({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, a: b.a, bottom: b.minHeight - 8, top: b.height + 2, near: Math.hypot(b.x - x, b.y - y) });
        }
        list.sort((p, q) => p.near - q.near);
      }
      const cutawayOccluders = [];
      function setCutBox(box, span, cover) {
        if (!cover) {
          box.set(0, 0, 0, 0);
          return;
        }
        box.set(cover.x, cover.y, cover.hx + 1, cover.hy + 1);
        span.set(Math.cos(cover.a || 0), Math.sin(cover.a || 0), cover.bottom, cover.top);
      }
      function updateCutaway(elevation) {
        const u = cityLightUniforms,
          car = player.car;
        u.cityCutaway.value.z = 0;
        // Never in the air, on or in the water, on the map, or when switched off.
        if (!characterCutaway || gameMode === 'map' || player.parachute || player.swimming || player.hidden) return;
        if (transitRide || taxiRide || (car && (isAircraft(car) || isBoat(car)))) return;
        const spec = car ? vehicleSpec(car) : null,
          bodyHeight = car ? (spec.truck ? 32 : 18) : PERSON_HEIGHT + 1,
          radius = car ? Math.hypot(spec.l, spec.w) / 2 + 6 : CUTAWAY_RADIUS_ON_FOOT,
          covers = coversOver(player.x, player.y, elevation + bodyHeight, elevation, car ? 0 : 3, !!car);
        // Anything standing between the camera and the player (a tower south of
        // them, a viaduct deck): only when no roof over them already takes both slots.
        cutawayOccluders.length = 0;
        if (covers.length < 2) {
          findOccluders(player.x, player.y, [elevation + bodyHeight * 0.45, elevation + bodyHeight], radius * 0.4, cutawayOccluders);
          for (const o of cutawayOccluders) if (covers.length < 2) covers.push(o);
        }
        if (!covers.length) return;
        setCutBox(u.cityCutBoxA.value, u.cityCutSpanA.value, covers[0]);
        setCutBox(u.cityCutBoxB.value, u.cityCutSpanB.value, covers[1]);
        sceneBufferSize(cutawaySize);
        const middle = elevation + bodyHeight * 0.5;
        cutawayPoint.set(player.x, middle, player.y).applyMatrix4(camera.matrixWorldInverse);
        const depth = -cutawayPoint.z;
        cutawayPoint.set(player.x, middle, player.y).project(camera);
        cutawayEdge.set(player.x + radius, middle, player.y).project(camera);
        const pixels = Math.hypot((cutawayEdge.x - cutawayPoint.x) * cutawaySize.x, (cutawayEdge.y - cutawayPoint.y) * cutawaySize.y) / 2;
        if (Math.abs(cutawayPoint.x) > 1.2 || Math.abs(cutawayPoint.y) > 1.2 || cutawayPoint.z > 1) return;
        u.cityCutaway.value.set(
          (cutawayPoint.x * 0.5 + 0.5) * cutawaySize.x,
          (cutawayPoint.y * 0.5 + 0.5) * cutawaySize.y,
          pixels,
          // Only what stands between the camera and the player.
          depth - (car ? spec.l * 0.3 : 4),
        );
      }
      function setCharacterCutaway(on) {
        characterCutaway = !!on;
      }
      Three.MeshStandardMaterial.prototype.onBeforeCompile = cityMaterialPatch;
      /**
       * DORMANT LIGHTS
       * three.js runs the BRDF (RE_Direct) for every point and spot light of the scene at every
       * pixel of every lit material, whether the light reaches it or not. Here most are off
       * (muzzle, fire, searchlight: kept in the scene at intensity 0 so the programs never
       * change) or far away, so the BRDFs summed zero. getPointLightInfo / getSpotLightInfo
       * already flag a light that adds nothing here (`directLight.visible`: its colour, after
       * the distance and cone falloff, is zero): the BRDF waits for that flag. Same result,
       * the work skipped where it was zero.
       */
      {
        const brdf = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
          parts = Three.ShaderChunk.lights_fragment_begin.split(brdf);
        if (parts.length > 1) Three.ShaderChunk.lights_fragment_begin = parts.join('if ( directLight.visible ) ' + brdf);
      }
      // Unlit materials that opted out of tone mapping (signs, ad panels, screens)
      // were designed as final screen colours: carry them through the HDR pipeline.
      if (hdrCapable) {
        Three.MeshBasicMaterial.prototype.onBeforeCompile = function (shader) {
          if (this.toneMapped) return;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n#include <city_hdr_pars>')
            .replace(
              '#include <colorspace_fragment>',
              '#include <colorspace_fragment>\ngl_FragColor.rgb = cityInverseTone( clamp( gl_FragColor.rgb, 0.0, 1.0 ) ) * 1.15;',
            );
        };
        Three.MeshBasicMaterial.prototype.customProgramCacheKey = function () {
          return this.toneMapped ? 'tone' : 'display';
        };
      }
