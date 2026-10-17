# Monarch collection and selected vehicle names

This update continues `codex-reviews`. Solstice is now **Chrynser Sebing** and
Nomad Cruiser is **Chorley 72**, using the owner's exact spellings. Stable vehicle
types, saves, prices, handling and all other displayed names remain unchanged.
The existing downloaded Brutini SVJ is retained.

The other eleven Prestige entries now use ten downloaded, attributed real-car
sources. Several are family or class alternatives rather than exact trims:

| Game entry | Downloaded source | Match |
| --- | --- | --- |
| Walter Martin Valkyrie | Aston Martin Valkyrie, MHDesigning | Model |
| Walter Martin DBS Superleggera | Aston Martin DB11, Black Snow | Family alternative |
| Chevette ZR1X | Corvette C8 Stingray, Hari | Family alternative |
| Chevette Z06 Carbon Aero | Same full-source C8 Stingray | Family alternative |
| Mugatti Wayron Super Sport | Bugatti Veyron 16.4 Super Sport, andikapratamaw | Model |
| Mugatti Tourbillon | Bugatti Tourbillon, MdMahib | Model |
| Konigsberg Jasko Absolut | Koenigsegg CCX, _Sheep19 | Family alternative |
| Pagano Sirocco | Pagani Huayra, Black Snow | Model |
| Rimak Novera | Tesla Roadster 2020, metarex.4d | EV class alternative |
| McLowen W1 | McLaren P1 GTR, Desiccated_Lemon | Family alternative |
| Cavalino La Fera | Ferrari LaFerrari, vecarz | Model |

All ten sources carry model-specific CC BY 4.0 attribution. Exact-model sources
with incompatible or contradictory terms were excluded. The Novera alternative
was stated in the work thread after an optional preference question remained
unanswered; the choice does not turn a Tesla source into a Rimac model. The
[full credits](../../THIRD_PARTY_CREDITS.txt) identify originals and authors.

## Conversion and runtime

The independent Monarch pack preserves **2,539,391 included original near
triangles**. The independent verifier compares all **7,618,173 original corners**
against positions, split normals, four channel UV sets, source colour and
material flags. Whole source faces are partitioned into body, wheels, brakes,
glass and other roles. The CCX studio floor is explicitly excluded. Only Far
geometry is reduced. Wheels use measured source hubs and stationary calipers.
Source display steering is neutralized by a rigid transform.

The converter retains separate albedo, ORM, normal and emissive mapping,
per-channel texture transforms, RGBA vertex colour, sidedness and MASK cutoffs.
Paint masks keep badges, vents, black trim and wheel pigment out of resprays,
including instanced traffic. The downloaded Roadster’s pale Sidewall/Thread
materials receive a [source-specific dark rubber tint](verification/roadster-rubber-tint-proof.json);
all other tyre families and source data stay unchanged. Atlases retain their measured source colours;
explicit texture resampling is recorded in the conversion receipt. Unsupported
glTF extensions use the game's material/glass approximations, so the result is
not a claim of identical offline path-traced shading or commercial AAA parity.

The final shader guards the minification footprint within each source tile,
using a conservative coordinate inset to correct the observed contamination
from neighbouring atlas tiles. The source's native 128-pixel carbon tile is
verified byte-identical; the correction changes sampling, not that texture.
This is a footprint guard over shared atlas mipmaps, not a separate periodic
mipmap chain for each source tile. The independent
[atlas filtering oracle](verification/atlas-filtering-proof.json) checks 1,938
cases separately from the runtime material tests.

Low/Medium use atlases no larger than 1024 pixels. High/Ultra give the driven
source family, or the nearest display within 18 metres on foot, its full atlas.
Only one source family can hold High textures. Demotion releases the previous
High GPU allocation before promotion and uses an already decoded Low fallback;
asynchronous image callbacks have epoch guards. The worst all-ten-families
RGBA8-plus-mips estimate is **437.77 MiB**, versus 1,621.8 MiB without that policy.
This is a texture estimate, not total GPU usage or a frame-rate measurement.

Cockpit fits use measured hip, recline, steering and pedal metadata. The actor
and downloaded source geometry retain their original scale. Fixed source fits
prevent the generic glass approximation moving an occupant away from the
authored seat. Closed-cabin checks use actual rendered adult head/hair/cap
vertices and the actual source canopy; the open CCX is classified separately.
Burnt materials inherit the original source shader, including independent UVs,
normals and cutoffs. Repair restores source references and releases private char
state. Shared kits, maps and geometry survive individual vehicle retirement.

The [pipeline contract](../../areas/vehicles-and-driving-models-monarch-pipeline.md)
documents the recipes, source preparation, immutable near geometry, lossless
pack aliases and independent verification. All 128 asset files from the previous
Hum-4 release are byte-identical in this update; see
[the boundary receipt](verification/unchanged-prior-assets.json).

