# Rendering: buildings, street frontage and signs

cityscape3d.js and its pieces build the city's buildings (Monarch Isle, the mountain villages and
Fort Sentinel build their own). Draw-call rules: rendering.md; night glows and wet-street streaks at
street level: rendering-weather.md. Numbers: audit/performance.md (Seventh pass).

## Archetypes, roofs and the south face

- Every building gets an archetype (`archetypeFor` → `b.archetype`), a shared facade (SHARED
  FACADES: texture repeat in the UVs, tint as a vertex colour, window light as `cityLit`), a
  parapet and seeded roof plant (recorded as `b.roofKeepOuts`, which the helicopter landing and
  roof walking rules read), billboards. North Point towers are skyline3d.js (lofted plans).
- The street camera looks north, so the south face carries its view: where a street runs along
  it (`cityStreetSouth`) the classic shopfront (cityscape3d-roofs.js `shopfront`: bays, the door
  in the middle bay that crowd-space.js `buildingDoor` uses, awnings registered as overhead
  cover, `b.shopPanes` for the damage code, the sign and its wet-road streak); a brick building
  without one may have the south fire escape. Both draw from `cityRandom`.
- **`cityRandom`'s stream is part of the game**: after the buildings it places the roof plant
  (`b.roofKeepOuts`) and the bus stops (`registerBusStop`). Anything new in the building loop
  draws from its own seeded random (`frontRandom`, `shopPaintRandom`), never `cityRandom`.

## Street frontage on every side (cityscape3d-frontage.js STREET FRONTAGE)

- Each side is classed by `frontageKind`: `street` (a street within reach of its middle: the
  crowd's probe, crowd-space.js `buildingEntrances`, 60 units out with a 12 margin, so the door
  drawn in the middle of a street side is the door people walk into), `alley` (another building
  within 34 units) or `yard`.
- A building's street sides share one style (`frontageStyle`, seeded per building): `shops` (a
  row of shop units either side of a stair door; brick, stucco, deco, half the offices, every
  building with the classic south shopfront), `lobby` (towers, the other offices: glazed lobby
  in a stone surround on a dark base), `stoop` (some brick and stucco: a house door up two steps)
  or `loading` (warehouses: roller-shutter bays). Places, the police HQ and buildings under
  ~6 m get plinths only (`civic`).
- A shop unit: display window on a stall riser (12% have the roller shutter down), a glazed
  door and transom, the fascia, one sign from the shop atlas (`SHOP_NAMES`, never twice running
  on a side), a window neon now and then, light on the pavement after dark (`signSpill`,
  `signLightPools`). North sides add valance awnings, side streets (east and west) hanging
  signs.
- Backs (`frontServiceSide`): the plinth, a service door under a hood, a downpipe; east alleys
  of brick and stucco a fire escape (`frontFireEscape`), and brick side streets the odd one.
  String courses and the office cornice run round all four sides.
- Faces are drawn in face space (`frontageFace`: `u` along the wall as seen from the street,
  `out` away from it; `faceBox`, `shopPane`); east and west boxes swap their sizes instead of
  turning (plain finishes have no grain).
- **Rules**: decoration only: no collision, no overhead cover, no street props, `b.shopPanes`
  stays the south shopfront's. Nothing may hide the player from the street camera: no awning
  east, west or south (a player under it would be covered, and only overhead cover, a game
  rule, is cut away); on a north side nothing stands more than 3 units off the wall, inside the
  cutaway round a player hidden behind the building (lighting3d-cutaway.js: its box plus 3), so
  shallow valance awnings, no canopy, no fire escape. The pavement before a place's door (56
  units), the story payphone (20), the Blue Hour's forecourt, the betting shop and the garage
  lots is kept clear (`frontKeepClear`).
- **Draw calls**: a material is a batch per cell, so the frontage uses few: every plain-painted
  part (panels, doors, shutters, fascias, frames, awnings, the classic shopfront's too) is FRONT
  PAINT (`facePaint` / `paintBox`: one `sharedFacade` material, colour as a vertex colour, so the
  far copy keeps it), the glass `shopWindowMaterial`, signs `neonBoard` / `neonCutout` (no
  flicker variants on the new sides), plus trim, `darkMetal` and `concrete`, which every cell
  already draws. A new part takes a FRONT PAINT colour, never a new `staticMat`.

## Shop windows (cityscape3d-shopwindows.js SHOP WINDOWS)

- One painted atlas of eight interiors (aisles, racks, cafe, shelves, market, service, goods,
  lobby); `shopInteriorFor(name)` picks by trade. A pane (`shopPaneGeometry`) shows a slice of
  its cell at the window's own aspect, tinted by a vertex colour.
- `shopWindowMaterial` is a shared facade (`sharedFacade('shopWindow')`): its night level is the
  facades' (`updateCityscapeVisuals`) and each shop's light its `cityLit` strength (some stay
  dark), times the street power at the fragment (the blackout job). It replaced
  `shopGlassMaterial` in the city's shopfronts (hotels and Monarch Isle keep that one). The
  atlas is not a baked canvas (the far copy clones its texture).

## Signs

- `sign(text, x, z, width, color, vertical, options)` (render3d-streetprops.js), the shop atlas
  and the billboards all paint from the sign design system (signkit3d.js stroke font and
  treatments, signdesigns3d.js families). **No web fonts.** To sign a new business, add one line
  to `SIGN_DESIGNS` copying the nearest entry (unlisted names fall back on trade keywords in
  `designFor`, then the caller's `options.style` hint). Each family paints a day face and a glow
  mask (masks are painted for one night strength, `SIGN_NIGHT`) and says how the board is built
  (`cutout`, `backing`, `lamps`, `marquee`, `flicker`, `light`). Families (the business →
  family table is THE STYLE TABLE in signdesigns3d.js): `neonScript` / `neonBlock` (neon tubes),
  `bulbs` / `cinema` (marquee bulbs), `diner`, `lightbox` (backlit panels: hospitals, airports,
  pharmacies), `enamel` (porcelain: tavern, police, transit), `wood`, `stencil` (armories,
  freight), `deco` (Blue Hour, Deco hotels), `carved` (gold leaf: banks, college), `customs`,
  `airbrush`, `varsity` (stadium, school), `painted`, `hand`, `highway` (reflective road signs),
  `pixel` (LED), `tattoo`, `arabian`, `plaque`. Billboards: each advertiser in `SignArt.ADS` has
  its own painter. The neon atlas (2048²) is packed up front; a new shop name needs room there.
- Small lights are instances of one glow quad (`addGlow`).

## Gotchas

- The damage code's shop panes and `wallOffset` (damage3d-world.js, damage3d-decals.js) know the
  south shopfront only: a bullet hole low on another side sits 0.18 off the wall, behind that
  side's glass or plinth.
- Only a south side's signs lay a wet-road streak (STREAK_CAPACITY is shared city-wide); a sign on
  another side spills light on the pavement only.
