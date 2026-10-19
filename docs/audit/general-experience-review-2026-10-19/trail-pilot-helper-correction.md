# Runtime interpolation dependency correction

The first live acceptance on immutable `10020e235d97e4152260edd44d6541a1ceea68d3afefa04efec8e2940d3391b5`
passed the unchanged `falls` module, then `hillclimb-physics` failed before driving:
`ReferenceError: lerp is not defined`. The [original receipt](verification/trail-pilot-live-attempt1.json)
and [full log](verification/trail-pilot-live-attempt1.log) retain this failed attempt.

The host fixture supplied an unused global `lerp` that does not exist in the game closure, hiding
that dependency. The two interpolation calls now use the identical inline `a + (b - a) * u`
arithmetic. The fake helper has been removed from `terrainFallsFixture` entirely. With the corrected
fixture, the original candidate [reproduces the missing-helper failure](verification/trail-pilot-missing-helper-before.log);
the corrected production source passes [all 34 focused host assertions](verification/trail-pilot-corrected-focused-host.log)
with identical 72.03–72.40 s ascent times and safety telemetry. The
[correction receipt](verification/trail-pilot-helper-correction.json) records exact source/test hashes.

This is a console-helper dependency correction. It changes no route parameters, terrain, physics,
maximum speed, timer or test threshold. The unchanged two-module live acceptance must run against a
new, separately frozen artifact before this candidate is accepted.
