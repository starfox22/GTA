      /**
       * WEAPONS
       * Built round the firing hand's grip at the origin, muzzle towards +x, a
       * touch larger than life so they read at street zoom. Regions: 0 metal,
       * 1 polymer / grips, 2 wood or tan furniture, 3 glass and bright steel.
       * `support` is where the other hand goes (x, y, z in weapon space).
       */
      const WEAPON_SCALE = 1.2;
      function rigWeaponGeometries() {
        const scaled = (g) => {
          g.scale(WEAPON_SCALE, WEAPON_SCALE, WEAPON_SCALE);
          return g;
        };
        return {
          pistol: scaled(
            rigMerge([
              rigBox(1.7, 0.3, 0.26, 0, 0.58, 0.3, 0),
              rigBox(1.3, 0.18, 0.24, 1, 0.52, 0.1, 0),
              rigBox(0.36, 0.95, 0.26, 1, -0.1, -0.34, 0, 0, 0, 0.28),
              rigBox(0.45, 0.07, 0.1, 1, 0.3, -0.14, 0),
            ]),
          ),
          smg: scaled(
            rigMerge([
              rigBox(2.3, 0.44, 0.3, 0, 0.62, 0.22, 0),
              rigRod(1.7, 2.5, 0.09, 0, 0.26, 0),
              rigBox(0.34, 0.85, 0.26, 1, -0.05, -0.34, 0, 0, 0, 0.26),
              rigBox(0.24, 1.05, 0.2, 0, 0.72, -0.5, 0, 0, 0, -0.08),
              rigBox(0.55, 0.36, 0.3, 1, 1.35, 0.08, 0),
              rigBox(0.95, 0.12, 0.26, 1, -0.95, 0.24, 0),
            ]),
          ),
          shotgun: scaled(
            rigMerge([
              rigRod(0.9, 5.4, 0.11, 0, 0.3, 0),
              rigRod(0.9, 4.2, 0.09, 0, 0.1, 0),
              rigBox(1.3, 0.3, 0.3, 2, 2.8, 0.1, 0),
              rigBox(1.5, 0.48, 0.3, 0, 0.35, 0.22, 0),
              rigBox(0.4, 0.2, 0.12, 0, 0.25, -0.12, 0),
              rigBox(2.5, 0.46, 0.28, 2, -1.25, 0.02, 0, 0, 0, 0.1),
              rigBox(0.22, 0.85, 0.3, 1, -2.5, -0.12, 0, 0, 0, 0.1),
            ]),
          ),
          rifle: scaled(
            rigMerge([
              rigBox(2.3, 0.52, 0.3, 0, 0.6, 0.24, 0),
              rigBox(1.9, 0.44, 0.34, 1, 2.65, 0.24, 0),
              rigRod(3.55, 4.6, 0.07, 0, 0.24, 0),
              rigBox(0.2, 0.26, 0.2, 0, 4.6, 0.24, 0),
              rigBox(0.36, 1.1, 0.26, 0, 0.95, -0.46, 0, 0, 0, -0.2),
              rigBox(0.32, 0.8, 0.26, 1, -0.05, -0.3, 0, 0, 0, 0.3),
              rigBox(1.3, 0.24, 0.24, 0, -0.95, 0.28, 0),
              rigBox(0.7, 0.62, 0.28, 1, -1.62, 0.14, 0),
              rigBox(0.66, 0.32, 0.24, 3, 0.9, 0.66, 0),
            ]),
          ),
          sniper: scaled(
            rigMerge([
              rigBox(2.0, 0.46, 0.3, 0, 0.55, 0.24, 0),
              rigRod(1.5, 6.4, 0.085, 0, 0.3, 0),
              rigBox(2.5, 0.42, 0.34, 2, 1.9, 0.05, 0),
              rigBox(0.3, 0.8, 0.26, 2, -0.08, -0.3, 0, 0, 0, 0.3),
              rigBox(2.0, 0.6, 0.28, 2, -1.3, 0.08, 0, 0, 0, 0.06),
              rigRod(-0.2, 1.9, 0.16, 3, 0.78, 0, 8, 0.2),
              rigBox(0.3, 0.3, 0.14, 0, 0.8, 0.52, 0),
            ]),
          ),
          rocket: scaled(
            rigMerge([
              rigRod(-3.1, 4.3, 0.4, 0, 0.62, 0, 10),
              rigPlace(rigRegion(new Three.ConeGeometry(0.46, 1.3, 10, 1), 2), 4.95, 0.62, 0, 0, 0, -Math.PI / 2),
              rigBox(0.34, 0.85, 0.28, 1, -0.05, -0.1, 0, 0, 0, 0.25),
              rigBox(0.3, 0.7, 0.28, 1, 1.8, -0.02, 0),
              rigBox(0.5, 0.36, 0.14, 1, 0.5, 1.12, -0.28),
            ]),
          ),
          knife: scaled(
            rigMerge([
              rigBox(0.9, 0.22, 0.18, 1, 0.05, 0, 0),
              rigBox(0.12, 0.42, 0.24, 0, 0.55, 0, 0),
              rigPlace(rigRegion(new Three.BoxGeometry(1.35, 0.2, 0.05), 3), 1.25, 0.02, 0),
            ]),
          ),
          // Ballistic shield on the support arm: slab (0), handle (1), viewport (3).
          shield: rigMerge([
            rigBox(0.2, 7.2, 4.8, 0, 0.35, -0.6, 0),
            rigBox(0.06, 0.9, 2.5, 3, 0.47, 2.2, 0),
            rigBox(0.5, 0.3, 0.3, 1, 0.05, 0, 0),
          ]),
        };
      }
      /* Where each weapon is held: the support hand (weapon space), and whether it is shouldered. */
      const WEAPON_HOLDS = {
        pistol: { support: [-0.05, -0.1, -0.2], shoulder: false, length: 1.8 },
        smg: { support: [1.35, -0.1, -0.1], shoulder: false, length: 3 },
        shotgun: { support: [2.8, -0.05, -0.1], shoulder: true, length: 6.4 },
        rifle: { support: [2.5, -0.02, -0.12], shoulder: true, length: 5.6 },
        sniper: { support: [1.9, -0.18, -0.1], shoulder: true, length: 7.6 },
        rocket: { support: [1.8, -0.35, -0.05], shoulder: true, onShoulder: true, length: 8 },
        knife: { support: null, shoulder: false, length: 1.5 },
      };
      /* POLICE / FED lettering: a canvas texture on a small tilted panel. */
      function rigLabelMaterial(text, color, width = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = 80;
        const g = canvas.getContext('2d');
        g.fillStyle = color;
        g.font = `900 ${text.length > 3 ? 62 : 72}px Arial, Helvetica, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, width / 2, 42, width - 12);
        const map = new Three.CanvasTexture(canvas);
        map.colorSpace = Three.SRGBColorSpace;
        map.anisotropy = 4;
        return new Three.MeshStandardMaterial({ map, alphaTest: 0.45, roughness: 0.7 });
      }
      // The panel faces backwards and up (it sits across the upper back), text reading left to right from behind.
      const rigLabelGeometry = (() => {
        const g = new Three.PlaneGeometry(2.3, 0.72);
        g.rotateY(-Math.PI / 2);
        g.rotateZ(-0.62);
        return g;
      })();
