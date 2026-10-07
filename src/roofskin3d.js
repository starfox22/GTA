      // Roof skin: the city's roof finishes drawn in world space at screen resolution (membrane sheets, gravel ballast, tar
      // and its repairs, clay tiles, pavers, sedum, ribbed metal), with drains, ponding, parapet grime and the wet look.
      /**
       * ROOF SKIN
       * The street camera looks down on the roofs, a third of its frame, and each roof used to stretch one 256-pixel
       * painting over its whole cap (a 30-unit roof and a 300-unit one alike), so up close every roof read as a soft,
       * stretched placeholder. The roof finishes (cityscape3d-kit.js `roofMaterial`) now share one program that draws
       * the finish in world space: the size of a membrane sheet, a paver or a tile is the same on every roof, and fades
       * to its mean where a pixel cannot resolve it (box-filtered lines, like the ground's).
       *
       *  - The roof's own frame comes from its uv (0..1 across the cap): the uv's world gradient gives the roof's size,
       *    so the shader knows how far each point is from the parapet (`edge`) and from the roof's corner, with nothing
       *    added to the geometry. Sheets and rolls run along the long side, drains sit along it.
       *  - The cap's vertex colour (roofCapGeometry) is the building's tint, and in 8-bit steps it also seeds the roof's
       *    pattern and gives its age: the far copy of the city carries the same colour, so the chase view's far cells
       *    draw the same roof with this material (`farTint`, flight-view3d-far.js).
       *  - Flat roofs fall to drains: a dished sump and a cast iron dome, silt and tide marks where water stood, and in
       *    the rain (HIGH and ULTRA) puddles that ripple there; every finish soaks darker and glossier with the shared
       *    wet pattern (lighting3d-sky.js WET SURFACES), metal and membrane mostly glossier. The roofs never mark the
       *    wet reflections pass (it reflects the street); their puddles mirror the sky's light (`citySkyReflect`).
       *  - LOW skips the detail layers (the ground's `cityDetail` array, no new texture) and the repairs.
       * The air view's far copy keeps each finish's old painting (`map`) under the same tint; the base colours here are
       * those paintings' means, so a roof keeps its tone when the copy takes over.
       */
      const ROOF_SKIN_KINDS = ['gravel', 'membrane', 'tar', 'terracotta', 'pavers', 'green', 'metal'];
      // The old paintings' mean colours (sRGB), per finish.
      const ROOF_SKIN_BASE = {
        gravel: '#8b877e',
        membrane: '#b3b7b1',
        tar: '#505356',
        terracotta: '#a65a3f',
        pavers: '#c1bdb1',
        green: '#5f7d4a',
        metal: '#7f8c93',
      };
      const ROOF_SKIN_PARS = `
        uniform highp sampler2DArray cityDetail;
        uniform float cityGroundDetail;
        uniform float cityRoofKind;
        uniform vec3 cityRoofBase;
        uniform float cityWetDetail;
        uniform vec3 citySkyReflect;
        uniform float cityRain;
        uniform float cityRainTime;
        ${SURFACE_NOISE}
        ${RAIN_RINGS}
        // How much of a pixel w wide centred at x a band hw either side of 0 covers: an exact box filter.
        float roofBand( float x, float hw, float w ) {
          return clamp( ( min( hw, x + 0.5 * w ) - max( -hw, x - 0.5 * w ) ) / w, 0.0, 1.0 );
        }
        // Lines hw either side of u = k * period, box filtered, at their mean share once a pixel spans a period.
        float roofLines( float u, float period, float hw, float fp ) {
          float d = abs( fract( u / period + 0.5 ) - 0.5 ) * period;
          return mix( roofBand( d, hw, fp ), 2.0 * hw / period, smoothstep( 0.25 * period, 0.6 * period, fp ) );
        }
        float roofBox( vec2 q, vec2 h ) {
          vec2 d = abs( q ) - h;
          return length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 );
        }
        vec4 roofLayer( vec2 p, float layer, float tile, vec2 px, vec2 py ) {
          return textureGrad( cityDetail, vec3( p / tile, layer ), px / tile, py / tile );
        }`;
      // In place of the map: the finish, then drains, ponding, the parapet's foot and the wet film.
      const ROOF_SKIN_ALBEDO = `
        float rRough = 0.9, rMetal = 0.0, rWetFilm = 0.0, rPuddle = 0.0, rWetReflect = 0.0, rFp = 1.0;
        vec2 rWorld = vCityWorld.xz;
        {
          vec2 rdx = dFdx( rWorld ), rdy = dFdy( rWorld );
          rFp = max( max( length( rdx ), length( rdy ) ), 1e-4 );
          float fp = rFp;
          // The roof's size from its uv's world gradient (the uv is affine on the cap's plane).
          vec2 udx = dFdx( vMapUv ), udy = dFdy( vMapUv );
          float det = rdx.x * rdy.y - rdx.y * rdy.x;
          det = abs( det ) > 1e-12 ? det : 1e-12;
          vec2 gu = vec2( rdy.y * udx.x - rdx.y * udy.x, rdx.x * udy.x - rdy.x * udx.x ) / det;
          vec2 gv = vec2( rdy.y * udx.y - rdx.y * udy.y, rdx.x * udy.y - rdy.x * udx.y ) / det;
          vec2 size = clamp( 1.0 / max( vec2( length( gu ), length( gv ) ), vec2( 1e-5 ) ), vec2( 6.0 ), vec2( 4000.0 ) );
          // From the roof's north-west corner, and to its nearest edge (the parapet's coping covers the outer 4 units).
          vec2 rl = vec2( vMapUv.x, 1.0 - vMapUv.y ) * size;
          vec2 inset = min( rl, size - rl );
          float edge = min( inset.x, inset.y );
          #ifdef USE_COLOR
            vec3 tint = vColor.rgb;
          #else
            vec3 tint = vec3( 0.96 );
          #endif
          // The tint is in 8-bit steps: whole numbers for the roof's own hash, a seed, an age.
          vec2 rid = floor( tint.rb * 255.0 + 0.5 );
          vec2 seed = rid * vec2( 0.371, 0.529 );
          float age = clamp( ( 1.03 - tint.g ) / 0.13, 0.0, 1.0 );
          float pick = cityHash( rid + 0.5 );
          bool rich = cityGroundDetail > 0.5;
          bool alongX = size.x >= size.y;
          float across = alongX ? rl.y : rl.x, along = alongX ? rl.x : rl.y;
          float longSide = max( size.x, size.y ), shortSide = min( size.x, size.y );
          float macro = cityNoise( rWorld * 0.019 + seed ) * 0.6 + cityNoise( rWorld * 0.071 + seed.yx ) * 0.4;
          int kind = int( cityRoofKind + 0.5 );
          float level = kind == 3 || kind == 6 ? 0.0 : 1.0;
          // Drains along the long side, one per stretch; the nearest is the one in this stretch.
          float drains = longSide > 300.0 ? 3.0 : longSide > 140.0 ? 2.0 : 1.0;
          float slot = clamp( floor( along / longSide * drains ), 0.0, drains - 1.0 );
          vec2 drainAt = vec2( ( slot + 0.5 + ( cityHash( rid + slot + 1.7 ) - 0.5 ) * 0.3 ) * longSide / drains,
                               shortSide * ( 0.5 + ( cityHash( rid + slot + 4.1 ) - 0.5 ) * 0.3 ) );
          float toDrain = length( vec2( along, across ) - drainAt );
          // Where water stands: the dish round each drain (an uneven ring) and the odd birdbath, never at the parapet.
          float pond = cityNoise( rWorld * 0.042 + seed * 1.7 ) * 0.65 + cityNoise( rWorld * 0.13 + seed.yx ) * 0.35;
          float dish = 1.0 - smoothstep( 1.5, 18.0 + 10.0 * cityNoise( rWorld * 0.09 + seed ), toDrain );
          float low = level * max( dish, smoothstep( 0.78, 0.95, pond ) * 0.75 ) * smoothstep( 5.0, 12.0, edge );
          float tide = roofBand( low - 0.6, 0.012, max( fwidth( low ), 1e-3 ) ) * level;
          vec3 base = cityRoofBase, col = base;
          float porous = 0.8;
          if ( kind == 0 ) {
            // GRAVEL: ballast stones with their own tones; where the wind has thinned it the black membrane shows.
            vec4 lg = rich ? roofLayer( rWorld, 3.0, 5.0, rdx, rdy ) : vec4( 0.45, 0.5, 0.5, 0.5 );
            vec3 pebble = base * mix( vec3( 0.8, 0.82, 0.86 ), vec3( 1.16, 1.07, 0.95 ), lg.g );
            col = mix( base * 0.6, pebble, smoothstep( 0.05, 0.32, lg.r ) ) * ( 0.92 + 0.16 * macro );
            // Raked heaps and hollows: a gentle mottle a couple of metres across.
            col *= 0.95 + 0.1 * cityNoise( rWorld * 0.11 + seed.yx );
            float windward = 1.0 - smoothstep( 4.0, 16.0, edge );
            float scour = smoothstep( 0.8, 0.9, cityNoise( rWorld * 0.085 + seed * 1.3 ) * 0.7 + cityNoise( rWorld * 0.31 ) * 0.3 + 0.1 * windward + 0.05 * age );
            col = mix( col, vec3( 0.06, 0.06, 0.062 ) * ( 0.8 + 0.4 * lg.b ), scour * ( 0.45 + 0.35 * ( 1.0 - lg.r ) ) );
            rRough = 0.95;
            porous = 1.0;
          } else if ( kind == 1 ) {
            // MEMBRANE: single-ply sheets 3 m wide along the long side, welded laps, end laps staggered; chalky with age.
            vec4 cg = rich ? roofLayer( rWorld, 2.0, 9.0, rdx, rdy ) : vec4( 0.5 );
            float sheet = floor( across / 24.0 );
            float sheetTone = cityHash( vec2( sheet, rid.x ) + 3.7 );
            float lapShadow = roofLines( across, 24.0, 0.22, fp );
            float lapWeld = roofLines( across - 1.0, 24.0, 0.6, fp );
            float endLap = roofLines( along + cityHash( vec2( sheet, rid.y ) ) * 96.0, 96.0, 0.22, fp );
            col = base * ( 0.96 + 0.07 * sheetTone ) * ( 0.93 + 0.12 * cg.r ) * ( 0.96 + 0.08 * macro );
            col *= ( 1.0 + 0.05 * lapWeld ) * ( 1.0 - 0.26 * max( lapShadow, endLap ) );
            // Weathering: a chalky grey-brown film in streaks along the sheets (rain runs along the laps), heavier with age.
            float film = smoothstep( 0.4, 0.85, cityNoise( vec2( along * 0.012, across * 0.09 ) + seed ) * 0.7 + cg.a * 0.3 ) * ( 0.3 + 0.6 * age );
            col = mix( col, col * vec3( 0.9, 0.88, 0.84 ), film );
            rRough = 0.7;
            porous = 0.3;
          } else if ( kind == 2 ) {
            // TAR: a mineral cap sheet in 0.95 m rolls; black mopped tar along some laps and over old cracks in
            // wandering runs; aluminium paint on the flashings (and over whole roofs here and there, worn in spots).
            vec4 ag = rich ? roofLayer( rWorld, 0.0, 7.0, rdx, rdy ) : vec4( 0.5 );
            float roll = floor( across / 7.6 );
            float lap = roofLines( across, 7.6, 0.16, fp );
            col = base * ( 0.8 + 0.4 * ag.r ) * ( 0.93 + 0.12 * cityHash( vec2( roll, rid.x ) + 9.1 ) ) * ( 0.92 + 0.16 * macro );
            col *= 1.0 - 0.3 * lap;
            float lapRun = step( 0.6, cityHash( vec2( roll, rid.y ) + 1.3 ) ) * smoothstep( 0.45, 0.6, cityNoise( vec2( along * 0.035, roll * 1.7 ) + seed ) );
            float cn = cityNoise( rWorld * 0.032 + seed * 2.0 + 17.0 ) + ( cityNoise( rWorld * 0.3 ) - 0.5 ) * 0.05;
            float crack = roofBand( cn - 0.5, 0.0055, fp * 0.016 + 1e-4 ) * smoothstep( 0.55, 0.72, cityNoise( rWorld * 0.009 + seed.yx ) + 0.2 * age );
            float blob = max( roofLines( across, 7.6, 0.5, fp ) * lapRun, crack ) * smoothstep( 6.0, 8.0, edge );
            float flashing = 1.0 - smoothstep( 6.2 - 0.5 * fp, 6.2 + 0.5 * fp, edge );
            float coated = step( 0.8, pick ) * ( 1.0 - smoothstep( 0.72, 0.78, cityNoise( rWorld * 0.11 + seed ) * 0.7 + cityNoise( rWorld * 0.43 ) * 0.3 + 0.1 * age ) );
            float silver = max( flashing, coated );
            col = mix( col, vec3( 0.4, 0.41, 0.41 ) * ( 0.75 + 0.35 * ag.r ) * ( 0.9 + 0.1 * macro ), silver * 0.9 );
            col = mix( col, vec3( 0.017, 0.016, 0.015 ), blob );
            rRough = mix( mix( 0.86, 0.5, silver ), 0.34, blob );
            rMetal = 0.3 * silver * ( 1.0 - blob );
            porous = mix( 0.6, 0.15, max( silver, blob ) );
          } else if ( kind == 3 ) {
            // TERRACOTTA: barrel tiles, rows 40 cm apart, each tile its own clay; lichen and sun bleaching with age.
            float rowH = 3.0, tileW = 2.4;
            float row = floor( rl.y / rowH );
            float fx = rl.x / tileW + 0.5 * mod( row, 2.0 );
            float tc = floor( fx ), u = fx - tc, v = rl.y / rowH - row;
            float resU = clamp( ( tileW / fp - 2.0 ) * 0.5, 0.0, 1.0 ), resV = clamp( ( rowH / fp - 2.0 ) * 0.5, 0.0, 1.0 );
            float tileTone = mix( 0.5, cityHash( vec2( tc, row ) + rid * 0.31 ), resU * resV );
            float barrel = mix( 0.95, 0.8 + 0.3 * sin( u * 3.14159 ), resU );
            float lip = mix( 0.9, 1.0 - 0.5 * smoothstep( 0.8, 1.0, v ), resV );
            col = base * mix( vec3( 0.84, 0.88, 0.92 ), vec3( 1.12, 1.0, 0.9 ), tileTone ) * barrel * lip * ( 0.93 + 0.14 * macro );
            float lichen = smoothstep( 0.6, 0.82, cityNoise( rWorld * 0.085 + seed ) ) * ( 0.35 + 0.65 * age );
            col = mix( col, col * vec3( 0.66, 0.68, 0.52 ), lichen * 0.55 );
            col = mix( col, col * vec3( 1.12, 1.1, 1.06 ), smoothstep( 0.5, 0.9, cityNoise( rWorld * 0.03 + seed.yx ) ) * 0.25 );
            rRough = 0.82;
            porous = 0.85;
          } else if ( kind == 4 ) {
            // PAVERS: 60 cm slabs on pedestals, open joints, a gravel margin along the parapet.
            float s = 4.8;
            vec2 cell = floor( rl / s ), f = rl - cell * s;
            float jd = min( min( f.x, s - f.x ), min( f.y, s - f.y ) );
            float res = clamp( ( s / fp - 2.0 ) * 0.4, 0.0, 1.0 );
            float joint = mix( 0.1, roofBand( jd, 0.14, fp ), res );
            vec4 cg = rich ? roofLayer( rWorld, 2.0, 8.0, rdx, rdy ) : vec4( 0.5 );
            float slabTone = mix( 0.5, cityHash( cell + rid * 0.21 ), res );
            col = base * ( 0.9 + 0.16 * slabTone ) * ( 0.88 + 0.24 * cg.r ) * ( 1.0 - 0.45 * joint );
            col *= 1.0 - 0.2 * ( smoothstep( 0.55, 0.85, cg.a ) * 0.35 + smoothstep( 0.66, 0.86, cityNoise( rWorld * 0.11 + seed ) ) * 0.25 );
            float margin = 1.0 - smoothstep( 8.6 - 0.5 * fp, 8.6 + 0.5 * fp, edge );
            col = mix( col, vec3( 0.2, 0.19, 0.17 ) * ( 0.75 + 0.5 * cg.b ), margin );
            rRough = 0.84;
            porous = 0.8;
          } else if ( kind == 5 ) {
            // GREEN: sedum, green and rust red in drifts, a paver path down the middle, gravel at the parapet.
            vec4 ga = rich ? roofLayer( rWorld, 1.0, 10.0, rdx, rdy ) : vec4( 0.5 );
            float sedum = cityNoise( rWorld * 0.09 + seed ) * 0.6 + cityNoise( rWorld * 0.31 ) * 0.4;
            col = base * mix( vec3( 1.0 ), clamp( ga.rgb * 2.0, 0.0, 2.0 ), 0.8 ) * ( 0.82 + 0.36 * sedum );
            col = mix( col, col * vec3( 1.25, 0.85, 0.7 ), smoothstep( 0.62, 0.8, sedum ) * 0.5 );
            float path = 1.0 - smoothstep( 3.0 - 0.5 * fp, 3.0 + 0.5 * fp, abs( across - shortSide * 0.5 ) );
            col = mix( col, vec3( 0.42, 0.41, 0.38 ) * ( 1.0 - 0.4 * roofLines( along, 4.8, 0.12, fp ) ), path );
            float margin = 1.0 - smoothstep( 7.5 - 0.5 * fp, 7.5 + 0.5 * fp, edge );
            col = mix( col, vec3( 0.2, 0.19, 0.17 ), margin );
            rRough = mix( 0.95, 0.85, max( path, margin ) );
            porous = 0.5;
          } else {
            // METAL: standing seams every half metre, panel by panel, rust running down from the laps, the odd
            // fibreglass roof light.
            float pitch = 4.0;
            float rib = roofLines( rl.x, pitch, 0.22, fp ), ribShade = roofLines( rl.x - 0.55, pitch, 0.3, fp );
            float panel = floor( rl.x / pitch );
            float res = clamp( ( pitch / fp - 2.0 ) * 0.4, 0.0, 1.0 );
            float panelTone = mix( 0.5, cityHash( vec2( panel, rid.x ) + 2.3 ), res );
            col = base * ( 0.92 + 0.12 * panelTone ) * ( 1.0 + 0.25 * rib - 0.2 * ribShade ) * ( 0.92 + 0.16 * macro );
            float rust = smoothstep( 0.62, 0.85, cityNoise( vec2( rl.x * 0.6, rl.y * 0.045 ) + seed ) ) * ( 0.3 + 0.7 * age );
            col = mix( col, vec3( 0.2, 0.085, 0.035 ), rust * 0.6 );
            float roofLight = step( 0.86, cityHash( vec2( panel, floor( rl.y / 36.0 ) ) + rid * 0.7 ) ) * res;
            col = mix( col, vec3( 0.46, 0.48, 0.43 ), roofLight * 0.85 );
            rRough = mix( mix( 0.45, 0.8, rust ), 0.35, roofLight );
            rMetal = 0.5 * ( 1.0 - rust ) * ( 1.0 - roofLight );
            porous = 0.05;
          }
          // Repairs on membrane and tar: a newer patch with its seam (white membrane, black tar).
          if ( rich && ( kind == 1 || kind == 2 ) ) {
            vec2 pc = floor( rl / 40.0 ), ph = pc + rid * 0.173;
            if ( cityHash( ph ) > 0.84 - 0.1 * age ) {
              vec2 hs = vec2( 2.5, 2.0 ) + vec2( cityHash( ph + 1.1 ), cityHash( ph + 2.2 ) ) * vec2( 7.0, 5.0 );
              if ( cityHash( ph + 5.5 ) > 0.5 ) hs = hs.yx;
              vec2 c = ( pc + 0.5 ) * 40.0 + ( vec2( cityHash( ph + 3.3 ), cityHash( ph + 4.4 ) ) - 0.5 ) * max( 40.0 - 2.0 * hs - 6.0, 0.0 );
              float sd = roofBox( rl - c, hs - 0.7 ) - 0.7;
              float keep = smoothstep( 6.0, 8.0, edge );
              float inside = ( 1.0 - smoothstep( -0.5 * fp, 0.5 * fp, sd ) ) * keep;
              col = mix( col, kind == 1 ? base * 1.07 : vec3( 0.03, 0.029, 0.028 ), inside * 0.9 );
              col *= 1.0 - 0.28 * roofBand( sd, 0.28, fp ) * keep;
              if ( kind == 2 ) rRough = mix( rRough, 0.45, inside );
            }
          }
          if ( level > 0.5 ) {
            // Silt where water stood, its tide mark; the drain: a dished sump, a stain, the iron dome.
            col = mix( col, col * vec3( 0.84, 0.82, 0.78 ), smoothstep( 0.58, 0.75, low ) * 0.7 );
            col *= 1.0 - 0.2 * tide;
            float stain = 1.0 - smoothstep( 2.5, 6.0 + 3.0 * cityNoise( rWorld * 0.3 + seed ), toDrain );
            col *= 1.0 - 0.12 * stain - 0.12 * ( 1.0 - smoothstep( 2.6, 3.4, toDrain ) );
            float dome = 1.0 - smoothstep( 1.0 - 0.5 * fp, 1.0 + 0.5 * fp, toDrain );
            col = mix( col, vec3( 0.03, 0.03, 0.032 ) * ( 1.0 + 1.5 * roofBand( toDrain - 0.75, 0.15, fp ) ), dome );
            rRough = mix( rRough, 0.5, dome );
            rMetal = mix( rMetal, 0.4, dome );
          }
          // The parapet's foot: its shade, and grime the wind leaves in the edges, more on older roofs.
          float grime = ( 1.0 - smoothstep( 4.0, 15.0, edge ) ) * ( 0.45 + 0.55 * cityNoise( rWorld * 0.21 + seed.yx ) ) * ( 0.5 + 0.5 * age );
          col *= mix( 0.74, 1.0, smoothstep( 3.8, 11.0, edge ) ) * ( 1.0 - 0.06 * age );
          col = mix( col, col * vec3( 0.78, 0.74, 0.68 ), grime * 0.6 );
          diffuseColor.rgb *= col;
          // WET: the shared pattern; flat roofs hold water in their low spots (HIGH and ULTRA).
          if ( cityWet > 0.002 ) {
            rWetFilm = cityWetFilm( rWorld, low * 0.6, 0.0, cityWet );
            if ( cityWetDetail > 1.5 ) rPuddle = level * cityPuddle( low + 0.04 * macro, cityWet );
            float soak = rWetFilm * porous;
            vec3 soaked = diffuseColor.rgb;
            soaked = max( mix( vec3( dot( soaked, vec3( 0.2126, 0.7152, 0.0722 ) ) ), soaked, 1.0 + 0.35 * soak ), 0.0 );
            diffuseColor.rgb = soaked * ( 1.0 - soak * 0.42 ) * ( 1.0 - 0.32 * rPuddle );
            rWetReflect = cityWetDetail > 0.5 ? clamp( rWetFilm * mix( 0.42, 0.3, porous ) + rPuddle * 0.66, 0.0, 1.0 ) : 0.0;
          }
        }`;
      const ROOF_SKIN_ROUGHNESS = `
        roughnessFactor = mix( rRough, min( rRough, cityWetDetail > 0.5 ? 0.3 : 0.6 ), rWetFilm );
        roughnessFactor = mix( roughnessFactor, 0.09, rPuddle );`;
      // Rain landing in the roof's puddles (the ground's rings, lighting3d-sky.js RAIN_RINGS).
      const ROOF_SKIN_NORMAL = `
        if ( cityRain > 0.01 && rPuddle > 0.02 ) {
          float ringsResolve = 1.0 - smoothstep( 0.3, 0.8, rFp );
          vec2 tilt = ( vec2( cityNoise( rWorld * 0.09 + vec2( cityRainTime * 0.7, 0.0 ) ), cityNoise( rWorld * 0.09 + vec2( 5.3, cityRainTime * 0.6 ) ) ) - 0.5 ) * 0.35 * ( 1.0 - ringsResolve );
          if ( ringsResolve > 0.01 ) tilt += cityPuddleRipples( rWorld, cityRainTime ) * ringsResolve;
          normal = normalize( normal + ( viewMatrix * vec4( tilt.x, 0.0, tilt.y, 0.0 ) ).xyz * cityRain * rPuddle );
        }`;
      function roofSkinPatch(shader, material) {
        cityMaterialPatch(shader);
        Object.assign(shader.uniforms, wetUniforms);
        shader.uniforms.cityDetail = groundShared.cityDetail;
        shader.uniforms.cityGroundDetail = groundShared.cityGroundDetail;
        shader.uniforms.cityRain = surfaceUniforms.cityRain;
        shader.uniforms.cityRainTime = surfaceUniforms.cityRainTime;
        shader.uniforms.cityRoofKind = { value: Math.max(0, ROOF_SKIN_KINDS.indexOf(material.userData.roofFinish)) };
        shader.uniforms.cityRoofBase = { value: new Three.Color(ROOF_SKIN_BASE[material.userData.roofFinish] || '#8b877e') };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + ROOF_SKIN_PARS)
          .replace('#include <map_fragment>', ROOF_SKIN_ALBEDO)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + ROOF_SKIN_ROUGHNESS)
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = rMetal * ( 1.0 - rPuddle );')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + ROOF_SKIN_NORMAL)
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectSpecular += citySkyReflect * rWetReflect;');
      }
      for (const material of roofMaterials.values()) {
        material.onBeforeCompile = (shader) => roofSkinPatch(shader, material);
        material.customProgramCacheKey = () => 'cityRoof';
      }
      // Console (groundDetail().roofs): the finishes, the buildings tinted and the roof caps of each finish (counted
      // here, before the static batcher merges them).
      const roofSkinCaps = {};
      for (const o of allBuildings)
        o.group.traverse((m) => {
          const finish = m.isMesh && m.material?.userData?.roofFinish;
          if (finish) roofSkinCaps[finish] = (roofSkinCaps[finish] || 0) + 1;
        });
      function roofSkinReport() {
        return { finishes: [...roofMaterials.keys()], tinted: roofCaps.size, caps: { ...roofSkinCaps } };
      }
