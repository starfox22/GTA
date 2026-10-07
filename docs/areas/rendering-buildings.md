# Rendering: buildings and signs

How the city's buildings and their signs are built inside `createCityRenderer()` (the rest of the
renderer: rendering.md; night glows and wet-street streaks at street level: rendering-weather.md).

## Buildings and signs

- cityscape3d.js builds every building from an archetype (`archetypeFor` → `b.archetype`)
  with roofs, plant (recorded as `b.roofKeepOuts`, which the helicopter landing rules read),
  shopfronts, fire escapes, billboards. North Point towers are skyline3d.js (lofted plans).
- Signs: `sign(text, x, z, width, color, vertical, options)` (render3d-streetprops.js), the
  shop atlas and the billboards all paint from the sign design system (signkit3d.js stroke
  font and treatments, signdesigns3d.js families). **No web fonts.** To sign a new business,
  add one line to `SIGN_DESIGNS` copying the nearest entry (unlisted names fall back on
  trade keywords in `designFor`, then the caller's `options.style` hint). Each family paints
  a day face and a glow mask (masks are painted for one night strength, `SIGN_NIGHT`) and
  says how the board is built (`cutout`, `backing`, `lamps`, `marquee`, `flicker`, `light`).
  Families (the business → family table is THE STYLE TABLE in signdesigns3d.js):
  `neonScript` / `neonBlock` (neon tubes), `bulbs` / `cinema` (marquee bulbs), `diner`,
  `lightbox` (backlit panels: hospitals, airports, pharmacies), `enamel` (porcelain: tavern,
  police, transit), `wood`, `stencil` (armories, freight), `deco` (Blue Hour, Deco hotels),
  `carved` (gold leaf: banks, college), `customs`, `airbrush`, `varsity` (stadium, school),
  `painted`, `hand`, `highway` (reflective road signs), `pixel` (LED), `tattoo`, `arabian`,
  `plaque`. Billboards: each advertiser in `SignArt.ADS` has its own painter.
- Small lights are instances of one glow quad (`addGlow`).
