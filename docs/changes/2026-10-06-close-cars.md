# Cars up close

- Car glass is see-through now: tinted, with the sky sliding over it as the car turns and a mirror sheen at grazing
  angles, and the sun shining in through it. Behind it the cabins show: seats and headrests, the dashboard and
  binnacle, the steering wheel, the mirror, a parcel shelf, a patrol car's cage and laptop.
- The people in cars show through the glass: the player at the wheel, traffic drivers dressed as they get out when
  carjacked, a passenger in some cars, a patrol car's two officers.
- Road grime toward the sills, more on worn cars; rounder tyres.
- Past ~36 m the glass closes to a dark tint and the body impostors keep the old opaque glass, so no far cabin shows
  empty. No new draw calls: the cabin is merged at the end of each kit's trim (`kit.trimOuter` for the impostors), the
  glass casts no shadow (the roof panel and pillars do), the people are the character rig's instances.
- Console: `carModels()` reports each car's `cabin`; `crowdStats()` adds `occupants` and `occupantMs`.
  tools/tests/car-cabins.mjs (rendered page).
