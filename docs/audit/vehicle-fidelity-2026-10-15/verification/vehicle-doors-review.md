# Door geometry and occupant host review

`vehicle-doors-host.json` is the machine receipt for the production-source host
run: **856 passing assertions**, with SHA256 values for the three packed inputs
and every tested renderer/seat source file. It uses Three.js and actual model,
door, damage, mark, headroom and occupant functions. Browser/GPU results are
separate; this receipt does not claim visual quality or laptop frame rate.

The previous door animation added a moving skin without removing the original
closed shell/trim. Its synthetic opening also filled the doorway with upholstery.
The new backend partitions the fixed body and moving surfaces, preserving original
vertex IDs, custom attributes, material groups and source-face provenance. It
extracts native C8 doors by exact authored part ranges instead of an estimated cut.

Eight actual builders are exercised: Jimny, Generic SUV, Generic Offroad, Sheriff
SUV, legacy sedan, coupe, Crown Vic and native C8. An exterior ray hits each closed
door and misses its open aperture. Other rays through that aperture reach real
authored cabin geometry or the existing production seats/dashboard fallback.
The tests cover source restoration, real entry/exit swing states, simultaneous
doors, front-window movement, rear-quarter glass, lowered/shattered panes, native
cards/hinges/optics, mark transfer, geometry sharing and the actual time-sliced
crumple queue. Repair after a dent restores every original vertex position,
authored normal, UV/finish/colour attribute and triangle index. The
older crumple system may retain a pristine owned clone after repair; the direct
geometry-reference diagnostic reports that truthfully.

The C8 source has asymmetric bucket seats. Measured downward rays at the fitted
driver hip find the cushion at **0.250065m**; the hip joint reference is **0.230m**.
The passenger's separate cushion at x0 is **0.265814m**, with hip **0.245814m**.
This matches the renderer's existing convention of a cushion top 2cm above the
hip reference. Production head geometry has **21.35mm** driver clearance and
**21.99mm** passenger clearance, with torso leans0.49/0.57rad. Actors and source
chairs retain their original sizes. The actual `seatOccupant` function is called
for both seats to verify its produced hip, foot and lean targets use the relevant
plan. Driver target points lie on the source-measured steering rim; passenger
hands remain in the passenger's lap.

Read-only `vehicleDoors` snapshots are tested against the actual rendered layers
and closed-source references. Changing a returned native axis/part-name array
cannot modify source metadata. Material and texture UUID snapshots permit browser
repair checks without a mutable-object console accessor.

Final review also reproduced a late-door char/repair bug using real production
builders: a wreck's newly created door inherited a char material but was absent
from the original swap list, so three source layers stayed charred after repair.
The fix adopts those shared char references with their clean originals at creation.
Three production cases (C8, Jimny and legacy sedan) now verify immediate burnt
appearance, both immediate/later repair, unique swap records and restored source
PBR/emission materials when the repaired door opens. No shader or geometry changed.

`tools/vehicle-door-render-review.mjs` records frozen-build native screenshots,
actual player status, source identity, camera state and renderer faults. Its
staging calls `look` before `drive`, since `look` teleports the player out of a car.
Abandoned initial photography attempts used the wrong boarding order or an
inspection camera obscured by terminal geometry; they are not valid final model
evidence. The final fixture moves to Southport's open runway at [418,6000], with
actual vehicle identity/coordinate checks for each photo. Parked source aircraft
are on the distant apron (nearest at[1000,5420], about822 map units away). The
matched camera uses the same front-quarter115-degree driver-door inspection.
After-only checks cover ten graphics
presets and real night/wear/burn/repair paths; their result belongs in the native
GPU receipt, not this host review.