## Screenshots and verification

The gallery compares every changed entry: eleven model replacements and two
selected names. Before is the published Hum-4 build, monolithic SHA-256
`56488452002a4788593122dd24cc10b670a688ada97679256587aa73cdcb213f`.
The capture setup uses seed 1, High quality, clear weather, 13:00 light, the same
1000 × 700 viewport, airport position and inspection camera. The final recorder
adds a read-only texture-readiness gate. The after captures use ranges
`0:6` and `6:13`; each shard simulates the same prefix as a full run, with
only prefix drawing suppressed. The [strict comparison verifier](verification/gallery-image-manifest.json)
confirms exact camera, status and simulation inputs across all thirteen entries.
Native game screenshots retain the normal vehicle-name HUD and are not edited.
The [packaged input/credits smoke](verification/packaged-input-smoke/smoke.json)
passed walking, driving, map, both cameras and readable attribution for all ten
sources, with zero errors. That run precedes only the isolated Roadster rubber
tint; final collection captures and lifecycle checks use the corrected build.
The separate `source-previews/` images are explicitly labelled studio renders
of the original downloads, not gameplay evidence.

All thirteen final comparisons pass: 26 unedited native PNGs have verified
digests, matched status/camera and the expected source models and High texture
readiness. The two selected names match exactly; all other displayed names are
unchanged.

Frozen monolithic HTML SHA-256 is
`e086ab80b0cb52e289ea6adc562170acb2bd8d42e53fe57ac2c5ee8f4ca8d445`;
the source runtime SHA-256 is
`305c05e7123a85e691519f38d70d82d3d7822f097b7b1f1acf1bbab99ecf7489`;
the split entry SHA-256 is
`971a2df4e8b34242908e21471c470090eec4465410cc5826763a69cb902892cc`.
The [frozen-input receipt](verification/frozen-build.json) records exact source,
pack, credits, recorder and build hashes. The [packaging audit](verification/packaged-build-audit.json)
also confirms all three executable inline scripts, the credits block and the normalized page shell
match the frozen monolith.

The final [source/rig integration proof](verification/seat-fit-final-proof.json)
passes 619 production-host assertions, including 47 checks of actual fitted
glazing and gameplay hit bounds. Both seats use 89,740 actual adult head points
against original canopy triangles. Steering lock, limb reach, source floor,
recorded drive-by origin, pristine paint, wear, burn, glass, puncture and repair
are checked independently of the native screenshots. The minimum closed-cabin
head gap is 26.59 mm. The default cabin path also retains exact parity across
24 prior plans. Open-top CCX and missing/near-vertical floor surfaces are
identified explicitly rather than treated as roofs or horizontal floors.

The separate [runtime/material suite](verification/runtime-host-final.json)
passes 2,828,858 assertions and 1,626 ray comparisons against vanilla Three.js.
It checks original flags/UVs, the 16-slot instanced attribute budget, shared and
private resource ownership, source-sided ray queries, stale texture loads and
the source-tile filtering guards.
The [canonical source proof](verification/canonical-corner-proof.json) and
[original-corner proof](verification/all-corner-proof.json) both identify the
final geometry pack SHA-256
`25473f93258f4c6ec167e2fb9953e8fc9d40d58844862cb8c4289b22826490ed`.
The [packaged media proof](verification/packaged-media.json) passes all 30
ordered classic media scripts, enforces the 12,000,000-byte ceiling including
wrappers, and compares all 209 reconstructed/streamed assets byte for byte.

The [final native runtime review](verification/native-runtime/monarch-runtime-review.json)
passes **223 assertions** on the final frozen game. Both CCX and C8 complete
clean, burn, first native door, repair and reopen cycles with exact source
geometry/material/map restoration. All fifteen real dealership stocks use their
expected models; all ten source families finish Low/High loading, with <=1024
Low maps and exactly one full-detail High family. Final browser/shader errors,
frame faults, context losses and remaining char models are all zero. Five
unaltered fixture screenshots are retained with this review, including the
actual-stock overview; the wreck fixtures intentionally retain test debris.

[Run 39066422675](https://github.com/starfox22/GTA/actions/runs/39066422675)
deployed `7ab88893` and verified every served file against the
[checked local artifact](verification/public-artifact.json): **220 files,
411,147,527 bytes**. The [successful publication receipt](verification/successful-deployment.json)
retains the real build, gallery, deployment and public SHA verification steps.
[Play the release](https://starfox22.github.io/GTA/?review=971a2df4e8b34242) or
[view all thirteen comparisons](https://starfox22.github.io/GTA/review/?review=971a2df4e8b34242).
This receipt-only documentation follow-up leaves game and gallery bytes unchanged.
