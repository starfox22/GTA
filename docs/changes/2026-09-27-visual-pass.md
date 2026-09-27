# Free-roam visual pass: film grade, golden hour, night light, rain
- Shade and night streets keep their texture: the grade no longer crushes the darkest fifth of
  the image into flat navy (contrast is an S-curve that never clips, the lift tints the darks
  and the warm gain only the lights), so shadows read as cool grey and asphalt, facades under
  awnings and night roads show their detail.
- A real golden hour: the low sun is a stronger warm key under a clear-sky fill (the night
  look no longer starts 1.5 hours before sunset, which turned late afternoons magenta); the
  street lights still come on through the evening.
- Night: street lamp pools reach across the road, North Point Key is lit by its lanterns,
  gate, fountain and lobbies, and mountain village windows glow.
- Rain: no more snow of glinting specks on wet asphalt (the water film smooths the road's
  grain), smaller splash crowns, and wet streets at night read darker with the lamps
  shining in them.
- Trees antialias their leaf edges on HIGH/ULTRA (alpha to coverage); the beach loses its
  painted speckle; helicopter canopies are less black; the unicorn's chest glare is dimmed.
- Sunset Pier and Fort Sentinel get kerb stones and lane wear (their own kerb fields); the
  fort's paving slabs sample its sheet at the right scale.
- Console: `lookSwitches({ foliageCoverage })`; tools: `dev.mjs start|reload --shadercheck`.
