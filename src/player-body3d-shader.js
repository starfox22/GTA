      // Player body shader: dual quaternion skinning of the bind-space mesh, the hands' grip, and the paint (skin with a
      // subsurface wrap, a forties' face with stubble and age lines, hair strands, eyes, black jersey, denim, leather).
      /**
       * VERTEX: each vertex follows two bones (pbSkin) blended as dual quaternions (pbQr/pbQd: rotation and
       * translation of bone i from bind to now, playerBodyFlush), so elbows and knees keep their volume and
       * twisted shoulders do not pinch. The mesh is in rig units; pbScale is the rig's height scale. The hands
       * blend to their gripping shape by pbGripAmount (left, right). The paint reads the bind position (metres),
       * its normal, the zones and the occlusion. GORE: a part he lost (pbLost, a bit per bone: the vertex's part
       * pbSkin.w) folds onto its cut (pbCut[bone], bind space), where the crowd's stump stands (crowd3d-gore.js);
       * pbWound (bind metres, w = 2 + the stain's radius) soaks the tee, the jeans or the skin round a wound.
       */
      const PB_VERTEX_PARS = `
        attribute vec4 pbSkin;
        attribute vec4 pbGrip;
        attribute vec3 pbGripN;
        attribute vec3 pbTrig;
        attribute vec3 pbTrigN;
        attribute vec4 pbZone;
        attribute vec2 pbUv;
        varying vec2 vPbUv;
        uniform vec4 pbQr[ ${PB_BONES} ];
        uniform vec4 pbQd[ ${PB_BONES} ];
        uniform float pbScale;
        uniform vec2 pbGripAmount;
        uniform vec2 pbTrigger;
        uniform float pbLost;
        uniform vec3 pbCut[ ${PB_BONES} ];
        varying vec3 vPbBind;
        varying vec3 vPbBindN;
        varying vec4 vPbZone;
        varying float vPbAO;
        varying vec3 vPbHairT;
        vec3 pbQRot( vec4 q, vec3 v ) { return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v ); }`;
      const PB_SKIN_VERTEX = `
        vec4 pbR, pbD;
        vec3 pbPos, pbNrm;
        {
          int ia = int( pbSkin.x + 0.5 );
          int ib = int( pbSkin.y + 0.5 );
          vec4 ra = pbQr[ ia ], da = pbQd[ ia ], rb = pbQr[ ib ], db = pbQd[ ib ];
          if ( dot( ra, rb ) < 0.0 ) { rb = -rb; db = -db; }
          float wb = pbSkin.z;
          pbR = ra * ( 1.0 - wb ) + rb * wb;
          pbD = da * ( 1.0 - wb ) + db * wb;
          float len = length( pbR );
          pbR /= len;
          pbD /= len;
          // The hands' grip: bone 7 the left hand, 8 the right.
          float hand = step( 6.5, pbSkin.w ) * step( pbSkin.w, 8.5 );
          float grip = hand * ( pbSkin.w > 7.5 ? pbGripAmount.y : pbGripAmount.x );
          // The trigger finger: the index laid along the guard instead of curled with the rest.
          float trig = hand * ( pbSkin.w > 7.5 ? pbTrigger.y : pbTrigger.x );
          pbPos = mix( position, mix( pbGrip.xyz, pbTrig, trig ), grip );
          pbNrm = normalize( mix( normal, mix( pbGripN, pbTrigN, trig ), grip ) );
          // A part he lost folds onto its cut (gore.js; only on death).
          if ( pbLost > 0.5 ) {
            float pbPart = floor( pbSkin.w + 0.5 );
            if ( mod( floor( pbLost / exp2( pbPart ) ), 2.0 ) > 0.5 ) pbPos = pbCut[ int( pbPart ) ];
          }
          vPbBind = pbPos / ${PB_UNITS.toFixed(6)};
          vPbBindN = pbNrm;
          vPbZone = pbZone;
          vPbUv = pbUv;
          vPbAO = pbGrip.w;
          // Hair strands: combed back on top, down and back at the sides.
          vec3 dir = mix( vec3( -0.35, -1.0, 0.0 ), vec3( -1.0, -0.25, 0.0 ), smoothstep( 0.15, 0.75, pbNrm.y ) );
          vec3 hairT = dir - pbNrm * dot( dir, pbNrm );
          vPbHairT = ( viewMatrix * vec4( pbQRot( pbR, hairT ), 0.0 ) ).xyz;
        }`;
      const PB_BEGIN_VERTEX = `
        vec3 transformed = pbQRot( pbR, pbPos * pbScale ) + 2.0 * ( pbR.w * pbD.xyz - pbD.w * pbR.xyz + cross( pbR.xyz, pbD.xyz ) );
        #ifdef USE_ALPHAHASH
          vPosition = vec3( position );
        #endif`;
      /**
       * FRAGMENT. Everything is placed in bind space (metres, PB_EYES, the zones), so it travels with the skin.
       * Detail fades below a pixel (`pbPx`: metres per pixel). Lighting: skin wraps the light further in red
       * (a subsurface hint), cloth adds a sheen at grazing angles (black jersey reads as cloth, not a hole),
       * hair takes two highlights along its strands.
       */
      const PB_FRAGMENT_PARS = `
        varying vec3 vPbBind;
        varying vec3 vPbBindN;
        varying vec4 vPbZone;
        varying float vPbAO;
        varying vec3 vPbHairT;
        varying vec2 vPbUv;
        uniform float pbTextured;
        uniform sampler2D pbSkinMap;
        uniform sampler2D pbDetailMap;
        vec3 pbMapN = vec3( 0.0, 0.0, 1.0 );
        uniform float pbScale;
        uniform vec3 cityPlayerRim;
        uniform vec4 pbWound[ 4 ];
        float pbSkinWrap = 0.0;
        float pbSheen = 0.0;
        float pbHairSpec = 0.0;
        float pbRough = -1.0;
        // Specular strength and grazing reflectance (cloth and hair reflect far less than a polished dielectric).
        float pbSpec = 1.0;
        float pbSpecF90 = 1.0;
        float pbEyeLid = 0.0;
        uniform float pbBlink;
        uniform vec2 pbGaze;
        float pbHeight = 0.0;
        vec3 pbHairDir = vec3( 0.0, 1.0, 0.0 );
        float pbHash( vec3 p ) {
          p = fract( p * 0.3183099 + 0.1 );
          p *= 17.0;
          return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
        }
        float pbNoise( vec3 x ) {
          vec3 i = floor( x ), f = fract( x );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( pbHash( i ), pbHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( pbHash( i + vec3( 0, 1, 0 ) ), pbHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
            mix( mix( pbHash( i + vec3( 0, 0, 1 ) ), pbHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( pbHash( i + vec3( 0, 1, 1 ) ), pbHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
        }
        vec3 pbLin( vec3 c ) { return pow( c, vec3( 2.2 ) ); }
        // A feature scale metres across, faded out once it is under ~2 pixels.
        float pbFade( float scale, float px ) { return clamp( scale / px * 0.5 - 0.5, 0.0, 1.0 ); }
        // A thin line at distance d (metres) of half width w, anti-aliased.
        float pbLine( float d, float w, float px ) { return 1.0 - smoothstep( w, w + px * 1.2, abs( d ) ); }
        float pbStep( float d, float px ) { return smoothstep( -px, px, d ); }
        const vec3 PB_EYE_L = vec3( ${PB_EYES[0].join(', ')} );
        const vec3 PB_EYE_R = vec3( ${PB_EYES[1].join(', ')} );
        vec3 pbSkinColor( vec3 P, float px ) {
          vec3 base = pbLin( vec3( 0.76, 0.585, 0.475 ) );
          float n = pbNoise( P * 160.0 ) * 0.6 + pbNoise( P * 31.0 ) * 0.4;
          return base * ( 0.93 + 0.12 * n );
        }
        // The face: tones, brows, lips, stubble, lash lines and age lines (height into pbHeight).
        vec3 pbFace( vec3 P, vec3 N, float px ) {
          vec3 c = pbSkinColor( P, px );
          float az = abs( P.z );
          // Warmth: cheeks, nose, ears, lips' surround; the eye sockets a little darker and cooler.
          float cheek = exp( -pow( ( P.y - 1.636 ) / 0.013, 2.0 ) - pow( ( az - 0.044 ) / 0.016, 2.0 ) ) * step( 0.04, P.x );
          float nose = exp( -pow( ( P.y - 1.638 ) / 0.012, 2.0 ) - pow( P.z / 0.014, 2.0 ) ) * step( 0.095, P.x );
          float ear = smoothstep( 0.068, 0.078, az ) * step( P.x, 0.0 ) * step( 1.63, P.y ) * step( P.y, 1.705 );
          c = mix( c, c * vec3( 1.05, 0.86, 0.82 ), clamp( cheek * 0.35 + nose * 0.45 + ear * 0.4, 0.0, 1.0 ) );
          vec3 eyeC = az > 0.0 ? ( P.z < 0.0 ? PB_EYE_L : PB_EYE_R ) : PB_EYE_R;
          float socket = exp( -pow( ( P.y - eyeC.y + 0.006 ) / 0.012, 2.0 ) - pow( ( az - 0.033 ) / 0.02, 2.0 ) ) * step( 0.05, P.x );
          c = mix( c, c * vec3( 0.97, 0.95, 1.0 ), socket * 0.4 );
          // Lash lines: the lid margins round the opening (just outside the eyeball), the upper one heavier.
          float rim = length( P - eyeC ) - ${PB_EYE_R.toFixed(4)};
          float lash = ( 1.0 - smoothstep( 0.0005, 0.0018, rim ) ) * step( 0.06, P.x );
          float upper = step( eyeC.y - 0.0005, P.y );
          c = mix( c, c * 0.45, lash * ( 0.12 + 0.4 * upper ) );
          // Brows: an arch over each eye, hairs along it.
          float bz = clamp( ( az - 0.011 ) / 0.042, 0.0, 1.0 );
          float browY = 1.7035 + 0.0045 * sin( bz * 3.0 ) - 0.002 * bz;
          float browW = mix( 0.0042, 0.0024, bz );
          float brow = ( 1.0 - smoothstep( browW * 0.6, browW, abs( P.y - browY ) ) ) * step( az, 0.054 ) * step( 0.012, az ) * step( 0.06, P.x );
          float hairs = mix( 0.75, 0.6 + 0.8 * pbNoise( vec3( P.z * 1400.0, P.y * 300.0, 0.0 ) ), pbFade( 0.0008, px ) );
          c = mix( c, pbLin( vec3( 0.19, 0.13, 0.09 ) ), clamp( brow * hairs * 0.92, 0.0, 1.0 ) );
          // Crisp features up close: the upper lid's crease, the nose wings' groove, the nostrils' shade.
          float creaseY = eyeC.y + 0.0072 - 28.0 * ( az - 0.0335 ) * ( az - 0.0335 );
          float crease = pbLine( P.y - creaseY, 0.00028, px ) * step( abs( az - 0.0335 ), 0.0135 ) * step( 0.064, P.x );
          float alar = pbLine( length( vec2( P.y - 1.6305, az - 0.0138 ) ) - 0.0092, 0.0003, px ) * step( 0.094, P.x ) * step( P.y, 1.638 );
          float nostril = smoothstep( 0.0035, 0.0, length( vec2( ( P.y - 1.6245 ) * 1.6, az - 0.0078 ) ) - 0.003 ) * step( 0.097, P.x );
          c *= 1.0 - 0.2 * crease - 0.16 * alar - 0.45 * nostril;
          pbHeight -= ( 0.00018 * crease + 0.00015 * alar ) * pbFade( 0.001, px );
          // The lips' border: a fine light line along the upper lip with its bow, the philtrum's two ridges above.
          float bow = 1.6178 - 0.0013 * smoothstep( 0.007, 0.0, az ) + 0.0009 * smoothstep( 0.0, 0.006, az ) * smoothstep( 0.012, 0.006, az) - 0.0018 * smoothstep( 0.014, 0.022, az );
          float border = pbLine( P.y - bow, 0.00025, px ) * step( az, 0.022 ) * step( 0.083, P.x );
          float philtrum = ( pbLine( az - 0.0045, 0.0007, px ) ) * step( bow, P.y ) * step( P.y, 1.6245 ) * step( 0.09, P.x );
          c *= 1.0 + 0.1 * border;
          pbHeight += ( 0.00012 * border + 0.0001 * philtrum ) * pbFade( 0.001, px );
          // Lips.
          float lipZ = 1.0 - smoothstep( 0.017, 0.024, az );
          float lips = lipZ * smoothstep( 0.0815, 0.088, P.x ) * ( 1.0 - smoothstep( 1.6175, 1.6195, P.y ) ) * smoothstep( 1.5905, 1.5935, P.y );
          c = mix( c, c * vec3( 0.95, 0.78, 0.76 ), lips * 0.7 );
          float mouth = pbLine( P.y - 1.6052 - 0.0015 * pow( az / 0.022, 2.0 ), 0.0004, px ) * lipZ * step( 0.085, P.x );
          c *= 1.0 - 0.4 * mouth;
          // Stubble: two days on the jaw, chin, upper lip and cheeks below the cheekbones; dots when near.
          float jaw = smoothstep( 1.648, 1.632, P.y + 0.012 * smoothstep( 0.03, 0.06, az ) ) * smoothstep( 1.548, 1.575, P.y );
          float cheekLine = smoothstep( 0.07, 0.048, az + ( 1.64 - P.y ) * 0.35 ) * step( 0.015, P.x );
          float lipBand = ( 1.0 - lips ) * smoothstep( 1.6235, 1.619, P.y ) * step( 1.612, P.y ) * step( az, 0.026 ) * 0.6;
          float stubble = clamp( jaw * mix( 1.0, cheekLine, step( 1.6, P.y ) ) + lipBand, 0.0, 1.0 );
          stubble *= 1.0 - smoothstep( 1.616, 1.6185, P.y ) * ( 1.0 - lipBand ) * step( P.y, 1.625 ) * lipZ;
          stubble *= 1.0 - lips;
          float dots = pbHash( floor( P * 2600.0 ) );
          float near = pbFade( 0.0005, px );
          float cover = mix( 0.5, smoothstep( 0.35, 0.75, dots ), near );
          // Stubble greys the skin (dark hairs and the shade between them) rather than painting a beard on it.
          c = mix( c, c * vec3( 0.66, 0.66, 0.7 ), stubble * cover * 0.5 );
          // Age lines: across the forehead, crow's feet at the outer corners, under the eyes.
          float fore = step( 1.718, P.y ) * step( P.y, 1.756 ) * step( az, 0.05 ) * step( 0.06, P.x );
          float lines = 0.0;
          for ( int i = 0; i < 3; i++ ) lines += pbLine( P.y - 1.726 - float( i ) * 0.0105 - 0.002 * cos( P.z * 40.0 ), 0.0003, px ) * ( 1.0 - az / 0.05 );
          float corner = length( vec2( P.y - eyeC.y, az - 0.0475 ) );
          float crow = step( 0.044, az ) * smoothstep( 0.016, 0.006, corner ) * pbLine( sin( atan( P.y - eyeC.y, az - 0.0475 ) * 6.0 ) * corner, 0.0002, px );
          float under = pbLine( length( vec2( ( P.y - eyeC.y + 0.0085 ) * 2.2, az - 0.034 ) ) - 0.014, 0.0003, px ) * step( P.y, eyeC.y - 0.004 ) * step( 0.06, P.x );
          pbHeight -= ( 0.00008 * lines * fore + 0.00007 * crow + 0.00004 * under ) * pbFade( 0.0012, px );
          c *= 1.0 - 0.025 * ( lines * fore + crow + under );
          return c;
        }
        // Short brown hair: strands along the combing, the odd grey at the temples, the line broken into hairs.
        vec3 pbHair( vec3 P, vec3 T, float px, float inside, out float coverage ) {
          vec3 base = pbLin( vec3( 0.37, 0.26, 0.18 ) );
          vec3 t = normalize( T + vec3( 0.0, 1e-4, 0.0 ) );
          // Streaks: fine along the strands, coarse clumps; projected on the strand's cross axis.
          float across = dot( P, normalize( cross( t, vPbBindN ) + 1e-4 ) );
          float along = dot( P, t );
          float fine = pbNoise( vec3( across * 2200.0, along * 90.0, 0.0 ) );
          float clump = pbNoise( vec3( across * 260.0, along * 30.0, 3.0 ) );
          float streak = mix( 0.5, fine, pbFade( 0.0006, px ) ) * 0.5 + clump * 0.5;
          vec3 c = base * ( 0.4 + 1.1 * streak );
          // Grey creeping in at the temples and over the ears.
          float temple = smoothstep( 0.045, 0.07, abs( P.z ) ) * smoothstep( 1.77, 1.71, P.y ) * smoothstep( -0.06, 0.0, P.x );
          float grey = temple * smoothstep( 0.55, 0.85, pbHash( floor( vec3( across * 3000.0, along * 60.0, 1.0 ) ) ) );
          c = mix( c, pbLin( vec3( 0.62, 0.6, 0.58 ) ), grey * 0.7 );
          // The hairline: hairs thinning over the last few millimetres.
          float hairs = pbNoise( vec3( across * 1800.0, along * 120.0, 7.0 ) );
          coverage = smoothstep( -0.0015, 0.004, inside + ( hairs - 0.5 ) * 0.004 * pbFade( 0.0008, px ) );
          pbHeight += ( fine - 0.5 ) * 0.00035 * pbFade( 0.0007, px ) + ( clump - 0.5 ) * 0.0008 * pbFade( 0.003, px );
          return c;
        }
        // The eye: sclera, a hazel iris with a dark limbal ring and radial streaks, the pupil.
        vec3 pbEye( vec3 P, float px ) {
          vec3 e = P.z < 0.0 ? PB_EYE_L : PB_EYE_R;
          vec3 n = normalize( P - e );
          // Where he looks (pbGaze: yaw to the right, pitch up, from the head), a touch converged.
          float yaw = pbGaze.x, pitch = pbGaze.y;
          vec3 gaze = normalize( vec3( cos( pitch ) * cos( yaw ), sin( pitch ) - 0.03, cos( pitch ) * sin( yaw ) - sign( P.z ) * 0.025 ) );
          float c = dot( n, gaze );
          float r = sqrt( max( 0.0, 1.0 - c * c ) );
          vec3 sclera = pbLin( vec3( 0.9, 0.87, 0.84 ) ) * ( 1.0 - 0.2 * smoothstep( 0.6, 0.95, abs( n.z ) ) );
          vec3 side = normalize( cross( gaze, vec3( 0.0, 1.0, 0.0 ) ) + 1e-5 );
          float ang = atan( dot( n, cross( side, gaze ) ), dot( n, side ) );
          vec3 iris = pbLin( vec3( 0.36, 0.27, 0.15 ) ) * ( 0.7 + 0.5 * pbNoise( vec3( ang * 9.0, r * 60.0, 2.0 ) ) );
          iris = mix( iris, pbLin( vec3( 0.42, 0.4, 0.22 ) ), smoothstep( 0.2, 0.32, r ) * 0.4 );
          iris *= 1.0 - 0.6 * smoothstep( 0.4, 0.48, r );
          vec3 col = mix( iris, sclera, smoothstep( 0.47, 0.51, r ) );
          col = mix( pbLin( vec3( 0.02 ) ), col, smoothstep( 0.17, 0.2, r ) );
          // The upper lid: its edge drops as he looks down and all the way in a blink, lashes along it.
          float lidEdge = mix( 0.3 + 0.7 * min( pitch, 0.0 ), -0.42, pbBlink ) - 0.12 * n.z * n.z;
          pbEyeLid = smoothstep( lidEdge - 0.02, lidEdge + 0.02, n.y );
          vec3 lid = pbSkinColor( P, px ) * vec3( 0.95, 0.86, 0.84 );
          col = mix( col, lid, pbEyeLid );
          float lash = ( 1.0 - smoothstep( 0.0, 0.06, abs( n.y - lidEdge ) ) ) * smoothstep( 0.02, 0.15, pbBlink + max( 0.0, -pitch ) );
          col = mix( col, pbLin( vec3( 0.08, 0.06, 0.05 ) ), lash * 0.8 );
          return col;
        }
        // Black cotton jersey: knit, a few soft folds, the collar's rib and the hems' stitching.
        vec3 pbTee( vec3 P, vec3 N, float px, float hem, float neck ) {
          vec3 c = pbLin( vec3( 0.19, 0.19, 0.2 ) );
          float lowNoise = pbNoise( P * 22.0 );
          c *= 0.88 + 0.24 * lowNoise;
          // Washed a little lighter where it rubs: the shoulders' tops.
          c *= 1.0 + 0.18 * smoothstep( 0.5, 0.9, N.y ) * step( 1.38, P.y );
          float knit = pbNoise( vec3( P.x * 900.0, P.y * 2600.0, P.z * 900.0 ) );
          pbHeight += ( knit - 0.5 ) * 0.00012 * pbFade( 0.0006, px );
          // Bunching above the hem, folds at the armpits and the inside of the sleeves.
          float bunch = smoothstep( 1.08, 0.98, P.y ) * step( P.y, 1.1 );
          pbHeight += bunch * 0.0018 * sin( P.y * 170.0 + 3.0 * pbNoise( P * 18.0 ) ) * pbFade( 0.01, px );
          float pit = exp( -pow( ( P.y - 1.33 ) / 0.05, 2.0 ) ) * smoothstep( 0.12, 0.17, abs( P.z ) );
          pbHeight += pit * 0.0014 * sin( ( P.y * 0.8 + P.x ) * 140.0 ) * pbFade( 0.012, px );
          // Hems: a turned band with a stitch line; the collar rib.
          float band = 1.0 - smoothstep( 0.013, 0.015, hem );
          float stitch = pbLine( hem - 0.011, 0.0004, px );
          pbHeight += band * 0.0004 - stitch * 0.00025 * pbFade( 0.001, px );
          float rib = 1.0 - smoothstep( 0.016, 0.019, -neck );
          float ribs = sin( atan( P.z, P.x + 0.01 ) * 160.0 );
          pbHeight += rib * ( 0.0006 + ribs * 0.00012 * pbFade( 0.0015, px ) );
          c *= 1.0 - 0.1 * rib;
          pbSheen = 1.0;
          return c;
        }
        // Mid-wash denim: indigo with a twill, faded on the thighs and knees, whiskers, seams in tan thread, back
        // pockets, the hem stacked over the shoes.
        vec3 pbDenim( vec3 P, vec3 N, float px ) {
          float s = sign( P.z + 1e-5 );
          vec3 c = pbLin( vec3( 0.32, 0.38, 0.46 ) );
          float twill = sin( ( P.y * 1.0 + ( P.x + P.z * s ) * 0.7 ) * 2600.0 );
          float tf = pbFade( 0.0007, px );
          c *= 1.0 + 0.07 * twill * tf;
          float heather = pbNoise( vec3( P.x * 400.0, P.y * 60.0, P.z * 400.0 ) );
          c *= 0.9 + 0.2 * heather;
          // Fades: the fronts of the thighs and the knees; darker in the folds behind the knee.
          float front = smoothstep( -0.2, 0.7, N.x );
          float thigh = smoothstep( 0.45, 0.62, P.y ) * smoothstep( 0.86, 0.7, P.y );
          float knee = exp( -pow( ( P.y - 0.5 ) / 0.05, 2.0 ) );
          c = mix( c, c * vec3( 1.38, 1.32, 1.22 ), clamp( front * ( thigh * 0.55 + knee * 0.4 ), 0.0, 1.0 ) );
          // Whiskers at the hips' front: short creases fanning from the crotch.
          float whiskerZone = smoothstep( 0.3, 0.8, N.x ) * smoothstep( 0.74, 0.8, P.y ) * smoothstep( 0.92, 0.85, P.y );
          float wh = pbLine( sin( ( P.y - abs( P.z ) * 0.6 ) * 260.0 ), 0.25, 0.08 );
          c = mix( c, c * 1.35, whiskerZone * wh * 0.5 );
          pbHeight -= whiskerZone * wh * 0.0003 * pbFade( 0.004, px );
          float behind = exp( -pow( ( P.y - 0.5 ) / 0.04, 2.0 ) ) * smoothstep( 0.1, -0.5, N.x );
          pbHeight += behind * 0.0012 * sin( P.y * 200.0 + P.z * 60.0 ) * pbFade( 0.008, px );
          c *= 1.0 - 0.15 * behind;
          // Seams down the outside and the inside of each leg, double tan stitching beside them.
          float lateral = N.z * s;
          float seam = 0.0;
          if ( P.y < 0.95 ) {
            float out_ = pbLine( N.x * 0.05, 0.0006, px ) * step( 0.3, lateral );
            float in_ = pbLine( N.x * 0.05, 0.0006, px ) * step( lateral, -0.3 ) * step( P.y, 0.8 );
            seam = out_ + in_;
            float thread = ( pbLine( N.x * 0.05 - 0.0032, 0.00035, px ) + pbLine( N.x * 0.05 + 0.0032, 0.00035, px ) ) * step( 0.3, abs( lateral ) ) * ( step( 0.3, lateral ) + step( lateral, -0.3 ) * step( P.y, 0.8 ) );
            c = mix( c, pbLin( vec3( 0.72, 0.52, 0.28 ) ), clamp( thread * pbFade( 0.001, px ), 0.0, 1.0 ) * 0.7 );
          }
          pbHeight += seam * 0.0006 * pbFade( 0.002, px );
          c *= 1.0 - 0.18 * seam;
          // Back pockets: a pentagon on each side of the seat, stitched in tan.
          if ( N.x < -0.2 && P.y > 0.84 && P.y < 0.99 ) {
            float pz = abs( P.z ) - 0.075, py = P.y - 0.915;
            float shape = max( max( abs( pz ) - 0.046, py - 0.06 ), -py - 0.045 + abs( pz ) * 0.5 );
            float edge = pbLine( shape, 0.0005, px );
            c = mix( c, pbLin( vec3( 0.72, 0.52, 0.28 ) ), edge * 0.65 * pbFade( 0.001, px ) );
            pbHeight += step( shape, 0.0 ) * 0.0005 - edge * 0.0002;
            c *= 1.0 - 0.06 * step( shape, 0.0 );
          }
          // The hem stacking over the shoe.
          float stack = smoothstep( 0.17, 0.09, P.y );
          pbHeight += stack * 0.0016 * sin( P.y * 230.0 + P.x * 40.0 + pbNoise( P * 30.0 ) * 3.0 ) * pbFade( 0.006, px );
          pbSheen = 0.35;
          return c;
        }
        // Dark brown leather derbies: grain, creases over the ball, the welt's stitching, laces; rubber soles; socks.
        vec3 pbShoe( vec3 P, vec3 L, float px, float sole, float sock ) {
          vec3 c = pbLin( vec3( 0.2, 0.135, 0.095 ) );
          float grain = pbNoise( P * 1400.0 );
          c *= 0.85 + 0.25 * pbNoise( P * 90.0 ) + 0.1 * ( grain - 0.5 ) * pbFade( 0.0006, px );
          pbRough = 0.42 + 0.25 * pbNoise( P * 60.0 );
          return c;
        }`;
      const PB_COLOR = `
        float pbPx = max( length( fwidth( vPbBind ) ), 1e-6 );
        float pbMat = floor( vPbZone.x + 0.5 );
        vec3 pbN = normalize( vPbBindN );
        vec3 pbC;
        if ( pbTextured > 0.5 ) {
          // The shipped model (player-body3d-asset.js): colour from its atlas; the detail atlas holds the
          // tangent-space normal (rg) and the specular map (b). Skin (head and hands, the hair left out by its
          // darkness) takes the red wrap; cloth the sheen; the hair a soft highlight along its strands.
          pbC = texture2D( pbSkinMap, vPbUv ).rgb;
          vec3 pbDet = texture2D( pbDetailMap, vPbUv ).rgb;
          vec2 nxy = pbDet.rg * 2.0 - 1.0;
          pbMapN = vec3( nxy, sqrt( max( 0.0, 1.0 - dot( nxy, nxy ) ) ) );
          float lum = dot( pbC, vec3( 0.2126, 0.7152, 0.0722 ) );
          float hair = pbMat > 0.5 && pbMat < 1.5 ? 1.0 - smoothstep( 0.035, 0.075, lum ) : 0.0;
          float skin = vPbZone.y * ( 1.0 - hair );
          pbSkinWrap = skin;
          pbHairSpec = hair * 0.6;
          pbHairDir = normalize( vPbHairT + vec3( 0.0, 1e-5, 0.0 ) );
          float cloth = ( 1.0 - vPbZone.y ) * step( pbMat, 0.5 );
          pbSheen = cloth * 0.35;
          pbSpec = mix( mix( 0.25, 0.8, pbDet.b ), mix( 0.45, 0.9, pbDet.b ), skin );
          pbSpecF90 = mix( 0.35, 1.0, skin );
          pbRough = pbMat > 1.5 && pbMat < 2.5 ? 0.12 : mix( mix( 0.9, 0.6, pbDet.b ), mix( 0.62, 0.42, pbDet.b ), skin );
        } else if ( pbMat < 0.5 ) {
          // Owners: where the tee meets the jeans the two zones are opposite, so their shares add to one.
          float tee = smoothstep( -pbPx, pbPx, vPbZone.y );
          float jeans = min( smoothstep( -pbPx, pbPx, vPbZone.z ), 1.0 - tee );
          vec3 skin = pbSkinColor( vPbBind, pbPx );
          // The stubble carries on down the throat under the jaw, fading out above the collar.
          float neckBeard = smoothstep( 1.522, 1.56, vPbBind.y ) * smoothstep( -0.035, 0.02, vPbBind.x );
          float neckDots = mix( 0.5, smoothstep( 0.35, 0.75, pbHash( floor( vPbBind * 2600.0 ) ) ), pbFade( 0.0005, pbPx ) );
          skin = mix( skin, skin * vec3( 0.62, 0.62, 0.66 ), neckBeard * neckDots * 0.5 );
          // Arms: a touch redder at the elbows, the neck in the face's tone.
          pbC = skin;
          if ( tee > 0.0 ) pbC = mix( pbC, pbTee( vPbBind, pbN, pbPx, vPbZone.y, vPbZone.w ), tee );
          if ( jeans > 0.0 ) pbC = mix( pbC, pbDenim( vPbBind, pbN, pbPx ), jeans );
          float bare = clamp( 1.0 - tee - jeans, 0.0, 1.0 );
          pbSkinWrap = bare;
          pbSheen *= 1.0 - bare;
          pbSpec = mix( mix( 0.25, 0.4, jeans / max( 1e-3, tee + jeans ) ), 0.7, bare );
          pbSpecF90 = mix( 0.3, 1.0, bare );
          pbRough = mix( mix( 0.86, 0.9, jeans / max( 1e-3, tee + jeans ) ), 0.5, bare );
        } else if ( pbMat < 1.5 ) {
          vec3 face = pbFace( vPbBind, pbN, pbPx );
          float coverage = 0.0;
          vec3 hair = vPbZone.y > -0.006 ? pbHair( vPbBind, vPbHairT, pbPx, vPbZone.y, coverage ) : face;
          pbC = mix( face, hair, coverage );
          pbSkinWrap = 1.0 - coverage;
          pbHairSpec = coverage;
          pbHairDir = normalize( vPbHairT + vec3( 0.0, 1e-5, 0.0 ) );
          float lipGloss = ( 1.0 - smoothstep( 0.017, 0.024, abs( vPbBind.z ) ) ) * smoothstep( 0.0815, 0.088, vPbBind.x ) * step( vPbBind.y, 1.6185 ) * step( 1.592, vPbBind.y );
          pbRough = mix( mix( 0.52, 0.4, lipGloss ), 0.8, coverage );
          pbSpec = mix( 0.7, 0.5, coverage );
        } else if ( pbMat < 2.5 ) {
          pbC = pbEye( vPbBind, pbPx );
          pbRough = mix( 0.06, 0.5, pbEyeLid );
          pbSkinWrap = pbEyeLid;
        } else if ( pbMat < 3.5 ) {
          pbC = pbSkinColor( vPbBind, pbPx ) * vec3( 1.02, 0.95, 0.93 );
          float nail = smoothstep( -pbPx, pbPx, vPbZone.z );
          pbC = mix( pbC, pbC * vec3( 1.12, 1.0, 0.98 ) + 0.04, nail * 0.8 );
          pbSkinWrap = 1.0 - nail;
          pbRough = mix( 0.55, 0.3, nail );
          pbSpec = 0.7;
        } else {
          float sole = smoothstep( -pbPx, pbPx, vPbZone.y );
          float sock = smoothstep( -pbPx, pbPx, vPbZone.z ) * ( 1.0 - sole );
          pbC = pbShoe( vPbBind, vPbBind, pbPx, vPbZone.y, vPbZone.z );
          pbC = mix( pbC, pbLin( vec3( 0.07, 0.06, 0.055 ) ), sole );
          pbC = mix( pbC, pbLin( vec3( 0.1, 0.1, 0.11 ) ) * ( 0.9 + 0.2 * pbNoise( vPbBind * 300.0 ) ), sock );
          pbRough = mix( mix( pbRough, 0.8, sole ), 0.92, sock );
          pbSheen = sock;
          pbSpec = mix( 1.0, 0.3, sock );
          pbSpecF90 = mix( 1.0, 0.3, sock );
        }
        // Wounds (gore.js): the tee, the jeans or the skin soaked round each, further below than above, wet.
        for ( int i = 0; i < 4; i++ ) {
          vec4 w = pbWound[ i ];
          if ( w.w < 1.5 ) continue;
          float r = w.w - 2.0;
          vec3 d = vPbBind - w.xyz;
          d.y *= d.y < 0.0 ? 0.55 : 1.0;
          float n = pbNoise( vPbBind * 38.0 ) * 0.6 + pbNoise( vPbBind * 95.0 ) * 0.4;
          float soak = 1.0 - smoothstep( r * 0.3, r * ( 0.85 + 0.5 * n ), length( d ) + n * r * 0.35 );
          float hole = 1.0 - smoothstep( r * 0.05, r * 0.2, length( vPbBind - w.xyz ) );
          float lum = dot( pbC, vec3( 0.2126, 0.7152, 0.0722 ) );
          pbC = mix( pbC, vec3( 0.16, 0.012, 0.016 ) * ( 0.32 + 1.0 * min( lum * 2.5, 1.0 ) ), soak * 0.94 );
          pbC = mix( pbC, vec3( 0.045, 0.003, 0.004 ), hole * 0.85 );
          pbRough = mix( pbRough < 0.0 ? 0.8 : pbRough, 0.38, soak * 0.6 );
          pbSheen *= 1.0 - soak;
        }
        diffuseColor.rgb = pbC;`;
      const PB_ROUGH = `roughnessFactor = pbRough >= 0.0 ? pbRough : roughnessFactor;`;
      // The relief into the normal by its screen derivatives (three.js perturbNormalArb, without a bump map).
      const PB_NORMAL = `
        if ( pbTextured > 0.5 ) {
          // The model's normal map in a frame from the screen derivatives (three.js perturbNormal2Arb).
          vec3 q0 = dFdx( - vViewPosition ), q1 = dFdy( - vViewPosition );
          vec2 st0 = dFdx( vPbUv ), st1 = dFdy( vPbUv );
          vec3 q1perp = cross( q1, normal ), q0perp = cross( normal, q0 );
          vec3 T = q1perp * st0.x + q0perp * st1.x;
          vec3 Bt = q1perp * st0.y + q0perp * st1.y;
          float det = max( dot( T, T ), dot( Bt, Bt ) );
          float sc = det == 0.0 ? 0.0 : faceDirection * inversesqrt( det );
          normal = normalize( T * ( pbMapN.x * sc ) + Bt * ( pbMapN.y * sc ) + normal * pbMapN.z );
        }
        {
          float pbH = pbHeight * ${PB_UNITS.toFixed(6)} * pbScale;
          vec2 dH = vec2( dFdx( pbH ), dFdy( pbH ) );
          vec3 sx = dFdx( - vViewPosition ), sy = dFdy( - vViewPosition );
          vec3 r1 = cross( sy, normal ), r2 = cross( normal, sx );
          float det = dot( sx, r1 ) * faceDirection;
          vec3 grad = sign( det ) * ( dH.x * r1 + dH.y * r2 );
          if ( abs( det ) > 1e-12 ) normal = normalize( abs( det ) * normal - grad );
        }`;
      const PB_DIRECT = `{
          float pbNL = dot( geometryNormal, directLight.direction );
          // (Less in the creases: deep in an eye socket the red wrap read as a bruise.)
          vec3 pbWrap = pbSkinWrap * vPbAO * vPbAO * vec3( 0.26, 0.11, 0.07 );
          vec3 pbLit = saturate( ( vec3( pbNL ) + pbWrap ) / ( 1.0 + pbWrap ) );
          reflectedLight.directDiffuse += pbLit * directLight.color * BRDF_Lambert( material.diffuseColor );
          if ( pbSheen > 0.0 ) {
            // Cloth: a Charlie sheen (fibres catching the light at grazing angles).
            vec3 h = normalize( directLight.direction + geometryViewDir );
            float nh = saturate( dot( geometryNormal, h ) );
            float nv = saturate( dot( geometryNormal, geometryViewDir ) );
            float nl = saturate( pbNL );
            float r = 0.5;
            float sin2 = max( 1.0 - nh * nh, 0.0078125 );
            float D = ( 2.0 + 1.0 / r ) * pow( sin2, 0.5 / r ) * 0.1591549;
            float V = 1.0 / ( 4.0 * ( nl + nv - nl * nv ) + 1e-4 );
            reflectedLight.directSpecular += directLight.color * nl * D * V * pbSheen * vec3( 0.035, 0.035, 0.038 );
          }
          if ( pbHairSpec > 0.0 ) {
            vec3 h = normalize( directLight.direction + geometryViewDir );
            float t1 = dot( normalize( pbHairDir + geometryNormal * 0.15 ), h );
            float t2 = dot( normalize( pbHairDir - geometryNormal * 0.12 ), h );
            float s1 = pow( sqrt( max( 0.0, 1.0 - t1 * t1 ) ), 40.0 );
            float s2 = pow( sqrt( max( 0.0, 1.0 - t2 * t2 ) ), 16.0 );
            reflectedLight.directSpecular += directLight.color * smoothstep( -0.15, 0.3, pbNL ) * pbHairSpec * ( 0.022 * s1 + 0.18 * s2 * material.diffuseColor );
          }
        }`;
      const PB_INDIRECT = `
        // The face's creases (the folds by the mouth, under the lip) are shallow: their baked occlusion is
        // softened there, or they read as dirt.
        float pbAO = pbMat > 0.5 && pbMat < 1.5 ? mix( 0.55, 1.0, vPbAO ) : vPbAO;
        reflectedLight.indirectDiffuse *= pbAO;
        reflectedLight.indirectSpecular *= pbAO * ( 1.0 - 0.7 * pbHairSpec );
        // Cloth's sheen in the sky light too, and the deepest creases take a little of the direct light.
        // (vViewPosition runs from the surface to the camera.)
        reflectedLight.indirectSpecular += pbSheen * 0.045 * pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 ) * vPbAO * ( irradiance + iblIrradiance ) * RECIPROCAL_PI;
        reflectedLight.directDiffuse *= mix( 0.65, 1.0, pbAO );`;
      const PB_RIM = `
        {
          float rimView = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
          totalEmissiveRadiance += cityPlayerRim * rimView * rimView * rimView;
        }`;
      function pbMaterialPatch(shader) {
        cityMaterialPatch(shader);
        shader.uniforms.cityPlayerRim = playerRim;
        Object.assign(shader.uniforms, pbUniforms);
        const physical = Three.ShaderChunk.lights_physical_pars_fragment;
        if (!physical.includes(RIG_LAMBERT_DIRECT)) console.error('player body: the direct-light chunk changed; skin and cloth light as plastic');
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + PB_VERTEX_PARS)
          .replace('#include <beginnormal_vertex>', PB_SKIN_VERTEX + '\nvec3 objectNormal = pbQRot( pbR, pbNrm );\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
          .replace('#include <begin_vertex>', PB_BEGIN_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + PB_FRAGMENT_PARS)
          .replace('#include <lights_physical_pars_fragment>', physical.replace(RIG_LAMBERT_DIRECT, PB_DIRECT))
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + PB_COLOR)
          .replace('#include <metalnessmap_fragment>', PB_ROUGH + '\n#include <metalnessmap_fragment>')
          .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.specularColor *= pbSpec;\nmaterial.specularF90 = pbSpecF90;')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + PB_NORMAL)
          .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + PB_INDIRECT)
          .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + PB_RIM);
      }
      /* The shadow: the same skinning, nothing else. */
      function pbDepthPatch(shader) {
        Object.assign(shader.uniforms, pbUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + PB_VERTEX_PARS)
          .replace('#include <begin_vertex>', PB_SKIN_VERTEX + '\n' + PB_BEGIN_VERTEX);
      }
