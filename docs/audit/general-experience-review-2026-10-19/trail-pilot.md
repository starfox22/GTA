# Mount Ascent console pilot candidate

This fixes the **console-only route helper**, not ordinary player vehicle physics. The fresh
browser batch on immutable `f70727f921d8ea6945b7eae69fdfa78c00e8f50c242389c6e24d8e501ecccc35`
reproduced the documented 60 Hz timer failure: 76.88 s against the unchanged 75 s challenge;
the preceding 30 Hz run took 72.97 s. The [historical diagnosis](../police-aviation-review-2026-10-15/terrain-rock-contact.md)
and rejected strict-index attempt remain intact.

The ascent now projects the vehicle onto nearby segments and interpolates its target by physical
route distance. Its former two-map-unit index slack could walk ahead through dense samples, and
sample-count look-ahead varied with curve density. Curvature is averaged over 12 map units to avoid
rounded-coordinate noise. A braking envelope anticipates bends and uses a 2 km/h hysteresis instead
of allowing 8 km/h overspeed before braking. Only `trailPilot` in `src/offroad-club.js` changes;
its original descent branch is retained. The maximum requested speed, terrain, source geometry,
rock normals, handling, suspension, timer and existing assertions are unchanged.

The [reproducible host comparison](verification/trail-pilot-host-review.mjs) executes production
terrain, controls, tyre/brake/steering forces, suspension, falls and club clock. It excludes generated
scenery, other actors, static contacts and the browser. Therefore its baseline times are not expected
to reproduce the complete game's exact trajectory. Its independent corridor query measures the union
of the polyline's 21-unit half-width and authored turning pads, rather than relying on the raster
surface's approximate across value.

The final source's four host ascent results are 72.27 s fresh 30 Hz, 72.03 s reused 60 Hz,
72.05 s fresh 60 Hz and 72.40 s reused 30 Hz. Each reaches every checkpoint with 240 HP,
zero corridor departure, zero air time, zero flights and zero NaNs. The largest bump-stop blow
is 0.87 m/s, below the unchanged 4.5 m/s bound. The original descent-35 controller reaches the
trailhead with zero air/flights; its pre-existing wider line is not replaced by the ascent plan.
The original cliff, sedan-road and motorcycle-road controls have byte-identical serialized
results before/after. The focused host regression passes 34 assertions. The
[full results and route traces](verification/trail-pilot-host-results.json),
[comparison log](verification/trail-pilot-host.log) and
[focused log](verification/trail-pilot-focused-host.log) retain the actual runs and source hashes.

The initial over-conservative physical controller was rejected at roughly 85 s. A shorter-look
version met the timer but left the carriageway by up to half a metre and was also rejected.
The selected longer look-ahead/lower corner budget meets both time and corridor bounds. These
experiments altered the helper only; none changed physics or weakened a test.

**Complete-game acceptance is pending.** Run the unchanged `hillclimb-physics` and `falls` browser
modules against a separately frozen build containing this candidate before accepting it. Native
mission wins and screenshots from earlier frozen builds do not establish that result.
