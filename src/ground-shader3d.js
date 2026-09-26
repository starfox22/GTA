      // BEGIN SUBSYSTEM: src/ground-shader3d.js — Ground materials (GLSL)
      /**
       * Ground materials (GLSL)
       * Source: src/ground-shader3d.js
       * Scope: createCityRenderer() closure (included by surfaces3d.js' host, before it).
       *
       * The ground sheets' shader, patched into their MeshStandardMaterial by
       * surfaces3d.js. The painted sheet is read for WHAT lies where; the
       * surfaces are drawn here in world space, at the screen's resolution:
       *
       *   1. SHEET MAGNIFICATION. Up close a sheet texel covers many pixels. Along
       *      an edge between two painted colours the bilinear sample is re-cut into
       *      the two pure colours (sampled either side along the colour gradient)
       *      at the edge's true position, antialiased to a pixel: lawn edges, path
       *      edges and plaza borders stay crisp at any zoom (`groundSheetSharp`).
       *   2. CLASSES from the crisp colour: asphalt (dark grey), lawn (green),
       *      loose ground (warm tan: gravel paths, sand, clay) and paving (the rest).
       *   3. MATERIALS, each in world space from the detail layers
       *      (ground-data3d.js) and procedural patterns:
       *      asphalt   photographed aggregate, binder mottling, utility patches with
       *                tar-sealed seams, sealed and hairline cracks, polished wheel
       *                paths and an oil strip down each lane (from the carriageway
       *                field's lane width), a gutter pan and grime along the kerb
       *      kerb      a kerb stone along every carriageway edge (the field's zero
       *                line): bevelled arris, a face that takes the sun, joints
       *      paving    by district (the field's style): concrete slabs with broom
       *                finish, gum and stains (city); flagstones and cobble setts
       *                (Old Quarter); polished granite (financial); worn concrete
       *                panels (docks); herringbone pavers (Palm Keys); limestone
       *                ashlar (Monarch Isle); weathered slabs with grass in the
       *                joints (county). Slab joints follow the kerb.
       *      lawn      photographed grass, clumps, lush and dry patches, mowing
       *                stripes in the parks, flowers in the beds
       *      loose     gravel with pebbles and edging along the lawns, wet margins
       *                at the ponds; sand with wind ripples and footprints
       *   4. MARKS (ground-data3d.js): paint with worn, ragged edges that lets the
       *      aggregate through, thicker where it is thermoplastic; cast iron
       *      manhole covers in a repair ring; gully grates; tree pits and mulch
       *      rings; oil stains at the stop lines.
       *   5. A height per material turned into the normal (screen-space bump) and
       *      a roughness, so low sun, lamp pools and the wet reflections read the
       *      grain, the joints and the polish.
       *
       * Everything finer than a couple of pixels fades to its average (the detail
       * layers by their mipmaps, the patterns by the pixel footprint `fp`), so
       * nothing shimmers zoomed out or in motion. LOW keeps a cheap path: the
       * sheet, a two-octave grain, the kerb line and the marks.
       *
       * Derivatives (dFdx, fwidth, implicit texture LOD) are only taken in uniform
       * control flow: the material branches sample the detail layers with
       * textureGrad from derivatives taken up front.
       */
      const GROUND_PARS = `
        uniform highp sampler2DArray cityDetail;
        uniform float cityGroundDetail;
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
          vec3 groundSheetSharp( vec3 c, vec2 uv, vec2 tdx, vec2 tdy, float magnify, out float s, out float trust, out vec3 ca, out vec3 cb ) {
            s = 0.5; trust = 0.0; ca = c; cb = c;
            float k = dot( c, vec3( 0.3, 0.55, 0.15 ) ) + 1.5 * ( c.g - max( c.r, c.b ) );
            vec2 gs = vec2( dFdx( k ), dFdy( k ) );
            float det = tdx.x * tdy.y - tdx.y * tdy.x;
            vec2 g = vec2( tdy.y * gs.x - tdx.y * gs.y, -tdy.x * gs.x + tdx.x * gs.y ) / ( abs( det ) > 1e-12 ? det : 1e-12 );
            float gl = length( g );
            vec2 n = gl > 1e-6 ? g / gl : vec2( 1.0, 0.0 );
            vec2 texel = cityGroundTexel;
            vec3 a = groundSheetAt( uv - n * texel * 1.6 ), b = groundSheetAt( uv + n * texel * 1.6 );
            vec3 ab = b - a;
            float l2 = dot( ab, ab );
            float sr = l2 > 1e-6 ? clamp( dot( c - a, ab ) / l2, 0.0, 1.0 ) : 0.5;
            float resid = length( c - ( a + ab * sr ) );
            float w = clamp( fwidth( sr ), 0.004, 0.5 ) * 0.6;
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
                  float worn = 0.18 + 0.12 * wear + 0.35 * gWheel;
                  float through = smoothstep( worn - 0.08, worn + 0.08, gAggregate * 0.55 + cityNoise( gp * 0.37 + seed * 9.0 ) * 0.45 + 0.08 );
                  through = mix( 1.0 - worn * 0.5, through, groundFade( 0.35, fp ) );
                  cover *= through * ( 0.9 + 0.1 * seed );
                  // Car park bay lines (wear 3): faded, and only on the tarmac.
                  if ( wear > 2.5 ) cover *= 0.6 * gRoad;
                  vec3 paintCol = paint < 0.5 ? vec3( 0.6, 0.6, 0.57 ) : paint < 1.5 ? vec3( 0.58, 0.53, 0.4 ) : vec3( 0.58, 0.4, 0.08 );
                  paintCol *= 0.86 + 0.14 * cityNoise( gp * 0.8 + 3.0 );
                  // Grime settles on old paint.
                  paintCol = mix( paintCol, gColour * 1.6, 0.12 + 0.08 * wear );
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
      // Main albedo pass (after the map, or after the hills' vertex colours).
      const GROUND_ALBEDO = `
        vec2 gp = vCityWorld.xz;
        vec2 gpx = dFdx( gp ), gpy = dFdy( gp );
        float fp = max( max( length( gpx ), length( gpy ) ), 1e-4 );
        float gDet = gpx.x * gpy.y - gpx.y * gpy.x;
        gDet = abs( gDet ) > 1e-9 ? gDet : 1e-9;
        vec3 sheet = diffuseColor.rgb;
        float gEdgeS = 0.5, gEdgeTrust = 0.0, gTexelUnits = 1.6;
        vec3 gEdgeA = sheet, gEdgeB = sheet;
        #if defined( USE_MAP ) && !defined( CITY_HILL )
          {
            vec2 tc = vMapUv / cityGroundTexel;
            vec2 tdx = dFdx( tc ), tdy = dFdy( tc );
            float magnify = 1.0 / max( max( length( tdx ), length( tdy ) ), 1e-5 );
            gTexelUnits = fp * magnify;
            if ( cityGroundDetail > 0.5 ) {
              vec3 crisp = groundSheetSharp( sampledDiffuseColor.rgb, vMapUv, tdx, tdy, magnify, gEdgeS, gEdgeTrust, gEdgeA, gEdgeB );
              sheet = crisp * diffuse;
              gEdgeA *= diffuse;
              gEdgeB *= diffuse;
            }
          }
        #endif
        // ---- The carriageway field: kerb distance, style, lanes, parks ----
        float gKerb = 99.0, gLaneW = 0.0, gPark = 0.0, gStyle = cityStyleDefault;
        vec2 gKerbN = vec2( 0.0, 1.0 );
        #ifndef CITY_HILL
          if ( cityFieldOn > 0.5 ) {
            vec2 fuv = ( gp - cityFieldRect.xy ) * cityFieldRect.zw;
            if ( fuv.x > 0.0 && fuv.y > 0.0 && fuv.x < 1.0 && fuv.y < 1.0 ) {
              gKerb = textureLod( cityFieldDist, fuv, 0.0 ).r;
              vec4 info = texelFetch( cityFieldInfo, ivec2( fuv * cityFieldInfoSize ), 0 );
              gStyle = floor( info.r * 255.0 + 0.5 );
              gLaneW = info.g * 255.0;
              gPark = info.b;
            }
          }
        #endif
        {
          // World-space gradient of the kerb distance (points away from the road).
          vec2 ks = vec2( dFdx( gKerb ), dFdy( gKerb ) );
          vec2 kg = vec2( gpy.y * ks.x - gpx.y * ks.y, -gpy.x * ks.x + gpx.x * ks.y ) / gDet;
          gKerbN = length( kg ) > 1e-4 ? normalize( kg ) : vec2( 0.0, 1.0 );
        }
        // ---- Classes ----
        float lum = dot( sheet, vec3( 0.2126, 0.7152, 0.0722 ) );
        float greenness = sheet.g - max( sheet.r, sheet.b );
        float warmth = ( sheet.r - sheet.b ) / max( lum, 0.03 );
        float grassMask = smoothstep( 0.1, 0.2, greenness / max( lum, 0.02 ) ) * smoothstep( 0.003, 0.012, greenness );
        // Teal and blue grounds are coloured surfacing (running loops, courts).
        float rubberMask = smoothstep( 0.03, 0.07, min( sheet.g, sheet.b ) - sheet.r ) * ( 1.0 - grassMask );
        // Asphalt: dark and neutral or cool (the sheet's road grey is ~0.07); dark
        // and warm is soil or timber.
        float roadMask = ( 1.0 - smoothstep( 0.1, 0.15, lum ) ) * ( 1.0 - grassMask ) * ( 1.0 - smoothstep( 0.35, 0.6, warmth ) ) * ( 1.0 - rubberMask );
        float looseMask = smoothstep( 0.3, 0.5, warmth ) * smoothstep( 0.03, 0.07, lum ) * ( 1.0 - grassMask ) * ( 1.0 - roadMask ) * ( 1.0 - rubberMask );
        // Palm Keys and Monarch Isle pave in warm, light stone: not gravel.
        if ( ( gStyle > 3.5 && gStyle < 5.5 ) ) looseMask *= 1.0 - smoothstep( 0.2, 0.3, lum ) * ( 1.0 - smoothstep( 0.55, 0.7, warmth ) );
        // County roads have no kerbs: their painted verge is a gravel shoulder
        // that frays into the grass.
        if ( gStyle > 5.5 && gStyle < 6.5 && gKerb > -0.5 && gKerb < 6.5 + 1.5 * cityNoise( gp * 0.3 ) ) {
          float shoulder = 1.0 - roadMask;
          looseMask = max( looseMask, shoulder );
          grassMask *= 1.0 - shoulder;
        }
        float paveMask = max( 1.0 - roadMask - grassMask - looseMask, 0.0 );
        #ifdef CITY_HILL
          // A hillside is grass, rock and snow: no slab joints or tarmac there.
          roadMask = 0.0;
          paveMask = 0.0;
          looseMask = 0.0;
        #endif
        // The marks read these.
        float gRoad = roadMask, gGrass = grassMask, gWheel = 0.0, gAggregate = 0.5;
        float gPaint = 0.0, gMetal = 0.0, gSoil = 0.0, gWater = 0.0;
        // Kept for the wet look and the older chunks below.
        float detailFade = 1.0 - smoothstep( 0.6, 2.5, fp );
        float grainA = cityNoise( gp * 0.9 ), grainB = cityNoise( gp * 3.1 );
        float grain = mix( 0.5, grainA * 0.6 + grainB * 0.4, detailFade );
        float tarPatch = 0.0;
        float macro = cityNoise( gp * 0.013 + 3.1 ) * 0.6 + cityNoise( gp * 0.047 + 1.7 ) * 0.4;
        vec3 gColour = sheet;
        float gHeight = 0.0, gRough = 0.9, gPorous = 1.0;
        // Seen from high up (a pixel over 8 units: the flight view) every detail
        // has faded to its average: the cheap path gives the same tones for less.
        bool gRich = cityGroundDetail > 0.5 && fp < 8.0;
        // The kerb: its stone on the pavement side of the field's zero line and
        // its face just inside the road, where the sheet has paving beyond it.
        float kerbW = ( gStyle > 0.5 && gStyle < 1.5 ) || gStyle > 4.5 && gStyle < 5.5 ? 2.0 : 1.7;
        float gKerbStone = 0.0, gKerbFace = 0.0, gGutter = 0.0;
        #if defined( USE_MAP ) && !defined( CITY_HILL )
          if ( gKerb > -2.0 && gKerb < kerbW + 1.0 && gStyle < 5.5 ) {
            vec3 beyond = groundSheetAt( vMapUv + vec2( gKerbN.x, -gKerbN.y ) * ( kerbW + 1.2 - gKerb ) / cityGroundSize );
            float bl = dot( beyond, vec3( 0.2126, 0.7152, 0.0722 ) );
            float kerbed = smoothstep( 0.1, 0.16, bl ) * ( 1.0 - smoothstep( 0.01, 0.03, beyond.g - max( beyond.r, beyond.b ) ) );
            gKerbStone = kerbed * groundBand( gKerb - kerbW * 0.5, kerbW * 0.5, fp );
            gKerbFace = kerbed * groundBand( gKerb + 0.45, 0.45, fp );
          }
        #endif
        if ( !gRich ) {
          // LOW: the sheet with one detail sample for what it is (the photographed
          // aggregate, concrete grain, grass, gravel), the kerb line and the marks.
          float lowDetail = 1.0;
          if ( roadMask > 0.5 ) lowDetail = 0.8 + 0.4 * groundLayer( gp, 0.0, 12.0, gpx, gpy ).r;
          else if ( grassMask > 0.5 ) lowDetail = dot( groundLayer( gp, 1.0, 10.0, gpx, gpy ).rgb, vec3( 0.667 ) );
          else if ( looseMask > 0.5 ) lowDetail = 0.8 + 0.4 * groundLayer( gp, 3.0, 6.0, gpx, gpy ).g;
          else lowDetail = ( 0.86 + 0.28 * groundLayer( gp, 2.0, 8.0, gpx, gpy ).r ) * ( 1.0 - 0.2 * max( groundJoints( gp.x, 12.0, 0.15, fp ), groundJoints( gp.y, 12.0, 0.15, fp ) ) );
          gColour = sheet * lowDetail * ( 0.96 + 0.08 * grain );
          // The sheet's blue-grey road paint as neutral asphalt, as the full path does.
          gColour = mix( gColour, mix( vec3( dot( gColour, vec3( 0.2126, 0.7152, 0.0722 ) ) ), gColour, 0.42 ) * vec3( 1.04, 1.0, 0.95 ), roadMask );
          // Lawns with the full path's broad lush and sunburnt swathes (they are
          // what makes open ground read as land from the air), graded the same.
          if ( grassMask > 0.001 ) {
            vec2 gr = mat2( 0.8, -0.6, 0.6, 0.8 ) * gp;
            float meadow = cityNoise( gp * 0.0045 + 3.7 ) * 0.62 + cityNoise( gr * 0.014 + 11.0 ) * 0.38;
            float dryL = max( smoothstep( 0.52, 0.8, cityNoise( gp * 0.035 + 5.0 ) * 0.6 + cityNoise( gr * 0.083 + 2.0 ) * 0.4 ), smoothstep( 0.62, 0.9, meadow ) * 0.7 );
            gColour = mix( gColour, gColour * ( 0.84 + 0.3 * meadow ) * mix( vec3( 1.0 ), vec3( 1.14, 1.06, 0.8 ), dryL ), grassMask );
          }
          gColour = mix( gColour, max( mix( vec3( dot( gColour, vec3( 0.2126, 0.7152, 0.0722 ) ) ), gColour, 1.06 ) * vec3( 0.85, 0.9, 0.84 ), 0.0 ), grassMask );
          gColour = mix( gColour, vec3( 0.36, 0.355, 0.34 ), gKerbStone );
          gColour = mix( gColour, gColour * 0.55, gKerbFace );
          gRough = mix( 0.92, 0.84, roadMask );
        } else {
          // ================= ASPHALT =================
          if ( roadMask > 0.001 ) {
            vec3 base = mix( vec3( lum ), sheet, 0.42 ) * vec3( 1.04, 1.0, 0.95 );
            // District character: the Old Quarter's streets are old and patched,
            // the docks' cracked and oily, downtown's fresh and dark, Palm Keys'
            // sun-bleached, the county's a pale chip seal.
            float age = gStyle < 0.5 ? 0.5 : gStyle < 1.5 ? 0.85 : gStyle < 2.5 ? 0.2 : gStyle < 3.5 ? 1.0 : gStyle < 4.5 ? 0.6 : gStyle < 5.5 ? 0.3 : 0.7;
            if ( gStyle > 3.5 && gStyle < 4.5 ) base *= vec3( 1.12, 1.1, 1.05 );
            if ( gStyle > 5.5 ) base *= 1.1;
            if ( gStyle > 1.5 && gStyle < 2.5 ) base *= 0.96;
            vec4 ag = groundLayer2( gp, 0.0, 12.0, gpx, gpy );
            gAggregate = ag.r;
            float inRoad = -gKerb;
            // Lanes: polished wheel paths, oil down the middle.
            float wheel = 0.0, oilLane = 0.0;
            if ( gLaneW > 1.0 && inRoad > 3.0 && inRoad < 62.0 ) {
              float u = mod( inRoad, gLaneW ), c0 = gLaneW * 0.5 + 1.0;
              wheel = ( 1.0 - smoothstep( 0.8, 3.6, abs( abs( u - c0 ) - 6.5 + ( cityNoise( gp * 0.07 ) - 0.5 ) * 1.6 ) ) )
                    * smoothstep( 0.25, 0.75, cityNoise( gp * 0.021 + 2.0 ) * 0.7 + cityNoise( gp * 0.11 ) * 0.3 );
              oilLane = ( 1.0 - smoothstep( 0.8, 3.2, abs( u - c0 ) ) ) * smoothstep( 0.42, 0.78, cityNoise( gp * 0.09 + 7.0 ) );
              // Seen from high up the bands average out rather than alias.
              float laneFade = groundFade( 3.0, fp );
              wheel = mix( 0.2, wheel, laneFade );
              oilLane = mix( 0.1, oilLane, laneFade );
            }
            gWheel = wheel;
            // Utility cuts: a patch of newer asphalt in some 40-unit cells, its
            // border sealed with tar. The cells follow the road (the kerb field's
            // direction, one sign for both halves of the carriageway).
            vec2 rn = gKerbN.x < -0.01 || ( abs( gKerbN.x ) <= 0.01 && gKerbN.y < 0.0 ) ? -gKerbN : gKerbN;
            vec2 rp = gKerb < 90.0 && gLaneW > 1.0 ? vec2( dot( gp, vec2( -rn.y, rn.x ) ), dot( gp, rn ) ) : gp;
            vec2 pc = floor( rp / 40.0 );
            float patchM = 0.0, seam = 0.0;
            if ( cityHash( pc + 91.0 ) > 0.91 - 0.07 * age ) {
              vec2 hsz = vec2( 3.0, 2.5 ) + vec2( cityHash( pc + 3.0 ), cityHash( pc + 5.0 ) ) * vec2( 14.0, 9.0 );
              if ( cityHash( pc + 13.0 ) > 0.5 ) hsz = hsz.yx;
              vec2 centre = pc * 40.0 + 20.0 + ( vec2( cityHash( pc + 7.0 ), cityHash( pc + 9.0 ) ) - 0.5 ) * max( 40.0 - 2.0 * hsz - 2.0, 0.0 );
              float sd = groundBox( rp - centre, hsz ) + ( cityNoise( gp * 0.8 ) - 0.5 ) * 0.25;
              patchM = 1.0 - smoothstep( -0.5 * fp, 0.5 * fp, sd );
              // (A line's band widens with the footprint: scale it back to the
              // line's true share of the pixel.)
              seam = ( 1.0 - smoothstep( 0.3, 0.3 + fp, abs( sd ) ) ) * min( 1.0, 0.6 / fp );
            }
            tarPatch = patchM;
            // Sealed cracks: long tar lines in some stretches; hairline cracks.
            float crackArea = smoothstep( 0.7 - 0.2 * age, 0.86 - 0.2 * age, cityNoise( gp * 0.008 + 9.0 ) );
            float cn = cityNoise( gp * 0.021 + 3.0 ) + ( cityNoise( gp * 0.11 ) - 0.5 ) * 0.07;
            float sealW = 0.13 * 0.021 * 1.4;
            float sealLine = ( 1.0 - smoothstep( sealW, sealW + fp * 0.03, abs( cn - 0.5 ) ) ) * crackArea * min( 1.0, 0.25 / fp );
            float hn = cityNoise( gp * 0.07 + 11.0 ) + ( cityNoise( gp * 0.5 ) - 0.5 ) * 0.08;
            float hairW = 0.07 * 0.07 * 1.4;
            float hair = ( 1.0 - smoothstep( hairW, hairW + fp * 0.1, abs( hn - 0.5 ) ) ) * smoothstep( 0.5, 0.75, cityNoise( gp * 0.02 + 4.0 ) ) * groundFade( 0.35, fp ) * ( 0.4 + 0.8 * age );
            vec3 asphalt = base * ( 0.8 + 0.42 * ag.r + ( ag.g - 0.5 ) * 0.18 ) * ( 0.9 + 0.2 * macro ) * ( 0.94 + 0.12 * ag.a );
            asphalt *= 1.0 + 0.055 * wheel;
            asphalt = mix( asphalt, base * ( 0.72 + 0.2 * ag.b ), patchM );
            asphalt *= 1.0 - 0.38 * seam - 0.42 * sealLine - 0.35 * hair;
            asphalt *= 1.0 - 0.22 * oilLane;
            float h = ( ag.r - 0.5 ) * 0.4 + ( ag.g - 0.5 ) * 0.3 - 0.35 * hair - 0.1 * sealLine + 0.05 * seam - 0.06 * patchM;
            float rough = clamp( 0.86 - 0.14 * wheel - 0.24 * seam - 0.3 * sealLine - 0.14 * oilLane - 0.08 * patchM + ( ag.g - 0.5 ) * 0.12, 0.35, 0.95 );
            // Along the kerb: a concrete gutter pan (setts in the Old Quarter and
            // on Monarch Isle), grime, and the kerb's contact shadow.
            if ( inRoad > -1.0 && inRoad < 8.0 && gLaneW > 1.0 ) {
              float panW = gStyle > 5.5 ? 0.0 : 3.6;
              float pan = ( 1.0 - smoothstep( panW - 0.5 * fp, panW + 0.5 * fp, inRoad ) ) * step( 0.5, panW );
              vec2 t = abs( gKerbN.x ) > abs( gKerbN.y ) ? vec2( 0.0, 1.0 ) : vec2( 1.0, 0.0 );
              float along = dot( gp, t );
              vec3 panCol;
              float panH;
              if ( ( gStyle > 0.5 && gStyle < 1.5 ) || ( gStyle > 4.5 && gStyle < 5.5 ) ) {
                // Two rows of granite setts.
                vec3 sb = groundBond( vec2( along, inRoad ), 2.2, 1.8 );
                float gap = 1.0 - smoothstep( 0.12, 0.12 + fp, sb.z );
                gap = mix( 0.2, gap, groundFade( 1.0, fp ) );
                float tone = cityHash( sb.xy + 5.0 );
                panCol = mix( vec3( 0.13, 0.125, 0.12 ), vec3( 0.2, 0.19, 0.18 ), tone ) * ( 0.85 + 0.3 * ag.r ) * ( 1.0 - 0.6 * gap );
                panH = 0.25 * smoothstep( 0.0, 0.7, sb.z ) - 0.2 * gap;
              } else {
                vec4 cg = groundLayer( gp, 2.0, 8.0, gpx, gpy );
                float joint = groundJoints( along, 10.0, 0.12, fp );
                panCol = vec3( 0.22, 0.215, 0.2 ) * ( 0.8 + 0.4 * cg.r ) * ( 1.0 - 0.4 * joint );
                panH = ( cg.r - 0.5 ) * 0.15 - 0.2 * joint;
              }
              float grime = ( 1.0 - smoothstep( 0.0, 2.8, inRoad ) ) * ( 0.5 + 0.5 * cityNoise( gp * 0.6 ) );
              panCol *= 1.0 - 0.35 * grime;
              asphalt = mix( asphalt, panCol, pan );
              h = mix( h, panH, pan );
              rough = mix( rough, 0.88, pan );
              gGutter = 1.0 - smoothstep( 0.0, 5.0, inRoad );
              // Litter and leaves caught against the kerb.
              float litter = smoothstep( 0.8, 0.86, cityNoise( gp * 1.4 + 3.3 ) ) * ( 1.0 - smoothstep( 0.0, 1.8, inRoad ) ) * groundFade( 0.4, fp );
              asphalt = mix( asphalt, vec3( 0.12, 0.09, 0.05 ), litter * 0.7 );
              asphalt *= 1.0 - 0.3 * ( 1.0 - smoothstep( 0.0, 1.3, inRoad ) );
            }
            // County roads: a white edge line inside each edge (not across junctions).
            if ( gStyle > 5.5 && gStyle < 6.5 && gLaneW > 1.0 ) {
              float edgeLine = groundBand( inRoad - 3.2, 0.6, fp ) * ( 0.85 + 0.15 * ag.r );
              edgeLine *= smoothstep( 0.2, 0.3, ag.r * 0.5 + cityNoise( gp * 0.4 ) * 0.5 );
              asphalt = mix( asphalt, vec3( 0.52, 0.52, 0.49 ), edgeLine );
              h += 0.15 * edgeLine;
              rough = mix( rough, 0.62, edgeLine );
            }
            gColour = mix( gColour, asphalt, roadMask );
            gHeight += h * roadMask;
            gRough = mix( gRough, rough, roadMask );
          }
          // ================= PAVING =================
          if ( paveMask > 0.001 ) {
            // The frame: across from the kerb and along it near a carriageway,
            // the world's axes elsewhere (plazas, courtyards).
            bool byKerb = gKerb < 44.0 && gKerb > 0.0;
            vec2 t = abs( gKerbN.x ) > abs( gKerbN.y ) ? vec2( 0.0, 1.0 ) : vec2( 1.0, 0.0 );
            float along = byKerb ? dot( gp, t ) : gp.x;
            float across = byKerb ? gKerb - kerbW : gp.y;
            vec2 fr = vec2( along, across );
            vec4 cg = groundLayer2( gp, 2.0, 8.0, gpx, gpy );
            vec3 base = sheet;
            vec3 pave;
            float h = 0.0, rough = 0.9, joint = 0.0, porous = 0.85;
            float stain = smoothstep( 0.6, 0.85, cg.a ) * 0.5 + smoothstep( 0.7, 0.9, cityNoise( gp * 0.19 + 21.0 ) ) * 0.35;
            if ( gStyle < 0.5 || gStyle > 6.5 ) {
              // Concrete slabs 1.5 m square, broom finish across the walk.
              float s = 12.0;
              vec2 cellId = floor( fr / s );
              joint = max( groundJoints( fr.x, s, 0.13, fp ), groundJoints( fr.y, s, 0.13, fp ) );
              float expansion = groundJoints( fr.x, s * 4.0, 0.22, fp ) * 0.6;
              float tone = cityHash( cellId + 17.0 );
              vec2 bUv = byKerb ? ( t.x > 0.5 ? gp : gp.yx ) : gp;
              vec4 broom = groundLayer( bUv, 2.0, 8.0, t.x > 0.5 || !byKerb ? gpx : gpx.yx, t.x > 0.5 || !byKerb ? gpy : gpy.yx );
              pave = base * ( 0.9 + 0.12 * tone ) * ( 0.84 + 0.3 * cg.r ) * ( 0.95 + 0.1 * broom.g );
              // A cracked slab here and there.
              if ( cityHash( cellId + 3.3 ) > 0.91 ) {
                vec2 lf = fr - ( cellId + 0.5 ) * s;
                float ang = cityHash( cellId + 8.8 ) * GROUND_PI;
                float cd = abs( dot( lf, vec2( cos( ang ), sin( ang ) ) ) + ( cityNoise( gp * 1.1 ) - 0.5 ) * 0.9 );
                float crack = ( 1.0 - smoothstep( 0.05, 0.05 + fp, cd ) ) * groundFade( 0.2, fp );
                pave *= 1.0 - 0.45 * crack;
                h -= 0.2 * crack;
              }
              pave *= 1.0 - 0.3 * max( joint, expansion );
              h += ( cg.r - 0.5 ) * 0.2 + ( broom.g - 0.5 ) * 0.12 - 0.3 * joint;
              rough = 0.9;
            } else if ( gStyle < 1.5 ) {
              if ( byKerb ) {
                // Old flagstones in rows along the kerb.
                vec3 st = groundAshlar( fr, 7.0, 13.0, 8.0, 19.0 );
                joint = 1.0 - smoothstep( 0.22, 0.22 + fp, st.y );
                joint = mix( 0.1, joint, groundFade( 0.6, fp ) );
                float dome = smoothstep( 0.0, 1.4, st.y );
                vec3 tint = mix( vec3( 0.96, 0.98, 1.02 ), vec3( 1.06, 1.0, 0.92 ), st.x );
                pave = base * tint * ( 0.82 + 0.26 * cityHash( vec2( st.x, 1.0 ) ) ) * ( 0.84 + 0.3 * cg.r );
                pave *= 0.86 + 0.14 * dome;
                pave *= 1.0 - 0.45 * joint;
                h += 0.28 * dome - 0.35 * joint + ( cg.r - 0.5 ) * 0.2;
              } else {
                // Cobble setts in running bond.
                vec3 sb = groundBond( fr, 2.6, 1.9 );
                float gap = 1.0 - smoothstep( 0.14, 0.14 + fp, sb.z );
                gap = mix( 0.22, gap, groundFade( 1.0, fp ) );
                float tone = cityHash( sb.xy + 2.0 );
                vec3 sett = base * mix( vec3( 0.78, 0.8, 0.84 ), vec3( 1.1, 1.02, 0.92 ), tone ) * ( 0.8 + 0.36 * cg.r );
                float dome = smoothstep( 0.0, 0.8, sb.z ) * groundFade( 0.8, fp );
                pave = sett * ( 0.8 + 0.25 * dome ) * ( 1.0 - 0.55 * gap );
                h += 0.35 * dome - 0.3 * gap;
                gWater = max( gWater, gap * 0.8 );
              }
              rough = 0.82;
            } else if ( gStyle < 2.5 ) {
              // Polished granite slabs 2 x 1 m in running bond, a band of dark
              // granite along the kerb.
              // Along the kerbs 2 x 1 m in running bond; on the plazas the 2 m
              // grid the tower plazas are set out on (skyline.js: joints at 9
              // modulo 16 units).
              vec3 sb = groundBond( fr, 16.0, 8.0 );
              if ( !byKerb ) {
                vec2 f = mod( fr - 9.0, 16.0 );
                sb = vec3( floor( ( fr - 9.0 ) / 16.0 ), min( min( f.x, 16.0 - f.x ), min( f.y, 16.0 - f.y ) ) );
              }
              joint = 1.0 - smoothstep( 0.12, 0.12 + fp, sb.z );
              joint = mix( 0.03, joint, groundFade( 0.5, fp ) );
              float tone = cityHash( sb.xy + 4.0 );
              float speck = cg.b;
              float band = byKerb ? 1.0 - smoothstep( 3.5 - 0.5 * fp, 3.5 + 0.5 * fp, across ) : 0.0;
              vec3 granite = mix( base * 1.02, base * vec3( 0.34, 0.34, 0.36 ), band );
              // Each slab its own block of stone: tone, a cloudy figure, speckle.
              float cloud = cityNoise( gp * 0.35 + tone * 50.0 ) * 0.6 + cg.a * 0.4;
              pave = granite * ( 0.86 + 0.18 * tone ) * ( 0.9 + 0.2 * cloud ) * ( 0.84 + 0.32 * speck ) * ( 1.0 - 0.5 * joint );
              h += ( speck - 0.5 ) * 0.06 - 0.25 * joint;
              rough = 0.5 + 0.12 * ( 1.0 - speck ) + 0.1 * stain;
              porous = 0.4;
              stain *= 0.5;
            } else if ( gStyle < 3.5 ) {
              // Docks: big worn concrete panels, sealant joints, rust and oil.
              float s = 24.0;
              vec2 cellId = floor( fr / s );
              joint = max( groundJoints( fr.x, s, 0.3, fp ), groundJoints( fr.y, s, 0.3, fp ) );
              float tone = cityHash( cellId + 31.0 );
              vec4 ag = groundLayer( gp, 0.0, 12.0, gpx, gpy );
              float exposed = smoothstep( 0.55, 0.75, cityNoise( gp * 0.05 + tone * 10.0 ) );
              pave = base * ( 0.86 + 0.16 * tone ) * mix( 0.84 + 0.3 * cg.r, 0.75 + 0.5 * ag.r, exposed );
              float rust = smoothstep( 0.72, 0.9, cityNoise( gp * 0.07 + 40.0 ) );
              pave = mix( pave, pave * vec3( 1.18, 0.86, 0.62 ), rust * 0.6 );
              pave *= 1.0 - 0.45 * joint;
              stain = min( stain * 1.6, 1.0 );
              h += ( mix( cg.r, ag.r, exposed ) - 0.5 ) * 0.3 - 0.35 * joint;
              rough = 0.88;
            } else if ( gStyle < 4.5 ) {
              // Palm Keys: light pavers, 40 x 20 cm, laid herringbone.
              vec3 hb = groundHerringbone( fr / 1.6 );
              float edge = hb.z * 1.6;
              joint = 1.0 - smoothstep( 0.1, 0.1 + fp, edge );
              joint = mix( 0.12, joint, groundFade( 0.9, fp ) );
              float tone = cityHash( vec2( hb.x, hb.y ) + 6.0 );
              vec3 tint = tone < 0.33 ? vec3( 1.06, 0.98, 0.9 ) : tone < 0.66 ? vec3( 1.0, 1.0, 0.98 ) : vec3( 1.1, 0.94, 0.84 );
              pave = base * tint * ( 0.88 + 0.2 * cg.r );
              // Joints swept with pale sand.
              pave = mix( pave, base * vec3( 1.12, 1.06, 0.94 ), joint * 0.8 );
              h += 0.18 * smoothstep( 0.0, 0.3, edge ) * groundFade( 0.9, fp ) - 0.15 * joint + ( cg.r - 0.5 ) * 0.12;
              rough = 0.86;
            } else if ( gStyle < 5.5 ) {
              // Monarch Isle: pale limestone ashlar.
              vec3 st = groundAshlar( fr, 9.0, 16.0, 11.0, 26.0 );
              joint = 1.0 - smoothstep( 0.16, 0.16 + fp, st.y );
              joint = mix( 0.04, joint, groundFade( 0.5, fp ) );
              float tone = st.x;
              vec3 lime = base * vec3( 1.07, 1.03, 0.94 ) * ( 0.93 + 0.1 * tone ) * ( 0.9 + 0.2 * cg.r );
              // Fossil flecks.
              lime *= 0.96 + 0.08 * ( cg.b - 0.5 ) * 2.0 * 0.5;
              pave = lime * ( 1.0 - 0.42 * joint );
              h += ( cg.r - 0.5 ) * 0.12 - 0.22 * joint;
              rough = 0.74;
              stain *= 0.6;
            } else {
              // County: weathered slabs, grass and moss in the joints.
              float s = 12.0;
              vec2 cellId = floor( fr / s );
              joint = max( groundJoints( fr.x, s, 0.2, fp ), groundJoints( fr.y, s, 0.2, fp ) );
              float tone = cityHash( cellId + 57.0 );
              pave = base * ( 0.86 + 0.18 * tone ) * ( 0.84 + 0.3 * cg.r );
              pave = mix( pave, vec3( 0.1, 0.13, 0.06 ), joint * 0.75 );
              float lichen = smoothstep( 0.7, 0.85, cityNoise( gp * 0.6 + tone * 30.0 ) ) * groundFade( 0.6, fp );
              pave = mix( pave, pave * vec3( 0.95, 1.02, 0.85 ), lichen * 0.6 );
              h += ( cg.r - 0.5 ) * 0.2 - 0.25 * joint;
              rough = 0.92;
            }
            // Coloured surfacing (a teal running loop, a blue court): poured, seamless.
            pave = mix( pave, sheet * ( 0.9 + 0.2 * cg.r ) * ( 0.95 + 0.1 * macro ), rubberMask );
            h = mix( h, ( cg.r - 0.5 ) * 0.1, rubberMask );
            rough = mix( rough, 0.8, rubberMask );
            // Stains and chewing gum.
            pave *= 1.0 - 0.18 * stain;
            vec2 gc = floor( gp / 2.6 );
            float gh = cityHash( gc + 71.0 );
            if ( gh > 0.93 && gStyle < 5.5 ) {
              vec2 gpos = ( gc + 0.2 + 0.6 * vec2( cityHash( gc + 1.0 ), cityHash( gc + 2.0 ) ) ) * 2.6;
              float gum = ( 1.0 - smoothstep( 0.16 + 0.12 * gh, 0.16 + 0.12 * gh + fp, length( gp - gpos ) ) ) * groundFade( 0.35, fp );
              pave = mix( pave, pave * 0.55, gum );
            }
            gColour = mix( gColour, pave, paveMask );
            gHeight += h * paveMask;
            gRough = mix( gRough, rough, paveMask );
            gPorous = mix( gPorous, porous, paveMask );
          }
          // ================= KERB =================
          if ( gKerbStone + gKerbFace > 0.001 ) {
            vec2 t = abs( gKerbN.x ) > abs( gKerbN.y ) ? vec2( 0.0, 1.0 ) : vec2( 1.0, 0.0 );
            float along = dot( gp, t );
            bool granite = ( gStyle > 0.5 && gStyle < 1.5 ) || ( gStyle > 4.5 && gStyle < 5.5 ) || ( gStyle > 1.5 && gStyle < 2.5 );
            vec4 cg = groundLayer( gp, 2.0, 8.0, gpx, gpy );
            float len = granite ? 14.0 + 6.0 * cityHash( vec2( floor( along / 20.0 ), 2.0 ) ) : 8.0;
            float joint = groundJoints( along, len, granite ? 0.08 : 0.12, fp );
            vec3 stone = granite ? ( gStyle > 4.5 ? vec3( 0.42, 0.41, 0.38 ) : vec3( 0.2, 0.2, 0.21 ) ) * ( 0.8 + 0.4 * cg.b ) : vec3( 0.38, 0.375, 0.36 ) * ( 0.84 + 0.3 * cg.r );
            // The arris is worn and grimy where tyres rub it.
            float arris = 1.0 - smoothstep( 0.0, 0.5, gKerb );
            float scuff = smoothstep( 0.6, 0.8, cityNoise( vec2( along * 0.15, 3.0 ) ) ) * arris;
            stone *= 1.0 - 0.3 * joint - 0.25 * scuff;
            stone *= 1.0 + 0.12 * ( 1.0 - arris ) * smoothstep( 0.2, 1.0, gKerb );
            vec3 face = stone * 0.62 * ( 0.85 + 0.3 * cityNoise( gp * 0.8 ) );
            gColour = mix( gColour, stone, gKerbStone );
            gColour = mix( gColour, face, gKerbFace );
            // Height: the face rises 1.2 units to the arris, rounded over its top.
            float kh = 1.2 * smoothstep( -0.9, 0.35, gKerb );
            gHeight = mix( gHeight, kh + ( cg.r - 0.5 ) * 0.1 - 0.2 * joint, max( gKerbStone, gKerbFace ) );
            gRough = mix( gRough, granite ? 0.7 : 0.86, max( gKerbStone, gKerbFace ) );
            gPorous = mix( gPorous, granite ? 0.45 : 0.8, max( gKerbStone, gKerbFace ) );
          }
          // ================= LAWN =================
          float dry = 0.0;
          if ( grassMask > 0.001 ) {
            vec2 gr = mat2( 0.8, -0.6, 0.6, 0.8 ) * gp;
            dry = smoothstep( 0.52, 0.8, cityNoise( gp * 0.035 + 5.0 ) * 0.6 + cityNoise( gr * 0.083 + 2.0 ) * 0.4 );
            float meadow = cityNoise( gp * 0.0045 + 3.7 ) * 0.62 + cityNoise( gr * 0.014 + 11.0 ) * 0.38;
            dry = max( dry, smoothstep( 0.62, 0.9, meadow ) * 0.7 );
            vec4 ga = groundLayer2( gp, 1.0, 10.0, gpx, gpy );
            vec3 photo = clamp( ga.rgb * 2.0, 0.0, 2.0 );
            float clump = cityNoise( gp * 0.42 ) * 0.6 + cityNoise( gr * 1.25 + 4.0 ) * 0.4;
            float clumpF = groundFade( 1.2, fp );
            vec3 lawn = sheet * mix( vec3( 1.0 ), photo, 0.9 ) * mix( 1.0, 0.8 + 0.4 * clump, clumpF ) * ( 0.84 + 0.3 * meadow )
                      * mix( vec3( 1.0 ), vec3( 1.14, 1.06, 0.8 ), dry );
            // Clover and weeds: darker, bluer blotches.
            float clover = smoothstep( 0.74, 0.86, cityNoise( gp * 0.23 + 60.0 ) ) * groundFade( 1.5, fp );
            lawn = mix( lawn, lawn * vec3( 0.82, 0.92, 0.88 ), clover );
            // Mowing stripes on park lawns, 3.25 m bands.
            if ( gPark > 0.5 ) {
              float band = sin( gp.x * GROUND_PI / 26.0 );
              float stripe = smoothstep( -0.08, 0.08, band ) * 2.0 - 1.0;
              lawn *= 1.0 + 0.045 * stripe;
            }
            // Flower beds (the sheet's rose and purple beds): blooms on dark foliage.
            lawn = max( mix( vec3( dot( lawn, vec3( 0.2126, 0.7152, 0.0722 ) ) ), lawn, 1.06 ) * vec3( 0.85, 0.9, 0.84 ), 0.0 );
            float h = ( ga.a - 0.5 ) * 0.5 + ( clump - 0.5 ) * 0.3 * clumpF;
            gColour = mix( gColour, lawn, grassMask );
            gHeight += h * grassMask;
            gRough = mix( gRough, 0.95, grassMask );
            gPorous = mix( gPorous, 0.35, grassMask );
          }
          {
            // Flower beds: painted in pink and violet, drawn as blooms.
            float bed = smoothstep( 0.015, 0.05, sheet.r - sheet.g ) * smoothstep( 0.0, 0.025, sheet.b - sheet.g ) * ( 1.0 - roadMask );
            if ( bed > 0.001 ) {
              vec2 fc = floor( gp / 1.3 );
              float fh = cityHash( fc + 13.0 );
              vec2 fpos = ( fc + 0.25 + 0.5 * vec2( cityHash( fc + 1.0 ), cityHash( fc + 4.0 ) ) ) * 1.3;
              float bloom = ( 1.0 - smoothstep( 0.38, 0.38 + fp, length( gp - fpos ) ) ) * step( 0.25, fh );
              vec3 petal = fh < 0.45 ? vec3( 0.55, 0.06, 0.1 ) : fh < 0.62 ? vec3( 0.75, 0.35, 0.5 ) : fh < 0.8 ? vec3( 0.8, 0.78, 0.72 ) : vec3( 0.8, 0.62, 0.12 );
              vec3 foliage = vec3( 0.03, 0.06, 0.025 ) * ( 0.7 + 0.6 * cityNoise( gp * 1.9 ) );
              vec3 flowers = mix( foliage, petal, bloom * groundFade( 0.9, fp ) );
              flowers = mix( flowers, mix( foliage, sheet, 0.5 ), 1.0 - groundFade( 0.9, fp ) );
              gColour = mix( gColour, flowers, bed );
              gHeight += bed * ( 0.3 * bloom + 0.2 * cityNoise( gp * 2.0 ) );
              gRough = mix( gRough, 0.9, bed );
            }
          }
          // ================= LOOSE GROUND =================
          if ( looseMask > 0.001 ) {
            vec4 lg = groundLayer2( gp, 3.0, 6.0, gpx, gpy );
            vec3 loose;
            float h, rough;
            if ( gStyle > 6.5 || ( gStyle > 4.5 && gStyle < 5.5 && lum > 0.4 ) || ( gStyle > 5.5 && lum > 0.3 ) ) {
              // Sand: fine grain, wind ripples, footprints.
              vec2 wind = vec2( 0.83, 0.56 );
              float phase = dot( gp, wind ) + ( cityNoise( gp * 0.045 ) - 0.5 ) * 16.0 + ( cityNoise( gp * 0.21 ) - 0.5 ) * 2.2;
              float ripple = sin( phase * 2.0 * GROUND_PI / 3.4 ) * groundFade( 1.7, fp ) * ( 0.5 + 0.5 * cityNoise( gp * 0.03 + 8.0 ) );
              // Footprints: in some 7-unit cells a pair of steps along a random heading.
              vec2 cc = floor( gp / 7.0 );
              float step1 = 0.0;
              if ( cityHash( cc + 41.0 ) > 0.62 ) {
                float ang = cityHash( cc + 42.0 ) * 6.2832;
                vec2 fdir = vec2( cos( ang ), sin( ang ) ), fside = vec2( -fdir.y, fdir.x );
                vec2 o = ( cc + 0.5 ) * 7.0;
                for ( int f = 0; f < 2; f++ ) {
                  vec2 c = o + fdir * ( float( f ) * 4.4 - 2.2 ) + fside * ( float( f ) * 1.4 - 0.7 );
                  vec2 lq = vec2( dot( gp - c, fdir ), dot( gp - c, fside ) );
                  float e = length( lq / vec2( 1.2, 0.5 ) );
                  step1 = max( step1, ( 1.0 - smoothstep( 0.7, 1.0, e ) ) * groundFade( 0.8, fp ) );
                }
              }
              loose = sheet * ( 0.94 + 0.12 * lg.b ) * ( 1.0 + 0.05 * ripple ) * ( 1.0 - 0.1 * step1 ) * ( 0.96 + 0.08 * macro );
              h = 0.22 * ripple + ( lg.b - 0.5 ) * 0.1 - 0.3 * step1;
              rough = 0.96;
            } else {
              // Gravel paths, clay, soil: pebbles with their own tones.
              float soil = 1.0 - smoothstep( 0.1, 0.18, lum );
              vec3 pebble = sheet * mix( vec3( 0.78, 0.8, 0.84 ), vec3( 1.12, 1.04, 0.92 ), lg.g );
              loose = mix( sheet * ( 0.7 + 0.2 * lg.b ), pebble, smoothstep( 0.05, 0.3, lg.r ) * ( 1.0 - soil * 0.7 ) );
              loose *= 0.9 + 0.2 * macro;
              h = lg.r * 0.45 - 0.15 + ( lg.b - 0.5 ) * 0.1;
              rough = 0.93;
              // Edging along a lawn: a steel strip on the path's side of the edge.
              float grassA = smoothstep( 0.003, 0.012, gEdgeA.g - max( gEdgeA.r, gEdgeA.b ) ), grassB = smoothstep( 0.003, 0.012, gEdgeB.g - max( gEdgeB.r, gEdgeB.b ) );
              if ( gEdgeTrust > 0.3 && abs( grassA - grassB ) > 0.5 ) {
                float dist = ( gEdgeS - 0.5 ) * gTexelUnits * ( grassA > grassB ? 1.0 : -1.0 );
                float edging = ( 1.0 - smoothstep( 0.16, 0.16 + fp, abs( dist - 0.22 ) ) ) * gEdgeTrust * min( 1.0, 0.32 / fp );
                loose = mix( loose, vec3( 0.05, 0.045, 0.04 ), edging );
                h = mix( h, 0.25, edging );
                rough = mix( rough, 0.5, edging );
              }
              #ifdef USE_MAP
                // A wet margin where the path meets a pond.
                vec3 around = textureLod( map, vMapUv, 3.0 ).rgb;
                float pondNear = smoothstep( 0.02, 0.06, min( around.g, around.b ) - around.r ) * smoothstep( 0.01, 0.04, around.b - around.g * 0.8 );
                loose *= 1.0 - 0.35 * pondNear;
                rough = mix( rough, 0.5, pondNear );
              #endif
            }
            gColour = mix( gColour, loose, looseMask );
            gHeight += h * looseMask;
            gRough = mix( gRough, rough, looseMask );
            gPorous = mix( gPorous, 0.9, looseMask );
          }
        }
        // ================= MARKS =================
        #ifndef CITY_HILL
          GROUND_MARKS_HERE
        #endif
        diffuseColor.rgb = gColour;
        // WET ROADS (the pattern is lighting3d.js WET SURFACES). The damp film
        // soaks asphalt and paving darker and more saturated, paint and bright
        // kerbs a little less, granite and grass hardly; it dries in patches after
        // the rain. From MEDIUM up it turns glossy (roughness below, the sky
        // sheen after the lights); from HIGH up dips in the tarmac, the gutters
        // along the kerbs (the carriageway field) and the gaps between setts hold
        // standing water that ripples in the rain and, with the wet reflections
        // pass (postfx3d.js), mirrors the street. LOW only darkens.
        float wetFilm = 0.0, puddle = 0.0, wetReflect = 0.0;
        if ( cityWet > 0.002 ) {
          float low = cityWetLow( gp ), gutter = gGutter * roadMask;
          wetFilm = cityWetFilm( gp, low, gutter * 0.25, cityWet );
          if ( cityWetDetail > 1.5 ) puddle = max( cityPuddle( low + gutter * 0.32 + grainA * 0.03, cityWet ) * roadMask * ( 1.0 - gPaint * 0.5 ), gWater * smoothstep( 0.3, 0.8, cityWet ) );
          float porous = gPorous * ( 1.0 - 0.65 * grassMask ) * ( 1.0 - 0.5 * gPaint ) * ( 1.0 - 0.6 * gMetal );
          float soak = wetFilm * porous;
          float bright = smoothstep( 0.3, 0.55, lum ) * ( 1.0 - grassMask );
          vec3 soaked = diffuseColor.rgb;
          soaked = max( mix( vec3( dot( soaked, vec3( 0.2126, 0.7152, 0.0722 ) ) ), soaked, 1.0 + 0.4 * soak ), 0.0 );
          soaked *= 1.0 - soak * mix( 0.46, 0.2, bright );
          diffuseColor.rgb = soaked * ( 1.0 - 0.3 * puddle );
          wetReflect = cityWetDetail > 0.5 ? clamp( wetFilm * mix( 0.34, 0.42, 1.0 - gPorous ) * ( 1.0 - bright * 0.4 ) * ( 1.0 - 0.7 * grassMask ) + puddle * 0.66, 0.0, 1.0 ) : 0.0;
        }`;
      const GROUND_ROUGHNESS = `
        roughnessFactor = gRough;
        // The damp film smooths the surface into a sheen (only a little on LOW).
        roughnessFactor = mix( roughnessFactor, min( roughnessFactor, cityWetDetail > 0.5 ? 0.28 + 0.16 * grain : 0.6 ), wetFilm * ( 1.0 - 0.7 * grassMask ) );
        // Not a perfect mirror: at 0.05 the sun's reflection in a puddle was a blinding
        // blob that bloomed across the street from the air.
        roughnessFactor = mix( roughnessFactor, 0.09, puddle );`;
      const GROUND_NORMAL = `
        {
          // The materials' height as a bump (three.js perturbNormalArb): grain,
          // joints, cracks, the kerb's face, paint, setts. Water levels it.
          float bumpH = gHeight * ( 1.0 - puddle ) * ( cityGroundDetail > 0.5 ? 1.0 : 0.0 );
          vec2 dHdxy = vec2( dFdx( bumpH ), dFdy( bumpH ) ) * 0.9;
          vec3 vSigmaX = dFdx( -vViewPosition ), vSigmaY = dFdy( -vViewPosition );
          vec3 vN = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
          #ifdef CITY_HILL
            vN = normal;
          #endif
          vec3 R1 = cross( vSigmaY, vN ), R2 = cross( vN, vSigmaX );
          float fDet = dot( vSigmaX, R1 );
          vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
          vec3 bumped = normalize( abs( fDet ) * vN - vGrad );
          normal = abs( fDet ) > 1e-12 ? bumped : vN;
          // Rain landing in the puddles: the mirror-smooth water shivers, so the
          // lamps and signs it reflects break up. Close up (a unit covers a few
          // pixels) it is rings spreading from each drop; farther out, where rings
          // would only alias into sparkles, a slow wobble a dozen units across.
          if ( cityRain > 0.01 && puddle > 0.02 ) {
            float ringsResolve = 1.0 - smoothstep( 0.3, 0.8, fp );
            vec2 tilt = vec2( cityNoise( gp * 0.09 + vec2( cityRainTime * 0.7, 0.0 ) ), cityNoise( gp * 0.09 + vec2( 5.3, cityRainTime * 0.6 ) ) ) - 0.5;
            tilt *= 0.35 * ( 1.0 - ringsResolve );
            if ( ringsResolve > 0.01 ) tilt += cityPuddleRipples( gp, cityRainTime ) * ringsResolve;
            normal = normalize( normal + ( viewMatrix * vec4( tilt.x, 0.0, tilt.y, 0.0 ) ).xyz * cityRain * puddle );
          }
        }`;
      // END SUBSYSTEM: src/ground-shader3d.js
