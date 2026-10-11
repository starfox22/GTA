      // Street avatars' shader: the player body's dual quaternion skinning on lean attributes, the colour atlas (hair
      // cards cut out by its alpha), skin lit a little softer than cloth, gore folds and wound soaks.
      /**
       * NPC AVATAR SHADER (one program for every slot; each slot's material carries its own uniforms)
       * VERTEX: each vertex follows two bones (npcSkin) as dual quaternions (npcQr/npcQd from npcAvatarFlush, as
       * playerBodyFlush makes them), the hands blend to their gripping shape (npcGripAmount: left, right), a part the
       * person lost (npcLost, a bit per bone: the vertex's part npcSkin.w) folds onto its cut (npcCut, bind space),
       * where the crowd's stump stands (crowd3d-gore.js). FRAGMENT: colour from the atlas (sRGB), cut-out cards
       * (zone 5) by its alpha, wounds (npcWound, bind metres, w = 2 + radius) soak cloth or skin as on the player.
       * TINT (vNpcTint, npcTint or the mid row's texel 31) recolours the top garment the atlas' alpha marks (npc_paint.py).
       * The depth program skins the same way and cuts the same cards, so hair casts a hair-shaped shadow.
       */
      const NPC_VERTEX_PARS = `
        attribute vec4 npcSkin;
        attribute vec3 npcGrip;
        attribute float npcZone;
        attribute vec2 npcUv;
        uniform vec3 npcCut[ ${PB_BONES} ];
        #ifdef NPC_MID
          // MID BATCH: one row of npcBones per instance from npcBase: rotations, duals, then (scale, grips, lost).
          uniform sampler2D npcBones;
          uniform float npcBase;
          vec4 npcBone( int i ) { return texelFetch( npcBones, ivec2( i, int( npcBase + 0.5 ) + gl_InstanceID ), 0 ); }
        #else
          uniform vec4 npcQr[ ${PB_BONES} ];
          uniform vec4 npcQd[ ${PB_BONES} ];
          uniform float npcScale;
          uniform vec2 npcGripAmount;
          uniform float npcLost;
          uniform vec4 npcTint;
        #endif
        varying vec2 vNpcUv;
        varying vec4 vNpcTint;
        varying float vNpcZone;
        varying vec3 vNpcBind;
        vec3 npcQRot( vec4 q, vec3 v ) { return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v ); }`;
      const NPC_SKIN_VERTEX = `
        vec4 npcR, npcD;
        vec3 npcPos;
        float npcS;
        {
          int ia = int( npcSkin.x + 0.5 );
          int ib = int( npcSkin.y + 0.5 );
          #ifdef NPC_MID
            vec4 ra = npcBone( ia ), da = npcBone( ia + ${PB_BONES} ), rb = npcBone( ib ), db = npcBone( ib + ${PB_BONES} );
            vec4 extra = npcBone( ${2 * PB_BONES} );
            float npcScale = extra.x;
            vec2 npcGripAmount = extra.yz;
            float npcLost = extra.w;
            vNpcTint = npcBone( ${2 * PB_BONES + 1} );
          #else
            vNpcTint = npcTint;
            vec4 ra = npcQr[ ia ], da = npcQd[ ia ], rb = npcQr[ ib ], db = npcQd[ ib ];
          #endif
          npcS = npcScale;
          if ( dot( ra, rb ) < 0.0 ) { rb = -rb; db = -db; }
          float wb = npcSkin.z;
          npcR = ra * ( 1.0 - wb ) + rb * wb;
          npcD = da * ( 1.0 - wb ) + db * wb;
          float len = length( npcR );
          npcR /= len;
          npcD /= len;
          float hand = step( 6.5, npcSkin.w ) * step( npcSkin.w, 8.5 );
          float grip = hand * ( npcSkin.w > 7.5 ? npcGripAmount.y : npcGripAmount.x );
          npcPos = mix( position, npcGrip, grip );
          if ( npcLost > 0.5 ) {
            float part = floor( npcSkin.w + 0.5 );
            if ( mod( floor( npcLost / exp2( part ) ), 2.0 ) > 0.5 ) npcPos = npcCut[ int( part ) ];
          }
          vNpcUv = npcUv;
          vNpcZone = npcZone;
          vNpcBind = npcPos / ${PB_UNITS.toFixed(6)};
        }`;
      const NPC_BEGIN_VERTEX = `
        vec3 transformed = npcQRot( npcR, npcPos * npcS ) + 2.0 * ( npcR.w * npcD.xyz - npcD.w * npcR.xyz + cross( npcR.xyz, npcD.xyz ) );`;
      const NPC_FRAGMENT_PARS = `
        uniform sampler2D npcMap;
        uniform vec4 npcWound[ 4 ];
        varying vec2 vNpcUv;
        varying vec4 vNpcTint;
        varying float vNpcZone;
        varying vec3 vNpcBind;
        float npcRough = 0.85;
        float npcHash( vec3 p ) {
          p = fract( p * 0.3183099 + 0.1 );
          p *= 17.0;
          return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
        }
        float npcNoise( vec3 x ) {
          vec3 i = floor( x ), f = fract( x );
          f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( npcHash( i ), npcHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( npcHash( i + vec3( 0, 1, 0 ) ), npcHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
            mix( mix( npcHash( i + vec3( 0, 0, 1 ) ), npcHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( npcHash( i + vec3( 0, 1, 1 ) ), npcHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
        }`;
      const NPC_COLOR = `
        vec4 npcTex = texture2D( npcMap, vNpcUv );
        float npcZ = floor( vNpcZone + 0.5 );
        if ( npcZ > 4.5 && npcTex.a < 0.5 ) discard;
        vec3 npcC = npcTex.rgb;
        // TINT: the top garment (the atlas' alpha on cloth: 1 none, 0.5 all) recoloured by luminance to the person's
        // colour (vNpcTint.rgb, linear, already divided by the garment's mean luminance; w 1 on).
        if ( vNpcTint.w > 0.5 && npcZ < 0.5 ) npcC = mix( npcC, vNpcTint.rgb * dot( npcC, vec3( 0.2126, 0.7152, 0.0722 ) ), clamp( ( 1.0 - npcTex.a ) * 2.0, 0.0, 1.0 ) );
        // Skin (the head page and the hands) a little smoother than cloth; eyes glossy; hair cards soft.
        float npcLum = dot( npcC, vec3( 0.2126, 0.7152, 0.0722 ) );
        npcRough = npcZ > 1.5 && npcZ < 2.5 ? 0.15 : ( npcZ > 0.5 && npcZ < 3.5 ) ? mix( 0.7, 0.55, smoothstep( 0.04, 0.12, npcLum ) ) : 0.86;
        for ( int i = 0; i < 4; i++ ) {
          vec4 w = npcWound[ i ];
          if ( w.w < 1.5 ) continue;
          float r = w.w - 2.0;
          vec3 d = vNpcBind - w.xyz;
          d.y *= d.y < 0.0 ? 0.55 : 1.0;
          float n = npcNoise( vNpcBind * 38.0 ) * 0.6 + npcNoise( vNpcBind * 95.0 ) * 0.4;
          float soak = 1.0 - smoothstep( r * 0.3, r * ( 0.85 + 0.5 * n ), length( d ) + n * r * 0.35 );
          float hole = 1.0 - smoothstep( r * 0.05, r * 0.2, length( vNpcBind - w.xyz ) );
          float lum = dot( npcC, vec3( 0.2126, 0.7152, 0.0722 ) );
          npcC = mix( npcC, vec3( 0.16, 0.012, 0.016 ) * ( 0.32 + 1.0 * min( lum * 2.5, 1.0 ) ), soak * 0.94 );
          npcC = mix( npcC, vec3( 0.045, 0.003, 0.004 ), hole * 0.85 );
          npcRough = mix( npcRough, 0.38, soak * 0.6 );
        }
        diffuseColor.rgb = npcC;`;
      function npcMaterialPatch(shader, uniforms) {
        cityMaterialPatch(shader);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + NPC_VERTEX_PARS)
          .replace('#include <beginnormal_vertex>', NPC_SKIN_VERTEX + '\nvec3 objectNormal = npcQRot( npcR, normalize( normal ) );\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
          .replace('#include <begin_vertex>', NPC_BEGIN_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + NPC_FRAGMENT_PARS)
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + NPC_COLOR)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = npcRough;');
      }
      function npcDepthPatch(shader, uniforms) {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + NPC_VERTEX_PARS)
          .replace('#include <begin_vertex>', NPC_SKIN_VERTEX + '\n' + NPC_BEGIN_VERTEX);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D npcMap;\nvarying vec2 vNpcUv;\nvarying float vNpcZone;\nvarying vec3 vNpcBind;')
          .replace('#include <clipping_planes_fragment>', 'if ( vNpcZone > 4.5 && texture2D( npcMap, vNpcUv ).a < 0.5 ) discard;\n#include <clipping_planes_fragment>');
      }
