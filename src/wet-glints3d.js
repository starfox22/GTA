      // WET LAMP GLINTS: the street lamps' reflections in the wet road, as glossy GGX highlights of the nearest lamp
      // heads (a per-frame list of WET_GLINT_SLOTS lamps, uniforms only) in place of the light map's smeared pools.
      /**
       * WET LAMP GLINTS (ground shader, after the lights; surfaces3d.js GROUND_WET_LIGHT)
       * A lamp seen in wet asphalt is its head mirrored by the water film: a highlight where the half-vector of the
       * eye and the lamp head lines up with the road's normal. The ground shader evaluates that for each lamp head in
       * the list with the GGX lobe three.js lights use (Smith visibility, Schlick Fresnel from water's F0 0.02):
       *  - the lobe's width is the wet surface's own roughness (`material.roughness`: the damp film ~0.3, a puddle
       *    0.09, plus three's specular anti-aliasing), broken up by a roughness texture at two scales, so a streak
       *    runs mirror-sharp across a puddle, soft and dim over the film, and not at all over a dry crown;
       *  - at a grazing view (the chase camera) the same lobe stretches into a long streak towards the viewer and
       *    Fresnel brightens it; from the street camera's 50 degree view the glint is a small, faint spot just
       *    south of the lamp's foot, where its mirror image lies;
       *  - two lobes: the water film's (a third of the surface's width: the streak's bright core) and the
       *    surface's own (its soft skirt);
       *  - the lamp's head size widens each lobe (Karis' sphere-light normalisation), so nothing is a pin-point;
       *  - the game's range is compressed (a lamp head is not a thousand times the road), so the street view lifts
       *    the glint (`streetGain`) where water's Fresnel would leave 2 %; the wet reflections pass compresses
       *    what is far brighter than a lit facade (postfx3d.js), so a lamp is not mirrored twice;
       *  - rain rings in the puddles tilt the normal (GROUND_NORMAL), so the glints shiver in the rain.
       * Only the ground draws them; nothing is added above the road. The sources (wetGlintSources, built once):
       * the city's street lamps (`lamps`), Monarch Isle's lanterns (`monarchLamps`) and what the world registers
       * with addWetGlint (bridge deck lamps, village and county lanterns, lit signs as wide soft sources, at most
       * `signSlots` of the list); besides the ground, the bridge road and the scenic roads draw them
       * (wetGlintPatch). They replace the fixed
       * additive smear each lamp used to lay south of its foot (signage3d.js addStreak: the same streak at every
       * angle, wet or drying) and the light map's pools smeared along the view (shop windows and neon spill
       * streaked where no lamp stood). The list (updateWetGlints, every frame from updateWetGround): the lit
       * sources (not knocked flat; the blackout's district power) within reach of the view, nearest first (the
       * chase camera: in front of it; a source a building hides from the lens fades out, a few tested a frame);
       * each fades in and out over a third of a second, so one joining or leaving the list never pops.
       * Console `wetGlints()`.
       */
      const WET_GLINT = {
          slots: { LOW: 0, MEDIUM: 20, HIGH: WET_GLINT_SLOTS, ULTRA: WET_GLINT_SLOTS },
          // Lit signs take at most this many of the slots (the lamps keep the rest).
          signSlots: { LOW: 0, MEDIUM: 5, HIGH: 10, ULTRA: 10 },
          // How bright a street lamp's head is (scene-linear irradiance at 1 unit: ~0.3 at its foot 9 m below,
          // times the night's lamp power), and its size (units), which widens the lobe.
          intensity: 1500,
          radius: 2.6,
          // Monarch Isle's lanterns (three small globes 4.6 m up): their strength as a share of a lamp's.
          lanternShare: 0.35,
          // From the street camera's steep view water's Fresnel leaves a lamp's mirror image at 2 % of the head,
          // which the game's compressed range (a lamp head is not a thousand times the road) loses entirely:
          // the street view lifts it by this much, the chase view (Fresnel already strong at a grazing view) less.
          streetGain: 4,
          chaseGain: 1.8,
          lanternRadius: 1.8,
          streetReach: 1.15, // the street view: within this times the view's reach of its centre
          chaseReach: 1400, // the chase view: units from the camera
          behind: 120, // the chase view: sources up to this far behind the camera still count (their glints lie ahead)
          fadeRate: 3, // per second
          checksPerFrame: 6, // chase view: sources tested for a building in the way each frame
        },
        // The underside of a street lamp's head (render3d-streetprops.js LAMP_HEIGHT), where its light leaves it.
        LAMP_GLINT_HEIGHT = LAMP_HEIGHT - 1.2,
        wetGlintState = { count: 0, candidates: 0, checked: 0, hidden: 0, reach: 0, signs: 0 },
        wetGlintColour = new Three.Color();
      // The sources, built on the first wet night: head position, colour (scene-linear), strength, size, the key
      // a knocked-down prop has in lampLightOut, whether the city's blackout zones apply.
      let wetGlintSources = null,
        wetGlintFade = null,
        wetGlintHidden = null,
        wetGlintOrder = null,
        wetGlintDist = null,
        wetGlintCheck = 0,
        wetGlintClock = 0;
      function buildWetGlintSources() {
        const list = [];
        for (const l of lamps) {
          const tint = lampTint(l);
          wetGlintColour.setRGB(tint[0] / 255, tint[1] / 255, tint[2] / 255, Three.SRGBColorSpace);
          list.push({ x: l.x + 6, y: LAMP_GLINT_HEIGHT, z: l.y, r: wetGlintColour.r, g: wetGlintColour.g, b: wetGlintColour.b, w: 1, size: WET_GLINT.radius, key: l.x + ',' + l.y, city: true });
        }
        wetGlintColour.set('#ffd9a0');
        for (const l of monarchLamps) {
          const height = (l.kind === 'mole' ? 4.2 : 4.6) * UNITS_PER_METRE - 4;
          list.push({ x: l.x, y: height, z: l.y, r: wetGlintColour.r, g: wetGlintColour.g, b: wetGlintColour.b, w: WET_GLINT.lanternShare, size: WET_GLINT.lanternRadius, key: l.x + ',' + l.y, city: false });
        }
        // Bridge lamps, village and county lanterns, lit signs (addWetGlint, lighting3d-sky.js).
        for (const e of wetGlintExtras) list.push({ x: e.x, y: e.y, z: e.z, r: e.r, g: e.g, b: e.b, w: e.w, size: e.size, key: e.key, city: true, sign: e.kind === 'sign', group: e.group });
        wetGlintSources = list;
        wetGlintFade = new Float32Array(list.length);
        wetGlintHidden = new Uint8Array(list.length);
        wetGlintOrder = new Int32Array(WET_GLINT_SLOTS + 8);
        wetGlintDist = new Float64Array(WET_GLINT_SLOTS + 8);
      }
      // A source on a moving part (a drawbridge leaf): where its group's frame holds it now.
      function wetGlintFollow(src) {
        const e = src.group.group.matrixWorld.elements,
          lx = src.group.x,
          ly = src.group.y,
          lz = src.group.z;
        src.x = e[0] * lx + e[4] * ly + e[8] * lz + e[12];
        src.y = e[1] * lx + e[5] * ly + e[9] * lz + e[13];
        src.z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
      }
      /* The source list for this frame (from updateWetGround, weather3d.js): up to the tier's slots of the lit lamps
         nearest the view, each with its fade. Nothing when the street is dry, the lamps are off or on LOW. */
      function updateWetGlints(tier, active) {
        const st = wetGlintState,
          G = WET_GLINT,
          slots = Math.min(WET_GLINT_SLOTS, G.slots[tier.name] ?? 0),
          dt = clamp(gameTime - wetGlintClock, 0, 0.25);
        wetGlintClock = gameTime;
        st.count = 0;
        st.candidates = 0;
        st.checked = 0;
        st.hidden = 0;
        st.signs = 0;
        if (!active || slots === 0) {
          if (wetGlintFade && st.reach !== 0) wetGlintFade.fill(0);
          st.reach = 0;
          wetGlintUniforms(0);
          return;
        }
        if (!wetGlintSources) buildWetGlintSources();
        const sources = wetGlintSources,
          chase = chaseViewActive,
          cx = chase ? chaseCam.x : viewCenter.x,
          cy = chase ? chaseCam.y : viewCenter.y,
          reach = chase ? G.chaseReach : viewReach * G.streetReach,
          fwdX = chase ? Math.cos(chaseCam.viewYaw) : 0,
          fwdY = chase ? Math.sin(chaseCam.viewYaw) : 0,
          keep = slots + 8,
          step = G.fadeRate * dt;
        st.reach = reach;
        // Nearest first, into a fixed list of `keep`: a source no longer wanted but still showing stays in it, last,
        // while it fades out; one pushed off the end fades from there.
        let kept = 0;
        for (let i = 0; i < sources.length; i++) {
          const src = sources[i];
          if (src.group) wetGlintFollow(src);
          const dx = src.x - cx,
            dy = src.z - cy;
          let want = Math.abs(dx) < reach && Math.abs(dy) < reach;
          if (want && chase && dx * fwdX + dy * fwdY < -G.behind) want = false;
          if (want && lampLightOut.size && lampLightOut.has(src.key)) want = false;
          const d = dx * dx + dy * dy;
          if (want && d > reach * reach) want = false;
          if (!want && wetGlintFade[i] <= 0) continue;
          st.candidates++;
          const key = want ? d : d + 1e12;
          let k;
          if (kept < keep) k = kept++;
          else if (key >= wetGlintDist[keep - 1]) {
            wetGlintFade[i] = Math.max(0, wetGlintFade[i] - step);
            continue;
          } else {
            const out = wetGlintOrder[keep - 1];
            wetGlintFade[out] = Math.max(0, wetGlintFade[out] - step);
            k = keep - 1;
          }
          while (k > 0 && wetGlintDist[k - 1] > key) {
            wetGlintDist[k] = wetGlintDist[k - 1];
            wetGlintOrder[k] = wetGlintOrder[k - 1];
            k--;
          }
          wetGlintDist[k] = key;
          wetGlintOrder[k] = i;
        }
        // The chase view: a few sources a frame are tested for a building between the lens and the head.
        if (chase && kept) {
          for (let n = 0; n < G.checksPerFrame && n < kept; n++) {
            const i = wetGlintOrder[wetGlintCheck++ % kept],
              src = sources[i];
            wetGlintHidden[i] = chaseHiddenFrom(chaseCam.x, chaseCam.y, chaseCam.z, src.x, src.z, src.y, 4) ? 1 : 0;
            st.checked++;
          }
        }
        // The first `slots` by distance fade in (a hidden one keeps its place, to be tested again, but fades out),
        // the rest fade out; those still showing fill the uniforms.
        const strength = G.intensity * (chase ? G.chaseGain : G.streetGain),
          signCap = Math.min(slots, G.signSlots[tier.name] ?? 0),
          zone = cityLightUniforms.cityZonePower.value,
          riverLeft = cityLightUniforms.cityRiverLeft.value,
          A = wetUniforms.cityGlintA.value,
          B = wetUniforms.cityGlintB.value;
        let count = 0,
          signs = 0;
        st.signs = 0;
        for (let k = 0; k < kept; k++) {
          const i = wetGlintOrder[k],
            hidden = chase && wetGlintHidden[i] === 1,
            // Signs past their share of the slots fade out like lamps past the slots.
            overSigns = sources[i].sign && signs++ >= signCap;
          if (hidden) st.hidden++;
          wetGlintFade[i] = k < slots && wetGlintDist[k] < 1e11 && !hidden && !overSigns ? Math.min(1, wetGlintFade[i] + step) : Math.max(0, wetGlintFade[i] - step);
          const fade = wetGlintFade[i];
          if (fade <= 0 || count >= slots) continue;
          const src = sources[i],
            // The blackout job's district power, as cityPower() has it in the shaders.
            power = !src.city || src.x > riverLeft || src.x < -500 ? 1 : src.z < 1450 ? zone.x : src.z < 2650 ? zone.y : zone.z;
          if (power <= 0.001) continue;
          const a = A[count],
            b = B[count],
            w = src.w * strength * fade * fade * (3 - 2 * fade) * power;
          const x = src.x,
            y = src.y,
            z = src.z;
          if (src.sign) st.signs++;
          if (a.x !== x || a.y !== y || a.z !== z || a.w !== w) a.set(x, y, z, w);
          if (b.x !== src.r || b.y !== src.g || b.z !== src.b || b.w !== src.size) b.set(src.r, src.g, src.b, src.size);
          count++;
        }
        st.count = count;
        wetGlintUniforms(count);
      }
      function wetGlintUniforms(count) {
        if (wetUniforms.cityGlintCount.value !== count) wetUniforms.cityGlintCount.value = count;
      }
      /* DeadEndCity.wetGlints(options): the lamp reflections in the wet road as drawn this frame; `options` may set
         the look's numbers for an A/B ({ intensity, streetGain, chaseGain }, finite and not negative). */
      function wetGlintReport(options) {
        if (options && typeof options === 'object')
          for (const key of ['intensity', 'streetGain', 'chaseGain'])
            if (Number.isFinite(options[key]) && options[key] >= 0) WET_GLINT[key] = options[key];
        const st = wetGlintState,
          list = [];
        for (let k = 0; k < Math.min(st.count, 6); k++) {
          const a = wetUniforms.cityGlintA.value[k];
          list.push({ x: Math.round(a.x), y: Math.round(a.z), height: +a.y.toFixed(1), strength: Math.round(a.w) });
        }
        return {
          slots: WET_GLINT_SLOTS,
          tierSlots: WET_GLINT.slots[graphicsTier().name] ?? 0,
          sources: wetGlintSources ? wetGlintSources.length : 0,
          extras: { lamps: wetGlintExtras.filter((e) => e.kind !== 'sign').length, signs: wetGlintExtras.filter((e) => e.kind === 'sign').length, moving: wetGlintExtras.filter((e) => e.group).length },
          signs: st.signs,
          signSlots: WET_GLINT.signSlots[graphicsTier().name] ?? 0,
          count: st.count,
          candidates: st.candidates,
          reach: Math.round(st.reach),
          chaseChecks: st.checked,
          hidden: st.hidden,
          gain: wetUniforms.citySheenGain.value,
          lampPower: +cityLightUniforms.cityLampPower.value.toFixed(3),
          wet: +weather.wet.toFixed(2),
          intensity: WET_GLINT.intensity,
          streetGain: WET_GLINT.streetGain,
          chaseGain: WET_GLINT.chaseGain,
          nearest: list,
          lightMapStreaks: false,
        };
      }
      /* The glint GLSL for a wet surface whose wetness (0..1 of a full mirror's share), standing water and pixel
         footprint (world units) are the GLSL expressions given; it reads `normal`, `material.roughness`,
         `vCityWorld`, cityNoise and the glint uniforms (wetGlintPatch declares them for a surface other than the
         ground), and adds to reflectedLight.directSpecular after the lights. */
      function wetGlintGlsl(wetExpr, puddleExpr, fpExpr) {
        return `
        if ( cityGlintCount > 0.5 && cityLampPower > 0.001 ) {
          float gWet = ${wetExpr}, gPuddle = ${puddleExpr}, gFp = ${fpExpr};
          if ( gWet > 0.003 ) {
          vec3 gP = vCityWorld;
          // Towards the eye (the street camera is orthographic: one direction for the whole frame).
          vec3 gV = isOrthographic ? normalize( vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] ) ) : normalize( cameraPosition - gP );
          vec3 gN = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
          float gNoV = max( dot( gN, gV ), 1e-3 );
          // The roughness texture: worn and exposed aggregate (rougher, dimmer film) in patches a metre or two
          // across, finer grit where a pixel can resolve it; standing water stays smooth.
          float gFine = 1.0 - smoothstep( 0.8, 2.5, gFp );
          float gBreak = cityNoise( gP.xz * 0.085 + 3.0 ) * 0.65 + mix( 0.5, cityNoise( gP.xz * 0.37 + 11.0 ), gFine ) * 0.35;
          float gRough = clamp( material.roughness * mix( mix( 0.72, 1.55, gBreak ), 1.0, gPuddle ), 0.06, 1.0 );
          float gA = gRough * gRough;
          // How much of the surface carries water: the film thins over the worn patches.
          float gCover = clamp( gWet * 2.4, 0.0, 1.0 ) * mix( mix( 1.0, 0.45, smoothstep( 0.45, 0.85, gBreak ) ), 1.0, gPuddle );
          vec3 glint = vec3( 0.0 );
          for ( int i = 0; i < ${WET_GLINT_SLOTS}; i++ ) {
            if ( float( i ) >= cityGlintCount ) break;
            vec4 gLa = cityGlintA[ i ];
            vec3 gl = gLa.xyz - gP;
            float gD2 = dot( gl, gl ), gD = sqrt( gD2 );
            vec3 gL = gl / gD;
            float gNoL = dot( gN, gL );
            if ( gNoL <= 0.0 ) continue;
            vec3 gH = normalize( gL + gV );
            float gNoH = max( dot( gN, gH ), 0.0 ), gVoH = max( dot( gV, gH ), 0.0 );
            vec4 gLb = cityGlintB[ i ];
            // The head's size widens each lobe; D keeps the narrow lobe's energy (a^2 over the wide one's shape).
            // Two lobes: the water film's own (a third of the surface's width: the bright core of the streak)
            // and the surface's (the soft skirt round it), as wet asphalt shows a lamp.
            float gSrc = gLb.w / ( 2.0 * gD ), gNoH2 = gNoH * gNoH;
            float gAe = min( gA + gSrc, 1.0 ), gAe2 = gAe * gAe;
            float gQ = gNoH2 * ( gAe2 - 1.0 ) + 1.0;
            float gAc = max( gA * 0.3, 0.01 ), gAce = min( gAc + gSrc, 1.0 ), gQc = gNoH2 * ( gAce * gAce - 1.0 ) + 1.0;
            float gDist = 0.4 * gA * gA / ( PI * gQ * gQ ) + 0.6 * gAc * gAc / ( PI * gQc * gQc );
            float gVis = 0.5 / ( gNoL * sqrt( gNoV * gNoV * ( 1.0 - gAe2 ) + gAe2 ) + gNoV * sqrt( gNoL * gNoL * ( 1.0 - gAe2 ) + gAe2 ) );
            float gF = 0.02 + 0.98 * pow( 1.0 - gVoH, 5.0 );
            glint += gLb.rgb * ( gLa.w / gD2 * gDist * gVis * gF * gNoL );
          }
          reflectedLight.directSpecular += min( glint, vec3( 48.0 ) ) * ( cityLampPower * gCover * citySheenGain );
        }
        }`;
      }
      const WET_GLINT_GLSL = wetGlintGlsl('wetReflect', 'puddle', 'fp');
      /* WET LAMP GLINTS on another wet surface (a bridge deck, a scenic road): its uniforms and declarations,
         and the glint after the lights; the material keeps its own program (no new one). */
      function wetGlintPatch(shader, wetExpr, puddleExpr, fpExpr) {
        shader.uniforms.cityGlintA = wetUniforms.cityGlintA;
        shader.uniforms.cityGlintB = wetUniforms.cityGlintB;
        shader.uniforms.cityGlintCount = wetUniforms.cityGlintCount;
        shader.uniforms.citySheenGain = wetUniforms.citySheenGain;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + WET_GLINT_PARS)
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + wetGlintGlsl(wetExpr, puddleExpr, fpExpr));
      }
      const WET_GLINT_PARS = `
        uniform vec4 cityGlintA[ ${WET_GLINT_SLOTS} ];
        uniform vec4 cityGlintB[ ${WET_GLINT_SLOTS} ];
        uniform float cityGlintCount;
        uniform float citySheenGain;`;
