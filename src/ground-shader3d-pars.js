      // Ground shader GLSL chunks: shared uniforms and helpers (GROUND_PARS), sheet magnification (GROUND_SHEET_PARS), the marks (GROUND_MARKS).
      const GROUND_PARS = `
        uniform highp sampler2DArray cityDetail;
        uniform float cityGroundDetail;
        uniform float cityGroundSlopeCap;
        uniform sampler2D cityFieldDist;
        uniform sampler2D cityFieldInfo;
        uniform vec4 cityFieldRect;
        uniform vec2 cityFieldInfoSize;
        uniform float cityFieldOn;
        uniform float cityStyleDefault;
        uniform sampler2D cityMarkIndex;
        uniform highp sampler2D cityMarkData;
        uniform vec4 cityMarkGrid;
        uniform vec2 cityGroundSize;
        uniform float cityMarkRows;
        const float GROUND_PI = 3.14159265;
        // How much of a feature 'size' world units across survives at a pixel
        // footprint of fp units: all of it from ~3.5 pixels, none below ~1.5.
        float groundFade( float size, float fp ) {
          return clamp( ( size / fp - 1.5 ) * 0.5, 0.0, 1.0 );
        }
        // Joints of half width w every period along u (joints at u = k * period),
        // antialiased, and faded to their average coverage where unresolved.
        float groundJoints( float u, float period, float w, float fp ) {
          float d = abs( fract( u / period + 0.5 ) - 0.5 ) * period;
          float sharp = 1.0 - smoothstep( w - 0.5 * fp, w + 0.5 * fp, d );
          return mix( sharp, min( 2.0 * w / period, 1.0 ), smoothstep( 0.15 * period, 0.4 * period, fp ) );
        }
        // A detail layer sampled with explicit gradients (safe in branches).
        vec4 groundLayer( vec2 p, float layer, float tile, vec2 px, vec2 py ) {
          return textureGrad( cityDetail, vec3( p / tile, layer ), px / tile, py / tile );
        }
        // The same, twice (the second turned and scaled) and blended by a slow
        // noise, so the tile's repeat never lines up across a street.
        vec4 groundLayer2( vec2 p, float layer, float tile, vec2 px, vec2 py ) {
          vec4 a = groundLayer( p, layer, tile, px, py );
          // MEDIUM makes do with one sample.
          if ( cityGroundDetail < 1.5 ) return a;
          vec2 q = vec2( p.y, -p.x ) * 0.73 + 17.3;
          vec4 b = textureGrad( cityDetail, vec3( q / tile, layer ), vec2( px.y, -px.x ) * 0.73 / tile, vec2( py.y, -py.x ) * 0.73 / tile );
          float m = smoothstep( 0.3, 0.7, cityNoise( p / ( tile * 2.7 ) + 5.1 ) );
          vec4 r = mix( a, b, m );
          return 0.5 + ( r - 0.5 ) * ( 1.0 + 0.4 * ( 1.0 - abs( m * 2.0 - 1.0 ) ) );
        }
        // How much of a pixel w wide, centred x from the middle of a band hw
        // either side of 0, the band covers: an exact box filter, so thin lines
        // seen from far away fade to their true share instead of aliasing.
        float groundBand( float x, float hw, float w ) {
          return clamp( ( min( hw, x + 0.5 * w ) - max( -hw, x - 0.5 * w ) ) / w, 0.0, 1.0 );
        }
        // Signed distance to a box of half extents h (negative inside).
        float groundBox( vec2 q, vec2 h ) {
          vec2 d = abs( q ) - h;
          return length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 );
        }
        // Herringbone pavers, 2 x 1 in units of the short side: the paver under
        // p (its id) and the distance to its edge. The lattice is (1, 1), (2, -2)
        // over a horizontal paver [0,2]x[0,1] and a vertical one [2,3]x[-1,1].
        vec3 groundHerringbone( vec2 p ) {
          float a = ( p.x + p.y ) * 0.5, b = ( p.x - p.y ) * 0.25;
          float k0 = floor( a ), m0 = floor( b + 0.25 );
          vec3 best = vec3( 0.0, 0.0, -1.0 );
          for ( int i = 0; i < 2; i++ )
            for ( int j = 0; j < 2; j++ ) {
              float k = k0 - float( i ), m = m0 - float( j );
              vec2 q = p - k * vec2( 1.0, 1.0 ) - m * vec2( 2.0, -2.0 );
              vec2 dh = q - vec2( 1.0, 0.5 );
              float eh = -groundBox( dh, vec2( 1.0, 0.5 ) );
              if ( eh > best.z ) best = vec3( k * 2.0 + m * 7.0, 0.0, eh );
              vec2 dv = q - vec2( 2.5, 0.0 );
              float ev = -groundBox( dv, vec2( 0.5, 1.0 ) );
              if ( ev > best.z ) best = vec3( k * 2.0 + m * 7.0, 1.0, ev );
            }
          return best;
        }
        // Running bond (bricks, slabs): the unit under p in rows of height rowH
        // and units of length len, each row offset by half; returns id and the
        // distance to the unit's edge.
        vec3 groundBond( vec2 p, float len, float rowH ) {
          float row = floor( p.y / rowH );
          float x = p.x / len + 0.5 * mod( row, 2.0 );
          float col = floor( x );
          vec2 f = vec2( ( x - col ) * len, p.y - row * rowH );
          float edge = min( min( f.x, len - f.x ), min( f.y, rowH - f.y ) );
          return vec3( col, row, edge );
        }
        // Stones of irregular length in rows (flagstones, ashlar): row heights
        // from rowA to rowB, lengths from lenA to lenB, per-row random. Returns
        // a per-stone hash, the distance to the stone's edge and the row hash.
        vec3 groundAshlar( vec2 p, float rowA, float rowB, float lenA, float lenB ) {
          // Rows: a fixed lattice of rowB with some rows split in two.
          float band = floor( p.y / rowB ), fy = p.y - band * rowB;
          float split = step( 0.55, cityHash( vec2( band, 1.3 ) ) );
          float cut = rowB * mix( 0.42, 0.58, cityHash( vec2( band, 8.1 ) ) );
          float upper = split * step( cut, fy );
          float rowId = band * 2.0 + upper;
          float y0 = upper > 0.5 ? cut : 0.0, y1 = ( split > 0.5 && upper < 0.5 ) ? cut : rowB;
          // Stones along the row: cells of lenB, each cut once at a random point.
          float off = cityHash( vec2( rowId, 4.4 ) ) * lenB;
          float x = p.x + off, cell = floor( x / lenB ), fx = x - cell * lenB;
          float cutX = mix( lenA, lenB - lenA * 0.3, cityHash( vec2( cell, rowId ) ) );
          float two = step( 0.4, cityHash( vec2( rowId, cell + 0.5 ) ) );
          float right = two * step( cutX, fx );
          float x0 = right > 0.5 ? cutX : 0.0, x1 = ( two > 0.5 && right < 0.5 ) ? cutX : lenB;
          float edge = min( min( fx - x0, x1 - fx ), min( fy - y0, y1 - fy ) );
          return vec3( cityHash( vec2( cell * 2.0 + right, rowId ) ), edge, cityHash( vec2( rowId, 9.9 ) ) );
        }
      `;
      // The sheet magnification (needs the map sampler).
      const GROUND_SHEET_PARS = `
        #ifdef USE_MAP
          vec3 groundSheetAt( vec2 uv ) {
            return textureLod( map, uv, 0.0 ).rgb;
          }
          // The sheet colour c at uv re-cut along a painted edge (see SHEET
          // MAGNIFICATION). tdx, tdy: texel-coordinate derivatives; magnify:
          // pixels per texel. Out: s (0 on side a, 1 on side b, 0.5 on the edge),
          // trust (how edge-like it is) and the two pure colours.
          float groundSheetKey( vec3 c ) {
            return dot( c, vec3( 0.3, 0.55, 0.15 ) ) + 1.5 * ( c.g - max( c.r, c.b ) );
          }
          vec3 groundSheetSharp( vec3 c, vec2 uv, vec2 tdx, vec2 tdy, float magnify, out float s, out float trust, out vec3 ca, out vec3 cb ) {
            s = 0.5; trust = 0.0; ca = c; cb = c;
            // Flat sheet round this pixel's block (and too little magnification
            // to re-cut): nothing to do. (Either way the result is c, so this
            // screen-derivative test cannot flicker.)
            float k = groundSheetKey( c );
            if ( dFdx( k ) == 0.0 && dFdy( k ) == 0.0 || magnify < 1.25 ) return c;
            // The colour gradient from the sheet itself, a texel either side, and
            // the ramp's width from the texel footprint along it: the screen
            // derivatives of this pixel's own sample are shared by each 2 x 2 block
            // of pixels, so which blocks straddled an edge (and with it the edge's
            // direction and antialiasing) changed each time the view moved a pixel.
            vec2 texel = cityGroundTexel;
            vec2 g = vec2(
              groundSheetKey( groundSheetAt( uv + vec2( texel.x, 0.0 ) ) ) - groundSheetKey( groundSheetAt( uv - vec2( texel.x, 0.0 ) ) ),
              groundSheetKey( groundSheetAt( uv + vec2( 0.0, texel.y ) ) ) - groundSheetKey( groundSheetAt( uv - vec2( 0.0, texel.y ) ) )
            );
            float gl = length( g );
            vec2 n = gl > 1e-6 ? g / gl : vec2( 1.0, 0.0 );
            vec3 a = groundSheetAt( uv - n * texel * 1.6 ), b = groundSheetAt( uv + n * texel * 1.6 );
            vec3 ab = b - a;
            float l2 = dot( ab, ab );
            float sr = l2 > 1e-6 ? clamp( dot( c - a, ab ) / l2, 0.0, 1.0 ) : 0.5;
            float resid = length( c - ( a + ab * sr ) );
            // (sr runs 0 to 1 over the one texel of the bilinear ramp.)
            float w = clamp( abs( dot( n, tdx ) ) + abs( dot( n, tdy ) ), 0.004, 0.5 ) * 0.6;
            trust = smoothstep( 0.0006, 0.0025, l2 ) * ( 1.0 - smoothstep( 0.012, 0.045, resid ) ) * smoothstep( 1.25, 2.4, magnify ) * step( 1e-6, gl );
            // Lawn against lawn (the county's painted tufts, meadow tones) stays
            // soft: cut crisp, those blotches turned into hard little blocks.
            float greenA = a.g - max( a.r, a.b ), greenB = b.g - max( b.r, b.b );
            trust *= 1.0 - 0.8 * smoothstep( 0.004, 0.012, min( greenA, greenB ) );
            s = sr; ca = a; cb = b;
            return mix( c, mix( a, b, smoothstep( 0.5 - w, 0.5 + w, sr ) ), trust );
          }
        #endif
      `;
      // The marks (ground-data3d.js MARK_KIND) over the material already chosen.
      // In: gp, fp, the classes, the aggregate (for paint wear), the lane's wheel
      // paths. In/out: colour, height, roughness, metalness.
      const GROUND_MARKS = `
        {
          vec2 mc = ( gp - cityMarkGrid.xy ) * cityMarkGrid.z;
          int cols = int( cityMarkGrid.w );
          ivec2 cell = ivec2( floor( mc ) );
          if ( cell.x >= 0 && cell.y >= 0 && cell.x < cols && float( cell.y ) < cityMarkRows ) {
            vec2 head = texelFetch( cityMarkIndex, cell, 0 ).rg;
            int first = int( head.x + 0.5 ), count = int( head.y + 0.5 );
            float aa = max( fp, 0.04 );
            for ( int i = 0; i < 10; i++ ) {
              if ( i >= count ) break;
              int t = ( first + i ) * 2;
              ivec2 at = ivec2( t - ( t / 2048 ) * 2048, t / 2048 );
              vec4 A = texelFetch( cityMarkData, at, 0 );
              vec4 B = texelFetch( cityMarkData, at + ivec2( 1, 0 ), 0 );
              vec2 d = gp - A.xy;
              vec2 dir = B.xy;
              vec2 q = vec2( dot( d, dir ), dot( d, vec2( -dir.y, dir.x ) ) );
              float code = B.z;
              float kind = mod( code, 16.0 ), paint = mod( floor( code / 16.0 ), 4.0 ), wear = floor( code / 64.0 );
              float seed = cityHash( A.xy * 0.37 );
              if ( kind < 2.5 ) {
                // Paint: a strip, dashed or barred along its length.
                if ( abs( q.x ) < A.z + aa + 0.6 && abs( q.y ) < A.w + aa + 0.6 ) {
                  // Ragged, worn edges (box filtered: groundBand); the aggregate
                  // shows through worn paint, most in the wheel paths.
                  float rag = ( ( cityNoise( gp * 1.9 + seed * 40.0 ) - 0.5 ) * 0.34 + ( cityNoise( gp * 6.3 ) - 0.5 ) * 0.12 * groundFade( 0.3, fp ) ) * ( 0.5 + 0.25 * wear );
                  float cover = groundBand( q.y, A.w - rag, aa );
                  if ( kind > 1.5 ) {
                    float lenQ = floor( B.w / 4096.0 ), period = ( B.w - lenQ * 4096.0 ) * 0.25, len = lenQ * 0.25;
                    float u = q.x + A.z;
                    float k = floor( u / period );
                    float local = u - k * period - len * 0.5;
                    float along = groundBand( local, len * 0.5 - rag, aa );
                    along = mix( along, len / period, smoothstep( 0.3 * period, 0.6 * period, aa ) );
                    cover *= along * groundBand( q.x, A.z + 0.5, aa );
                  } else cover *= groundBand( q.x, A.z - rag, aa );
                  // Zebras and stop lines lie across the traffic (bars at most 6.5
                  // long every 13.5, or a solid line 1.15 or more wide): tyres cross
                  // them along q.y and leave grey streaks, the paint worn through in
                  // the tracks.
                  float lenM = floor( B.w / 4096.0 ) * 0.25, periodM = ( B.w - floor( B.w / 4096.0 ) * 4096.0 ) * 0.25;
                  float acrossTraffic = wear < 2.5 && ( kind > 1.5 ? lenM < 6.6 && periodM < 13.6 : A.w > 1.15 ) ? 1.0 : 0.0;
                  float tyre = acrossTraffic * smoothstep( 0.48, 0.78, cityNoise( vec2( q.x * 0.45 + seed * 31.0, q.y * 0.05 ) ) ) * groundFade( 1.2, fp );
                  float worn = 0.18 + 0.12 * wear + 0.35 * gWheel + 0.34 * tyre;
                  float through = smoothstep( worn - 0.08, worn + 0.08, gAggregate * 0.55 + cityNoise( gp * 0.37 + seed * 9.0 ) * 0.45 + 0.08 );
                  through = mix( 1.0 - worn * 0.5, through, groundFade( 0.35, fp ) );
                  cover *= through * ( 0.9 + 0.1 * seed );
                  // Car park bay lines (wear 3): faded, and only on the tarmac. In
                  // most bays, oil dropped where the engines stand.
                  if ( wear > 2.5 ) {
                    cover *= 0.6 * gRoad;
                    float bayU = q.x + A.z - 0.5 * lenM, bay = floor( bayU / periodM );
                    vec2 bq = vec2( bayU - ( bay + 0.5 ) * periodM, q.y );
                    float bh = cityHash( vec2( bay, seed * 91.0 ) );
                    float drop = groundBox( bq, vec2( 2.0 + 1.5 * bh, 3.5 + 2.5 * bh ) ) + ( cityNoise( gp * 0.45 + bh * 17.0 ) - 0.5 ) * 3.0;
                    float oil = ( 1.0 - smoothstep( -1.0, 1.5, drop ) ) * step( 0.3, bh ) * gRoad;
                    gColour *= 1.0 - 0.32 * oil * ( 0.6 + 0.4 * cityNoise( gp * 1.3 + 4.0 ) );
                    gRough = mix( gRough, 0.55, oil * 0.6 );
                  }
                  vec3 paintCol = paint < 0.5 ? vec3( 0.6, 0.6, 0.57 ) : paint < 1.5 ? vec3( 0.58, 0.53, 0.4 ) : vec3( 0.58, 0.4, 0.08 );
                  paintCol *= 0.86 + 0.14 * cityNoise( gp * 0.8 + 3.0 );
                  // Grime settles on old paint, most in the tyre tracks.
                  paintCol = mix( paintCol, gColour * 1.6, 0.12 + 0.08 * wear + 0.62 * tyre );
                  gColour = mix( gColour, paintCol, cover );
                  gHeight += cover * 0.22;
                  gRough = mix( gRough, 0.62, cover );
                  gPaint = max( gPaint, cover );
                }
              } else if ( kind < 3.5 ) {
                // A cast iron manhole cover in a ring of newer asphalt.
                float r = length( d ), R = A.z;
                float ring = 1.0 - smoothstep( R + 1.3 - 0.5 * aa, R + 1.3 + 0.5 * aa, r );
                gColour = mix( gColour, gColour * 0.78, ring * gRoad );
                float seam = ( 1.0 - smoothstep( 0.18, 0.18 + aa, abs( r - R - 1.3 ) ) ) * gRoad * min( 1.0, 0.36 / aa );
                gColour *= 1.0 - 0.4 * seam;
                float lid = 1.0 - smoothstep( R - 0.5 * aa, R + 0.5 * aa, r );
                if ( lid > 0.0 ) {
                  float rim = smoothstep( R - 0.55, R - 0.35, r );
                  // Raised diamond tread, worn bright on its tops.
                  vec2 tq = mat2( 0.7071, 0.7071, -0.7071, 0.7071 ) * d * 1.9;
                  vec2 tf = abs( fract( tq ) - 0.5 );
                  float tread = ( 1.0 - smoothstep( 0.18, 0.26, max( tf.x, tf.y ) ) ) * groundFade( 0.6, fp );
                  float rings = ( 1.0 - smoothstep( 0.06, 0.06 + aa, abs( r - R * 0.45 ) ) ) * groundFade( 0.3, fp );
                  float rust = smoothstep( 0.55, 0.8, cityNoise( gp * 1.3 + seed * 20.0 ) );
                  vec3 iron = mix( vec3( 0.045, 0.043, 0.04 ), vec3( 0.11, 0.06, 0.03 ), rust * 0.7 );
                  iron = mix( iron, vec3( 0.16, 0.155, 0.15 ), max( tread * 0.55, rim * 0.6 ) * ( 1.0 - rust * 0.6 ) );
                  iron *= 1.0 - 0.5 * rings;
                  gColour = mix( gColour, iron, lid );
                  gHeight = mix( gHeight, -0.12 + 0.18 * tread + 0.1 * rim, lid );
                  gRough = mix( gRough, mix( 0.62, 0.34, max( tread, rim ) * ( 1.0 - rust ) ), lid );
                  gMetal = mix( gMetal, 0.55 * ( 1.0 - rust ), lid );
                }
              } else if ( kind < 4.5 ) {
                // A gully grate against the kerb: an iron frame and dark slots.
                float sd = groundBox( q, A.zw );
                float inside = 1.0 - smoothstep( -0.5 * aa, 0.5 * aa, sd );
                if ( inside > 0.0 ) {
                  float frame = smoothstep( -0.55, -0.35, sd );
                  float slot = ( 1.0 - smoothstep( 0.28, 0.36, abs( fract( q.x * 0.9 ) - 0.5 ) ) ) * ( 1.0 - frame );
                  slot = mix( 0.45, slot, groundFade( 1.1, fp ) );
                  vec3 grate = mix( vec3( 0.07, 0.066, 0.06 ), vec3( 0.006, 0.006, 0.006 ), slot );
                  gColour = mix( gColour, grate, inside );
                  gHeight = mix( gHeight, -0.5 * slot, inside );
                  gRough = mix( gRough, mix( 0.45, 0.9, slot ), inside );
                  gMetal = mix( gMetal, 0.45 * ( 1.0 - slot ), inside );
                  gWater = max( gWater, inside * 0.6 );
                }
              } else if ( kind < 5.5 ) {
                // A tree's base: a pit in the pavement (a square of mulch in a
                // steel grille; setts round it in the Old Quarter), a ring of
                // mulch on a lawn, raked sand under a palm.
                float r = length( d ), R = A.z;
                float onLawn = gGrass;
                float tropical = wear;
                float shapeD = mix( groundBox( d, vec2( R ) ), r - R * ( 1.1 + 0.18 * ( cityNoise( gp * 0.4 + seed * 7.0 ) - 0.5 ) ), max( onLawn, tropical ) );
                float inside = 1.0 - smoothstep( -0.5 * aa, 0.5 * aa, shapeD );
                if ( inside > 0.0 ) {
                  vec4 m = groundLayer( gp, 3.0, 6.0, gpx, gpy );
                  vec3 mulch = mix( vec3( 0.07, 0.042, 0.024 ), vec3( 0.2, 0.12, 0.06 ), m.a );
                  // Leaf litter and the soil showing near the trunk.
                  float leaves = smoothstep( 0.72, 0.8, cityNoise( gp * 2.3 + seed * 5.0 ) ) * groundFade( 0.5, fp );
                  mulch = mix( mulch, vec3( 0.24, 0.16, 0.05 ), leaves * 0.7 );
                  mulch = mix( mulch, vec3( 0.05, 0.035, 0.025 ), 1.0 - smoothstep( 0.8, 2.2, r ) );
                  if ( tropical > 0.5 ) mulch = mix( vec3( 0.42, 0.36, 0.26 ), vec3( 0.55, 0.49, 0.37 ), m.b );
                  float grille = ( 1.0 - onLawn ) * ( 1.0 - tropical ) * smoothstep( -0.9, -0.7, shapeD );
                  vec3 edge = gStyle > 0.5 && gStyle < 1.5 ? vec3( 0.14, 0.135, 0.13 ) * ( 0.8 + 0.4 * m.g ) : vec3( 0.05, 0.05, 0.048 );
                  vec3 pit = mix( mulch, edge, grille );
                  gColour = mix( gColour, pit, inside );
                  gHeight = mix( gHeight, mix( ( m.a - 0.5 ) * 0.3 - 0.15, 0.08, grille ), inside );
                  gRough = mix( gRough, mix( 0.97, 0.55, grille ), inside );
                  gMetal = mix( gMetal, 0.3 * grille * ( 1.0 - step( 0.5, gStyle ) * step( gStyle, 1.5 ) ), inside );
                  gSoil = max( gSoil, inside * ( 1.0 - grille ) );
                }
              } else if ( kind > 6.5 ) {
                // A dropped kerb at a crossing: the kerb ramps down to the road and
                // a pad of tactile paving (truncated domes) warns of the edge.
                float sd = groundBox( q, A.zw );
                float inside = 1.0 - smoothstep( -0.5 * aa, 0.5 * aa, sd );
                if ( inside > 0.0 ) {
                  vec2 dq = abs( fract( q / 0.75 ) - 0.5 ) * 0.75;
                  float dome = ( 1.0 - smoothstep( 0.16, 0.24, length( dq ) ) ) * groundFade( 0.5, fp );
                  float rim = smoothstep( -0.45, -0.25, sd );
                  vec3 pad = vec3( 0.42, 0.3, 0.07 ) * ( 0.85 + 0.2 * cityNoise( gp * 0.9 ) ) * ( 1.0 + 0.25 * dome - 0.3 * rim );
                  pad = mix( pad, gColour * 0.9, 0.15 );
                  gColour = mix( gColour, pad, inside );
                  gHeight = mix( gHeight, 0.25 + 0.2 * dome - 0.2 * rim, inside );
                  gRough = mix( gRough, 0.7, inside );
                  gPorous = mix( gPorous, 0.5, inside );
                }
              } else {
                // Oil dripped under idling cars: a soft, glossy stain.
                float sd = groundBox( q, A.zw );
                float blot = ( 1.0 - smoothstep( -1.5, 1.5, sd + ( cityNoise( gp * 0.5 + seed * 11.0 ) - 0.5 ) * 3.0 ) ) * gRoad;
                blot *= 0.55 + 0.45 * cityNoise( gp * 1.7 + 2.0 );
                gColour *= 1.0 - 0.32 * blot;
                gRough = mix( gRough, 0.5, blot );
              }
            }
          }
        }`;
