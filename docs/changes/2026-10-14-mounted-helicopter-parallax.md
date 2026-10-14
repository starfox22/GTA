# Mounted helicopter guns converge on the ground target

- Lay Black Hawk door barrels from their measured mounts toward the intended ground
  point. The old hull-centre direction produced a parallel offset that could miss
  stationary people and vehicles even when the aim report showed zero error.
- Preserve hull-referenced controls/reports, physical traverse speed and arc stops,
  mount locations, projectile speed/lifetime, spread and ammunition. The renderer
  reads the physical barrel state so the drawn gun and projectile direction agree.
- Preserve the actual target elevation at nearby ground points; the hull's range
  clamp stays in place, without a second offset-mount clamp pitching beyond it.
- Add a production-function projection regression covering both sides, headings,
  ranges, elevations, moving aim, arc stops and the existing ground mounted guns.
