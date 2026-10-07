      // Ground shader GLSL chunks: the main albedo pass (GROUND_ALBEDO, one literal), GROUND_ROUGHNESS and GROUND_NORMAL.
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
            // The road's own frame: along it and across it (the kerb field's
            // direction, one sign for both halves of the carriageway).
            vec2 rn = gKerbN.x < -0.01 || ( abs( gKerbN.x ) <= 0.01 && gKerbN.y < 0.0 ) ? -gKerbN : gKerbN;
            vec2 rp = gKerb < 90.0 && gLaneW > 1.0 ? vec2( dot( gp, vec2( -rn.y, rn.x ) ), dot( gp, rn ) ) : gp;
            // RESURFACING: the carriageway was laid in stretches, each of its own
            // year (tone, how fresh and black, how cracked), with a sealed joint
            // across the road where two meet.
            float stretch = cityHash( vec2( floor( rp.x / 236.0 ), floor( rp.y / 410.0 ) ) + 77.0 );
            age = clamp( age + ( stretch - 0.5 ) * 0.6, 0.0, 1.0 );
            float fresh = smoothstep( 0.78, 0.92, stretch ) * ( 1.0 - age );
            float stretchJoint = gLaneW > 1.0 ? groundBand( abs( fract( rp.x / 236.0 + 0.5 ) - 0.5 ) * 236.0, 0.35, fp ) : 0.0;
            // Lanes: polished wheel paths, oil down the middle.
            float wheel = 0.0, oilLane = 0.0;
            if ( gLaneW > 1.0 && inRoad > 3.0 && inRoad < 62.0 ) {
              float u = mod( inRoad, gLaneW ), c0 = gLaneW * 0.5 + 1.0;
              wheel = ( 1.0 - smoothstep( 0.8, 3.6, abs( abs( u - c0 ) - 6.5 + ( cityNoise( gp * 0.07 ) - 0.5 ) * 1.6 ) ) )
                    * smoothstep( 0.25, 0.75, cityNoise( gp * 0.021 + 2.0 ) * 0.7 + cityNoise( gp * 0.11 ) * 0.3 );
              oilLane = ( 1.0 - smoothstep( 0.8, 3.6, abs( u - c0 ) ) ) * smoothstep( 0.3, 0.7, cityNoise( gp * 0.09 + 7.0 ) * 0.7 + cityNoise( gp * 0.37 ) * 0.3 );
              // Seen from high up the bands average out rather than alias.
              float laneFade = groundFade( 3.0, fp );
              wheel = mix( 0.2, wheel, laneFade );
              oilLane = mix( 0.12, oilLane, laneFade );
            }
            gWheel = wheel;
            // Utility cuts: a patch of newer asphalt in some 40-unit cells, its
            // border sealed with tar (a quarter of them capped in concrete).
            vec2 pc = floor( rp / 40.0 );
            float patchM = 0.0, seam = 0.0, capped = 0.0;
            if ( cityHash( pc + 91.0 ) > 0.91 - 0.09 * age ) {
              vec2 hsz = vec2( 3.0, 2.5 ) + vec2( cityHash( pc + 3.0 ), cityHash( pc + 5.0 ) ) * vec2( 14.0, 9.0 );
              if ( cityHash( pc + 13.0 ) > 0.5 ) hsz = hsz.yx;
              vec2 centre = pc * 40.0 + 20.0 + ( vec2( cityHash( pc + 7.0 ), cityHash( pc + 9.0 ) ) - 0.5 ) * max( 40.0 - 2.0 * hsz - 2.0, 0.0 );
              float sd = groundBox( rp - centre, hsz ) + ( cityNoise( gp * 0.8 ) - 0.5 ) * 0.25;
              patchM = 1.0 - smoothstep( -0.5 * fp, 0.5 * fp, sd );
              // (A line's band widens with the footprint: scale it back to the
              // line's true share of the pixel.)
              seam = ( 1.0 - smoothstep( 0.3, 0.3 + fp, abs( sd ) ) ) * min( 1.0, 0.6 / fp );
              capped = step( 0.75, cityHash( pc + 15.0 ) );
            }
            // Trench reinstatements: a long strip along the road where a pipe or
            // a cable went in.
            if ( gLaneW > 1.0 ) {
              vec2 tc = vec2( floor( rp.x / 180.0 ), floor( rp.y / 30.0 ) );
              if ( cityHash( tc + 51.0 ) > 0.9 - 0.06 * age ) {
                vec2 thz = vec2( 30.0 + 50.0 * cityHash( tc + 52.0 ), 1.6 + 1.2 * cityHash( tc + 53.0 ) );
                vec2 tcentre = vec2( ( tc.x + 0.5 ) * 180.0 + ( cityHash( tc + 54.0 ) - 0.5 ) * ( 180.0 - 2.0 * thz.x ), ( tc.y + 0.5 ) * 30.0 );
                float sdT = groundBox( rp - tcentre, thz ) + ( cityNoise( gp * 0.7 ) - 0.5 ) * 0.2;
                float inT = 1.0 - smoothstep( -0.5 * fp, 0.5 * fp, sdT );
                seam = max( seam, ( 1.0 - smoothstep( 0.3, 0.3 + fp, abs( sdT ) ) ) * min( 1.0, 0.6 / fp ) );
                capped *= 1.0 - inT;
                patchM = max( patchM, inT );
              }
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
            // Thermal cracks across the carriageway every few car lengths on the
            // older stretches, most sealed with a band of tar; and the joint
            // between paving passes along a lane line, sealed in runs.
            float thermal = 0.0, thermalOpen = 0.0, laneJoint = 0.0;
            if ( gLaneW > 1.0 ) {
              float tCell = floor( rp.x / 64.0 ), tRow = floor( rp.y / 410.0 );
              if ( cityHash( vec2( tCell, tRow ) + 13.0 ) < 0.15 + 0.6 * age ) {
                float x0 = ( tCell + 0.2 + 0.6 * cityHash( vec2( tCell, tRow ) + 31.0 ) ) * 64.0;
                float wob = ( cityNoise( vec2( rp.y * 0.06, tCell ) ) - 0.5 ) * 7.0 + ( cityNoise( vec2( rp.y * 0.4, tCell + 9.0 ) ) - 0.5 ) * 1.1;
                float sealed = step( 0.3, cityHash( vec2( tCell, tRow ) + 3.0 ) );
                float line = groundBand( abs( rp.x - x0 - wob ), mix( 0.14, 0.5, sealed ), fp ) * mix( groundFade( 0.3, fp ), 1.0, sealed );
                // A crack seldom runs the whole width.
                line *= smoothstep( 0.28, 0.42, cityNoise( vec2( rp.y * 0.025, tCell * 3.1 ) ) );
                thermal = line * sealed;
                thermalOpen = line * ( 1.0 - sealed );
              }
              if ( inRoad > 8.0 ) {
                float k = floor( inRoad / gLaneW + 0.5 );
                float wobL = ( cityNoise( vec2( rp.x * 0.045, k * 7.0 ) ) - 0.5 ) * 2.2;
                float run = smoothstep( 0.62, 0.76, cityNoise( vec2( rp.x * 0.012, k * 3.0 + 40.0 ) ) + 0.25 * age );
                laneJoint = groundBand( abs( inRoad - k * gLaneW - wobL ), 0.45, fp ) * run * step( 0.5, k );
              }
            }
            float tar = max( max( thermal, laneJoint ), stretchJoint * 0.8 );
            vec3 asphalt = base * ( 0.8 + 0.42 * ag.r + ( ag.g - 0.5 ) * 0.18 ) * ( 0.9 + 0.2 * macro ) * ( 0.94 + 0.12 * ag.a );
            // An older stretch is greyer and paler, a fresh one black and even.
            asphalt *= 0.92 + 0.16 * stretch;
            asphalt = mix( asphalt, mix( vec3( dot( asphalt, vec3( 0.2126, 0.7152, 0.0722 ) ) ), asphalt, 0.7 ) * 1.06, age * 0.5 );
            asphalt = mix( asphalt, base * ( 0.7 + 0.12 * ag.r ), fresh * 0.7 );
            asphalt *= 1.0 + 0.085 * wheel;
            vec3 patchCol = mix( base * ( 0.72 + 0.2 * ag.b ), vec3( dot( base, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * ( 1.5 + 0.3 * ag.r ), capped );
            asphalt = mix( asphalt, patchCol, patchM );
            asphalt *= 1.0 - 0.38 * seam - 0.42 * sealLine - 0.35 * hair - 0.4 * tar - 0.42 * thermalOpen;
            asphalt *= 1.0 - 0.3 * oilLane;
            // Junction boxes (inside two carriageways at once, no lanes): turning
            // tyres polish them in broad swathes and cars waiting to turn drip oil.
            float junctionBox = gLaneW < 1.0 && gKerb < -3.0 ? smoothstep( 3.0, 9.0, inRoad ) : 0.0;
            if ( junctionBox > 0.0 ) {
              float swathe = cityNoise( gp * 0.03 + 21.0 ) * 0.6 + cityNoise( gp * 0.11 + 5.0 ) * 0.4;
              float drip = smoothstep( 0.6, 0.82, cityNoise( gp * 0.075 + 33.0 ) * 0.7 + cityNoise( gp * 0.4 ) * 0.3 ) * groundFade( 2.0, fp );
              asphalt *= 1.0 - junctionBox * ( 0.1 * smoothstep( 0.45, 0.75, swathe ) + 0.26 * drip );
              wheel = max( wheel, junctionBox * smoothstep( 0.45, 0.75, swathe ) * 0.8 );
              oilLane = max( oilLane, junctionBox * drip );
            }
            float h = ( ag.r - 0.5 ) * 0.4 + ( ag.g - 0.5 ) * 0.3 - 0.35 * hair - 0.1 * sealLine + 0.05 * seam - 0.06 * patchM + 0.04 * tar - 0.3 * thermalOpen;
            float rough = clamp( 0.86 - 0.16 * wheel - 0.24 * seam - 0.3 * sealLine - 0.3 * tar - 0.16 * oilLane - 0.08 * patchM + 0.04 * capped + ( ag.g - 0.5 ) * 0.12, 0.35, 0.95 );
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
              // Slabs relaid after works: paler and cleaner than their neighbours.
              pave *= 1.0 + 0.12 * step( 0.93, cityHash( cellId + 19.0 ) ) * groundFade( s, fp );
              // A utility cover set in a slab: a steel meter lid with a raised
              // tread, or a concrete access plate in an iron frame.
              if ( cityHash( cellId + 41.0 ) > 0.965 ) {
                vec2 lf = fr - ( cellId + 0.5 ) * s;
                float steel = step( 0.5, cityHash( cellId + 43.0 ) );
                float sdP = groundBox( lf, steel > 0.5 ? vec2( 2.1, 1.5 ) : vec2( 3.3, 3.3 ) );
                float plate = 1.0 - smoothstep( -0.5 * fp, 0.5 * fp, sdP );
                float rim = groundBand( sdP + 0.25, 0.25, fp ) * groundFade( 0.5, fp );
                vec2 tq = abs( fract( lf * 1.6 ) - 0.5 );
                float treadP = steel * ( 1.0 - smoothstep( 0.16, 0.24, max( tq.x, tq.y ) ) ) * groundFade( 0.6, fp );
                vec3 lid = mix( base * 0.92 * ( 0.84 + 0.3 * cg.r ), vec3( 0.075, 0.072, 0.068 ) * ( 1.0 + 0.6 * treadP ), steel );
                lid = mix( lid, vec3( 0.06, 0.058, 0.055 ), rim );
                pave = mix( pave, lid, plate );
                h = mix( h, 0.08 * treadP - 0.1 * rim, plate );
                gMetal = max( gMetal, plate * steel * 0.45 );
              }
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
                // Box filtered: a joint narrower than a pixel still shows as a faint line.
                joint = mix( groundBand( st.y, 0.22, fp ), 0.05, smoothstep( 3.0, 6.0, fp ) );
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
              // World offset from this pixel to the middle of its slab.
              vec2 toCentre;
              if ( !byKerb ) {
                vec2 f = mod( fr - 9.0, 16.0 );
                sb = vec3( floor( ( fr - 9.0 ) / 16.0 ), min( min( f.x, 16.0 - f.x ), min( f.y, 16.0 - f.y ) ) );
                toCentre = 8.0 - f;
              } else {
                float odd = mod( sb.y, 2.0 );
                vec2 d = vec2( ( sb.x + 0.5 - 0.5 * odd ) * 16.0, ( sb.y + 0.5 ) * 8.0 ) - fr;
                toCentre = t * d.x + gKerbN * d.y;
              }
              // Each slab takes the sheet's colour at its middle. The sheet is a
              // unit or so a texel: magnified at street zoom its painted joint
              // lines, the plaza's dark bands and the texel steps between them
              // read as blocky pixels. Sampled once per slab, a band is whole dark
              // slabs and every slab one clean stone. Only stone against the same
              // stone snaps: a planter, a lawn edge or a tree pit keeps its outline.
              #if defined( USE_MAP ) && !defined( CITY_HILL )
              {
                vec3 cs = groundSheetAt( vMapUv + vec2( toCentre.x, -toCentre.y ) / cityGroundSize ) * diffuse;
                float cl = dot( cs, vec3( 0.2126, 0.7152, 0.0722 ) );
                float stone = smoothstep( 0.1, 0.16, cl ) * ( 1.0 - smoothstep( 0.004, 0.012, cs.g - max( cs.r, cs.b ) ) );
                float sameHue = 1.0 - smoothstep( 0.08, 0.2, length( cs / max( cl, 0.02 ) - sheet / max( lum, 0.02 ) ) );
                base = mix( sheet, cs, stone * sameHue );
              }
              #endif
              joint = mix( groundBand( sb.z, 0.12, fp ), 0.02, smoothstep( 3.0, 6.0, fp ) );
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
              joint = mix( groundBand( st.y, 0.16, fp ), 0.03, smoothstep( 3.0, 6.0, fp ) );
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
              loose = sheet * ( 0.94 + 0.12 * lg.b ) * ( 1.0 + 0.09 * ripple ) * ( 1.0 - 0.1 * step1 ) * ( 0.96 + 0.08 * macro );
              h = 0.35 * ripple + ( lg.b - 0.5 ) * 0.1 - 0.3 * step1;
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
        // How flat the view grazes the ground (0 from the street camera's height, 1 along the street at eye
        // level): what is left of the aggregate's bump and grain under the film glints pixel by pixel there
        // (a snow of specks down a wet street), so the film levels more of them the flatter the view.
        float wetGraze = 1.0 - smoothstep( 0.08, 0.35, dot( isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition ), normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) );
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
        roughnessFactor = mix( roughnessFactor, min( roughnessFactor, cityWetDetail > 0.5 ? 0.28 + 0.16 * mix( grain, 0.5, wetGraze ) : 0.6 ), wetFilm * ( 1.0 - 0.7 * grassMask ) );
        // Not a perfect mirror: at 0.05 the sun's reflection in a puddle was a blinding
        // blob that bloomed across the street from the air.
        roughnessFactor = mix( roughnessFactor, 0.09, puddle );`;
      const GROUND_NORMAL = `
        {
          // The materials' height as a bump (three.js perturbNormalArb): grain,
          // joints, cracks, the kerb's face, paint, setts. Water levels it: a
          // puddle entirely, the damp film mostly (the glossy film on the full
          // aggregate bump glinted pixel by pixel, a snow of specks in the rain).
          float bumpH = gHeight * ( 1.0 - puddle ) * ( 1.0 - mix( 0.65, 0.97, wetGraze ) * wetFilm ) * ( cityGroundDetail > 0.5 ? 1.0 : 0.0 );
          vec2 dHdxy = vec2( dFdx( bumpH ), dFdy( bumpH ) ) * 0.9;
          // Screen derivatives are shared by each 2 x 2 block of pixels, so a
          // height step (a paint edge, a joint, the kerb's arris) landing inside
          // one block tilted both pixels steeply, and which blocks caught the
          // steps changed every time the view moved by a pixel: bright and dark
          // fringes that crawled along every marking and kerb in motion. The tilt
          // one pixel can take is capped (about 12 degrees), and what the cap
          // removes goes into the roughness instead, so the edge keeps its
          // average sheen rather than a flickering glint.
          float slopeCap = 0.22 * fp, slope = length( dHdxy );
          if ( cityGroundSlopeCap > 0.5 && slope > slopeCap ) {
            dHdxy *= slopeCap / slope;
            float lost = min( slope / fp, 2.0 ) - 0.22;
            roughnessFactor = min( 1.0, sqrt( roughnessFactor * roughnessFactor + 0.35 * lost * lost ) );
          }
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
