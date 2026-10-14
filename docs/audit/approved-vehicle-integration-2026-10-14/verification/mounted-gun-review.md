# Helicopter gun follow-up

The initial full gameplay pass found a real pre-existing Black Hawk aiming bug:
the hull-centre azimuth was reused at a mount 21 world units ahead of the hull,
creating a parallel projectile line that missed a stationary bystander. The
original failure is retained in the full gameplay log. The fix gives each door
barrel an independent physical lay from its measured mount to the intended
ground point. The same 150°/s traverse and signed 20–160° stops apply; the drawn
barrel and projectile read that state. Existing hull-referenced controls and
report fields retain their meaning. A redundant second 40-unit range clamp at
the mount was removed so a valid nearby point also receives the correct pitch.

[Production-function host checks](mounted-gun-projection-host.json) passed
**79 assertions**, covering both sides, headings, ranges, varying ground heights,
close points, moving aim, physical stops/traverse, measured muzzle offsets,
projectile speed/lifetime/spread, ammunition, restored state and ground guns.
Maximum ground projection miss is 1.14×10⁻¹³ world units. The initial stationary
bystander before the aim point is 2.48 units from the corrected ray, inside the
production 8.046-unit hit radius, rather than the old 21-unit parallel offset.

The [private candidate7 follow-up](mounted-gun-followup-candidate7.json) imported
the original `tools/tests/mounted-guns.mjs` unchanged. All its assertions passed;
the recorder then added a 0.1s trigger / 0.35s flight check. One fired round lowered
the initial bystander's HP from 100 to 59, proving a hit before a long firing
interval could make someone cross an incorrect ray. The complete run reports
**112 assertions**, zero page errors/frame faults and a closed browser. The
[log](mounted-gun-followup-candidate7.log) and receipt preserve input, original
test and recorder hashes, plus every named pre/post gun report.

The tested standalone candidate7 SHA-256 is
`8ed4ef3185e3e3f10819241d44254cc6aafc2215beaa8ec90006c641ce4f1e02`.
Candidate8's later trunk-render correction does not change these gun functions;
the publication package has its own final hash. Earlier candidate6 host evidence
is retained separately and is not the final close-point proof. These NoRender
checks prove physics/control behavior; they are not rendered images or GPU FPS
measurements.
