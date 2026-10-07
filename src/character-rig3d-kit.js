      /* Kit worn over the torso (torso space). */
      function rigVestGeometry() {
        // Plate carrier / hi-vis vest. Regions: 0 base, 1 pouches, 2 reflective bands.
        const shell = rigLoft(
          [
            { y: 0.72, fx: 1.12, bx: 1.02, w: 1.46, n: 3.2 },
            { y: 1.1, fx: 1.16, bx: 1.04, w: 1.52, n: 3.2 },
            { y: 1.3, fx: 1.18, bx: 1.05, w: 1.56, n: 3.2 },
            { y: 1.55, fx: 1.2, bx: 1.06, w: 1.6, n: 3.2 },
            { y: 2.2, fx: 1.2, bx: 1.08, w: 1.66, n: 3.2 },
            { y: 2.45, fx: 1.16, bx: 1.1, w: 1.66, n: 3.2 },
            { y: 2.7, fx: 1.1, bx: 1.09, w: 1.6, n: 3.0 },
            { y: 2.95, fx: 0.98, bx: 1.02, w: 1.3, n: 2.6 },
            { y: 3.12, fx: 0.78, bx: 0.86, w: 0.95, n: 2.4 },
          ],
          16,
          (i) => (i === 1 || i === 2 || i === 5 ? 2 : 0),
        );
        const pouches = [-0.62, 0, 0.62].map((z) => rigBox(0.36, 0.62, 0.5, 1, 1.28, 1.2, z));
        return rigMerge([shell, ...pouches, rigBox(0.3, 0.5, 0.42, 1, 1.24, 2.25, -0.75)]);
      }
      function rigBeltGeometry() {
        // Duty belt at the pelvis. Regions: 0 belt, 1 holster and pouches, 2 buckle and cuffs.
        const belt = rigLoft(
          [
            { y: 0.6, fx: 0.93, bx: 0.94, w: 1.33, n: 2.4 },
            { y: 0.98, fx: 0.93, bx: 0.94, w: 1.3, n: 2.4 },
          ],
          16,
          (i, th) => (Math.abs(th) < 12 * RIG_DEG ? 2 : 0),
        );
        return rigMerge([
          belt,
          rigBox(0.55, 1.15, 0.36, 1, 0.2, 0.35, 1.38, 0, 0, 0.05), // holster, right hip
          rigBox(0.4, 0.45, 0.3, 1, 0.7, 0.72, -0.9), // magazine pouch
          rigBox(0.34, 0.5, 0.3, 1, -0.2, 0.7, -1.32), // radio
          rigBox(0.5, 0.3, 0.3, 2, -0.9, 0.78, 0.4), // cuffs
        ]);
      }
      const rigCollarGeometry = () =>
        rigLoft(
          [
            { y: 3.12, fx: 0.62, bx: 0.7, w: 0.78 },
            { y: 3.36, fx: 0.56, bx: 0.62, w: 0.66 },
            { y: 3.62, fx: 0.52, bx: 0.6, w: 0.6 },
          ],
          14,
          null,
          false,
          false,
        );
      const rigHoodGeometry = () =>
        rigLoft(
          [
            { y: 2.72, fx: 0.25, bx: 0.3, w: 0.7, cx: -0.72 },
            { y: 3.1, fx: 0.42, bx: 0.44, w: 0.9, cx: -0.62 },
            { y: 3.45, fx: 0.4, bx: 0.4, w: 0.82, cx: -0.62 },
            { y: 3.66, fx: 0.24, bx: 0.26, w: 0.6, cx: -0.62, dome: 0.03 },
          ],
          10,
        );
      function rigBackpackGeometry() {
        return rigMerge([
          rigLoft(
            [
              { y: -1.35, fx: 0.4, bx: 0.52, w: 0.95, n: 3 },
              { y: -0.9, fx: 0.45, bx: 0.66, w: 1.05, n: 3 },
              { y: 0.9, fx: 0.45, bx: 0.66, w: 1.05, n: 3 },
              { y: 1.3, fx: 0.4, bx: 0.5, w: 0.95, n: 3, dome: 0.1 },
            ],
            12,
          ),
          rigBox(0.3, 0.9, 1.4, 1, -0.62, -0.7, 0),
          rigBox(1.4, 0.2, 0.28, 1, 0.55, 1.05, 0.78, 0, 0, -0.35),
          rigBox(1.4, 0.2, 0.28, 1, 0.55, 1.05, -0.78, 0, 0, -0.35),
        ]);
      }
