    // Foliage cutaway: who the see-through hole in tree crowns, palm fronds and tall shrubs keeps in view (the player on
    // foot or their vehicle) and how big it is (foliageCutawayPlan); foliageHoleCut() is the tree shader's test in JS.
    /**
     * FOLIAGE CUTAWAY
     * The street camera looks down at ~50 degrees, so a crown between it and the player (a forest trail, a street
     * tree, a row of palms) hid the player's car or the player on foot for seconds at a time; the building cutaway
     * (lighting3d-cutaway.js) only cuts structures. The tree material (vegetation3d-material.js FOLIAGE_HOLE_CUT)
     * dissolves its pixels (leaves and the limbs among them; never in the shadow pass, so the crown's shade stays)
     * with the same 4x4 screen door as the building cutaway, where all of these hold:
     *   - on screen, inside the subject's outline (the bounds of its box seen from the camera) grown by `pad`, then
     *     coming back over `fade`, so a crown thins as it reaches the player's outline and closes after it passed;
     *   - nearer the camera than the subject's middle by more than `margin` (what stands behind or beside it stays);
     *   - higher than `floor` over the subject's base (grass, flower beds and low shrubs stay whole).
     * Nothing is decided per tree in JS: the renderer sets three uniforms a frame from this plan
     * (vegetation3d-cutaway.js) and eases them, and each tree pixel tests itself. Same switch as the building
     * cutaway: Settings · Character see-through (`settings.cutaway`, `city3D.setCharacterCutaway`).
     * foliageHoleCut() mirrors the shader for the console and tests: change both together.
     */
    const FOLIAGE_HOLE = {
      // Units past the outline that are fully open (the hole opens before the player is lost).
      pad: 3,
      // Units over which the leaves come back outside that.
      fade: 14,
      // Units nearer the camera than the subject's middle before anything is cut.
      margin: 3,
      // Anything lower than this over the subject's base stays (grass is under ~1.5 m; trunks keep their foot).
      floor: 1.5 * UNITS_PER_METRE,
      // A person's footprint, half its side (units), and the body heights the building cutaway uses.
      footHalf: 0.4 * UNITS_PER_METRE,
      footHeight: PERSON_HEIGHT + 1,
      carHeight: 18,
      tallHeight: 32,
    };
    // The subject as the renderer reads it each frame (one object, rewritten in place).
    const foliageCutawayState = {
      on: false,
      kind: 'none',
      x: 0,
      y: 0,
      // Height of its feet or wheels, and its own height (units).
      base: 0,
      height: 0,
      // Its footprint: half length along `heading`, half width across.
      halfLength: 0,
      halfWidth: 0,
      heading: 0,
      floor: 0,
    };
    function foliageCutawayPlan() {
      const plan = foliageCutawayState,
        vehicle = taxiRide ? taxiRide.car : player.car;
      // Not on the map, hidden, on a rail ride (the train's viaduct) or a park ride (its own camera).
      plan.on = !!settings.cutaway && gameMode !== 'map' && !player.hidden && !transitRide && !player.coaster;
      if (vehicle) {
        const spec = vehicleSpec(vehicle);
        plan.kind = 'vehicle';
        plan.x = vehicle.x;
        plan.y = vehicle.y;
        plan.base = entityElevation(vehicle);
        plan.height = spec.truck || isAircraft(vehicle) ? FOLIAGE_HOLE.tallHeight : FOLIAGE_HOLE.carHeight;
        plan.halfLength = spec.l / 2;
        plan.halfWidth = spec.w / 2;
        plan.heading = vehicle.a || 0;
      } else {
        plan.kind = 'foot';
        plan.x = player.x;
        plan.y = player.y;
        plan.base = entityElevation(player);
        plan.height = FOLIAGE_HOLE.footHeight;
        plan.halfLength = plan.halfWidth = FOLIAGE_HOLE.footHalf;
        plan.heading = 0;
      }
      if (!plan.on) plan.kind = 'none';
      plan.floor = plan.base + FOLIAGE_HOLE.floor;
      return plan;
    }
    /* The open box's half size on screen (units): the subject's box seen along a camera whose right and up axes are
       (rx, ry, rz) and (ux, uy, uz) in three.js world space (map x, height, map y), grown by `pad`. */
    function foliageHoleBox(plan, rx, ry, rz, ux, uy, uz, out) {
      const c = Math.cos(plan.heading),
        s = Math.sin(plan.heading),
        half = plan.height / 2;
      out.x = plan.halfLength * Math.abs(c * rx + s * rz) + plan.halfWidth * Math.abs(c * rz - s * rx) + half * Math.abs(ry) + FOLIAGE_HOLE.pad;
      out.y = plan.halfLength * Math.abs(c * ux + s * uz) + plan.halfWidth * Math.abs(c * uz - s * ux) + half * Math.abs(uy) + FOLIAGE_HOLE.pad;
      return out;
    }
    // The street camera's axes (flight-view3d.js STREET_PITCH: north and down at atan2(680, 560)), for checks without a renderer.
    function streetViewAxes() {
      const pitch = Math.atan2(680, 560);
      return { right: [1, 0, 0], up: [0, Math.cos(pitch), -Math.sin(pitch)], back: [0, Math.sin(pitch), Math.cos(pitch)] };
    }
    /* How much of a tree pixel at map (x, y), height z the tree shader drops (0 kept .. 1 gone) for an orthographic
       view with `axes` ({right, up, back}: the camera's axes, back pointing at the camera), the open box `box` ({x, y})
       and the hole's `strength`. Mirrors FOLIAGE_HOLE_CUT in vegetation3d-material.js, which then screens the result
       through the 4x4 dither. */
    function foliageHoleCut(plan, axes, box, strength, x, y, z) {
      if (strength <= 0) return 0;
      const dx = x - plan.x,
        dh = z - (plan.base + plan.height / 2),
        dy = y - plan.y,
        along = (v) => dx * v[0] + dh * v[1] + dy * v[2],
        front = along(axes.back) - FOLIAGE_HOLE.margin;
      if (front <= 0) return 0;
      const awayX = Math.max(Math.abs(along(axes.right)) - box.x, 0),
        awayY = Math.max(Math.abs(along(axes.up)) - box.y, 0);
      return strength * (1 - smoothStep(0, 1, Math.hypot(awayX, awayY) / FOLIAGE_HOLE.fade)) * smoothStep(0, 4, front) * smoothStep(plan.floor, plan.floor + 4, z);
    }
    /* Console foliageCutaway(): the plan, and how the hole treats points on the street camera's line of sight to
       the subject (every 2 m from its middle up to 24 m high: all should be dropped) and points that must stay
       (behind it, beside it, grass at its feet); `renderer` is the tree material's live state (vegetation3d-cutaway.js:
       uniforms, and the crowns actually on the line of sight with what is left of them), null without one. */
    function foliageCutawayReport() {
      const plan = foliageCutawayPlan(),
        axes = streetViewAxes(),
        box = foliageHoleBox(plan, ...axes.right, ...axes.up, { x: 0, y: 0 }),
        strength = plan.on ? 1 : 0,
        middle = plan.base + plan.height / 2,
        cut = (x, y, z) => +foliageHoleCut(plan, axes, box, strength, x, y, z).toFixed(3),
        sight = [];
      for (let m = 2; middle + m * UNITS_PER_METRE * axes.back[1] < plan.base + 24 * UNITS_PER_METRE; m += 2) {
        const t = m * UNITS_PER_METRE;
        sight.push(cut(plan.x + t * axes.back[0], plan.y + t * axes.back[2], middle + t * axes.back[1]));
      }
      const side = box.x + FOLIAGE_HOLE.fade + 8;
      return {
        on: plan.on,
        setting: !!settings.cutaway,
        kind: plan.kind,
        at: { x: Math.round(plan.x), y: Math.round(plan.y), base: +plan.base.toFixed(1) },
        heightM: +(plan.height / UNITS_PER_METRE).toFixed(2),
        floorM: +((plan.floor - plan.base) / UNITS_PER_METRE).toFixed(2),
        // Half size of the fully open box on the street camera's screen, metres.
        boxM: [+(box.x / UNITS_PER_METRE).toFixed(2), +(box.y / UNITS_PER_METRE).toFixed(2)],
        fadeM: FOLIAGE_HOLE.fade / UNITS_PER_METRE,
        sight,
        stays: {
          // 3 m north of it, half a metre over its middle: behind it from the camera, on screen at its outline.
          behind: cut(plan.x, plan.y - 24, middle + 4),
          // East of it beyond the fade, a little over its middle (in front of it, beside its outline).
          beside: cut(plan.x + side, plan.y, middle + 10),
          // A tuft of grass 1 m in front of its feet, 1 m tall.
          grass: cut(plan.x, plan.y + 8, plan.base + 8),
        },
        renderer: city3D?.foliageCutaway ? city3D.foliageCutaway() : null,
      };
    }
