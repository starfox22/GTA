# Default FPS display and bounded renderer transfers

- Enable the FPS counter for new profiles and when storage is unavailable; preserve an explicit saved off setting.
  Sample only live frame intervals, reset after tab visibility changes, and exclude loading/console-stepped time.
  Keep the counter clear of the desktop and touch waypoint layouts.
- Bound the drive-map tail-light count by its own capacity. Analytic headlamps still add tail glows, so the old
  head-count bound could emit 164 tail instances into a 160-instance buffer in the dense-traffic fixture.
- Upload only the current active prefix for distant vehicle matrices/colours, debris, head/tail/strobe quads and
  headlamp haze. Persistent world/vehicle decals merge dirty spans until Three.js actually consumes the upload,
  preserving delayed writes and circular-pool reuse.
- Strengthen rendered smoke to verify default FPS visibility, actual walking/driving movement, map transitions,
  and both camera modes; save six screenshots and a structured report, including on failure.

Verification and screenshots: [October 12 review](../audit/game-review-2026-10-12/README.md).
