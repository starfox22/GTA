      // Clouds 3D shadows: the plane over the city that throws the cloud field's shadows on the ground.
      // ---- Cloud shadows ------------------------------------------------------------------
      const shadeHeight =
        Math.min(620, Math.max(330, ...allBuildings.map((o) => o.height || 0))) + 12;
      const shadeUniforms = {
        ...cloudFieldUniforms(),
        uSunDirection: { value: SUN_DIRECTION.clone() },
        uViewDirection: { value: new Three.Vector3(0, -1, 0) },
        uPerspective: { value: 0 },
        uGround: { value: 0 },
        uStrength: { value: 0 },
      };
      const cloudShade = new Three.Mesh(
        new Three.PlaneGeometry(1, 1),
        new Three.ShaderMaterial({
          uniforms: shadeUniforms,
          // Blended, but queued with the opaque objects just before the cloud
          // composite, so the shadows darken the ground and never the clouds.
          depthWrite: false,
          blending: Three.CustomBlending,
          blendSrc: Three.SrcAlphaFactor,
          blendDst: Three.OneMinusSrcAlphaFactor,
          vertexShader: `
            varying vec3 vWorld;
            void main(){
              vec4 world = modelMatrix * vec4(position, 1.);
              vWorld = world.xyz;
              gl_Position = projectionMatrix * viewMatrix * world;
            }`,
          fragmentShader: `
            precision highp float;
            ${CLOUD_FIELD_GLSL}
            uniform vec3 uSunDirection, uViewDirection;
            uniform float uPerspective, uGround, uStrength;
            varying vec3 vWorld;
            // The layer's density with a soft threshold. cloudDensity() carves crisp
            // cells out of the noise, right for the cloud you fly past but, thrown on
            // the ground, a pattern of hard-edged blotches a hundred metres across
            // (camouflage, seen from a helicopter). A real cloud shadow is a broad,
            // soft pool: the same cells, but their edges ramp in over a wide band.
            float softCloud(vec3 p){
              float h = (p.y - uBase) / (uTop - uBase);
              float cover = cloudCoverage(p.xz);
              if (cover <= 0.001 || h <= 0. || h >= 1.) return 0.;
              float top = mix(0.36, 1.0, cover);
              float profile = smoothstep(0., 0.07, h) * (1. - smoothstep(top * 0.35, top, h));
              vec3 q = vec3(p.x + uWind.x, p.y, p.z + uWind.y);
              vec4 n = texture(uNoise, q / ${CLOUD_SHAPE_SCALE.toFixed(1)});
              float shape = n.r * 0.75 + n.b * 0.25;
              float cut = 1. - cover * profile * 0.94;
              return smoothstep(cut - 0.16, cut + 0.3, shape);
            }
            void main(){
              // Follow the view ray from this plane down to the ground it covers...
              vec3 rd = normalize(mix(uViewDirection, vWorld - cameraPosition, uPerspective));
              vec3 ground = vWorld + rd * ((uGround - vWorld.y) / min(rd.y, -0.05));
              // ...then look up the sun ray through the slab from there, at two heights,
              // each a small ring of taps (a ~60 m penumbra) so edges blur into the
              // soft pools a sun-lit cumulus actually throws.
              float depth = 0.;
              for (int i = 0; i < 2; i++){
                float y = mix(uBase, uTop, 0.22 + 0.26 * float(i));
                vec3 p = ground + uSunDirection * ((y - ground.y) / uSunDirection.y);
                depth += softCloud(p) * 2.;
                depth += softCloud(p + vec3(310., 0., 90.));
                depth += softCloud(p + vec3(-90., 0., 310.));
                depth += softCloud(p + vec3(-310., 0., -90.));
                depth += softCloud(p + vec3(90., 0., -310.));
              }
              float shade = smoothstep(0.04, 0.8, depth / 12.);
              // Sky-lit shade is cool but not ink: a slate tone rather than navy.
              gl_FragColor = vec4(0.06, 0.08, 0.12, shade * uStrength);
            }`,
        }),
      );
      cloudShade.rotation.x = -Math.PI / 2;
      cloudShade.renderOrder = 999;
      cloudShade.visible = false;
      cloudShade.frustumCulled = false;
      scene.add(cloudShade);
