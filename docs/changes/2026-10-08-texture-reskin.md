# Real brick, concrete, steel, plaster and clay tiles

- City walls now show real materials at true size up close: crisp red brick in 7.5 cm courses on brick buildings,
  concrete on offices, corrugated steel on warehouses and rough render on stucco, each with relief that catches the
  light (MEDIUM and up). Windows, sills, frames, each building's tint and the night windows are unchanged.
- Terracotta roofs are laid with real clay tiles (MEDIUM and up).
- Sources: ambientCG CC0 sets Bricks059, Concrete034, CorrugatedSteel005, Plaster003 and RoofingTiles014A, packed by
  tools/wall_skin.py into assets/wall-skin.webp (425 KB) and credited in docs/THIRD_PARTY_CREDITS.txt.
- Internals: WALL SKIN (cityscape3d-wallskin.js), two texture arrays sampled by the existing facade and roof programs;
  a material picks its layer with a uniform, so no new program, material or draw call. Where a pixel cannot resolve
  the photo (street camera, far cells) the wall is drawn as before.
- Console: `wallSkin()` (layers, tile sizes, means, facades per layer); `lookSwitches({ wallSkin: false })` is the A/B.
