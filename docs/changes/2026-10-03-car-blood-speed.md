# Bonnet blood by speed
- One person leaves a modest mark on the bonnet, scaled smoothly by speed: nothing under 14 km/h (a crawl over
  someone leaves the bonnet clean; the tyres may still carry blood from a pool), a few drops at 20-25 km/h, a
  clear splash at 50, a heavy splash with streaks at 80. About a third less per person than before at the same
  speed (a death at 50 km/h: sev 0.47, was 0.73; at 80: 0.69, was 1); a survivor leaves 0.6 of that.
- Several victims pile up instead of replacing each other: once a car carries three stains, the next people
  hit on the same side are painted over the nearest stain, so five or more build up to a heavily bloodied
  front (five at 50 km/h: load 2.35, over three times one hit at 80).
- A second pass over someone on the ground stains by its real speed (it used to count as at least 22 km/h).
- Internals: `carStainSeverity(kph, fatal)`; stain records gain `hits`, `load`, `adds` (car-stains.js PILING
  UP); `cbTopUpJob` (carblood3d-streaks.js) paints piled hits over a stain's tiles copied back from the sheet,
  in the same time slices, no re-fit; light hits paint smaller and fewer drops (`lite`, `few`).
- Console: `carBloodReport()` adds `hits`, `load` and per stain `hits`, `load`, `adds`; `skin.piled` /
  `piledPainted`. Tests: car-blood (curve by speed, five hits), second-run-over (a crawl leaves no stain).
