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
      // @include src/ground-shader3d-pars.js
      // @include src/ground-shader3d-albedo.js
      // END SUBSYSTEM: src/ground-shader3d.js
