      // Near set paint shader: the rig's paint with the second shape and variants, a painted face (eyes, brows,
      // lips, stubble, make-up), hair strands lit along their length, cloth folds, seams, pockets, and skin's light.
      /**
       * NEAR PAINT SHADER
       * The rig's paint patch (character-rig3d.js PAINT SHADER) and then, for the near parts only:
       *   vertex    the woman's shape by the paint's bit 32, the variant (bits 64..) folding the other
       *             styles to the joint, a hand's side by its instance order (left, right);
       *   face      (rigKind 0) painted in head space at the sculpt's places (NEAR_FACE): eye whites, iris
       *             and pupil from a palette (face code bits 0-2), the upper lid line, brows (slot B), lips
       *             (slot D) and the mouth line, nostrils, warm cheeks and ears, the sockets' shade, stubble
       *             or a beard in the jaw colour (slot C, bits 3-4), make-up (bits 5-6);
       *   hair      (1) streaks along the strands and a two-lobe highlight along them (Kajiya-Kay);
       *   cloth     (2-9) a relief turned into the normal by its screen derivatives (no tangents): folds at
       *             the waist, armpits, elbows, knees and the ankle break, seams, plackets and buttons,
       *             pockets, a crease in suit trousers, laces and soles; by garment code (bits 10-) and the
       *             fabric (denim twill and its tan stitching, leather creases, wool and knit);
       *   skin      (any region painted the paint's slot D, the skin by convention) wraps the light a little
       *             further in red than in blue (a subsurface hint) and is smoother than cloth.
       * Everything fades out below a pixel (`rigPx`, local units per pixel), so nothing shimmers at range.
       */
      const RIG_NEAR_VERTEX_PARS = `
        attribute vec3 rigAltPos;
        attribute vec3 rigAltNormal;
        attribute float rigVariant;
        attribute float rigKind;
        varying float vRigKind;
        varying float vRigSkin;
        varying float vRigCode;
        varying float vRigFemale;
        varying vec3 vRigLocalNormal;
        varying vec3 vRigHairT;
        varying vec3 vRigSlotA;
        varying vec3 vRigSlotB;
        varying vec3 vRigSlotD;`;
      const RIG_NEAR_VERTEX = `
        float rigFlags = floor( crowdMeta.y + 0.5 );
        float rigFemale = mod( floor( rigFlags / 32.0 ), 2.0 );
        float rigVar = mod( floor( rigFlags / 64.0 ), 16.0 );
        // Hands come in pairs, left then right (drawCrowdPerson's side loop).
        #if __VERSION__ >= 300
          if ( abs( rigKind - 6.0 ) < 0.5 ) rigVar = float( gl_InstanceID % 2 );
        #else
          if ( abs( rigKind - 6.0 ) < 0.5 ) rigVar = 1.0;
        #endif
        float rigKeep = rigVariant < -0.5 || abs( rigVariant - rigVar ) < 0.5 ? 1.0 : 0.0;
        vec3 rigLocal = mix( position, rigAltPos, rigFemale ) * rigKeep;
        vec3 rigLocalN = normalize( mix( normal, rigAltNormal, rigFemale ) + vec3( 0.0, 1e-6, 0.0 ) );
        vCrowdLocal = rigLocal;
        vRigLocalNormal = rigLocalN;
        vRigKind = rigKind;
        vRigFemale = rigFemale;
        vRigCode = floor( rigFlags / 1024.0 );
        {
          int rigMask = int( crowdMeta.x + 0.5 );
          int rigSlot = ( rigMask >> ( 2 * int( crowdRegion + 0.5 ) ) ) & 3;
          float rigPacked = rigSlot == 0 ? crowdPaint.x : rigSlot == 1 ? crowdPaint.y : rigSlot == 2 ? crowdPaint.z : crowdPaint.w;
          vRigSkin = rigKind > 1.5 && rigPacked == crowdPaint.w ? 1.0 : 0.0;
        }
        vRigSlotA = crowdUnpack( crowdPaint.x );
        vRigSlotB = crowdUnpack( crowdPaint.y );
        vRigSlotD = crowdUnpack( crowdPaint.w );
        // Strands run down the head's surface.
        vec3 rigT = vec3( 0.0, -1.0, 0.0 ) + rigLocalN * rigLocalN.y;
        vRigHairT = ( modelViewMatrix * instanceMatrix * vec4( rigT, 0.0 ) ).xyz;`;
      const RIG_NEAR_FRAGMENT_PARS = `
        varying float vRigKind;
        varying float vRigSkin;
        varying float vRigCode;
        varying float vRigFemale;
        varying vec3 vRigLocalNormal;
        varying vec3 vRigHairT;
        varying vec3 vRigSlotA;
        varying vec3 vRigSlotB;
        varying vec3 vRigSlotD;
        // Set while painting, read by the normal and the light (RE_Direct below).
        float rigHeight = 0.0;
        float rigRough = -1.0;
        float rigSkinWrap = 0.0;
        float rigHairSpec = 0.0;
        vec3 rigHairDir = vec3( 0.0, 1.0, 0.0 );
        float rigSq( float x ) { return x * x; }
        vec3 rigLin( vec3 srgb ) { return pow( srgb, vec3( 2.2 ) ); }
        float rigHash( vec3 p ) {
          p = fract( p * 0.3183099 + 0.1 );
          p *= 17.0;
          return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
        }
        float rigNoise( vec3 x ) {
          vec3 i = floor( x ), f = fract( x );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( rigHash( i ), rigHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( rigHash( i + vec3( 0.0, 1.0, 0.0 ) ), rigHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
            mix( mix( rigHash( i + vec3( 0.0, 0.0, 1.0 ) ), rigHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( rigHash( i + vec3( 0.0, 1.0, 1.0 ) ), rigHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
        }
        // A line of width w round d = 0, softened by a pixel and faded once it is thinner than one.
        float rigLine( float d, float w, float px ) {
          return ( 1.0 - smoothstep( w * 0.5, w * 0.5 + px, abs( d ) ) ) * clamp( w / px, 0.0, 1.0 );
        }
        float rigBand( float v, float a, float b, float px ) {
          return smoothstep( a - px, a + px, v ) * ( 1.0 - smoothstep( b - px, b + px, v ) );
        }
        vec3 rigIris( float i ) {
          vec3 c = i < 0.5 ? vec3( 0.24, 0.14, 0.08 ) : i < 1.5 ? vec3( 0.33, 0.2, 0.1 ) : i < 2.5 ? vec3( 0.42, 0.34, 0.18 ) : i < 3.5 ? vec3( 0.3, 0.4, 0.22 )
            : i < 4.5 ? vec3( 0.3, 0.44, 0.58 ) : i < 5.5 ? vec3( 0.44, 0.5, 0.55 ) : i < 6.5 ? vec3( 0.13, 0.08, 0.05 ) : vec3( 0.5, 0.33, 0.12 );
          return rigLin( c );
        }
        float rigFaceRough = -1.0;
        /* The face, in head space (character-near3d-head.js NEAR_FACE). */
        vec3 rigFace( vec3 p, vec3 n, float code, float female, float px ) {
          vec3 skin = vRigSlotA, brow = vRigSlotB, jaw = vCrowdAccent, lips = vRigSlotD;
          float az = abs( p.z ), front = smoothstep( 0.25, 0.55, p.x );
          vec3 c = skin;
          // Warm cheeks, nose tip and ears; the sockets and under the jaw in soft shade.
          float warm = 0.7 * exp( -( rigSq( az - 0.4 ) / 0.02 + rigSq( p.y - 1.22 ) / 0.03 ) ) * front
            + 0.6 * exp( -( p.z * p.z / 0.012 + rigSq( p.y - 1.12 ) / 0.012 ) ) * front
            + 0.6 * smoothstep( 0.5, 0.6, az ) * smoothstep( 1.08, 1.18, p.y ) * ( 1.0 - smoothstep( 1.6, 1.7, p.y ) ) * ( 1.0 - smoothstep( 0.05, 0.2, p.x ) );
          c *= mix( vec3( 1.0 ), vec3( 1.08, 0.93, 0.9 ), clamp( warm, 0.0, 1.0 ) );
          float ez = az - 0.255, ey = p.y - 1.46;
          c *= 1.0 - 0.16 * exp( -( ez * ez / 0.02 + rigSq( ey - 0.025 ) / 0.012 ) ) * front;
          c *= 1.0 - 0.14 * ( 1.0 - smoothstep( 0.48, 0.66, p.y ) ) * smoothstep( -0.1, 0.4, p.x );
          float makeup = female > 0.5 ? mod( floor( code / 32.0 ), 4.0 ) : 0.0;
          // Blush.
          c = mix( c, c * rigLin( vec3( 1.0, 0.78, 0.8 ) ), 0.18 * makeup * exp( -( rigSq( az - 0.42 ) / 0.015 + rigSq( p.y - 1.2 ) / 0.02 ) ) * front );
          // Stubble or a beard: cheeks below the line from the sideburns to the mouth corners, chin, under the jaw, a moustache.
          float beard = mod( floor( code / 8.0 ), 4.0 );
          if ( beard > 0.5 ) {
            float line = mix( 0.98, 1.3, smoothstep( 0.2, 0.6, az ) );
            float zone = ( 1.0 - smoothstep( line - 0.04, line + 0.04, p.y ) ) * smoothstep( 0.42, 0.56, p.y ) * smoothstep( -0.2, 0.0, p.x );
            zone = max( zone, ( 1.0 - smoothstep( 0.15, 0.21, az ) ) * smoothstep( 0.945, 0.965, p.y ) * ( 1.0 - smoothstep( 1.035, 1.065, p.y ) ) * front );
            zone = max( zone, smoothstep( 0.52, 0.58, az ) * ( 1.0 - smoothstep( 1.42, 1.5, p.y ) ) * smoothstep( -0.18, -0.06, p.x ) * ( 1.0 - smoothstep( 0.15, 0.3, p.x ) ) );
            float dots = rigHash( floor( p * 90.0 ) );
            float grain = mix( 0.75, dots, clamp( 0.011 / px - 0.5, 0.0, 1.0 ) );
            c = mix( c, jaw, zone * ( beard > 1.5 ? 0.92 : 0.45 + 0.55 * grain ) );
          }
          // The eye: an almond between the lids, the outer corner a touch higher.
          float ex = ez / 0.125;
          float upper = 1.46 + 0.054 * ( 1.0 - ex * ex ) + 0.008 * ex;
          float lower = 1.46 - 0.034 * ( 1.0 - ex * ex ) + 0.006 * ex;
          float inEye = ( 1.0 - step( 1.0, abs( ex ) ) ) * smoothstep( lower - px, lower + px, p.y ) * ( 1.0 - smoothstep( upper - px, upper + px, p.y ) ) * front;
          float ir = length( vec2( ez + 0.004, ey - 0.004 ) );
          vec3 sclera = rigLin( vec3( 0.84, 0.8, 0.76 ) );
          vec3 iris = rigIris( mod( code, 8.0 ) ) * ( 1.0 - 0.3 * smoothstep( 0.022, 0.048, ir ) );
          vec3 eye = mix( sclera, iris, 1.0 - smoothstep( 0.046 - px, 0.046 + px, ir ) );
          eye = mix( eye, vec3( 0.006 ), 1.0 - smoothstep( 0.017 - px * 0.5, 0.017 + px * 0.5, ir ) );
          eye *= 1.0 - 0.4 * smoothstep( upper - 0.04, upper, p.y ) - 0.25 * smoothstep( 0.6, 1.0, abs( ex ) );
          c = mix( c, eye, inEye );
          rigFaceRough = mix( -1.0, 0.15, inEye );
          // Lashes along the upper lid (heavier outwards, lined with make-up), a fainter lower lid, the crease, shadow.
          float lash = 0.013 + 0.008 * max( ex, 0.0 ) + 0.007 * makeup;
          float lid = ( 1.0 - step( 1.06 + 0.12 * makeup, abs( ex ) ) ) * rigBand( p.y, upper - 0.004, upper + lash, px ) * front;
          c = mix( c, rigLin( vec3( 0.07, 0.05, 0.045 ) ), 0.85 * lid );
          c = mix( c, c * 0.72, ( 1.0 - step( 1.0, abs( ex ) ) ) * rigLine( p.y - lower + 0.004, 0.008, px ) * front );
          c = mix( c, c * 0.82, ( 1.0 - step( 1.05, abs( ex ) ) ) * rigLine( p.y - upper - 0.05, 0.012, px ) * front );
          c = mix( c, c * rigLin( vec3( 0.62, 0.5, 0.55 ) ), 0.3 * makeup * ( 1.0 - step( 1.15, abs( ex ) ) ) * rigBand( p.y, upper, upper + 0.065, px ) * front );
          // Brows, arched and tapering to the tail; a woman's finer and higher.
          float bz = ( az - 0.1 ) / 0.33;
          float browY = 1.585 + ( female > 0.5 ? 0.06 : 0.04 ) * sin( clamp( bz, 0.0, 1.0 ) * 2.6 );
          float browW = mix( 0.052, 0.022, clamp( bz, 0.0, 1.0 ) ) * ( female > 0.5 ? 0.72 : 1.0 );
          float browHair = mix( 0.85, 0.55 + 0.45 * rigNoise( vec3( az * 80.0, p.y * 30.0, 0.0 ) ), clamp( 0.012 / px - 0.5, 0.0, 1.0 ) );
          c = mix( c, brow, 0.9 * browHair * smoothstep( -0.05, 0.05, bz ) * ( 1.0 - smoothstep( 0.95, 1.05, bz ) ) * rigLine( p.y - browY, browW, px ) * front );
          // Lips: a cupid's bow above, a fuller lower lip, the mouth line between.
          float lz = az / ( female > 0.5 ? 0.185 : 0.2 );
          float upperLip = 0.905 + 0.04 * ( 1.0 - lz * lz ) - 0.01 * exp( -p.z * p.z / 0.0016 );
          float lowerLip = 0.905 - 0.05 * sqrt( max( 0.0, 1.0 - lz * lz ) );
          float lip = ( 1.0 - smoothstep( 0.96, 1.04, lz ) ) * smoothstep( lowerLip - px, lowerLip + px, p.y ) * ( 1.0 - smoothstep( upperLip - px, upperLip + px, p.y ) ) * front;
          c = mix( c, lips * ( 1.0 + 0.12 * smoothstep( 0.86, 0.88, p.y ) * ( 1.0 - smoothstep( 0.89, 0.9, p.y ) ) ), lip );
          rigFaceRough = max( rigFaceRough, mix( -1.0, 0.36, lip ) );
          c = mix( c, c * 0.3, ( 1.0 - step( 1.02, lz ) ) * rigLine( p.y - 0.905, 0.007, px ) * front );
          // Nostrils, under the tip's sides.
          c *= 1.0 - 0.65 * exp( -( rigSq( az - 0.062 ) / 0.0012 + rigSq( p.y - 1.078 ) / 0.0007 ) ) * ( 1.0 - smoothstep( -0.4, -0.05, n.y ) ) * front;
          return c;
        }
        /* Hair: streaks along the strands, finer with the distance gone. */
        vec3 rigHairColor( vec3 p, vec3 base, float px ) {
          float az = atan( p.z, p.x );
          float s = 0.6 * rigNoise( vec3( az * 24.0, p.y * 2.0, 0.0 ) ) + 0.4 * rigNoise( vec3( az * 58.0, p.y * 4.5, 7.0 ) );
          return base * mix( 1.0, 0.7 + 0.6 * s, clamp( 0.03 / px - 0.3, 0.0, 1.0 ) );
        }
        /**
         * Cloth relief per part (local space): x the height (local units), y how much darker (seams, folds'
         * shade, pocket mouths), z stitching. code: torso and sleeves 0 knit, 1 shirt, 2 suit, 3 jacket,
         * 4 uniform, 5 hoodie, 6 sleeveless knit, 7 bare; legs 0 trousers, 1 jeans, 2 suit trousers,
         * 3 uniform, 4 shorts, 5 under a skirt, 6 swimwear, 7 joggers; feet 0 shoe, 1 sneaker, 2 boot.
         */
        vec3 rigCloth( float kind, vec3 p, float code, float fabric, float px ) {
          float h = 0.0, dark = 0.0, stitch = 0.0;
          float az = abs( p.z );
          float depth = fabric > 1.5 && fabric < 2.5 ? 1.25 : fabric > 5.5 && fabric < 6.5 ? 1.35 : code > 1.5 && code < 2.5 ? 0.6 : 1.0;
          float fade = clamp( 0.05 / px - 0.5, 0.0, 1.0 );
          if ( kind < 2.5 ) {
            // Torso: the waist's gathers, pulls from the armpits, side and shoulder seams.
            float waist = ( 1.0 - smoothstep( 0.35, 1.35, p.y ) ) * smoothstep( -0.35, 0.05, p.y );
            h += 0.016 * depth * waist * sin( p.y * 15.0 + 2.6 * sin( p.z * 2.3 + p.x * 1.4 ) ) * ( 0.6 + 0.4 * sin( p.z * 4.1 + 1.0 ) );
            float pit = exp( -( rigSq( p.y - 2.3 ) / 0.22 + rigSq( az - 1.15 ) / 0.1 ) );
            h += 0.014 * depth * pit * sin( ( p.y * 0.8 + az * 0.7 ) * 13.0 );
            float seams = rigLine( p.x - 0.02, 0.035, px ) * step( 0.7, az ) * step( p.y, 2.85 ) + rigLine( p.x + 0.05, 0.035, px ) * step( 2.85, p.y ) * step( 0.42, az );
            h -= 0.006 * seams;
            dark += 0.1 * seams;
            stitch += seams;
            float frontSide = smoothstep( 0.3, 0.5, p.x );
            if ( code > 0.5 && code < 1.5 || code > 3.5 && code < 4.5 ) {
              // Shirts: the placket and its buttons; a uniform's chest pockets with flaps.
              float placket = rigLine( az - 0.06, 0.02, px ) * frontSide * step( p.y, 3.15 );
              float button = exp( -( p.z * p.z + rigSq( ( fract( p.y / 0.42 + 0.3 ) - 0.5 ) * 0.42 ) ) / 0.0012 ) * frontSide * step( p.y, 3.05 ) * fade;
              h += 0.014 * button - 0.004 * placket;
              dark += 0.12 * placket - 0.08 * button;
              if ( code > 3.5 ) {
                float pz = az - 0.56, py = p.y - 2.18;
                float pocket = rigBand( abs( pz ), -1.0, 0.21, px ) * rigBand( py, -0.25, 0.2, px ) * frontSide;
                float outline = max( rigLine( abs( pz ) - 0.21, 0.025, px ), 0.0 ) * rigBand( py, -0.25, 0.2, px ) + rigLine( py - 0.2, 0.025, px ) * step( abs( pz ), 0.21 );
                float flap = rigLine( py - 0.08, 0.02, px ) * step( abs( pz ), 0.21 );
                h += 0.01 * pocket - 0.004 * ( outline + flap ) * frontSide;
                dark += 0.14 * ( outline + flap ) * frontSide;
              }
            } else if ( code > 1.5 && code < 3.5 ) {
              // Suits and jackets: the lapel's raised edge along the open front, hip pockets' flaps, a suit's buttons.
              float vee = az - ( 0.1 + ( p.y - 1.4 ) * 0.27 );
              float lapel = rigLine( vee - 0.03, 0.06, px ) * step( 1.35, p.y ) * frontSide;
              h += 0.012 * lapel;
              dark -= 0.04 * lapel;
              float flap = rigLine( p.y - 0.5, 0.02, px ) * rigBand( az, 0.5, 1.0, px ) * frontSide;
              dark += 0.2 * flap;
              h -= 0.004 * flap;
              if ( code < 2.5 ) {
                float button = ( exp( -( p.z * p.z + rigSq( p.y - 1.05 ) ) / 0.0016 ) + exp( -( p.z * p.z + rigSq( p.y - 0.62 ) ) / 0.0016 ) ) * frontSide * fade;
                h += 0.016 * button;
                dark -= 0.1 * button;
              } else {
                float zip = rigLine( p.z, 0.025, px ) * frontSide * step( p.y, 1.42 );
                dark += 0.25 * zip;
              }
            } else if ( code > 4.5 && code < 5.5 ) {
              // Hoodie: the front pouch.
              float pouch = rigBand( az, -1.0, 0.62 - ( p.y - 0.2 ) * 0.15, px ) * rigBand( p.y, 0.2, 0.95, px ) * frontSide;
              float edge = rigLine( p.y - 0.95, 0.03, px ) * step( az, 0.5 ) * frontSide + rigLine( az - ( 0.62 - ( p.y - 0.2 ) * 0.15 ), 0.035, px ) * rigBand( p.y, 0.2, 0.95, px ) * frontSide;
              h += 0.012 * pouch - 0.006 * edge;
              dark += 0.12 * edge;
            }
            if ( code < 0.5 || code > 4.5 && code < 6.5 ) {
              // Knits: a ribbed hem and neckline.
              float rib = rigBand( p.y, -0.32, -0.14, px ) + rigBand( p.y, 3.24, 3.42, px );
              h += 0.003 * rib * sin( atan( p.z, p.x ) * 70.0 ) * fade;
              dark += 0.06 * rigLine( p.y + 0.14, 0.02, px ) + 0.06 * rigLine( p.y - 3.24, 0.02, px );
            }
          } else if ( kind < 3.5 ) {
            // Pelvis: front pockets, the fly, back pockets or welts, the yoke, side seams, the crotch's folds.
            float frontSide = smoothstep( 0.2, 0.45, p.x ), backSide = 1.0 - smoothstep( -0.45, -0.2, p.x );
            float seams = rigLine( p.x + 0.02, 0.035, px ) * step( 0.9, az ) * step( p.y, 0.62 );
            float crotch = ( 1.0 - smoothstep( -0.15, 0.25, p.y ) ) * step( az, 0.7 ) * frontSide;
            h += 0.014 * depth * crotch * sin( ( p.y * 1.0 + az * 1.3 ) * 14.0 );
            if ( code > 0.5 && code < 1.5 ) {
              float curve = length( vec2( ( az - 1.2 ) / 0.62, ( p.y - 1.02 ) / 0.62 ) ) - 1.0;
              float pocketMouth = rigLine( curve * 0.6, 0.03, px ) * frontSide * step( p.y, 1.0 ) * step( 0.4, p.y );
              float fly = rigLine( az - 0.16 + 0.12 * ( 1.0 - smoothstep( 0.2, 0.5, p.y ) ), 0.025, px ) * frontSide * rigBand( p.y, 0.15, 0.62, px ) * step( 0.0, p.z );
              float pz = az - 0.52, py = p.y - 0.36;
              float pocketPatch = rigBand( abs( pz ), -1.0, 0.3, px ) * rigBand( py + abs( pz ) * 0.25, -0.33, 0.32, px ) * backSide;
              float patchRim = ( rigLine( abs( pz ) - 0.3, 0.03, px ) * rigBand( py, -0.33, 0.32, px ) + rigLine( py - 0.32, 0.03, px ) * step( abs( pz ), 0.3 ) + rigLine( py + 0.33 - ( 0.3 - abs( pz ) ) * 0.25, 0.03, px ) * step( abs( pz ), 0.3 ) ) * backSide;
              float yoke = rigLine( p.y - 0.62 + az * 0.18, 0.03, px ) * backSide * step( p.y, 0.8 );
              float loops = rigLine( fract( atan( p.z, p.x ) * 1.27 + 0.5 ) - 0.5, 0.05, px ) * rigBand( p.y, 0.6, 1.0, px );
              h += 0.008 * pocketPatch + 0.006 * loops - 0.005 * ( pocketMouth + patchRim + yoke );
              dark += 0.25 * pocketMouth + 0.1 * ( patchRim + yoke ) + 0.12 * fly;
              stitch += pocketMouth + patchRim + yoke + fly + seams;
            } else if ( code < 3.5 ) {
              // Trousers: slanted pocket slits, back welts, the front crease begins.
              float slit = rigLine( az - 1.0 + ( p.y - 0.62 ) * 0.5, 0.025, px ) * frontSide * rigBand( p.y, 0.35, 0.95, px );
              float welt = rigLine( p.y - 0.62, 0.02, px ) * rigBand( az, 0.3, 0.75, px ) * backSide;
              float crease = rigLine( az - 0.62, 0.04, px ) * frontSide * step( p.y, 0.55 );
              h += ( code > 1.5 ? 0.012 : 0.004 ) * crease - 0.004 * ( slit + welt );
              dark += 0.22 * ( slit + welt );
            }
            h -= 0.005 * seams;
            dark += 0.08 * seams;
          } else if ( kind < 5.5 ) {
            // Sleeves: the armhole seam, folds in the crook of the elbow, a short sleeve's hem, a cuff.
            float elbow = kind < 4.5 ? 1.0 - smoothstep( -2.6, -2.0, p.y ) : 1.0 - smoothstep( -0.6, 0.0, p.y );
            h += 0.016 * depth * elbow * smoothstep( -0.1, 0.25, p.x ) * sin( p.y * 17.0 + az * 6.0 );
            if ( kind < 4.5 ) {
              float armhole = rigLine( p.y + 0.05, 0.035, px );
              float hem = rigLine( p.y + 1.1, 0.03, px );
              h -= 0.005 * ( armhole + hem );
              dark += 0.1 * armhole + 0.12 * hem;
              stitch += armhole;
            } else {
              float cuff = rigLine( p.y + 1.66, 0.03, px );
              h += 0.006 * rigBand( p.y, -2.2, -1.66, px ) - 0.004 * cuff;
              dark += 0.14 * cuff;
              h += 0.01 * depth * rigBand( p.y, -1.66, -1.2, px ) * sin( p.y * 22.0 + az * 4.0 );
            }
          } else if ( kind < 6.5 ) {
            // Gloves: knuckle creases.
            h += 0.006 * sin( p.y * 30.0 ) * fade;
          } else if ( kind < 8.5 ) {
            // Legs: folds at the hip and behind the knee (thigh), at the knee and the break over the shoe (shin),
            // side seams, a suit's crease, jeans' faded whiskers.
            float frontSide = smoothstep( 0.0, 0.25, p.x ), backSide = 1.0 - smoothstep( -0.25, 0.0, p.x );
            float seams = rigLine( p.x - 0.01, 0.035, px ) * step( 0.25, az );
            if ( kind < 7.5 ) {
              h += 0.015 * depth * ( 1.0 - smoothstep( -0.8, 0.2, p.y ) ) * smoothstep( -1.0, -0.6, p.y ) * frontSide * sin( ( p.y + az * 0.8 ) * 15.0 );
              h += 0.018 * depth * ( 1.0 - smoothstep( -3.5, -2.9, p.y ) ) * backSide * sin( p.y * 19.0 + az * 3.0 );
            } else {
              h += 0.012 * depth * smoothstep( -0.6, 0.15, p.y ) * frontSide * sin( p.y * 16.0 + az * 5.0 );
              h += 0.02 * depth * ( 1.0 - smoothstep( -3.4, -2.85, p.y ) ) * sin( p.y * 13.0 + 2.0 * sin( atan( p.z, p.x ) * 2.0 ) );
              float hem = rigLine( p.y + 3.42, 0.03, px );
              dark += 0.1 * hem;
            }
            if ( code > 1.5 && code < 3.5 ) {
              float crease = rigLine( p.z, 0.05, px ) * frontSide;
              h += ( code < 2.5 ? 0.014 : 0.006 ) * crease;
              dark -= 0.05 * crease;
            }
            if ( code > 0.5 && code < 1.5 ) {
              float whisker = kind < 7.5 ? ( 1.0 - smoothstep( -0.9, 0.1, p.y ) ) * smoothstep( -1.2, -0.7, p.y ) * frontSide * smoothstep( 0.55, 0.9, sin( ( p.y * 2.2 - p.z * 3.0 ) * 6.0 ) ) : 0.0;
              dark -= 0.12 * whisker;
              stitch += seams;
            }
            h -= 0.004 * seams;
            dark += 0.08 * seams;
          } else {
            // Footwear: the welt where the upper meets the sole, laces over the instep, a toe cap's stitching.
            float welt = rigLine( p.y + 0.445, 0.03, px );
            float instep = rigBand( p.x, 0.15, 0.95, px ) * step( az, 0.13 ) * smoothstep( -0.25, -0.12, p.y );
            float laces = instep * smoothstep( 0.2, 0.8, sin( p.x * 34.0 ) * 0.5 + 0.5 + az * 2.0 - 0.3 ) * fade;
            float cap = code < 0.5 ? rigLine( length( vec2( ( p.x - 1.62 ) / 0.5, p.z / 0.42 ) ) - 1.0, 0.06, px ) * step( 1.05, p.x ) : 0.0;
            h += 0.008 * laces - 0.005 * ( welt + cap );
            dark += 0.18 * welt + 0.25 * laces * step( code, 1.5 ) + 0.1 * cap;
            stitch += code > 1.5 ? welt : 0.0;
          }
          return vec3( h * fade, dark, stitch * fade );
        }`;
      // The colour, roughness and relief, after the rig's own paint (character-rig3d.js rigPaintPatch).
      const RIG_NEAR_COLOR = `
        float rigPx = max( length( fwidth( vCrowdLocal ) ), 1e-5 );
        float rigK = floor( vRigKind + 0.5 );
        float rigFabric = vCrowdSlotA > 0.5 ? floor( vCrowdPattern + 0.5 ) : 0.0;
        if ( rigK < 0.5 ) {
          diffuseColor.rgb = rigFace( vCrowdLocal, normalize( vRigLocalNormal ), vRigCode, vRigFemale, rigPx );
          rigSkinWrap = 1.0;
          rigRough = rigFaceRough > 0.0 ? rigFaceRough : 0.52;
        } else if ( rigK < 1.5 ) {
          diffuseColor.rgb = rigHairColor( vCrowdLocal, diffuseColor.rgb, rigPx );
          rigHairSpec = 1.0;
          rigHairDir = normalize( vRigHairT + vec3( 0.0, 1e-5, 0.0 ) );
          rigRough = 0.62;
        } else {
          vec3 rigC = rigCloth( rigK, vCrowdLocal, vRigCode, rigFabric, rigPx );
          float rigClothy = 1.0 - vRigSkin;
          rigHeight = rigC.x * rigClothy;
          diffuseColor.rgb *= 1.0 - clamp( rigC.y, -0.3, 0.6 ) * rigClothy;
          // Denim's tan thread along its seams; a twill too fine to see at range.
          if ( rigFabric > 1.5 && rigFabric < 2.5 ) {
            diffuseColor.rgb = mix( diffuseColor.rgb, rigLin( vec3( 0.72, 0.5, 0.26 ) ), clamp( rigC.z, 0.0, 1.0 ) * 0.55 * rigClothy );
            diffuseColor.rgb *= 1.0 - 0.06 * sin( ( vCrowdLocal.x + vCrowdLocal.y + vCrowdLocal.z ) * 110.0 ) * clamp( 0.006 / rigPx - 0.5, 0.0, 1.0 ) * rigClothy;
          }
          float rigShoe = rigK > 8.5 ? ( vRigCode < 0.5 ? 0.45 : vRigCode < 1.5 ? 0.72 : 0.6 ) : 0.88;
          rigRough = mix( rigFabric > 1.5 && rigFabric < 2.5 ? 0.93 : rigShoe, 0.5, vRigSkin );
          rigSkinWrap = vRigSkin;
        }`;
      // A roughness the paint asked for, except where the rig's leather and satin sheen already decided it.
      const RIG_NEAR_ROUGH = `
        if ( rigRough >= 0.0 && !( vCrowdSlotA > 0.5 && vCrowdPattern > 5.5 && vCrowdPattern < 7.5 ) ) roughnessFactor = rigRough;`;
      // The relief into the normal by its screen derivatives (three.js perturbNormalArb, without a bump map).
      const RIG_NEAR_NORMAL = `
        {
          vec2 rigDH = vec2( dFdx( rigHeight ), dFdy( rigHeight ) );
          vec3 rigSX = dFdx( - vViewPosition ), rigSY = dFdy( - vViewPosition );
          vec3 rigR1 = cross( rigSY, normal ), rigR2 = cross( normal, rigSX );
          float rigDet = dot( rigSX, rigR1 ) * faceDirection;
          vec3 rigGrad = sign( rigDet ) * ( rigDH.x * rigR1 + rigDH.y * rigR2 );
          if ( abs( rigDet ) > 1e-12 ) normal = normalize( abs( rigDet ) * normal - rigGrad );
        }`;
      // Skin wraps the light further in red; hair adds a highlight along its strands.
      const RIG_NEAR_DIRECT = `{
          float rigNL = dot( geometryNormal, directLight.direction );
          vec3 rigWrap = rigSkinWrap * vec3( 0.42, 0.2, 0.13 );
          vec3 rigLit = saturate( ( vec3( rigNL ) + rigWrap ) / ( 1.0 + rigWrap ) );
          reflectedLight.directDiffuse += rigLit * directLight.color * BRDF_Lambert( material.diffuseColor );
          if ( rigHairSpec > 0.0 ) {
            vec3 rigH = normalize( directLight.direction + geometryViewDir );
            float rigT1 = dot( normalize( rigHairDir + geometryNormal * 0.15 ), rigH );
            float rigT2 = dot( normalize( rigHairDir - geometryNormal * 0.12 ), rigH );
            float rigS1 = pow( sqrt( max( 0.0, 1.0 - rigT1 * rigT1 ) ), 80.0 );
            float rigS2 = pow( sqrt( max( 0.0, 1.0 - rigT2 * rigT2 ) ), 20.0 );
            reflectedLight.directSpecular += directLight.color * smoothstep( -0.15, 0.3, rigNL ) * rigHairSpec * ( 0.1 * rigS1 + 0.25 * rigS2 * material.diffuseColor );
          }
        }`;
      const RIG_LAMBERT_DIRECT = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
      function rigNearPatch(shader) {
        rigPaintPatch(shader);
        const physical = Three.ShaderChunk.lights_physical_pars_fragment;
        if (!physical.includes(RIG_LAMBERT_DIRECT)) console.error('near paint: the direct-light chunk changed; skin and hair light as cloth');
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + RIG_NEAR_VERTEX_PARS)
          .replace('#include <beginnormal_vertex>', RIG_NEAR_VERTEX + '\n#include <beginnormal_vertex>\nobjectNormal = rigLocalN;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = rigLocal;');
        shader.fragmentShader = shader.fragmentShader
          // After the rig's and the city's declarations, before the light functions that read the globals.
          .replace('#include <lights_physical_pars_fragment>', RIG_NEAR_FRAGMENT_PARS + '\n' + physical.replace(RIG_LAMBERT_DIRECT, RIG_NEAR_DIRECT))
          .replace('#include <roughnessmap_fragment>', RIG_NEAR_COLOR + '\n#include <roughnessmap_fragment>')
          .replace('#include <metalnessmap_fragment>', RIG_NEAR_ROUGH + '\n#include <metalnessmap_fragment>')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RIG_NEAR_NORMAL);
      }
      const rigNearMaterial = (() => {
        const material = new Three.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
        material.onBeforeCompile = rigNearPatch;
        material.customProgramCacheKey = () => 'crowd-paint-near';
        return material;
      })();
      /* The shadow of a near part: its woman's shape and only its own variant. */
      const rigNearDepthMaterial = (() => {
        const material = new Three.MeshDepthMaterial({ depthPacking: Three.RGBADepthPacking });
        material.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 crowdMeta;\nattribute vec3 rigAltPos;\nattribute float rigVariant;').replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            {
              float rigFlags = floor( crowdMeta.y + 0.5 );
              float rigFemale = mod( floor( rigFlags / 32.0 ), 2.0 );
              float rigKeep = rigVariant < -0.5 || abs( rigVariant - mod( floor( rigFlags / 64.0 ), 16.0 ) ) < 0.5 ? 1.0 : 0.0;
              transformed = mix( transformed, rigAltPos, rigFemale ) * rigKeep;
            }`,
          );
        };
        material.customProgramCacheKey = () => 'crowd-near-depth';
        return material;
      })();
