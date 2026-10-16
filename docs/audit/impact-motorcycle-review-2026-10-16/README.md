# Vehicle impacts and motorcycles — 16 October 2026

This pass continues the permanent `codex-reviews` branch. The owner requested more convincing vehicle strikes for the player and pedestrians, a fix for walking beside cars, a downloaded Dolcati replacement, a Japanese inline-four sound for the sport motorcycle, graphics defaults, its KUZUKI 600R name, and improved Up/Down wheelie controls.

## Changes

- Bumper contacts now launch player and NPC bodies into the same gravity-driven flight, with speed/frontage/edge-dependent momentum, tumble, ground bounce and sliding. Survivors blend through getting up. Fatal impacts retain body motion and leave a pool only after landing. Harmless walking-speed nudges and separate repeat run-overs retain their contracts.
- People already overlapping a vehicle’s padded footprint can move out or along it. Walking into a clear car, deeper into one, into a second car or through a wall remains blocked.
- The Dolcati V4 uses ROY’s CC BY 4.0 Panigale source. Source close geometry, textures and normals are retained, with shared near/far geometry and fitted steering, wheel centres, saddle, grips and pegs. The existing vehicle and approved motorcycle packs are preserved.
- KUZUKI 600R replaces the VORTEX 900 display name. Its `bike` identity stays compatible with existing traffic and saves. Its sound uses real CC0 Kawasaki ZX6R idle and Suzuki inline-four exhaust recordings, six ratios, shift unloading, engine braking and a high-rev limiter.
- Wheelies retain throttle plus Up to lift, and Down reliably cuts drive and uses rear braking even while throttle is held. Brake grip, front load/lock/lateral force, skid marks and spray follow actual front contact. Rear-axle pivots account for banking and terrain; the fork settles consistently across simulation rates.
- Motion blur is disabled and removed from Graphics. Player outline and ring default to off; explicit saved outline/ring choices are preserved.

## Sound source and reproduction

[Sound audit](../2026-10-16-sportbike-audio.md) records pinned sources, licensing, conversion, behavior and checks. The 24-second sample is an offline render of the shipped engine graph and actual OGG bank, including idle, six gears, limiter, overrun and mute. It excludes global mix processing, radio, ambience and cabin acoustics. It is not a recording of gameplay or an exact GSX-R600 recording. The high loop retains mild coloration from its credited mirror.

## Screenshot evidence

Before model images use the frozen game from `7f45832a`. Native PNGs are cropped original game viewport pixels, with matched inspection cameras, High graphics, clear weather, 13:00 and held simulation. Final runtime images show their recorded flight/wheelie/settings states. No source previews or generated images are presented as game screenshots.

The capture receipts retain exact HTML and recorder hashes, fixture parameters, game state, model identity, GPU state and frame faults. `verification/before-recorder.mjs` is the exact earlier recorder snapshot, retained to match its receipt; the current executable tool is `tools/impact-motorcycle-render-review.mjs`.

## Verification inputs

The final game is frozen from `9db35c35`, SHA-256 `a484c44c40fbca69b42963561994117ecc933d6fb51fd434dc0349cd6209bb46`. Later test-fixture corrections and documentation build byte-identically. The split entry point is `a769758dda13073bd8e326ae2504cc6129c3f0e1db01e5f23d9cbd154533c496`. Receipts are under [verification](verification/).

- The eight final native captures passed with zero captured console errors, GL losses or frame faults. They verify the actual imported `dolcati_roy` model, a player and NPC airborne after 65 km/h strikes, the KUZUKI wheelie at 18.9°/60 km/h, and Graphics with motion blur absent and outline/ring off despite a legacy saved blur setting.
- The production sound graph and native browser decode checks passed. The offline sample and exact source/buffer hashes are retained with their receipts.
- Media-pack tests passed 183 assertions, cache tests passed 23, and the oversized model reconstructed byte-for-byte from bounded classic-script chunks. All 14 packs are at most 12,000,000 bytes including their wrappers.
- Local project-subpath verification passed all 121 publication files (173,927,707 bytes), including both galleries and preserved prior image URLs. Gallery asset links resolve and native screenshot digests match their capture receipts.

## Limits

These changes improve this browser game’s existing physics and procedural animation system. Software WebGL checks do not establish hardware FPS on an M4 Max or AAA production readiness. The close Dolcati is a large hero mesh (372,664 source triangles); distant traffic uses a 25,717-triangle version. Model-specific source and conversion evidence are documented with the import. Native High → Low → High checks retain the actual player model and show zero GL/frame faults (the tier receipt identifies its earlier integrated source build).
