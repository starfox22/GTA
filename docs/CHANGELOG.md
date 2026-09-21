# Changelog

## 25.0.0 — City, graphics and contracts overhaul

Repository
- Split the single-file review build into `src/*.js` subsystems, `vendor/three.r160.js`,
  decoded `assets/` with a manifest, `src/shell.html`, and `tools/build.py` that reassembles
  the self-contained `dead-end-city.html` byte-for-byte in content.
- Added `tools/check.sh` (assemble + `node --check`), `tools/smoke.mjs` (headless boot test
  with screenshots) and a documented `window.DeadEndCity` developer console.

City layout
- District zoning drives building heights (`zoneHeight`): a financial core of towers whose
  height falls off from the centre, mid-rise Midtown and South Bank, low brick Old Quarter,
  docks sheds, pastel Art Deco on the Keys with taller Ocean Drive hotels.
- Block patterns by zone: tower-on-plaza blocks in the Financial District, three-lot alley
  blocks in the Old Quarter and Battery Point, courtyard slabs in South Bank.
- Every grid road has a name (`STREET_NAMES`); the HUD shows the current street and district.
- Avenues carry double yellow centre lines; kerb lines, manholes and plazas are painted into
  the ground texture.

Graphics
- New `cityscape3d.js`: eight facade archetypes, seven procedural roof textures, parapets,
  instanced roof equipment (AC, vents, skylights, dishes, solar, planters, water towers,
  bulkheads, helipads, beacons, billboards, neon hotel signs), shopfronts with awnings and a
  32-name sign atlas, fire escapes and balconies.
- Windows light up at night through emissive window masks; lamps, shop glass, neon and
  vehicle head/tail lights follow the night amount.
- Instanced street furniture: hydrants, bins, newspaper boxes, mailboxes, parking meters,
  bollards, cones, dumpsters, crates, benches and bus shelters with ads.
- Shore-aware water shader: distance-to-shore field, four Gerstner swells, noise ripples,
  shallow turquoise, breaking and retreating foam, whitecaps, sun glitter, moon sparkle and
  city-light spill at night.
- Time of day: longer days with a real golden hour; sky, fog, sun and ambient blend through
  night, dawn/dusk and day keyframes.

Gameplay
- Pedestrian life: idling, window shopping, sitting on shared benches, walking pairs, speech
  bubbles (near misses, bumps, panic, gossip about a wanted player), flinching from fast
  cars. More pedestrians and outfit colours.
- Five new contracts after the story: Rush Hour, Fireworks Night, Blackout (the western
  districts go dark until restored), Ring Run (aerial time-trial) and Repo Man.
- Mission menu labels contracts and their contacts; the 0 key selects mission 10.

Bug fixes (see `docs/audit/` for the full reports)
- Ghost vehicles after mission cleanup, soft-lock inside destroyed vehicles, exit velocity
  no-ops, touch/mouse aim conflicts, touch overlay on the death screen, plane wrecks sinking
  below terrain, helicopter hovering after the pilot dies, mid-air destruction ignored during
  invulnerability, plane wheel wobble, mis-drawn harbor crane, per-frame allocations in the
  renderer.
